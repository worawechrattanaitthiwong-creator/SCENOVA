import type { ApiConnectionKind } from "@/lib/api-connections/store";
import { getApiRouteStage } from "@/lib/api-connections/routing";
import { createKlingAuthorization } from "@/lib/providers/kling-video-provider";
import { getVideoModelVersions } from "@/lib/video-model-versions";

export type ProviderModelAvailability = "AVAILABLE" | "SUPPORTED" | "UNVERIFIED";

export type ProviderModelOption = {
  apiModelId: string;
  label: string;
  note?: string;
  recommended?: boolean;
  availability: ProviderModelAvailability;
};

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
  models: ProviderModelOption[];
};

const RUNWAY_BASE_URL = "https://api.dev.runwayml.com/v1";

export const API_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: "inception",
    label: "Inception Mercury",
    kind: "ANALYZER",
    defaultBaseUrl: "https://api.inceptionlabs.ai/v1",
    defaultModelId: "mercury-2",
    systemKeyEnv: "INCEPTION_API_KEY",
    ready: true,
    purposeTh: "AI Brain และตัวเลือกตามบริบท",
    capabilityTh: "วิเคราะห์โครงเรื่อง Locks และบริบทล่าสุด พร้อมคืน Structured choices ให้ Agent และหน้าสร้าง",
    credentialHintTh: "ใส่ Inception API Key เพื่อใช้ Mercury 2 เป็น AI Brain โดยไม่เกี่ยวกับ Video Provider",
  },
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
    credentialHintTh: "ใส่ Groq API Key แล้วระบบจะตรวจรุ่นที่บัญชีนี้มองเห็นให้อัตโนมัติ",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "ANALYZER",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultModelId: "openai/gpt-oss-20b",
    systemKeyEnv: "OPENROUTER_API_KEY",
    ready: true,
    purposeTh: "Analyzer สำรองหลายโมเดล",
    capabilityTh: "Analyzer จริงผ่าน OpenAI-compatible API พร้อม Structured JSON และ Default Connection",
    credentialHintTh: "ใส่ OpenRouter API Key แล้วระบบจะดึงรายชื่อโมเดลที่บัญชีมองเห็นมาให้เลือก",
  },
  {
    id: "gemini",
    label: "Gemini",
    kind: "ANALYZER",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModelId: "gemini-2.5-flash",
    systemKeyEnv: "GEMINI_API_KEY",
    ready: true,
    purposeTh: "Analyzer / Multimodal",
    capabilityTh: "วิเคราะห์คำสั่งจริงผ่าน Gemini generateContent พร้อม Structured JSON และ Locks",
    credentialHintTh: "ใส่ Gemini API Key ระบบจะอ่านรายชื่อ Gemini ที่ Key นี้เข้าถึงได้โดยไม่ Generate งานเสียเงิน",
  },
  {
    id: "openai-image",
    label: "OpenAI Image",
    kind: "IMAGE",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModelId: "gpt-image-2",
    systemKeyEnv: "OPENAI_API_KEY",
    ready: true,
    purposeTh: "ภาพ Preview / Reference",
    capabilityTh: "สร้างภาพจริงผ่าน Image Generation API และคืน Reference ให้ Workflow ใช้ต่อ",
    credentialHintTh: "ใส่ OpenAI API Key ที่มีสิทธิ์ Image Generation ระบบจะค้นหารุ่นภาพที่ Key มองเห็น",
  },
  {
    id: "gemini-image",
    label: "Gemini Image",
    kind: "IMAGE",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModelId: "gemini-3.1-flash-image",
    systemKeyEnv: "GEMINI_API_KEY",
    ready: true,
    purposeTh: "ภาพ Preview / Reference",
    capabilityTh: "สร้างและแก้ภาพ Reference จริงผ่าน Gemini Interactions พร้อมรับภาพอ้างอิงหลายภาพ",
    credentialHintTh: "ใส่ Gemini API Key ระบบจะกรองรุ่น Image ที่บัญชีเข้าถึงได้มาให้เลือก",
  },
  {
    id: "runway-image",
    label: "GPT Image 2 — Runway",
    kind: "IMAGE",
    defaultBaseUrl: RUNWAY_BASE_URL,
    defaultModelId: "gpt_image_2",
    systemKeyEnv: "RUNWAY_API_KEY",
    ready: true,
    purposeTh: "ภาพ Preview / Character / Reference",
    capabilityTh: "สร้าง GPT Image 2 ผ่าน Runway text_to_image พร้อม Reference images และ Poll task จนเสร็จ",
    credentialHintTh: "ตั้งค่าเป็น Connection แยกได้ จึงสามารถใช้ Runway API Key คนละตัวกับวิดีโอได้",
  },
  {
    id: "seedance",
    label: "Seedance — BytePlus",
    kind: "VIDEO",
    defaultBaseUrl: process.env.SEEDANCE_API_BASE_URL || "https://operator.las.ap-southeast-1.bytepluses.com/api/v1",
    defaultModelId: "dreamina-seedance-2-5-260628",
    systemKeyEnv: "SEEDANCE_API_KEY",
    ready: true,
    purposeTh: "Seedance แบบ Direct Provider",
    capabilityTh: "สร้างคลิปจริงจาก Production Prompt พร้อม Image/Video/Audio Reference และ Poll สถานะจนเสร็จ",
    credentialHintTh: "ใช้ BytePlus/Seedance API Key ของบริการนี้โดยเฉพาะ",
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
    credentialHintTh: "Kling ใช้ AccessKey + SecretKey: วางเป็น AccessKey:SecretKey หรือวาง 2 บรรทัด ระบบจะสร้าง JWT ให้เอง",
  },
  {
    id: "veo",
    label: "Veo — Google",
    kind: "VIDEO",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModelId: "veo-3.1-lite-generate-preview",
    systemKeyEnv: "VEO_API_KEY",
    ready: true,
    purposeTh: "Video Generator คุณภาพสูง",
    capabilityTh: "สร้าง Veo แบบ Long-running operation, Poll จนเสร็จ และ Proxy media ฝั่ง Server โดยไม่เปิดเผย Key",
    credentialHintTh: "ใช้ Gemini API Key ที่มีสิทธิ์ใช้ Veo โดยแยกจาก Provider อื่น",
  },
  {
    id: "runway",
    label: "Runway Developer API",
    kind: "VIDEO",
    defaultBaseUrl: RUNWAY_BASE_URL,
    defaultModelId: "gen4.5",
    systemKeyEnv: "RUNWAY_API_KEY",
    ready: true,
    purposeTh: "ศูนย์เชื่อมต่อโมเดลวิดีโอ",
    capabilityTh: "ใช้คีย์เดียวเรียกโมเดลที่ Runway Developer API รองรับ โดยส่ง Model ID จริงของแต่ละโมเดล",
    credentialHintTh: "เชื่อมต่อคีย์ครั้งเดียวแล้วเลือกโมเดลได้จากหน้าสร้าง สิทธิ์และโควตารายโมเดลขึ้นกับบัญชี Runway ของคุณ",
  },
  {
    id: "wan",
    label: "Wan",
    kind: "VIDEO",
    defaultBaseUrl: "https://dashscope-intl.aliyuncs.com/api/v1",
    defaultModelId: "wan3.0-video",
    systemKeyEnv: "WAN_API_KEY",
    ready: true,
    purposeTh: "Video Generator ทางเลือก",
    capabilityTh: "สร้าง Wan Text/Image-to-Video แบบ asynchronous และ Poll task ผ่าน Alibaba Model Studio / DashScope",
    credentialHintTh: "ใส่ DashScope/Model Studio API Key; SCENOVA ใช้ International Base URL มาตรฐานให้อัตโนมัติ",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    kind: "VOICE",
    defaultBaseUrl: "https://api.elevenlabs.io/v1",
    defaultModelId: "eleven_multilingual_v2",
    systemKeyEnv: "ELEVENLABS_API_KEY",
    ready: true,
    purposeTh: "Voice / TTS",
    capabilityTh: "สร้างเสียงพูดจริงตาม Voice ID และ Dialogue ผ่าน ElevenLabs Text-to-Speech",
    credentialHintTh: "ใส่ ElevenLabs API Key ระบบจะอ่านรายการ Voice models ที่บัญชีมองเห็นมาให้เลือก",
  },
  {
    id: "openai-voice",
    label: "OpenAI Audio",
    kind: "VOICE",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModelId: "gpt-4o-mini-tts",
    systemKeyEnv: "OPENAI_API_KEY",
    ready: true,
    purposeTh: "Voice / TTS",
    capabilityTh: "สร้างเสียงพูดจริงผ่าน Audio Speech API พร้อม Voice และ Instructions",
    credentialHintTh: "ใส่ OpenAI API Key ระบบจะค้นหารุ่น TTS/Audio ที่ Key นี้มองเห็น",
  },
];

