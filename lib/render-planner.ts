import { VIDEO_MODELS } from "@/lib/catalogs";
import type { Episode, ModelMode, Project, RenderSegment, TimelineSegment } from "@/lib/domain";

function modelForSegment(project: Project, segment: TimelineSegment) {
  if (project.modelMode === "single") return project.mainModelId;
  if (project.modelMode === "custom-hybrid") return segment.modelId ?? project.mainModelId;

  const hasMainCharacter = segment.characterIds.length > 0;
  if (hasMainCharacter) return project.mainModelId;
  return segment.modelId ?? project.mainModelId;
}

function sliceRange(start: number, end: number, maxLength: number) {
  const ranges: Array<[number, number]> = [];
  let cursor = start;
  while (cursor < end) {
    const next = Math.min(end, cursor + maxLength);
    ranges.push([cursor, next]);
    cursor = next;
  }
  return ranges;
}

export function planEpisodeRender(project: Project, episode: Episode): RenderSegment[] {
  const result: RenderSegment[] = [];
  let order = 1;

  for (const segment of episode.segments) {
    const modelId = modelForSegment(project, segment);
    const model = VIDEO_MODELS.find((item) => item.id === modelId) ?? VIDEO_MODELS[0];
    const maxLength = model.maxSecondsPerGeneration;

    for (const [start, end] of sliceRange(segment.start, segment.end, maxLength)) {
      result.push({
        id: `${episode.id}-render-${order}`,
        episodeId: episode.id,
        order,
        start,
        end,
        duration: Number((end - start).toFixed(2)),
        modelId,
        sourceSegmentIds: [segment.id],
        continuityFromPrevious: order > 1,
      });
      order += 1;
    }
  }

  return result;
}

export function explainModelMode(mode: ModelMode) {
  if (mode === "single") return "ใช้โมเดลเดียวตามที่เลือกและล็อกไว้ เหมาะกับงานที่ต้องการความต่อเนื่องสูง";
  if (mode === "safe-hybrid") return "ฉากที่มีตัวละครหลักจะใช้โมเดลหลัก ส่วน B-roll/ฉากเสี่ยงต่ำสามารถใช้โมเดลอื่นได้";
  return "ผู้ใช้กำหนดโมเดลได้เองรายช่วงหรือรายฉาก ระบบจะแจ้งความเสี่ยงต่อ Character Consistency";
}
