import { describe, expect, it } from "vitest";
import { dedupeSuggestions } from "@/lib/ai-suggest";

describe("AI contextual option dedupe", () => {
  it("removes exact, normalized, and recent-history duplicates", () => {
    const result = dedupeSuggestions([
      { value: "Slow Dolly-In", rationale: "A" },
      { value: "slow dolly in", rationale: "B" },
      { value: "Locked-Off", rationale: "C" },
      { value: "Crane Rise", rationale: "D" },
    ], ["locked off"]);
    expect(result.map((item) => item.value)).toEqual(["Slow Dolly-In", "Crane Rise"]);
  });

  it("honors the requested option limit", () => {
    const result = dedupeSuggestions(Array.from({ length: 12 }, (_, index) => ({ value: `Choice ${index}`, rationale: "เหตุผล" })), [], 8);
    expect(result).toHaveLength(8);
  });
});
