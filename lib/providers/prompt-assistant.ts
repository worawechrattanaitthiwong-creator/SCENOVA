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
    return request.base;
  }
}

export class ProductionPromptAssistant implements PromptAssistant {
  id = "system-ai-production-prompt";

  async improve(request: PromptAssistRequest): Promise<PromptBundle> {
    if (!request.userId) throw new Error("SYSTEM_AI_USER_REQUIRED");

    const compact = JSON.stringify({
      targetModelId: request.targetModelId,
      mode: request.mode,
      project: {
        title: request.project.title,
        story: request.project.story,
        genre: request.project.genre,
        mood: request.project.mood,
        aspectRatio: request.project.aspectRatio,
        resolution: request.project.resolution,
        styleId: request.project.styleId,
        locks: request.project.locks,
        canon: request.project.canon,
        projectBible: request.project.projectBible,
        characters: request.project.characters.map((character) => ({
          name: character.name,
          description: character.description,
          appearance: character.appearance,
          outfit: character.outfit,
          personality: character.personality,
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
      description: "Return the final analyzed production prompt bundle for the selected video model.",
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
        "You are the SCENOVA System AI Brain and Production Prompt Composer.",
        "Every Generate Prompt request must first analyze the complete current Studio data, then create the final production-ready prompt bundle.",
        "Analyze story intent, scene order, shot timing, character identity, performance, camera, lens, movement, lighting, sound, dialogue and continuity before writing the output.",
        "Treat multiple editorial scenes/shots inside one provider generation window as one continuous generated clip, not separate render jobs.",
        "Never alter user-locked character identity, costume, voice, canon, camera timing, duration, dialogue meaning or selected video model.",
        "Preserve explicit time ranges and make camera, lens, lighting, action, dialogue, sound and continuity instructions unambiguous for professional video generation.",
        "Optimize wording for the target video model while preserving the user's creative intent and all explicit constraints.",
        "If information conflicts, preserve the user's explicit values and resolve only presentation/wording ambiguity; do not silently invent a different creative decision.",
        "Do not add copyrighted named styles that the user did not request.",
        "Return only the structured prompt bundle through return_prompt_bundle.",
      ].join("\n"),
      prompt: compact,
      tools,
      maxOutputTokens: route.maxOutputTokens,
      metadata: {
        targetModelId: request.targetModelId,
        promptMode: request.mode,
        routerTier: route.tier,
        source: "direct-render",
        feature: "GENERATE_PROMPT",
        billingScope: "SCENOVA_SYSTEM",
        usageTracked: true,
      },
    };

    let result;
    try {
      // Generate Prompt is always a SCENOVA system-funded AI operation.
      // Do not use the user's Analyzer/BYOK credential: usage must remain centrally
      // measurable so Prompt Cost / credits can be enabled later without changing this flow.
      result = await callInceptionFunction({ ...common, credentialMode: "system-only" });
    } catch (systemBrainError) {
      // System OpenAI is the server-side fallback only and is metered through the
      // same PROMPT_PRODUCTION usage category. No API key is exposed to the browser.
      if (!process.env.OPENAI_API_KEY?.trim()) throw systemBrainError;
      result = await callOpenAiFunction({ ...common, modelId: route.modelId });
    }

    this.id = `system-ai:${result.modelId}`;
    const args = result.arguments;
    if (result.name !== "return_prompt_bundle") throw new Error("SYSTEM_AI_PROMPT_FUNCTION_NOT_RETURNED");
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
  // Authenticated Generate Prompt requests always use the system AI path.
  // Mock remains only for isolated non-user callers/tests.
  if (input?.userId) return new ProductionPromptAssistant();
  return new MockPromptAssistant();
}

export function basePromptFor(project: Project, episode: Episode) {
  return buildPromptBundle(project, episode);
}
