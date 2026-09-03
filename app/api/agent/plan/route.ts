import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { resolveSession } from "@/lib/auth-core";
import { routeLlm } from "@/lib/llm/model-router";
import { callSystemAiFunction, systemAiErrorMessage } from "@/lib/llm/system-ai";
import {
  addDeterministicPlanDiagnostics,
  agentStructuredPlanSchema,
  type AgentStructuredPlan,
} from "@/lib/agent/plan-schema";

export const runtime = "nodejs";

const requestSchema = z.object({
  instruction: z.string().min(3).max(20000),
  target: z.enum(["studio", "series"]),
  requestId: z.string().min(1).max(160).optional(),
  regenerateSection: z.enum(["all", "story", "characters", "scenes", "dialogue", "camera", "continuity"]).default("all"),
  existingPlan: z.unknown().optional(),
  seriesContext: z.string().max(20000).optional(),
});

const functionParameters = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion", "target", "sourceInstruction", "title", "synopsis", "genre", "tone", "durationSec",
    "aspectRatio", "visualStyle", "prompt", "negativePrompt", "seriesBible", "relationships", "locations",
    "props", "characters", "scenes", "episodes", "continuity", "warnings", "suggestions",
  ],
  properties: {
    schemaVersion: { type: "string", enum: ["1.0"] },
    target: { type: "string", enum: ["studio", "series"] },
    sourceInstruction: { type: "string" },
    title: { type: "string" },
    synopsis: { type: "string" },
    genre: { type: "string" },
    tone: { type: "string" },
    durationSec: { type: "integer", minimum: 1, maximum: 180 },
    aspectRatio: { type: "string", enum: ["16:9", "9:16", "1:1", "4:5"] },
    visualStyle: { type: "string" },
    prompt: { type: "string" },
    negativePrompt: { type: "string" },
    seriesBible: { type: "string" },
    relationships: { type: "array", items: { type: "string" } },
    locations: { type: "array", items: { type: "string" } },
    props: { type: "array", items: { type: "string" } },
    characters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "role", "appearance", "costume", "personality", "voice", "referenceImages"],
        properties: {
          name: { type: "string" }, role: { type: "string" }, appearance: { type: "string" }, costume: { type: "string" },
          personality: { type: "string" }, voice: { type: "string" }, referenceImages: { type: "array", items: { type: "string" } },
        },
      },
    },
    scenes: { type: "array", items: { $ref: "#/$defs/scene" } },
    episodes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["episodeId", "episodeNumber", "title", "synopsis", "durationSec", "continuityStart", "endingState", "scenes"],
        properties: {
          episodeId: { type: "string" }, episodeNumber: { type: "integer", minimum: 1 }, title: { type: "string" }, synopsis: { type: "string" },
          durationSec: { type: "integer", minimum: 1, maximum: 180 }, continuityStart: { type: "string" }, endingState: { type: "string" },
          scenes: { type: "array", items: { $ref: "#/$defs/scene" } },
        },
      },
    },
    continuity: {
      type: "object",
      additionalProperties: false,
      required: ["continuityStart", "endingState", "lockedFields"],
      properties: {
        continuityStart: { type: "string" }, endingState: { type: "string" }, lockedFields: { type: "array", items: { type: "string" } },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    suggestions: { type: "array", items: { type: "string" } },
  },
  $defs: {
    shot: {
      type: "object",
      additionalProperties: false,
      required: ["shotId", "camera", "angle", "lens", "movement", "subject", "action", "dialogue"],
      properties: {
        shotId: { type: "string" }, startSec: { type: "number", minimum: 0, maximum: 180 }, endSec: { type: "number", minimum: 0, maximum: 180 },
        camera: { type: "string" }, angle: { type: "string" }, lens: { type: "string" }, movement: { type: "string" }, subject: { type: "string" },
        action: { type: "string" }, dialogue: { type: "string" },
      },
    },
    scene: {
      type: "object",
      additionalProperties: false,
      required: ["sceneId", "title", "durationSec", "location", "objective", "mood", "action", "dialogue", "camera", "angle", "lens", "movement", "lighting", "sound", "negativePrompt", "characters", "shots"],
      properties: {
        sceneId: { type: "string" }, title: { type: "string" }, durationSec: { type: "integer", minimum: 1, maximum: 180 }, location: { type: "string" },
        objective: { type: "string" }, mood: { type: "string" }, action: { type: "string" }, dialogue: { type: "string" }, camera: { type: "string" }, angle: { type: "string" },
        lens: { type: "string" }, movement: { type: "string" }, lighting: { type: "string" }, sound: { type: "string" }, negativePrompt: { type: "string" },
        characters: { type: "array", items: { type: "string" } }, shots: { type: "array", items: { $ref: "#/$defs/shot" } },
      },
    },
  },
} as const;

