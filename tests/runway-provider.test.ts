import { describe, expect, it } from "vitest";
import {
  buildRunwayImageDataUri,
  formatRunwayApiError,
  isSupportedRunwayImageData,
  normalizeRunwayPromptText,
  parseSignedCharacterReference,
} from "@/lib/providers/runway-video-provider";

describe("Runway provider errors", () => {
  it("preserves validation issue paths and messages", () => {
    const message = formatRunwayApiError({
      error: "Validation of body failed",
      issues: [
        { path: ["body", "promptImage"], message: "URL is not publicly accessible" },
        { path: ["body", "ratio"], message: "Unsupported ratio" },
      ],
    });

    expect(message).toContain("Validation of body failed");
    expect(message).toContain("body.promptImage: URL is not publicly accessible");
    expect(message).toContain("body.ratio: Unsupported ratio");
  });

  it("keeps Runway prompt text within the API validation limit", () => {
    const prompt = normalizeRunwayPromptText(`  ${"a".repeat(1200)}  `);
    expect(prompt).toHaveLength(1000);
    expect(prompt).toBe("a".repeat(1000));
  });

  it("recognizes signed SCENOVA character-reference URLs for provider-side loading", () => {
    expect(parseSignedCharacterReference("https://scnva.com/api/character-references/ref.webp?o=owner123&sig=abc123")).toEqual({
      id: "ref.webp",
      owner: "owner123",
      signature: "abc123",
    });
    expect(parseSignedCharacterReference("https://example.com/image.webp")).toBeNull();
  });

  it("converts valid local reference bytes to a Runway image data URI", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);
    expect(isSupportedRunwayImageData("image/png", png)).toBe(true);
    expect(buildRunwayImageDataUri("image/png", png)).toBe(`data:image/png;base64,${png.toString("base64")}`);
  });

  it("rejects mislabeled or unsupported local reference bytes before calling Runway", () => {
    expect(isSupportedRunwayImageData("image/jpeg", Buffer.from("not-a-jpeg"))).toBe(false);
    expect(() => buildRunwayImageDataUri("image/jpeg", Buffer.from("not-a-jpeg"))).toThrow("RUNWAY_PROMPT_IMAGE_REFERENCE_INVALID_FILE");
  });
});
