import type { ApiConnectionKind } from "@/lib/api-connections/store";
import { getApiRouteStage } from "@/lib/api-connections/routing";
import { createKlingAuthorization } from "@/lib/providers/kling-video-provider";

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
  credentialHintTh?: string;
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
    defaultModelId: "openai/gpt-oss-20b",
    systemKeyEnv: "OPENROUTER_API_KEY",
    ready: false,
    purposeTh: "Analyzer สำรองหลายโมเดล",
    capabilityTh: "Analyzer สำรองผ่าน OpenAI-compatible API; จะเปิดเมื่อ runtime dispatcher พร้อม",
  },
  {
    id: "gemini",
    label: "Gemini",
    kind: "ANALYZER",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModelId: "gemini-2.5-flash",
    systemKeyEnv: "GEMINI_API_KEY",
    ready: false,
    purposeTh: "Analyzer สำรอง / Multimodal",
    capabilityTh: "Analyzer สำหรับข้อความและ Reference แบบ Multimodal; จะเปิดเมื่อ runtime dispatcher พร้อม",
  },
  {
    id: "openai-image",
    label: "OpenAI Image",
    kind: "IMAGE",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModelId: "gpt-image-1",
    systemKeyEnv: "OPENAI_API_KEY",
    ready: false,
    purposeTh: "ภาพ Preview / Reference",
    capabilityTh: "สร้างภาพอ้างอิงก่อนส่งต่อเข้า Video Generator; จะเปิดเมื่อ Image runtime พร้อม",
  },
  {
    id: "gemini-image",
    label: "Gemini Image",
    kind: "IMAGE",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModelId: "gemini-2.5-flash-image",
    systemKeyEnv: "GEMINI_API_KEY",
    ready: false,
    purposeTh: "ภาพ Preview / Reference สำรอง",
    capabilityTh: "สร้างภาพอ้างอิงและเตรียม Image-to-Video; จะเปิดเมื่อ Image runtime พร้อม",
  },
  {
    id: "seedance",
    label: "Seedance",
    kind: "VIDEO",
    defaultBaseUrl: process.env.SEEDANCE_API_BASE_URL || "https://operator.las.ap-southeast-1.bytepluses.com/api/v1",
    defaultModelId: "dreamina-seedance-2-5-260628",
    systemKeyEnv: "SEEDANCE_API_KEY",
    ready: true,
    purposeTh: "Video Generator หลัก",
    capabilityTh: "สร้างคลิปจริงจาก Production Prompt พร้อม Image/Video/Audio Reference และ Poll สถานะจนเสร็จ",
    credentialHintTh: "ใส่ BytePlus/Seedance API Key แล้วกดทดสอบ ระบบจะใช้ Key นี้กับงานวิดีโอของบัญชีคุณโดยตรง",
  },
  {
    id: "kling",
    label: "Kling",
    kind: "VIDEO",
    defaultBaseUrl: "https://api-singapore.klingai.com",
    defaultModelId: "kling-v3",
    systemKeyEnv: "KLING_API_KEY",
    ready: true,
    purposeTh: "Video Generator สำหรับ Motion / Character",
    capabilityTh: "สร้าง Text-to-Video และ Image-to-Video จริง พร้อม Poll งานและรองรับ Kling JWT",
    credentialHintTh: "Kling ใช้ AccessKey + SecretKey: วางเป็น AccessKey:SecretKey หรือวาง 2 บรรทัดในช่อง Credential ระบบจะสร้าง JWT ให้เองอัตโนมัติ",
  },
  {
    id: "veo",
    label: "Veo",
    kind: "VIDEO",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModelId: "veo-3.1-generate-preview",
    systemKeyEnv: "VEO_API_KEY",
    ready: true,
    purposeTh: "Video Generator คุณภาพสูง",
    capabilityTh: "สร้าง Veo แบบ Long-running operation, Poll จนเสร็จ และ Proxy media ฝั่ง Server โดยไม่เปิดเผย Key",
    credentialHintTh: "ใส่ Gemini API Key ที่มีสิทธิ์ใช้ Veo ระบบจะทดสอบสิทธิ์ก่อนบันทึกและใช้ Key ฝั่ง Server เท่านั้น",
  },
  {
    id: "runway",
    label: "Runway",
    kind: "VIDEO",
    defaultBaseUrl: "https://api.dev.runwayml.com/v1",
    defaultModelId: "gen4.5",
    systemKeyEnv: "RUNWAY_API_KEY",
    ready: true,
    purposeTh: "Video Generator ทางเลือก",
    capabilityTh: "สร้าง Gen-4.5 Text/Image-to-Video จริงและ Poll task จาก Runway Developer API",
    credentialHintTh: "ใส่ Runway Developer API Key; SCENOVA จะส่ง X-Runway-Version และ Bearer token ให้อัตโนมัติ",
  },
  {
    id: "wan",
    label: "Wan",
    kind: "VIDEO",
    defaultBaseUrl: "https://dashscope-intl.aliyuncs.com/api/v1",
    defaultModelId: "wan2.6-t2v",
    systemKeyEnv: "WAN_API_KEY",
    ready: true,
    purposeTh: "Video Generator ทางเลือก",
    capabilityTh: "สร้าง Wan Text/Image-to-Video แบบ asynchronous และ Poll task ผ่าน Alibaba Model Studio / DashScope",
    credentialHintTh: "ใส่ DashScope/Model Studio API Key; ถ้าบัญชีใช้ Workspace URL ใหม่ สามารถเปลี่ยน API Base URL ให้ตรง Region/Workspace ได้",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    kind: "VOICE",
    defaultBaseUrl: "https://api.elevenlabs.io/v1",
    systemKeyEnv: "ELEVENLABS_API_KEY",
    ready: false,
    purposeTh: "Voice / TTS",
    capabilityTh: "สร้างเสียงพูดตาม Voice Lock และ Dialogue; จะเปิดเมื่อ Voice runtime พร้อม",
  },
  {
    id: "openai-voice",
    label: "OpenAI Audio",
    kind: "VOICE",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModelId: "gpt-4o-mini-tts",
    systemKeyEnv: "OPENAI_API_KEY",
    ready: false,
    purposeTh: "Voice / TTS สำรอง",
    capabilityTh: "สร้างเสียงพูดผ่าน OpenAI Audio API; จะเปิดเมื่อ Voice runtime พร้อม",
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

function classifyProbe(response: Response | null, providerLabel: string) {
  if (!response) return { ok: false as const, code: "PROVIDER_UNREACHABLE", message: `เชื่อมต่อ ${providerLabel} ไม่สำเร็จ` };
  if (response.status === 401 || response.status === 403) return { ok: false as const, code: "INVALID_API_KEY", message: "Credential ไม่ถูกต้องหรือไม่มีสิทธิ์" };
  if (response.status === 429) return { ok: false as const, code: "RATE_LIMITED", message: `${providerLabel} จำกัดการเรียกชั่วคราว กรุณาลองอีกครั้ง` };
  // Credential probes intentionally use harmless reads / nonexistent task IDs. 400/404 can therefore mean auth passed.
  if (response.ok || response.status === 400 || response.status === 404 || response.status === 405) return { ok: true as const };
  return { ok: false as const, code: `PROVIDER_HTTP_${response.status}`, message: `${providerLabel} ตอบกลับผิดปกติ (HTTP ${response.status})` };
}

async function probeBearer(baseUrl: string, path: string, apiKey: string, extraHeaders?: Record<string, string>) {
  return fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey.trim()}`, ...(extraHeaders || {}) },
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);
}

export async function testProviderConnection(input: {
  provider: string;
  kind: ApiConnectionKind;
  apiKey: string;
  baseUrl?: string | null;
}) {
  const definition = getProviderDefinition(input.provider, input.kind);
  if (!definition) return { ok: false as const, code: "UNSUPPORTED_PROVIDER", message: "Provider นี้ยังไม่รองรับ" };
  if (!definition.ready) return { ok: false as const, code: "PROVIDER_NOT_READY", message: `${definition.label} adapter ยังไม่เปิดใช้งานจริง จึงยังไม่รับ Credential` };

  const baseUrl = (input.baseUrl?.trim() || definition.defaultBaseUrl).replace(/\/$/, "");
  let response: Response | null = null;

  if (definition.id === "groq") {
    response = await probeBearer(baseUrl, "/models", input.apiKey);
  } else if (definition.id === "seedance") {
    response = await probeBearer(baseUrl, "/contents/generations/tasks/scenova-credential-check", input.apiKey, { "Content-Type": "application/json" });
  } else if (definition.id === "kling") {
    const token = createKlingAuthorization(input.apiKey);
    if (!token) return { ok: false as const, code: "INVALID_API_KEY", message: "กรุณาใส่ Kling AccessKey:SecretKey หรือ Bearer/JWT token" };
    response = await probeBearer(baseUrl, "/v1/videos/text2video?pageNum=1&pageSize=1", token, { "Content-Type": "application/json" });
  } else if (definition.id === "veo") {
    response = await fetch(`${baseUrl}/models?pageSize=1`, {
      headers: { "x-goog-api-key": input.apiKey.trim() },
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);
  } else if (definition.id === "runway") {
    response = await probeBearer(baseUrl, "/tasks/00000000-0000-4000-8000-000000000000", input.apiKey, {
      "X-Runway-Version": "2024-11-06",
      "Content-Type": "application/json",
    });
  } else if (definition.id === "wan") {
    response = await probeBearer(baseUrl, "/tasks/scenova-credential-check", input.apiKey, { "Content-Type": "application/json" });
  }

  const result = classifyProbe(response, definition.label);
  if (!result.ok) return result;
  return { ok: true as const, baseUrl, modelId: definition.defaultModelId || null };
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
