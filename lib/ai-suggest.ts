import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { routeLlm } from "@/lib/llm/model-router";
import { callOpenAiFunction, type FunctionTool } from "@/lib/llm/openai-responses";
import { callInceptionFunction } from "@/lib/llm/inception";

export type AiSuggestion = { value: string; rationale: string };

const RULE_OPTIONS: Record<string, string[]> = {
  lens: ["24mm — Expansive", "28mm — Immersive", "35mm — Environmental", "40mm — Balanced", "50mm — Natural Cinematic", "65mm — Gentle Compression", "85mm — Intimate Portrait", "100mm — Detail"],
  shot: ["Extreme Wide", "Wide Establishing", "Full Shot", "Medium Wide", "Medium Shot", "Medium Close-Up", "Close-Up", "Extreme Close-Up"],
  angle: ["Eye Level", "Low Angle", "High Angle", "Over-the-Shoulder", "Profile", "Three-Quarter", "Top Shot", "Dutch Angle"],
  movement: ["Locked-Off", "Slow Dolly In", "Dolly Out", "Lateral Track", "Crane Rise", "Gentle Pan", "Subtle Handheld", "Character Follow"],
  lighting: ["Soft Motivated Light", "Natural Ambient", "Golden Hour", "Moonlit Contrast", "Practical Interior", "High-Key Soft", "Low-Key Dramatic", "Silhouette Backlight"],
  emotion: ["Natural", "Restrained Tension", "Warm Curiosity", "Quiet Grief", "Hopeful", "Urgent", "Guarded", "Triumphant"],
  composition: ["Rule of Thirds", "Centered Symmetry", "Layered Depth", "Leading Lines", "Negative Space", "Frame Within Frame", "Balanced Asymmetry", "Foreground Reveal"],
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[\s_–—-]+/g, " ").replace(/[^\p{L}\p{N}\s]/gu, "");
}

