import type { ProductionAnalysis } from "@/lib/analyzer/schema";
import {
  CAMERA_ANGLES,
  CAMERA_HEIGHTS,
  CAMERA_MOVEMENTS,
  CAMERA_SPEEDS,
  COLOR_TEMPERATURES,
  COMPOSITION_OPTIONS,
  DOF_OPTIONS,
  EMOTIONS,
  FOCUS_OPTIONS,
  LENSES,
  LIGHTING_STYLES,
  OBJECTIVE_PRESETS,
  PERFORMANCE_OPTIONS,
  SCENE_BEATS,
  SHOT_TYPES,
  TRANSITIONS,
  type ProductionChoice,
} from "@/lib/production-options";
import { AMBIENCE_PRESETS, MUSIC_PRESETS, SFX_PRESETS } from "@/lib/sound-design-options";
import { getVideoUiCapability } from "@/lib/providers/video-ui-capabilities";

export type AiDirectorMode = "production" | "cinematic" | "story" | "realistic" | "emotion" | "surprise";
export type AiDirectorNovelty = "safe" | "balanced" | "different" | "experimental";
export type AiDirectorScope = "all" | "story" | "camera" | "look" | "sound" | "continuity";
export type AiDirectorFillMode = "replace-scope" | "empty-only";

export type ManualAiSections = {
  blocking: boolean;
  camera: boolean;
  look: boolean;
  sound: boolean;
  continuity: boolean;
};

export type AiDirectorCharacterDirection = {
  blocking: string;
  action: string;
  emotion: string;
  eyeline: string;
  dialogue: string;
};

export type AiDirectorScene = {
  id?: string;
  title: string;
  duration: number;
  location: string;
  objective: string;
  beat: string;
  transition: string;
  action: string;
  dialogue: string;
  characterIds: string[];
  animalIds: string[];
  characterDirections: Record<string, AiDirectorCharacterDirection>;
  cameraSubjectId: string;
  shot: string;
  angle: string;
  lens: string;
  movement: string;
  height: string;
  cameraSpeed: string;
  focus: string;
  dof: string;
  composition: string;
  lighting: string;
  colorTemp: string;
  emotion: string;
  performance: string;
  ambience: string;
  secondaryAmbience: string;
  sfx: string;
  sfxTimeline: string;
  music: string;
  ambienceLevel: number;
  sfxLevel: number;
  dialogueLevel: number;
  musicLevel: number;
  continuityNote: string;
  negativePrompt: string;
};

export type AiDirectorScenePatch = Partial<AiDirectorScene>;

export type AiDirectorHistoryEntry = {
  fingerprint: string;
  profile: string;
  fields: AiDirectorScenePatch;
  createdAt: number;
};

export type AiDirectorScores = {
  storyFit: number;
  coherence: number;
  continuity: number;
  novelty: number;
  modelSupport: number;
  pacing: number;
  total: number;
};

export type AiDirectorAlternative = {
  profile: string;
  labelTh: string;
  probability: number;
  score: number;
};

export type AiDirectorCapability = {
  model: string;
  timelineDurationSec: number;
  renderDurationSec: number;
  trimSec: number;
  aspectSupported: boolean;
  durationSupported: boolean;
  cameraControl: "prompt";
  lightingControl: "prompt";
  audioControl: "prompt";
  continuityControl: "scenova";
};

export type AiDirectorValidation = {
  ok: boolean;
  warnings: string[];
};

export type AiDirectorMeta = {
  seed: number;
  fingerprint: string;
  profile: string;
  profileLabelTh: string;
  rationaleTh: string;
  scores: AiDirectorScores;
  alternatives: AiDirectorAlternative[];
  capability: AiDirectorCapability;
  validation: AiDirectorValidation;
  changedFields: string[];
  frozenSections: string[];
  historyEntry: AiDirectorHistoryEntry;
};

export type AiDirectorPlan = {
  scene: AiDirectorScenePatch;
  meta: AiDirectorMeta;
};

export type AiDirectorCastMember = {
  id: string;
  name: string;
  role: string;
  appearance?: string;
  voice?: string;
};

export type AiDirectorRequest = {
  mode: AiDirectorMode;
  novelty: AiDirectorNovelty;
  scope: AiDirectorScope;
  fillMode: AiDirectorFillMode;
  seed: number;
  episodeTitle: string;
  story: string;
  model: string;
  modelVersion?: string;
  aspect: string;
  visualStyle: string;
  locks: string[];
  totalDuration: number;
  sceneIndex: number;
  sceneCount: number;
  currentScene: AiDirectorScene;
  previousScene?: AiDirectorScene | null;
  nextScene?: AiDirectorScene | null;
  cast: AiDirectorCastMember[];
  manualSections: ManualAiSections;
  history: AiDirectorHistoryEntry[];
  analysis: ProductionAnalysis;
};

type ProfileId = "establish" | "dialogue" | "intimate" | "tension" | "action" | "reveal" | "mystery" | "release";

type Signal = {
  action: number;
  tension: number;
  emotion: number;
  mystery: number;
  dialogue: number;
  reveal: number;
  calm: number;
  arc: number;
};

type Candidate = {
  profile: ProfileId;
  labelTh: string;
  scene: AiDirectorScene;
  scores: AiDirectorScores;
  fingerprint: string;
};

const PROFILE_LABELS: Record<ProfileId, string> = {
  establish: "Establish — เปิดโลกและพื้นที่",
  dialogue: "Dialogue — สนทนาอ่านอารมณ์",
  intimate: "Intimate — เข้าใกล้อารมณ์",
  tension: "Tension — กดดันแบบค่อยเป็นค่อยไป",
  action: "Action — เคลื่อนตามเหตุการณ์",
  reveal: "Reveal — เน้นข้อมูลหรือจุดเปิดเผย",
  mystery: "Mystery — เว้นพื้นที่ให้ความไม่แน่นอน",
  release: "Release — คลายแรงและปิดจังหวะ",
};

const CAMERA_FIELDS = ["cameraSubjectId", "shot", "angle", "lens", "movement", "height", "cameraSpeed", "focus", "dof", "composition"] as const;
const LOOK_FIELDS = ["lighting", "colorTemp", "emotion", "performance"] as const;
const SOUND_FIELDS = ["ambience", "secondaryAmbience", "sfx", "sfxTimeline", "music", "ambienceLevel", "sfxLevel", "dialogueLevel", "musicLevel"] as const;
const CONTINUITY_FIELDS = ["continuityNote", "negativePrompt"] as const;
const STORY_FIELDS = ["location", "objective", "beat", "transition", "action", "dialogue", "characterIds", "animalIds", "characterDirections"] as const;

const COMPARISON_WEIGHTS: Array<[keyof AiDirectorScene, number]> = [
  ["shot", 1.4], ["angle", 1.0], ["lens", 1.2], ["movement", 1.4], ["height", 0.6],
  ["composition", 1.0], ["dof", 0.8], ["lighting", 1.1], ["colorTemp", 0.6], ["emotion", 0.8],
  ["performance", 0.7], ["ambience", 0.5], ["music", 0.6], ["sfx", 0.4], ["objective", 0.7], ["beat", 0.7],
];

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 3) {
  const scale = Math.pow(10, digits);
  return Math.round(value * scale) / scale;
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase().replace(/[\s_\-—–/]+/g, " ");
}

