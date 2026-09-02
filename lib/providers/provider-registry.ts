import { getSystemProviderCredential } from "@/lib/api-connections/providers";
import { getDefaultUserApiConnectionSecret, getUserApiConnectionSecret } from "@/lib/api-connections/store";
import type { ProviderRuntimeCredential, VideoProvider } from "@/lib/providers/video-provider";
import { MockVideoProvider } from "@/lib/providers/mock-video-provider";
import { Seedance25VideoProvider } from "@/lib/providers/seedance-video-provider";
import { KlingVideoProvider } from "@/lib/providers/kling-video-provider";
import { VeoVideoProvider } from "@/lib/providers/veo-video-provider";
import { RunwayVideoProvider } from "@/lib/providers/runway-video-provider";
import { WanVideoProvider } from "@/lib/providers/wan-video-provider";

export type SupportedVideoProviderId =
  | "seedance"
  | "kling"
  | "veo"
  | "runway"
  | "runway-seedance"
  | "runway-gemini-omni"
  | "runway-aleph"
  | "runway-ruby"
  | "wan";

export type ProviderSelection = {
  provider: VideoProvider;
  reason: string;
  fallbackProviderIds: string[];
};

const VIDEO_PROVIDER_IDS: SupportedVideoProviderId[] = [
  "seedance",
  "kling",
  "veo",
  "runway",
  "runway-seedance",
  "runway-gemini-omni",
  "runway-aleph",
  "runway-ruby",
  "wan",
];

const RUNWAY_LOGICAL_PROVIDERS = new Set<SupportedVideoProviderId>([
  "runway",
  "runway-seedance",
  "runway-gemini-omni",
  "runway-aleph",
  "runway-ruby",
]);

function normalizeProviderId(value: string): SupportedVideoProviderId | "mock" | null {
  const id = String(value || "").trim().toLowerCase();
  if (id === "mock" || id === "mock-seedance") return "mock";
  if (id === "runway-seedance" || id === "seedance2_5" || id === "runway-seedance-2.5") return "runway-seedance";
  if (id === "runway-gemini-omni" || id === "gemini_omni_flash") return "runway-gemini-omni";
  if (id === "runway-aleph" || id === "aleph2") return "runway-aleph";
  if (id === "runway-ruby" || id === "ruby") return "runway-ruby";
  if (id === "runway" || id === "runway-gen4.5" || id === "gen4.5" || id === "gen4_turbo" || id.includes("gen4") || id.includes("gen-4")) return "runway";
  if (id === "seedance" || id === "byteplus-seedance-2.5" || id === "seedance-2.5" || id === "seedance-2-5") return "seedance";
  if (id === "kling" || id.startsWith("kling-")) return "kling";
  if (id === "veo" || id.startsWith("veo-")) return "veo";
  if (id === "wan" || id.startsWith("wan2") || id.startsWith("wan-") || id.startsWith("wan3")) return "wan";
  return null;
}

function providerForModel(modelId: string): SupportedVideoProviderId | null {
  const value = String(modelId || "").toLowerCase();
  if (value === "seedance2_5") return "runway-seedance";
  if (value === "gemini_omni_flash") return "runway-gemini-omni";
  if (value === "aleph2") return "runway-aleph";
  if (value === "ruby") return "runway-ruby";
  if (value === "gen4.5" || value === "gen4_turbo" || value.includes("runway") || value.includes("gen4") || value.includes("gen-4")) return "runway";
  if (value.includes("seedance") || value.includes("dreamina")) return "seedance";
  if (value.includes("kling")) return "kling";
  if (value.includes("veo")) return "veo";
  if (/(^|[^a-z])wan[\s._-]?[23]|wan-video|wan2|wan3/.test(value)) return "wan";
  return null;
}

function createProvider(providerId: SupportedVideoProviderId, credential?: ProviderRuntimeCredential): VideoProvider {
  if (providerId === "seedance") return new Seedance25VideoProvider(credential);
  if (providerId === "kling") return new KlingVideoProvider(credential);
  if (providerId === "veo") return new VeoVideoProvider(credential);
  if (RUNWAY_LOGICAL_PROVIDERS.has(providerId)) return new RunwayVideoProvider(credential, providerId);
  return new WanVideoProvider(credential);
}

function systemCredential(providerId: SupportedVideoProviderId): ProviderRuntimeCredential | null {
  const value = getSystemProviderCredential(providerId, "VIDEO");
  if (!value) return null;
  return {
    apiKey: value.apiKey,
    baseUrl: value.baseUrl,
    modelId: value.modelId,
    billingMode: "SYSTEM",
    connectionId: null,
  };
}

async function userCredential(userId: string, providerId: SupportedVideoProviderId): Promise<ProviderRuntimeCredential | null> {
  const byok = await getUserApiConnectionSecret({ userId, provider: providerId, kind: "VIDEO" });
  if (byok && byok.connection.status === "CONNECTED") {
    return {
      apiKey: byok.apiKey,
      baseUrl: byok.connection.baseUrl,
      modelId: byok.connection.modelId,
      billingMode: "BYOK",
      connectionId: byok.connection.id,
    };
  }
  return systemCredential(providerId);
}

