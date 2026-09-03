import { z } from "zod";

export const agentPlanTargetSchema = z.enum(["studio", "series"]);

export const agentPlanCharacterSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(120).default(""),
  appearance: z.string().max(4000).default(""),
  costume: z.string().max(3000).default(""),
  personality: z.string().max(3000).default(""),
  voice: z.string().max(500).default(""),
  referenceImages: z.array(z.string().url()).max(8).default([]),
});

export const agentPlanShotSchema = z.object({
  shotId: z.string().min(1).max(120),
  startSec: z.number().min(0).max(180).optional(),
  endSec: z.number().min(0).max(180).optional(),
  camera: z.string().max(500).default(""),
  angle: z.string().max(500).default(""),
  lens: z.string().max(200).default(""),
  movement: z.string().max(500).default(""),
  subject: z.string().max(300).default(""),
  action: z.string().max(3000).default(""),
  dialogue: z.string().max(3000).default(""),
});

export const agentPlanSceneSchema = z.object({
  sceneId: z.string().min(1).max(120),
  title: z.string().max(300).default(""),
  durationSec: z.number().int().min(1).max(180),
  location: z.string().max(1200).default(""),
  objective: z.string().max(1200).default(""),
  mood: z.string().max(800).default(""),
  action: z.string().max(5000).default(""),
  dialogue: z.string().max(5000).default(""),
  camera: z.string().max(500).default(""),
  angle: z.string().max(500).default(""),
  lens: z.string().max(200).default(""),
  movement: z.string().max(500).default(""),
  lighting: z.string().max(1200).default(""),
  sound: z.string().max(2000).default(""),
  negativePrompt: z.string().max(3000).default(""),
  characters: z.array(z.string().max(120)).max(30).default([]),
  shots: z.array(agentPlanShotSchema).max(50).default([]),
});

export const agentPlanContinuitySchema = z.object({
  continuityStart: z.string().max(6000).default(""),
  endingState: z.string().max(6000).default(""),
  lockedFields: z.array(z.string().max(120)).max(40).default([]),
});

export const agentPlanEpisodeSchema = z.object({
  episodeId: z.string().min(1).max(120),
  episodeNumber: z.number().int().min(1).max(999),
  title: z.string().min(1).max(300),
  synopsis: z.string().max(8000).default(""),
  durationSec: z.number().int().min(1).max(180),
  continuityStart: z.string().max(6000).default(""),
  endingState: z.string().max(6000).default(""),
  scenes: z.array(agentPlanSceneSchema).min(1).max(100),
});

export const agentStructuredPlanSchema = z.object({
  schemaVersion: z.literal("1.0"),
  target: agentPlanTargetSchema,
  sourceInstruction: z.string().max(20000).default(""),
  title: z.string().min(1).max(300),
  synopsis: z.string().max(10000).default(""),
  genre: z.string().max(300).default(""),
  tone: z.string().max(600).default(""),
  durationSec: z.number().int().min(1).max(180),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]).default("16:9"),
  visualStyle: z.string().max(1200).default(""),
  prompt: z.string().max(16000).default(""),
  negativePrompt: z.string().max(6000).default(""),
  seriesBible: z.string().max(20000).default(""),
  relationships: z.array(z.string().max(2000)).max(100).default([]),
  locations: z.array(z.string().max(2000)).max(100).default([]),
  props: z.array(z.string().max(2000)).max(100).default([]),
  characters: z.array(agentPlanCharacterSchema).max(50).default([]),
  scenes: z.array(agentPlanSceneSchema).max(100).default([]),
  episodes: z.array(agentPlanEpisodeSchema).max(100).default([]),
  continuity: agentPlanContinuitySchema.default({ continuityStart: "", endingState: "", lockedFields: [] }),
  warnings: z.array(z.string().max(3000)).max(100).default([]),
  suggestions: z.array(z.string().max(3000)).max(100).default([]),
}).superRefine((plan, ctx) => {
  if (plan.target === "studio" && plan.scenes.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scenes"], message: "Studio plan requires at least one scene" });
  }
  if (plan.target === "series" && plan.episodes.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["episodes"], message: "Series plan requires at least one episode" });
  }
});