function hasAny(text: string, words: string[]) {
  return words.some((word) => text.includes(normalize(word)));
}

function makeRng(seed: number) {
  let state = (Math.abs(Math.trunc(seed)) || 1) >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], rng: () => number, fallback: T): T {
  if (!items.length) return fallback;
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))] ?? fallback;
}

function weightedPick<T>(items: Array<{ value: T; weight: number }>, rng: () => number, fallback: T): T {
  const valid = items.filter((item) => Number.isFinite(item.weight) && item.weight > 0);
  const total = valid.reduce((sum, item) => sum + item.weight, 0);
  if (!valid.length || total <= 0) return fallback;
  let cursor = rng() * total;
  for (const item of valid) {
    cursor -= item.weight;
    if (cursor <= 0) return item.value;
  }
  return valid[valid.length - 1].value;
}

function realChoices(options: ProductionChoice[]) {
  return options.filter((item) => normalize(item.value) !== "ai");
}

function firstReal(options: ProductionChoice[], fallback = "") {
  return realChoices(options)[0]?.value || fallback;
}

function closestChoice(value: unknown, options: ProductionChoice[], fallback?: string) {
  const needle = normalize(value);
  const choices = realChoices(options);
  if (!choices.length) return fallback || "";
  if (!needle) return fallback && choices.some((item) => item.value === fallback) ? fallback : choices[0].value;
  const exact = choices.find((item) => normalize(item.value) === needle || normalize(item.label) === needle);
  if (exact) return exact.value;
  const partial = choices.find((item) => normalize(item.value).includes(needle) || needle.includes(normalize(item.value)) || normalize(item.label).includes(needle));
  return partial?.value || (fallback && choices.some((item) => item.value === fallback) ? fallback : choices[0].value);
}

function findChoice(options: ProductionChoice[], needles: string[], fallback?: string, rng?: () => number) {
  const tokens = needles.map(normalize).filter(Boolean);
  const matches = realChoices(options).filter((item) => {
    const haystack = normalize(item.value + " " + item.label + " " + item.help);
    return tokens.some((token) => haystack.includes(token));
  });
  if (matches.length) {
    const selected = rng ? pick(matches, rng, matches[0]) : matches[0];
    return selected.value;
  }
  return closestChoice(fallback, options, firstReal(options, fallback || ""));
}

function choiceLabel(value: string, options: ProductionChoice[]) {
  return options.find((item) => item.value === value)?.label || value;
}

function parseLens(lens: string) {
  const match = String(lens).match(/(\d+)/);
  return match ? Number(match[1]) : lens.toLowerCase().includes("macro") ? 120 : 50;
}

function lensFamily(lens: string) {
  const mm = parseLens(lens);
  return mm <= 35 ? "wide" : mm <= 65 ? "normal" : "tele";
}

function movementFamily(movement: string) {
  const value = normalize(movement);
  if (hasAny(value, ["static"])) return "static";
  if (hasAny(value, ["whip", "handheld", "tracking", "orbit"])) return "energetic";
  return "smooth";
}

function semanticValueSimilarity(key: keyof AiDirectorScene, left: unknown, right: unknown) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a && !b) return 1;
  if (a === b) return 1;
  if (key === "lens" && lensFamily(String(left)) === lensFamily(String(right))) return 0.58;
  if (key === "movement" && movementFamily(String(left)) === movementFamily(String(right))) return 0.55;
  if (a && b && (a.includes(b) || b.includes(a))) return 0.45;
  return 0;
}

export function sceneSimilarity(left: AiDirectorScenePatch, right: AiDirectorScenePatch) {
  let same = 0;
  let total = 0;
  for (const [key, weight] of COMPARISON_WEIGHTS) {
    if (left[key] === undefined || right[key] === undefined) continue;
    same += semanticValueSimilarity(key, left[key], right[key]) * weight;
    total += weight;
  }
  return total > 0 ? clamp(same / total) : 0;
}

function fingerprint(scene: AiDirectorScene) {
  return [scene.shot, scene.angle, scene.lens, scene.movement, scene.composition, scene.lighting, scene.emotion, scene.music]
    .map((item) => normalize(item).replace(/\s+/g, "-"))
    .join("|");
}

function deriveSignals(input: AiDirectorRequest): Signal {
  const text = normalize([
    input.story,
    input.previousScene?.objective,
    input.previousScene?.beat,
    input.previousScene?.action,
    input.previousScene?.dialogue,
    input.currentScene.objective,
    input.currentScene.beat,
    input.currentScene.action,
    input.currentScene.dialogue,
    input.nextScene?.objective,
    input.nextScene?.beat,
    input.nextScene?.action,
    input.nextScene?.dialogue,
    input.analysis.intent,
    input.analysis.summaryTh,
    input.analysis.scene.description,
    input.analysis.lighting.mood,
  ].join(" "));
  const count = Math.max(1, input.sceneCount - 1);
  const arc = clamp(input.sceneIndex / count);
  const action = hasAny(text, ["action", "fight", "chase", "run", "battle", "ต่อสู้", "ไล่", "วิ่ง", "ปะทะ", "หนี", "ระเบิด"]) ? 1 : 0.15;
  const tension = hasAny(text, ["tension", "suspicion", "threat", "danger", "กดดัน", "ตึง", "ระแวง", "อันตราย", "คุกคาม"]) ? 1 : 0.2 + arc * 0.2;
  const emotion = hasAny(text, ["emotion", "cry", "love", "sad", "fear", "เสียใจ", "รัก", "ร้องไห้", "อารมณ์", "กลัว", "คิดถึง"]) ? 1 : 0.25;
  const mystery = hasAny(text, ["mystery", "secret", "hidden", "unknown", "ลึกลับ", "ความลับ", "ปิดบัง", "ไม่รู้", "ปริศนา"]) ? 1 : 0.18;
  const reveal = hasAny(text, ["reveal", "discover", "find", "เปิดเผย", "ค้นพบ", "พบว่า", "เฉลย"]) ? 1 : 0.12 + arc * 0.15;
  const calm = hasAny(text, ["calm", "quiet", "peace", "สงบ", "เงียบ", "อ่อนโยน", "ผ่อนคลาย"]) ? 1 : 0.2;
  const dialogue = input.analysis.characters.some((character) => Boolean(character.dialogue?.trim())) || input.currentScene.characterIds.length >= 2 ? 0.95 : 0.25;
  return { action, tension, emotion, mystery, dialogue, reveal, calm, arc };
}

function profileWeights(signal: Signal, mode: AiDirectorMode, sceneIndex: number, sceneCount: number) {
  const weights: Record<ProfileId, number> = {
    establish: sceneIndex === 0 ? 1.3 : 0.22,
    dialogue: 0.35 + signal.dialogue * 0.9,
    intimate: 0.25 + signal.emotion * 0.75,
    tension: 0.25 + signal.tension * 0.95,
    action: 0.12 + signal.action * 1.15,
    reveal: 0.18 + signal.reveal * 1.0,
    mystery: 0.16 + signal.mystery * 1.05,
    release: sceneIndex === sceneCount - 1 ? 1.05 : 0.12 + signal.calm * 0.3,
  };
  if (mode === "cinematic") {
    weights.establish *= 1.15;
    weights.intimate *= 1.15;
    weights.reveal *= 1.1;
  } else if (mode === "story") {
    weights.dialogue *= 1.12;
    weights.reveal *= 1.22;
    weights.establish *= 1.08;
  } else if (mode === "realistic") {
    weights.dialogue *= 1.18;
    weights.release *= 1.14;
    weights.action *= 0.85;
  } else if (mode === "emotion") {
    weights.intimate *= 1.45;
    weights.dialogue *= 1.15;
  } else if (mode === "surprise") {
    (Object.keys(weights) as ProfileId[]).forEach((key) => { weights[key] = Math.max(0.4, weights[key]); });
    weights.mystery *= 1.18;
    weights.reveal *= 1.18;
  }
  return weights;
}

