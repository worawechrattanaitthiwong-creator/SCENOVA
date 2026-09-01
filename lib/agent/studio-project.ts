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

export type StudioAgentCharacterDirection = {
  blocking?: string;
  action?: string;
  emotion?: string;
  eyeline?: string;
};

export type StudioAgentScene = {
  id: string;
  title: string;
  duration: number;
  location: string;
  action: string;
  dialogue: string;
  characterIds: string[];
  characterDirections?: Record<string, StudioAgentCharacterDirection>;
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

type StudioPreferenceKey = "advancedSetup" | "blocking" | "camera" | "look" | "sound" | "continuity" | "review";
type StudioPreferences = Record<StudioPreferenceKey, boolean>;

const STUDIO_PREFERENCES_KEY = "scenova-single-episode-options-v1";
const AUTO_DEFAULTS: StudioPreferences = {
  advancedSetup: false,
  blocking: false,
  camera: false,
  look: false,
  sound: false,
  continuity: false,
  review: false,
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

function isAiValue(value: string) {
  return /^AI(?:\s|_|$)/i.test(value.trim());
}

function lensNumber(value: string) {
  if (isAiValue(value)) return 0;
  const number = Number(value.match(/\d+/)?.[0] || 50);
  return Number.isFinite(number) ? number : 50;
}

function lockEnabled(locks: string[], key: string) {
  return locks.some((item) => item.toLowerCase() === key.toLowerCase());
}

function readStudioPreferences(): StudioPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STUDIO_PREFERENCES_KEY);
    if (!raw) return AUTO_DEFAULTS;
    return { ...AUTO_DEFAULTS, ...(JSON.parse(raw) as Partial<StudioPreferences>) };
  } catch {
    return AUTO_DEFAULTS;
  }
}

function isManual(preferences: StudioPreferences | null, key: StudioPreferenceKey) {
  // Non-browser callers keep the legacy explicit behavior. The Studio browser defaults to AI Auto.
  return preferences ? preferences[key] : true;
}

function characterBlocking(scene: StudioAgentScene, characters: StudioAgentCharacter[]) {
  return Object.entries(scene.characterDirections || {})
    .filter(([characterId]) => scene.characterIds.includes(characterId))
    .map(([characterId, direction]) => {
      const character = characters.find((item) => item.id === characterId);
      const name = character?.name || characterId;
      const details = [
        direction.blocking && `Blocking: ${direction.blocking}`,
        direction.action && `Action: ${direction.action}`,
        direction.emotion && `Emotion: ${direction.emotion}`,
        direction.eyeline && `Eyeline: ${direction.eyeline}`,
      ].filter(Boolean).join("; ");
      return details ? `${name} — ${details}` : "";
    })
    .filter(Boolean);
}

