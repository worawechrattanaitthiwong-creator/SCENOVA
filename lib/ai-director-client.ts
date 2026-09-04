"use client";

import type {
  AiDirectorHistoryEntry,
  AiDirectorMode,
  AiDirectorNovelty,
  AiDirectorScene,
  AiDirectorScenePatch,
  AiDirectorScope,
  ManualAiSections,
} from "@/lib/ai-director";

export const AI_MODE_OPTIONS: Array<{ value: AiDirectorMode; label: string }> = [
  { value: "production", label: "Production — สมดุล" },
  { value: "cinematic", label: "Cinematic — เน้นภาษาภาพ" },
  { value: "story", label: "Story First — เน้นการเล่าเรื่อง" },
  { value: "realistic", label: "Realistic — สมจริง" },
  { value: "emotion", label: "Emotion — เน้นอารมณ์" },
  { value: "surprise", label: "Surprise Me — สร้างสรรค์สูง" },
];

export const AI_NOVELTY_OPTIONS: Array<{ value: AiDirectorNovelty; label: string }> = [
  { value: "safe", label: "ปลอดภัย" },
  { value: "balanced", label: "สมดุล" },
  { value: "different", label: "แตกต่าง" },
  { value: "experimental", label: "ทดลองสูง" },
];

export const AI_SCOPE_OPTIONS: Array<{ value: Exclude<AiDirectorScope, "all">; label: string }> = [
  { value: "story", label: "เรื่อง / บท" },
  { value: "camera", label: "กล้อง" },
  { value: "look", label: "ภาพ / แสง" },
  { value: "sound", label: "เสียง" },
  { value: "continuity", label: "Continuity" },
];

const HISTORY_KEY = "scenova-ai-director-history-v1";
const PREFERENCES_KEY = "scenova-single-episode-options-v1";
const HISTORY_LIMIT = 16;
const DEFAULT_MANUAL: ManualAiSections = { blocking: false, camera: false, look: false, sound: false, continuity: false };

export function readManualAiSections(): ManualAiSections {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_MANUAL;
    const saved = JSON.parse(raw) as Partial<ManualAiSections>;
    return {
      blocking: Boolean(saved.blocking),
      camera: Boolean(saved.camera),
      look: Boolean(saved.look),
      sound: Boolean(saved.sound),
      continuity: Boolean(saved.continuity),
    };
  } catch {
    return DEFAULT_MANUAL;
  }
}

export function aiStorySignature(title: string, story: string, sceneIndex: number) {
  const source = title.trim() + "|" + story.trim().slice(0, 600) + "|" + sceneIndex;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return "scene-" + sceneIndex + "-" + (hash >>> 0).toString(36);
}

export function readAiDirectorHistory(key: string): AiDirectorHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const store = JSON.parse(raw) as Record<string, AiDirectorHistoryEntry[]>;
    return Array.isArray(store[key]) ? store[key].slice(-HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export function appendAiDirectorHistory(key: string, entry: AiDirectorHistoryEntry) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const store = raw ? JSON.parse(raw) as Record<string, AiDirectorHistoryEntry[]> : {};
    const current = Array.isArray(store[key]) ? store[key] : [];
    store[key] = [...current, entry].slice(-HISTORY_LIMIT);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(store));
  } catch {
    // Browser storage is only an anti-repeat aid. Generation stays available without it.
  }
}

export function cloneAiDirectorScenes<T extends AiDirectorScene>(scenes: T[]): T[] {
  return scenes.map((scene) => ({
    ...scene,
    characterIds: [...scene.characterIds],
    animalIds: [...scene.animalIds],
    characterDirections: Object.fromEntries(Object.entries(scene.characterDirections).map(([id, direction]) => [id, Object.assign({}, direction as AiDirectorScene["characterDirections"][string])])),
  })) as T[];
}

function hasFilledValue(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

function protectFilledPatch(base: AiDirectorScene, patch: AiDirectorScenePatch) {
  const safe: AiDirectorScenePatch = { ...patch };
  Object.keys(safe).forEach((rawKey) => {
    const key = rawKey as keyof AiDirectorScene;
    if (key === "characterDirections") return;
    if (hasFilledValue(base[key])) delete safe[key];
  });
  if (safe.characterDirections) {
    safe.characterDirections = Object.fromEntries(Object.entries(safe.characterDirections).map(([id, generated]) => {
      const current = base.characterDirections[id];
      if (!current) return [id, generated];
      return [id, {
        blocking: current.blocking.trim() ? current.blocking : generated.blocking,
        action: current.action.trim() ? current.action : generated.action,
        emotion: current.emotion.trim() ? current.emotion : generated.emotion,
        eyeline: current.eyeline.trim() ? current.eyeline : generated.eyeline,
        dialogue: current.dialogue.trim() ? current.dialogue : generated.dialogue,
      }];
    }));
  }
  return safe;
}

export function applyAiDirectorPatch<T extends AiDirectorScene>(
  base: T,
  patch: AiDirectorScenePatch,
  manual: ManualAiSections,
  locks: string[],
  options?: { preserveFilled?: boolean },
): T {
  const preserveFilled = Boolean(options?.preserveFilled);
  const effectivePatch = preserveFilled ? protectFilledPatch(base, patch) : patch;
  const next: AiDirectorScene = {
    ...base,
    ...effectivePatch,
    characterIds: Array.isArray(effectivePatch.characterIds) ? effectivePatch.characterIds : base.characterIds,
    animalIds: Array.isArray(effectivePatch.animalIds) ? effectivePatch.animalIds : base.animalIds,
    characterDirections: effectivePatch.characterDirections ? { ...base.characterDirections, ...effectivePatch.characterDirections } : base.characterDirections,
  };
  if (manual.blocking) {
    if (!preserveFilled || base.characterIds.length) next.characterIds = base.characterIds;
    if (!preserveFilled) next.characterDirections = base.characterDirections;
  }
  if (manual.camera) {
    const fields = ["cameraSubjectId", "shot", "angle", "lens", "movement", "height", "cameraSpeed", "focus", "dof", "composition"] as const;
    fields.forEach((key) => {
      if (!preserveFilled || hasFilledValue(base[key])) next[key] = base[key];
    });
  }
  if (manual.look) {
    const fields = ["lighting", "colorTemp", "emotion", "performance"] as const;
    fields.forEach((key) => {
      if (!preserveFilled || hasFilledValue(base[key])) next[key] = base[key];
    });
  }
  if (manual.sound) {
    const fields = ["ambience", "secondaryAmbience", "sfx", "sfxTimeline", "music", "ambienceLevel", "sfxLevel", "dialogueLevel", "musicLevel"] as const;
    fields.forEach((key) => {
      if (!preserveFilled || hasFilledValue(base[key])) (next as unknown as Record<string, unknown>)[key] = base[key];
    });
  }
  if (manual.continuity) {
    const fields = ["continuityNote", "negativePrompt"] as const;
    fields.forEach((key) => {
      if (!preserveFilled || hasFilledValue(base[key])) next[key] = base[key];
    });
  }
  if (locks.includes("Lighting")) {
    if (!preserveFilled || base.lighting.trim()) next.lighting = base.lighting;
    if (!preserveFilled || base.colorTemp.trim()) next.colorTemp = base.colorTemp;
  }
  if (locks.includes("Location") && base.location.trim()) next.location = base.location;
  return next as T;
}
