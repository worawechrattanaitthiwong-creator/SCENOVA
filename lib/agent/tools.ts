import { assertAgentRunBudget } from "@/lib/agent/policy";
import type { AgentRunRecord, AgentToolName } from "@/lib/agent/types";

const TOOLS_BY_STAGE: Record<string, AgentToolName[]> = {
  PLAN_STORY: ["plan_episode", "pause_run"],
  STORY_ARCHITECT: ["architect_story", "pause_run"],
  SCRIPT_WRITE: ["write_script", "pause_run"],
  SCRIPT_EDIT: ["edit_script", "pause_run"],
  DIRECT_SCENES: ["direct_scenes", "pause_run"],
  PLAN_CINEMATOGRAPHY: ["plan_cinematography", "pause_run"],
  SELECT_STYLE: ["select_style", "pause_run"],
  BUILD_PROMPTS: ["improve_prompt", "request_approval", "pause_run"],
  STORYBOARD: ["create_storyboard", "request_approval", "pause_run"],
  AWAIT_APPROVAL: ["request_approval", "pause_run"],
  GENERATE: ["pause_run"],
  VERIFY_CONTINUITY: ["verify_continuity", "pause_run"],
  POST_PRODUCTION: ["plan_post_production", "pause_run"],
  FINAL_QUALITY: ["quality_check", "pause_run"],
  NEXT_EPISODE: ["plan_episode", "pause_run"],
};

export function getAllowedAgentTools(stage: string): AgentToolName[] {
  return [...(TOOLS_BY_STAGE[stage] || [])];
}

export function assertAgentToolAllowed(input: {
  run: AgentRunRecord;
  tool: AgentToolName;
  requestedSpendThb?: number;
  providerId?: string;
  hourlySpendThb?: number;
  dailySpendThb?: number;
  killSwitch?: unknown;
  approvedBudgetThb?: number;
  creditReservationId?: string;
  creditReservationMode?: "wallet" | "mock" | "byok";
}) {
  // Planner-only Agent invariant: no legacy Agent run may call a video provider
  // or switch a provider. Video generation belongs to Studio/Series after the
  // user has reviewed and explicitly confirmed the plan.
  if (input.tool === "generate_video" || input.tool === "switch_provider") {
    throw new Error("AGENT_VIDEO_GENERATION_DISABLED");
  }

  const allowed = getAllowedAgentTools(input.run.stage);
  if (!allowed.includes(input.tool)) throw new Error(`AGENT_TOOL_NOT_ALLOWED:${input.tool}:${input.run.stage}`);
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(input.run.status)) throw new Error("AGENT_RUN_NOT_ACTIVE");

  const spend = Math.max(0, input.requestedSpendThb || 0);
  if (spend) assertAgentRunBudget(input.run, spend);
}
