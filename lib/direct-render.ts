import type { Episode, Project, PromptBundle, RenderSegment, TimelineSegment } from "@/lib/domain";
import { buildPromptBundle } from "@/lib/prompt-engine";
import { createPromptAssistant } from "@/lib/providers/prompt-assistant";
import type { VideoProvider } from "@/lib/providers/video-provider";
import { getRunwayVideoModelProfile } from "@/lib/providers/runway-video-provider";
import { resolveVideoApiModelId } from "@/lib/video-model-versions";

export type DirectRenderWindow = {
  order: number;
  start: number;
  end: number;
  duration: number;
  sourceSceneIds: string[];
  renderSegment: RenderSegment;
  project: Project;
  episode: Episode;
};

export type DirectPromptSegment = {
  order: number;
  start: number;
  end: number;
  duration: number;
  sourceSceneIds: string[];
  renderSegment: RenderSegment;
  prompt: PromptBundle;
  copyText: string;
};

function clampRange(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clipSegmentToWindow(segment: TimelineSegment, windowStart: number, windowEnd: number): TimelineSegment | null {
  const overlapStart = Math.max(segment.start, windowStart);
  const overlapEnd = Math.min(segment.end, windowEnd);
  if (overlapEnd <= overlapStart) return null;

  const localStart = overlapStart - windowStart;
  const localEnd = overlapEnd - windowStart;
  const cameraShots = segment.cameraShots
    .map((shot) => {
      const start = Math.max(shot.start, overlapStart);
      const end = Math.min(shot.end, overlapEnd);
      if (end <= start) return null;
      return { ...shot, id: `${shot.id}:direct:${windowStart}`, start: start - windowStart, end: end - windowStart };
    })
    .filter((shot): shot is TimelineSegment["cameraShots"][number] => Boolean(shot));
  const dialogue = segment.dialogue
    .map((beat) => {
      const start = Math.max(beat.start, overlapStart);
      const end = Math.min(beat.end, overlapEnd);
      if (end <= start) return null;
      return { ...beat, id: `${beat.id}:direct:${windowStart}`, start: start - windowStart, end: end - windowStart };
    })
    .filter((beat): beat is TimelineSegment["dialogue"][number] => Boolean(beat));

  return {
    ...segment,
    id: `${segment.id}:direct:${windowStart}`,
    start: localStart,
    end: localEnd,
    cameraShots,
    dialogue,
  };
}

export function directMaxSecondsForProvider(provider: VideoProvider, modelVersionId?: string | null) {
  const definition = provider.getModelDefinition();
  if (provider.id === "runway") {
    const apiModelId = resolveVideoApiModelId("Runway", modelVersionId)
      || resolveVideoApiModelId("Seedance 2.5 (Runway)", modelVersionId)
      || resolveVideoApiModelId("Gemini Omni Flash 1.1 (Runway)", modelVersionId)
      || resolveVideoApiModelId("Aleph 2.0 (Runway)", modelVersionId)
      || resolveVideoApiModelId("Ruby HDR (Runway)", modelVersionId)
      || modelVersionId
      || "";
    const runwayProfile = getRunwayVideoModelProfile(apiModelId);
    if (runwayProfile) return runwayProfile.maxDuration;
  }
  return Math.max(1, Number(definition.maxSecondsPerGeneration) || 1);
}

export function planDirectRenderWindows(project: Project, maxSeconds: number): DirectRenderWindow[] {
  const sourceEpisode = project.episodes[0];
  if (!sourceEpisode) return [];
  const total = Math.max(1, Number(sourceEpisode.duration) || 1);
  const safeMax = Math.max(1, Number(maxSeconds) || total);
  const windows: DirectRenderWindow[] = [];

  for (let start = 0, order = 1; start < total; start += safeMax, order += 1) {
    const end = Math.min(total, start + safeMax);
    const clippedSegments = sourceEpisode.segments
      .map((segment) => clipSegmentToWindow(segment, start, end))
      .filter((segment): segment is TimelineSegment => Boolean(segment));
    const sourceSceneIds = sourceEpisode.segments
      .filter((segment) => segment.end > start && segment.start < end)
      .map((segment) => segment.id);
    const duration = Number((end - start).toFixed(3));
    const episode: Episode = {
      ...sourceEpisode,
      id: `${sourceEpisode.id}:direct:${order}`,
      duration: duration as Episode["duration"],
      segments: clippedSegments,
    };
    const segmentProject: Project = {
      ...project,
      id: `${project.id}:direct:${order}`,
      episodes: [episode],
      projectBible: [
        project.projectBible,
        `DIRECT GENERATION WINDOW ${order}: global ${start.toFixed(1)}-${end.toFixed(1)}s. The provider receives this window as one video generation request. Multiple scenes/shots inside this window belong to the same generated clip. Timeline values inside the window are local from 0.0s to ${duration.toFixed(1)}s.`,
        order > 1 ? "CONTINUITY FROM PREVIOUS WINDOW: preserve the exact final identity, wardrobe, props, spatial direction, lighting logic and emotional state from the previous generation window." : "",
      ].filter(Boolean).join("\n"),
    };
    windows.push({
      order,
      start,
      end,
      duration,
      sourceSceneIds,
      project: segmentProject,
      episode,
      renderSegment: {
        id: `${sourceEpisode.id}:direct-render:${order}`,
        episodeId: sourceEpisode.id,
        order,
        start,
        end,
        duration,
        modelId: project.mainModelId,
        sourceSegmentIds: sourceSceneIds,
        continuityFromPrevious: order > 1,
      },
    });
  }
  return windows;
}

function copyText(prompt: PromptBundle, window: Pick<DirectRenderWindow, "order" | "start" | "end" | "duration">) {
  return [
    `# SCENOVA DIRECT RENDER — GENERATION ${window.order}`,
    `GLOBAL RANGE: ${window.start.toFixed(1)}-${window.end.toFixed(1)}s`,
    `PROVIDER REQUEST DURATION: ${window.duration.toFixed(1)}s`,
    "",
    prompt.master,
    prompt.episode,
    prompt.shots.join("\n\n"),
    prompt.negative ? `NEGATIVE / AVOID:\n${prompt.negative}` : "",
  ].filter(Boolean).join("\n\n").trim();
}

export async function composeDirectPrompts(input: {
  userId: string;
  project: Project;
  provider: VideoProvider;
  modelVersionId?: string | null;
}) {
  const maxSeconds = directMaxSecondsForProvider(input.provider, input.modelVersionId || input.project.mainModelVersionId);
  const windows = planDirectRenderWindows(input.project, maxSeconds);
  const assistant = createPromptAssistant({ userId: input.userId });
  const segments: DirectPromptSegment[] = [];

  for (const window of windows) {
    const base = buildPromptBundle(window.project, window.episode);
    const prompt = await assistant.improve({
      project: window.project,
      episode: window.episode,
      base,
      mode: input.project.promptMode,
      targetModelId: input.modelVersionId || input.project.mainModelVersionId || input.project.mainModelId,
      userId: input.userId,
    });
    segments.push({
      order: window.order,
      start: window.start,
      end: window.end,
      duration: window.duration,
      sourceSceneIds: window.sourceSceneIds,
      renderSegment: window.renderSegment,
      prompt,
      copyText: copyText(prompt, window),
    });
  }

  return {
    providerId: input.provider.id,
    providerName: input.provider.getModelDefinition().provider,
    billingMode: input.provider.billingMode || "SYSTEM",
    maxSecondsPerGeneration: maxSeconds,
    composer: assistant.id,
    segments,
  };
}

export function collectDirectImageReferences(project: Project, sourceSceneIds: string[]) {
  const episode = project.episodes[0];
  if (!episode) return [];
  const characterIds = new Set(
    episode.segments
      .filter((segment) => sourceSceneIds.includes(segment.id))
      .flatMap((segment) => segment.characterIds),
  );
  return project.characters
    .filter((character) => characterIds.has(character.id))
    .flatMap((character) => character.references.map((reference) => reference.url || ""))
    .filter(Boolean);
}

export function directProgress(jobs: Array<{ status: string }>) {
  if (!jobs.length) return { status: "EMPTY", percent: 0 };
  const done = jobs.filter((job) => job.status === "COMPLETED").length;
  const failed = jobs.some((job) => job.status === "FAILED");
  const running = jobs.some((job) => ["SUBMITTING", "QUEUED", "GENERATING"].includes(job.status));
  return {
    status: failed ? "FAILED" : done === jobs.length ? "COMPLETED" : running ? "GENERATING" : "READY",
    percent: clampRange(Math.round((done / jobs.length) * 100), 0, 100),
  };
}
