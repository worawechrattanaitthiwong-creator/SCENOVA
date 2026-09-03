import { z } from "zod";
import type { CameraShot, Project, TimelineSegment } from "@/lib/domain";
import { callSystemAiFunction } from "@/lib/llm/system-ai";
import { routeLlm } from "@/lib/llm/model-router";
import { cinematicCoveragePreset } from "@/lib/cinematic-coverage-presets";

const coverageShotSchema = z.object({
  sceneId: z.string().min(1),
  start: z.number().min(0).max(180),
  end: z.number().min(0).max(180),
  subject: z.string().default("Main subject"),
  coverageRole: z.string().default("Story coverage"),
  cameraSlot: z.string().default("CAM_A"),
  shotType: z.string().default("Medium"),
  angle: z.string().default("Eye Level"),
  lensMm: z.number().min(10).max(300).default(50),
  cameraHeight: z.string().default("Eye"),
  movement: z.string().default("Static"),
  movementSpeed: z.string().default("Normal"),
  focus: z.string().default("Subject eyes"),
  depthOfField: z.string().default("Natural"),
  composition: z.string().default("Rule of Thirds"),
  foregroundOcclusion: z.string().default("None"),
  screenDirection: z.string().default("Preserve established direction"),
  eyelineTarget: z.string().default("Preserve established eyeline"),
  transitionIn: z.string().default("Hard Cut"),
  transitionOut: z.string().default("Hard Cut"),
  continuityAnchor: z.string().default("Preserve identity, wardrobe, props, geography and light"),
});

const coveragePlanSchema = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  presetId: z.string().min(1),
  summary: z.string().default("Cinematic coverage plan"),
  axisOfAction: z.string().default("Maintain a stable 180-degree axis"),
  spatialMap: z.string().default("Preserve subject positions and direction of travel"),
  lightingAnchor: z.string().default("Preserve motivated light direction and color continuity"),
  continuityRules: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  shots: z.array(coverageShotSchema).min(1).max(80),
});

export type CinematicCoveragePlan = z.infer<typeof coveragePlanSchema>;

const functionParameters = {
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "presetId", "summary", "axisOfAction", "spatialMap", "lightingAnchor", "continuityRules", "warnings", "shots"],
  properties: {
    schemaVersion: { type: "string", enum: ["1.0"] },
    presetId: { type: "string" },
    summary: { type: "string" },
    axisOfAction: { type: "string" },
    spatialMap: { type: "string" },
    lightingAnchor: { type: "string" },
    continuityRules: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    shots: {
      type: "array",
      minItems: 1,
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "sceneId", "start", "end", "subject", "coverageRole", "cameraSlot", "shotType", "angle", "lensMm",
          "cameraHeight", "movement", "movementSpeed", "focus", "depthOfField", "composition", "foregroundOcclusion",
          "screenDirection", "eyelineTarget", "transitionIn", "transitionOut", "continuityAnchor",
        ],
        properties: {
          sceneId: { type: "string" },
          start: { type: "number", minimum: 0, maximum: 180 },
          end: { type: "number", minimum: 0, maximum: 180 },
          subject: { type: "string" },
          coverageRole: { type: "string" },
          cameraSlot: { type: "string" },
          shotType: { type: "string" },
          angle: { type: "string" },
          lensMm: { type: "number", minimum: 10, maximum: 300 },
          cameraHeight: { type: "string" },
          movement: { type: "string" },
          movementSpeed: { type: "string" },
          focus: { type: "string" },
          depthOfField: { type: "string" },
          composition: { type: "string" },
          foregroundOcclusion: { type: "string" },
          screenDirection: { type: "string" },
          eyelineTarget: { type: "string" },
          transitionIn: { type: "string" },
          transitionOut: { type: "string" },
          continuityAnchor: { type: "string" },
        },
      },
    },
  },
} as const;

function targetShotRange(duration: number) {
  if (duration <= 10) return "4-6";
  if (duration <= 20) return "6-10";
  if (duration <= 30) return "8-14";
  if (duration <= 60) return "14-24";
  return "18-32";
}

function compactProject(project: Project) {
  const episode = project.episodes[0];
  return {
    title: project.title,
    story: project.story,
    genre: project.genre,
    mood: project.mood,
    duration: episode?.duration || 0,
    aspectRatio: project.aspectRatio,
    locks: project.locks,
    characters: project.characters.map((character) => ({
      id: character.id,
      name: character.name,
      appearance: character.appearance,
      outfit: character.outfit,
      personality: character.personality,
      locked: character.lock,
    })),
    scenes: (episode?.segments || []).map((scene) => ({
      id: scene.id,
      start: scene.start,
      end: scene.end,
      title: scene.title,
      location: scene.location,
      characterIds: scene.characterIds,
      action: scene.action,
      emotion: scene.emotion,
      lighting: scene.lighting,
      sound: scene.sound,
      dialogue: scene.dialogue.map((beat) => ({
        start: beat.start,
        end: beat.end,
        characterId: beat.characterId,
        text: beat.text,
        emotion: beat.emotion,
      })),
      userCamera: scene.cameraShots.map((shot) => ({
        start: shot.start,
        end: shot.end,
        shotType: shot.shotType,
        angle: shot.angle,
        lensMm: shot.lensMm,
        movement: shot.movement,
      })),
    })),
  };
}

