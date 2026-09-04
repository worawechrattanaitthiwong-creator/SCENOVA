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
  name: z.string().max(300),
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
  fillMode: z.enum(["replace-scope", "empty-only"]).default("replace-scope"),
  episodeTitle: z.string().max(500).default("Untitled Episode"),
  story: z.string().max(50_000).default(""),
  model: z.string().max(200).default(""),
  modelVersion: z.string().max(300).optional(),
  aspect: z.string().max(100).default(""),
  visualStyle: z.string().max(500).default(""),
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

type CastSuggestion = {
  id: string;
  name: string;
  role: string;
  appearance: string;
  voice: string;
  action: string;
  emotion: string;
  dialogue: string;
};

function normalizeCastName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[\s_\-—–/]+/g, " ");
}

function sourceSnippetForCharacter(story: string, sceneDescription: string, name: string, action: string) {
  const sources = [story, sceneDescription].filter(Boolean);
  const needle = normalizeCastName(name);
  for (const source of sources) {
    const sentences = source.split(/(?<=[.!?。！？])\s+|\n+/).map((item) => item.trim()).filter(Boolean);
    const match = sentences.find((sentence) => {
      const normalized = normalizeCastName(sentence);
      return needle && normalized.includes(needle);
    });
    if (match) return match.slice(0, 700);
  }
  const actionNeedle = normalizeCastName(action);
  if (actionNeedle) {
    const match = sources.find((source) => normalizeCastName(source).includes(actionNeedle));
    if (match) return match.slice(0, 700);
  }
  return sources.length === 1 ? sources[0].slice(0, 700) : "";
}

function inferVoiceProfile(name: string, source: string) {
  const text = normalizeCastName(name + " " + source);
  const senior = /\b(senior|elderly|old man|old woman|grandfather|grandmother)\b|ผู้สูงอายุ|ชายชรา|หญิงชรา|คุณตา|คุณยาย/.test(text);
  if (senior) return "Orin — ชาย Senior ลุ่มลึก น่าเชื่อถือ";
  const girl = /\b(girl|teen girl|young woman)\b|เด็กหญิง|วัยรุ่นหญิง|หญิงสาว/.test(text);
  if (girl) return /\bteen\b|วัยรุ่น/.test(text) ? "Lumi — Teen สดใส Coming-of-age" : "Nami — หญิง Young สดใส เป็นกันเอง";
  const boy = /\b(boy|teen boy|young man)\b|เด็กชาย|วัยรุ่นชาย|ชายหนุ่ม/.test(text);
  if (boy) return /\bteen\b|วัยรุ่น/.test(text) ? "Kai — Teen เป็นกันเอง มีพลัง" : "Noah — ชาย Young นุ่ม เป็นธรรมชาติ";
  const woman = /\b(woman|female|mother|wife)\b|ผู้หญิง|หญิง|แม่|ภรรยา/.test(text);
  if (woman) return "Mira — หญิง Adult อบอุ่น เป็นธรรมชาติ";
  const man = /\b(man|male|father|husband)\b|ผู้ชาย|ชาย|พ่อ|สามี/.test(text);
  if (man) return "Arin — ชาย Adult สุขุม ภาพยนตร์";
  return "";
}

