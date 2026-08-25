import type { AgentPolicy, AgentRunRecord } from "@/lib/agent/types";

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getAgentPolicy(): AgentPolicy {
  return {
    defaultRunBudgetThb: envNumber("AGENT_DEFAULT_RUN_BUDGET_THB", 500),
    hardRunBudgetThb: envNumber("AGENT_HARD_RUN_BUDGET_THB", 2000),
    approvalThresholdThb: envNumber("AGENT_APPROVAL_THRESHOLD_THB", 150),
    maxEpisodesPerRun: Math.floor(envNumber("AGENT_MAX_EPISODES_PER_RUN", 10)),
    maxRetriesPerStep: Math.floor(envNumber("AGENT_MAX_RETRIES_PER_STEP", 2)),
    maxProviderSwitches: Math.floor(envNumber("AGENT_MAX_PROVIDER_SWITCHES", 1)),
    maxLlmCallsPerRun: Math.floor(envNumber("AGENT_MAX_LLM_CALLS_PER_RUN", 80)),
    maxLlmCallsPerClip: Math.floor(envNumber("AGENT_MAX_LLM_CALLS_PER_CLIP", 15)),
    maxConcurrentRunsPerUser: Math.floor(envNumber("AGENT_MAX_CONCURRENT_RUNS_PER_USER", 2)),
    queueLeaseSeconds: Math.floor(envNumber("AGENT_QUEUE_LEASE_SECONDS", 120)),
  };
}

export function normalizeRunBudget(requested?: number) {
  const policy = getAgentPolicy();
  const budget = Number.isFinite(requested) && Number(requested) > 0 ? Number(requested) : policy.defaultRunBudgetThb;
  return Math.min(budget, policy.hardRunBudgetThb);
}

export function assertAgentRunBudget(run: Pick<AgentRunRecord, "budgetThb" | "actualSpendThb">, requestedSpendThb: number) {
  if (requestedSpendThb < 0) throw new Error("AGENT_INVALID_SPEND");
  if (run.actualSpendThb + requestedSpendThb > run.budgetThb) throw new Error("AGENT_RUN_BUDGET_EXCEEDED");
}
