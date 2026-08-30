import { z } from "zod";
import type { AgentStage } from "@/lib/agent/types";

export const AGENT_ROLE_KEYS = [
  "AI_PRODUCER",
  "STORY_ARCHITECT",
  "SCRIPT_WRITER",
  "SCRIPT_EDITOR",
  "AI_DIRECTOR",
  "CINEMATOGRAPHER",
  "PROMPT_COMPOSER",
  "STORYBOARD_ARTIST",
  "RENDER_OPERATOR",
  "CONTINUITY_SUPERVISOR",
  "POST_PRODUCTION_SUPERVISOR",
  "QUALITY_CONTROLLER",
] as const;

export type AgentRoleKey = (typeof AGENT_ROLE_KEYS)[number];
export type AgentTaskStatus = "PENDING" | "READY" | "RUNNING" | "WAITING_REVIEW" | "WAITING_USER" | "COMPLETED" | "RETURNED" | "FAILED" | "CANCELLED";
export type AgentArtifactStatus = "DRAFT" | "APPROVED" | "SUPERSEDED" | "REJECTED";
export type AgentReviewVerdict = "PASS" | "REVISE" | "BLOCKED";

export const ARTIFACT_TYPES = [
  "PRODUCTION_PLAN",
  "STORY_PLAN",
  "SCRIPT_DRAFT",
  "SCRIPT_REVIEW",
  "DIRECTOR_PLAN",
  "SHOT_LIST",
  "STYLE_DECISION",
  "PROMPT_BUNDLE",
  "STORYBOARD_MANIFEST",
  "RENDER_CLIP",
  "RENDER_MANIFEST",
  "CONTINUITY_REPORT",
  "POST_PRODUCTION_MANIFEST",
  "FINAL_QUALITY_REPORT",
  "EPISODE_HANDOFF",
] as const;

export type AgentArtifactType = (typeof ARTIFACT_TYPES)[number];

export type AgentDefinitionSeed = {
  key: AgentRoleKey;
  nameTh: string;
  nameEn: string;
  description: string;
  modelTier: "fast" | "balanced" | "premium";
  inputTypes: AgentArtifactType[];
  outputType: AgentArtifactType;
  tools: string[];
};