export function dedupeSuggestions(items: AiSuggestion[], recentValues: string[] = [], limit = 8) {
  const seen = new Set(recentValues.map(normalize));
  const result: AiSuggestion[] = [];
  for (const item of items) {
    const key = normalize(item.value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({ value: item.value.trim(), rationale: item.rationale.trim() });
    if (result.length >= limit) break;
  }
  return result;
}

function deterministic(field: string, recentValues: string[] = []): AiSuggestion[] {
  const values = RULE_OPTIONS[field.toLowerCase()] || ["Balanced", "Cinematic", "Story-led", "Natural", "Intimate", "Dynamic", "Minimal", "Expressive"];
  const items = values.map((value, index) => ({ value, rationale: index === 0 ? "ตัวเลือกสมดุลที่เข้ากับฉากส่วนใหญ่" : "ทางเลือกภาษาภาพที่แตกต่างและใช้งานได้จริง" }));
  const fresh = dedupeSuggestions(items, recentValues, 8);
  return [...fresh, ...dedupeSuggestions(items, fresh.map((item) => item.value), 8 - fresh.length)].slice(0, 8);
}

function metadataRecord(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function recentSuggestions(userId: string, field: string, referenceId: string) {
  const rows = await prisma.llmUsageEvent.findMany({
    where: { userId, category: "AI_SUGGEST", referenceId }, orderBy: { createdAt: "desc" }, take: 12,
  });
  const values: string[] = [];
  for (const row of rows) {
    const metadata = metadataRecord(row.metadata);
    if (metadata.field !== field || !Array.isArray(metadata.suggestionValues)) continue;
    for (const value of metadata.suggestionValues) if (typeof value === "string") values.push(value);
  }
  return values.slice(0, 40);
}

export async function suggestProductionChoices(input: {
  userId: string;
  field: string;
  projectId?: string;
  sceneId?: string;
  context?: Record<string, unknown>;
}) {
  const referenceId = input.sceneId || input.projectId || "general";
  const currentValue = typeof input.context?.currentValue === "string" ? input.context.currentValue.trim() : "";
  const lockedFields = Array.isArray(input.context?.lockedFields) ? input.context.lockedFields : [];
  const locked = input.context?.locked === true || lockedFields.includes(input.field);
  if (locked) {
    return { source: "lock" as const, fairUseReached: false, locked: true, suggestions: currentValue ? [{ value: currentValue, rationale: "ค่านี้ถูกผู้ใช้ล็อกไว้ ระบบจะไม่เปลี่ยนแปลง" }] : [] };
  }
  const requestNonce = randomUUID();
  const recentValues = await recentSuggestions(input.userId, input.field, referenceId);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const dailyCalls = await prisma.llmUsageEvent.count({ where: { userId: input.userId, category: "AI_SUGGEST", createdAt: { gte: startOfDay } } });
  const maxDaily = Math.max(1, Math.floor(Number(process.env.AI_SUGGEST_MAX_CALLS_PER_USER_DAY || 100)));
  if (dailyCalls >= maxDaily) return { source: "rules" as const, fairUseReached: true, requestNonce, suggestions: deterministic(input.field, recentValues) };

  if (process.env.SCENOVA_LLM_ENABLED !== "true") {
    return { source: "rules" as const, fairUseReached: false, requestNonce, suggestions: deterministic(input.field, recentValues) };
  }

  const context = JSON.stringify({ field: input.field, requestNonce, recentValues, ...input.context });
  const route = routeLlm({ task: "AI_SUGGEST", contextChars: context.length });
  try {
    const request: {
      userId: string;
      category: string;
      referenceType: string;
      referenceId: string;
      instructions: string;
      prompt: string;
      tools: FunctionTool[];
      maxOutputTokens: number;
      metadata: Record<string, unknown>;
    } = {
      userId: input.userId,
      category: "AI_SUGGEST",
      referenceType: "ai-suggest",
      referenceId,
      instructions: "You are SCENOVA AI Brain. Return exactly eight context-aware professional production choices. Preserve all user locks. Never repeat recentValues or near-duplicate wording. Infer from story, scene, characters, emotion, style and neighboring shots. Rationale must be concise Thai.",
      prompt: context,
      tools: [{
        type: "function",
        name: "return_suggestions",
        description: "Return exactly eight distinct contextual choices for the requested production field.",
        parameters: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              minItems: 8,
              maxItems: 8,
              items: {
                type: "object",
                properties: { value: { type: "string" }, rationale: { type: "string" } },
                required: ["value", "rationale"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      }],
      maxOutputTokens: route.maxOutputTokens,
      metadata: { field: input.field, requestNonce, projectId: input.projectId, sceneId: input.sceneId, routerTier: route.tier },
    };
    let result;
    try {
      result = await callInceptionFunction(request);
    } catch (inceptionError) {
      if (!process.env.OPENAI_API_KEY) throw inceptionError;
      result = await callOpenAiFunction({ ...request, modelId: route.modelId });
    }
    const generated = Array.isArray(result.arguments.suggestions)
      ? result.arguments.suggestions.filter((item): item is AiSuggestion => Boolean(item && typeof item === "object" && typeof (item as AiSuggestion).value === "string" && typeof (item as AiSuggestion).rationale === "string"))
      : [];
    const distinct = dedupeSuggestions(generated, recentValues, 8);
    const fillers = deterministic(input.field, [...recentValues, ...distinct.map((item) => item.value)]);
    const suggestions = dedupeSuggestions([...distinct, ...fillers], recentValues, 8);
    const latest = await prisma.llmUsageEvent.findFirst({ where: { userId: input.userId, category: "AI_SUGGEST", referenceId }, orderBy: { createdAt: "desc" } });
    if (latest) {
      const metadata = metadataRecord(latest.metadata);
      await prisma.llmUsageEvent.update({ where: { id: latest.id }, data: { metadata: { ...metadata, field: input.field, requestNonce, suggestionValues: suggestions.map((item) => item.value) } as Prisma.InputJsonObject } });
    }
    return { source: "llm" as const, fairUseReached: false, requestNonce, modelId: result.modelId, suggestions };
  } catch {
    return { source: "rules" as const, fairUseReached: false, requestNonce, suggestions: deterministic(input.field, recentValues) };
  }
}
