import type { Episode, Project } from "@/lib/domain";
import type { AgentRunRecord, AgentToolName } from "@/lib/agent/types";
import { getAgentPolicy } from "@/lib/agent/policy";
import { getAllowedAgentTools } from "@/lib/agent/tools";
import { routeLlm } from "@/lib/llm/model-router";
import { callOpenAiFunction, type FunctionTool } from "@/lib/llm/openai-responses";
import { callInceptionFunction } from "@/lib/llm/inception";
import { countLlmCalls } from "@/lib/llm/usage";

export type AgentBrainDecision = {
  tool: AgentToolName;
  reason: string;
  args: Record<string, unknown>;
  source: "llm" | "deterministic";
  modelId?: string;
  costThb?: number;
  routerReason?: string;
};

const DEFAULT_TOOL: Record<string, AgentToolName> = {
  PLAN_STORY: "plan_episode",
  STORY_ARCHITECT: "architect_story",
  SCRIPT_WRITE: "write_script",
  SCRIPT_EDIT: "edit_script",
  DIRECT_SCENES: "direct_scenes",
  PLAN_CINEMATOGRAPHY: "plan_cinematography",
  SELECT_STYLE: "select_style",
  BUILD_PROMPTS: "improve_prompt",
  STORYBOARD: "create_storyboard",
  AWAIT_APPROVAL: "request_approval",
  GENERATE: "generate_video",
  VERIFY_CONTINUITY: "verify_continuity",
  POST_PRODUCTION: "plan_post_production",
  FINAL_QUALITY: "quality_check",
  NEXT_EPISODE: "plan_episode",
};

function fallback(run: AgentRunRecord, reason: string): AgentBrainDecision {
  const allowed = getAllowedAgentTools(run.stage);
  const tool = DEFAULT_TOOL[run.stage] || allowed[0] || "pause_run";
  return { tool, reason, args: {}, source: "deterministic" };
}

function toolSchema(name: AgentToolName): FunctionTool {
  const descriptions: Record<AgentToolName, string> = {
    plan_episode: "Plan the next production step for the current episode while preserving canon and locks.",
    architect_story: "Create the story structure, beats and character arcs while preserving canon.",
    write_script: "Write the episode script from the approved story plan.",
    edit_script: "Review the script and return a pass, revision or blocker verdict.",
    direct_scenes: "Create performance, pacing and scene-direction decisions from the approved script.",
    plan_cinematography: "Create a shot and camera plan from the director plan.",
    select_style: "Choose or confirm the visual style. Never override a user style lock.",
    improve_prompt: "Build or improve the production prompt without changing locked user choices.",
    create_storyboard: "Create a storyboard manifest for approval before paid rendering.",
    generate_video: "Proceed to video generation only when the deterministic budget, approval, wallet, and security guards allow it.",
    verify_continuity: "Check character, canon, location, prop, camera and lighting continuity before continuing.",
    plan_post_production: "Create the edit, audio and transition plan from completed render outputs.",
    quality_check: "Validate final technical and creative delivery requirements.",
    switch_provider: "Request an alternate configured provider when the current provider is unavailable or repeatedly failing.",
    request_approval: "Ask for human approval before spending beyond the configured approval threshold or changing a material production decision.",
    pause_run: "Pause the run when human clarification or a safe stop is preferable.",
  };
  return {
    type: "function",
    name,
    description: descriptions[name],
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Short user-readable Thai explanation for this action." },
        focus: { type: "string" },
        providerPreference: { type: "string" },
        checks: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
  };
}

function compactContext(project: Project, episode: Episode, run: AgentRunRecord, state: Record<string, unknown>) {
  return JSON.stringify({
    stage: run.stage,
    runStatus: run.status,
    runBudgetThb: run.budgetThb,
    estimatedSpendThb: run.estimatedSpendThb,
    actualSpendThb: run.actualSpendThb,
    approvalThresholdThb: run.approvalThresholdThb,
    project: {
      id: project.id,
      title: project.title,
      story: project.story.slice(0, 3500),
      genre: project.genre,
      mood: project.mood,
      styleId: project.styleId,
      mainModelId: project.mainModelId,
      promptMode: project.promptMode,
      resolution: project.resolution,
      aspectRatio: project.aspectRatio,
      locks: project.locks,
      canon: project.canon.slice(0, 30),
      characters: project.characters.slice(0, 12).map((character) => ({ id: character.id, name: character.name, appearance: character.appearance.slice(0, 500), outfit: character.outfit.slice(0, 300), lock: character.lock })),
    },
    episode: {
      id: episode.id,
      number: episode.number,
      title: episode.title,
      duration: episode.duration,
      synopsis: episode.synopsis.slice(0, 2500),
      segments: episode.segments.slice(0, 20).map((segment) => ({ id: segment.id, start: segment.start, end: segment.end, location: segment.location, action: segment.action.slice(0, 600), emotion: segment.emotion, lighting: segment.lighting.slice(0, 300) })),
    },
    state: {
      providerSwitches: state.providerSwitches || 0,
      selectedProviderId: state.selectedProviderId || null,
      continuityScore: state.continuityScore || null,
      completedEpisodes: state.completedEpisodes || [],
    },
  });
}

