import type { VideoProvider } from "@/lib/providers/video-provider";
import { MockVideoProvider } from "@/lib/providers/mock-video-provider";
import { Seedance25VideoProvider } from "@/lib/providers/seedance-video-provider";

export type ProviderSelection = {
  provider: VideoProvider;
  reason: string;
  fallbackProviderIds: string[];
};

export function getVideoProviders() {
  const mock = new MockVideoProvider();
  const seedance = new Seedance25VideoProvider();
  return { mock, seedance };
}

export function getVideoProviderById(providerId: string): VideoProvider | null {
  const { mock, seedance } = getVideoProviders();
  if (providerId === mock.id) return mock;
  if (providerId === seedance.id) return seedance;
  return null;
}

export function getVideoProviderMap(): Record<string, VideoProvider> {
  const { mock, seedance } = getVideoProviders();
  const useReal = process.env.SCENOVA_REAL_VIDEO_PROVIDERS === "true" && seedance.isConfigured();
  const selected = useReal ? seedance : mock;
  return {
    "seedance-2-5": selected,
    "seedance-2.5": selected,
    "Seedance 2.5": selected,
    "mock-seedance": mock,
  };
}

export function selectVideoProvider(modelId: string, preferredProviderId?: string | null): ProviderSelection {
  const { mock, seedance } = getVideoProviders();
  const realEnabled = process.env.SCENOVA_REAL_VIDEO_PROVIDERS === "true";

  if (preferredProviderId === seedance.id && realEnabled && seedance.isConfigured()) {
    return { provider: seedance, reason: "ใช้ Provider ที่ Agent เลือกไว้และผ่าน configuration guard", fallbackProviderIds: [mock.id] };
  }
  if (preferredProviderId === mock.id) {
    return { provider: mock, reason: "ใช้ Mock Provider ตาม run state", fallbackProviderIds: [] };
  }
  if (/seedance/i.test(modelId) && realEnabled && seedance.isConfigured()) {
    return { provider: seedance, reason: "Model Lock ระบุ Seedance 2.5 และ production provider พร้อมใช้งาน", fallbackProviderIds: [mock.id] };
  }
  return {
    provider: mock,
    reason: realEnabled ? "ยังไม่มี production provider ที่ตรง model/config จึงใช้ mock แบบไม่คิดเงินจริง" : "Production providers ถูกปิดไว้ จึงใช้ mock แบบไม่คิดเงินจริง",
    fallbackProviderIds: [],
  };
}

export function resolveAlternateProvider(currentProviderId: string, modelId: string): ProviderSelection | null {
  const { mock, seedance } = getVideoProviders();
  const allowMockFallback = process.env.AGENT_ALLOW_MOCK_PROVIDER_FALLBACK === "true";
  if (currentProviderId === seedance.id && allowMockFallback) {
    return { provider: mock, reason: "Seedance ใช้งานไม่ได้และเปิด explicit mock fallback ไว้", fallbackProviderIds: [] };
  }
  if (currentProviderId === mock.id && process.env.SCENOVA_REAL_VIDEO_PROVIDERS === "true" && seedance.isConfigured() && /seedance/i.test(modelId)) {
    return { provider: seedance, reason: "สลับจาก mock ไป Seedance 2.5 production provider", fallbackProviderIds: [] };
  }
  return null;
}