export const CORE_AGENT_DEFINITIONS: AgentDefinitionSeed[] = [
  { key: "AI_PRODUCER", nameTh: "ผู้อำนวยการสร้าง AI", nameEn: "AI Producer", description: "แยกเป้าหมายเป็นแผนผลิต คุมขอบเขต งบ ล็อก และจุดอนุมัติ", modelTier: "premium", inputTypes: [], outputType: "PRODUCTION_PLAN", tools: ["plan_episode", "request_approval", "pause_run"] },
  { key: "STORY_ARCHITECT", nameTh: "นักวางโครงเรื่อง", nameEn: "Story Architect", description: "วางธีม โครงเรื่อง จังหวะ และเส้นเรื่องตัวละครโดยรักษา Canon", modelTier: "premium", inputTypes: ["PRODUCTION_PLAN"], outputType: "STORY_PLAN", tools: ["plan_episode", "pause_run"] },
  { key: "SCRIPT_WRITER", nameTh: "นักเขียนบท", nameEn: "Script Writer", description: "แปลง Story Plan เป็นบท ฉาก การกระทำ และบทสนทนา", modelTier: "premium", inputTypes: ["STORY_PLAN"], outputType: "SCRIPT_DRAFT", tools: ["plan_episode", "pause_run"] },
  { key: "SCRIPT_EDITOR", nameTh: "บรรณาธิการบท", nameEn: "Script Editor", description: "ตรวจความสมเหตุผล จังหวะ ความต่อเนื่อง และระบุสิ่งที่ต้องแก้", modelTier: "balanced", inputTypes: ["SCRIPT_DRAFT"], outputType: "SCRIPT_REVIEW", tools: ["plan_episode", "pause_run"] },
  { key: "AI_DIRECTOR", nameTh: "ผู้กำกับ AI", nameEn: "AI Director", description: "กำหนดเป้าหมายอารมณ์ การแสดง จังหวะ และวิธีเล่าแต่ละฉาก", modelTier: "premium", inputTypes: ["SCRIPT_DRAFT", "SCRIPT_REVIEW"], outputType: "DIRECTOR_PLAN", tools: ["plan_episode", "pause_run"] },
  { key: "CINEMATOGRAPHER", nameTh: "ผู้กำกับภาพ", nameEn: "Cinematographer", description: "ออกแบบ Shot, Lens, Framing, Camera Movement และ Lighting", modelTier: "balanced", inputTypes: ["DIRECTOR_PLAN"], outputType: "SHOT_LIST", tools: ["select_style", "pause_run"] },
  { key: "PROMPT_COMPOSER", nameTh: "ผู้ออกแบบพรอมป์", nameEn: "Prompt Composer", description: "แปลงแผนภาพเป็น Prompt กลางโดยไม่แก้ User Lock", modelTier: "balanced", inputTypes: ["SHOT_LIST", "STYLE_DECISION"], outputType: "PROMPT_BUNDLE", tools: ["improve_prompt", "request_approval", "pause_run"] },
  { key: "STORYBOARD_ARTIST", nameTh: "นักออกแบบสตอรี่บอร์ด", nameEn: "Storyboard Artist", description: "จัดเฟรมอ้างอิงและรายการ Storyboard ก่อนเริ่มเรนเดอร์จริง", modelTier: "fast", inputTypes: ["PROMPT_BUNDLE", "SHOT_LIST"], outputType: "STORYBOARD_MANIFEST", tools: ["request_approval", "pause_run"] },
  { key: "RENDER_OPERATOR", nameTh: "ผู้ควบคุมการเรนเดอร์", nameEn: "Render Operator", description: "เรียก Provider ตาม Prompt ที่ล็อกแล้ว พร้อม Budget, Retry และ Reservation Guard", modelTier: "fast", inputTypes: ["PROMPT_BUNDLE", "STORYBOARD_MANIFEST"], outputType: "RENDER_MANIFEST", tools: ["generate_video", "switch_provider", "pause_run"] },
  { key: "CONTINUITY_SUPERVISOR", nameTh: "ผู้ควบคุมความต่อเนื่อง", nameEn: "Continuity Supervisor", description: "ตรวจตัวละคร Canon สถานที่ อุปกรณ์ กล้อง แสง และผลลัพธ์ข้าม Shot", modelTier: "fast", inputTypes: ["RENDER_MANIFEST", "SHOT_LIST"], outputType: "CONTINUITY_REPORT", tools: ["verify_continuity", "pause_run"] },
  { key: "POST_PRODUCTION_SUPERVISOR", nameTh: "ผู้ควบคุมหลังการผลิต", nameEn: "Post-production Supervisor", description: "จัดลำดับภาพ เสียง การเปลี่ยนฉาก และรายการงานหลังการผลิต", modelTier: "balanced", inputTypes: ["RENDER_MANIFEST", "CONTINUITY_REPORT"], outputType: "POST_PRODUCTION_MANIFEST", tools: ["pause_run"] },
  { key: "QUALITY_CONTROLLER", nameTh: "ผู้ตรวจคุณภาพ", nameEn: "Quality Controller", description: "ตรวจความครบถ้วน ความละเอียด ระยะเวลา เสียง และเงื่อนไขก่อนส่งมอบ", modelTier: "fast", inputTypes: ["POST_PRODUCTION_MANIFEST", "CONTINUITY_REPORT"], outputType: "FINAL_QUALITY_REPORT", tools: ["verify_continuity", "pause_run"] },
];

export type WorkflowTaskSpec = {
  stage: AgentStage;
  agentKey: AgentRoleKey;
  artifactType: AgentArtifactType;
  labelTh: string;
  requiresHumanApproval?: boolean;
};

