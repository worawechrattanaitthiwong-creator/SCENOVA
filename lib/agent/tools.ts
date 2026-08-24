import { assertGenerationAllowed, DEFAULT_SECURITY_POLICY, type KillSwitchState } from "@/lib/security";
import { assertAgentRunBudget } from "@/lib/agent/policy";
import type { AgentRunRecord, AgentToolName } from "@/lib/agent/types";

const TOOLS_BY_STAGE: Record<string, AgentToolName[]> = {
  PLAN_STORY: ["plan_episode", "pause_run"],
  SELECT_STYLE: ["select_style", "pause_run"],
  BUILD_PROMPTS: ["improve_prompt", "request_approval", "pause_run"],
  AWAIT_APPROVAL: ["request_approval", "pause_run"],
  GENERATE: ["generate_video", "switch_provider", "pause_run"],
  VERIFY_CONTINUITY: ["verify_continuity", "pause_run"],
  NEXT_EPISODE: ["plan_episode", "pause_run"],
};

export function assertAgentToolAllowed(input: {
  run: AgentRunRecord;
  tool: AgentToolName;
  requestedSpendThb?: number;
  providerId?: string;
  hourlySpendThb?: number;
  dailySpendThb?: number;
  killSwitch?: KillSwitchState;
  approvedBudgetThb?: number;
  creditReservationId?: string;
  creditReservationMode?: "wallet" | "mock";
}) {
  const allowed = TOOLS_BY_STAGE[input.run.stage] || [];
  if (!allowed.includes(input.tool)) throw new Error(`AGENT_TOOL_NOT_ALLOWED:${input.tool}:${input.run.stage}`);
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(input.run.status)) throw new Error("AGENT_RUN_NOT_ACTIVE");

  const spend = Math.max(0, input.requestedSpendThb || 0);
  if (spend) assertAgentRunBudget(input.run, spend);

  if (input.tool === "generate_video") {
    if (!input.providerId) throw new Error("AGENT_PROVIDER_REQUIRED");
    if (!input.creditReservationId) throw new Error("CREDIT_RESERVATION_REQUIRED");
    if (input.providerId !== "mock-seedance" && input.creditReservationMode !== "wallet") throw new Error("REAL_PROVIDER_REQUIRES_WALLET_RESERVATION");
    if (input.run.estimatedSpendThb > input.run.approvalThresholdThb && (input.approvedBudgetThb || 0) < input.run.estimatedSpendThb) throw new Error("AGENT_APPROVAL_REQUIRED");

    const hourly = input.hourlySpendThb || 0;
    const daily = input.dailySpendThb || 0;
    assertGenerationAllowed({
      killSwitch: input.killSwitch || { globalGenerationDisabled: process.env.SCENOVA_GENERATION_KILL_SWITCH === "true", disabledProviderIds: [] },
      providerId: input.providerId,
      hourlySpendThb: hourly,
      dailySpendThb: daily,
    });
    if (hourly + spend > DEFAULT_SECURITY_POLICY.hourlyProviderSpendCapThb) throw new Error("Hourly provider spend cap would be exceeded");
    if (daily + spend > DEFAULT_SECURITY_POLICY.dailyProviderSpendCapThb) throw new Error("Daily provider spend cap would be exceeded");
  }
}
