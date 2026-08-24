import type { Project } from "@/lib/domain";
import { buildPromptBundle } from "@/lib/prompt-engine";
import { planEpisodeRender } from "@/lib/render-planner";
import { createContinuitySnapshot, continuityPrompt } from "@/lib/continuity";
import { MockPromptAssistant, type PromptAssistant } from "@/lib/providers/prompt-assistant";
import { MockVideoProvider } from "@/lib/providers/mock-video-provider";
import type { VideoProvider } from "@/lib/providers/video-provider";
import type { WalletService } from "@/lib/wallet";
import { assertGenerationAllowed, type KillSwitchState } from "@/lib/security";

export type OrchestratorDependencies = {
  promptAssistant?: PromptAssistant;
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

  const assistant = deps.promptAssistant ?? new MockPromptAssistant();
  const basePrompt = buildPromptBundle(project, episode);
  const prompt = await assistant.improve({
    project,
    episode,
    base: basePrompt,
    mode: project.promptMode,
    targetModelId: project.mainModelId,
  });

  const renderPlan = planEpisodeRender(project, episode);
  const jobs: PlannedGeneration["jobs"] = [];
  let estimatedTotalThb = 0;

  for (const renderSegment of renderPlan) {
    const provider = deps.providers?.[renderSegment.modelId] ?? new MockVideoProvider();
    assertGenerationAllowed({
      killSwitch: deps.killSwitch ?? { globalGenerationDisabled: false, disabledProviderIds: [] },
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
    jobs,
    estimatedTotalThb: Number(estimatedTotalThb.toFixed(2)),
  };
}

/**
 * executeGeneration intentionally stays disabled until real Provider + Wallet + Queue are connected.
 * The production implementation must:
 * 1) calculate price on server
 * 2) reserve credits
 * 3) enqueue jobs
 * 4) call provider worker
 * 5) settle/refund from provider result
 * 6) persist output + last frame + continuity state
 */
export async function executeGeneration() {
  throw new Error("Real generation is intentionally disabled until Video API, queue and Wallet adapters are connected.");
}
