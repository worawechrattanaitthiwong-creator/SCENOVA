import type { Episode, Project } from "@/lib/domain";
import type { AgentRunRecord } from "@/lib/agent/types";
import {
  CORE_AGENT_DEFINITIONS,
  agentArtifactSchema,
  type AgentArtifactPayload,
  type AgentRoleKey,
} from "@/lib/agent/contracts";
import { getWorkflowInputArtifacts } from "@/lib/agent/workflow-store";
import { callOpenAiFunction, type FunctionTool } from "@/lib/llm/openai-responses";
import { routeLlm, type LlmTier } from "@/lib/llm/model-router";

type RoleResult = {
  artifact: AgentArtifactPayload;
  source: "llm" | "deterministic";
  modelId?: string;
  costThb?: number;
};

const submitArtifactTool: FunctionTool = {
  type: "function",
  name: "submit_agent_artifact",
  description: "Submit the completed, structured production artifact for the next SCENOVA specialist.",
  parameters: {
    type: "object",
    properties: {
      summary: { type: "string" },
      verdict: { type: "string", enum: ["PASS", "REVISE", "BLOCKED"] },
      confidence: { type: "integer", minimum: 0, maximum: 100 },
      decisions: { type: "array", items: { type: "string" } },
      issues: { type: "array", items: { type: "string" } },
      payload: { type: "object", additionalProperties: true },
    },
    required: ["summary", "verdict", "confidence", "decisions", "issues", "payload"],
    additionalProperties: false,
  },
};

function scenePayload(episode: Episode) {
  return episode.segments.map((segment, index) => ({
    sceneNumber: index + 1,
    id: segment.id,
    title: segment.title,
    time: { start: segment.start, end: segment.end },
    location: segment.location,
    action: segment.action,
    emotion: segment.emotion,
    lighting: segment.lighting,
    sound: segment.sound,
    dialogue: segment.dialogue.map((beat) => ({ characterId: beat.characterId, text: beat.text, emotion: beat.emotion })),
  }));
}

function shotPayload(episode: Episode) {
  return episode.segments.flatMap((segment) => segment.cameraShots.map((shot, index) => ({
    segmentId: segment.id,
    shotNumber: index + 1,
    id: shot.id,
    start: shot.start,
    end: shot.end,
    shotType: shot.shotType,
    angle: shot.angle,
    lensMm: shot.lensMm,
    movement: shot.movement,
    focus: shot.focus,
    composition: shot.composition,
    lighting: segment.lighting,
  })));
}

