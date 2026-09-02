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

  it("stops automatic retries for a generic Veo HTTP 429 response", () => {
    const result = decideAgentRecovery({
      error: new Error("VEO_HTTP_429: Too many requests"),
      attempt: 1,
      maxRetries: 3,
      providerSwitches: 0,
      maxProviderSwitches: 1,
    });
    expect(result.action).toBe("ASK_USER");
    expect(result.delayMs).toBe(0);
  });

  it("does not retry a Runway HTTP 400 validation failure", () => {
    const result = decideAgentRecovery({
      error: new Error("RUNWAY_HTTP_400:Validation of body failed | issues: body.promptImage: URL is not publicly accessible"),
      attempt: 1,
      maxRetries: 3,
      providerSwitches: 0,
      maxProviderSwitches: 1,
    });

    expect(result.action).toBe("ASK_USER");
    expect(result.delayMs).toBe(0);
    expect(result.reason).toContain("จะไม่ Retry");
    expect(result.reason).toContain("promptImage");
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
