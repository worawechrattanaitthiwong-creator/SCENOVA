import type { RenderSegment } from "@/lib/domain";
import type { AgentStage } from "@/lib/agent/types";

const PRE_PROMPT_STAGES = new Set<AgentStage>([
  "PLAN_STORY",
  "STORY_ARCHITECT",
  "SCRIPT_WRITE",
  "SCRIPT_EDIT",
  "DIRECT_SCENES",
  "PLAN_CINEMATOGRAPHY",
  "SELECT_STYLE",
]);

/**
 * Changing the video model only affects provider planning from BUILD_PROMPTS onward.
 * Earlier creative stages can continue where they stopped. NEXT_EPISODE has already
 * finished the current episode, so the new model should apply to the next episode
 * without re-rendering the one that was just completed.
 */
export function safeVideoModelRestartStage(stage: AgentStage, failedStage?: AgentStage | null): AgentStage {
  const effectiveStage = stage === "FAILED" ? failedStage || "BUILD_PROMPTS" : stage;
  if (effectiveStage === "COMPLETED") throw new Error("AGENT_RUN_ALREADY_COMPLETED");
  if (effectiveStage === "NEXT_EPISODE") return "NEXT_EPISODE";
  if (PRE_PROMPT_STAGES.has(effectiveStage)) return effectiveStage;
  return "BUILD_PROMPTS";
}

function normalizedSourceIds(segment: RenderSegment) {
  return [...(segment.sourceSegmentIds || [])].sort().join(",");
}

export function sameRenderSegment(left: RenderSegment | undefined, right: RenderSegment | undefined) {
  if (!left || !right) return false;
  return left.order === right.order
    && Math.abs(left.start - right.start) < 0.0001
    && Math.abs(left.end - right.end) < 0.0001
    && normalizedSourceIds(left) === normalizedSourceIds(right);
}

/**
 * A completed/in-flight provider output can only be reused when the new model plan
 * keeps exactly the same ordered time range. This prevents an old 0-8s clip from
 * being mistaken for a new 0-10s segment after switching providers.
 */
export function compatibleRenderOrders(previousPlan: RenderSegment[], nextPlan: RenderSegment[]) {
  const nextByOrder = new Map(nextPlan.map((segment) => [segment.order, segment]));
  return new Set(
    previousPlan
      .filter((segment) => sameRenderSegment(segment, nextByOrder.get(segment.order)))
      .map((segment) => segment.order),
  );
}
