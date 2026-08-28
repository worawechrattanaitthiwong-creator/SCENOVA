import { getProviderDefinition, getSystemProviderCredential } from "@/lib/api-connections/providers";
import { getDefaultUserApiConnectionSecret, getUserApiConnectionSecret, markApiConnectionStatus } from "@/lib/api-connections/store";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";

export type VoiceProviderId = "elevenlabs" | "openai-voice";
export type VoiceBillingMode = "AUTO" | "BYOK" | "SYSTEM";

export type GeneratedSpeech = {
  provider: VoiceProviderId;
  modelId: string;
  billingMode: "BYOK" | "SYSTEM";
  mimeType: string;
  bytes: Buffer;
  voiceId: string;
};

type ResolvedVoiceCredential = {
  provider: VoiceProviderId;
  apiKey: string;
  baseUrl: string;
  modelId: string;
  billingMode: "BYOK" | "SYSTEM";
  connectionId: string | null;
};

function asVoiceProvider(value: string): VoiceProviderId | null {
  const id = value.trim().toLowerCase();
  return id === "elevenlabs" || id === "openai-voice" ? id : null;
}

async function resolveCredential(userId: string, mode: VoiceBillingMode, preferred?: string | null): Promise<ResolvedVoiceCredential> {
  if (mode !== "SYSTEM") {
    const preferredProvider = preferred ? asVoiceProvider(preferred) : null;
    const byok = preferredProvider
      ? await getUserApiConnectionSecret({ userId, provider: preferredProvider, kind: "VOICE" })
      : await getDefaultUserApiConnectionSecret(userId, "VOICE");
    if (byok?.connection.status === "CONNECTED") {
      const provider = asVoiceProvider(byok.connection.provider);
      const definition = provider ? getProviderDefinition(provider, "VOICE") : null;
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
    if (mode === "BYOK") throw new Error("BYOK_VOICE_CONNECTION_REQUIRED");
  }

  const order: VoiceProviderId[] = preferred && asVoiceProvider(preferred)
    ? [asVoiceProvider(preferred)!, "openai-voice", "elevenlabs"]
    : ["openai-voice", "elevenlabs"];
  for (const provider of Array.from(new Set(order))) {
    const definition = getProviderDefinition(provider, "VOICE");
    if (!definition?.ready) continue;
    const system = getSystemProviderCredential(provider, "VOICE");
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
  throw new Error("VOICE_PROVIDER_CONNECTION_REQUIRED");
}

async function generateOpenAi(input: {
  credential: ResolvedVoiceCredential;
  text: string;
  voice?: string;
  instructions?: string;
  speed?: number;
}): Promise<GeneratedSpeech> {
  const voice = input.voice?.trim() || "alloy";
  const response = await fetch(`${input.credential.baseUrl.replace(/\/$/, "")}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.credential.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.credential.modelId,
      input: input.text,
      voice,
      response_format: "mp3",
      ...(input.instructions?.trim() ? { instructions: input.instructions.trim().slice(0, 2000) } : {}),
      ...(typeof input.speed === "number" ? { speed: Math.max(0.25, Math.min(4, input.speed)) } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw Object.assign(new Error(`OPENAI_VOICE_HTTP_${response.status}:${detail.slice(0, 400)}`), { status: response.status });
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("OPENAI_VOICE_EMPTY_OUTPUT");
  return {
    provider: "openai-voice",
    modelId: input.credential.modelId,
    billingMode: input.credential.billingMode,
    mimeType: response.headers.get("content-type") || "audio/mpeg",
    bytes,
    voiceId: voice,
  };
}

async function generateElevenLabs(input: {
  credential: ResolvedVoiceCredential;
  text: string;
  voice?: string;
}): Promise<GeneratedSpeech> {
  const voiceId = input.voice?.trim();
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID_REQUIRED");
  const url = `${input.credential.baseUrl.replace(/\/$/, "")}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": input.credential.apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: input.text, model_id: input.credential.modelId || "eleven_multilingual_v2" }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw Object.assign(new Error(`ELEVENLABS_HTTP_${response.status}:${detail.slice(0, 400)}`), { status: response.status });
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("ELEVENLABS_EMPTY_OUTPUT");
  return {
    provider: "elevenlabs",
    modelId: input.credential.modelId || "eleven_multilingual_v2",
    billingMode: input.credential.billingMode,
    mimeType: response.headers.get("content-type") || "audio/mpeg",
    bytes,
    voiceId,
  };
}

export async function generateSpeechForUser(input: {
  userId: string;
  text: string;
  voice?: string;
  instructions?: string;
  speed?: number;
  billingMode?: VoiceBillingMode;
  preferredProvider?: string | null;
}) {
  const text = input.text.trim();
  if (!text) throw new Error("VOICE_TEXT_REQUIRED");
  if (text.length > 20_000) throw new Error("VOICE_TEXT_TOO_LONG");

  const credential = await resolveCredential(input.userId, input.billingMode || "AUTO", input.preferredProvider);
  if (credential.provider === "openai-voice" && text.length > 4096) throw new Error("OPENAI_VOICE_TEXT_TOO_LONG");
  await assertEmergencyCapability("generation", credential.provider);
  await enforceEmergencyRateLimit(`voice:${input.userId}`, Number(process.env.EMERGENCY_VOICE_CALLS_PER_MINUTE || 6));

  try {
    const result = credential.provider === "elevenlabs"
      ? await generateElevenLabs({ credential, text, voice: input.voice })
      : await generateOpenAi({ credential, text, voice: input.voice, instructions: input.instructions, speed: input.speed });
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
