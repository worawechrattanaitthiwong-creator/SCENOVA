import type { ModelDefinition } from "@/lib/domain";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";
import { readCharacterReference, verifyCharacterReferenceSignature } from "@/lib/character-reference-storage";
import type { GenerateVideoRequest, GenerateVideoResult, ProviderRuntimeCredential, VideoProvider } from "@/lib/providers/video-provider";
import { resolveVideoApiModelId } from "@/lib/video-model-versions";
import { asRecord, buildCompiledVideoPrompt, byokAwareEstimate, clampInt, errorMessage, runwayRatio } from "@/lib/providers/video-provider-utils";

const DEFAULT_BASE_URL = "https://api.dev.runwayml.com/v1";
const DEFAULT_MODEL = "gen4.5";
const RUNWAY_VERSION = "2024-11-06";
const RUNWAY_PROMPT_MAX_CHARS = 1000;
const RUNWAY_IMAGE_DATA_URI_MAX_BYTES = 5 * 1024 * 1024;
const CHARACTER_REFERENCE_PREFIX = "/api/character-references/";
const RUNWAY_EPHEMERAL_CACHE_MS = 23 * 60 * 60 * 1000;

const runwayEphemeralCache = new Map<string, { uri: string; expiresAt: number }>();

export type RunwayVideoModelId = "gen4.5" | "gen4_turbo" | "seedance2_5" | "gemini_omni_flash" | "aleph2" | "ruby";
export type RunwayEndpoint = "text_to_video" | "image_to_video" | "video_to_video" | "video_to_hdr";

export type RunwayVideoModelProfile = {
  modelId: RunwayVideoModelId;
  minDuration: number;
  maxDuration: number;
  text: boolean;
  image: boolean;
  video: boolean;
  nativeAudio: boolean;
  transformOnly: boolean;
};

const RUNWAY_VIDEO_PROFILES: Record<RunwayVideoModelId, RunwayVideoModelProfile> = {
  "gen4.5": { modelId: "gen4.5", minDuration: 2, maxDuration: 10, text: true, image: true, video: false, nativeAudio: false, transformOnly: false },
  gen4_turbo: { modelId: "gen4_turbo", minDuration: 2, maxDuration: 10, text: false, image: true, video: false, nativeAudio: false, transformOnly: false },
  seedance2_5: { modelId: "seedance2_5", minDuration: 4, maxDuration: 30, text: true, image: true, video: true, nativeAudio: true, transformOnly: false },
  gemini_omni_flash: { modelId: "gemini_omni_flash", minDuration: 3, maxDuration: 10, text: true, image: true, video: true, nativeAudio: true, transformOnly: false },
  aleph2: { modelId: "aleph2", minDuration: 2, maxDuration: 30, text: false, image: false, video: true, nativeAudio: false, transformOnly: true },
  ruby: { modelId: "ruby", minDuration: 1, maxDuration: 30, text: false, image: false, video: true, nativeAudio: true, transformOnly: true },
};

export function getRunwayVideoModelProfile(value: string): RunwayVideoModelProfile | null {
  return RUNWAY_VIDEO_PROFILES[value as RunwayVideoModelId] || null;
}

export function normalizeRunwayPromptText(value: string, maxChars = RUNWAY_PROMPT_MAX_CHARS) {
  return value.trim().slice(0, Math.max(1, maxChars));
}

function promptLimit(modelId: string) {
  if (modelId === "seedance2_5") return 15_000;
  if (modelId === "gemini_omni_flash" || modelId === "aleph2") return 4_000;
  return RUNWAY_PROMPT_MAX_CHARS;
}

export function parseSignedCharacterReference(value: string) {
  try {
    const url = new URL(value, "https://scenova.invalid");
    if (!url.pathname.startsWith(CHARACTER_REFERENCE_PREFIX)) return null;
    const id = decodeURIComponent(url.pathname.slice(CHARACTER_REFERENCE_PREFIX.length));
    const owner = url.searchParams.get("o") || "";
    const signature = url.searchParams.get("sig") || "";
    if (!id || !owner || !signature) return null;
    return { id, owner, signature };
  } catch {
    return null;
  }
}

