import type { Episode, Project } from "@/lib/domain";
import { planEpisodeRender } from "@/lib/render-planner";

export type ContinuityIssue = {
  severity: "warning" | "error";
  category: "OUTPUT" | "CHARACTER" | "CANON" | "LOCATION" | "CAMERA" | "LIGHTING" | "TIMELINE";
  message: string;
  segmentId?: string;
};

export type ContinuityReport = {
  score: number;
  passed: boolean;
  checks: Record<string, boolean>;
  issues: ContinuityIssue[];
};

export function verifyProductionContinuity(input: { project: Project; episode: Episode; outputs: Array<Record<string, unknown>> }) : ContinuityReport {
  const { project, episode, outputs } = input;
  const issues: ContinuityIssue[] = [];
  const expected = planEpisodeRender(project, episode).length;
  const completedOutputs = outputs.filter((output) => String(output.status || "").toLowerCase() === "completed" || Boolean(output.outputUrl));

  if (completedOutputs.length < expected) issues.push({ severity: "error", category: "OUTPUT", message: `ผลลัพธ์วิดีโอครบ ${completedOutputs.length}/${expected} Render Segment` });

  if (project.locks.character) {
    for (const character of project.characters.filter((item) => item.lock)) {
      if (!character.appearance.trim()) issues.push({ severity: "error", category: "CHARACTER", message: `Character Lock ของ ${character.name} ไม่มี Appearance reference` });
      if (!character.outfit.trim()) issues.push({ severity: "warning", category: "CHARACTER", message: `Character Lock ของ ${character.name} ยังไม่มี Costume/Outfit specification` });
    }
  }

  if (project.locks.canon && project.canon.length === 0) issues.push({ severity: "warning", category: "CANON", message: "เปิด Canon Lock แต่ Project ยังไม่มี Canon Facts" });

  for (const segment of episode.segments) {
    if (segment.end <= segment.start) issues.push({ severity: "error", category: "TIMELINE", segmentId: segment.id, message: `${segment.title}: End time ต้องมากกว่า Start time` });
    if (project.locks.location && !segment.location.trim()) issues.push({ severity: "error", category: "LOCATION", segmentId: segment.id, message: `${segment.title}: Location Lock เปิดอยู่แต่ยังไม่ได้ระบุ Location` });
    if (project.locks.lighting && !segment.lighting.trim()) issues.push({ severity: "warning", category: "LIGHTING", segmentId: segment.id, message: `${segment.title}: Lighting Lock เปิดอยู่แต่ Lighting direction ว่าง` });
    if (project.locks.camera && segment.cameraShots.length === 0) issues.push({ severity: "warning", category: "CAMERA", segmentId: segment.id, message: `${segment.title}: Camera Lock เปิดอยู่แต่ยังไม่มี Camera Shot` });
    for (const shot of segment.cameraShots) {
      if (shot.end <= shot.start || shot.start < segment.start || shot.end > segment.end) issues.push({ severity: "error", category: "CAMERA", segmentId: segment.id, message: `${segment.title}: Camera Shot ${shot.id} มีช่วงเวลานอก Scene` });
      if (!shot.shotType || !shot.angle || !shot.movement) issues.push({ severity: "warning", category: "CAMERA", segmentId: segment.id, message: `${segment.title}: Camera Shot ${shot.id} ยังระบุ Shot/Angle/Movement ไม่ครบ` });
    }
  }

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const score = Math.max(0, Math.round(100 - errorCount * 20 - warningCount * 5));
  return {
    score,
    passed: errorCount === 0 && completedOutputs.length >= expected,
    checks: {
      outputsComplete: completedOutputs.length >= expected,
      characterLocksReady: !issues.some((issue) => issue.category === "CHARACTER" && issue.severity === "error"),
      canonReady: !issues.some((issue) => issue.category === "CANON" && issue.severity === "error"),
      locationsReady: !issues.some((issue) => issue.category === "LOCATION" && issue.severity === "error"),
      cameraTimelineValid: !issues.some((issue) => issue.category === "CAMERA" && issue.severity === "error"),
      timelineValid: !issues.some((issue) => issue.category === "TIMELINE" && issue.severity === "error"),
    },
    issues,
  };
}
