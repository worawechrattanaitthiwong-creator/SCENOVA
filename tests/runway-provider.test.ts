import { describe, expect, it } from "vitest";
import { formatRunwayApiError, normalizeRunwayPromptText } from "@/lib/providers/runway-video-provider";

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
});