async function currentUser() {
  const store = await cookies();
  return resolveSession(store.get("scenova_session")?.value);
}

function mergeSceneSection(base: AgentStructuredPlan["scenes"], next: AgentStructuredPlan["scenes"], section: "dialogue" | "camera") {
  return base.map((scene, index) => {
    const incoming = next.find((item) => item.sceneId === scene.sceneId) || next[index];
    if (!incoming) return scene;
    if (section === "dialogue") {
      return {
        ...scene,
        dialogue: incoming.dialogue,
        shots: scene.shots.map((shot, shotIndex) => ({ ...shot, dialogue: incoming.shots[shotIndex]?.dialogue ?? shot.dialogue })),
      };
    }
    return {
      ...scene,
      camera: incoming.camera,
      angle: incoming.angle,
      lens: incoming.lens,
      movement: incoming.movement,
      shots: incoming.shots.length ? incoming.shots : scene.shots,
    };
  });
}

function mergePartialPlan(existing: AgentStructuredPlan, candidate: AgentStructuredPlan, section: string): AgentStructuredPlan {
  if (section === "all") return candidate;
  const shared = { ...existing, sourceInstruction: candidate.sourceInstruction, warnings: candidate.warnings, suggestions: candidate.suggestions };
  if (section === "story") {
    return {
      ...shared,
      title: candidate.title, synopsis: candidate.synopsis, genre: candidate.genre, tone: candidate.tone,
      durationSec: candidate.durationSec, aspectRatio: candidate.aspectRatio, visualStyle: candidate.visualStyle,
      prompt: candidate.prompt, negativePrompt: candidate.negativePrompt, seriesBible: candidate.seriesBible,
      relationships: candidate.relationships, locations: candidate.locations, props: candidate.props,
    };
  }
  if (section === "characters") return { ...shared, characters: candidate.characters };
  if (section === "scenes") return { ...shared, scenes: candidate.scenes, episodes: candidate.episodes };
  if (section === "continuity") {
    return {
      ...shared,
      continuity: candidate.continuity,
      episodes: existing.episodes.map((episode, index) => ({
        ...episode,
        continuityStart: candidate.episodes[index]?.continuityStart ?? episode.continuityStart,
        endingState: candidate.episodes[index]?.endingState ?? episode.endingState,
      })),
    };
  }
  if (section === "dialogue" || section === "camera") {
    if (existing.target === "studio") return { ...shared, scenes: mergeSceneSection(existing.scenes, candidate.scenes, section) };
    return {
      ...shared,
      episodes: existing.episodes.map((episode, index) => ({
        ...episode,
        scenes: mergeSceneSection(episode.scenes, candidate.episodes[index]?.scenes || [], section),
      })),
    };
  }
  return candidate;
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsedRequest.success) return NextResponse.json({ error: "INVALID_AGENT_PLAN_REQUEST", issues: parsedRequest.error.issues }, { status: 400 });
  const body = parsedRequest.data;
  const existing = body.existingPlan ? agentStructuredPlanSchema.safeParse(body.existingPlan) : null;
  if (body.regenerateSection !== "all" && (!existing || !existing.success)) {
    return NextResponse.json({ error: "VALID_EXISTING_PLAN_REQUIRED_FOR_PARTIAL_REGENERATION" }, { status: 400 });
  }

  const context = JSON.stringify({
    target: body.target,
    sourceInstruction: body.instruction,
    regenerateSection: body.regenerateSection,
    existingPlan: existing?.success ? existing.data : undefined,
    seriesContext: body.seriesContext || "",
  });
  const route = routeLlm({ task: body.regenerateSection === "continuity" ? "CONTINUITY" : "AGENT_PLAN", contextChars: context.length });

  try {
    const result = await callSystemAiFunction({
      userId: user.id,
      runId: null,
      category: body.regenerateSection === "continuity" ? "AGENT_CONTINUITY_PLAN" : "AGENT_STRUCTURED_PLAN",
      referenceType: "agent-plan",
      referenceId: body.requestId || null,
      openAiModelId: route.modelId,
      instructions: [
        "You are SCENOVA Planning Agent. You are a story writer, script analyst, cinematic planner and continuity assistant only.",
        "NEVER generate video, call a video provider, choose a video provider/model, reserve credits, charge a wallet, or claim that a render succeeded.",
        "Return only the structured plan through return_structured_plan. Preserve the user's meaning and source instruction.",
        "For target=studio create one editable episode plan. Put editable scenes in top-level scenes and keep episodes empty.",
        "For target=series create a Series Bible and multiple editable episodes. Put episode scenes in episodes and keep top-level scenes empty.",
        "For Series, every episode must have explicit Continuity Start and Ending State. Detect conflicts in character appearance, costume, location, props, emotion and event state; put conflicts in warnings and do not silently fix user facts.",
        "Scene and Shot are editorial structures, not video generation jobs. A scene can contain multiple shots and dialogue beats.",
        "Use practical camera vocabulary where possible: Medium, Close-up, Wide, Eye Level, Low Angle, High Angle, 24mm/35mm/50mm/85mm, Static, Pan, Tilt, Dolly, Truck, Pedestal, Orbit, Handheld.",
        "Do not invent API keys, provider settings or model settings. Do not include secrets.",
        body.regenerateSection !== "all" ? `Regenerate ONLY section '${body.regenerateSection}'. The server will preserve all other sections.` : "Create the complete plan.",
      ].join("\n"),
      prompt: context,
      tools: [{
        type: "function",
        name: "return_structured_plan",
        description: "Return a validated SCENOVA editable planning object. No rendering actions.",
        parameters: functionParameters as unknown as Record<string, unknown>,
        strict: true,
      }],
      maxOutputTokens: Math.max(route.maxOutputTokens, body.target === "series" ? 7000 : 4500),
      metadata: {
        target: body.target,
        plannerOnly: true,
        regenerateSection: body.regenerateSection,
        routerTier: route.tier,
        billingScope: "SCENOVA_SYSTEM",
        feature: "AI_AGENT_PLAN",
      },
    });

    if (result.name !== "return_structured_plan") throw new Error("SYSTEM_AI_PLAN_FUNCTION_NOT_RETURNED");
    const candidateInput = {
      ...result.arguments,
      schemaVersion: "1.0",
      target: body.target,
      sourceInstruction: body.instruction,
    };
    const candidate = agentStructuredPlanSchema.parse(candidateInput);
    const merged = existing?.success ? mergePartialPlan(existing.data, candidate, body.regenerateSection) : candidate;
    const plan = addDeterministicPlanDiagnostics(agentStructuredPlanSchema.parse(merged));

    return NextResponse.json({
      ok: true,
      requestId: body.requestId || null,
      plan,
      meta: { modelId: result.modelId, plannerOnly: true, videoGeneration: false, walletCharge: false },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":")[0] : "SYSTEM_AI_PLAN_FAILED";
    console.error("[agent-plan] planning failed", { userId: user.id, code, target: body.target, regenerateSection: body.regenerateSection });
    const isSystemAiError = code.startsWith("SYSTEM_AI_") || code.startsWith("LLM_");
    return NextResponse.json({
      error: isSystemAiError ? systemAiErrorMessage(code) : code,
      code,
    }, { status: isSystemAiError ? 503 : 422 });
  }
}