export function buildStudioAgentProject(draft: StudioAgentDraft, idSeed = `${Date.now()}`): Project {
  const projectId = `studio-project-${idSeed}`;
  const episodeId = `studio-episode-${idSeed}`;
  const mainModelId = MODEL_IDS[draft.model] || "seedance-2-5";
  const preferences = readStudioPreferences();
  const manualAdvancedSetup = isManual(preferences, "advancedSetup");
  const manualBlocking = isManual(preferences, "blocking");
  const manualCamera = isManual(preferences, "camera");
  const manualLook = isManual(preferences, "look");
  const manualSound = isManual(preferences, "sound");
  const manualContinuity = isManual(preferences, "continuity");
  let cursor = 0;

  const autoSections = preferences ? [
    !manualAdvancedSetup && "Locks / Negative Prompt",
    !manualBlocking && "Character Blocking",
    !manualCamera && "Camera / Lens",
    !manualLook && "Lighting / Color / Performance",
    !manualSound && "Ambience / SFX / Music",
    !manualContinuity && "Continuity / Scene Negative",
  ].filter((item): item is string => Boolean(item)) : [];

  const aiAutoPolicy = autoSections.length
    ? `AI AUTO POLICY: ${autoSections.join(", ")}. ส่วนที่ไม่ได้ติ๊กไม่ได้แปลว่าไม่ใช้ แต่หมายถึงให้ทีม AI เลือกและออกแบบค่าที่เหมาะสมจากเนื้อเรื่อง สถานที่ Action Dialogue อารมณ์ สไตล์ภาพ และความต่อเนื่องของฉาก ค่าที่ผู้ใช้เปิดปรับเองเท่านั้นจึงถือเป็น Manual Override.`
    : "";

  const segments = draft.scenes.map((scene, index) => {
    const start = cursor;
    const end = start + Math.max(1, Number(scene.duration) || 1);
    cursor = end;
    const dialogue = scene.dialogue.trim();
    const blocking = manualBlocking ? characterBlocking(scene, draft.characters) : [];
    const blockingDirective = manualBlocking
      ? (blocking.length ? `USER CHARACTER BLOCKING:\n${blocking.join("\n")}` : "")
      : "AI_AUTO BLOCKING — decide each character's position, movement, action, emotion and eyeline from the story, dialogue, scene objective and spatial continuity.";
    const performanceDirective = manualLook
      ? (scene.performance ? `PERFORMANCE: ${scene.performance}` : "")
      : "AI_AUTO PERFORMANCE — infer performance intensity, body language and emotional delivery from the story, action and dialogue.";
    const action = [scene.action, blockingDirective, performanceDirective].filter(Boolean).join("\n");
    const emotion = manualLook ? scene.emotion : "AI_AUTO";
    const lighting = manualLook
      ? [scene.lighting, scene.colorTemp].filter(Boolean).join(" · ")
      : "AI_AUTO — choose lighting, color temperature and visual mood to match story, location, time, action and emotion.";
    const sound = manualSound
      ? [scene.ambience, scene.secondaryAmbience, scene.sfx, scene.sfxTimeline, scene.music].filter(Boolean).join(" · ")
      : "AI_AUTO — design ambience, SFX, sound timing and music to match story, location, action, dialogue, pacing and emotion.";

    return {
      id: scene.id || `${episodeId}-scene-${index + 1}`,
      start,
      end,
      title: scene.title || `ฉาก ${index + 1}`,
      scene: scene.action || scene.title || `ฉาก ${index + 1}`,
      location: scene.location || "ยังไม่ระบุสถานที่",
      characterIds: scene.characterIds,
      action,
      emotion,
      lighting,
      sound,
      modelId: mainModelId,
      cameraShots: [{
        id: `${scene.id || index}-camera-1`,
        start,
        end,
        shotType: manualCamera ? scene.shot : "AI_AUTO",
        angle: manualCamera ? scene.angle : "AI_AUTO",
        lensMm: manualCamera ? lensNumber(scene.lens) : 0,
        cameraHeight: manualCamera ? scene.height : "AI_AUTO",
        movement: manualCamera ? scene.movement : "AI_AUTO",
        movementSpeed: manualCamera ? scene.cameraSpeed : "AI_AUTO",
        focus: manualCamera ? (scene.cameraSubjectId || scene.focus) : "AI_AUTO",
        depthOfField: manualCamera ? scene.dof : "AI_AUTO",
        composition: manualCamera ? scene.composition : "AI_AUTO",
        foregroundOcclusion: manualCamera ? "None" : "AI_AUTO",
      }],
      dialogue: dialogue ? [{
        id: `${scene.id || index}-dialogue-1`,
        characterId: scene.characterIds[0] || "narrator",
        start,
        end,
        text: dialogue,
        emotion,
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

  const projectLocks = manualAdvancedSetup ? {
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
  } : {
    project: true,
    character: false,
    style: false,
    voice: false,
    location: false,
    prop: false,
    canon: true,
    camera: false,
    lighting: false,
    motion: false,
    model: true,
  };

  const continuityBible = draft.scenes.map((scene, index) => manualContinuity
    ? `ฉาก ${index + 1}: ${scene.continuityNote || "รักษาความต่อเนื่องจากฉากก่อน"}`
    : `ฉาก ${index + 1}: AI AUTO Continuity — ตรวจและรักษาตัวละคร เสื้อผ้า พร็อพ สถานที่ เวลา ทิศทางการเคลื่อน และเหตุผลเชิงเรื่องให้ต่อเนื่องกับฉากก่อนโดยอัตโนมัติ.`);

  const canon = [
    manualAdvancedSetup ? draft.globalNegative : "",
    ...(manualContinuity ? draft.scenes.map((scene) => scene.negativePrompt) : []),
  ].filter(Boolean);

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
    locks: projectLocks,
    projectBible: [
      `สไตล์ภาพ: ${draft.visualStyle}`,
      `โมเดลหลัก: ${draft.model}`,
      manualAdvancedSetup
        ? `ข้อห้ามรวม: ${draft.globalNegative}`
        : "Locks / Negative Prompt: AI AUTO — ให้ทีม AI สร้างเฉพาะ Lock และ Negative Prompt ที่จำเป็นตามเนื้อเรื่อง ความต่อเนื่อง และคุณภาพภาพ โดยไม่ถือค่าที่ซ่อนไว้เป็นข้อบังคับจากผู้ใช้.",
      aiAutoPolicy,
      ...continuityBible,
    ].filter(Boolean).join("\n"),
    canon,
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