export function getVideoProviders() {
  const mock = new MockVideoProvider();
  const seedance = new Seedance25VideoProvider();
  const kling = new KlingVideoProvider();
  const veo = new VeoVideoProvider();
  const runway = new RunwayVideoProvider(undefined, "runway");
  const wan = new WanVideoProvider();
  return { mock, seedance, kling, veo, runway, wan };
}

/** Backward-compatible system/env resolver. User jobs should use getUserVideoProviderById instead. */
export function getVideoProviderById(providerId: string): VideoProvider | null {
  const normalized = normalizeProviderId(providerId);
  if (normalized === "mock") return new MockVideoProvider();
  if (!normalized) return null;
  return createProvider(normalized);
}

/** Backward-compatible system/env map. User jobs should use getUserVideoProviderMap instead. */
export function getVideoProviderMap(): Record<string, VideoProvider> {
  const mock = new MockVideoProvider();
  const map: Record<string, VideoProvider> = { "mock-seedance": mock };
  const realEnabled = process.env.SCENOVA_REAL_VIDEO_PROVIDERS === "true";
  if (!realEnabled) {
    map["seedance-2-5"] = mock;
    map["seedance-2.5"] = mock;
    map["Seedance 2.5"] = mock;
    return map;
  }
  for (const providerId of VIDEO_PROVIDER_IDS) {
    const provider = createProvider(providerId);
    const candidate = provider as VideoProvider & { isConfigured?: () => boolean };
    if (candidate.isConfigured?.()) mapProviderAliases(map, providerId, provider);
  }
  return map;
}

function mapProviderAliases(map: Record<string, VideoProvider>, providerId: SupportedVideoProviderId, provider: VideoProvider) {
  if (providerId === "seedance") {
    for (const key of ["seedance", "seedance-2-5", "seedance-2.5", "Seedance 2.5", "dreamina-seedance-2-5-260628"]) map[key] = provider;
  } else if (providerId === "kling") {
    for (const key of ["kling", "kling-v3", "kling-v2-6", "Kling V3"]) map[key] = provider;
  } else if (providerId === "veo") {
    for (const key of ["veo", "veo-3.1", "veo-3.1-generate-preview", "Veo 3.1"]) map[key] = provider;
  } else if (providerId === "runway") {
    for (const key of ["runway", "runway-gen4.5", "gen4.5", "gen4_turbo", "Runway Gen-4.5"]) map[key] = provider;
  } else if (providerId === "runway-seedance") {
    for (const key of ["runway-seedance", "seedance2_5", "runway-seedance-2.5", "Seedance 2.5 (Runway)", "Seedance 2.5 via Runway"]) map[key] = provider;
  } else if (providerId === "runway-gemini-omni") {
    for (const key of ["runway-gemini-omni", "gemini_omni_flash", "Gemini Omni Flash 1.1 (Runway)", "Gemini Omni Flash 1.1 via Runway"]) map[key] = provider;
  } else if (providerId === "runway-aleph") {
    for (const key of ["runway-aleph", "aleph2", "Aleph 2.0 (Runway)", "Aleph 2.0 via Runway"]) map[key] = provider;
  } else if (providerId === "runway-ruby") {
    for (const key of ["runway-ruby", "ruby", "Ruby HDR (Runway)", "Ruby HDR via Runway"]) map[key] = provider;
  } else if (providerId === "wan") {
    for (const key of ["wan", "wan-video", "wan2.6-t2v", "wan2.7", "wan3.0-video", "Wan"]) map[key] = provider;
  }
}

export async function getUserVideoProviderById(userId: string, providerId: string): Promise<VideoProvider | null> {
  const normalized = normalizeProviderId(providerId);
  if (normalized === "mock") return new MockVideoProvider();
  if (!normalized) return null;
  const credential = await userCredential(userId, normalized);
  return credential ? createProvider(normalized, credential) : null;
}

export async function getUserVideoProviderMap(userId: string): Promise<Record<string, VideoProvider>> {
  const map: Record<string, VideoProvider> = {};
  for (const providerId of VIDEO_PROVIDER_IDS) {
    const credential = await userCredential(userId, providerId);
    if (!credential) continue;
    mapProviderAliases(map, providerId, createProvider(providerId, credential));
  }
  const allowMock = process.env.AGENT_ALLOW_MOCK_PROVIDER_FALLBACK === "true" || process.env.NODE_ENV !== "production";
  if (allowMock) map["mock-seedance"] = new MockVideoProvider();
  return map;
}