function fallbackShot(scene: TimelineSegment, index: number): CameraShot {
  const source = scene.cameraShots[0];
  return {
    id: `coverage-fallback-${scene.id}-${index + 1}`,
    start: scene.start,
    end: scene.end,
    shotType: source?.shotType || "Medium",
    angle: source?.angle || "Eye Level",
    lensMm: source?.lensMm || 50,
    cameraHeight: source?.cameraHeight || "Eye",
    movement: source?.movement || "Static",
    movementSpeed: source?.movementSpeed || "Normal",
    focus: source?.focus || "Main subject",
    depthOfField: source?.depthOfField || "Natural",
    composition: source?.composition || "Rule of Thirds",
    foregroundOcclusion: source?.foregroundOcclusion || "None",
    coverageRole: "Master safety",
    cameraSlot: `CAM_MASTER_${index + 1}`,
    subject: "Scene subjects",
    screenDirection: "Preserve established direction",
    eyelineTarget: "Preserve established eyeline",
    transitionIn: "Hard Cut",
    transitionOut: "Hard Cut",
    continuityAnchor: "Preserve identity, wardrobe, props, geography and lighting",
  };
}

function normalizedShotsForScene(scene: TimelineSegment, plan: CinematicCoveragePlan, sceneIndex: number) {
  const incoming = plan.shots
    .filter((shot) => shot.sceneId === scene.id)
    .map((shot) => ({ ...shot, start: Math.max(scene.start, shot.start), end: Math.min(scene.end, shot.end) }))
    .filter((shot) => shot.end - shot.start >= 0.45)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (!incoming.length) return [fallbackShot(scene, sceneIndex)];

  const boundaries: number[] = [scene.start];
  for (let index = 1; index < incoming.length; index += 1) {
    const previous = incoming[index - 1]!;
    const current = incoming[index]!;
    const preferred = Math.max(previous.start + 0.45, Math.min(current.start, scene.end - 0.45));
    boundaries.push(Number(preferred.toFixed(3)));
  }
  boundaries.push(scene.end);

  return incoming.map((shot, index): CameraShot => ({
    id: `coverage-${scene.id}-${index + 1}`,
    start: boundaries[index]!,
    end: boundaries[index + 1]!,
    shotType: shot.shotType,
    angle: shot.angle,
    lensMm: shot.lensMm,
    cameraHeight: shot.cameraHeight,
    movement: shot.movement,
    movementSpeed: shot.movementSpeed,
    focus: shot.focus,
    depthOfField: shot.depthOfField,
    composition: shot.composition,
    foregroundOcclusion: shot.foregroundOcclusion,
    coverageRole: shot.coverageRole,
    cameraSlot: shot.cameraSlot,
    subject: shot.subject,
    screenDirection: shot.screenDirection,
    eyelineTarget: shot.eyelineTarget,
    transitionIn: shot.transitionIn,
    transitionOut: shot.transitionOut,
    continuityAnchor: shot.continuityAnchor,
  })).filter((shot) => shot.end - shot.start >= 0.4);
}

function coverageBible(plan: CinematicCoveragePlan) {
  const slots = plan.shots
    .map((shot) => `${shot.cameraSlot}: ${shot.subject} | ${shot.shotType} | ${shot.angle} | ${shot.lensMm}mm | ${shot.screenDirection} | eyeline=${shot.eyelineTarget}`)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 30);
  return [
    "# CINEMATIC COVERAGE DIRECTOR",
    `SUMMARY: ${plan.summary}`,
    `AXIS OF ACTION: ${plan.axisOfAction}`,
    `SPATIAL MAP: ${plan.spatialMap}`,
    `LIGHTING ANCHOR: ${plan.lightingAnchor}`,
    "RETURN-ANGLE RULE: when a later shot reuses the same cameraSlot, return to the same side of the axis, subject scale, lens family, camera height, screen direction, eyeline and lighting logic. It is the same physical camera setup revisited, not a redesign.",
    "EDIT RULE: shots may cut A → B → A, threat → reaction → threat, POV → reaction → POV, or master → detail → master. Every cut must reveal new story information while preserving one coherent physical world.",
    "TRANSITION RULE: use cut-on-action, foreground wipe, occlusion cut, doorway/wall reveal, match cut or hard cut only when motivated by the planned transition. Never teleport subjects between cuts.",
    "CAMERA SLOTS:",
    ...slots,
    "CONTINUITY RULES:",
    ...plan.continuityRules.map((rule) => `- ${rule}`),
  ].join("\n");
}

