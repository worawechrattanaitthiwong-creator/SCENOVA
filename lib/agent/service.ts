import type { Project } from "@/lib/domain";
import { assertEmergencyCapability } from "@/lib/emergency-security";
import { getAgentPolicy, normalizeRunBudget } from "@/lib/agent/policy";
import { countActiveAgentRunsForUser, createAgentRun, enqueueAgentStep, recordAgentDecision, saveAgentRun } from "@/lib/agent/store";

export async function startAgentRun(input: { userId: string; project: Project; episodeIndex?: number; maxEpisodes?: number; budgetThb?: number; mode?: string }) {
  await assertEmergencyCapability("agent");
  const policy = getAgentPolicy();
  const activeRuns = await countActiveAgentRunsForUser(input.userId);
  if (activeRuns >= policy.maxConcurrentRunsPerUser) throw new Error("AGENT_USER_CONCURRENCY_LIMIT");

  const episodeIndex = Math.max(0, Math.floor(input.episodeIndex || 0));
  if (!input.project?.episodes?.[episodeIndex]) throw new Error("AGENT_EPISODE_NOT_FOUND");

  const maxAvailable = Math.max(1, input.project.episodes.length - episodeIndex);
  const maxEpisodes = Math.min(policy.maxEpisodesPerRun, maxAvailable, Math.max(1, Math.floor(input.maxEpisodes || 1)));
  const run = await createAgentRun({
    userId: input.userId,
    mode: input.mode || "AUTONOMOUS_PRODUCTION",
    inputJson: { project: input.project, startEpisodeIndex: episodeIndex },
    budgetThb: normalizeRunBudget(input.budgetThb),
    approvalThresholdThb: policy.approvalThresholdThb,
    maxEpisodes,
  });

  run.stateJson = {
    currentEpisodeIndex: episodeIndex,
    startEpisodeIndex: episodeIndex,
    completedEpisodes: [],
    plannedCosts: {},
    providerSwitches: 0,
    selectedProviderId: null,
    generationAttempts: {},
  };
  await saveAgentRun(run);
  await recordAgentDecision({
    runId: run.id,
    stage: run.stage,
    action: "RUN_CREATED",
    reason: `สร้าง Agent Run สูงสุด ${maxEpisodes} Episode พร้อม hard budget ${run.budgetThb} THB`,
    metadata: {
      approvalThresholdThb: run.approvalThresholdThb,
      maxLlmCallsPerRun: policy.maxLlmCallsPerRun,
      maxLlmCallsPerClip: policy.maxLlmCallsPerClip,
      queueLeaseSeconds: policy.queueLeaseSeconds,
    },
  });
  await enqueueAgentStep(run.id, { reason: "initial", stage: run.stage, episodeIndex }, 0, policy.maxRetriesPerStep + 1, `${run.id}:${episodeIndex}:${run.stage}:initial`);
  return run;
}
