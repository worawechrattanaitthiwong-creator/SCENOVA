import { z } from "zod";

const characterSchema = z.object({
  name: z.string(),
  action: z.string(),
  emotion: z.string(),
  dialogue: z.string().nullable(),
}).strict();

export const productionAnalysisSchema = z.object({
  intent: z.string(),
  summaryTh: z.string(),
  sourceLanguage: z.string(),
  scene: z.object({
    description: z.string(),
    location: z.string().nullable(),
    timeOfDay: z.string().nullable(),
    weather: z.string().nullable(),
  }).strict(),
  characters: z.array(characterSchema),
  camera: z.object({
    shotType: z.string(),
    angle: z.string(),
    lensMm: z.number().nullable(),
    cameraHeight: z.string(),
    movement: z.string(),
    composition: z.string(),
    depthOfField: z.string(),
  }).strict(),
  lighting: z.object({
    style: z.string(),
    mood: z.string(),
  }).strict(),
  audio: z.object({
    ambience: z.string(),
    music: z.string(),
    soundEffects: z.array(z.string()),
  }).strict(),
  generation: z.object({
    durationSec: z.number().min(1).max(180),
    aspectRatio: z.string(),
    negativePrompt: z.array(z.string()),
  }).strict(),
  locks: z.object({
    respectCharacterLock: z.boolean(),
    respectStyleLock: z.boolean(),
    respectVoiceLock: z.boolean(),
    respectLocationLock: z.boolean(),
  }).strict(),
}).strict();

export type ProductionAnalysis = z.infer<typeof productionAnalysisSchema>;

const nullableString = { type: ["string", "null"] } as const;
const nullableNumber = { type: ["number", "null"] } as const;

export const productionAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string" },
    summaryTh: { type: "string" },
    sourceLanguage: { type: "string" },
    scene: {
      type: "object",
      additionalProperties: false,
      properties: {
        description: { type: "string" },
        location: nullableString,
        timeOfDay: nullableString,
        weather: nullableString,
      },
      required: ["description", "location", "timeOfDay", "weather"],
    },
    characters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          action: { type: "string" },
          emotion: { type: "string" },
          dialogue: nullableString,
        },
        required: ["name", "action", "emotion", "dialogue"],
      },
    },
    camera: {
      type: "object",
      additionalProperties: false,
      properties: {
        shotType: { type: "string" },
        angle: { type: "string" },
        lensMm: nullableNumber,
        cameraHeight: { type: "string" },
        movement: { type: "string" },
        composition: { type: "string" },
        depthOfField: { type: "string" },
      },
      required: ["shotType", "angle", "lensMm", "cameraHeight", "movement", "composition", "depthOfField"],
    },
    lighting: {
      type: "object",
      additionalProperties: false,
      properties: { style: { type: "string" }, mood: { type: "string" } },
      required: ["style", "mood"],
    },
    audio: {
      type: "object",
      additionalProperties: false,
      properties: {
        ambience: { type: "string" },
        music: { type: "string" },
        soundEffects: { type: "array", items: { type: "string" } },
      },
      required: ["ambience", "music", "soundEffects"],
    },
    generation: {
      type: "object",
      additionalProperties: false,
      properties: {
        durationSec: { type: "number", minimum: 1, maximum: 180 },
        aspectRatio: { type: "string" },
        negativePrompt: { type: "array", items: { type: "string" } },
      },
      required: ["durationSec", "aspectRatio", "negativePrompt"],
    },
    locks: {
      type: "object",
      additionalProperties: false,
      properties: {
        respectCharacterLock: { type: "boolean" },
        respectStyleLock: { type: "boolean" },
        respectVoiceLock: { type: "boolean" },
        respectLocationLock: { type: "boolean" },
      },
      required: ["respectCharacterLock", "respectStyleLock", "respectVoiceLock", "respectLocationLock"],
    },
  },
  required: ["intent", "summaryTh", "sourceLanguage", "scene", "characters", "camera", "lighting", "audio", "generation", "locks"],
} as const;