function profileStoryFit(profile: ProfileId, signal: Signal, sceneIndex: number, sceneCount: number) {
  const fits: Record<ProfileId, number> = {
    establish: sceneIndex === 0 ? 0.98 : 0.58,
    dialogue: 0.58 + signal.dialogue * 0.38,
    intimate: 0.55 + signal.emotion * 0.39,
    tension: 0.52 + signal.tension * 0.42,
    action: 0.48 + signal.action * 0.48,
    reveal: 0.52 + signal.reveal * 0.43,
    mystery: 0.5 + signal.mystery * 0.44,
    release: sceneIndex === sceneCount - 1 ? 0.94 : 0.5 + signal.calm * 0.3,
  };
  return clamp(fits[profile]);
}

function analyzerCamera(input: AiDirectorRequest) {
  const analysis = input.analysis;
  return {
    shot: closestChoice(analysis.camera.shotType, SHOT_TYPES, input.currentScene.shot),
    angle: closestChoice(analysis.camera.angle, CAMERA_ANGLES, input.currentScene.angle),
    lens: closestChoice(analysis.camera.lensMm ? String(analysis.camera.lensMm) + "mm" : "", LENSES, input.currentScene.lens),
    movement: closestChoice(analysis.camera.movement, CAMERA_MOVEMENTS, input.currentScene.movement),
    height: closestChoice(analysis.camera.cameraHeight, CAMERA_HEIGHTS, input.currentScene.height),
    composition: closestChoice(analysis.camera.composition, COMPOSITION_OPTIONS, input.currentScene.composition),
    dof: closestChoice(analysis.camera.depthOfField, DOF_OPTIONS, input.currentScene.dof),
  };
}

function profileCamera(profile: ProfileId, input: AiDirectorRequest, rng: () => number) {
  const ai = analyzerCamera(input);
  const choose = (options: ProductionChoice[], terms: string[], fallback: string) => findChoice(options, terms, fallback, rng);
  const cameraByProfile: Record<ProfileId, {
    shot: string[]; angle: string[]; lens: string[]; movement: string[]; height: string[]; speed: string[]; focus: string[]; dof: string[]; composition: string[];
  }> = {
    establish: { shot: ["extreme wide", "wide"], angle: ["eye level", "high angle"], lens: ["24mm", "28mm", "35mm"], movement: ["dolly", "crane", "pull out", "static"], height: ["eye", "above head", "chest"], speed: ["slow", "normal"], focus: ["deep", "auto subject"], dof: ["deep", "natural"], composition: ["rule of thirds", "leading", "symmetry"] },
    dialogue: { shot: ["medium", "ots"], angle: ["eye level", "three quarter"], lens: ["50mm", "65mm"], movement: ["static", "push in", "dolly"], height: ["eye", "chest"], speed: ["slow", "normal"], focus: ["auto subject", "face"], dof: ["natural", "shallow"], composition: ["rule of thirds", "balanced", "over shoulder"] },
    intimate: { shot: ["close up", "medium"], angle: ["eye level", "three quarter"], lens: ["65mm", "85mm"], movement: ["push in", "static", "dolly"], height: ["eye", "chest"], speed: ["slow"], focus: ["face", "auto subject"], dof: ["shallow"], composition: ["rule of thirds", "center", "negative space"] },
    tension: { shot: ["close up", "medium", "ots"], angle: ["eye level", "low angle", "high angle"], lens: ["65mm", "85mm", "50mm"], movement: ["push in", "handheld", "static"], height: ["eye", "chest", "waist"], speed: ["slow", "normal"], focus: ["auto subject", "face"], dof: ["shallow", "natural"], composition: ["negative space", "rule of thirds", "center"] },
    action: { shot: ["wide", "full", "medium"], angle: ["side view", "low angle", "three quarter"], lens: ["24mm", "28mm", "35mm"], movement: ["tracking", "handheld", "whip", "lateral"], height: ["waist", "chest", "knee"], speed: ["fast", "normal"], focus: ["auto subject", "deep"], dof: ["natural", "deep"], composition: ["leading", "rule of thirds", "diagonal"] },
    reveal: { shot: ["insert", "close up", "medium"], angle: ["eye level", "three quarter", "high angle"], lens: ["65mm", "85mm", "100mm", "macro"], movement: ["push in", "static", "dolly"], height: ["eye", "chest", "above head"], speed: ["slow", "normal"], focus: ["auto subject", "rack", "face"], dof: ["shallow", "natural"], composition: ["rule of thirds", "center", "negative space"] },
    mystery: { shot: ["wide", "close up", "ots"], angle: ["rear view", "three quarter", "high angle"], lens: ["35mm", "65mm", "85mm"], movement: ["lateral", "push in", "static"], height: ["eye", "chest", "above head"], speed: ["slow"], focus: ["auto subject", "rack"], dof: ["shallow", "natural"], composition: ["negative space", "rule of thirds", "frame within"] },
    release: { shot: ["wide", "medium"], angle: ["eye level", "rear view", "high angle"], lens: ["35mm", "50mm"], movement: ["pull out", "dolly", "static"], height: ["eye", "chest"], speed: ["slow", "normal"], focus: ["deep", "auto subject"], dof: ["natural", "deep"], composition: ["rule of thirds", "symmetry", "center"] },
  };
  const bundle = cameraByProfile[profile];
  const blendAnalyzer = input.mode !== "surprise" && rng() < (input.novelty === "safe" ? 0.58 : input.novelty === "balanced" ? 0.38 : 0.2);
  return {
    shot: blendAnalyzer ? ai.shot : choose(SHOT_TYPES, bundle.shot, ai.shot),
    angle: blendAnalyzer && rng() < 0.65 ? ai.angle : choose(CAMERA_ANGLES, bundle.angle, ai.angle),
    lens: blendAnalyzer && rng() < 0.6 ? ai.lens : choose(LENSES, bundle.lens, ai.lens),
    movement: blendAnalyzer && rng() < 0.45 ? ai.movement : choose(CAMERA_MOVEMENTS, bundle.movement, ai.movement),
    height: choose(CAMERA_HEIGHTS, bundle.height, ai.height),
    cameraSpeed: choose(CAMERA_SPEEDS, bundle.speed, input.currentScene.cameraSpeed),
    focus: choose(FOCUS_OPTIONS, bundle.focus, input.currentScene.focus),
    dof: blendAnalyzer && rng() < 0.5 ? ai.dof : choose(DOF_OPTIONS, bundle.dof, ai.dof),
    composition: blendAnalyzer && rng() < 0.45 ? ai.composition : choose(COMPOSITION_OPTIONS, bundle.composition, ai.composition),
  };
}

