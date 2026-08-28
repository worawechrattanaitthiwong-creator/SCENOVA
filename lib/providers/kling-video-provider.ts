import { createHmac } from "crypto";
import type { ModelDefinition } from "@/lib/domain";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";
import type { GenerateVideoRequest, GenerateVideoResult, ProviderRuntimeCredential, VideoProvider } from "@/lib/providers/video-provider";
import { asRecord, buildCompiledVideoPrompt, byokAwareEstimate, clampInt, errorMessage, normalizedAspectRatio } from "@/lib/providers/video-provider-utils";

const DEFAULT_BASE_URL = "https://api-singapore.klingai.com";
const DEFAULT_MODEL = "kling-v3";

type KlingCredentials = { mode: "jwt-pair"; accessKey: string; secretKey: string } | { mode: "token"; token: string };

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export function parseKlingCredentials(raw: string): KlingCredentials {
  const value = raw.trim();
  if (!value) return { mode: "token", token: "" };
  if (value.startsWith("{")) {
    try {
      const json = JSON.parse(value) as Record<string, unknown>;
      const accessKey = String(json.accessKey || json.access_key || "").trim();
      const secretKey = String(json.secretKey || json.secret_key || "").trim();
      if (accessKey && secretKey) return { mode: "jwt-pair", accessKey, secretKey };
    } catch { /* fall through */ }
  }
  const newline = value.split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
  if (newline.length >= 2) return { mode: "jwt-pair", accessKey: newline[0], secretKey: newline[1] };
  const separator = value.indexOf(":");
  if (separator > 0 && !value.startsWith("http")) {
    const accessKey = value.slice(0, separator).trim();
    const secretKey = value.slice(separator + 1).trim();
    if (accessKey && secretKey) return { mode: "jwt-pair", accessKey, secretKey };
  }
  return { mode: "token", token: value };
}

export function createKlingJwt(accessKey: string, secretKey: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iss: accessKey, exp: nowSeconds + 1800, nbf: nowSeconds - 5 }));
  const input = `${header}.${payload}`;
  const signature = createHmac("sha256", secretKey).update(input).digest("base64url");
  return `${input}.${signature}`;
}

export function createKlingAuthorization(raw: string) {
  const credentials = parseKlingCredentials(raw);
  return credentials.mode === "jwt-pair"
    ? createKlingJwt(credentials.accessKey, credentials.secretKey)
    : credentials.token;
}

export class KlingVideoProvider implements VideoProvider {
  id = "kling";
  credentialProviderId = "kling";
  billingMode: "BYOK" | "SYSTEM";
  private readonly credentials: KlingCredentials;
  private readonly baseUrl: string;
  private readonly modelId: string;

