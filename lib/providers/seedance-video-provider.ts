import type { ModelDefinition } from "@/lib/domain";
import type { GenerateVideoRequest, GenerateVideoResult, VideoProvider } from "@/lib/providers/video-provider";

const DEFAULT_BASE_URL = "https://operator.las.ap-southeast-1.bytepluses.com/api/v1";
const DEFAULT_MODEL = "dreamina-seedance-2-5-260628";

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizedResolution(resolution: string) {
  return resolution === "480p" ? "480p" : "720p";
}

function normalizedRatio(value?: string) {
  const ratio = String(value || process.env.SEEDANCE_DEFAULT_RATIO || "16:9");
  return ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"].includes(ratio) ? ratio : "16:9";
}

function buildPrompt(request: GenerateVideoRequest) {
  const shotPrompt = request.prompt.shots.join("\n");
  return [
    request.prompt.master,
    request.prompt.episode,
    shotPrompt,
    request.prompt.negative ? `NEGATIVE / AVOID:\n${request.prompt.negative}` : "",
    `Render only the requested time range ${request.renderSegment.start}-${request.renderSegment.end}s. Preserve all locked identities and continuity constraints.`,
  ].filter(Boolean).join("\n\n");
}

function providerError(body: unknown, status: number) {
  const value = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const message = typeof value.message === "string" ? value.message : typeof value.error === "string" ? value.error : JSON.stringify(value);
  return new Error(`SEEDANCE_HTTP_${status}:${message.slice(0, 500)}`);
}

export class Seedance25VideoProvider implements VideoProvider {
  id = "byteplus-seedance-2.5";
  private readonly apiKey = process.env.SEEDANCE_API_KEY || process.env.BYTEPLUS_LAS_API_KEY || "";
  private readonly baseUrl = (process.env.SEEDANCE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  private readonly modelId = process.env.SEEDANCE_MODEL_ID || DEFAULT_MODEL;

  isConfigured() {
    return Boolean(this.apiKey);
  }

  getModelDefinition(): ModelDefinition {
    return {
      id: "seedance-2.5",
      name: "Dreamina Seedance 2.5",
      provider: "BytePlus LAS",
      descriptionTh: "Seedance 2.5 สำหรับวิดีโอ 4–30 วินาที รองรับ 480p/720p, multimodal references และเสียงพร้อมภาพ",
      bestFor: ["cinematic narrative", "30-second scene", "multimodal continuity", "audio-video generation"],
      maxSecondsPerGeneration: 30,
      resolutions: ["480p", "720p"],
      supportsAudio: true,
      supportsImageReference: true,
      supportsVideoReference: true,
      supportsMultiShot: true,
      priceLevel: 3,
      enabled: this.isConfigured(),
    };
  }

  async estimateCost(request: GenerateVideoRequest) {
    const duration = Math.max(4, Math.min(30, request.renderSegment.duration));
    const resolution = normalizedResolution(request.resolution);
    // BytePlus LAS enhanced Seedance billing: base USD/sec multiplied by a resolution conversion factor.
    // Defaults reflect Seedance 2.5 no-input-video public billing; env values allow pricing changes without a deploy.
    const baseUsdPerSecond = numberEnv("SEEDANCE_BASE_USD_PER_SECOND", 0.303);
    const conversion = resolution === "480p"
      ? numberEnv("SEEDANCE_480P_CONVERSION", 0.6785)
      : numberEnv("SEEDANCE_720P_CONVERSION", 1.525);
    const videoReferenceFactor = request.videoReferences.length > 0 ? numberEnv("SEEDANCE_VIDEO_REFERENCE_COST_FACTOR", 1.8) : 1;
    const usdThb = numberEnv("SCENOVA_USD_THB_RATE", 33);
    const amount = duration * baseUsdPerSecond * conversion * videoReferenceFactor * usdThb;
    return { currency: "THB" as const, estimatedAmount: Number(amount.toFixed(4)) };
  }

  async generate(request: GenerateVideoRequest): Promise<GenerateVideoResult> {
    if (!this.apiKey) throw new Error("SEEDANCE_PROVIDER_UNAVAILABLE:SEEDANCE_API_KEY_NOT_CONFIGURED");
    const duration = Math.round(request.renderSegment.duration);
    if (duration < 4 || duration > 30) throw new Error(`SEEDANCE_DURATION_NOT_SUPPORTED:${duration}`);

    const content: Array<Record<string, unknown>> = [{ type: "text", text: buildPrompt(request) }];
    for (const url of request.imageReferences.slice(0, 30)) content.push({ type: "image_url", image_url: { url }, role: "reference_image" });
    for (const url of request.videoReferences.slice(0, 3)) content.push({ type: "video_url", video_url: { url }, role: "reference_video" });
    for (const url of request.audioReferences.slice(0, 10)) content.push({ type: "audio_url", audio_url: { url }, role: "reference_audio" });

    const response = await fetch(`${this.baseUrl}/contents/generations/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}`, "Idempotency-Key": request.idempotencyKey },
      body: JSON.stringify({
        model: this.modelId,
        content,
        duration,
        resolution: normalizedResolution(request.resolution),
        ratio: normalizedRatio(request.aspectRatio),
        generate_audio: true,
        return_last_frame: true,
        watermark: false,
        execution_expires_after: Math.max(3600, Number(process.env.SEEDANCE_EXECUTION_EXPIRES_SECONDS || 7200)),
      }),
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw providerError(body, response.status);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new Error("SEEDANCE_INVALID_RESPONSE:MISSING_TASK_ID");
    return { providerTaskId: id, status: "queued" };
  }

  async getStatus(providerTaskId: string): Promise<GenerateVideoResult> {
    if (!this.apiKey) throw new Error("SEEDANCE_PROVIDER_UNAVAILABLE:SEEDANCE_API_KEY_NOT_CONFIGURED");
    const response = await fetch(`${this.baseUrl}/contents/generations/tasks/${encodeURIComponent(providerTaskId)}`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw providerError(body, response.status);
    const rawStatus = String(body.status || "queued");
    const content = body.content && typeof body.content === "object" ? body.content as Record<string, unknown> : {};
    const error = body.error && typeof body.error === "object" ? JSON.stringify(body.error) : typeof body.error === "string" ? body.error : undefined;
    const status: GenerateVideoResult["status"] = rawStatus === "succeeded" ? "completed" : rawStatus === "failed" || rawStatus === "expired" || rawStatus === "cancelled" ? "failed" : rawStatus === "running" ? "generating" : "queued";
    return {
      providerTaskId,
      status,
      outputUrl: typeof content.video_url === "string" ? content.video_url : undefined,
      lastFrameUrl: typeof content.last_frame_url === "string" ? content.last_frame_url : typeof content.last_frame_image_url === "string" ? content.last_frame_image_url : undefined,
      error,
    };
  }

  async cancel(providerTaskId: string) {
    if (!this.apiKey) return false;
    const response = await fetch(`${this.baseUrl}/contents/generations/tasks/${encodeURIComponent(providerTaskId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
    });
    return response.ok;
  }
}
