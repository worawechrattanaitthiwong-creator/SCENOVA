import type { AspectRatio, CharacterReference, EpisodeDuration, Project } from "@/lib/domain";

export type StudioAgentCharacter = {
  id: string;
  name: string;
  role: string;
  appearance: string;
  voice: string;
  identityLock: boolean;
  voiceLock: boolean;
  references?: CharacterReference[];
};

export type StudioAgentAnimal = {
  id: string;
  name: string;
  species: string;
  appearance: string;
  behavior: string;
};

export type StudioAgentScene = {
  id: string;
  title: string;
  duration: number;
  location: string;
  action: string;
  dialogue: string;
  characterIds: string[];
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
  continuityNote: string;
  negativePrompt: string;
};

export type StudioAgentDraft = {
  episodeTitle: string;
  model: string;
  aspect: string;
  visualStyle: string;
  story: string;
  globalNegative: string;
  locks: string[];
  characters: StudioAgentCharacter[];
  hasAnimals: boolean;
  animals: StudioAgentAnimal[];
  totalDuration: number;
  scenes: StudioAgentScene[];
};

const MODEL_IDS: Record<string, string> = {
  "Seedance 2.5": "seedance-2-5",
  Kling: "kling",
  Veo: "veo",
  Runway: "runway",
  Wan: "wan",
};

function aspectRatio(value: string): AspectRatio {
  if (value.startsWith("9:16")) return "9:16";
  if (value.startsWith("1:1")) return "1:1";
  if (value.startsWith("4:5")) return "4:5";
  return "16:9";
}

function lensNumber(value: string) {
  const number = Number(value.match(/\d+/)?.[0] || 50);
  return Number.isFinite(number) ? number : 50;
}

function lockEnabled(locks: string[], key: string) {
  return locks.some((item) => item.toLowerCase() === key.toLowerCase());
}

export function buildStudioAgentProject(draft: StudioAgentDraft, idSeed = `${Date.now()}`): Project {
  const projectId = `studio-project-${idSeed}`;
  const episodeId = `studio-episode-${idSeed}`;
  const mainModelId = MODEL_IDS[draft.model] || "seedance-2-5";
  let cursor = 0;

  const segments = draft.scenes.map((scene, index) => {
    const start = cursor;
    const end = start + Math.max(1, Number(scene.duration) || 1);
    cursor = end;
    const dialogue = scene.dialogue.trim();

    return {
      id: scene.id || `${episodeId}-scene-${index + 1}`,
      start,
      end,
      title: scene.title || `ฉาก ${index + 1}`,
      scene: scene.action || scene.title || `ฉาก ${index + 1}`,
      location: scene.location || "ยังไม่ระบุสถานที่",
      characterIds: scene.characterIds,
      action: scene.action,
      emotion: scene.emotion,
      lighting: [scene.lighting, scene.colorTemp].filter(Boolean).join(" · "),
      sound: [scene.ambience, scene.secondaryAmbience, scene.sfx, scene.sfxTimeline, scene.music].filter(Boolean).join(" · "),
      modelId: mainModelId,
      cameraShots: [{
        id: `${scene.id || index}-camera-1`,
        start,
        end,
        shotType: scene.shot,
        angle: scene.angle,
        lensMm: lensNumber(scene.lens),
        cameraHeight: scene.height,
        movement: scene.movement,
        movementSpeed: scene.cameraSpeed,
        focus: scene.cameraSubjectId || scene.focus,
        depthOfField: scene.dof,
        composition: scene.composition,
        foregroundOcclusion: "None",
      }],
      dialogue: dialogue ? [{
        id: `${scene.id || index}-dialogue-1`,
        characterId: scene.characterIds[0] || "narrator",
        start,
        end,
        text: dialogue,
        emotion: scene.emotion,
        speed: "Natural",
      }] : [],
    };
  });

  const people = draft.characters.map((character) => ({
    id: character.id,
    name: character.name,
    kind: "human" as const,
    description: character.role,
    appearance: character.appearance,
    outfit: character.appearance,
    personality: character.role,
    voiceProfile: character.voice,
    lock: character.identityLock,
    references: character.references || [],
  }));
  const creatures = draft.hasAnimals ? draft.animals.map((animal) => ({
    id: animal.id,
    name: animal.name,
    kind: "animal" as const,
    description: [animal.species, animal.behavior].filter(Boolean).join(" · "),
    appearance: animal.appearance,
    outfit: "",
    personality: animal.behavior,
    lock: true,
    references: [],
  })) : [];

  return {
    id: projectId,
    title: draft.episodeTitle.trim() || "Untitled Episode",
    story: draft.story,
    genre: "User-defined",
    mood: draft.visualStyle,
    aspectRatio: aspectRatio(draft.aspect),
    episodeCount: 1,
    mainModelId,
    modelMode: "single",
    promptMode: "creative-director",
    resolution: "720p",
    styleId: draft.visualStyle,
    locks: {
      project: true,
      character: lockEnabled(draft.locks, "Character"),
      style: lockEnabled(draft.locks, "Visual Style"),
      voice: lockEnabled(draft.locks, "Voice"),
      location: lockEnabled(draft.locks, "Location"),
      prop: lockEnabled(draft.locks, "Props"),
      canon: true,
      camera: lockEnabled(draft.locks, "Camera Language"),
      lighting: lockEnabled(draft.locks, "Lighting"),
      motion: true,
      model: true,
    },
    projectBible: [
      `สไตล์ภาพ: ${draft.visualStyle}`,
      `โมเดลหลัก: ${draft.model}`,
      `ข้อห้ามรวม: ${draft.globalNegative}`,
      ...draft.scenes.map((scene, index) => `ฉาก ${index + 1}: ${scene.continuityNote || "รักษาความต่อเนื่องจากฉากก่อน"}`),
    ].join("\n"),
    canon: [draft.globalNegative, ...draft.scenes.map((scene) => scene.negativePrompt).filter(Boolean)],
    characters: [...people, ...creatures],
    episodes: [{
      id: episodeId,
      number: 1,
      title: draft.episodeTitle.trim() || "Untitled Episode",
      duration: Math.max(1, Math.min(180, Math.round(draft.totalDuration))) as EpisodeDuration,
      synopsis: draft.story,
      status: "ready",
      segments,
    }],
  };
}