export async function selectUserVideoProvider(userId: string, modelId: string, preferredProviderId?: string | null): Promise<ProviderSelection> {
  const preferred = preferredProviderId ? normalizeProviderId(preferredProviderId) : null;
  if (preferred === "mock") return { provider: new MockVideoProvider(), reason: "ใช้ Mock Provider ตาม run state", fallbackProviderIds: [] };
  if (preferred) {
    const provider = await getUserVideoProviderById(userId, preferred);
    if (provider) return { provider, reason: `ใช้ ${preferred.toUpperCase()} ตาม Provider Lock ของงาน (${provider.billingMode || "SYSTEM"})`, fallbackProviderIds: [] };
    throw new Error(`VIDEO_PROVIDER_CONNECTION_REQUIRED:${preferred}`);
  }

  const inferred = providerForModel(modelId);
  if (inferred) {
    const provider = await getUserVideoProviderById(userId, inferred);
    if (provider) return { provider, reason: `Model Lock เลือก ${inferred.toUpperCase()} และพบ ${provider.billingMode === "BYOK" ? "BYOK ของผู้ใช้" : "System credential"}`, fallbackProviderIds: [] };
    throw new Error(`VIDEO_PROVIDER_CONNECTION_REQUIRED:${inferred}`);
  }

  const defaultConnection = await getDefaultUserApiConnectionSecret(userId, "VIDEO");
  if (defaultConnection?.connection.status === "CONNECTED") {
    const normalized = normalizeProviderId(defaultConnection.connection.provider);
    if (normalized && normalized !== "mock") {
      return {
        provider: createProvider(normalized, {
          apiKey: defaultConnection.apiKey,
          baseUrl: defaultConnection.connection.baseUrl,
          modelId: defaultConnection.connection.modelId,
          billingMode: "BYOK",
          connectionId: defaultConnection.connection.id,
        }),
        reason: `ใช้ Default Video Connection ของผู้ใช้: ${defaultConnection.connection.provider.toUpperCase()}`,
        fallbackProviderIds: [],
      };
    }
  }

  const allowMock = process.env.AGENT_ALLOW_MOCK_PROVIDER_FALLBACK === "true" || process.env.NODE_ENV !== "production";
  if (allowMock) return { provider: new MockVideoProvider(), reason: "ยังไม่มี Video BYOK/System credential ที่ตรงงาน จึงใช้ Mock เฉพาะโหมดพัฒนา", fallbackProviderIds: [] };
  throw new Error(`VIDEO_PROVIDER_CONNECTION_REQUIRED:${modelId || "VIDEO"}`);
}

export async function resolveUserAlternateProvider(userId: string, currentProviderId: string, modelId: string): Promise<ProviderSelection | null> {
  const current = normalizeProviderId(currentProviderId);
  const preferred = providerForModel(modelId);
  const order = [preferred, ...VIDEO_PROVIDER_IDS].filter((value, index, all): value is SupportedVideoProviderId => Boolean(value) && all.indexOf(value) === index);
  for (const providerId of order) {
    if (providerId === current) continue;
    const provider = await getUserVideoProviderById(userId, providerId);
    if (provider) return { provider, reason: `สลับไป ${providerId.toUpperCase()} ที่เชื่อมต่อพร้อมใช้งาน`, fallbackProviderIds: [] };
  }
  if (process.env.AGENT_ALLOW_MOCK_PROVIDER_FALLBACK === "true") {
    return { provider: new MockVideoProvider(), reason: "ไม่มี Alternate production provider และเปิด explicit mock fallback ไว้", fallbackProviderIds: [] };
  }
  return null;
}

/** Legacy synchronous selector retained for tests and non-user system flows. */
export function selectVideoProvider(modelId: string, preferredProviderId?: string | null): ProviderSelection {
  const preferred = preferredProviderId ? normalizeProviderId(preferredProviderId) : null;
  const inferred = providerForModel(modelId);
  const target = preferred && preferred !== "mock" ? preferred : inferred;
  if (target && process.env.SCENOVA_REAL_VIDEO_PROVIDERS === "true") {
    const provider = createProvider(target);
    const candidate = provider as VideoProvider & { isConfigured?: () => boolean };
    if (candidate.isConfigured?.()) return { provider, reason: `ใช้ ${target.toUpperCase()} production provider จาก System credential`, fallbackProviderIds: [] };
  }
  return { provider: new MockVideoProvider(), reason: "System flow ไม่มี production credential ที่ตรง จึงใช้ mock", fallbackProviderIds: [] };
}

export function resolveAlternateProvider(currentProviderId: string, modelId: string): ProviderSelection | null {
  const inferred = providerForModel(modelId);
  if (inferred && normalizeProviderId(currentProviderId) !== inferred && process.env.SCENOVA_REAL_VIDEO_PROVIDERS === "true") {
    const provider = createProvider(inferred);
    const candidate = provider as VideoProvider & { isConfigured?: () => boolean };
    if (candidate.isConfigured?.()) return { provider, reason: `สลับไป ${inferred.toUpperCase()} System provider`, fallbackProviderIds: [] };
  }
  if (process.env.AGENT_ALLOW_MOCK_PROVIDER_FALLBACK === "true") return { provider: new MockVideoProvider(), reason: "ใช้ explicit mock fallback", fallbackProviderIds: [] };
  return null;
}
