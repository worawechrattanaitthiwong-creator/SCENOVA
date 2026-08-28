import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveProviderCredential } from "@/lib/provider-connections";

const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();

export const sceneAnalysisSchema = z.object({
  intent: z.enum(["GENERATE", "EDIT", "CONTINUE", "UNKNOWN"]),
  language: z.enum(["th", "en", "mixed"]),
  summary: z.string(),
  durationSec: nullableNumber,
  scene: z.object({
    location: nullableString,
    timeOfDay: nullableString,
    weather: nullableString,
    environment: nullableString,
  }).strict(),
  characters: z.array(z.object({
    referenceKey: nullableString,
    name: nullableString,
    action: z.string(),
    emotion: nullableString,
    dialogue: nullableString,
  }).strict()),
  camera: z.object({
    shotType: nullableString,
    angle: nullableString,
    lensMm: nullableNumber,
    cameraHeight: nullableString,
    movement: nullableString,
    movementSpeed: nullableString,
    composition: nullableString,
    depthOfField: nullableString,
  }).strict(),
  lighting: z.object({
    style: nullableString,
    keyLight: nullableString,
    mood: nullableString,
  }).strict(),
  audio: z.object({
    ambience: nullableString,
    sfx: z.array(z.string()),
  }).strict(),
  constraints: z.object({
    preserveCharacterLock: z.boolean(),
    preserveVoiceLock: z.boolean(),
    preserveStyleLock: z.boolean(),
    preserveLocationLock: z.boolean(),
    negativePrompts: z.array(z.string()),
  }).strict(),
  confidence: z.number().min(0).max(1),
}).strict();

export type SceneAnalysis = z.infer<typeof sceneAnalysisSchema>;

const SCENE_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: ["GENERATE", "EDIT", "CONTINUE", "UNKNOWN"] },
    language: { type: "string", enum: ["th", "en", "mixed"] },
    summary: { type: "string" },
    durationSec: { type: ["number", "null"] },
    scene: {
      type: "object",
      properties: {
        location: { type: ["string", "null"] },
        timeOfDay: { type: ["string", "null"] },
        weather: { type: ["string", "null"] },
        environment: { type: ["string", "null"] },
      },
      required: ["location", "timeOfDay", "weather", "environment"],
      additionalProperties: false,
    },
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          referenceKey: { type: ["string", "null"] },
          name: { type: ["string", "null"] },
          action: { type: "string" },
          emotion: { type: ["string", "null"] },
          dialogue: { type: ["string", "null"] },
        },
        required: ["referenceKey", "name", "action", "emotion", "dialogue"],
        additionalProperties: false,
      },
    },
    camera: {
      type: "object",
      properties: {
        shotType: { type: ["string", "null"] },
        angle: { type: ["string", "null"] },
        lensMm: { type: ["number", "null"] },
        cameraHeight: { type: ["string", "null"] },
        movement: { type: ["string", "null"] },
        movementSpeed: { type: ["string", "null"] },
        composition: { type: ["string", "null"] },
        depthOfField: { type: ["string", "null"] },
      },
      required: ["shotType", "angle", "lensMm", "cameraHeight", "movement", "movementSpeed", "composition", "depthOfField"],
      additionalProperties: false,
    },
    lighting: {
      type: "object",
      properties: {
        style: { type: ["string", "null"] },
        keyLight: { type: ["string", "null"] },
        mood: { type: ["string", "null"] },
      },
      required: ["style", "keyLight", "mood"],
      additionalProperties: false,
    },
    audio: {
      type: "object",
      properties: {
        ambience: { type: ["string", "null"] },
        sfx: { type: "array", items: { type: "string" } },
      },
      required: ["ambience", "sfx"],
      additionalProperties: false,
    },
    constraints: {
      type: "object",
      properties: {
        preserveCharacterLock: { type: "boolean" },
        preserveVoiceLock: { type: "boolean" },
        preserveStyleLock: { type: "boolean" },
        preserveLocationLock: { type: "boolean" },
        negativePrompts: { type: "array", items: { type: "string" } },
      },
      required: ["preserveCharacterLock", "preserveVoiceLock", "preserveStyleLock", "preserveLocationLock", "negativePrompts"],
      additionalProperties: false,
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: ["intent", "language", "summary", "durationSec", "scene", "characters", "camera", "lighting", "audio", "constraints", "confidence"],
  additionalProperties: false,
} as const;

type GroqResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