export function applyCinematicCoveragePlan(project: Project, plan: CinematicCoveragePlan): Project {
  const episode = project.episodes[0];
  if (!episode) return project;
  return {
    ...project,
    projectBible: [project.projectBible, coverageBible(plan)].filter(Boolean).join("\n\n"),
    episodes: [{
      ...episode,
      segments: episode.segments.map((scene, index) => ({
        ...scene,
        cameraShots: normalizedShotsForScene(scene, plan, index),
      })),
    }, ...project.episodes.slice(1)],
  };
}

export async function createCinematicCoveragePlan(input: {
  userId: string;
  project: Project;
  presetId?: string | null;
  customInstruction?: string | null;
  providerId: string;
  providerSupportsMultiShot: boolean;
  maxSecondsPerGeneration: number;
}) {
  const preset = cinematicCoveragePreset(input.presetId);
  const episode = input.project.episodes[0];
  if (!episode) throw new Error("COVERAGE_EPISODE_REQUIRED");
  const context = JSON.stringify({
    preset: { id: preset.id, name: preset.nameEn, instruction: preset.instruction },
    customInstruction: (input.customInstruction || "").slice(0, 3000),
    provider: {
      id: input.providerId,
      supportsMultiShot: input.providerSupportsMultiShot,
      maxSecondsPerGeneration: input.maxSecondsPerGeneration,
    },
    targetShotCount: targetShotRange(Number(episode.duration) || 30),
    project: compactProject(input.project),
  });
  const route = routeLlm({ task: "AGENT_PLAN", contextChars: context.length });
  const result = await callSystemAiFunction({
    userId: input.userId,
    runId: null,
    category: "CINEMATIC_COVERAGE_PLAN",
    referenceType: "studio-coverage",
    referenceId: input.project.id,
    openAiModelId: route.modelId,
    instructions: [
      "You are SCENOVA Cinematic Coverage Director and continuity editor.",
      "Create a real film-edit coverage plan, not one camera per scene. You may cut back and forth between characters, reactions, POV, over-the-shoulder, inserts, hidden observer angles and re-establishing masters when the story benefits.",
      "NEVER change story facts, dialogue text, character identity, wardrobe, props, location or user-locked creative facts.",
      "Every shot must reference an existing sceneId and stay inside that scene's global start/end time. Do not invent new scene IDs.",
      "Cover each scene continuously from its start to end. Prefer 1.2-4.0 second shots for normal dramatic coverage, but allow longer shots when motivated.",
      "Assign reusable cameraSlot IDs such as CAM_A_HERO_CU, CAM_B_OTHER_OTS, CAM_MASTER. If the edit returns to a subject/setup later, reuse the same slot so composition and screen direction remain consistent.",
      "Define a 180-degree axis, screen direction, eyeline targets, spatial anchors and motivated light direction. Preserve them across every cut unless a re-establishing shot clearly resets the axis.",
      "Use transitionIn/transitionOut deliberately: Hard Cut, Cut on Action, Match Cut, Foreground Wipe, Occlusion Cut, Doorway Reveal, Whip Pan, J-Cut or L-Cut. Do not overuse transitions.",
      "When providerSupportsMultiShot=false, still design the full editorial shot timeline. SCENOVA will generate shot-level internal clips and assemble them into one Final Video.",
      "Return only return_cinematic_coverage structured data.",
    ].join("\n"),
    prompt: context,
    tools: [{
      type: "function",
      name: "return_cinematic_coverage",
      description: "Return SCENOVA cinematic shot coverage with reusable camera slots and spatial continuity.",
      parameters: functionParameters as unknown as Record<string, unknown>,
      strict: true,
    }],
    maxOutputTokens: Math.max(3600, route.maxOutputTokens),
    metadata: {
      feature: "STUDIO_CINEMATIC_COVERAGE",
      presetId: preset.id,
      providerId: input.providerId,
      billingScope: "SCENOVA_SYSTEM",
      routerTier: route.tier,
    },
  });
  if (result.name !== "return_cinematic_coverage") throw new Error("SYSTEM_AI_COVERAGE_FUNCTION_NOT_RETURNED");
  const parsed = coveragePlanSchema.parse({ ...result.arguments, schemaVersion: "1.0", presetId: preset.id });
  const plan: CinematicCoveragePlan = {
    ...parsed,
    presetId: preset.id,
    continuityRules: [
      "Character identity, face, body proportions, hairstyle, costume and signature accessories remain identical across all return angles.",
      "Location geometry, doors, walls, furniture, props and distances remain fixed between reverse angles.",
      "Screen direction and eyelines remain consistent with the established 180-degree axis.",
      "Lighting direction, time of day, color temperature and shadow logic stay continuous unless the story explicitly changes them.",
      ...parsed.continuityRules,
    ].filter((value, index, array) => array.indexOf(value) === index),
  };
  return {
    plan,
    project: applyCinematicCoveragePlan(input.project, plan),
    meta: { modelId: result.modelId, costThb: result.costThb, preset },
  };
}