export type AgentPlanTarget = z.infer<typeof agentPlanTargetSchema>;
export type AgentPlanCharacter = z.infer<typeof agentPlanCharacterSchema>;
export type AgentPlanShot = z.infer<typeof agentPlanShotSchema>;
export type AgentPlanScene = z.infer<typeof agentPlanSceneSchema>;
export type AgentPlanEpisode = z.infer<typeof agentPlanEpisodeSchema>;
export type AgentStructuredPlan = z.infer<typeof agentStructuredPlanSchema>;

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function addDeterministicPlanDiagnostics(plan: AgentStructuredPlan): AgentStructuredPlan {
  const warnings = [...plan.warnings];
  const suggestions = [...plan.suggestions];
  const characterNames = new Set(plan.characters.map((character) => character.name.trim()).filter(Boolean));
  const scenes = plan.target === "series" ? plan.episodes.flatMap((episode) => episode.scenes) : plan.scenes;

  for (const character of plan.characters) {
    if (!character.appearance.trim()) warnings.push(`ตัวละคร ${character.name} ยังไม่มี Appearance ที่ชัดเจน ควรตรวจสอบก่อนนำไปใช้`);
    if (!character.costume.trim()) suggestions.push(`ควรกำหนด Costume ของ ${character.name} เพื่อช่วยรักษาความต่อเนื่อง`);
  }

  for (const scene of scenes) {
    const unknown = scene.characters.filter((name) => name.trim() && !characterNames.has(name.trim()));
    if (unknown.length) warnings.push(`${scene.sceneId}: พบชื่อตัวละครที่ไม่มีใน Character Plan: ${unknown.join(", ")}`);
    if (!scene.location.trim()) warnings.push(`${scene.sceneId}: ยังไม่ได้ระบุ Location`);
    if (!scene.action.trim()) warnings.push(`${scene.sceneId}: ยังไม่ได้ระบุ Action`);
    if (!scene.camera.trim() && scene.shots.length === 0) suggestions.push(`${scene.sceneId}: ควรกำหนด Camera หรือ Shot อย่างน้อยหนึ่งรายการ`);
  }

  if (plan.target === "studio") {
    const sum = plan.scenes.reduce((total, scene) => total + scene.durationSec, 0);
    if (sum !== plan.durationSec) warnings.push(`เวลารวมของ Scene (${sum}s) ไม่เท่ากับความยาวตอน (${plan.durationSec}s) ระบบ Studio ต้องให้ผู้ใช้ตรวจเวลาอีกครั้ง`);
  } else {
    plan.episodes.forEach((episode, index) => {
      const sum = episode.scenes.reduce((total, scene) => total + scene.durationSec, 0);
      if (sum !== episode.durationSec) warnings.push(`Episode ${episode.episodeNumber}: เวลารวม Scene (${sum}s) ไม่เท่ากับความยาว Episode (${episode.durationSec}s)`);
      if (!episode.continuityStart.trim()) warnings.push(`Episode ${episode.episodeNumber}: Continuity Start ยังว่าง`);
      if (!episode.endingState.trim()) warnings.push(`Episode ${episode.episodeNumber}: Ending State ยังว่าง`);
      const next = plan.episodes[index + 1];
      if (next && episode.endingState.trim() && next.continuityStart.trim()) {
        const a = episode.endingState.trim().toLocaleLowerCase();
        const b = next.continuityStart.trim().toLocaleLowerCase();
        if (!b.includes(a.slice(0, Math.min(50, a.length))) && !a.includes(b.slice(0, Math.min(50, b.length)))) {
          suggestions.push(`ตรวจ Continuity ระหว่าง Episode ${episode.episodeNumber} Ending State กับ Episode ${next.episodeNumber} Continuity Start ก่อนนำไปใช้`);
        }
      }
    });
  }

  return { ...plan, warnings: unique(warnings), suggestions: unique(suggestions) };
}

export function planFieldMappings(plan: AgentStructuredPlan) {
  const base = [
    "title → ชื่อตอน / ชื่อ Series",
    "synopsis → เรื่อง/เหตุการณ์ หรือ Synopsis",
    "durationSec → ความยาว",
    "aspectRatio → อัตราส่วนภาพ",
    "visualStyle → สไตล์ภาพ / Style Lock",
    "prompt → Prompt หลัก (เก็บเป็น Master Prompt สำหรับ Direct Render)",
    "negativePrompt → Negative Prompt",
    "characters → ตัวละคร / Character Bible",
    "continuity.lockedFields → Locks",
  ];
  if (plan.target === "studio") {
    return [...base, "scenes → ฉาก, Shot, Dialogue, Camera, Lighting, Sound ใน AI Studio"];
  }
  return [
    ...base,
    "seriesBible → Series Bible / Canon context",
    "episodes[].continuityStart → Continuity Start",
    "episodes[].endingState → Ending State",
    "episodes[].scenes → Storyboard Scenes / Shots / Dialogue / Camera",
  ];
}