export const FILM_WORKFLOW_TASKS: WorkflowTaskSpec[] = [
  { stage: "PLAN_STORY", agentKey: "AI_PRODUCER", artifactType: "PRODUCTION_PLAN", labelTh: "วางแผนการผลิต" },
  { stage: "STORY_ARCHITECT", agentKey: "STORY_ARCHITECT", artifactType: "STORY_PLAN", labelTh: "วางโครงเรื่อง" },
  { stage: "SCRIPT_WRITE", agentKey: "SCRIPT_WRITER", artifactType: "SCRIPT_DRAFT", labelTh: "เขียนบท" },
  { stage: "SCRIPT_EDIT", agentKey: "SCRIPT_EDITOR", artifactType: "SCRIPT_REVIEW", labelTh: "ตรวจและล็อกบท" },
  { stage: "DIRECT_SCENES", agentKey: "AI_DIRECTOR", artifactType: "DIRECTOR_PLAN", labelTh: "กำกับฉาก" },
  { stage: "PLAN_CINEMATOGRAPHY", agentKey: "CINEMATOGRAPHER", artifactType: "SHOT_LIST", labelTh: "ออกแบบภาพและกล้อง" },
  { stage: "SELECT_STYLE", agentKey: "AI_PRODUCER", artifactType: "STYLE_DECISION", labelTh: "ยืนยันสไตล์" },
  { stage: "BUILD_PROMPTS", agentKey: "PROMPT_COMPOSER", artifactType: "PROMPT_BUNDLE", labelTh: "สร้าง Production Prompt" },
  { stage: "STORYBOARD", agentKey: "STORYBOARD_ARTIST", artifactType: "STORYBOARD_MANIFEST", labelTh: "เตรียม Storyboard", requiresHumanApproval: true },
  { stage: "GENERATE", agentKey: "RENDER_OPERATOR", artifactType: "RENDER_MANIFEST", labelTh: "เรนเดอร์วิดีโอ" },
  { stage: "VERIFY_CONTINUITY", agentKey: "CONTINUITY_SUPERVISOR", artifactType: "CONTINUITY_REPORT", labelTh: "ตรวจความต่อเนื่อง" },
  { stage: "POST_PRODUCTION", agentKey: "POST_PRODUCTION_SUPERVISOR", artifactType: "POST_PRODUCTION_MANIFEST", labelTh: "จัดแผนหลังการผลิต" },
  { stage: "FINAL_QUALITY", agentKey: "QUALITY_CONTROLLER", artifactType: "FINAL_QUALITY_REPORT", labelTh: "ตรวจคุณภาพสุดท้าย" },
  { stage: "NEXT_EPISODE", agentKey: "AI_PRODUCER", artifactType: "EPISODE_HANDOFF", labelTh: "ส่งมอบตอนและวางตอนถัดไป" },
];

export const agentArtifactSchema = z.object({
  summary: z.string().min(1).max(2000),
  verdict: z.enum(["PASS", "REVISE", "BLOCKED"]).default("PASS"),
  confidence: z.number().int().min(0).max(100).default(80),
  decisions: z.array(z.string()).max(50).default([]),
  issues: z.array(z.string()).max(50).default([]),
  payload: z.record(z.unknown()).default({}),
});

export type AgentArtifactPayload = z.infer<typeof agentArtifactSchema>;

export const handoffEnvelopeSchema = z.object({
  runId: z.string().min(1),
  workflowId: z.string().min(1),
  fromTaskId: z.string().min(1),
  toTaskId: z.string().min(1),
  artifactId: z.string().min(1),
  artifactType: z.enum(ARTIFACT_TYPES),
  artifactVersion: z.number().int().positive(),
  scopeKey: z.string().min(1),
  constraints: z.record(z.unknown()).default({}),
  contractVersion: z.number().int().positive().default(1),
});

export type HandoffEnvelope = z.infer<typeof handoffEnvelopeSchema>;

export function workflowTaskSpec(stage: string) {
  return FILM_WORKFLOW_TASKS.find((item) => item.stage === stage) || null;
}

export function episodeScopeKey(episodeIndex: number) {
  return `episode:${Math.max(0, Math.floor(episodeIndex))}`;
}

export function filmWorkflowDefinition() {
  return {
    key: "SCENOVA_FILM_PRODUCTION",
    version: 1,
    execution: "PRODUCER_CONTROLLED_DAG",
    tasks: FILM_WORKFLOW_TASKS.map((task, index) => ({ ...task, sequence: index + 1 })),
    rules: {
      singleOwnerPerArtifact: true,
      immutableArtifactVersions: true,
      boundedRetries: true,
      humanApprovalBeforePaidRender: true,
      canonicalMemoryRequiresApproval: true,
    },
  };
}