function profileLook(profile: ProfileId, input: AiDirectorRequest, rng: () => number) {
  const mood = normalize(input.analysis.lighting.mood + " " + input.story + " " + input.visualStyle);
  const analysisLighting = closestChoice(input.analysis.lighting.style, LIGHTING_STYLES, input.currentScene.lighting);
  const emotion = closestChoice(input.analysis.characters[0]?.emotion || input.analysis.lighting.mood, EMOTIONS, input.currentScene.emotion);
  const lightingTerms: Record<ProfileId, string[]> = {
    establish: ["natural", "soft", "day", "ambient"],
    dialogue: ["natural soft", "soft", "motivated"],
    intimate: ["soft", "motivated", "low key"],
    tension: ["low key", "contrast", "dramatic"],
    action: ["high contrast", "hard", "dramatic"],
    reveal: ["motivated", "dramatic", "low key"],
    mystery: ["low key", "moon", "dramatic"],
    release: ["natural soft", "golden", "soft"],
  };
  const performanceTerms: Record<ProfileId, string[]> = {
    establish: ["natural", "restrained"], dialogue: ["natural", "subtle"], intimate: ["subtle", "restrained", "emotional"], tension: ["restrained", "intense"],
    action: ["intense", "expressive"], reveal: ["restrained", "intense"], mystery: ["restrained", "subtle"], release: ["natural", "subtle"],
  };
  const lighting = rng() < 0.35 ? analysisLighting : findChoice(LIGHTING_STYLES, lightingTerms[profile], analysisLighting, rng);
  const warm = hasAny(mood, ["warm", "gold", "sunset", "อบอุ่น", "ทอง"]);
  const cool = hasAny(mood, ["cool", "blue", "night", "moon", "เย็น", "กลางคืน", "มืด"]);
  const colorTemp = warm
    ? findChoice(COLOR_TEMPERATURES, ["warm", "3200", "gold"], input.currentScene.colorTemp, rng)
    : cool
      ? findChoice(COLOR_TEMPERATURES, ["cool", "7000", "blue"], input.currentScene.colorTemp, rng)
      : findChoice(COLOR_TEMPERATURES, ["neutral", "4500"], input.currentScene.colorTemp, rng);
  const performance = findChoice(PERFORMANCE_OPTIONS, performanceTerms[profile], input.currentScene.performance, rng);
  return { lighting, colorTemp, emotion, performance };
}

function profileAudio(profile: ProfileId, input: AiDirectorRequest, rng: () => number) {
  const text = normalize(input.story + " " + input.currentScene.location + " " + input.analysis.scene.location + " " + input.analysis.scene.description);
  let ambienceTerms = [input.analysis.audio.ambience];
  if (hasAny(text, ["rain", "ฝน"])) ambienceTerms = ["rain"];
  else if (hasAny(text, ["forest", "ป่า"])) ambienceTerms = [hasAny(text, ["night", "กลางคืน"]) ? "forest night" : "forest day"];
  else if (hasAny(text, ["city", "เมือง", "street", "ถนน"])) ambienceTerms = [hasAny(text, ["night", "กลางคืน"]) ? "city night" : "city day"];
  else if (hasAny(text, ["space", "spaceship", "ยาน", "ไซไฟ", "sci fi"])) ambienceTerms = ["spaceship", "sci fi hum"];
  else if (profile === "tension" || profile === "mystery") ambienceTerms = ["horror room tone", "room tone"];
  else ambienceTerms.push("room tone");
  const ambience = findChoice(AMBIENCE_PRESETS, ambienceTerms, closestChoice(input.analysis.audio.ambience, AMBIENCE_PRESETS, input.currentScene.ambience), rng);
  const secondaryAmbience = findChoice(AMBIENCE_PRESETS, profile === "action" ? ["room tone", "city"] : ["silence", "room tone"], input.currentScene.secondaryAmbience, rng);

  const sfxText = normalize(input.analysis.audio.soundEffects.join(" ") + " " + input.analysis.scene.description + " " + input.currentScene.action);
  let sfxTerms = input.analysis.audio.soundEffects;
  if (hasAny(sfxText, ["door", "ประตู"])) sfxTerms = ["door"];
  else if (hasAny(sfxText, ["foot", "step", "เดิน", "วิ่ง", "ฝีเท้า"])) sfxTerms = ["footsteps"];
  else if (hasAny(sfxText, ["phone", "โทรศัพท์", "ข้อความ"])) sfxTerms = ["phone notification"];
  else if (hasAny(sfxText, ["impact", "hit", "ชน", "กระแทก", "ต่อสู้"])) sfxTerms = ["impact"];
  else if (!sfxTerms.length) sfxTerms = ["none"];
  const sfx = findChoice(SFX_PRESETS, sfxTerms, closestChoice(input.analysis.audio.soundEffects[0], SFX_PRESETS, input.currentScene.sfx), rng);

  const musicTerms: Record<ProfileId, string[]> = {
    establish: ["cinematic", "ambient", "none"], dialogue: ["none", "minimal", "soft"], intimate: ["emotion", "soft", "romance"], tension: ["tension", "suspense", "dark"],
    action: ["action", "pulse", "epic"], reveal: ["tension", "cinematic", "minimal"], mystery: ["mystery", "suspense", "dark"], release: ["warm", "soft", "none"],
  };
  const music = rng() < 0.35
    ? closestChoice(input.analysis.audio.music, MUSIC_PRESETS, input.currentScene.music)
    : findChoice(MUSIC_PRESETS, musicTerms[profile], closestChoice(input.analysis.audio.music, MUSIC_PRESETS, input.currentScene.music), rng);

  const mixes: Record<ProfileId, [number, number, number, number]> = {
    establish: [65, 55, 95, 35], dialogue: [48, 52, 100, 22], intimate: [45, 42, 100, 30], tension: [58, 70, 100, 36],
    action: [54, 86, 92, 48], reveal: [50, 74, 100, 32], mystery: [64, 62, 100, 30], release: [60, 45, 100, 28],
  };
  const [ambienceLevel, sfxLevel, dialogueLevel, musicLevel] = mixes[profile];
  return { ambience, secondaryAmbience, sfx, music, ambienceLevel, sfxLevel, dialogueLevel, musicLevel };
}

function sceneObjective(profile: ProfileId, input: AiDirectorRequest, rng: () => number) {
  const terms: Record<ProfileId, string[]> = {
    establish: ["establish"], dialogue: ["develop", "relationship", "information"], intimate: ["emotion", "character"], tension: ["tension"],
    action: ["action", "conflict"], reveal: ["reveal", "information"], mystery: ["mystery", "tension"], release: ["resolve", "exit"],
  };
  return findChoice(OBJECTIVE_PRESETS, terms[profile], input.currentScene.objective, rng);
}

function sceneBeat(profile: ProfileId, input: AiDirectorRequest, rng: () => number) {
  if (input.sceneIndex === 0) return findChoice(SCENE_BEATS, ["opening", "setup"], input.currentScene.beat, rng);
  if (input.sceneIndex === input.sceneCount - 1) return findChoice(SCENE_BEATS, ["exit", "resolve", "closing"], input.currentScene.beat, rng);
  const terms: Record<ProfileId, string[]> = {
    establish: ["setup"], dialogue: ["develop", "turn"], intimate: ["emotion", "turn"], tension: ["rise", "turn"],
    action: ["peak", "rise"], reveal: ["reveal", "turn"], mystery: ["turn", "rise"], release: ["fall", "resolve"],
  };
  return findChoice(SCENE_BEATS, terms[profile], input.currentScene.beat, rng);
}

