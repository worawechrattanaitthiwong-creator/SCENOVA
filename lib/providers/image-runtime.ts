import { getProviderDefinition, getSystemProviderCredential } from "@/lib/api-connections/providers";
import { getDefaultUserApiConnectionSecret, getUserApiConnectionSecret, markApiConnectionStatus } from "@/lib/api-connections/store";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";

export type ImageProviderId = "openai-image" | "gemini-image" | "runway-image";
export type ImageBillingMode = "AUTO" | "BYOK" | "SYSTEM";

export type ImageReference = { data: string; mimeType: string };
export type GeneratedImage = {
  provider: ImageProviderId;
  modelId: string;
  billingMode: "BYOK" | "SYSTEM";
  mimeType: string;
  base64: string;
  revisedPrompt?: string | null;
};

type ResolvedImageCredential = {
  provider: ImageProviderId;
  apiKey: string;
  baseUrl: string;
  modelId: string;
  billingMode: "BYOK" | "SYSTEM";
  connectionId: string | null;
};

const RUNWAY_BASE_URL = "https://api.dev.runwayml.com/v1";
const RUNWAY_IMAGE_MODEL = "gpt_image_2";
const RUNWAY_VERSION = "2024-11-06";

function asImageProvider(value: string): ImageProviderId | null {
  const id = value.trim().toLowerCase();
  return id === "openai-image" || id === "gemini-image" || id === "runway-image" ? id : null;
}

async function sharedRunwayCredential(userId: string): Promise<ResolvedImageCredential | null> {
  const byok = await getUserApiConnectionSecret({ userId, provider: "runway", kind: "VIDEO" });
  if (byok?.connection.status === "CONNECTED") {
    return {
      provider: "runway-image",
      apiKey: byok.apiKey,
      baseUrl: byok.connection.baseUrl || RUNWAY_BASE_URL,
      modelId: RUNWAY_IMAGE_MODEL,
      billingMode: "BYOK",
      // Do not mark the VIDEO connection unhealthy for a model-specific image error.
      connectionId: null,
    };
  }
  return null;
}

async function resolveCredential(userId: string, mode: ImageBillingMode, preferred?: string | null): Promise<ResolvedImageCredential> {
  if (mode !== "SYSTEM") {
    const preferredProvider = preferred ? asImageProvider(preferred) : null;
    if (preferredProvider === "runway-image") {
      const runway = await sharedRunwayCredential(userId);
      if (runway) return runway;
      if (mode === "BYOK") throw new Error("BYOK_RUNWAY_IMAGE_CONNECTION_REQUIRED");
    } else {
      const byok = preferredProvider
        ? await getUserApiConnectionSecret({ userId, provider: preferredProvider, kind: "IMAGE" })
        : await getDefaultUserApiConnectionSecret(userId, "IMAGE");
      if (byok?.connection.status === "CONNECTED") {
        const provider = asImageProvider(byok.connection.provider);
        const definition = provider && provider !== "runway-image" ? getProviderDefinition(provider, "IMAGE") : null;
        if (provider && definition?.ready) {
          return {
            provider,
            apiKey: byok.apiKey,
            baseUrl: byok.connection.baseUrl || definition.defaultBaseUrl,
            modelId: byok.connection.modelId || definition.defaultModelId || "",
            billingMode: "BYOK",
            connectionId: byok.connection.id,
          };
        }
      }

      // A connected Runway VIDEO key is organization-scoped and can call Runway
      // image endpoints too. Reuse it instead of asking the user for another key.
      if (!preferredProvider) {
        const runway = await sharedRunwayCredential(userId);
        if (runway) return runway;
      }
      if (mode === "BYOK") throw new Error("BYOK_IMAGE_CONNECTION_REQUIRED");
    }
  }

  const preferredProvider = preferred ? asImageProvider(preferred) : null;
  if (preferredProvider === "runway-image" || !preferredProvider) {
    const runwayKey = process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET || "";
    if (runwayKey.trim()) {
      return {
        provider: "runway-image",
        apiKey: runwayKey.trim(),
        baseUrl: (process.env.RUNWAY_API_BASE_URL || RUNWAY_BASE_URL).replace(/\/$/, ""),
        modelId: RUNWAY_IMAGE_MODEL,
        billingMode: "SYSTEM",
        connectionId: null,
      };
    }
  }

  const order: Array<Exclude<ImageProviderId, "runway-image">> = preferredProvider && preferredProvider !== "runway-image"
    ? [preferredProvider, "gemini-image", "openai-image"]
    : ["gemini-image", "openai-image"];
  for (const provider of Array.from(new Set(order))) {
    const definition = getProviderDefinition(provider, "IMAGE");
    if (!definition?.ready) continue;
    const system = getSystemProviderCredential(provider, "IMAGE");
    if (!system) continue;
    return {
      provider,
      apiKey: system.apiKey,
      baseUrl: system.baseUrl,
      modelId: system.modelId || definition.defaultModelId || "",
      billingMode: "SYSTEM",
      connectionId: null,
    };
  }
  throw new Error("IMAGE_PROVIDER_CONNECTION_REQUIRED");
}