  constructor(credential?: ProviderRuntimeCredential) {
    const envPair = process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY
      ? `${process.env.KLING_ACCESS_KEY}:${process.env.KLING_SECRET_KEY}`
      : process.env.KLING_API_KEY || "";
    this.credentials = parseKlingCredentials(credential?.apiKey || envPair);
    this.baseUrl = (credential?.baseUrl || process.env.KLING_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.modelId = credential?.modelId || process.env.KLING_MODEL_ID || DEFAULT_MODEL;
    this.billingMode = credential?.billingMode || "SYSTEM";
  }

  isConfigured() {
    return this.credentials.mode === "jwt-pair" ? Boolean(this.credentials.accessKey && this.credentials.secretKey) : Boolean(this.credentials.token);
  }

  private token() {
    return this.credentials.mode === "jwt-pair"
      ? createKlingJwt(this.credentials.accessKey, this.credentials.secretKey)
      : this.credentials.token;
  }

  private headers() {
    return { Authorization: `Bearer ${this.token()}`, "Content-Type": "application/json" };
  }

  getModelDefinition(): ModelDefinition {
    return {
      id: "kling-v3",
      name: "Kling V3",
      provider: "Kuaishou Kling AI",
      descriptionTh: "Kling V3 รองรับ Text-to-Video และ Image-to-Video พร้อม multi-shot, sound และโหมดคุณภาพหลายระดับ",
      bestFor: ["character motion", "cinematic movement", "image-to-video", "multi-shot video"],
      maxSecondsPerGeneration: 15,
      resolutions: ["720p", "1080p"],
      supportsAudio: true,
      supportsImageReference: true,
      supportsVideoReference: false,
      supportsMultiShot: true,
      priceLevel: 3,
      enabled: this.isConfigured(),
    };
  }

  async estimateCost(request: GenerateVideoRequest) {
    const thbPerSecond = Number(process.env.KLING_SYSTEM_THB_PER_SECOND || 10);
    return byokAwareEstimate(this.billingMode, clampInt(request.renderSegment.duration, 3, 15) * (Number.isFinite(thbPerSecond) ? thbPerSecond : 10));
  }

  async generate(request: GenerateVideoRequest): Promise<GenerateVideoResult> {
    await assertEmergencyCapability("generation", this.id);
    await enforceEmergencyRateLimit(`video:project:${request.projectId}`, Number(process.env.EMERGENCY_VIDEO_CALLS_PER_MINUTE || 2));
    if (!this.isConfigured()) throw new Error("KLING_PROVIDER_UNAVAILABLE:CREDENTIAL_REQUIRED");

    const hasImage = Boolean(request.imageReferences[0]);
    const kind = hasImage ? "image2video" : "text2video";
    const body: Record<string, unknown> = {
      model_name: this.modelId,
      prompt: buildCompiledVideoPrompt(request).slice(0, 2500),
      negative_prompt: request.prompt.negative.slice(0, 2500),
      duration: String(clampInt(request.renderSegment.duration, 3, 15)),
      mode: process.env.KLING_DEFAULT_MODE || "std",
      sound: "on",
      multi_shot: false,
    };
    if (!hasImage) body.aspect_ratio = normalizedAspectRatio(request.aspectRatio) === "4:5" ? "9:16" : normalizedAspectRatio(request.aspectRatio);
    if (hasImage) body.image = request.imageReferences[0];

    const response = await fetch(`${this.baseUrl}/v1/videos/${kind}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const json = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error(`KLING_HTTP_${response.status}:${errorMessage(json).slice(0, 500)}`);
    const data = asRecord(json.data);
    const taskId = typeof data.task_id === "string" ? data.task_id : typeof json.task_id === "string" ? json.task_id : typeof json.id === "string" ? json.id : "";
    if (!taskId) throw new Error(`KLING_INVALID_RESPONSE:${errorMessage(json).slice(0, 500)}`);
    return { providerTaskId: `${kind}:${taskId}`, status: "queued" };
  }

  async getStatus(providerTaskId: string): Promise<GenerateVideoResult> {
    if (!this.isConfigured()) throw new Error("KLING_PROVIDER_UNAVAILABLE:CREDENTIAL_REQUIRED");
    const separator = providerTaskId.indexOf(":");
    const kind = separator > 0 ? providerTaskId.slice(0, separator) : "text2video";
    const taskId = separator > 0 ? providerTaskId.slice(separator + 1) : providerTaskId;
    const response = await fetch(`${this.baseUrl}/v1/videos/${kind}/${encodeURIComponent(taskId)}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(20_000),
    });
    const json = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error(`KLING_HTTP_${response.status}:${errorMessage(json).slice(0, 500)}`);
    const data = asRecord(json.data);
    const raw = String(data.task_status || json.status || "submitted").toLowerCase();
    const result = asRecord(data.task_result);
    const videos = Array.isArray(result.videos) ? result.videos : [];
    const firstVideo = asRecord(videos[0]);
    const status: GenerateVideoResult["status"] = ["succeed", "succeeded", "completed"].includes(raw) ? "completed" : ["failed", "canceled", "cancelled"].includes(raw) ? "failed" : ["processing", "running", "in_progress"].includes(raw) ? "generating" : "queued";
    return {
      providerTaskId,
      status,
      outputUrl: typeof firstVideo.url === "string" ? firstVideo.url : typeof data.video_url === "string" ? data.video_url : undefined,
      error: status === "failed" ? String(data.task_status_msg || data.message || json.message || "Kling task failed").slice(0, 500) : undefined,
      usage: { durationSec: Number(firstVideo.duration || 0) || undefined },
    };
  }

  async cancel(providerTaskId: string) {
    if (!this.isConfigured()) return false;
    const separator = providerTaskId.indexOf(":");
    const kind = separator > 0 ? providerTaskId.slice(0, separator) : "text2video";
    const taskId = separator > 0 ? providerTaskId.slice(separator + 1) : providerTaskId;
    const response = await fetch(`${this.baseUrl}/v1/videos/${kind}/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
      headers: this.headers(),
      signal: AbortSignal.timeout(20_000),
    });
    return response.ok || response.status === 404 || response.status === 405;
  }
}