function sceneTransition(profile: ProfileId, input: AiDirectorRequest, rng: () => number) {
  if (input.sceneIndex === input.sceneCount - 1) return findChoice(TRANSITIONS, ["fade", "cut"], input.currentScene.transition, rng);
  if (profile === "action") return findChoice(TRANSITIONS, ["whip", "hard cut", "cut"], input.currentScene.transition, rng);
  if (profile === "release") return findChoice(TRANSITIONS, ["fade", "seamless"], input.currentScene.transition, rng);
  return findChoice(TRANSITIONS, ["seamless", "hard cut", "cut"], input.currentScene.transition, rng);
}

function selectCharacters(input: AiDirectorRequest) {
  if (input.fillMode === "empty-only" && input.currentScene.characterIds.length) {
    const fixed = input.currentScene.characterIds
      .map((id) => input.cast.find((item) => item.id === id))
      .filter((item): item is AiDirectorCastMember => Boolean(item));
    if (fixed.length) return fixed;
  }
  const matched: AiDirectorCastMember[] = [];
  for (const suggestion of input.analysis.characters) {
    const wanted = normalize(suggestion.name);
    const member = input.cast.find((candidate) => {
      const name = normalize(candidate.name);
      return name === wanted || (name && wanted.includes(name)) || (wanted && name.includes(wanted));
    });
    if (member && !matched.some((item) => item.id === member.id)) matched.push(member);
  }
  if (matched.length) return matched;
  const current = input.currentScene.characterIds.map((id) => input.cast.find((item) => item.id === id)).filter((item): item is AiDirectorCastMember => Boolean(item));
  if (current.length) return current;
  return input.cast.slice(0, Math.min(2, input.cast.length));
}