function openAiSize(aspectRatio?: string) {
  if (aspectRatio === "9:16" || aspectRatio === "3:4" || aspectRatio === "4:5") return "1024x1536";
  if (aspectRatio === "16:9" || aspectRatio === "4:3" || aspectRatio === "21:9") return "1536x1024";
  return "1024x1024";
}

async function generateOpenAi(credential: ResolvedImageCredential, prompt: string, aspectRatio?: string, quality?: string): Promise<GeneratedImage> {
  const response = await fetch(`${credential.baseUrl.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${credential.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: credential.modelId,
      prompt,
      n: 1,
      size: openAiSize(aspectRatio),
      quality: quality === "low" || quality === "high" ? quality : "medium",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const json = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw Object.assign(new Error(`OPENAI_IMAGE_HTTP_${response.status}`), { status: response.status, detail: JSON.stringify(json).slice(0, 500) });
  const data = Array.isArray(json.data) ? json.data : [];
  const first = data[0] && typeof data[0] === "object" ? data[0] as Record<string, unknown> : {};
  const base64 = typeof first.b64_json === "string" ? first.b64_json : "";
  if (base64) return { provider: "openai-image", modelId: credential.modelId, billingMode: credential.billingMode, mimeType: "image/png", base64, revisedPrompt: typeof first.revised_prompt === "string" ? first.revised_prompt : null };
  const url = typeof first.url === "string" ? first.url : "";
  if (!url) throw new Error("OPENAI_IMAGE_EMPTY_OUTPUT");
  const image = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!image.ok) throw new Error(`OPENAI_IMAGE_DOWNLOAD_HTTP_${image.status}`);
  const bytes = Buffer.from(await image.arrayBuffer());
  return { provider: "openai-image", modelId: credential.modelId, billingMode: credential.billingMode, mimeType: image.headers.get("content-type") || "image/png", base64: bytes.toString("base64"), revisedPrompt: typeof first.revised_prompt === "string" ? first.revised_prompt : null };
}

function geminiAspectRatio(value?: string) {
  const allowed = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]);
  return value && allowed.has(value) ? value : "16:9";
}

async function generateGemini(credential: ResolvedImageCredential, prompt: string, aspectRatio?: string, quality?: string, references?: ImageReference[]): Promise<GeneratedImage> {
  const input: Array<Record<string, unknown>> = [];
  for (const reference of (references || []).slice(0, 10)) {
    if (!/^image\//.test(reference.mimeType) || reference.data.length > 25_000_000) continue;
    input.push({ type: "image", mime_type: reference.mimeType, data: reference.data.replace(/^data:[^;]+;base64,/, "") });
  }
  input.push({ type: "text", text: prompt });
  const response = await fetch(`${credential.baseUrl.replace(/\/$/, "")}/interactions`, {
    method: "POST",
    headers: { "x-goog-api-key": credential.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: credential.modelId,
      input,
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: geminiAspectRatio(aspectRatio),
        image_size: quality === "high" ? "2K" : "1K",
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const json = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw Object.assign(new Error(`GEMINI_IMAGE_HTTP_${response.status}`), { status: response.status, detail: JSON.stringify(json).slice(0, 500) });
  const steps = Array.isArray(json.steps) ? json.steps : [];
  for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
    const step = steps[stepIndex] && typeof steps[stepIndex] === "object" ? steps[stepIndex] as Record<string, unknown> : {};
    const content = Array.isArray(step.content) ? step.content : [];
    for (let contentIndex = content.length - 1; contentIndex >= 0; contentIndex -= 1) {
      const item = content[contentIndex] && typeof content[contentIndex] === "object" ? content[contentIndex] as Record<string, unknown> : {};
      if (item.type === "image" && typeof item.data === "string") {
        return {
          provider: "gemini-image",
          modelId: credential.modelId,
          billingMode: credential.billingMode,
          mimeType: typeof item.mime_type === "string" ? item.mime_type : "image/png",
          base64: item.data,
        };
      }
    }
  }
  throw new Error("GEMINI_IMAGE_EMPTY_OUTPUT");
}

function runwayImageRatio(value?: string) {
  if (value === "9:16") return "1088:1920";
  if (value === "3:4" || value === "4:5") return "1440:1920";
  if (value === "4:3" || value === "5:4") return "1920:1440";
  if (value === "21:9") return "2048:880";
  if (value === "1:1") return "1920:1920";
  return "1920:1088";
}

function runwayImageQuality(value?: string) {
  return value === "low" || value === "high" ? value : "medium";
}

function runwayHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Runway-Version": RUNWAY_VERSION,
  };
}

async function generateRunway(credential: ResolvedImageCredential, prompt: string, aspectRatio?: string, quality?: string, references?: ImageReference[]): Promise<GeneratedImage> {
  const referenceImages = (references || []).slice(0, 16).filter((reference) => /^image\//.test(reference.mimeType)).map((reference, index) => ({
    uri: reference.data.startsWith("data:") ? reference.data : `data:${reference.mimeType};base64,${reference.data}`,
    tag: `Ref${String(index + 1).padStart(2, "0")}`,
  }));
  const response = await fetch(`${credential.baseUrl.replace(/\/$/, "")}/text_to_image`, {
    method: "POST",
    headers: runwayHeaders(credential.apiKey),
    body: JSON.stringify({
      model: RUNWAY_IMAGE_MODEL,
      promptText: prompt.slice(0, 32_000),
      ratio: runwayImageRatio(aspectRatio),
      quality: runwayImageQuality(quality),
      outputCount: 1,
      background: "auto",
      ...(referenceImages.length ? { referenceImages } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const json = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw Object.assign(new Error(`RUNWAY_IMAGE_HTTP_${response.status}`), { status: response.status, detail: JSON.stringify(json).slice(0, 800) });
  const taskId = typeof json.id === "string" ? json.id : "";
  if (!taskId) throw new Error("RUNWAY_IMAGE_INVALID_RESPONSE");

  const deadline = Date.now() + 180_000;
  let outputUrl = "";
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const taskResponse = await fetch(`${credential.baseUrl.replace(/\/$/, "")}/tasks/${encodeURIComponent(taskId)}`, {
      headers: runwayHeaders(credential.apiKey),
      signal: AbortSignal.timeout(20_000),
    });
    const task = await taskResponse.json().catch(() => ({})) as Record<string, unknown>;
    if (!taskResponse.ok) throw Object.assign(new Error(`RUNWAY_IMAGE_TASK_HTTP_${taskResponse.status}`), { status: taskResponse.status, detail: JSON.stringify(task).slice(0, 800) });
    const status = String(task.status || "").toUpperCase();
    if (status === "FAILED" || status === "CANCELED" || status === "CANCELLED") throw new Error(`RUNWAY_IMAGE_TASK_FAILED:${JSON.stringify(task.failure || task.error || task).slice(0, 800)}`);
    if (status === "SUCCEEDED") {
      const output = Array.isArray(task.output) ? task.output : [];
      outputUrl = typeof output[0] === "string" ? output[0] : "";
      break;
    }
  }
  if (!outputUrl) throw new Error("RUNWAY_IMAGE_TASK_TIMEOUT_OR_EMPTY_OUTPUT");
  const image = await fetch(outputUrl, { signal: AbortSignal.timeout(60_000) });
  if (!image.ok) throw new Error(`RUNWAY_IMAGE_DOWNLOAD_HTTP_${image.status}`);
  const bytes = Buffer.from(await image.arrayBuffer());
  return {
    provider: "runway-image",
    modelId: RUNWAY_IMAGE_MODEL,
    billingMode: credential.billingMode,
    mimeType: image.headers.get("content-type") || "image/png",
    base64: bytes.toString("base64"),
  };
}

export async function generateImageForUser(input: {
  userId: string;
  prompt: string;
  aspectRatio?: string;
  quality?: "low" | "medium" | "high";
  references?: ImageReference[];
  billingMode?: ImageBillingMode;
  preferredProvider?: string | null;
}) {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("IMAGE_PROMPT_REQUIRED");
  if (prompt.length > 30_000) throw new Error("IMAGE_PROMPT_TOO_LONG");
  const credential = await resolveCredential(input.userId, input.billingMode || "AUTO", input.preferredProvider);
  await assertEmergencyCapability("generation", credential.provider === "runway-image" ? "runway" : credential.provider);
  await enforceEmergencyRateLimit(`image:${input.userId}`, Number(process.env.EMERGENCY_IMAGE_CALLS_PER_MINUTE || 4));
  try {
    const result = credential.provider === "gemini-image"
      ? await generateGemini(credential, prompt, input.aspectRatio, input.quality, input.references)
      : credential.provider === "runway-image"
        ? await generateRunway(credential, prompt, input.aspectRatio, input.quality, input.references)
        : await generateOpenAi(credential, prompt, input.aspectRatio, input.quality);
    if (credential.connectionId) await markApiConnectionStatus({ userId: input.userId, id: credential.connectionId, status: "CONNECTED", error: null }).catch(() => undefined);
    return result;
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status || 0);
    if (credential.connectionId) {
      await markApiConnectionStatus({
        userId: input.userId,
        id: credential.connectionId,
        status: status === 429 ? "RATE_LIMITED" : status === 401 || status === 403 ? "INVALID" : "ERROR",
        error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
      }).catch(() => undefined);
    }
    throw error;
  }
}