export function deterministicRoleArtifact(role: AgentRoleKey, project: Project, episode: Episode): AgentArtifactPayload {
  const scenes = scenePayload(episode);
  const shots = shotPayload(episode);
  const common = { projectId: project.id, episodeId: episode.id, episodeNumber: episode.number };

  switch (role) {
    case "AI_PRODUCER":
      return { summary: `แผนผลิต ${episode.title} จำนวน ${scenes.length} ฉาก`, verdict: "PASS", confidence: 95, decisions: ["รักษา Project Bible และ User Lock ทุกชนิด", "ต้องผ่านการอนุมัติก่อนเริ่ม Paid Render"], issues: [], payload: { ...common, objective: episode.synopsis, workflow: ["story", "script", "direction", "cinematography", "prompt", "storyboard", "render", "continuity", "post", "quality"], constraints: { resolution: project.resolution, aspectRatio: project.aspectRatio, modelId: project.mainModelId, locks: project.locks } } };
    case "STORY_ARCHITECT":
      return { summary: `โครงเรื่อง ${episode.title} พร้อม ${scenes.length} Story Beats`, verdict: scenes.length ? "PASS" : "BLOCKED", confidence: scenes.length ? 90 : 20, decisions: ["ใช้ลำดับฉากจาก Episode เป็นโครงหลัก", "ไม่เพิ่ม Canon ที่ไม่ได้รับอนุมัติ"], issues: scenes.length ? [] : ["ไม่พบฉากใน Episode"], payload: { ...common, theme: project.mood, logline: episode.synopsis, beats: scenes.map((scene) => ({ sceneNumber: scene.sceneNumber, title: scene.title, action: scene.action, emotion: scene.emotion })) } };
    case "SCRIPT_WRITER":
      return { summary: `บทฉบับทำงาน ${scenes.length} ฉาก`, verdict: scenes.length ? "PASS" : "BLOCKED", confidence: 88, decisions: ["รักษาบทสนทนาและช่วงเวลาที่ผู้ใช้กำหนด"], issues: scenes.length ? [] : ["ไม่มีฉากสำหรับเขียนบท"], payload: { ...common, title: episode.title, synopsis: episode.synopsis, scenes } };
    case "SCRIPT_EDITOR": {
      const issues = scenes.filter((scene) => scene.time.end <= scene.time.start).map((scene) => `ช่วงเวลาฉาก ${scene.sceneNumber} ไม่ถูกต้อง`);
      return { summary: issues.length ? `พบบทที่ต้องแก้ ${issues.length} จุด` : "บทผ่านการตรวจโครงสร้างและพร้อมส่งผู้กำกับ", verdict: issues.length ? "REVISE" : "PASS", confidence: 92, decisions: ["ตรวจลำดับเวลา ฉาก และความครบถ้วนของ Action"], issues, payload: { ...common, score: Math.max(0, 100 - issues.length * 20), reviewedScenes: scenes.length } };
    }
    case "AI_DIRECTOR":
      return { summary: `แผนกำกับ ${scenes.length} ฉาก`, verdict: scenes.length ? "PASS" : "BLOCKED", confidence: 89, decisions: ["ใช้ Emotion และ Action เป็นแกนการกำกับ", "ไม่เปลี่ยน Character/Style Lock"], issues: [], payload: { ...common, scenes: scenes.map((scene) => ({ sceneNumber: scene.sceneNumber, objective: scene.action, performance: scene.emotion, pacing: scene.time.end - scene.time.start, soundDirection: scene.sound })) } };
    case "CINEMATOGRAPHER":
      return { summary: `Shot List จำนวน ${shots.length} ช็อต`, verdict: shots.length ? "PASS" : "REVISE", confidence: shots.length ? 94 : 50, decisions: ["ยึด Camera Lock และ Lighting ของแต่ละฉาก"], issues: shots.length ? [] : ["ยังไม่มี Camera Shot จึงต้องสร้าง Shot Plan ก่อนเรนเดอร์"], payload: { ...common, aspectRatio: project.aspectRatio, resolution: project.resolution, shots } };
    case "STORYBOARD_ARTIST":
      return { summary: `Storyboard Manifest จำนวน ${Math.max(shots.length, scenes.length)} เฟรม`, verdict: "PASS", confidence: 85, decisions: ["สร้างหนึ่ง Key Frame ต่อ Shot หรืออย่างน้อยหนึ่งเฟรมต่อฉาก", "Storyboard เป็นจุดตรวจ ไม่อนุญาตให้เปลี่ยน Canon"], issues: [], payload: { ...common, frames: (shots.length ? shots : scenes).map((item, index) => ({ order: index + 1, sourceId: "id" in item ? item.id : `scene-${index + 1}`, status: "PLANNED" })) } };
    case "POST_PRODUCTION_SUPERVISOR":
      return { summary: "แผนหลังการผลิตพร้อมตรวจภาพ เสียง และจังหวะตัดต่อ", verdict: "PASS", confidence: 82, decisions: ["เรียงคลิปตาม Timeline เดิม", "รักษาระยะเวลารวมของ Episode"], issues: [], payload: { ...common, timelineDurationSec: episode.duration, editOrder: episode.segments.map((segment, index) => ({ order: index + 1, segmentId: segment.id, start: segment.start, end: segment.end })), audioRequired: episode.segments.some((segment) => Boolean(segment.sound || segment.dialogue.length)) } };
    case "QUALITY_CONTROLLER":
      return { summary: "รายการตรวจคุณภาพสุดท้ายพร้อมใช้งาน", verdict: "PASS", confidence: 90, decisions: ["ตรวจ Resolution, Duration, Missing Output และ Continuity ก่อนส่งมอบ"], issues: [], payload: { ...common, checks: ["all-renders-completed", "duration-valid", "resolution-valid", "continuity-passed", "audio-plan-present"], expectedResolution: project.resolution, expectedDurationSec: episode.duration } };
    default:
      return { summary: `${role} ส่งมอบ Artifact ตามสัญญา`, verdict: "PASS", confidence: 80, decisions: [], issues: [], payload: common };
  }
}