function estimateSpeechSeconds(text: string) {
  const clean = text.replace(/^[^:]{1,40}:\s*/gm, "").trim();
  if (!clean) return 0;
  const thaiChars = (clean.match(/[\u0E00-\u0E7F]/g) || []).length;
  const latinWords = (clean.match(/[A-Za-z0-9']+/g) || []).length;
  const thaiSeconds = thaiChars / 9.5;
  const latinSeconds = latinWords / 2.55;
  return Math.max(thaiSeconds, latinSeconds, clean.length / 24);
}

function trimToBudget(text: string, maxSeconds: number) {
  const clean = text.trim();
  if (!clean || estimateSpeechSeconds(clean) <= maxSeconds) return clean;
  const thaiChars = (clean.match(/[\u0E00-\u0E7F]/g) || []).length;
  const maxChars = thaiChars > 0 ? Math.max(8, Math.floor(maxSeconds * 9.2)) : Math.max(12, Math.floor(maxSeconds * 15));
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > Math.floor(maxChars * 0.55) ? slice.slice(0, lastSpace) : slice).replace(/[,:;\-–—\s]+$/g, "").trim() + "…";
}

function buildDirections(profile: ProfileId, input: AiDirectorRequest, selected: AiDirectorCastMember[], rng: () => number) {
  const result: Record<string, AiDirectorCharacterDirection> = {};
  const spokenBudget = Math.max(0, input.currentScene.duration * (profile === "action" ? 0.48 : 0.72));
  const perCharacter = selected.length ? spokenBudget / selected.length : 0;
  selected.forEach((character, index) => {
    const suggestion = input.analysis.characters.find((item) => {
      const suggested = normalize(item.name);
      const actual = normalize(character.name);
      return suggested === actual || suggested.includes(actual) || actual.includes(suggested);
    });
    const current = input.currentScene.characterDirections[character.id] || { blocking: "", action: "", emotion: "", eyeline: "", dialogue: "" };
    const opposite = selected.length > 1 ? selected[(index + 1) % selected.length] : null;
    const leftFirst = rng() < 0.5;
    const side = selected.length === 1 ? "กลางเฟรม / จุดเด่นหลัก" : ((index + (leftFirst ? 0 : 1)) % 2 === 0 ? "ซ้ายเฟรม" : "ขวาเฟรม");
    const blocking = side + (opposite ? " หันเข้าหา " + opposite.name : " เคลื่อนตาม Action หลักของฉาก");
    const generated: AiDirectorCharacterDirection = {
      blocking,
      action: suggestion?.action?.trim() || current.action || "ตอบสนองต่อเหตุการณ์หลักของฉากอย่างต่อเนื่อง",
      emotion: closestChoice(suggestion?.emotion, EMOTIONS, current.emotion || "Natural"),
      eyeline: opposite ? "มอง " + opposite.name : (profile === "reveal" ? "มองจุดข้อมูลสำคัญในฉาก" : current.eyeline || "มองตามทิศทาง Action"),
      dialogue: trimToBudget(suggestion?.dialogue || current.dialogue || "", perCharacter),
    };
    result[character.id] = input.fillMode === "empty-only" ? {
      blocking: current.blocking.trim() ? current.blocking : generated.blocking,
      action: current.action.trim() ? current.action : generated.action,
      emotion: current.emotion.trim() ? current.emotion : generated.emotion,
      eyeline: current.eyeline.trim() ? current.eyeline : generated.eyeline,
      dialogue: current.dialogue.trim() ? current.dialogue : generated.dialogue,
    } : generated;
  });
  return result;
}

function combinedDialogue(selected: AiDirectorCastMember[], directions: Record<string, AiDirectorCharacterDirection>) {
  return selected.map((character) => {
    const line = directions[character.id]?.dialogue?.trim();
    return line ? character.name + ": " + line : "";
  }).filter(Boolean).join("\n");
}

function sfxTimeline(sfx: string, duration: number) {
  if (!sfx || normalize(sfx) === "none" || duration <= 0.7) return "";
  const at = Math.min(Math.max(0.4, duration * 0.58), Math.max(0.4, duration - 0.25));
  const minutes = Math.floor(at / 60);
  const seconds = at - minutes * 60;
  const stamp = String(minutes).padStart(2, "0") + ":" + seconds.toFixed(1).padStart(4, "0");
  return stamp + " " + choiceLabel(sfx, SFX_PRESETS).split(" — ")[0];
}

function continuityNote(input: AiDirectorRequest, selected: AiDirectorCastMember[], scene: AiDirectorScene) {
  const notes: string[] = [];
  if (input.previousScene) notes.push("ต่อจากฉากก่อน: รักษาทิศทางการเคลื่อนและสถานะล่าสุดของตัวละคร/พร็อพ");
  if (selected.length) notes.push("ตัวละครคงเดิม: " + selected.map((item) => item.name).join(", "));
  if (scene.location) notes.push("สถานที่: " + scene.location + " ต้องคงโครงสร้างและตำแหน่งวัตถุสำคัญ");
  if (input.locks.includes("Camera Language")) notes.push("รักษาภาษากล้องของตอนใน lens family และจังหวะ movement เดียวกัน");
  if (input.locks.includes("Lighting")) notes.push("รักษาทิศทางและคุณภาพแสงจากค่าที่ล็อกไว้");
  if (input.locks.includes("Props")) notes.push("ห้ามพร็อพสำคัญเปลี่ยนรูปร่าง สี เจ้าของ หรือตำแหน่งโดยไม่มี Action รองรับ");
  return notes.join("\n");
}

function negativePrompt(input: AiDirectorRequest, selected: AiDirectorCastMember[]) {
  const negatives = new Set<string>();
  input.analysis.generation.negativePrompt.forEach((item) => item.trim() && negatives.add(item.trim()));
  ["identity drift", "face morphing", "character swapping", "duplicated people", "extra limbs", "warped anatomy", "unwanted text", "watermark"].forEach((item) => negatives.add(item));
  if (selected.length > 1) negatives.add("inconsistent eyelines");
  if (input.analysis.characters.some((character) => Boolean(character.dialogue?.trim()))) negatives.add("lip-sync mismatch");
  if (input.locks.includes("Character")) negatives.add("costume or identity change");
  if (input.locks.includes("Voice")) negatives.add("voice swapping");
  if (input.locks.includes("Props")) negatives.add("prop drift or disappearing props");
  if (input.locks.includes("Location")) negatives.add("location layout drift");
  negatives.add("abrupt camera jump without motivated transition");
  return Array.from(negatives).slice(0, 18).join(", ");
}

function resolvedLocation(input: AiDirectorRequest) {
  if (input.currentScene.location.trim() && input.fillMode === "empty-only") return input.currentScene.location;
  if (input.locks.includes("Location") && input.currentScene.location.trim()) return input.currentScene.location;
  return input.analysis.scene.location?.trim() || input.currentScene.location;
}

function buildCandidate(profile: ProfileId, input: AiDirectorRequest, seed: number, signal: Signal): AiDirectorScene {
  const rng = makeRng(seed);
  const camera = profileCamera(profile, input, rng);
  const look = profileLook(profile, input, rng);
  const audio = profileAudio(profile, input, rng);
  const selected = selectCharacters(input);
  const directions = input.manualSections.blocking
    ? input.currentScene.characterDirections
    : buildDirections(profile, input, selected, rng);
  const dialogue = input.manualSections.blocking
    ? input.currentScene.dialogue
    : combinedDialogue(selected, directions);
  const cameraSubjectId = input.manualSections.camera
    ? input.currentScene.cameraSubjectId
    : (selected.length ? pick(selected, rng, selected[0]).id : "");

  const next: AiDirectorScene = {
    ...input.currentScene,
    location: resolvedLocation(input),
    objective: sceneObjective(profile, input, rng),
    beat: sceneBeat(profile, input, rng),
    transition: sceneTransition(profile, input, rng),
    action: input.analysis.scene.description?.trim() || input.currentScene.action,
    dialogue,
    characterIds: input.manualSections.blocking ? input.currentScene.characterIds : selected.map((item) => item.id),
    characterDirections: directions,
    cameraSubjectId,
    ...camera,
    ...look,
    ...audio,
    sfxTimeline: sfxTimeline(audio.sfx, input.currentScene.duration),
    continuityNote: input.currentScene.continuityNote,
    negativePrompt: input.currentScene.negativePrompt,
  };

  if (!input.manualSections.continuity) {
    next.continuityNote = continuityNote(input, selected, next);
    next.negativePrompt = negativePrompt(input, selected);
  }
  if (input.manualSections.camera) CAMERA_FIELDS.forEach((key) => { (next as unknown as Record<string, unknown>)[key] = input.currentScene[key]; });
  if (input.manualSections.look) LOOK_FIELDS.forEach((key) => { (next as unknown as Record<string, unknown>)[key] = input.currentScene[key]; });
  if (input.manualSections.sound) SOUND_FIELDS.forEach((key) => { (next as unknown as Record<string, unknown>)[key] = input.currentScene[key]; });
  if (input.locks.includes("Lighting")) {
    next.lighting = input.currentScene.lighting;
    next.colorTemp = input.currentScene.colorTemp;
  }
  return next;
}

function cameraContinuity(candidate: AiDirectorScene, input: AiDirectorRequest) {
  if (!input.locks.includes("Camera Language")) return 0.9;
  const reference = input.previousScene || input.currentScene;
  const lens = lensFamily(candidate.lens) === lensFamily(reference.lens) ? 1 : 0.62;
  const movement = movementFamily(candidate.movement) === movementFamily(reference.movement) ? 1 : 0.68;
  const height = normalize(candidate.height) === normalize(reference.height) ? 1 : 0.82;
  return clamp(lens * 0.42 + movement * 0.4 + height * 0.18);
}

function visualContinuity(candidate: AiDirectorScene, input: AiDirectorRequest) {
  let value = cameraContinuity(candidate, input);
  if (input.locks.includes("Lighting")) {
    value = value * 0.65 + (candidate.lighting === input.currentScene.lighting && candidate.colorTemp === input.currentScene.colorTemp ? 0.35 : 0);
  }
  if (input.locks.includes("Location") && input.currentScene.location.trim()) {
    value = value * 0.8 + (normalize(candidate.location) === normalize(input.currentScene.location) ? 0.2 : 0);
  }
  return clamp(value);
}

function pacingScore(profile: ProfileId, scene: AiDirectorScene, signal: Signal) {
  const energetic = movementFamily(scene.movement) === "energetic";
  const slow = normalize(scene.cameraSpeed).includes("slow");
  if (signal.action > 0.8) return energetic ? 0.98 : slow ? 0.62 : 0.82;
  if (profile === "intimate" || profile === "tension" || profile === "mystery") return slow || movementFamily(scene.movement) !== "energetic" ? 0.94 : 0.68;
  return 0.9;
}

function maxHistorySimilarity(scene: AiDirectorScene, history: AiDirectorHistoryEntry[]) {
  if (!history.length) return 0.08;
  return Math.max(...history.slice(-16).map((entry) => sceneSimilarity(scene, entry.fields)));
}

function resolveCapability(input: AiDirectorRequest): AiDirectorCapability {
  const capability = getVideoUiCapability(input.model);
  const timeline = Math.max(1, Math.round(input.currentScene.duration));
  const sorted = [...capability.durationSeconds].sort((a, b) => a - b);
  const renderDuration = sorted.find((value) => value >= timeline) ?? sorted[sorted.length - 1];
  const durationSupported = timeline <= (sorted[sorted.length - 1] || timeline);
  const aspectSupported = capability.ratioValues.includes(input.aspect);
  return {
    model: input.model,
    timelineDurationSec: timeline,
    renderDurationSec: renderDuration || timeline,
    trimSec: durationSupported ? Math.max(0, (renderDuration || timeline) - timeline) : 0,
    aspectSupported,
    durationSupported,
    cameraControl: "prompt",
    lightingControl: "prompt",
    audioControl: "prompt",
    continuityControl: "scenova",
  };
}

function modelSupportScore(capability: AiDirectorCapability) {
  if (!capability.durationSupported || !capability.aspectSupported) return 0.35;
  return capability.trimSec > 0 ? 0.92 : 1;
}

function scoreWeights(mode: AiDirectorMode, novelty: AiDirectorNovelty) {
  const noveltyWeight = novelty === "safe" ? 0.05 : novelty === "balanced" ? 0.08 : novelty === "different" ? 0.12 : 0.16;
  // Story relationship is intentionally the strongest signal. Camera/look novelty
  // is secondary to causal continuity with the surrounding scenes.
  const weights = { story: 0.4, coherence: 0.16, continuity: 0.2, novelty: noveltyWeight, model: 0.08, pacing: 0.08 };
  if (mode === "story") weights.story += 0.1;
  if (mode === "cinematic") weights.coherence += 0.05;
  if (mode === "realistic") weights.continuity += 0.05;
  if (mode === "surprise") weights.novelty += 0.05;
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / sum])) as typeof weights;
}

