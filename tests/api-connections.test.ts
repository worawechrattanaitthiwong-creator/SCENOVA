import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { decryptApiSecret, encryptApiSecret } from "@/lib/api-connections/crypto";
import { getProviderModelCatalog, getPublicProviderCatalog } from "@/lib/api-connections/providers";
import { productionAnalysisSchema } from "@/lib/analyzer/schema";

const originalKey = process.env.API_KEY_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.API_KEY_ENCRYPTION_KEY;
  else process.env.API_KEY_ENCRYPTION_KEY = originalKey;
});

describe("BYOK API key encryption", () => {
  it("round-trips an API key without storing plaintext", () => {
    process.env.API_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const secret = "gsk_example_super_secret_1234";
    const encrypted = encryptApiSecret(secret);

    expect(encrypted.ciphertext).not.toContain(secret);
    expect(encrypted.iv.length).toBeGreaterThan(10);
    expect(decryptApiSecret(encrypted)).toBe(secret);
  });

  it("rejects a missing encryption key", () => {
    delete process.env.API_KEY_ENCRYPTION_KEY;
    expect(() => encryptApiSecret("gsk_example_1234")).toThrow("API_KEY_ENCRYPTION_KEY_REQUIRED");
  });
});

describe("provider model catalogs", () => {
  it("exposes multiple selectable versions for video providers", () => {
    expect(getProviderModelCatalog("veo").map((model) => model.apiModelId)).toEqual(expect.arrayContaining([
      "veo-3.1-lite-generate-preview",
      "veo-3.1-fast-generate-preview",
      "veo-3.1-generate-preview",
    ]));
    expect(getProviderModelCatalog("kling").length).toBeGreaterThan(1);
    expect(getProviderModelCatalog("seedance").length).toBeGreaterThan(1);
  });

  it("uses one Runway connection for exact first-class API models", () => {
    expect(getProviderModelCatalog("runway").map((model) => model.apiModelId)).toEqual(expect.arrayContaining([
      "gen4.5",
      "gen4_turbo",
    ]));
    expect(getProviderModelCatalog("runway").map((model) => model.apiModelId)).toEqual(expect.arrayContaining([
      "seedance2_5",
      "gemini_omni_flash",
      "aleph2",
      "ruby",
    ]));

    expect(getProviderModelCatalog("runway-seedance").map((model) => model.apiModelId)).toContain("seedance2_5");
    expect(getProviderModelCatalog("runway-gemini-omni").map((model) => model.apiModelId)).toContain("gemini_omni_flash");
    expect(getProviderModelCatalog("runway-aleph").map((model) => model.apiModelId)).toContain("aleph2");
    expect(getProviderModelCatalog("runway-ruby").map((model) => model.apiModelId)).toContain("ruby");
    expect(getProviderModelCatalog("runway-image").map((model) => model.apiModelId)).toContain("gpt_image_2");

    const providers = getPublicProviderCatalog();
    const runway = providers.find((provider) => provider.id === "runway" && provider.kind === "VIDEO");
    const legacyRunwayProviders = providers.filter((provider) => ["runway-seedance", "runway-gemini-omni", "runway-aleph", "runway-ruby"].includes(provider.id));
    const runwayImage = providers.find((provider) => provider.id === "runway-image" && provider.kind === "IMAGE");

    expect(runway?.defaultModelId).toBe("gen4.5");
    expect(legacyRunwayProviders).toHaveLength(0);
    expect(runwayImage?.defaultModelId).toBe("gpt_image_2");
  });

  it("shows all Studio video services with live readiness and image-input indicators", () => {
    const studio = readFileSync("components/single-episode-studio.tsx", "utf8");
    for (const label of [
      "Seedance 2.5",
      "Kling",
      "Veo",
      "Runway Gen-4.5",
      "Runway Gen-4 Turbo",
      "Gemini Omni Flash 1.1",
      "Aleph 2.0",
      "Ruby HDR",
      "Wan",
    ]) expect(studio).toContain(label);

    expect(studio).toContain('/api/api-connections');
    expect(studio).toContain('คีย์เชื่อมต่อแล้ว');
    expect(studio).toContain('Provider ยังไม่พร้อม');
    expect(studio).toContain('selectedConnectionState?.operationalReady');
    expect(studio).toContain('image: "ready"');
    expect(studio).toContain('image: "adapter"');
    expect(studio).toContain('mode: "video-edit"');
    expect(studio).toContain('mode: "hdr"');
  });

  it("publishes automatic base URLs and model metadata without system env names", () => {
    const providers = getPublicProviderCatalog();
    const veo = providers.find((provider) => provider.id === "veo");
    expect(veo?.defaultBaseUrl).toBe("https://generativelanguage.googleapis.com/v1beta");
    expect(veo?.models.length).toBeGreaterThan(1);
    expect(Object.prototype.hasOwnProperty.call(veo || {}, "systemKeyEnv")).toBe(false);
  });
});

describe("production analyzer schema", () => {
  it("accepts structured cinematic analysis", () => {
    const result = productionAnalysisSchema.parse({
      intent: "create_scene",
      summaryTh: "นักรบหญิงเดินเข้าวิหารกลางสายฝน",
      sourceLanguage: "th",
      scene: { description: "Ancient temple entrance in rain", location: "temple", timeOfDay: "night", weather: "rain" },
      characters: [{ name: "warrior", action: "walk into temple", emotion: "determined", dialogue: null }],
      camera: { shotType: "medium tracking", angle: "rear", lensMm: 35, cameraHeight: "eye level", movement: "track then orbit", composition: "center weighted", depthOfField: "shallow" },
      lighting: { style: "moonlit cinematic", mood: "tense" },
      audio: { ambience: "rain", music: "low strings", soundEffects: ["footsteps"] },
      generation: { durationSec: 8, aspectRatio: "16:9", negativePrompt: ["identity drift"] },
      locks: { respectCharacterLock: true, respectStyleLock: true, respectVoiceLock: true, respectLocationLock: true },
    });

    expect(result.camera.lensMm).toBe(35);
    expect(result.locks.respectCharacterLock).toBe(true);
  });
});
