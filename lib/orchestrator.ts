import type { Project, PromptBundle } from "@/lib/domain";
import { buildPromptBundle } from "@/lib/prompt-engine";
import { planEpisodeRender } from "@/lib/render-planner";
import { createContinuitySnapshot, continuityPrompt } from "@/lib/continuity";
import { createPromptAssistant, type PromptAssistant } from "@/lib/providers/prompt-assistant";
import { getVideoProviderMap } from "@/lib/providers/provider-registry";
import type { VideoProvider } from "@/lib/providers/video-provider";
import type { WalletService } from "@/lib/wallet";
import { assertGenerationAllowed, type KillSwitchState } from "@/lib/security";

export type OrchestratorDependencies = {
  promptAssistant?: PromptAssistant;
  promptContext?: { userId?: string; runId?: string };
  providers?: Record<string, VideoProvider>;
  wallet?: WalletService;
  killSwitch?: KillSwitchState;
  hourlySpendThb?: number;
  dailySpendThb?: number;
};

export type PlannedGeneration = {
  projectId: string;
  episodeId: string;
  promptPreview: string;
  promptBundle: PromptBundle;
  jobs: Array<{
    order: number;
    start: number;
    end: number;
    modelId: string;
    estimatedCostThb: number;
    continuity: string | null;
  }>;
  estimatedTotalThb: number;
};

export async function planGeneration(project: Project, episodeIndex = 0, deps: OrchestratorDependencies = {}): Promise<PlannedGeneration> {
  const episode = project.episodes[episodeIndex];
  if (!episode) throw new Error("Episode not found");

  const assistant = deps.promptAssistant ?? createPromptAssistant(deps.promptContext);
  const basePrompt = buildPromptBundle(project, episode);
  const prompt = await assistant.improve({
    project,
    episode,
    base: basePrompt,
    mode: project.promptMode,
    targetModelId: project.mainModelId,
    userId: deps.promptContext?.userId,
    runId: deps.promptContext?.runId,
  });

  const renderPlan = planEpisodeRender(project, episode);
  const providers = deps.providers ?? getVideoProviderMap();
  const jobs: PlannedGeneration["jobs"] = [];
  let estimatedTotalThb = 0;

  for (const renderSegment of renderPlan) {
    const provider = providers[renderSegment.modelId] ?? providers[project.mainModelId] ?? providers["mock-seedance"];
    if (!provider) throw new Error(`VIDEO_PROVIDER_NOT_FOUND:${renderSegment.modelId}`);
    assertGenerationAllowed({
      killSwitch: deps.killSwitch ?? { globalGenerationDisabled: process.env.SCENOVA_GENERATION_KILL_SWITCH === "true", disabledProviderIds: [] },
      providerId: provider.id,
      hourlySpendThb: deps.hourlySpendThb ?? 0,
      dailySpendThb: deps.dailySpendThb ?? 0,
    });

    const source = episode.segments.find((segment) => renderSegment.sourceSegmentIds.includes(segment.id));
    const continuity = renderSegment.continuityFromPrevious && source
      ? continuityPrompt(createContinuitySnapshot(project, episode, source))
      : null;

    const estimate = await provider.estimateCost({
      projectId: project.id,
      episodeId: episode.id,
      renderSegment,
      prompt,
      resolution: project.resolution,
      aspectRatio: project.aspectRatio,
      imageReferences: [],
      videoReferences: [],
      audioReferences: [],
      idempotencyKey: `${project.id}:${episode.id}:${renderSegment.order}:estimate`,
    });

    estimatedTotalThb += estimate.estimatedAmount;
    jobs.push({
      order: renderSegment.order,
      start: renderSegment.start,
      end: renderSegment.end,
      modelId: renderSegment.modelId,
      estimatedCostThb: estimate.estimatedAmount,
      continuity,
    });
  }

  return {
    projectId: project.id,
    episodeId: episode.id,
    promptPreview: `${prompt.master}\n\n${prompt.episode}\n\n${prompt.negative}`,
    promptBundle: prompt,
    jobs,
    estimatedTotalThb: Number(estimatedTotalThb.toFixed(2)),
  };
}

/**
 * Synchronous generation stays disabled by design. Paid provider calls must go through AgentQueueJob + worker
 * so credit reservation, retry/recovery, approval, observability and crash-resume guarantees cannot be bypassed.
 */
export async function executeGeneration() {
  throw new Error("SYNCHRONOUS_GENERATION_DISABLED_USE_AGENT_QUEUE");
}
