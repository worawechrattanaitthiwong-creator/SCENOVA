import type { PromptBundle, PromptMode, Project, Episode } from "@/lib/domain";
import { buildPromptBundle } from "@/lib/prompt-engine";
import { routeLlm } from "@/lib/llm/model-router";
import { callOpenAiFunction, type FunctionTool } from "@/lib/llm/openai-responses";
import { callInceptionFunction } from "@/lib/llm/inception";

export type PromptAssistRequest = {
  project: Project;
  episode: Episode;
  base: PromptBundle;
  mode: PromptMode;
  targetModelId: string;
  userId?: string;
  runId?: string;
};

export interface PromptAssistant {
  id: string;
  improve(request: PromptAssistRequest): Promise<PromptBundle>;
}

export class MockPromptAssistant implements PromptAssistant {
  id = "mock-prompt-assistant";

  async improve(request: PromptAssistRequest): Promise<PromptBundle> {
    if (request.mode === "strict") return request.base;
    return {
      ...request.base,
      master: `${request.base.master}\n\n# AI ASSISTANCE LAYER\nMode: ${request.mode}. Preserve all hard constraints exactly. Improve cinematic language, temporal continuity and provider-specific phrasing without changing user-selected camera, lens, timing or active locks.`,
    };
  }
}

export class ProductionPromptAssistant implements PromptAssistant {
  id = "ai-brain-production-prompt";

  async improve(request: PromptAssistRequest): Promise<PromptBundle> {
    if (request.mode === "strict") return request.base;
    if (!request.userId || process.env.SCENOVA_LLM_ENABLED !== "true") {
      throw new Error("AI_BRAIN_NOT_ENABLED");
    }

    const compact = JSON.stringify({
      targetModelId: request.targetModelId,
      mode: request.mode,
      project: {
        title: request.project.title,
        genre: request.project.genre,
        mood: request.project.mood,
        aspectRatio: request.project.aspectRatio,
        resolution: request.project.resolution,
        styleId: request.project.styleId,
        locks: request.project.locks,
        canon: request.project.canon,
        characters: request.project.characters.map((character) => ({
          name: character.name,
          appearance: character.appearance,
          outfit: character.outfit,
          voiceProfile: character.voiceProfile,
          lock: character.lock,
        })),
      },
      episode: {
        number: request.episode.number,
        title: request.episode.title,
        duration: request.episode.duration,
        synopsis: request.episode.synopsis,
        segments: request.episode.segments,
      },
      base: request.base,
    });

    const route = routeLlm({ task: "PROMPT_PRODUCTION", contextChars: compact.length });
    const tools: FunctionTool[] = [{
      type: "function",
      name: "return_prompt_bundle",
      description: "Return the final production prompt bundle.",
      parameters: {
        type: "object",
        properties: {
          master: { type: "string" },
          episode: { type: "string" },
          shots: { type: "array", items: { type: "string" } },
          negative: { type: "string" },
          thaiSummary: { type: "string" },
        },
        required: ["master", "episode", "shots", "negative", "thaiSummary"],
        additionalProperties: false,
      },
    }];
    const common = {
      userId: request.userId,
      runId: request.runId || null,
      category: "PROMPT_PRODUCTION",
      referenceType: "episode",
      referenceId: request.episode.id,
      instructions: [
        "You are SCENOVA AI Brain and Production Prompt Composer.",
        "Analyze the complete Studio timeline before writing the final production-ready prompt bundle.",
        "Never alter user-locked character identity, costume, voice, canon, camera timing, duration, dialogue meaning or selected video model.",
        "Preserve explicit time ranges and make camera, lens, lighting, action, dialogue, sound and continuity instructions unambiguous for professional video generation.",
        "Optimize wording for the target video model while preserving the user's creative intent.",
        "Do not add copyrighted named styles that the user did not request.",
      ].join("\n"),
      prompt: compact,
      tools,
      maxOutputTokens: route.maxOutputTokens,
      metadata: {
        targetModelId: request.targetModelId,
        promptMode: request.mode,
        routerTier: route.tier,
        source: "direct-render",
      },
    };

    let result;
    try {
      // AI Brain priority: use the user's configured Analyzer/Inception connection first.
      // Its configured modelId is respected, so a custom brain model can compose the prompt.
      result = await callInceptionFunction(common);
    } catch (brainError) {
      if (!process.env.OPENAI_API_KEY) throw brainError;
      result = await callOpenAiFunction({ ...common, modelId: route.modelId });
    }

    this.id = `ai-brain:${result.modelId}`;
    const args = result.arguments;
    if (result.name !== "return_prompt_bundle") throw new Error("AI_BRAIN_PROMPT_FUNCTION_NOT_RETURNED");
    const shots = Array.isArray(args.shots)
      ? args.shots.filter((item): item is string => typeof item === "string")
      : request.base.shots;
    return {
      master: typeof args.master === "string" ? args.master : request.base.master,
      episode: typeof args.episode === "string" ? args.episode : request.base.episode,
      shots: shots.length ? shots : request.base.shots,
      negative: typeof args.negative === "string" ? args.negative : request.base.negative,
      thaiSummary: typeof args.thaiSummary === "string" ? args.thaiSummary : request.base.thaiSummary,
    };
  }
}

export function createPromptAssistant(input?: { userId?: string; runId?: string }) {
  if (input?.userId && process.env.SCENOVA_LLM_ENABLED === "true") return new ProductionPromptAssistant();
  return new MockPromptAssistant();
}

export function basePromptFor(project: Project, episode: Episode) {
  return buildPromptBundle(project, episode);
}
