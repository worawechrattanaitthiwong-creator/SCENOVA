import { describe, expect, it } from "vitest";
import type { GenerateVideoRequest, VideoProvider } from "@/lib/providers/video-provider";
import { classifySubmissionFailure, precheckVideoRequest } from "@/lib/agent/generation-v2";

const provider: VideoProvider = {
  id: "veo",
  billingMode: "BYOK",
  getModelDefinition: () => ({
    id: "veo-3.1-lite", name: "Veo 3.1 Lite", provider: "Google", descriptionTh: "", bestFor: [],
    maxSecondsPerGeneration: 8, resolutions: ["720p", "1080p"], supportsAudio: true,
    supportsImageReference: true, supportsVideoReference: false, supportsMultiShot: false, priceLevel: 3, enabled: true,
  }),
  estimateCost: async () => ({ currency: "THB", estimatedAmount: 1 }),
  generate: async () => ({ providerTaskId: "task-1", status: "queued" }),
  getStatus: async () => ({ providerTaskId: "task-1", status: "generating" }),
  cancel: async () => false,
};

function request(overrides: Partial<GenerateVideoRequest> = {}): GenerateVideoRequest {
  return {
    projectId: "project", episodeId: "episode", resolution: "720p", aspectRatio: "16:9",
    renderSegment: { id: "shot", episodeId: "episode", order: 1, start: 0, end: 8, duration: 8, modelId: "veo", sourceSegmentIds: [], continuityFromPrevious: false },
    prompt: { master: "cinematic", episode: "story", shots: ["shot"], negative: "", thaiSummary: "" },
    imageReferences: [], videoReferences: [], audioReferences: [], idempotencyKey: "generation-fixed-key",
    ...overrides,
  };
}

describe("Video Generation V2 invariants", () => {
  it("accepts a valid request before a paid submission", () => {
    expect(precheckVideoRequest(provider, request())).toEqual([]);
  });

  it("stops unsupported duration and resolution before submission", () => {
    const invalid = request({ resolution: "480p", renderSegment: { ...request().renderSegment, duration: 10, end: 10 } });
    expect(precheckVideoRequest(provider, invalid)).toEqual(expect.arrayContaining(["DURATION_EXCEEDS_MODEL_LIMIT", "RESOLUTION_NOT_SUPPORTED"]));
  });

  it("treats provider HTTP rejection as safe to refund", () => {
    expect(classifySubmissionFailure(new Error("VEO_HTTP_429: quota exceeded"))).toBe("REJECTED");
  });

  it("treats timeout as ambiguous and forbids automatic resubmission", () => {
    expect(classifySubmissionFailure(new Error("The operation timed out"))).toBe("AMBIGUOUS");
  });
});