async function loadSignedCharacterReference(value: string) {
  const parsed = parseSignedCharacterReference(value);
  if (!parsed) return null;
  if (!verifyCharacterReferenceSignature(parsed.owner, parsed.id, parsed.signature)) {
    throw new Error("RUNWAY_PROMPT_IMAGE_REFERENCE_INVALID:Character reference signature is invalid or expired");
  }
  const file = await readCharacterReference(parsed.owner, parsed.id);
  if (!file) throw new Error("RUNWAY_PROMPT_IMAGE_REFERENCE_NOT_FOUND:Character reference file is missing");
  return { ...parsed, ...file };
}

function normalizeRunwayImageMime(mime: string) {
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

export function isSupportedRunwayImageData(mime: string, data: Uint8Array) {
  const normalizedMime = normalizeRunwayImageMime(mime);
  if (normalizedMime === "image/jpeg") {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }
  if (normalizedMime === "image/png") {
    return data.length >= 8
      && data[0] === 0x89
      && data[1] === 0x50
      && data[2] === 0x4e
      && data[3] === 0x47
      && data[4] === 0x0d
      && data[5] === 0x0a
      && data[6] === 0x1a
      && data[7] === 0x0a;
  }
  if (normalizedMime === "image/webp") {
    return data.length >= 12
      && Buffer.from(data.subarray(0, 4)).toString("ascii") === "RIFF"
      && Buffer.from(data.subarray(8, 12)).toString("ascii") === "WEBP";
  }
  return false;
}

export function buildRunwayImageDataUri(mime: string, data: Buffer) {
  const normalizedMime = normalizeRunwayImageMime(mime);
  if (!isSupportedRunwayImageData(normalizedMime, data)) {
    throw new Error(`RUNWAY_PROMPT_IMAGE_REFERENCE_INVALID_FILE:Expected JPEG, PNG, or WebP bytes for ${normalizedMime || "unknown MIME"}`);
  }
  const dataUri = `data:${normalizedMime};base64,${data.toString("base64")}`;
  return Buffer.byteLength(dataUri, "utf8") <= RUNWAY_IMAGE_DATA_URI_MAX_BYTES ? dataUri : null;
}

function filenameForMime(id: string, mime: string) {
  if (/\.(jpg|jpeg|png|webp)$/i.test(id)) return id;
  if (mime === "image/png") return `${id}.png`;
  if (mime === "image/webp") return `${id}.webp`;
  return `${id}.jpg`;
}

async function uploadRunwayEphemeralImage(input: {
  apiKey: string;
  baseUrl: string;
  sourceKey: string;
  id: string;
  mime: string;
  data: Buffer;
}) {
  const cached = runwayEphemeralCache.get(input.sourceKey);
  if (cached && cached.expiresAt > Date.now()) return cached.uri;

  const filename = filenameForMime(input.id, input.mime);
  const startResponse = await fetch(`${input.baseUrl}/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": RUNWAY_VERSION,
    },
    body: JSON.stringify({ filename, type: "ephemeral" }),
    signal: AbortSignal.timeout(20_000),
  });
  const startJson = asRecord(await startResponse.json().catch(() => ({})));
  if (!startResponse.ok) {
    throw new Error(`RUNWAY_UPLOAD_INIT_HTTP_${startResponse.status}:${formatRunwayApiError(startJson).slice(0, 800)}`);
  }

  const uploadUrl = typeof startJson.uploadUrl === "string" ? startJson.uploadUrl : "";
  const runwayUri = typeof startJson.runwayUri === "string" ? startJson.runwayUri : "";
  const fields = asRecord(startJson.fields);
  if (!uploadUrl || !runwayUri) throw new Error("RUNWAY_UPLOAD_INVALID_RESPONSE:MISSING_UPLOAD_URL_OR_URI");

  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string" || typeof value === "number") form.append(key, String(value));
  }
  form.append("file", new Blob([Uint8Array.from(input.data)], { type: input.mime }), filename);

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!uploadResponse.ok) {
    const detail = (await uploadResponse.text().catch(() => "")).replace(/\s+/g, " ").trim();
    throw new Error(`RUNWAY_UPLOAD_HTTP_${uploadResponse.status}:${detail.slice(0, 800) || "Ephemeral image upload failed"}`);
  }

  runwayEphemeralCache.set(input.sourceKey, { uri: runwayUri, expiresAt: Date.now() + RUNWAY_EPHEMERAL_CACHE_MS });
  return runwayUri;
}

export function formatRunwayApiError(payload: Record<string, unknown>) {
  const rawPrimary = errorMessage(payload).trim();
  const primary = rawPrimary && rawPrimary !== "{}" ? rawPrimary : "Runway API request failed";
  const issues = Array.isArray(payload.issues) ? payload.issues : [];
  if (!issues.length) return primary;

  const details = issues.slice(0, 6).map((issue) => {
    if (typeof issue === "string") return issue.trim();
    const record = asRecord(issue);
    const rawPath = record.path ?? record.field ?? record.param;
    const path = Array.isArray(rawPath)
      ? rawPath.map((part) => String(part)).join(".")
      : typeof rawPath === "string"
        ? rawPath
        : "";
    const rawDetail = errorMessage(record).trim();
    const detail = rawDetail && rawDetail !== "{}" ? rawDetail : JSON.stringify(record);
    return path ? `${path}: ${detail}` : detail;
  }).filter(Boolean);

  return details.length ? `${primary} | issues: ${details.join(" | ")}` : primary;
}

function explicitRenderSegmentImage(renderSegment: GenerateVideoRequest["renderSegment"]) {
  const raw = (renderSegment as GenerateVideoRequest["renderSegment"] & { imageReferences?: unknown }).imageReferences;
  if (!Array.isArray(raw)) return undefined;
  return raw.find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim();
}

export function runwayPromptImageSource(request: GenerateVideoRequest) {
  // Agent text-to-video must never inherit an image reference from another layer.
  // An Agent render uses an image only when that exact RenderSegment explicitly carries one.
  if (request.idempotencyKey.startsWith("agent:")) return explicitRenderSegmentImage(request.renderSegment);
  return request.imageReferences[0];
}

function cleanReferences(values: string[], limit: number) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit);
}

function portrait(aspectRatio?: string) {
  return String(aspectRatio || "").trim().startsWith("9:16");
}

export function runwayRatioForModel(modelId: string, aspectRatio?: string, resolution?: string) {
  if (modelId === "seedance2_5" && String(resolution || "").toLowerCase().includes("1080")) {
    return portrait(aspectRatio) ? "1080:1920" : "1920:1080";
  }
  if (modelId === "seedance2_5") return portrait(aspectRatio) ? "720:1280" : "1280:720";
  if (modelId === "gemini_omni_flash") return portrait(aspectRatio) ? "720:1280" : "1280:720";
  return runwayRatio(aspectRatio);
}

export function resolveRunwayEndpoint(modelId: string, hasImage: boolean, hasVideo: boolean): RunwayEndpoint {
  if (modelId === "ruby") return "video_to_hdr";
  if (modelId === "aleph2") return "video_to_video";
  if (hasVideo && (modelId === "seedance2_5" || modelId === "gemini_omni_flash")) return "video_to_video";
  if (hasImage) return "image_to_video";
  return "text_to_video";
}

export class RunwayVideoProvider implements VideoProvider {
  id = "runway";
  credentialProviderId = "runway";
  billingMode: "BYOK" | "SYSTEM";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelId: string;

  constructor(credential?: ProviderRuntimeCredential) {
    this.apiKey = credential?.apiKey || process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET || "";
    this.baseUrl = (credential?.baseUrl || process.env.RUNWAY_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.modelId = credential?.modelId || process.env.RUNWAY_MODEL_ID || DEFAULT_MODEL;
    this.billingMode = credential?.billingMode || "SYSTEM";
  }

  isConfigured() { return Boolean(this.apiKey); }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": RUNWAY_VERSION,
    };
  }

  private async preparePromptImage(value?: string) {
    if (!value) return undefined;
    if (value.startsWith("runway://") || value.startsWith("data:")) return value;

    const file = await loadSignedCharacterReference(value);
    if (!file) return value;

    const dataUri = buildRunwayImageDataUri(file.mime, file.data);
    if (dataUri) return dataUri;

    return uploadRunwayEphemeralImage({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      sourceKey: `${file.owner}:${file.id}`,
      id: file.id,
      mime: file.mime,
      data: file.data,
    });
  }

  private async prepareImageReferences(values: string[], limit: number) {
    const results: string[] = [];
    for (const value of cleanReferences(values, limit)) {
      const prepared = await this.preparePromptImage(value);
      if (prepared) results.push(prepared);
    }
    return results;
  }

  getModelDefinition(): ModelDefinition {
    return {
      id: "runway-gateway",
      name: "Runway Multi-Model Gateway",
      provider: "Runway",
      descriptionTh: "Runway Developer API สำหรับ Gen-4.5, Seedance 2.5, Gemini Omni Flash, Aleph 2.0 และ Ruby HDR",
      bestFor: ["cinematic video", "reference video", "native audio", "video editing", "HDR post-production"],
      maxSecondsPerGeneration: 30,
      resolutions: ["720p", "1080p"],
      supportsAudio: true,
      supportsImageReference: true,
      supportsVideoReference: true,
      supportsMultiShot: false,
      priceLevel: 3,
      enabled: this.isConfigured(),
    };
  }

  async estimateCost(request: GenerateVideoRequest) {
    const modelId = resolveVideoApiModelId("Runway", request.modelVersionId) || this.modelId;
    const profile = getRunwayVideoModelProfile(modelId) || RUNWAY_VIDEO_PROFILES["gen4.5"];
    const seconds = clampInt(request.renderSegment.duration, profile.minDuration, profile.maxDuration);
    const thbPerSecond = Number(process.env.RUNWAY_SYSTEM_THB_PER_SECOND || 12);
    return byokAwareEstimate(this.billingMode, seconds * (Number.isFinite(thbPerSecond) ? thbPerSecond : 12));
  }

  async generate(request: GenerateVideoRequest): Promise<GenerateVideoResult> {
    await assertEmergencyCapability("generation", this.id);
    await enforceEmergencyRateLimit(`video:project:${request.projectId}`, Number(process.env.EMERGENCY_VIDEO_CALLS_PER_MINUTE || 2));
    if (!this.apiKey) throw new Error("RUNWAY_PROVIDER_UNAVAILABLE:API_KEY_NOT_CONFIGURED");

    const modelId = resolveVideoApiModelId("Runway", request.modelVersionId) || this.modelId;
    const profile = getRunwayVideoModelProfile(modelId);
    if (!profile) throw new Error(`RUNWAY_MODEL_UNSUPPORTED:${modelId}`);

    const duration = clampInt(request.renderSegment.duration, profile.minDuration, profile.maxDuration);
    const compiledPrompt = normalizeRunwayPromptText(buildCompiledVideoPrompt(request), promptLimit(modelId));
    const promptImageSource = runwayPromptImageSource(request);
    const promptImage = await this.preparePromptImage(promptImageSource);
    const videoReferences = cleanReferences(request.videoReferences, 10);
    const audioReferences = cleanReferences(request.audioReferences, 10);
    const allPreparedImages = await this.prepareImageReferences(request.imageReferences, modelId === "seedance2_5" ? 30 : 5);
    const endpoint = resolveRunwayEndpoint(modelId, Boolean(promptImage), Boolean(videoReferences[0]));
    const ratio = runwayRatioForModel(modelId, request.aspectRatio, request.resolution);
    const body: Record<string, unknown> = { model: modelId };

    if (modelId === "gen4_turbo" && !promptImage) throw new Error("RUNWAY_GEN4_TURBO_REQUIRES_IMAGE_REFERENCE");
    if ((modelId === "aleph2" || modelId === "ruby") && !videoReferences[0]) {
      throw new Error(modelId === "ruby" ? "RUNWAY_RUBY_REQUIRES_VIDEO_REFERENCE" : "RUNWAY_ALEPH2_REQUIRES_VIDEO_REFERENCE");
    }

    if (modelId === "ruby") {
      body.videoUri = videoReferences[0];
      body.outputFormat = "hdr10";
    } else if (modelId === "aleph2") {
      body.videoUri = videoReferences[0];
      body.promptText = compiledPrompt;
    } else if (modelId === "gemini_omni_flash") {
      if (endpoint === "video_to_video") {
        body.videoUri = videoReferences[0];
        body.promptText = compiledPrompt;
        if (allPreparedImages.length) body.references = allPreparedImages.map((uri) => ({ uri }));
      } else {
        body.promptText = compiledPrompt;
        body.duration = duration;
        body.ratio = ratio;
        if (promptImage) body.promptImage = promptImage;
      }
    } else if (modelId === "seedance2_5") {
      body.promptText = compiledPrompt;
      body.audio = audioReferences.length > 0;
      body.duration = duration;
      body.ratio = ratio;
      if (endpoint === "video_to_video") {
        body.promptVideo = videoReferences[0];
        body.mode = "reference";
        const extraVideos = videoReferences.slice(1);
        if (extraVideos.length) body.referenceVideos = extraVideos.map((uri) => ({ type: "video", uri }));
        if (allPreparedImages.length) body.references = allPreparedImages.map((uri) => ({ uri }));
      } else if (endpoint === "image_to_video") {
        body.promptImage = promptImage;
      } else {
        if (allPreparedImages.length) body.references = allPreparedImages.map((uri) => ({ uri }));
        if (videoReferences.length) body.referenceVideos = videoReferences.map((uri) => ({ type: "video", uri }));
      }
      if (audioReferences.length) body.referenceAudio = audioReferences.map((uri) => ({ type: "audio", uri }));
    } else {
      body.promptText = normalizeRunwayPromptText(compiledPrompt);
      body.ratio = ratio;
      body.duration = duration;
      if (promptImage) body.promptImage = promptImage;
    }

    const response = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const json = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      const diagnostic = `endpoint=${endpoint};model=${modelId};ratio=${"ratio" in body ? String(body.ratio) : "input"};image=${promptImage ? "yes" : "no"};videoRefs=${videoReferences.length};audioRefs=${audioReferences.length};agent=${request.idempotencyKey.startsWith("agent:") ? "yes" : "no"}`;
      throw new Error(`RUNWAY_HTTP_${response.status}:${formatRunwayApiError(json).slice(0, 850)} | request: ${diagnostic}`);
    }
    const id = typeof json.id === "string" ? json.id : "";
    if (!id) throw new Error("RUNWAY_INVALID_RESPONSE:MISSING_TASK_ID");
    return { providerTaskId: id, status: "queued" };
  }

  async getStatus(providerTaskId: string): Promise<GenerateVideoResult> {
    if (!this.apiKey) throw new Error("RUNWAY_PROVIDER_UNAVAILABLE:API_KEY_NOT_CONFIGURED");
    const response = await fetch(`${this.baseUrl}/tasks/${encodeURIComponent(providerTaskId)}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(20_000),
    });
    const json = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error(`RUNWAY_HTTP_${response.status}:${formatRunwayApiError(json).slice(0, 1000)}`);
    const raw = String(json.status || "PENDING").toUpperCase();
    const outputs = Array.isArray(json.output) ? json.output : [];
    const status: GenerateVideoResult["status"] = raw === "SUCCEEDED" ? "completed" : raw === "FAILED" || raw === "CANCELED" || raw === "CANCELLED" ? "failed" : raw === "RUNNING" || raw === "IN_PROGRESS" ? "generating" : "queued";
    return {
      providerTaskId,
      status,
      outputUrl: typeof outputs[0] === "string" ? outputs[0] : undefined,
      error: status === "failed" ? errorMessage(json.failure || json.error || json).slice(0, 500) : undefined,
    };
  }

  async cancel(providerTaskId: string) {
    if (!this.apiKey) return false;
    const response = await fetch(`${this.baseUrl}/tasks/${encodeURIComponent(providerTaskId)}`, {
      method: "DELETE",
      headers: this.headers(),
      signal: AbortSignal.timeout(20_000),
    });
    return response.ok || response.status === 404;
  }
}
