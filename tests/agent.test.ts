import { describe, expect, it } from "vitest";
import { decideAgentRecovery } from "@/lib/agent/recovery";
import { normalizeRunBudget } from "@/lib/agent/policy";
import { assertAgentToolAllowed } from "@/lib/agent/tools";
import type { AgentRunRecord } from "@/lib/agent/types";

function run(overrides: Partial<AgentRunRecord> = {}): AgentRunRecord {
  const now = new Date();
  return {
    id: "run-1", userId: "user-1", mode: "test", status: "RUNNING", stage: "GENERATE", inputJson: {}, planJson: null, stateJson: {},
    budgetThb: 500, estimatedSpendThb: 100, actualSpendThb: 0, approvalThresholdThb: 150, maxEpisodes: 1, stopReason: null,
    startedAt: now, finishedAt: null, createdAt: now, updatedAt: now, ...overrides,
  };
}

describe("agent guardrails", () => {
  it("hard caps a requested run budget", () => {
    expect(normalizeRunBudget(999999)).toBeLessThanOrEqual(2000);
  });

  it("requires a credit reservation before generation", () => {
    expect(() => assertAgentToolAllowed({ run: run(), tool: "generate_video", requestedSpendThb: 10, providerId: "mock-seedance" })).toThrow("CREDIT_RESERVATION_REQUIRED");
  });

  it("requires human approval when estimated spend crosses threshold", () => {
    expect(() => assertAgentToolAllowed({
      run: run({ estimatedSpendThb: 200 }), tool: "generate_video", requestedSpendThb: 10, providerId: "mock-seedance",
      creditReservationId: "mock-reservation", creditReservationMode: "mock", approvedBudgetThb: 0,
    })).toThrow("AGENT_APPROVAL_REQUIRED");
  });
});

describe("agent recovery policy", () => {
  it("stops on budget guardrail failures", () => {
    expect(decideAgentRecovery({ error: new Error("AGENT_RUN_BUDGET_EXCEEDED"), attempt: 1, maxRetries: 2, providerSwitches: 0, maxProviderSwitches: 1 }).action).toBe("STOP");
  });

  it("retries transient failures with backoff", () => {
    const result = decideAgentRecovery({ error: new Error("provider timeout"), attempt: 1, maxRetries: 2, providerSwitches: 0, maxProviderSwitches: 1 });
    expect(result.action).toBe("RETRY");
    expect(result.delayMs).toBeGreaterThan(0);
  });
});