function candidateScores(profile: ProfileId, scene: AiDirectorScene, input: AiDirectorRequest, signal: Signal, capability: AiDirectorCapability) {
  const storyFit = profileStoryFit(profile, signal, input.sceneIndex, input.sceneCount);
  const coherenceBase: Record<ProfileId, number> = { establish: 0.94, dialogue: 0.96, intimate: 0.95, tension: 0.94, action: 0.92, reveal: 0.94, mystery: 0.92, release: 0.95 };
  const coherence = coherenceBase[profile];
  const continuity = visualContinuity(scene, input);
  const novelty = clamp(1 - maxHistorySimilarity(scene, input.history));
  const modelSupport = modelSupportScore(capability);
  const pacing = pacingScore(profile, scene, signal);
  const weights = scoreWeights(input.mode, input.novelty);
  const total = storyFit * weights.story + coherence * weights.coherence + continuity * weights.continuity + novelty * weights.novelty + modelSupport * weights.model + pacing * weights.pacing;
  return {
    storyFit: round(storyFit), coherence: round(coherence), continuity: round(continuity), novelty: round(novelty),
    modelSupport: round(modelSupport), pacing: round(pacing), total: round(total),
  };
}

function probabilityTemperature(novelty: AiDirectorNovelty) {
  return novelty === "safe" ? 13 : novelty === "balanced" ? 9 : novelty === "different" ? 6 : 4.5;
}

function chooseCandidate(candidates: Candidate[], input: AiDirectorRequest, rng: () => number) {
  const sorted = [...candidates].sort((a, b) => b.scores.total - a.scores.total);
  const top = sorted[0]?.scores.total ?? 0;
  const eligible = sorted.filter((item) => item.scores.total >= top - (input.novelty === "experimental" ? 0.16 : 0.11)).slice(0, 5);
  const temperature = probabilityTemperature(input.novelty);
  const probabilitiesRaw = eligible.map((candidate) => Math.exp(candidate.scores.total * temperature));
  const rawTotal = probabilitiesRaw.reduce((sum, value) => sum + value, 0) || 1;
  const alternatives = eligible.map((candidate, index) => ({
    profile: candidate.profile,
    labelTh: candidate.labelTh,
    probability: round(probabilitiesRaw[index] / rawTotal),
    score: candidate.scores.total,
  }));
  const recentFingerprints = new Set(input.history.slice(-12).map((entry) => entry.fingerprint));
  const weighted = eligible.map((candidate, index) => ({ value: candidate, weight: probabilitiesRaw[index] }));
  let selected = weightedPick(weighted, rng, eligible[0]);
  if (recentFingerprints.has(selected.fingerprint)) {
    const fresh = eligible.filter((candidate) => !recentFingerprints.has(candidate.fingerprint));
    if (fresh.length) {
      const freshWeighted = fresh.map((candidate) => ({ value: candidate, weight: Math.exp(candidate.scores.total * temperature) }));
      selected = weightedPick(freshWeighted, rng, fresh[0]);
    }
  }
  return { selected, alternatives };
}