export async function chooseAgentAction(input: { run: AgentRunRecord; project: Project; episode: Episode; state: Record<string, unknown>; retryCount?: number }): Promise<AgentBrainDecision> {
  const allowed = getAllowedAgentTools(input.run.stage);
  if (!allowed.length) return fallback(input.run, "Stage นี้ไม่มี Agent tool ที่อนุญาต จึงใช้ safe fallback");
  if (process.env.SCENOVA_LLM_ENABLED !== "true") {
    return fallback(input.run, "LLM Planner ยังไม่เปิดใช้งาน จึงใช้ deterministic production policy โดยไม่เสียค่า LLM");
  }

  const policy = getAgentPolicy();
  const [runCalls, clipCalls] = await Promise.all([
    countLlmCalls({ runId: input.run.id }),
    countLlmCalls({ userId: input.run.userId, referenceType: "episode", referenceId: input.episode.id }),
  ]);
  if (runCalls >= policy.maxLlmCallsPerRun) throw new Error("AGENT_MAX_LLM_CALLS_PER_RUN_EXCEEDED");
  if (clipCalls >= policy.maxLlmCallsPerClip) throw new Error("AGENT_MAX_LLM_CALLS_PER_CLIP_EXCEEDED");

  const context = compactContext(input.project, input.episode, input.run, input.state);
  const route = routeLlm({ task: "AGENT_PLAN", contextChars: context.length, retryCount: input.retryCount || 0 });
  const instructions = [
    "You are SCENOVA Production Agent Planner.",
    "Choose exactly one of the supplied function tools as the next action.",
    "User locks, canon, server-side budgets, wallet reservations, spend caps and kill switches are absolute and cannot be bypassed.",
    "Prefer the cheapest safe action. Do not invent provider availability. Do not request generation merely to explore alternatives.",
    "Once paid rendering begins, never switch video providers and never request a second provider submission for the same Generation ID.",
    "Give the reason in concise Thai so it can be shown in the Agent Decision Log.",
  ].join("\n");

  try {
    const request = {
      userId: input.run.userId,
      runId: input.run.id,
      category: "AGENT_PLAN",
      referenceType: "episode",
      referenceId: input.episode.id,
      instructions,
      prompt: context,
      tools: allowed.map(toolSchema),
      maxOutputTokens: route.maxOutputTokens,
      metadata: { stage: input.run.stage, routerTier: route.tier, routerReason: route.reason },
    };
    let result;
    try {
      result = await callInceptionFunction(request);
    } catch (inceptionError) {
      if (!process.env.OPENAI_API_KEY) throw inceptionError;
      result = await callOpenAiFunction({ ...request, modelId: route.modelId });
    }
    const tool = result.name as AgentToolName | null;
    if (!tool || !allowed.includes(tool)) return fallback(input.run, "LLM ไม่ได้เลือก Tool ที่อยู่ใน allowlist จึงใช้ deterministic safe action");
    return {
      tool,
      reason: typeof result.arguments.reason === "string" && result.arguments.reason.trim() ? result.arguments.reason : `LLM Planner เลือก ${tool}`,
      args: result.arguments,
      source: "llm",
      modelId: result.modelId,
      costThb: result.costThb,
      routerReason: route.reason,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("BUDGET_EXCEEDED") || message.includes("MAX_LLM_CALLS")) throw error;
    return fallback(input.run, `LLM Planner ใช้งานไม่ได้ชั่วคราว (${message.slice(0, 120)}) จึง fallback โดยไม่ให้ workflow หยุด`);
  }
}
