import { describe, expect, it } from "vitest";
import { decideAgentRecovery } from "@/lib/agent/recovery";

describe("Agent recovery", () => {
  it("does not auto-retry provider quota exhaustion", () => {
    const result = decideAgentRecovery({
      error: new Error("VEO_HTTP_429: You exceeded your current quota, please check your plan and billing details."),
      attempt: 1,
      maxRetries: 3,
      providerSwitches: 0,
      maxProviderSwitches: 1,
    });

    expect(result.action).toBe("ASK_USER");
    expect(result.delayMs).toBe(0);
    expect(result.reason).toContain("โควตา");
  });

  it("still retries an ordinary transient provider failure", () => {
    const result = decideAgentRecovery({
      error: new Error("VEO_HTTP_500: temporary provider failure"),
      attempt: 1,
      maxRetries: 3,
      providerSwitches: 1,
      maxProviderSwitches: 1,
    });

    expect(result.action).toBe("RETRY");
    expect(result.delayMs).toBeGreaterThan(0);
  });
});
