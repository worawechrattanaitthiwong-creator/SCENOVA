import type { ApiConnectionKind } from "@/lib/api-connections/store";

export type ProviderDefinition = {
  id: string;
  label: string;
  kind: ApiConnectionKind;
  defaultBaseUrl: string;
  defaultModelId?: string;
  systemKeyEnv?: string;
  ready: boolean;
};

export const API_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: "groq",
    label: "Groq",
    kind: "ANALYZER",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultModelId: "openai/gpt-oss-20b",
    systemKeyEnv: "GROQ_API_KEY",
    ready: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "ANALYZER",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    systemKeyEnv: "OPENROUTER_API_KEY",
    ready: false,
  },
  {
    id: "gemini",
    label: "Gemini",
    kind: "ANALYZER",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    systemKeyEnv: "GEMINI_API_KEY",
    ready: false,
  },
  {
    id: "seedance",
    label: "Seedance",
    kind: "VIDEO",
    defaultBaseUrl: process.env.SEEDANCE_API_BASE_URL || "https://operator.las.ap-southeast-1.bytepluses.com/api/v1",
    systemKeyEnv: "SEEDANCE_API_KEY",
    ready: false,
  },
  { id: "kling", label: "Kling", kind: "VIDEO", defaultBaseUrl: "", systemKeyEnv: "KLING_API_KEY", ready: false },
  { id: "veo", label: "Veo", kind: "VIDEO", defaultBaseUrl: "", systemKeyEnv: "VEO_API_KEY", ready: false },
];

export function getProviderDefinition(providerId: string, kind?: ApiConnectionKind) {
  const id = providerId.trim().toLowerCase();
  return API_PROVIDER_DEFINITIONS.find((item) => item.id === id && (!kind || item.kind === kind)) || null;
}

export async function testProviderConnection(input: {
  provider: string;
  kind: ApiConnectionKind;
  apiKey: string;
  baseUrl?: string | null;
}) {
  const definition = getProviderDefinition(input.provider, input.kind);
  if (!definition) return { ok: false as const, code: "UNSUPPORTED_PROVIDER", message: "Provider นี้ยังไม่รองรับ" };
  if (!definition.ready) return { ok: false as const, code: "PROVIDER_NOT_READY", message: `${definition.label} adapter ยังไม่เปิดใช้งาน` };

  if (definition.id === "groq") {
    const baseUrl = (input.baseUrl?.trim() || definition.defaultBaseUrl).replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${input.apiKey.trim()}` },
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);

    if (!response) return { ok: false as const, code: "PROVIDER_UNREACHABLE", message: "เชื่อมต่อ Groq ไม่สำเร็จ" };
    if (response.status === 401 || response.status === 403) return { ok: false as const, code: "INVALID_API_KEY", message: "API Key ไม่ถูกต้องหรือไม่มีสิทธิ์" };
    if (response.status === 429) return { ok: false as const, code: "RATE_LIMITED", message: "Groq จำกัดการเรียกชั่วคราว กรุณาลองอีกครั้ง" };
    if (!response.ok) return { ok: false as const, code: `PROVIDER_HTTP_${response.status}`, message: "Groq ตอบกลับผิดปกติ" };
    return { ok: true as const, baseUrl, modelId: definition.defaultModelId || null };
  }

  return { ok: false as const, code: "PROVIDER_NOT_READY", message: "Provider adapter ยังไม่เปิดใช้งาน" };
}

export function getSystemProviderCredential(providerId: string, kind: ApiConnectionKind) {
  const definition = getProviderDefinition(providerId, kind);
  if (!definition?.systemKeyEnv) return null;
  const apiKey = process.env[definition.systemKeyEnv]?.trim();
  if (!apiKey) return null;
  return {
    provider: definition.id,
    apiKey,
    baseUrl: definition.defaultBaseUrl,
    modelId: definition.defaultModelId || null,
  };
}
