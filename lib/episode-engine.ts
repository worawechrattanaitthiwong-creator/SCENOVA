import type { CameraShot, DialogueBeat, Episode, EpisodeDuration, Project, TimelineSegment } from "@/lib/domain";

const makeCameraShot = (start: number, end: number, suffix: string): CameraShot => ({
  id: `shot-${suffix}`,
  start,
  end,
  shotType: "Wide Shot",
  angle: "Eye Level",
  lensMm: 35,
  cameraHeight: "ระดับสายตา",
  movement: "Static",
  movementSpeed: "ช้า",
  focus: "ตัวละครหลัก",
  depthOfField: "Medium",
  composition: "Rule of Thirds",
  foregroundOcclusion: "ไม่มี",
});

export function createTimelineSegments(duration: EpisodeDuration, segmentLength = 10): TimelineSegment[] {
  const result: TimelineSegment[] = [];
  let start = 0;
  let index = 1;

  while (start < duration) {
    const end = Math.min(duration, start + segmentLength);
    result.push({
      id: `seg-${Date.now()}-${index}`,
      start,
      end,
      title: `ช่วงที่ ${index}`,
      scene: "อธิบายเหตุการณ์ในช่วงเวลานี้",
      location: "กำหนดสถานที่",
      characterIds: [],
      action: "กำหนดการกระทำของตัวละคร",
      emotion: "ปกติ",
      lighting: "ใช้แสงตาม Project Style",
      sound: "กำหนดเสียงหรือบรรยากาศ",
      cameraShots: [makeCameraShot(start, end, `${Date.now()}-${index}-1`)],
      dialogue: [],
    });
    start = end;
    index += 1;
  }

  return result;
}

export function createNextEpisode(project: Project, options?: { duration?: EpisodeDuration; title?: string; synopsis?: string }): Episode {
  const last = project.episodes.at(-1);
  const number = (last?.number ?? 0) + 1;
  const duration = options?.duration ?? last?.duration ?? 30;

  return {
    id: `ep-${Date.now()}-${number}`,
    number,
    title: options?.title ?? `EP.${String(number).padStart(2, "0")}`,
    duration,
    synopsis: options?.synopsis ?? `ตอนต่อจาก EP.${String(number - 1).padStart(2, "0")} โดยยึด Project Bible, Canon และ End-of-Episode State เดิม`,
    status: "draft",
    segments: createTimelineSegments(duration),
  };
}

export function resizeEpisode(episode: Episode, newDuration: EpisodeDuration): Episode {
  if (episode.duration === newDuration) return episode;
  if (!episode.segments.length) return { ...episode, duration: newDuration, segments: createTimelineSegments(newDuration) };

  const ratio = newDuration / episode.duration;
  const segments = episode.segments.map((segment, segmentIndex) => {
    const start = Number((segment.start * ratio).toFixed(2));
    const end = segmentIndex === episode.segments.length - 1 ? newDuration : Number((segment.end * ratio).toFixed(2));
    const cameraShots = segment.cameraShots.map((shot, shotIndex) => ({
      ...shot,
      start: Number((shot.start * ratio).toFixed(2)),
      end: shotIndex === segment.cameraShots.length - 1 ? end : Number((shot.end * ratio).toFixed(2)),
    }));
    const dialogue = segment.dialogue.map((beat) => ({ ...beat, start: Number((beat.start * ratio).toFixed(2)), end: Number((beat.end * ratio).toFixed(2)) }));
    return { ...segment, start, end, cameraShots, dialogue };
  });

  return { ...episode, duration: newDuration, segments };
}

export function addTimelineSegment(episode: Episode, start: number, end: number): Episode {
  if (start < 0 || end <= start || end > episode.duration) throw new Error("ช่วงเวลาไม่ถูกต้อง");
  const overlap = episode.segments.some((segment) => start < segment.end && end > segment.start);
  if (overlap) throw new Error("ช่วงเวลาใหม่ทับกับ Segment ที่มีอยู่แล้ว");
  const segment = createTimelineSegments((end - start) as EpisodeDuration, end - start)[0];
  segment.id = `seg-${Date.now()}`;
  segment.start = start;
  segment.end = end;
  segment.cameraShots = [makeCameraShot(start, end, `${Date.now()}-custom`)];
  return { ...episode, segments: [...episode.segments, segment].sort((a, b) => a.start - b.start) };
}

export function addCameraShot(segment: TimelineSegment, input?: Partial<CameraShot>): TimelineSegment {
  const previous = segment.cameraShots.at(-1);
  const start = input?.start ?? previous?.end ?? segment.start;
  const end = input?.end ?? segment.end;
  if (end <= start || start < segment.start || end > segment.end) throw new Error("เวลาของ Camera Shot ต้องอยู่ภายใน Segment");
  const shot = { ...makeCameraShot(start, end, `${Date.now()}-${segment.cameraShots.length + 1}`), ...input };
  return { ...segment, cameraShots: [...segment.cameraShots, shot].sort((a, b) => a.start - b.start) };
}

export function addDialogueBeat(segment: TimelineSegment, input: Omit<DialogueBeat, "id">): TimelineSegment {
  if (input.start < segment.start || input.end > segment.end || input.end <= input.start) throw new Error("เวลาบทพูดต้องอยู่ภายใน Segment");
  const beat: DialogueBeat = { ...input, id: `dialogue-${Date.now()}-${segment.dialogue.length + 1}` };
  return { ...segment, dialogue: [...segment.dialogue, beat].sort((a, b) => a.start - b.start) };
}

export function validateTimeline(episode: Episode) {
  const errors: string[] = [];
  const sorted = [...episode.segments].sort((a, b) => a.start - b.start);
  if (sorted[0]?.start !== 0) errors.push("Timeline ต้องเริ่มที่ 0 วินาที");
  if (sorted.at(-1)?.end !== episode.duration) errors.push(`Timeline ต้องจบที่ ${episode.duration} วินาที`);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (current.start < previous.end) errors.push(`Segment ${index + 1} ทับกับ Segment ก่อนหน้า`);
    if (current.start > previous.end) errors.push(`มีช่องว่าง ${previous.end}-${current.start} วินาที`);
  }
  return { valid: errors.length === 0, errors };
}
