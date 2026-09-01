import type { ModelDefinition } from "@/lib/domain";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";
import type { GenerateVideoRequest, GenerateVideoResult, ProviderRuntimeCredential, VideoProvider } from "@/lib/providers/video-provider";
import { resolveVideoApiModelId } from "@/lib/video-model-versions";
import { asRecord, buildCompiledVideoPrompt, byokAwareEstimate, errorMessage, wanSize } from "@/lib/providers/video-provider-utils";

// Legacy Singapore domain remains functional and lets a user connect with only a regional DashScope API key.
// Users on the new workspace-specific domain can paste that URL in API Base URL without changing the adapter.
const DEFAULT_BASE_URL = "https://dashscope-intl.aliyuncs.com/api/v1";
const DEFAULT_MODEL = "wan3.0-video";

function normalizedDuration(seconds: number) {
  return seconds <= 5 ? 5 : 10;
}

export class WanVideoProvider implements VideoProvider {
  id = "wan";
  credentialProviderId = "wan";
  billingMode: "BYOK" | "SYSTEM";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelId: string;

  constructor(credential?: ProviderRuntimeCredential) {
    this.apiKey = credential?.apiKey || process.env.WAN_API_KEY || process.env.DASHSCOPE_API_KEY || "";
    this.baseUrl = (credential?.baseUrl || process.env.WAN_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.modelId = credential?.modelId || process.env.WAN_MODEL_ID || DEFAULT_MODEL;
    this.billingMode = credential?.billingMode || "SYSTEM";
  }

  isConfigured() { return Boolean(this.apiKey); }
  private headers(asyncRequest = false) {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...(asyncRequest ? { "X-DashScope-Async": "enable" } : {}),
    };
  }

  getModelDefinition(): ModelDefinition {
    return {
      id: "wan-video",
      name: "Wan Video",
      provider: "Alibaba Cloud Model Studio",
      descriptionTh: "Wan รองรับ Text-to-Video และ Image-to-Video แบบ asynchronous ผ่าน DashScope/Model Studio",
      bestFor: ["cinematic shots", "text-to-video", "image-to-video", "Asian language prompts"],
      maxSecondsPerGeneration: 10,
      resolutions: ["720p", "1080p"],
      supportsAudio: true,
      supportsImageReference: true,
      supportsVideoReference: true,
      supportsMultiShot: true,
      priceLevel: 2,
      enabled: this.isConfigured(),
    };
  }

  async estimateCost(request: GenerateVideoRequest) {
    const thbPerSecond = Number(process.env.WAN_SYSTEM_THB_PER_SECOND || 8);
    return byokAwareEstimate(this.billingMode, normalizedDuration(request.renderSegment.duration) * (Number.isFinite(thbPerSecond) ? thbPerSecond : 8));
  }

  async generate(request: GenerateVideoRequest): Promise<GenerateVideoResult> {
    await assertEmergencyCapability("generation", this.id);
    await enforceEmergencyRateLimit(`video:project:${request.projectId}`, Number(process.env.EMERGENCY_VIDEO_CALLS_PER_MINUTE || 2));
    if (!this.apiKey) throw new Error("WAN_PROVIDER_UNAVAILABLE:API_KEY_NOT_CONFIGURED");

    const modelId = resolveVideoApiModelId("Wan", request.modelVersionId) || this.modelId;
    const input: Record<string, unknown> = { prompt: buildCompiledVideoPrompt(request).slice(0, 5000) };
    if (request.imageReferences[0]) input.img_url = request.imageReferences[0];
    if (request.videoReferences.length > 0) input.reference_urls = request.videoReferences.slice(0, 3);

    const response = await fetch(`${this.baseUrl}/services/aigc/video-generation/video-synthesis`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({
        model: modelId,
        input,
        parameters: {
          size: wanSize(request.aspectRatio),
          duration: normalizedDuration(request.renderSegment.duration),
          prompt_extend: true,
          audio: request.audioReferences.length > 0 || /2\.6|2\.7|3\.0/.test(modelId),
          watermark: false,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error(`WAN_HTTP_${response.status}:${errorMessage(json).slice(0, 500)}`);
    const output = asRecord(json.output);
    const taskId = typeof output.task_id === "string" ? output.task_id : "";
    if (!taskId) throw new Error(`WAN_INVALID_RESPONSE:${errorMessage(json).slice(0, 500)}`);
    return { providerTaskId: taskId, status: "queued" };
  }

  async getStatus(providerTaskId: string): Promise<GenerateVideoResult> {
    if (!this.apiKey) throw new Error("WAN_PROVIDER_UNAVAILABLE:API_KEY_NOT_CONFIGURED");
    const response = await fetch(`${this.baseUrl}/tasks/${encodeURIComponent(providerTaskId)}`, {
      headers: this.headers(false),
      signal: AbortSignal.timeout(20_000),
    });
    const json = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error(`WAN_HTTP_${response.status}:${errorMessage(json).slice(0, 500)}`);
    const output = asRecord(json.output);
    const raw = String(output.task_status || "PENDING").toUpperCase();
    const status: GenerateVideoResult["status"] = raw === "SUCCEEDED" ? "completed" : ["FAILED", "CANCELED", "CANCELLED", "UNKNOWN"].includes(raw) ? "failed" : ["RUNNING", "PRE-PROCESSING", "POST-PROCESSING"].includes(raw) ? "generating" : "queued";
    return {
      providerTaskId,
      status,
      outputUrl: typeof output.video_url === "string" ? output.video_url : undefined,
      error: status === "failed" ? errorMessage(output.message || output.code || json).slice(0, 500) : undefined,
      usage: {
        durationSec: Number(asRecord(json.usage).duration || asRecord(json.usage).video_duration || 0) || undefined,
        resolution: typeof asRecord(json.usage).size === "string" ? String(asRecord(json.usage).size) : undefined,
      },
    };
  }

  async cancel(providerTaskId: string) {
    if (!this.apiKey) return false;
    const response = await fetch(`${this.baseUrl}/tasks/${encodeURIComponent(providerTaskId)}`, {
      method: "DELETE",
      headers: this.headers(false),
      signal: AbortSignal.timeout(20_000),
    });
    return response.ok || response.status === 404 || response.status === 405;
  }
}
