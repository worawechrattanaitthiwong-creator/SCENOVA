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

export function applyAiDirectorPatch<T extends AiDirectorScene>(base: T, patch: AiDirectorScenePatch, manual: ManualAiSections, locks: string[]): T {
  const next: AiDirectorScene = {
    ...base,
    ...patch,
    characterIds: Array.isArray(patch.characterIds) ? patch.characterIds : base.characterIds,
    animalIds: Array.isArray(patch.animalIds) ? patch.animalIds : base.animalIds,
    characterDirections: patch.characterDirections ? { ...base.characterDirections, ...patch.characterDirections } : base.characterDirections,
  };
  if (manual.blocking) {
    next.characterIds = base.characterIds;
    next.characterDirections = base.characterDirections;
  }
  if (manual.camera) {
    next.cameraSubjectId = base.cameraSubjectId;
    next.shot = base.shot;
    next.angle = base.angle;
    next.lens = base.lens;
    next.movement = base.movement;
    next.height = base.height;
    next.cameraSpeed = base.cameraSpeed;
    next.focus = base.focus;
    next.dof = base.dof;
    next.composition = base.composition;
  }
  if (manual.look) {
    next.lighting = base.lighting;
    next.colorTemp = base.colorTemp;
    next.emotion = base.emotion;
    next.performance = base.performance;
  }
  if (manual.sound) {
    next.ambience = base.ambience;
    next.secondaryAmbience = base.secondaryAmbience;
    next.sfx = base.sfx;
    next.sfxTimeline = base.sfxTimeline;
    next.music = base.music;
    next.ambienceLevel = base.ambienceLevel;
    next.sfxLevel = base.sfxLevel;
    next.dialogueLevel = base.dialogueLevel;
    next.musicLevel = base.musicLevel;
  }
  if (manual.continuity) {
    next.continuityNote = base.continuityNote;
    next.negativePrompt = base.negativePrompt;
  }
  if (locks.includes("Lighting")) {
    next.lighting = base.lighting;
    next.colorTemp = base.colorTemp;
  }
  if (locks.includes("Location") && base.location.trim()) next.location = base.location;
  return next as T;
}