function enrichCastForPlanning(
  cast: z.infer<typeof castSchema>[],
  analysis: { characters: Array<{ name: string; action: string; emotion: string; dialogue: string | null }>; scene: { description: string } },
  story: string,
) {
  const planCast = cast.map((item) => ({ ...item }));
  const used = new Set<string>();
  const suggestions: CastSuggestion[] = [];

  analysis.characters.slice(0, 8).forEach((character, index) => {
    const wanted = normalizeCastName(character.name);
    let slotIndex = planCast.findIndex((item) => {
      if (used.has(item.id) || !item.name.trim()) return false;
      const actual = normalizeCastName(item.name);
      return actual === wanted || (actual && wanted.includes(actual)) || (wanted && actual.includes(wanted));
    });
    if (slotIndex < 0) slotIndex = planCast.findIndex((item) => !used.has(item.id) && !item.name.trim());
    if (slotIndex < 0 && planCast.length < 8) {
      planCast.push({
        id: `ai-character-${randomInt(1, 2_147_483_646)}`,
        name: "",
        role: "",
        appearance: "",
        voice: "",
      });
      slotIndex = planCast.length - 1;
    }
    if (slotIndex < 0) return;

    const slot = planCast[slotIndex];
    used.add(slot.id);
    const name = slot.name.trim() || character.name.trim();
    if (!name) return;
    const source = sourceSnippetForCharacter(story, analysis.scene.description || "", name, character.action || "");
    const role = slot.role.trim() || (index === 0 ? "ตัวละครหลัก" : "ตัวละครรอง");
    const appearance = slot.appearance?.trim() || (source ? "รายละเอียดจากเนื้อเรื่อง: " + source : "");
    const voice = slot.voice?.trim() || inferVoiceProfile(name, source);

    planCast[slotIndex] = { ...slot, name, role, appearance, voice };
    suggestions.push({
      id: slot.id,
      name,
      role,
      appearance,
      voice,
      action: character.action?.trim() || "",
      emotion: character.emotion?.trim() || "",
      dialogue: character.dialogue?.trim() || "",
    });
  });

  return { planCast, suggestions };
}

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
  const previous = input.previousScene ? JSON.stringify(input.previousScene) : "ไม่มี (ฉากแรกหรือไม่ส่งข้อมูล)";
  const next = input.nextScene ? JSON.stringify(input.nextScene) : "ไม่มี (ฉากสุดท้ายหรือไม่ส่งข้อมูล)";
  const fillPolicy = input.fillMode === "empty-only"
    ? "โหมดเติมช่องว่าง: ค่าที่ผู้ใช้กรอกหรือเลือกไว้แล้วคือข้อเท็จจริง ห้ามเปลี่ยน ให้เสนอเฉพาะข้อมูลที่ยังว่าง"
    : "โหมดสร้างใหม่เฉพาะ Scope: สามารถเสนอค่าใหม่ใน Scope ที่ร้องขอได้ ยกเว้น Manual/Lock";
  return [
    "ทำหน้าที่เป็น AI Director semantic pass สำหรับ SCENOVA",
    scopeCopy[input.scope],
    fillPolicy,
    "Scene " + sceneNumber + "/" + input.sceneCount + " ของตอน " + input.episodeTitle,
    "เนื้อเรื่องหลัก: " + (input.story.trim() || String((input.currentScene as { action?: unknown }).action || "")),
    "ฉากก่อนหน้า: " + previous,
    "ฉากปัจจุบัน: " + JSON.stringify(input.currentScene),
    "ฉากถัดไป: " + next,
    "ลำดับความสำคัญ: (1) เหตุและผลของเนื้อเรื่องและแรงจูงใจตัวละคร (2) ความต่อเนื่องจากฉากก่อนและสิ่งที่ต้องส่งต่อไปฉากถัดไป (3) รักษาค่าที่ผู้ใช้เลือกแล้ว (4) Camera/Look/Sound ที่เสริมเรื่อง ไม่ใช่แย่งความสำคัญจากเรื่อง",
    "วิเคราะห์ฉากนี้เป็นสะพานเชิงเหตุผล: อะไรเกิดจากฉากก่อน → ฉากนี้เปลี่ยนอะไร → ฉากถัดไปต้องรับผลอะไร",
    "ตัวละคร: ยึด Cast ที่มีชื่ออยู่แล้วเป็นข้อเท็จจริง แต่ถ้ามีช่อง Cast ว่างและเนื้อเรื่อง/Action ระบุตัวละครชัดเจน ให้สกัดชื่อหรือคำเรียกตัวละครจากเนื้อเรื่องเพื่อเติมช่องว่างได้ ห้ามสร้างบุคคลที่เรื่องไม่ได้กล่าวถึง และถ้าเรื่องไม่มีตัวละครให้คืน characters เป็น []",
    "บทพูดทั้งหมดควรพูดได้ภายในประมาณ " + spokenBudget + " วินาที เพื่อเหลือเวลาให้ Action และ Reaction",
    input.fillMode === "empty-only"
      ? "ค่าที่มีอยู่แล้วใน Manual/Lock เป็นข้อบังคับและห้ามเปลี่ยน แต่ช่องที่ยังว่างใน Manual section สามารถวิเคราะห์และเสนอค่าเพื่อเติมได้"
      : "ค่าที่ Lock หรือ Manual ใน context เป็นข้อบังคับ ห้ามเสนอการเปลี่ยนอัตลักษณ์ เสียง สไตล์ สถานที่ที่ล็อก หรือข้อมูล Canon",
    "หลีกเลี่ยงการทำ Camera/Lens/Movement/Lighting combination ซ้ำกับ recent history ถ้ายังมีทางเลือกที่เหมาะสมกว่าและยังสัมพันธ์กับเรื่อง",
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
        fillMode: input.fillMode,
        preserveFilledValues: input.fillMode === "empty-only",
        cast: enrichedCast.planCast,
        manualSections: input.manualSections,
        recentCreativeFingerprints: input.history.slice(-12).map((item) => item.fingerprint),
      },
      billingMode: input.billingMode,
      preferredProvider: input.provider,
    });

    const enrichedCast = enrichCastForPlanning(input.cast, analyzer.analysis, input.story);

    const plan = buildAiDirectorPlan({
      mode: input.mode,
      novelty: input.novelty,
      scope: input.scope,
      fillMode: input.fillMode,
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
      characters: enrichedCast.suggestions,
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
