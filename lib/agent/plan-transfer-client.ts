import type { AgentPlanTarget, AgentStructuredPlan } from "@/lib/agent/plan-schema";

export const AGENT_PLAN_TRANSFER_KEY = "scenova-agent-plan-transfer-v1";

export type AgentPlanTransferEnvelope = {
  plan: AgentStructuredPlan;
  token: string;
  target: AgentPlanTarget;
  projectKey: string;
  createdAt: string;
};

export function savePendingAgentPlan(envelope: AgentPlanTransferEnvelope) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AGENT_PLAN_TRANSFER_KEY, JSON.stringify(envelope));
}

export function readPendingAgentPlan(): AgentPlanTransferEnvelope | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(AGENT_PLAN_TRANSFER_KEY);
    return raw ? JSON.parse(raw) as AgentPlanTransferEnvelope : null;
  } catch {
    return null;
  }
}

export function clearPendingAgentPlan() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AGENT_PLAN_TRANSFER_KEY);
}
