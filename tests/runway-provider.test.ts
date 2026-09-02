import { describe, expect, it } from "vitest";
import { formatRunwayApiError, normalizeRunwayPromptText, parseSignedCharacterReference } from "@/lib/providers/runway-video-provider";

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

  it("recognizes signed SCENOVA character-reference URLs for provider-side upload", () => {
    expect(parseSignedCharacterReference("https://scnva.com/api/character-references/ref.webp?o=owner123&sig=abc123")).toEqual({
      id: "ref.webp",
      owner: "owner123",
      signature: "abc123",
    });
    expect(parseSignedCharacterReference("https://example.com/image.webp")).toBeNull();
  });
});
