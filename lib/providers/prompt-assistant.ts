import type { PromptBundle, PromptMode, Project, Episode } from "@/lib/domain";
import { buildPromptBundle } from "@/lib/prompt-engine";
import { routeLlm } from "@/lib/llm/model-router";
import { callOpenAiFunction } from "@/lib/llm/openai-responses";

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

export class OpenAiPromptAssistant implements PromptAssistant {
  id = "openai-production-prompt";

  async improve(request: PromptAssistRequest): Promise<PromptBundle> {
    if (request.mode === "strict" || !request.userId || process.env.SCENOVA_LLM_ENABLED !== "true" || !process.env.OPENAI_API_KEY) return request.base;
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
        characters: request.project.characters.map((character) => ({ name: character.name, appearance: character.appearance, outfit: character.outfit, voiceProfile: character.voiceProfile, lock: character.lock })),
      },
      episode: { number: request.episode.number, title: request.episode.title, duration: request.episode.duration, synopsis: request.episode.synopsis },
      base: request.base,
    });
    const route = routeLlm({ task: "PROMPT_PRODUCTION", contextChars: compact.length });
    const result = await callOpenAiFunction({
      userId: request.userId,
      runId: request.runId || null,
      category: "PROMPT_PRODUCTION",
      referenceType: "episode",
      referenceId: request.episode.id,
      modelId: route.modelId,
      instructions: [
        "You are SCENOVA Production Prompt Composer.",
        "Return a production-ready prompt bundle through the function tool.",
        "Never alter user-locked character identity, costume, voice, canon, camera timing or duration.",
        "Preserve explicit time ranges and make camera/lens/lighting/action/dialogue instructions unambiguous for professional video generation.",
        "Do not add copyrighted named styles that the user did not request.",
      ].join("\n"),
      prompt: compact,
      tools: [{
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
      }],
      maxOutputTokens: route.maxOutputTokens,
      metadata: { targetModelId: request.targetModelId, promptMode: request.mode, routerTier: route.tier },
    });
    const args = result.arguments;
    if (result.name !== "return_prompt_bundle") return request.base;
    const shots = Array.isArray(args.shots) ? args.shots.filter((item): item is string => typeof item === "string") : request.base.shots;
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
  if (process.env.SCENOVA_LLM_ENABLED === "true" && process.env.OPENAI_API_KEY && input?.userId) return new OpenAiPromptAssistant();
  return new MockPromptAssistant();
}

export function basePromptFor(project: Project, episode: Episode) {
  return buildPromptBundle(project, episode);
}
