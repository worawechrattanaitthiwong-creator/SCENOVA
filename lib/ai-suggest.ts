import { prisma } from "@/lib/db";
import { routeLlm } from "@/lib/llm/model-router";
import { callOpenAiFunction } from "@/lib/llm/openai-responses";

export type AiSuggestion = { value: string; rationale: string };

const RULE_OPTIONS: Record<string, string[]> = {
  lens: ["35mm — Environmental", "50mm — Natural Cinematic", "85mm — Intimate Portrait"],
  shot: ["Medium Shot", "Medium Close-Up", "Wide Establishing"],
  angle: ["Eye Level", "Low Angle", "High Angle"],
  movement: ["Slow Dolly In", "Subtle Handheld", "Locked-Off"],
  lighting: ["Soft Motivated Light", "Cinematic Contrast", "Natural Ambient"],
  emotion: ["Natural", "Restrained Tension", "Warm Curiosity"],
  composition: ["Rule of Thirds", "Centered Symmetry", "Layered Depth"],
};

function deterministic(field: string): AiSuggestion[] {
  const values = RULE_OPTIONS[field.toLowerCase()] || ["Balanced", "Cinematic", "Alternative"];
  return values.map((value, index) => ({ value, rationale: index === 0 ? "ตัวเลือกสมดุลสำหรับเริ่มต้น" : index === 1 ? "เพิ่มภาษาภาพให้เด่นขึ้น" : "ทางเลือกที่ต่างจากสองแบบแรก" }));
}

export async function suggestProductionChoices(input: {
  userId: string;
  field: string;
  projectId?: string;
  sceneId?: string;
  context?: Record<string, unknown>;
}) {
  const referenceId = input.sceneId || input.projectId || "general";
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const dailyCalls = await prisma.llmUsageEvent.count({ where: { userId: input.userId, category: "AI_SUGGEST", createdAt: { gte: startOfDay } } });
  const maxDaily = Math.max(1, Math.floor(Number(process.env.AI_SUGGEST_MAX_CALLS_PER_USER_DAY || 100)));
  if (dailyCalls >= maxDaily) return { source: "rules" as const, fairUseReached: true, suggestions: deterministic(input.field) };

  if (process.env.SCENOVA_LLM_ENABLED !== "true" || !process.env.OPENAI_API_KEY) {
    return { source: "rules" as const, fairUseReached: false, suggestions: deterministic(input.field) };
  }

  const context = JSON.stringify({ field: input.field, ...input.context });
  const route = routeLlm({ task: "AI_SUGGEST", contextChars: context.length });
  try {
    const result = await callOpenAiFunction({
      userId: input.userId,
      category: "AI_SUGGEST",
      referenceType: "ai-suggest",
      referenceId,
      modelId: route.modelId,
      instructions: "You are SCENOVA AI Suggest. Return exactly three distinct professional production choices. Preserve all user locks. Keep each choice concise and useful. Rationale must be concise Thai.",
      prompt: context,
      tools: [{
        type: "function",
        name: "return_suggestions",
        description: "Return exactly three alternative choices for the requested production field.",
        parameters: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              minItems: 3,
              maxItems: 3,
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
      metadata: { field: input.field, projectId: input.projectId, sceneId: input.sceneId, routerTier: route.tier },
    });
    const suggestions = Array.isArray(result.arguments.suggestions)
      ? result.arguments.suggestions.filter((item): item is AiSuggestion => Boolean(item && typeof item === "object" && typeof (item as AiSuggestion).value === "string" && typeof (item as AiSuggestion).rationale === "string")).slice(0, 3)
      : [];
    return { source: "llm" as const, fairUseReached: false, modelId: result.modelId, suggestions: suggestions.length === 3 ? suggestions : deterministic(input.field) };
  } catch {
    return { source: "rules" as const, fairUseReached: false, suggestions: deterministic(input.field) };
  }
}
