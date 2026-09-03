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

type ProjectRenderCapabilities = Project & {
  renderCapabilities?: { supportsMultiShot?: boolean };
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

function fixedRanges(total: number, maxSeconds: number) {
  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < total; start += maxSeconds) ranges.push({ start, end: Math.min(total, start + maxSeconds) });
  return ranges;
}

function shotAwareRanges(episode: Episode, maxSeconds: number) {
  const shots = episode.segments
    .flatMap((scene) => scene.cameraShots.map((shot) => ({ start: Math.max(scene.start, shot.start), end: Math.min(scene.end, shot.end) })))
    .filter((shot) => shot.end - shot.start > 0.35)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (!shots.length) return fixedRanges(Number(episode.duration) || 1, maxSeconds);

  const ranges: Array<{ start: number; end: number }> = [];
  for (const shot of shots) {
    for (let start = shot.start; start < shot.end - 0.01; start += maxSeconds) {
      ranges.push({ start: Number(start.toFixed(3)), end: Number(Math.min(shot.end, start + maxSeconds).toFixed(3)) });
    }
  }
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && Math.abs(previous.end - range.start) < 0.02 && range.end - previous.start <= maxSeconds && range.end - range.start < 0.5) {
      previous.end = range.end;
    } else merged.push({ ...range });
  }
  return merged;
}

function projectSupportsMultiShot(project: Project, explicit: boolean | undefined) {
  if (typeof explicit === "boolean") return explicit;
  const carried = (project as ProjectRenderCapabilities).renderCapabilities?.supportsMultiShot;
  return typeof carried === "boolean" ? carried : true;
}

export function planDirectRenderWindows(
  project: Project,
  maxSeconds: number,
  options: { supportsMultiShot?: boolean } = {},
): DirectRenderWindow[] {
  const sourceEpisode = project.episodes[0];
  if (!sourceEpisode) return [];
  const total = Math.max(1, Number(sourceEpisode.duration) || 1);
  const safeMax = Math.max(1, Number(maxSeconds) || total);
  const supportsMultiShot = projectSupportsMultiShot(project, options.supportsMultiShot);
  const ranges = supportsMultiShot ? fixedRanges(total, safeMax) : shotAwareRanges(sourceEpisode, safeMax);
  const windows: DirectRenderWindow[] = [];

  ranges.forEach(({ start, end }, index) => {
    const order = index + 1;
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
        `DIRECT GENERATION WINDOW ${order}: global ${start.toFixed(1)}-${end.toFixed(1)}s. The provider receives this window as one video generation request. Timeline values inside the window are local from 0.0s to ${duration.toFixed(1)}s.`,
        supportsMultiShot
          ? "MULTI-SHOT CAPABLE WINDOW: preserve the planned internal editorial cuts and reusable camera slots inside this request."
          : "SINGLE-SHOT PROVIDER WINDOW: this request represents one editorial camera shot (or a technical split of one long shot). Do not invent additional cuts inside this generated clip.",
        order > 1 ? "CONTINUITY FROM PREVIOUS WINDOW: preserve exact identity, wardrobe, props, location geometry, screen direction, lighting logic and emotional/action state from the previous generated window." : "",
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
  });
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
  const definition = input.provider.getModelDefinition();
  const maxSeconds = directMaxSecondsForProvider(input.provider, input.modelVersionId || input.project.mainModelVersionId);
  const windows = planDirectRenderWindows(input.project, maxSeconds, { supportsMultiShot: definition.supportsMultiShot });
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
    providerName: definition.provider,
    billingMode: input.provider.billingMode || "SYSTEM",
    maxSecondsPerGeneration: maxSeconds,
    supportsMultiShot: definition.supportsMultiShot,
    editorialShotCount: input.project.episodes[0]?.segments.reduce((sum, scene) => sum + scene.cameraShots.length, 0) || 0,
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
