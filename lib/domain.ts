export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";
export type EpisodeDuration = 10 | 15 | 30 | 60 | 90 | 120 | 150 | 180;
export type ModelMode = "single" | "safe-hybrid" | "custom-hybrid";
export type PromptMode = "strict" | "assisted" | "creative-director";
export type Resolution = "480p" | "720p" | "1080p";

export type LockProfile = {
  project: boolean;
  character: boolean;
  style: boolean;
  voice: boolean;
  location: boolean;
  prop: boolean;
  canon: boolean;
  camera: boolean;
  lighting: boolean;
  motion: boolean;
  model: boolean;
};

export type CharacterReference = {
  id: string;
  label: string;
  kind: "front" | "side" | "back" | "full-body" | "close-up" | "expression" | "custom";
  url?: string;
};

export type Character = {
  id: string;
  name: string;
  kind: "human" | "animal" | "creature" | "robot" | "alien" | "custom";
  description: string;
  appearance: string;
  outfit: string;
  personality: string;
  voiceProfile?: string;
  lock: boolean;
  references: CharacterReference[];
};

export type StylePreset = {
  id: string;
  nameTh: string;
  nameEn: string;
  category: string;
  descriptionTh: string;
  bestFor: string[];
  prompt: string;
  negativePrompt: string;
  palette: string[];
  previewClass: string;
};

export type CameraShot = {
  id: string;
  start: number;
  end: number;
  shotType: string;
  angle: string;
  lensMm: number;
  cameraHeight: string;
  movement: string;
  movementSpeed: string;
  focus: string;
  depthOfField: string;
  composition: string;
  foregroundOcclusion: string;
  coverageRole?: string;
  cameraSlot?: string;
  subject?: string;
  screenDirection?: string;
  eyelineTarget?: string;
  transitionIn?: string;
  transitionOut?: string;
  continuityAnchor?: string;
};

export type DialogueBeat = {
  id: string;
  characterId: string;
  start: number;
  end: number;
  text: string;
  emotion: string;
  speed: string;
};

export type TimelineSegment = {
  id: string;
  start: number;
  end: number;
  title: string;
  scene: string;
  location: string;
  characterIds: string[];
  action: string;
  emotion: string;
  lighting: string;
  sound: string;
  modelId?: string;
  cameraShots: CameraShot[];
  dialogue: DialogueBeat[];
};

export type Episode = {
  id: string;
  number: number;
  title: string;
  duration: EpisodeDuration;
  synopsis: string;
  status: "draft" | "ready" | "queued" | "generating" | "completed";
  segments: TimelineSegment[];
};

export type ModelDefinition = {
  id: string;
  name: string;
  provider: string;
  descriptionTh: string;
  bestFor: string[];
  maxSecondsPerGeneration: number;
  resolutions: Resolution[];
  supportsAudio: boolean;
  supportsImageReference: boolean;
  supportsVideoReference: boolean;
  supportsMultiShot: boolean;
  priceLevel: 1 | 2 | 3;
  enabled: boolean;
};

export type Project = {
  id: string;
  title: string;
  story: string;
  genre: string;
  mood: string;
  aspectRatio: AspectRatio;
  episodeCount: number | "open-ended";
  mainModelId: string;
  mainModelVersionId?: string;
  modelMode: ModelMode;
  promptMode: PromptMode;
  resolution: Resolution;
  styleId: string;
  locks: LockProfile;
  projectBible: string;
  canon: string[];
  characters: Character[];
  episodes: Episode[];
};

export type RenderSegment = {
  id: string;
  episodeId: string;
  order: number;
  start: number;
  end: number;
  duration: number;
  modelId: string;
  sourceSegmentIds: string[];
  continuityFromPrevious: boolean;
};

export type PromptBundle = {
  master: string;
  episode: string;
  shots: string[];
  negative: string;
  thaiSummary: string;
};