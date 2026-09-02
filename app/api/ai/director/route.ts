import { randomInt } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth-core";
import { analyzeProductionPromptUniversal } from "@/lib/analyzer/runtime";
import {
  buildAiDirectorPlan,
  type AiDirectorHistoryEntry,
  type AiDirectorScene,
  type ManualAiSections,
} from "@/lib/ai-director";

export const runtime = "nodejs";

const manualSchema = z.object({
  blocking: z.boolean(),
  camera: z.boolean(),
  look: z.boolean(),
  sound: z.boolean(),
  continuity: z.boolean(),
}).strict();

const castSchema = z.object({
  id: z.string().min(1).max(300),
  name: z.string().min(1).max(300),
  role: z.string().max(300),
  appearance: z.string().max(10_000).optional(),
  voice: z.string().max(1000).optional(),
}).strict();

const historySchema = z.object({
  fingerprint: z.string().max(2000),
  profile: z.string().max(100),
  fields: z.record(z.unknown()),
  createdAt: z.number().finite(),
}).strict();

const requestSchema = z.object({
  mode: z.enum(["production", "cinematic", "story", "realistic", "emotion", "surprise"]).default("production"),
  novelty: z.enum(["safe", "balanced", "different", "experimental"]).default("balanced"),
  scope: z.enum(["all", "story", "camera", "look", "sound", "continuity"]).default("all"),
  episodeTitle: z.string().max(500).default("Untitled Episode"),
  story: z.string().max(50_000).default(""),
  model: z.string().min(1).max(200),
  modelVersion: z.string().max(300).optional(),
  aspect: z.string().min(1).max(100),
  visualStyle: z.string().max(500),
  locks: z.array(z.string().max(200)).max(30),
  totalDuration: z.number().int().min(1).max(180),
  sceneIndex: z.number().int().min(0).max(179),
  sceneCount: z.number().int().min(1).max(180),
  currentScene: z.record(z.unknown()),
  previousScene: z.record(z.unknown()).nullable().optional(),
  nextScene: z.record(z.unknown()).nullable().optional(),
  cast: z.array(castSchema).max(8),
  manualSections: manualSchema,
  history: z.array(historySchema).max(20).default([]),
  billingMode: z.enum(["AUTO", "BYOK", "SYSTEM"]).optional(),
  provider: z.enum(["inception", "groq", "openrouter", "gemini"]).optional(),
}).strict();

function analyzerPrompt(input: z.infer<typeof requestSchema>) {
  const sceneNumber = input.sceneIndex + 1;
  const spokenBudget = Math.max(0.5, Number(((Number((input.currentScene as { duration?: unknown }).duration) || 6) * 0.72).toFixed(1)));
  const scopeCopy: Record<string, string> = {
    all: "จัดทั้ง Scene เป็นระบบเดียวกัน",
    story: "คิดเฉพาะเหตุการณ์ เป้าหมาย Beat ตัวละคร Action และบทพูด",
    camera: "วิเคราะห์เหตุการณ์เพื่อเลือกภาษากล้องที่เหมาะสม โดยไม่แก้ส่วน Manual",
    look: "วิเคราะห์อารมณ์เพื่อเลือกแสง สี และ Performance โดยไม่แก้ส่วน Manual",
    sound: "วิเคราะห์สถานที่และ Action เพื่อออกแบบ Ambience, SFX และ Music โดยไม่แก้ส่วน Manual",
    continuity: "ตรวจ Continuity และ Negative Prompt โดยไม่แก้ส่วน Manual",
  };
  return [
    "ทำหน้าที่เป็น AI Director semantic pass สำหรับ SCENOVA",
    scopeCopy[input.scope],
    "Scene " + sceneNumber + "/" + input.sceneCount + " ของตอน " + input.episodeTitle,
    "เนื้อเรื่องหลัก: " + (input.story.trim() || String((input.currentScene as { action?: unknown }).action || "")),
    "ให้คำแนะนำที่เป็นเหตุเป็นผลตาม Scene ก่อนหน้า/ถัดไปและ visual arc ของทั้งตอน",
    "ใช้ชื่อเฉพาะ Cast ที่ส่งให้เท่านั้น ห้ามสร้างตัวละครใหม่",
    "บทพูดทั้งหมดควรพูดได้ภายในประมาณ " + spokenBudget + " วินาที เพื่อเหลือเวลาให้ Action และ Reaction",
    "ค่าที่ Lock หรือ Manual ใน context เป็นข้อบังคับ ห้ามเสนอการเปลี่ยนอัตลักษณ์ เสียง สไตล์ สถานที่ที่ล็อก หรือข้อมูล Canon",
    "หลีกเลี่ยงการทำ Camera/Lens/Movement/Lighting combination ซ้ำกับ recent history ถ้ายังมีทางเลือกที่เหมาะสมกว่า",
  ].join("\n");
}

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten() }, { status: 400 });

  const input = parsed.data;
  if (!input.story.trim() && !String((input.currentScene as { action?: unknown }).action || "").trim()) {
    return NextResponse.json({ error: "AI_DIRECTOR_SOURCE_REQUIRED" }, { status: 400 });
  }

  try {
    const analyzer = await analyzeProductionPromptUniversal({
      userId: user.id,
      prompt: analyzerPrompt(input),
      context: {
        episodeTitle: input.episodeTitle,
        model: input.model,
        modelVersion: input.modelVersion,
        aspect: input.aspect,
        visualStyle: input.visualStyle,
        locks: input.locks,
        sceneIndex: input.sceneIndex,
        sceneCount: input.sceneCount,
        currentScene: input.currentScene,
        previousScene: input.previousScene || null,
        nextScene: input.nextScene || null,
        cast: input.cast,
        manualSections: input.manualSections,
        recentCreativeFingerprints: input.history.slice(-12).map((item) => item.fingerprint),
      },
      billingMode: input.billingMode,
      preferredProvider: input.provider,
    });

    const plan = buildAiDirectorPlan({
      mode: input.mode,
      novelty: input.novelty,
      scope: input.scope,
      seed: randomInt(1, 2_147_483_646),
      episodeTitle: input.episodeTitle,
      story: input.story,
      model: input.model,
      modelVersion: input.modelVersion,
      aspect: input.aspect,
      visualStyle: input.visualStyle,
      locks: input.locks,
      totalDuration: input.totalDuration,
      sceneIndex: input.sceneIndex,
      sceneCount: input.sceneCount,
      currentScene: input.currentScene as unknown as AiDirectorScene,
      previousScene: (input.previousScene || null) as unknown as AiDirectorScene | null,
      nextScene: (input.nextScene || null) as unknown as AiDirectorScene | null,
      cast: input.cast,
      manualSections: input.manualSections as ManualAiSections,
      history: input.history as unknown as AiDirectorHistoryEntry[],
      analysis: analyzer.analysis,
    });

    return NextResponse.json({
      ok: true,
      scene: plan.scene,
      meta: plan.meta,
      provider: analyzer.provider,
      modelId: analyzer.modelId,
      billingMode: analyzer.billingMode,
      usage: analyzer.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI_DIRECTOR_FAILED";
    const status = message === "INSUFFICIENT_CREDITS" ? 402
      : message.includes("429") || message.includes("RATE_LIMIT") ? 429
        : message.includes("401") || message.includes("403") || message.includes("API_KEY") || message.includes("CONNECTION_REQUIRED") ? 400
          : message.startsWith("EMERGENCY_") || message.startsWith("LLM_DISABLED") ? 503
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