function roleContext(input: {
  role: AgentRoleKey;
  run: AgentRunRecord;
  project: Project;
  episode: Episode;
  upstream: Array<{ type: string; version: number; summary: string; contentJson: unknown }>;
}) {
  return JSON.stringify({
    role: input.role,
    run: { id: input.run.id, budgetThb: input.run.budgetThb, estimatedSpendThb: input.run.estimatedSpendThb },
    project: { id: input.project.id, title: input.project.title, story: input.project.story.slice(0, 4000), genre: input.project.genre, mood: input.project.mood, projectBible: input.project.projectBible.slice(0, 5000), locks: input.project.locks, canon: input.project.canon.slice(0, 50), characters: input.project.characters.slice(0, 16) },
    episode: { id: input.episode.id, number: input.episode.number, title: input.episode.title, synopsis: input.episode.synopsis, duration: input.episode.duration, scenes: scenePayload(input.episode) },
    upstreamArtifacts: input.upstream.slice(-6).map((item) => ({ type: item.type, version: item.version, summary: item.summary, content: item.contentJson })),
  });
}

export async function executeRoleAgent(input: {
  role: AgentRoleKey;
  run: AgentRunRecord;
  project: Project;
  episode: Episode;
  episodeIndex: number;
  stage: string;
}): Promise<RoleResult> {
  const fallback = deterministicRoleArtifact(input.role, input.project, input.episode);
  if (process.env.SCENOVA_LLM_ENABLED !== "true" || !process.env.OPENAI_API_KEY) return { artifact: fallback, source: "deterministic" };

  const definition = CORE_AGENT_DEFINITIONS.find((agent) => agent.key === input.role);
  if (!definition) throw new Error(`AGENT_DEFINITION_NOT_FOUND:${input.role}`);
  const upstream = await getWorkflowInputArtifacts(input.run.id, input.episodeIndex, input.stage);
  const context = roleContext({ role: input.role, run: input.run, project: input.project, episode: input.episode, upstream });
  const route = routeLlm({ task: "AGENT_PLAN", contextChars: context.length, forceTier: definition.modelTier as LlmTier });
  const instructions = [
    `You are the ${definition.nameEn} in the SCENOVA film-production team.`,
    definition.description,
    "Work only inside your assigned role. Do not perform another specialist's task.",
    "Treat Project Bible, canon, user locks, budget and approved upstream artifacts as immutable constraints.",
    "Return exactly one submit_agent_artifact function call. Use concise Thai for summary, decisions and issues.",
    "Use REVISE only when an upstream specialist can fix the issue. Use BLOCKED only when production cannot safely continue.",
  ].join("\n");

  try {
    const response = await callOpenAiFunction({
      userId: input.run.userId,
      runId: input.run.id,
      category: `AGENT_ROLE_${input.role}`,
      referenceType: "episode",
      referenceId: input.episode.id,
      modelId: route.modelId,
      instructions,
      prompt: context,
      tools: [submitArtifactTool],
      maxOutputTokens: route.maxOutputTokens,
      metadata: { role: input.role, stage: input.stage, workflow: "SCENOVA_FILM_PRODUCTION", routerReason: route.reason },
    });
    if (response.name !== "submit_agent_artifact") return { artifact: fallback, source: "deterministic" };
    const parsed = agentArtifactSchema.safeParse(response.arguments);
    if (!parsed.success) return { artifact: fallback, source: "deterministic" };
    return { artifact: parsed.data, source: "llm", modelId: response.modelId, costThb: response.costThb };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("BUDGET_EXCEEDED") || message.includes("MAX_LLM_CALLS")) throw error;
    return { artifact: { ...fallback, issues: [...fallback.issues, `ใช้ deterministic fallback: ${message.slice(0, 120)}`] }, source: "deterministic" };
  }
}
