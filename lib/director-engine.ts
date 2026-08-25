import { DIRECTOR_PRESETS } from "@/lib/director-presets";
import type { CameraShot, TimelineSegment } from "@/lib/domain";

export function applyDirectorPreset(segment: TimelineSegment, presetId: string): TimelineSegment {
  const preset = DIRECTOR_PRESETS.find((item) => item.id === presetId);
  if (!preset) throw new Error("Director preset not found");
  const duration = segment.end - segment.start;
  let cursor = segment.start;

  const cameraShots: CameraShot[] = preset.shotSequence.map((template, index) => {
    const isLast = index === preset.shotSequence.length - 1;
    const length = duration * template.weight;
    const end = isLast ? segment.end : Number((cursor + length).toFixed(2));
    const shot: CameraShot = {
      id: `${segment.id}-${preset.id}-${index + 1}`,
      start: Number(cursor.toFixed(2)),
      end,
      shotType: template.shotType,
      angle: template.angle,
      lensMm: template.lensMm,
      cameraHeight: template.angle.includes("Low") ? "ระดับต่ำตาม Preset — ปรับได้" : "ระดับสายตา — ปรับได้",
      movement: template.movement,
      movementSpeed: preset.category === "action" ? "dynamic but readable" : "restrained",
      focus: "ตัวละคร/วัตถุสำคัญตามเหตุการณ์",
      depthOfField: template.shotType.includes("Close") ? "Shallow" : "Medium to Deep",
      composition: "รักษา screen direction, subject readability และ continuity ตาม Director Preset",
      foregroundOcclusion: preset.category === "horror" ? "ใช้ foreground บังบางส่วนเมื่อเหมาะสม" : "ใช้เมื่อช่วยการเล่าเรื่อง",
    };
    cursor = end;
    return shot;
  });

  return {
    ...segment,
    action: `${segment.action}\nDirector motion guidance: ${preset.motionGuidance}`,
    lighting: `${segment.lighting}\nDirector lighting guidance: ${preset.lightingGuidance}`,
    cameraShots,
  };
}