function hasFilledValue(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

function preserveFilledDirections(
  current: Record<string, AiDirectorCharacterDirection>,
  generated: Record<string, AiDirectorCharacterDirection> | undefined,
) {
  if (!generated) return undefined;
  const result: Record<string, AiDirectorCharacterDirection> = {};
  Object.entries(generated).forEach(([id, direction]) => {
    const existing = current[id];
    if (!existing) {
      result[id] = direction;
      return;
    }
    result[id] = {
      blocking: existing.blocking.trim() ? existing.blocking : direction.blocking,
      action: existing.action.trim() ? existing.action : direction.action,
      emotion: existing.emotion.trim() ? existing.emotion : direction.emotion,
      eyeline: existing.eyeline.trim() ? existing.eyeline : direction.eyeline,
      dialogue: existing.dialogue.trim() ? existing.dialogue : direction.dialogue,
    };
  });
  return result;
}

function filterScope(scene: AiDirectorScene, input: AiDirectorRequest) {
  const patch: AiDirectorScenePatch = {};
  const copy = (keys: readonly (keyof AiDirectorScene)[]) => keys.forEach((key) => { (patch as unknown as Record<string, unknown>)[key] = scene[key]; });
  if (input.scope === "all" || input.scope === "story") copy(STORY_FIELDS);
  if (input.scope === "all" || input.scope === "camera") copy(CAMERA_FIELDS);
  if (input.scope === "all" || input.scope === "look") copy(LOOK_FIELDS);
  if (input.scope === "all" || input.scope === "sound") copy(SOUND_FIELDS);
  if (input.scope === "all" || input.scope === "continuity") copy(CONTINUITY_FIELDS);
  if (input.manualSections.blocking) {
    delete patch.characterIds;
    delete patch.characterDirections;
  }
  if (input.manualSections.camera) CAMERA_FIELDS.forEach((key) => delete patch[key]);
  if (input.manualSections.look) LOOK_FIELDS.forEach((key) => delete patch[key]);
  if (input.manualSections.sound) SOUND_FIELDS.forEach((key) => delete patch[key]);
  if (input.manualSections.continuity) CONTINUITY_FIELDS.forEach((key) => delete patch[key]);
  if (input.locks.includes("Lighting")) {
    delete patch.lighting;
    delete patch.colorTemp;
  }
  if (input.locks.includes("Location") && input.currentScene.location.trim()) delete patch.location;

  if (input.fillMode === "empty-only") {
    const current = input.currentScene;
    Object.keys(patch).forEach((rawKey) => {
      const key = rawKey as keyof AiDirectorScene;
      if (key === "characterDirections") return;
      if (hasFilledValue(current[key])) delete patch[key];
    });
    const directions = preserveFilledDirections(current.characterDirections, patch.characterDirections);
    if (directions && Object.keys(directions).length) patch.characterDirections = directions;
    else delete patch.characterDirections;
  }
  return patch;
}

function changedFields(current: AiDirectorScene, patch: AiDirectorScenePatch) {
  return Object.keys(patch).filter((key) => {
    const field = key as keyof AiDirectorScene;
    return JSON.stringify(current[field]) !== JSON.stringify(patch[field]);
  });
}

function validatePlan(scene: AiDirectorScene, patch: AiDirectorScenePatch, input: AiDirectorRequest, capability: AiDirectorCapability): AiDirectorValidation {
  const warnings: string[] = [];
  const catalogChecks: Array<[keyof AiDirectorScene, ProductionChoice[]]> = [
    ["shot", SHOT_TYPES], ["angle", CAMERA_ANGLES], ["lens", LENSES], ["movement", CAMERA_MOVEMENTS], ["height", CAMERA_HEIGHTS], ["cameraSpeed", CAMERA_SPEEDS],
    ["focus", FOCUS_OPTIONS], ["dof", DOF_OPTIONS], ["composition", COMPOSITION_OPTIONS], ["lighting", LIGHTING_STYLES], ["colorTemp", COLOR_TEMPERATURES],
    ["emotion", EMOTIONS], ["performance", PERFORMANCE_OPTIONS], ["ambience", AMBIENCE_PRESETS], ["secondaryAmbience", AMBIENCE_PRESETS], ["sfx", SFX_PRESETS], ["music", MUSIC_PRESETS],
    ["objective", OBJECTIVE_PRESETS], ["beat", SCENE_BEATS], ["transition", TRANSITIONS],
  ];
  for (const [key, options] of catalogChecks) {
    const value = scene[key];
    if (typeof value !== "string") continue;
    if (normalize(value) === "ai" || !realChoices(options).some((item) => item.value === value)) warnings.push("ค่า " + String(key) + " ไม่อยู่ใน Production Catalog");
  }
  if (!capability.aspectSupported) warnings.push("อัตราส่วนภาพนี้ไม่อยู่ในรายการที่ " + input.model + " รองรับในระบบ");
  if (!capability.durationSupported) warnings.push("เวลาฉากยาวเกิน Generation สูงสุดของ " + input.model);
  if (capability.trimSec > 0) warnings.push("Timeline " + capability.timelineDurationSec + "s จะใช้ Generation " + capability.renderDurationSec + "s แล้วตัดส่วนเกิน " + capability.trimSec + "s");
  const speech = estimateSpeechSeconds(scene.dialogue);
  if (speech > scene.duration * 0.8 + 0.25) warnings.push("บทพูดอาจแน่นเกินเวลาฉาก (ประมาณ " + speech.toFixed(1) + "s)");
  const sfxTimes = scene.sfxTimeline.match(/\b\d{2}:\d{2}(?:\.\d)?/g) || [];
  for (const stamp of sfxTimes) {
    const [minutes, seconds] = stamp.split(":");
    if (Number(minutes) * 60 + Number(seconds) > scene.duration + 0.01) warnings.push("SFX Timeline มีเวลานอก Duration ของฉาก");
  }
  if (input.manualSections.camera && CAMERA_FIELDS.some((key) => patch[key] !== undefined)) warnings.push("ระบบพยายามแก้ Camera ที่ตั้งเป็น Manual");
  if (input.manualSections.look && LOOK_FIELDS.some((key) => patch[key] !== undefined)) warnings.push("ระบบพยายามแก้ Look ที่ตั้งเป็น Manual");
  if (input.manualSections.sound && SOUND_FIELDS.some((key) => patch[key] !== undefined)) warnings.push("ระบบพยายามแก้ Sound ที่ตั้งเป็น Manual");
  const hardWarnings = warnings.filter((item) => !item.startsWith("Timeline "));
  return { ok: hardWarnings.length === 0, warnings };
}

function frozenSections(input: AiDirectorRequest) {
  const result: string[] = [];
  if (input.manualSections.blocking) result.push("Blocking");
  if (input.manualSections.camera) result.push("Camera");
  if (input.manualSections.look) result.push("Look / Performance");
  if (input.manualSections.sound) result.push("Sound");
  if (input.manualSections.continuity) result.push("Continuity");
  if (input.locks.includes("Lighting")) result.push("Lighting Lock");
  if (input.locks.includes("Location") && input.currentScene.location.trim()) result.push("Location Lock");
  if (input.fillMode === "empty-only") result.push("ค่าที่ผู้ใช้กรอก/เลือกไว้แล้ว");
  return Array.from(new Set(result));
}

function rationale(profile: ProfileId, signal: Signal, scores: AiDirectorScores, input: AiDirectorRequest) {
  const reason: string[] = [];
  if (input.sceneIndex === 0) reason.push("เป็นช่วงเปิดตอน");
  if (signal.action > 0.8) reason.push("Action สูง");
  if (signal.tension > 0.8) reason.push("แรงกดดันสูง");
  if (signal.emotion > 0.8) reason.push("เน้นอารมณ์ตัวละคร");
  if (signal.reveal > 0.8) reason.push("มีจุดเปิดเผยข้อมูล");
  if (signal.mystery > 0.8) reason.push("มีความลึกลับ/ความไม่แน่นอน");
  if (input.sceneIndex === input.sceneCount - 1) reason.push("เป็นช่วงท้ายของตอน");
  if (input.previousScene || input.nextScene) reason.push("เชื่อมเหตุและผลกับฉากข้างเคียง");
  const suffix = reason.length ? reason.join(" • ") : "สมดุล Story, Camera และ Continuity";
  return PROFILE_LABELS[profile] + " — " + suffix + " · คะแนนรวม " + Math.round(scores.total * 100) + "%";
}

export function buildAiDirectorPlan(input: AiDirectorRequest): AiDirectorPlan {
  const signal = deriveSignals(input);
  const rng = makeRng(input.seed);
  const weights = profileWeights(signal, input.mode, input.sceneIndex, input.sceneCount);
  const capability = resolveCapability(input);
  const profiles = Object.keys(weights) as ProfileId[];
  const candidates: Candidate[] = [];
  const candidateCount = input.novelty === "experimental" ? 10 : 8;

  for (let index = 0; index < candidateCount; index += 1) {
    const profile = weightedPick(profiles.map((profileId) => ({ value: profileId, weight: weights[profileId] })), rng, profiles[0]);
    const scene = buildCandidate(profile, input, input.seed + (index + 1) * 7919, signal);
    const scores = candidateScores(profile, scene, input, signal, capability);
    candidates.push({ profile, labelTh: PROFILE_LABELS[profile], scene, scores, fingerprint: fingerprint(scene) });
  }

  const unique = Array.from(new Map(candidates.map((candidate) => [candidate.fingerprint, candidate])).values());
  if (!unique.length) {
    const profile: ProfileId = input.sceneIndex === 0 ? "establish" : "dialogue";
    const scene = buildCandidate(profile, input, input.seed + 17, signal);
    unique.push({ profile, labelTh: PROFILE_LABELS[profile], scene, scores: candidateScores(profile, scene, input, signal, capability), fingerprint: fingerprint(scene) });
  }

  const { selected, alternatives } = chooseCandidate(unique, input, rng);
  const patch = filterScope(selected.scene, input);
  const validation = validatePlan(selected.scene, patch, input, capability);
  const changes = changedFields(input.currentScene, patch);
  const historyEntry: AiDirectorHistoryEntry = {
    fingerprint: selected.fingerprint,
    profile: selected.profile,
    fields: Object.fromEntries(COMPARISON_WEIGHTS.map(([key]) => [key, selected.scene[key]])) as AiDirectorScenePatch,
    createdAt: Date.now(),
  };
  return {
    scene: patch,
    meta: {
      seed: input.seed,
      fingerprint: selected.fingerprint,
      profile: selected.profile,
      profileLabelTh: selected.labelTh,
      rationaleTh: rationale(selected.profile, signal, selected.scores, input),
      scores: selected.scores,
      alternatives,
      capability,
      validation,
      changedFields: changes,
      frozenSections: frozenSections(input),
      historyEntry,
    },
  };
}
