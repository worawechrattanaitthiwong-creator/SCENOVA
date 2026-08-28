import type { ApiConnectionKind } from "@/lib/api-connections/store";
import { getApiRouteStage } from "@/lib/api-connections/routing";

export type ProviderDefinition = {
  id: string;
  label: string;
  kind: ApiConnectionKind;
  defaultBaseUrl: string;
  defaultModelId?: string;
  systemKeyEnv?: string;
  ready: boolean;
  purposeTh: string;
  capabilityTh: string;
};

export type PublicProviderDefinition = Omit<ProviderDefinition, "systemKeyEnv"> & {
  stageId: string;
  stageLabelTh: string;
  status: "READY" | "ADAPTER_PENDING";
  systemConfigured: boolean;
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
    purposeTh: "สมองวิเคราะห์คำสั่งหลัก",
    capabilityTh: "วิเคราะห์ Prompt, Locks, กล้อง, ฉาก, ตัวละคร และคืน Structured JSON",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "ANALYZER",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    systemKeyEnv: "OPENROUTER_API_KEY",
    ready: false,
    purposeTh: "Analyzer สำรองหลายโมเดล",
    capabilityTh: "เตรียมไว้เป็น Fallback Analyzer หลัง adapter กลางรองรับครบ",
  },
  {
    id: "gemini",
    label: "Gemini",
    kind: "ANALYZER",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    systemKeyEnv: "GEMINI_API_KEY",
    ready: false,
    purposeTh: "Analyzer สำรอง / Multimodal",
    capabilityTh: "เตรียมไว้สำหรับวิเคราะห์ข้อความและ Reference แบบ Multimodal",
  },
  {
    id: "openai-image",
    label: "OpenAI Image",
    kind: "IMAGE",
    defaultBaseUrl: "https://api.openai.com/v1",
    systemKeyEnv: "OPENAI_API_KEY",
    ready: false,
    purposeTh: "ภาพ Preview / Reference",
    capabilityTh: "สล็อตสำหรับสร้างภาพอ้างอิงก่อนส่งต่อเข้า Video Generator",
  },
  {
    id: "gemini-image",
    label: "Gemini Image",
    kind: "IMAGE",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    systemKeyEnv: "GEMINI_API_KEY",
    ready: false,
    purposeTh: "ภาพ Preview / Reference สำรอง",
    capabilityTh: "สล็อตภาพอ้างอิงและ Image-to-Video preparation",
  },
  {
    id: "seedance",
    label: "Seedance",
    kind: "VIDEO",
    defaultBaseUrl: process.env.SEEDANCE_API_BASE_URL || "https://operator.las.ap-southeast-1.bytepluses.com/api/v1",
    systemKeyEnv: "SEEDANCE_API_KEY",
    ready: false,
    purposeTh: "Video Generator หลัก",
    capabilityTh: "สล็อตสร้างคลิปจริงจาก Prompt Compiler และ Reference",
  },
  {
    id: "kling",
    label: "Kling",
    kind: "VIDEO",
    defaultBaseUrl: "",
    systemKeyEnv: "KLING_API_KEY",
    ready: false,
    purposeTh: "Video Generator สำรอง",
    capabilityTh: "สล็อตสร้างคลิปและ Image-to-Video",
  },
  {
    id: "veo",
    label: "Veo",
    kind: "VIDEO",
    defaultBaseUrl: "",
    systemKeyEnv: "VEO_API_KEY",
    ready: false,
    purposeTh: "Video Generator คุณภาพสูง",
    capabilityTh: "สล็อตสร้างคลิปตาม Prompt/Reference เมื่อ adapter พร้อม",
  },
  {
    id: "runway",
    label: "Runway",
    kind: "VIDEO",
    defaultBaseUrl: "",
    systemKeyEnv: "RUNWAY_API_KEY",
    ready: false,
    purposeTh: "Video Generator ทางเลือก",
    capabilityTh: "สล็อตสร้างคลิปสำหรับ Workflow ที่เลือก Runway",
  },
  {
    id: "wan",
    label: "Wan",
    kind: "VIDEO",
    defaultBaseUrl: "",
    systemKeyEnv: "WAN_API_KEY",
    ready: false,
    purposeTh: "Video Generator ทางเลือก",
    capabilityTh: "สล็อตสร้างคลิปสำหรับ Workflow ที่เลือก Wan",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    kind: "VOICE",
    defaultBaseUrl: "https://api.elevenlabs.io/v1",
    systemKeyEnv: "ELEVENLABS_API_KEY",
    ready: false,
    purposeTh: "Voice / TTS",
    capabilityTh: "สล็อตสร้างเสียงพูดตาม Voice Lock และ Dialogue",
  },
  {
    id: "openai-voice",
    label: "OpenAI Audio",
    kind: "VOICE",
    defaultBaseUrl: "https://api.openai.com/v1",
    systemKeyEnv: "OPENAI_API_KEY",
    ready: false,
    purposeTh: "Voice / TTS สำรอง",
    capabilityTh: "สล็อตเสียงพูดและงาน Audio ที่ระบบรองรับในอนาคต",
  },
];

export function getProviderDefinition(providerId: string, kind?: ApiConnectionKind) {
  const id = providerId.trim().toLowerCase();
  return API_PROVIDER_DEFINITIONS.find((item) => item.id === id && (!kind || item.kind === kind)) || null;
}

export function getPublicProviderCatalog(): PublicProviderDefinition[] {
  return API_PROVIDER_DEFINITIONS.map(({ systemKeyEnv, ...definition }) => {
    const stage = getApiRouteStage(definition.kind);
    return {
      ...definition,
      stageId: stage?.id || "?",
      stageLabelTh: stage?.labelTh || definition.kind,
      status: definition.ready ? "READY" : "ADAPTER_PENDING",
      systemConfigured: Boolean(systemKeyEnv && process.env[systemKeyEnv]?.trim()),
    };
  });
}

export async function testProviderConnection(input: {
  provider: string;
  kind: ApiConnectionKind;
  apiKey: string;
  baseUrl?: string | null;
}) {
  const definition = getProviderDefinition(input.provider, input.kind);
  if (!definition) return { ok: false as const, code: "UNSUPPORTED_PROVIDER", message: "Provider นี้ยังไม่รองรับ" };
  if (!definition.ready) return { ok: false as const, code: "PROVIDER_NOT_READY", message: `${definition.label} adapter ยังไม่เปิดใช้งานจริง จึงยังไม่รับ API Key` };

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
