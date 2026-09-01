import type { ModelDefinition } from "@/lib/domain";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";
import type { GenerateVideoRequest, GenerateVideoResult, ProviderRuntimeCredential, VideoProvider } from "@/lib/providers/video-provider";
import { resolveVideoApiModelId } from "@/lib/video-model-versions";
import { asRecord, buildCompiledVideoPrompt, byokAwareEstimate, errorMessage, ratioToLandscapePortrait } from "@/lib/providers/video-provider-utils";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "veo-3.1-generate-preview";

function proxiedVeoUrl(url: string, connectionId?: string | null) {
  const params = new URLSearchParams({ provider: "veo", url });
  if (connectionId) params.set("connectionId", connectionId);
  return `/api/provider-media?${params.toString()}`;
}

export class VeoVideoProvider implements VideoProvider {
  id = "veo";
  credentialProviderId = "veo";
  billingMode: "BYOK" | "SYSTEM";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly modelId: string;
  private readonly connectionId: string | null;

  constructor(credential?: ProviderRuntimeCredential) {
    this.apiKey = credential?.apiKey || process.env.VEO_API_KEY || process.env.GEMINI_API_KEY || "";
    this.baseUrl = (credential?.baseUrl || process.env.VEO_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.modelId = credential?.modelId || process.env.VEO_MODEL_ID || DEFAULT_MODEL;
    this.billingMode = credential?.billingMode || "SYSTEM";
    this.connectionId = credential?.connectionId || null;
  }

  isConfigured() { return Boolean(this.apiKey); }
  private headers() { return { "x-goog-api-key": this.apiKey, "Content-Type": "application/json" }; }

  getModelDefinition(): ModelDefinition {
    return {
      id: "veo-3.1",
      name: "Google Veo 3.1",
      provider: "Google Gemini API",
      descriptionTh: "Veo 3.1 สร้างวิดีโอ 8 วินาทีพร้อมเสียง รองรับแนวนอน/แนวตั้งและภาพอ้างอิง",
      bestFor: ["cinematic realism", "native audio", "portrait video", "reference-guided video"],
      maxSecondsPerGeneration: 8,
      resolutions: ["720p", "1080p"],
      supportsAudio: true,
      supportsImageReference: true,
      supportsVideoReference: true,
      supportsMultiShot: false,
      priceLevel: 3,
      enabled: this.isConfigured(),
    };
  }

  async estimateCost() {
    const systemThb = Number(process.env.VEO_SYSTEM_THB_PER_CLIP || 180);
    return byokAwareEstimate(this.billingMode, Number.isFinite(systemThb) ? systemThb : 180);
  }

  async generate(request: GenerateVideoRequest): Promise<GenerateVideoResult> {
    await assertEmergencyCapability("generation", this.id);
    await enforceEmergencyRateLimit(`video:project:${request.projectId}`, Number(process.env.EMERGENCY_VIDEO_CALLS_PER_MINUTE || 2));
    if (!this.apiKey) throw new Error("VEO_PROVIDER_UNAVAILABLE:API_KEY_NOT_CONFIGURED");

    const modelId = resolveVideoApiModelId("Veo", request.modelVersionId) || this.modelId;
    // buildCompiledVideoPrompt already embeds SCENOVA's negative/avoid guidance in the
    // text prompt. Do not also send Gemini's optional negativePrompt parameter here:
    // some Veo model variants reject that field with HTTP 400.
    const instances: Array<Record<string, unknown>> = [{ prompt: buildCompiledVideoPrompt(request).slice(0, 8000) }];
    const parameters: Record<string, unknown> = {
      numberOfVideos: 1,
      aspectRatio: ratioToLandscapePortrait(request.aspectRatio),
      resolution: request.resolution === "1080p" ? "1080p" : "720p",
    };

    const response = await fetch(`${this.baseUrl}/models/${encodeURIComponent(modelId)}:predictLongRunning`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ instances, parameters }),
      signal: AbortSignal.timeout(30_000),
    });
    const json = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error(`VEO_HTTP_${response.status}:${errorMessage(json).slice(0, 500)}`);
    const name = typeof json.name === "string" ? json.name : "";
    if (!name) throw new Error("VEO_INVALID_RESPONSE:MISSING_OPERATION_NAME");
    return { providerTaskId: name, status: "queued" };
  }

  async getStatus(providerTaskId: string): Promise<GenerateVideoResult> {
    if (!this.apiKey) throw new Error("VEO_PROVIDER_UNAVAILABLE:API_KEY_NOT_CONFIGURED");
    const operationPath = providerTaskId.replace(/^\/+/, "");
    const response = await fetch(`${this.baseUrl}/${operationPath}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(20_000),
    });
    const json = asRecord(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error(`VEO_HTTP_${response.status}:${errorMessage(json).slice(0, 500)}`);
    if (!json.done) return { providerTaskId, status: "generating" };
    if (json.error) return { providerTaskId, status: "failed", error: errorMessage(json.error).slice(0, 500) };

    const responseRecord = asRecord(json.response);
    const generateResponse = asRecord(responseRecord.generateVideoResponse);
    const samples = Array.isArray(generateResponse.generatedSamples) ? generateResponse.generatedSamples : [];
    const sample = asRecord(samples[0]);
    const video = asRecord(sample.video);
    const uri = typeof video.uri === "string" ? video.uri : "";
    if (!uri) return { providerTaskId, status: "failed", error: "VEO_INVALID_RESPONSE:MISSING_VIDEO_URI" };
    return { providerTaskId, status: "completed", outputUrl: proxiedVeoUrl(uri, this.connectionId), usage: { durationSec: 8, resolution: "video" } };
  }

  async cancel() {
    // Gemini long-running video operations do not expose a stable cancel endpoint for all Veo surfaces.
    return false;
  }
}
