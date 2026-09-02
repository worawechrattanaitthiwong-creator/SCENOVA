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
const CHARACTER_REFERENCE_PREFIX = "/api/character-references/";
const RUNWAY_EPHEMERAL_CACHE_MS = 23 * 60 * 60 * 1000;

const runwayEphemeralCache = new Map<string, { uri: string; expiresAt: number }>();

export function normalizeRunwayPromptText(value: string) {
  return value.trim().slice(0, RUNWAY_PROMPT_MAX_CHARS);
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
    return uploadRunwayEphemeralImage({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      sourceKey: `${file.owner}:${file.id}`,
      id: file.id,
      mime: file.mime,
      data: file.data,
    });
  }

  getModelDefinition(): ModelDefinition {
    return {
      id: "runway-gen4.5",
      name: "Runway Gen-4.5",
      provider: "Runway",
      descriptionTh: "Gen-4.5 รองรับ Text-to-Video และ Image-to-Video ผ่าน Runway Developer API",
      bestFor: ["cinematic video", "text-to-video", "image-to-video", "fast production shots"],
      maxSecondsPerGeneration: 10,
      resolutions: ["720p"],
      supportsAudio: false,
      supportsImageReference: true,
      supportsVideoReference: false,
      supportsMultiShot: false,
      priceLevel: 3,
      enabled: this.isConfigured(),
    };
  }

  async estimateCost(request: GenerateVideoRequest) {
    const seconds = clampInt(request.renderSegment.duration, 2, 10);
    const thbPerSecond = Number(process.env.RUNWAY_SYSTEM_THB_PER_SECOND || 12);
    return byokAwareEstimate(this.billingMode, seconds * (Number.isFinite(thbPerSecond) ? thbPerSecond : 12));
  }

  async generate(request: GenerateVideoRequest): Promise<GenerateVideoResult> {
    await assertEmergencyCapability("generation", this.id);
    await enforceEmergencyRateLimit(`video:project:${request.projectId}`, Number(process.env.EMERGENCY_VIDEO_CALLS_PER_MINUTE || 2));
    if (!this.apiKey) throw new Error("RUNWAY_PROVIDER_UNAVAILABLE:API_KEY_NOT_CONFIGURED");

    const duration = clampInt(request.renderSegment.duration, 2, 10);
    const modelId = resolveVideoApiModelId("Runway", request.modelVersionId) || this.modelId;
    if (modelId === "gen4_turbo" && !request.imageReferences[0]) throw new Error("RUNWAY_GEN4_TURBO_REQUIRES_IMAGE_REFERENCE");
    const promptImage = await this.preparePromptImage(request.imageReferences[0]);
    const body: Record<string, unknown> = {
      model: modelId,
      promptText: normalizeRunwayPromptText(buildCompiledVideoPrompt(request)),
      ratio: runwayRatio(request.aspectRatio),
      duration,
    };
    if (promptImage) body.promptImage = promptImage;

    const response = await fetch(`${this.baseUrl}/image_to_video`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const json = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error(`RUNWAY_HTTP_${response.status}:${formatRunwayApiError(json).slice(0, 1000)}`);
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
