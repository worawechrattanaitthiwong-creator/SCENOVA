import { describe, expect, it } from "vitest";
import { buildVeoParameters } from "@/lib/providers/veo-video-provider";

describe("Veo request compatibility", () => {
  it("does not send fixed-count or unsupported negative prompt parameters", () => {
    const parameters = buildVeoParameters({ aspectRatio: "16:9", resolution: "720p" });

    expect(parameters).toEqual({
      aspectRatio: "16:9",
      resolution: "720p",
    });
    expect(parameters).not.toHaveProperty("numberOfVideos");
    expect(parameters).not.toHaveProperty("negativePrompt");
  });

  it("normalizes portrait requests and keeps supported resolution", () => {
    expect(buildVeoParameters({ aspectRatio: "9:16", resolution: "1080p" })).toEqual({
      aspectRatio: "9:16",
      resolution: "1080p",
    });
  });
});