function videoOptions(name: string): ProviderModelOption[] {
  return getVideoModelVersions(name).map((model) => ({
    apiModelId: model.apiModelId,
    label: model.label,
    note: model.note,
    recommended: model.recommended,
    availability: "SUPPORTED" as const,
  }));
}

function runwayVideoOptions(): ProviderModelOption[] {
  return [
    ...videoOptions("Runway"),
    ...videoOptions("Seedance 2.5 (Runway)"),
    ...videoOptions("Gemini Omni Flash 1.1 (Runway)"),
    ...videoOptions("Aleph 2.0 (Runway)"),
    ...videoOptions("Ruby HDR (Runway)"),
  ];
}

const STATIC_MODEL_CATALOG: Record<string, ProviderModelOption[]> = {
  inception: [{ apiModelId: "mercury-2", label: "Mercury 2", recommended: true, availability: "SUPPORTED" }],
  groq: [{ apiModelId: "openai/gpt-oss-20b", label: "GPT OSS 20B", recommended: true, availability: "UNVERIFIED" }],
  openrouter: [{ apiModelId: "openai/gpt-oss-20b", label: "GPT OSS 20B", recommended: true, availability: "UNVERIFIED" }],
  gemini: [{ apiModelId: "gemini-2.5-flash", label: "Gemini 2.5 Flash", recommended: true, availability: "UNVERIFIED" }],
  "openai-image": [{ apiModelId: "gpt-image-2", label: "GPT Image 2", recommended: true, availability: "UNVERIFIED" }],
  "gemini-image": [{ apiModelId: "gemini-3.1-flash-image", label: "Gemini 3.1 Flash Image", recommended: true, availability: "UNVERIFIED" }],
  "runway-image": [{ apiModelId: "gpt_image_2", label: "GPT Image 2", note: "Text / Reference Image → Image", recommended: true, availability: "SUPPORTED" }],
  seedance: videoOptions("Seedance 2.5"),
  kling: videoOptions("Kling"),
  veo: videoOptions("Veo"),
  runway: runwayVideoOptions(),
  wan: videoOptions("Wan"),
  elevenlabs: [{ apiModelId: "eleven_multilingual_v2", label: "Eleven Multilingual v2", recommended: true, availability: "UNVERIFIED" }],
  "openai-voice": [
    { apiModelId: "gpt-4o-mini-tts", label: "GPT-4o mini TTS", recommended: true, availability: "UNVERIFIED" },
    { apiModelId: "tts-1", label: "TTS-1", availability: "UNVERIFIED" },
    { apiModelId: "tts-1-hd", label: "TTS-1 HD", availability: "UNVERIFIED" },
  ],
};

