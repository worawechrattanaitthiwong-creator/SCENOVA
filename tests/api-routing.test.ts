import { describe, expect, it } from "vitest";
import type { SafeApiConnection } from "@/lib/api-connections/store";
import { API_ROUTE_STAGES, buildApiRoutingSnapshot, getApiRouteStage } from "@/lib/api-connections/routing";
import { getPublicProviderCatalog } from "@/lib/api-connections/providers";

function connection(overrides: Partial<SafeApiConnection> & Pick<SafeApiConnection, "id" | "provider" | "kind">): SafeApiConnection {
  return {
    id: overrides.id,
    provider: overrides.provider,
    kind: overrides.kind,
    modelId: overrides.modelId ?? null,
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
  it("only exposes actually implemented adapters as ready", () => {
    const providers = getPublicProviderCatalog();
    const groq = providers.find((provider) => provider.id === "groq");
    const seedance = providers.find((provider) => provider.id === "seedance");
    const kling = providers.find((provider) => provider.id === "kling");
    const veo = providers.find((provider) => provider.id === "veo");

    expect(groq?.status).toBe("READY");
    expect(groq?.stageId).toBe("A");
    expect(seedance?.status).toBe("ADAPTER_PENDING");
    expect(kling?.status).toBe("ADAPTER_PENDING");
    expect(veo?.status).toBe("ADAPTER_PENDING");
    expect(seedance?.stageId).toBe("C");
  });

  it("assigns every provider to a known pipeline stage", () => {
    const providers = getPublicProviderCatalog();
    expect(providers.length).toBeGreaterThan(0);
    for (const provider of providers) {
      expect(["A", "B", "C", "D"]).toContain(provider.stageId);
    }
  });
});
