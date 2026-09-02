import { describe, expect, it } from "vitest";
import type { SafeApiConnection } from "@/lib/api-connections/store";
import { API_ROUTE_STAGES, buildApiRoutingSnapshot, getApiRouteStage } from "@/lib/api-connections/routing";
import { getPublicProviderCatalog } from "@/lib/api-connections/providers";
import { createKlingAuthorization, createKlingJwt } from "@/lib/providers/kling-video-provider";

function connection(overrides: Partial<SafeApiConnection> & Pick<SafeApiConnection, "id" | "provider" | "kind">): SafeApiConnection {
  const modelId = overrides.modelId ?? null;
  return {
    id: overrides.id,
    provider: overrides.provider,
    kind: overrides.kind,
    modelId,
    enabledModelIds: overrides.enabledModelIds ?? (modelId ? [modelId] : []),
    availableModels: overrides.availableModels ?? (modelId ? [{ apiModelId: modelId, label: modelId, recommended: true, availability: "UNVERIFIED" }] : []),
    baseUrl: overrides.baseUrl ?? null,
    maskedKey: overrides.maskedKey ?? "••••abcd",
    status: overrides.status ?? "CONNECTED",
    enabled: overrides.enabled ?? true,
    isDefault: overrides.isDefault ?? false,
    lastTestedAt: overrides.lastTestedAt ?? null,
    lastError: overrides.lastError ?? null,
    createdAt: overrides.createdAt ?? new Date(0).toISOString(),
    updatedAt: overrides.updatedAt ?? new Date(0).toISOString(),
  };
}

describe("API pipeline routing", () => {
  it("keeps A/B/C/D mapped to analyzer, image, video and voice", () => {
    expect(API_ROUTE_STAGES.map((stage) => [stage.id, stage.kind])).toEqual([
      ["A", "ANALYZER"],
      ["B", "IMAGE"],
      ["C", "VIDEO"],
      ["D", "VOICE"],
    ]);
    expect(getApiRouteStage("VIDEO")?.id).toBe("C");
  });

  it("selects an enabled default connection only within its own stage", () => {
    const snapshot = buildApiRoutingSnapshot([
      connection({ id: "a1", provider: "groq", kind: "ANALYZER", isDefault: true }),
      connection({ id: "c1", provider: "seedance", kind: "VIDEO", isDefault: false }),
      connection({ id: "c2", provider: "veo", kind: "VIDEO", isDefault: true, enabled: false }),
    ]);

    const analyzer = snapshot.find((stage) => stage.id === "A");
    const video = snapshot.find((stage) => stage.id === "C");
    expect(analyzer?.activeProvider).toBe("groq");
    expect(analyzer?.ready).toBe(true);
    expect(video?.activeProvider).toBe("seedance");
    expect(video?.activeConnectionId).toBe("c1");
  });
});

describe("provider registry readiness", () => {
  it("exposes every provider with an implemented runtime as ready", () => {
    const providers = getPublicProviderCatalog();
    const expectedByStage = {
      A: ["groq", "openrouter", "gemini"],
      B: ["openai-image", "gemini-image"],
      C: ["seedance", "kling", "veo", "runway", "wan"],
      D: ["elevenlabs", "openai-voice"],
    } as const;

    for (const [stageId, ids] of Object.entries(expectedByStage)) {
      for (const id of ids) {
        const provider = providers.find((item) => item.id === id);
        expect(provider, `${id} must exist in provider catalog`).toBeTruthy();
        expect(provider?.status, `${id} must only be marked ready after its runtime exists`).toBe("READY");
        expect(provider?.ready).toBe(true);
        expect(provider?.stageId).toBe(stageId);
        expect(provider?.defaultBaseUrl).toBeTruthy();
      }
    }
  });

  it("assigns every provider to a known pipeline stage", () => {
    const providers = getPublicProviderCatalog();
    expect(providers.length).toBeGreaterThan(0);
    for (const provider of providers) {
      expect(["A", "B", "C", "D"]).toContain(provider.stageId);
    }
  });
});

describe("Kling BYOK authentication", () => {
  it("creates a deterministic HS256 JWT from AccessKey and SecretKey", () => {
    const token = createKlingJwt("access-example", "secret-example", 1_700_000_000);
    expect(token.split(".")).toHaveLength(3);
    expect(token).toBe(createKlingJwt("access-example", "secret-example", 1_700_000_000));
    expect(token).not.toContain("secret-example");
  });

  it("accepts the single-field AccessKey:SecretKey format used by the API Center", () => {
    const token = createKlingAuthorization("access-example:secret-example");
    expect(token.split(".")).toHaveLength(3);
  });
});