export function getProviderDefinition(providerId: string, kind?: ApiConnectionKind) {
  const requestedId = providerId.trim().toLowerCase();
  const id = ["runway-seedance", "runway-gemini-omni", "runway-aleph", "runway-ruby"].includes(requestedId)
    ? "runway"
    : requestedId;
  return API_PROVIDER_DEFINITIONS.find((item) => item.id === id && (!kind || item.kind === kind)) || null;
}

export function getProviderModelCatalog(providerId: string) {
  const requestedId = providerId.trim().toLowerCase();
  const id = ["runway-seedance", "runway-gemini-omni", "runway-aleph", "runway-ruby"].includes(requestedId)
    ? "runway"
    : requestedId;
  return (STATIC_MODEL_CATALOG[id] || []).map((model) => ({ ...model }));
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
      models: getProviderModelCatalog(definition.id),
    };
  });
}

function classifyProbe(response: Response | null, providerLabel: string) {
  if (!response) return { ok: false as const, code: "PROVIDER_UNREACHABLE", message: `เชื่อมต่อ ${providerLabel} ไม่สำเร็จ` };
  if (response.status === 401 || response.status === 403) return { ok: false as const, code: "INVALID_API_KEY", message: "Credential ไม่ถูกต้อง ไม่มีสิทธิ์ หรือ Key ถูกจำกัด Scope" };
  if (response.status === 429) return { ok: false as const, code: "RATE_LIMITED", message: `${providerLabel} จำกัดการเรียกชั่วคราว กรุณาลองอีกครั้ง` };
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

async function probeGemini(baseUrl: string, apiKey: string, pageSize = 1) {
  return fetch(`${baseUrl}/models?pageSize=${pageSize}`, {
    headers: { "x-goog-api-key": apiKey.trim() },
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

  if (definition.id === "groq" || definition.id === "openrouter" || definition.id === "inception") {
    response = await probeBearer(baseUrl, "/models", input.apiKey);
  } else if (definition.id === "gemini" || definition.id === "gemini-image" || definition.id === "veo") {
    response = await probeGemini(baseUrl, input.apiKey);
  } else if (definition.id === "openai-image" || definition.id === "openai-voice") {
    response = await probeBearer(baseUrl, `/models/${encodeURIComponent(definition.defaultModelId || "")}`, input.apiKey);
  } else if (definition.id === "seedance") {
    response = await probeBearer(baseUrl, "/contents/generations/tasks/scenova-credential-check", input.apiKey, { "Content-Type": "application/json" });
  } else if (definition.id === "kling") {
    const token = createKlingAuthorization(input.apiKey);
    if (!token) return { ok: false as const, code: "INVALID_API_KEY", message: "กรุณาใส่ Kling AccessKey:SecretKey หรือ Bearer/JWT token" };
    response = await probeBearer(baseUrl, "/v1/videos/text2video?pageNum=1&pageSize=1", token, { "Content-Type": "application/json" });
  } else if (definition.id.startsWith("runway")) {
    response = await probeBearer(baseUrl, "/tasks/00000000-0000-4000-8000-000000000000", input.apiKey, {
      "X-Runway-Version": "2024-11-06",
      "Content-Type": "application/json",
    });
  } else if (definition.id === "wan") {
    response = await probeBearer(baseUrl, "/tasks/scenova-credential-check", input.apiKey, { "Content-Type": "application/json" });
  } else if (definition.id === "elevenlabs") {
    response = await fetch(`${baseUrl}/models`, {
      headers: { "xi-api-key": input.apiKey.trim() },
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);
  }

  const result = classifyProbe(response, definition.label);
  if (!result.ok) return result;
  return { ok: true as const, baseUrl, modelId: definition.defaultModelId || null };
}

function modelIdFromUnknown(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const item = value as Record<string, unknown>;
  const candidate = item.id ?? item.name ?? item.model_id ?? item.modelId;
  if (typeof candidate !== "string") return "";
  return candidate.replace(/^models\//, "").trim();
}

function modelLabelFromUnknown(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const item = value as Record<string, unknown>;
  const candidate = item.displayName ?? item.display_name ?? item.name;
  if (typeof candidate !== "string" || candidate.startsWith("models/")) return fallback;
  return candidate.trim() || fallback;
}

function providerAcceptsDiscoveredModel(providerId: string, modelId: string) {
  const id = modelId.toLowerCase();
  if (providerId === "veo") return id.includes("veo");
  if (providerId === "gemini-image") return id.includes("gemini") && id.includes("image");
  if (providerId === "gemini") return id.includes("gemini") && !id.includes("image") && !id.includes("veo");
  if (providerId === "openai-image") return id.includes("image");
  if (providerId === "openai-voice") return id.includes("tts") || id.includes("audio");
  return true;
}

async function discoverRemoteModels(definition: ProviderDefinition, baseUrl: string, apiKey: string): Promise<ProviderModelOption[]> {
  let response: Response | null = null;
  if (["groq", "openrouter", "inception", "openai-image", "openai-voice"].includes(definition.id)) {
    response = await probeBearer(baseUrl, "/models", apiKey);
  } else if (["gemini", "gemini-image", "veo"].includes(definition.id)) {
    response = await probeGemini(baseUrl, apiKey, 1000);
  } else if (definition.id === "elevenlabs") {
    response = await fetch(`${baseUrl}/models`, {
      headers: { "xi-api-key": apiKey.trim() },
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);
  } else {
    return [];
  }
  if (!response?.ok) return [];
  const payload = await response.json().catch(() => null);
  const record = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.models)
        ? record.models
        : [];
  const seen = new Set<string>();
  const result: ProviderModelOption[] = [];
  for (const raw of items) {
    const apiModelId = modelIdFromUnknown(raw);
    if (!apiModelId || seen.has(apiModelId) || !providerAcceptsDiscoveredModel(definition.id, apiModelId)) continue;
    seen.add(apiModelId);
    result.push({
      apiModelId,
      label: modelLabelFromUnknown(raw, apiModelId),
      availability: "AVAILABLE",
      recommended: apiModelId === definition.defaultModelId,
    });
  }
  return result.sort((left, right) => Number(Boolean(right.recommended)) - Number(Boolean(left.recommended)) || left.label.localeCompare(right.label));
}

export async function discoverProviderModels(input: {
  provider: string;
  kind: ApiConnectionKind;
  apiKey: string;
  baseUrl?: string | null;
}) {
  const definition = getProviderDefinition(input.provider, input.kind);
  if (!definition) return { ok: false as const, code: "UNSUPPORTED_PROVIDER", message: "Provider นี้ยังไม่รองรับ" };
  const tested = await testProviderConnection(input);
  if (!tested.ok) return tested;
  const baseUrl = tested.baseUrl;
  const remote = await discoverRemoteModels(definition, baseUrl, input.apiKey);
  const staticModels = getProviderModelCatalog(definition.id);
  let models: ProviderModelOption[];
  if (remote.length) {
    models = remote;
  } else {
    models = staticModels.map((model) => ({ ...model, availability: staticModels.length ? "SUPPORTED" : "UNVERIFIED" }));
  }
  if (!models.length && definition.defaultModelId) {
    models = [{ apiModelId: definition.defaultModelId, label: definition.defaultModelId, recommended: true, availability: "UNVERIFIED" }];
  }
  const defaultModelId = models.find((model) => model.apiModelId === definition.defaultModelId)?.apiModelId
    || models.find((model) => model.recommended)?.apiModelId
    || models[0]?.apiModelId
    || null;
  return { ok: true as const, baseUrl, defaultModelId, models };
}

export function getSystemProviderCredential(providerId: string, kind: ApiConnectionKind) {
  const definition = getProviderDefinition(providerId, kind);
  if (!definition?.systemKeyEnv) return null;
  const apiKey = process.env[definition.systemKeyEnv]?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: definition.defaultBaseUrl,
    modelId: definition.defaultModelId || null,
  };
}