async function loadProjectContext(userId: string, projectId?: string | null) {
  if (!projectId) return null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      id: true,
      title: true,
      genre: true,
      mood: true,
      aspectRatio: true,
      resolution: true,
      projectBible: true,
      locksJson: true,
      characters: {
        take: 30,
        select: {
          externalKey: true,
          name: true,
          kind: true,
          description: true,
          appearance: true,
          outfit: true,
          personality: true,
          voiceProfile: true,
          lockEnabled: true,
        },
      },
      locations: {
        take: 30,
        select: { externalKey: true, name: true, description: true, lockEnabled: true, stateJson: true },
      },
      props: {
        take: 30,
        select: { externalKey: true, name: true, description: true, lockEnabled: true, stateJson: true },
      },
      canonFacts: {
        take: 60,
        select: { text: true, locked: true, sourceEp: true },
      },
    },
  });
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  return project;
}

function estimateSystemCostThb(inputTokens: number, outputTokens: number) {
  const inputUsdPerM = Number(process.env.GROQ_GPT_OSS_20B_INPUT_USD_PER_M || 0.075);
  const outputUsdPerM = Number(process.env.GROQ_GPT_OSS_20B_OUTPUT_USD_PER_M || 0.30);
  const thbPerUsd = Number(process.env.SCENOVA_USD_THB_RATE || 33);
  const usd = (Math.max(0, inputTokens) / 1_000_000) * inputUsdPerM
    + (Math.max(0, outputTokens) / 1_000_000) * outputUsdPerM;
  return Math.max(0, usd * thbPerUsd);
}

export async function analyzeProductionPrompt(input: {
  userId: string;
  prompt: string;
  projectId?: string | null;
}) {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("PROMPT_REQUIRED");
  if (prompt.length > 24_000) throw new Error("PROMPT_TOO_LONG");

  const credential = await resolveProviderCredential({
    userId: input.userId,
    category: "ANALYZER",
    provider: "groq",
  });
  if (!credential) throw new Error("ANALYZER_NOT_CONFIGURED");

  const project = await loadProjectContext(input.userId, input.projectId);
  const modelId = credential.modelId || "openai/gpt-oss-20b";
  const systemInstructions = [
    "You are SCENOVA Analyzer, not the video generator.",
    "Convert the user's production instruction into structured production intent only.",
    "Never invent changes to locked character identity, voice, style, location, prop state, or canon.",
    "If the user requests a conflict with a lock, preserve the lock and describe only the compatible intent.",
    "Do not produce a cinematic prose prompt. Do not add commentary outside the JSON schema.",
    "Thai input is allowed. Keep concise field values in the user's language when practical.",
  ].join("\n");

  const contextPayload = JSON.stringify({
    userPrompt: prompt,
    project: project ? {
      title: project.title,
      genre: project.genre,
      mood: project.mood,
      aspectRatio: project.aspectRatio,
      resolution: project.resolution,
      projectBible: project.projectBible,
      locks: project.locksJson,
      characters: project.characters,
      locations: project.locations,
      props: project.props,
      canonFacts: project.canonFacts,
    } : null,
  });

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credential.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemInstructions },
        { role: "user", content: contextPayload },
      ],
      reasoning_effort: "low",
      max_completion_tokens: 1800,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "scenova_scene_analysis",
          strict: true,
          schema: SCENE_ANALYSIS_JSON_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });

  if (!response.ok) {
    const code = response.status === 401 || response.status === 403
      ? "ANALYZER_KEY_REJECTED"
      : response.status === 429
        ? "ANALYZER_RATE_LIMITED"
        : `ANALYZER_HTTP_${response.status}`;
    throw new Error(code);
  }

  const payload = await response.json() as GroqResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("ANALYZER_EMPTY_RESPONSE");

  const parsed = sceneAnalysisSchema.parse(JSON.parse(content));
  const inputTokens = Math.max(0, payload.usage?.prompt_tokens || 0);
  const outputTokens = Math.max(0, payload.usage?.completion_tokens || 0);
  const costThb = credential.source === "SYSTEM" ? estimateSystemCostThb(inputTokens, outputTokens) : 0;

  await prisma.llmUsageEvent.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      provider: "groq",
      modelId,
      category: "PROMPT_ANALYZER",
      inputTokens,
      cachedInputTokens: 0,
      outputTokens,
      costThb,
      referenceType: input.projectId ? "project" : "analyzer",
      referenceId: input.projectId || "general",
      metadata: {
        credentialSource: credential.source,
        providerCostOwner: credential.source === "BYOK" ? "USER" : "SCENOVA",
        structuredOutput: true,
      },
    },
  });

  return {
    analysis: parsed,
    provider: "groq",
    modelId,
    credentialSource: credential.source,
    providerCostOwner: credential.source === "BYOK" ? "USER" : "SCENOVA",
    usage: { inputTokens, outputTokens, costThb },
  } as const;
}
