import type { ModelDefinition } from "@/lib/domain";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";
import type { GenerateVideoRequest, GenerateVideoResult, ProviderRuntimeCredential, VideoProvider } from "@/lib/providers/video-provider";
import { resolveVideoApiModelId } from "@/lib/video-model-versions";
import { asRecord, buildCompiledVideoPrompt, byokAwareEstimate, clampInt, errorMessage, runwayRatio } from "@/lib/providers/video-provider-utils";

const DEFAULT_BASE_URL = "https://api.dev.runwayml.com/v1";
const DEFAULT_MODEL = "gen4.5";
const RUNWAY_VERSION = "2024-11-06";

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
    const body: Record<string, unknown> = {
      model: modelId,
      promptText: buildCompiledVideoPrompt(request).slice(0, 4000),
      ratio: runwayRatio(request.aspectRatio),
      duration,
    };
    if (request.imageReferences[0]) body.promptImage = request.imageReferences[0];

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
