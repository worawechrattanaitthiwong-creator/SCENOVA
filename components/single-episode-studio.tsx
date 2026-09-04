"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./single-episode-studio.module.css";
import v11 from "./single-episode-studio-v11.module.css";
import SingleEpisodeAiDirectorPanel from "@/components/single-episode-ai-director-panel";
import StudioStylePreviewGallery from "@/components/studio-style-preview-gallery";
import { buildStudioAgentProject } from "@/lib/agent/studio-project";
import type { AiDirectorMeta, AiDirectorMode, AiDirectorNovelty, AiDirectorScenePatch, AiDirectorScope } from "@/lib/ai-director";
import {
  AI_SCOPE_OPTIONS,
  aiStorySignature,
  appendAiDirectorHistory,
  applyAiDirectorPatch,
  cloneAiDirectorScenes,
  readAiDirectorHistory,
  readManualAiSections,
} from "@/lib/ai-director-client";
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
  LOCATION_PRESETS,
  OBJECTIVE_PRESETS,
  PERFORMANCE_OPTIONS,
  SCENE_BEATS,
  SHOT_TYPES,
  TRANSITIONS,
  type ProductionChoice,
} from "@/lib/production-options";
import {
  AMBIENCE_PRESETS,
  MUSIC_PRESETS,
  SFX_PRESETS,
  VOICE_PROFILES,
} from "@/lib/sound-design-options";
import { getVideoUiCapability } from "@/lib/providers/video-ui-capabilities";
import { getVideoModelVersions } from "@/lib/video-model-versions";

type CharacterReference = {
  id: string;
  label: string;
  kind: "custom";
  url: string;
};

type Character = {
  id: string;
  name: string;
  role: string;
  appearance: string;
  voice: string;
  identityLock: boolean;
  voiceLock: boolean;
  references: CharacterReference[];
};

type Animal = {
  id: string;
  name: string;
  species: string;
  appearance: string;
  behavior: string;
};

type CharacterDirection = {
  blocking: string;
  action: string;
  emotion: string;
  eyeline: string;
  dialogue: string;
};

type StoryScene = {
  id: string;
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
  characterDirections: Record<string, CharacterDirection>;
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

type SelectedCharacterPayload = {
  id?: string;
  title?: string;
  metadata?: {
    role?: string;
    appearance?: string;
    personality?: string;
    costume?: string;
    voiceProfile?: string;
    promptHint?: string;
    referenceImages?: string[];
  };
};

type StudioVideoConnection = {
  provider: string;
  kind: string;
  modelId: string | null;
  enabledModelIds: string[];
  status: string;
  enabled: boolean;
};

type StudioVideoProvider = {
  id: string;
  kind: string;
  status: string;
  systemConfigured?: boolean;
};

type StudioVideoConnectionsPayload = {
  ok?: boolean;
  connections?: StudioVideoConnection[];
  providers?: StudioVideoProvider[];
};

type StudioModelProfile = {
  value: string;
  label: string;
  providerId: string;
  catalogKey: string;
  fixedModelId?: string;
  image: "ready" | "adapter" | "no";
  mode: "generate" | "video-edit" | "hdr";
  nativeAudio?: boolean;
};

const MODEL_PROFILES: StudioModelProfile[] = [
  { value: "runway:gen4.5", label: "Runway Gen-4.5", providerId: "runway", catalogKey: "Runway", fixedModelId: "gen4.5", image: "ready", mode: "generate" },
  { value: "runway:gen4_turbo", label: "Runway Gen-4 Turbo", providerId: "runway", catalogKey: "Runway", fixedModelId: "gen4_turbo", image: "ready", mode: "generate" },
  { value: "runway:seedance2_5", label: "Seedance 2.5", providerId: "runway", catalogKey: "Seedance 2.5 (Runway)", fixedModelId: "seedance2_5", image: "ready", mode: "generate", nativeAudio: true },
  { value: "runway:gemini_omni_flash", label: "Gemini Omni Flash 1.1", providerId: "runway", catalogKey: "Gemini Omni Flash 1.1 (Runway)", fixedModelId: "gemini_omni_flash", image: "ready", mode: "generate", nativeAudio: true },
  { value: "runway:aleph2", label: "Aleph 2.0", providerId: "runway", catalogKey: "Aleph 2.0 (Runway)", fixedModelId: "aleph2", image: "no", mode: "video-edit" },
  { value: "runway:ruby", label: "Ruby HDR", providerId: "runway", catalogKey: "Ruby HDR (Runway)", fixedModelId: "ruby", image: "no", mode: "hdr", nativeAudio: true },
  { value: "Kling", label: "Kling", providerId: "kling", catalogKey: "Kling", image: "ready", mode: "generate", nativeAudio: true },
  { value: "Veo", label: "Veo", providerId: "veo", catalogKey: "Veo", image: "adapter", mode: "generate", nativeAudio: true },
  { value: "Wan", label: "Wan", providerId: "wan", catalogKey: "Wan", image: "ready", mode: "generate", nativeAudio: true },
];

const ASPECTS = ["16:9 — Widescreen", "9:16 — Vertical", "1:1 — Square", "4:5 — Portrait"];
const STYLES = [
  "Cinematic Anime — อนิเมะภาพยนตร์",
  "Photorealistic Film — สมจริงแบบภาพยนตร์",
  "Warm Golden Hour — อบอุ่นแสงทอง",
  "Action Blockbuster — แอ็กชันบล็อกบัสเตอร์",
  "Sci-Fi Neon — ไซไฟนีออน",
  "Fantasy Storybook — แฟนตาซีภาพเล่าเรื่อง",
  "Dark Thriller — ทริลเลอร์โทนมืด",
  "Gothic Horror — สยองขวัญโกธิก",
  "Cinematic Romance — โรแมนติกภาพยนตร์",
  "Period Drama — ดราม่าย้อนยุค",
];
const ROLES = ["ตัวละครหลัก", "ตัวละครรอง", "ฝ่ายตรงข้าม", "ตัวละครรับเชิญ"];
const GLOBAL_LOCKS = [
  { key: "Character", label: "ล็อกตัวละคร", help: "รักษาหน้าตา รูปร่าง เสื้อผ้า และจุดจำของตัวละครตลอดทั้งตอน" },
  { key: "Voice", label: "ล็อกเสียง", help: "รักษาโปรไฟล์เสียงและบุคลิกการพูดของแต่ละตัวละคร" },
  { key: "Visual Style", label: "ล็อกสไตล์ภาพ", help: "คุมภาษาภาพ สี และระดับความสมจริงให้เหมือนกันทุกฉาก" },
  { key: "Camera Language", label: "ล็อกภาษากล้อง", help: "รักษาภาษากล้องหลัก แต่ยังปรับระยะภาพของแต่ละฉากได้" },
  { key: "Lighting", label: "ล็อกแสง", help: "ช่วยรักษาทิศทางและคุณภาพแสงระหว่างฉากที่ต่อเนื่องกัน" },
  { key: "Location", label: "ล็อกสถานที่", help: "รักษารูปทรงและรายละเอียดสถานที่เมื่อกลับมาใช้สถานที่เดิม" },
  { key: "Props", label: "ล็อกพร็อพ", help: "รักษารูปร่าง สี ตำแหน่ง และเจ้าของพร็อพสำคัญ" },
] as const;

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeCharacter(index: number): Character {
  return {
    id: makeId("character"),
    name: "",
    role: "",
    appearance: "",
    voice: "",
    identityLock: false,
    voiceLock: false,
    references: [],
  };
}

function normalizeCharacter(input: Partial<Character>, index: number): Character {
  const base = makeCharacter(index);
  return {
    ...base,
    ...input,
    id: input.id || base.id,
    name: input.name || base.name,
    identityLock: input.identityLock ?? false,
    voiceLock: input.voiceLock ?? false,
    references: Array.isArray(input.references) ? input.references : base.references,
  };
}

function makeAnimal(index: number): Animal {
  return { id: makeId("animal"), name: `สัตว์ ${index}`, species: "", appearance: "", behavior: "" };
}

function makeDirection(): CharacterDirection {
  return { blocking: "", action: "", emotion: "", eyeline: "", dialogue: "" };
}

function legacyDialogueFor(dialogue: string, characterName: string) {
  const prefix = `${characterName.trim()}:`;
  const line = dialogue.split(/\r?\n/).find((item) => item.trim().startsWith(prefix));
  return line ? line.trim().slice(prefix.length).trim() : "";
}

function closestChoice(value: string | null | undefined, options: ProductionChoice[], fallback: string) {
  const needle = (value || "").trim().toLocaleLowerCase();
  if (!needle) return fallback;
  const exact = options.find((item) => item.value.toLocaleLowerCase() === needle || item.label.toLocaleLowerCase() === needle);
  if (exact) return exact.value;
  const partial = options.find((item) => needle.includes(item.value.toLocaleLowerCase()) || item.value.toLocaleLowerCase().includes(needle));
  return partial?.value || fallback;
}

function makeScene(index: number, duration: number): StoryScene {
  return {
    id: makeId("scene"),
    title: `ฉาก ${index}`,
    duration,
    location: "",
    objective: "",
    beat: "",
    transition: "",
    action: "",
    dialogue: "",
    characterIds: [],
    animalIds: [],
    characterDirections: {},
    cameraSubjectId: "",
    shot: "",
    angle: "",
    lens: "",
    movement: "",
    height: "",
    cameraSpeed: "",
    focus: "",
    dof: "",
    composition: "",
    lighting: "",
    colorTemp: "",
    emotion: "",
    performance: "",
    ambience: "",
    secondaryAmbience: "",
    sfx: "",
    sfxTimeline: "",
    music: "",
    ambienceLevel: 55,
    sfxLevel: 80,
    dialogueLevel: 100,
    musicLevel: 35,
    continuityNote: "",
    negativePrompt: "",
  };
}

function normalizeScene(input: Partial<StoryScene>, index: number): StoryScene {
  const base = makeScene(index, input.duration || 6);
  return {
    ...base,
    ...input,
    id: input.id || base.id,
    title: input.title || base.title,
    characterIds: Array.isArray(input.characterIds) ? input.characterIds : [],
    animalIds: Array.isArray(input.animalIds) ? input.animalIds : [],
    characterDirections: Object.fromEntries(Object.entries(input.characterDirections || {}).map(([id, direction]) => [id, { ...makeDirection(), ...direction }])),
  };
}

function distributeScenes(current: StoryScene[], count: number, total: number): StoryScene[] {
  const safeCount = Math.max(1, Math.min(count, total));
  const baseDuration = Math.floor(total / safeCount);
  let remainder = total - baseDuration * safeCount;
  return Array.from({ length: safeCount }, (_, index) => {
    const duration = baseDuration + (remainder-- > 0 ? 1 : 0);
    const existing = current[index];
    return existing ? { ...existing, duration } : makeScene(index + 1, duration);
  });
}

function fitScenesToTotal(current: StoryScene[], total: number): StoryScene[] {
  const next = current.slice(0, Math.min(current.length, total)).map((scene) => ({ ...scene }));
  let overflow = next.reduce((sum, scene) => sum + scene.duration, 0) - total;
  for (let index = next.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const reducible = Math.max(0, next[index].duration - 1);
    const cut = Math.min(reducible, overflow);
    next[index].duration -= cut;
    overflow -= cut;
  }
  return next;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function Counter({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (value: number) => void; label: string }) {
  return <div className={styles.counter} aria-label={label}>
    <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
    <strong>{value}</strong>
    <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>＋</button>
  </div>;
}

function ChoiceField({ label, value, options, onChange, compact = false }: { label: string; value: string; options: ProductionChoice[]; onChange: (value: string) => void; compact?: boolean }) {
  const selected = options.find((item) => item.value === value);
  return <label className={`${styles.field} ${compact ? styles.compactField : ""}`}>
    <span>{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value=""> </option>
      {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
    {selected?.help ? <small>{selected.help}</small> : null}
  </label>;
}

export default function SingleEpisodeStudio() {
  const router = useRouter();
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [model, setModel] = useState("");
  const [modelVersion, setModelVersion] = useState("");
  const [aspect, setAspect] = useState("");
  const [visualStyle, setVisualStyle] = useState("");
  const [story, setStory] = useState("");
  const [globalNegative, setGlobalNegative] = useState("");
  const [locks, setLocks] = useState<string[]>([]);
  const [characters, setCharacters] = useState<Character[]>([makeCharacter(1), makeCharacter(2)]);
  const [hasAnimals, setHasAnimals] = useState(false);
  const [animals, setAnimals] = useState<Animal[]>([makeAnimal(1)]);
  const [totalDuration, setTotalDuration] = useState(30);
  const [scenes, setScenes] = useState<StoryScene[]>(() => distributeScenes([], 3, 30));
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [message, setMessage] = useState("พร้อมสร้างตอนเดียว");
  const [agentBudgetThb, setAgentBudgetThb] = useState(500);
  const [agentSubmitting, setAgentSubmitting] = useState(false);
  const [uploadingCharacterId, setUploadingCharacterId] = useState("");
  const [sceneAiBusy, setSceneAiBusy] = useState(false);
  const [sceneAiSummary, setSceneAiSummary] = useState("");
  const [aiDirectorMode, setAiDirectorMode] = useState<AiDirectorMode | "">("");
  const [aiDirectorNovelty, setAiDirectorNovelty] = useState<AiDirectorNovelty | "">("");
  const [aiRequiredErrors, setAiRequiredErrors] = useState<string[]>([]);
  const [sceneAiMeta, setSceneAiMeta] = useState<AiDirectorMeta | null>(null);
  const [sceneAiUndo, setSceneAiUndo] = useState<StoryScene[] | null>(null);
  const [sceneAiCharacterUndo, setSceneAiCharacterUndo] = useState<Character[] | null>(null);
  const [videoConnections, setVideoConnections] = useState<StudioVideoConnection[]>([]);
  const [videoProviders, setVideoProviders] = useState<StudioVideoProvider[]>([]);
  const [videoConnectionLoading, setVideoConnectionLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/api-connections", { credentials: "same-origin", cache: "no-store" });
        const data = await response.json() as StudioVideoConnectionsPayload;
        if (!active || !response.ok) return;
        setVideoConnections(Array.isArray(data.connections) ? data.connections.filter((item) => item.kind === "VIDEO") : []);
        setVideoProviders(Array.isArray(data.providers) ? data.providers.filter((item) => item.kind === "VIDEO") : []);
      } catch {
        // Status UI falls back to unavailable without changing generation behavior.
      } finally {
        if (active) setVideoConnectionLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("scenova-selected-character-v1");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as SelectedCharacterPayload;
      if (!payload.title) return;
      const meta = payload.metadata || {};
      const detail = [meta.appearance, meta.personality && `บุคลิก: ${meta.personality}`, meta.costume && `ชุด: ${meta.costume}`, meta.promptHint].filter(Boolean).join("\n");
      const imported: Character = {
        id: payload.id ? `library_${payload.id}` : makeId("library"),
        name: payload.title,
        role: meta.role ? (meta.role.toLowerCase().includes("protagonist") ? "ตัวละครหลัก" : "ตัวละครรอง") : "",
        appearance: detail || "นำเข้าจากคลังตัวละคร",
        voice: meta.voiceProfile && VOICE_PROFILES.includes(meta.voiceProfile) ? meta.voiceProfile : "",
        identityLock: false,
        voiceLock: false,
        references: (meta.referenceImages || []).filter(Boolean).slice(0, 8).map((url, referenceIndex) => ({
          id: payload.id ? "library_" + payload.id + "_reference_" + referenceIndex : makeId("library_reference"),
          label: "Library Reference " + (referenceIndex + 1),
          kind: "custom" as const,
          url,
        })),
      };
      const targetId = localStorage.getItem("scenova-character-import-target-v1");
      setCharacters((current) => {
        if (targetId && current.some((item) => item.id === targetId)) {
          return current.map((item) => item.id === targetId ? { ...imported, id: targetId } : item);
        }
        return [imported, ...current.filter((item) => item.id !== imported.id)].slice(0, 8);
      });
      setMessage(`นำเข้า ${payload.title} จากคลังแล้ว`);
    } catch {
      setMessage("อ่านตัวละครจากคลังไม่สำเร็จ");
    } finally {
      localStorage.removeItem("scenova-selected-character-v1");
      localStorage.removeItem("scenova-character-import-target-v1");
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("scenova-selected-style-v1");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as { title?: string };
      const title = payload.title?.trim();
      const matched = title ? STYLES.find((item) => item.toLowerCase().startsWith(title.toLowerCase())) : undefined;
      if (matched) setVisualStyle(matched);
    } finally {
      localStorage.removeItem("scenova-selected-style-v1");
    }
  }, []);

  useEffect(() => {
    if (!selectedSceneId && scenes[0]) setSelectedSceneId(scenes[0].id);
    if (selectedSceneId && !scenes.some((scene) => scene.id === selectedSceneId) && scenes[0]) setSelectedSceneId(scenes[0].id);
  }, [scenes, selectedSceneId]);

  useEffect(() => {
    setSceneAiMeta(null);
    setSceneAiSummary("");
    setSceneAiUndo(null);
    setSceneAiCharacterUndo(null);
    setAiRequiredErrors([]);
  }, [selectedSceneId]);

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];
  const selectedModelProfile = MODEL_PROFILES.find((item) => item.value === model) || MODEL_PROFILES[0];
  const modelVersions = useMemo(() => model ? getVideoModelVersions(selectedModelProfile.catalogKey) : [], [model, selectedModelProfile.catalogKey]);
  const selectedModelVersion = modelVersion ? modelVersions.find((item) => item.apiModelId === modelVersion) : undefined;
  const modelConnectionStates = useMemo(() => Object.fromEntries(MODEL_PROFILES.map((profile) => {
    const provider = videoProviders.find((item) => item.id === profile.providerId);
    const connection = videoConnections.find((item) => item.provider === profile.providerId && item.kind === "VIDEO");
    const adapterReady = provider?.status === "READY";
    const userConnectionReady = Boolean(connection?.enabled && connection.status === "CONNECTED");
    const credentialReady = userConnectionReady || Boolean(provider?.systemConfigured);
    const operationalReady = adapterReady && credentialReady;
    return [profile.value, { adapterReady, credentialReady, operationalReady, primaryReady: operationalReady && profile.mode === "generate" }];
  })), [videoConnections, videoProviders]);
  const selectedConnection = videoConnections.find((item) => item.provider === selectedModelProfile.providerId && item.kind === "VIDEO");
  const selectedProvider = videoProviders.find((item) => item.id === selectedModelProfile.providerId);
  const selectedConnectionState = modelConnectionStates[model];
  const selectedEnabledIds = Array.isArray(selectedConnection?.enabledModelIds) ? selectedConnection.enabledModelIds : [];
  const selectedVersionEnabled = Boolean(selectedProvider?.systemConfigured) || Boolean(
    selectedConnection?.enabled
    && selectedConnection.status === "CONNECTED"
    && (selectedEnabledIds.length === 0
      || !selectedModelVersion
      || selectedEnabledIds.includes(selectedModelVersion.apiModelId)
      || selectedConnection.modelId === selectedModelVersion.apiModelId)
  );
  const selectedModelReady = Boolean(selectedConnectionState?.primaryReady && selectedVersionEnabled);
  const videoCapability = getVideoUiCapability(selectedModelProfile.catalogKey);
  const providerMaxSeconds = Math.max(...videoCapability.durationSeconds);
  const providerMinScenes = Math.max(1, Math.ceil(totalDuration / providerMaxSeconds));
  const usedDuration = useMemo(() => scenes.reduce((sum, scene) => sum + scene.duration, 0), [scenes]);
  const remainingDuration = Math.max(0, totalDuration - usedDuration);
  const sceneTimes = useMemo(() => {
    let cursor = 0;
    return scenes.map((scene) => {
      const start = cursor;
      cursor += scene.duration;
      return { id: scene.id, start, end: cursor };
    });
  }, [scenes]);

  const readiness = useMemo(() => {
    const checks = [
      { ok: episodeTitle.trim().length > 2, label: "ตั้งชื่อตอน" },
      { ok: Boolean(model), label: "เลือกโมเดลวิดีโอ" },
      { ok: Boolean(aspect), label: "เลือกอัตราส่วนภาพ" },
      { ok: Boolean(visualStyle), label: "เลือกสไตล์ภาพ" },
      { ok: story.trim().length > 12, label: "เขียนแก่นเรื่อง" },
      { ok: characters.every((character) => character.name.trim() && character.role && character.voice && character.appearance.trim().length > 5), label: "ใส่ข้อมูลตัวละคร" },
      { ok: usedDuration === totalDuration, label: "จัดเวลาฉากให้ครบ" },
      { ok: scenes.every((scene) => scene.location.trim() && scene.action.trim().length > 5), label: "ใส่สถานที่และ Action ทุกฉาก" },
      { ok: scenes.every((scene) => scene.objective && scene.beat && scene.transition), label: "กำหนดจังหวะและการเปลี่ยนฉาก" },
      { ok: scenes.every((scene) => scene.shot && scene.angle && scene.lens && scene.movement && scene.height && scene.cameraSpeed && scene.focus && scene.dof && scene.composition), label: "กำหนดกล้องทุกฉาก" },
      { ok: scenes.every((scene) => scene.lighting && scene.colorTemp && scene.emotion && scene.performance), label: "กำหนดภาพและการแสดงทุกฉาก" },
    ];
    return { score: Math.round(checks.filter((item) => item.ok).length / checks.length * 100), missing: checks.filter((item) => !item.ok).map((item) => item.label) };
  }, [episodeTitle, model, aspect, visualStyle, story, characters, scenes, totalDuration, usedDuration]);

  function resizeCharacters(count: number) {
    const safeCount = Math.max(1, Math.min(8, count));
    const next = characters.slice(0, safeCount);
    while (next.length < safeCount) next.push(makeCharacter(next.length + 1));
    const allowed = new Set(next.map((item) => item.id));
    setCharacters(next);
    setScenes((current) => current.map((scene) => ({
      ...scene,
      characterIds: scene.characterIds.filter((id) => allowed.has(id)),
      cameraSubjectId: allowed.has(scene.cameraSubjectId) ? scene.cameraSubjectId : "",
      characterDirections: Object.fromEntries(Object.entries(scene.characterDirections).filter(([id]) => allowed.has(id))),
    })));
  }

  function resizeAnimals(count: number) {
    const safeCount = Math.max(1, Math.min(4, count));
    const next = animals.slice(0, safeCount);
    while (next.length < safeCount) next.push(makeAnimal(next.length + 1));
    const allowed = new Set(next.map((item) => item.id));
    setAnimals(next);
    setScenes((current) => current.map((scene) => ({ ...scene, animalIds: scene.animalIds.filter((id) => allowed.has(id)) })));
  }

  function resizeScenes(count: number) {
    const safeCount = Math.max(providerMinScenes, Math.min(Math.max(1, Math.round(count)), totalDuration));
    setScenes((current) => distributeScenes(current, safeCount, totalDuration));
  }

  function changeTotalDuration(value: number) {
    const next = Math.max(1, Math.min(180, Math.round(value || 1)));
    const requiredScenes = Math.max(1, Math.ceil(next / providerMaxSeconds));
    setTotalDuration(next);
    setScenes((current) => {
      const nextCount = Math.max(requiredScenes, Math.min(current.length, next));
      return distributeScenes(current, nextCount, next);
    });
  }

  function changeModel(nextModel: string) {
    if (!nextModel) {
      setModel("");
      setModelVersion("");
      return;
    }
    const profile = MODEL_PROFILES.find((item) => item.value === nextModel) || MODEL_PROFILES[0];
    const capability = getVideoUiCapability(profile.catalogKey);
    const maxSeconds = Math.max(...capability.durationSeconds);
    const requiredScenes = Math.max(1, Math.ceil(totalDuration / maxSeconds));
    setModel(nextModel);
    const versions = getVideoModelVersions(profile.catalogKey);
    setModelVersion(profile.fixedModelId || versions.find((item) => item.recommended)?.apiModelId || versions[0]?.apiModelId || "");
    setScenes((current) => {
      const nextCount = Math.max(requiredScenes, Math.min(current.length, totalDuration));
      const needsRedistribution = current.length !== nextCount || current.some((scene) => scene.duration > maxSeconds);
      return needsRedistribution ? distributeScenes(current, nextCount, totalDuration) : current;
    });
  }

  function patchCharacter(id: string, patch: Partial<Character>) {
    const previous = characters.find((item) => item.id === id);
    setCharacters((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    if (previous && typeof patch.name === "string" && patch.name.trim() && patch.name !== previous.name) {
      setScenes((current) => current.map((scene) => ({
        ...scene,
        dialogue: scene.dialogue.split(/\r?\n/).map((line) => line.trim().startsWith(`${previous.name}:`) ? `${patch.name}:${line.trim().slice(previous.name.length + 1)}` : line).join("\n"),
      })));
    }
  }

  async function uploadCharacterReferences(characterId: string, files: File[]) {
    if (!files.length || uploadingCharacterId) return;
    const character = characters.find((item) => item.id === characterId);
    const remaining = Math.max(0, 8 - (character?.references.length || 0));
    if (!remaining) {
      setMessage("ตัวละครนี้มีรูปอ้างอิงครบ 8 รูปแล้ว");
      return;
    }
    const selected = files.slice(0, remaining);
    const formData = new FormData();
    selected.forEach((file) => formData.append("images", file));
    setUploadingCharacterId(characterId);
    setMessage("กำลังอัปโหลดรูปอ้างอิงตัวละคร...");
    try {
      const response = await fetch("/api/character-references", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });
      const data = await response.json() as { references?: CharacterReference[]; error?: string };
      if (!response.ok || !Array.isArray(data.references)) throw new Error(data.error || "อัปโหลดรูปตัวละครไม่สำเร็จ");
      setCharacters((current) => current.map((item) => item.id === characterId
        ? { ...item, references: [...item.references, ...data.references!].slice(0, 8) }
        : item));
      setMessage("เพิ่มรูปอ้างอิงตัวละคร " + data.references.length + " รูปแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปโหลดรูปตัวละครไม่สำเร็จ");
    } finally {
      setUploadingCharacterId("");
    }
  }

  async function removeCharacterReference(characterId: string, reference: CharacterReference) {
    setCharacters((current) => current.map((item) => item.id === characterId
      ? { ...item, references: item.references.filter((entry) => entry.id !== reference.id) }
      : item));
    try {
      await fetch(reference.url, { method: "DELETE", credentials: "same-origin" });
    } catch {
      // UI removal should not be blocked if storage cleanup is temporarily unavailable.
    }
  }

  function patchAnimal(id: string, patch: Partial<Animal>) {
    setAnimals((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function patchScene(patch: Partial<StoryScene>) {
    if (!selectedScene) return;
    setScenes((current) => current.map((scene) => scene.id === selectedScene.id ? { ...scene, ...patch } : scene));
  }

  function patchCharacterDirection(characterId: string, patch: Partial<CharacterDirection>) {
    if (!selectedScene) return;
    patchScene({ characterDirections: { ...selectedScene.characterDirections, [characterId]: { ...(selectedScene.characterDirections[characterId] || makeDirection()), ...patch } } });
  }

  function toggleSceneCharacter(id: string) {
    if (!selectedScene) return;
    const exists = selectedScene.characterIds.includes(id);
    const nextIds = exists ? selectedScene.characterIds.filter((item) => item !== id) : [...selectedScene.characterIds, id];
    const directions = { ...selectedScene.characterDirections };
    if (exists) delete directions[id];
    else directions[id] = directions[id] || makeDirection();
    patchScene({ characterIds: nextIds, characterDirections: directions, cameraSubjectId: exists && selectedScene.cameraSubjectId === id ? "" : selectedScene.cameraSubjectId });
  }

  function toggleSceneAnimal(id: string) {
    if (!selectedScene) return;
    patchScene({ animalIds: selectedScene.animalIds.includes(id) ? selectedScene.animalIds.filter((item) => item !== id) : [...selectedScene.animalIds, id] });
  }

  function changeSceneDuration(value: number) {
    if (!selectedScene) return;
    setScenes((current) => {
      const other = current.reduce((sum, scene) => sum + (scene.id === selectedScene.id ? 0 : scene.duration), 0);
      const nextDuration = Math.max(1, Math.min(value, providerMaxSeconds, Math.max(1, totalDuration - other)));
      return current.map((scene) => scene.id === selectedScene.id ? { ...scene, duration: nextDuration } : scene);
    });
  }

  function copyCameraToAll() {
    if (!selectedScene) return;
    const keys = ["shot", "angle", "lens", "movement", "height", "cameraSpeed", "focus", "dof", "composition"] as const;
    setScenes((current) => current.map((scene) => ({ ...scene, ...Object.fromEntries(keys.map((key) => [key, selectedScene[key]])) })));
    setMessage("คัดลอกภาษากล้องของฉากนี้ไปทุกฉากแล้ว");
  }

  function copyLookToAll() {
    if (!selectedScene) return;
    setScenes((current) => current.map((scene) => ({ ...scene, lighting: selectedScene.lighting, colorTemp: selectedScene.colorTemp, performance: selectedScene.performance })));
    setMessage("คัดลอกแสงและ Performance ไปทุกฉากแล้ว");
  }

  function toggleLock(key: string) {
    setLocks((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function patchCharacterDialogue(characterId: string, value: string) {
    if (!selectedScene) return;
    setScenes((current) => current.map((scene) => {
      if (scene.id !== selectedScene.id) return scene;
      const nextDirections = {
        ...scene.characterDirections,
        [characterId]: { ...(scene.characterDirections[characterId] || makeDirection()), dialogue: value },
      };
      const dialogue = scene.characterIds.map((id) => {
        const character = characters.find((item) => item.id === id);
        if (!character) return "";
        const spoken = nextDirections[id]?.dialogue || legacyDialogueFor(scene.dialogue, character.name);
        return spoken.trim() ? `${character.name}: ${spoken.trim()}` : "";
      }).filter(Boolean).join("\n");
      return { ...scene, characterDirections: nextDirections, dialogue };
    }));
  }

  function friendlyAiError(value: string) {
    if (value.startsWith("EMERGENCY_") || value.startsWith("LLM_DISABLED")) return "ระบบ AI ถูกระงับชั่วคราวโดยผู้ดูแลระบบ";
    if (value.includes("CONNECTION_REQUIRED") || value.includes("API_KEY")) return "ยังไม่ได้เชื่อมต่อ AI Provider กรุณาตั้งค่า API ก่อนใช้งาน";
    if (value.includes("INSUFFICIENT_CREDITS")) return "เครดิตไม่เพียงพอสำหรับให้ AI วิเคราะห์ฉาก";
    if (value.includes("RATE_LIMIT") || value.includes("429")) return "มีคำขอ AI จำนวนมาก กรุณารอสักครู่แล้วลองใหม่";
    if (value === "UNAUTHORIZED") return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
    if (value === "INVALID_REQUEST") return "ข้อมูลสำหรับ AI ไม่ครบ กรุณาตรวจช่องที่ระบบทำกรอบแดงไว้";
    return value || "AI วิเคราะห์ฉากไม่สำเร็จ";
  }

  async function arrangeSceneWithAi(scope: AiDirectorScope = "all") {
    if (!selectedScene || sceneAiBusy) return;

    const required: string[] = [];
    if (!aiDirectorMode) required.push("mode");
    if (!aiDirectorNovelty) required.push("novelty");
    if (!story.trim() && !selectedScene.action.trim()) required.push("source");
    if (required.length) {
      setAiRequiredErrors(required);
      const missing = [
        required.includes("mode") ? "โหมดผู้กำกับ AI" : "",
        required.includes("novelty") ? "ระดับความแตกต่าง" : "",
        required.includes("source") ? "เรื่องหลัก หรือ Action รวมของฉากอย่างน้อย 1 ช่อง" : "",
      ].filter(Boolean).join(" • ");
      setMessage("AI ช่วยคิดยังเริ่มไม่ได้ · กรุณาใส่ " + missing);
      window.requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>('[data-ai-required-error="true"]');
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        if (target instanceof HTMLSelectElement || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) target.focus();
        else target?.querySelector<HTMLElement>("select,input,textarea")?.focus();
      });
      return;
    }
    setAiRequiredErrors([]);

    const sceneIndex = scenes.findIndex((item) => item.id === selectedScene.id);
    const manualSections = readManualAiSections();
    const historyKey = aiStorySignature(episodeTitle, story, sceneIndex);
    const history = readAiDirectorHistory(historyKey);
    const scopeLabel = scope === "all" ? "ช่องว่างทั้งฉาก" : AI_SCOPE_OPTIONS.find((item) => item.value === scope)?.label || scope;
    const fillMode = scope === "all" ? "empty-only" : "replace-scope";
    setSceneAiBusy(true);
    setSceneAiSummary("");
    setMessage(`AI Director กำลังสร้าง Candidate และตรวจ ${scopeLabel} ของฉาก ${sceneIndex + 1}...`);
    try {
      const response = await fetch("/api/ai/director", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: aiDirectorMode,
          novelty: aiDirectorNovelty,
          scope,
          fillMode,
          episodeTitle,
          story,
          model,
          modelVersion,
          aspect,
          visualStyle,
          locks,
          totalDuration,
          sceneIndex,
          sceneCount: scenes.length,
          currentScene: selectedScene,
          previousScene: sceneIndex > 0 ? scenes[sceneIndex - 1] : null,
          nextScene: sceneIndex < scenes.length - 1 ? scenes[sceneIndex + 1] : null,
          cast: characters.map((item) => ({ id: item.id, name: item.name, role: item.role, appearance: item.appearance, voice: item.voice })),
          manualSections,
          history,
        }),
      });
      const data = await response.json() as {
        scene?: AiDirectorScenePatch;
        meta?: AiDirectorMeta;
        provider?: string;
        usage?: { costThb?: number };
        characters?: Array<{
          id: string;
          name: string;
          role: string;
          appearance: string;
          voice: string;
          action: string;
          emotion: string;
          dialogue: string;
        }>;
        error?: string;
      };
      if (!response.ok || !data.scene || !data.meta) throw new Error(data.error || "AI_DIRECTOR_FAILED");

      setSceneAiUndo(cloneAiDirectorScenes(scenes));
      setSceneAiCharacterUndo(characters.map((item) => ({ ...item, references: [...item.references] })));
      if (scope === "all" && data.characters?.length) {
        setCharacters((current) => {
          const suggestions = new Map(data.characters!.map((item) => [item.id, item]));
          const next = current.map((character) => {
            const suggestion = suggestions.get(character.id);
            if (!suggestion) return character;
            return {
              ...character,
              name: character.name.trim() || suggestion.name,
              role: character.role.trim() || suggestion.role,
              appearance: character.appearance.trim() || suggestion.appearance,
              voice: character.voice.trim() || suggestion.voice,
            };
          });
          for (const suggestion of data.characters!) {
            if (next.some((item) => item.id === suggestion.id) || next.length >= 8) continue;
            next.push(normalizeCharacter({
              id: suggestion.id,
              name: suggestion.name,
              role: suggestion.role,
              appearance: suggestion.appearance,
              voice: suggestion.voice,
            }, next.length + 1));
          }
          return next.slice(0, 8);
        });
      }
      setScenes((current) => current.map((scene) => scene.id === selectedScene.id
        ? applyAiDirectorPatch(scene, data.scene!, manualSections, locks, { preserveFilled: fillMode === "empty-only" })
        : scene));
      appendAiDirectorHistory(historyKey, data.meta.historyEntry);
      setSceneAiMeta(data.meta);
      const cost = Number(data.usage?.costThb || 0);
      const providerCopy = `${data.provider || "AI Director"}${cost > 0 ? ` · ฿${cost.toFixed(4)}` : " · BYOK"}`;
      setSceneAiSummary(`${data.meta.rationaleTh} · ${providerCopy}`);
      const castFilled = scope === "all" ? (data.characters?.length || 0) : 0;
      setMessage(scope === "all"
        ? `AI Director เติมทุกช่องว่างที่วิเคราะห์ได้แล้ว ${data.meta.changedFields.length} ค่า${castFilled ? ` · จัดตัวละคร ${castFilled} คน` : ""} · ค่าที่คุณกรอก/เลือกไว้เดิมไม่ถูกเปลี่ยน`
        : `AI Director จัด ${scopeLabel} ใหม่แล้ว · เปลี่ยน ${data.meta.changedFields.length} ค่า · คุมความซ้ำด้วยประวัติ ${history.length + 1} รุ่น`);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "AI_DIRECTOR_FAILED";
      setMessage(raw === "AI_DIRECTOR_SOURCE_REQUIRED" ? "กรุณาใส่เรื่องหรือ Action ก่อนให้ AI ช่วยคิด" : friendlyAiError(raw));
    } finally {
      setSceneAiBusy(false);
    }
  }

  function undoLastAiSceneChange() {
    if (!sceneAiUndo || sceneAiBusy) return;
    setScenes(cloneAiDirectorScenes(sceneAiUndo));
    if (sceneAiCharacterUndo) setCharacters(sceneAiCharacterUndo.map((item) => ({ ...item, references: [...item.references] })));
    setSceneAiUndo(null);
    setSceneAiCharacterUndo(null);
    setSceneAiMeta(null);
    setSceneAiSummary("");
    setMessage("ย้อนกลับค่าจาก AI ครั้งล่าสุดแล้ว");
  }

  async function sendToAgent() {
    if (agentSubmitting) return;
    if (!story.trim()) {
      setMessage("กรุณาใส่เรื่องหรือเหตุการณ์ของตอนก่อนส่งให้ทีม AI");
      document.querySelector("#setup")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (readiness.score < 100 && !window.confirm(`ข้อมูลพร้อม ${readiness.score}% และยังขาด: ${readiness.missing.join(" • ")}\n\nต้องการส่งให้ทีม AI ช่วยทำงานต่อหรือไม่?`)) return;

    setAgentSubmitting(true);
    setMessage("กำลังส่ง Storyboard ให้ทีม AI...");
    try {
      const project = buildStudioAgentProject({
        episodeTitle,
        model,
        modelVersion,
        aspect,
        visualStyle,
        story,
        globalNegative,
        locks,
        characters,
        hasAnimals,
        animals: hasAnimals ? animals : [],
        totalDuration,
        scenes,
      }, crypto.randomUUID());
      const response = await fetch("/api/agent/runs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, episodeIndex: 0, maxEpisodes: 1, budgetThb: agentBudgetThb, mode: "STUDIO_STORYBOARD" }),
      });
      const data = await response.json() as { runId?: string; error?: string };
      if (!response.ok || !data.runId) {
        const friendly = data.error === "AGENT_USER_CONCURRENCY_LIMIT"
          ? "มีงาน Agent กำลังทำครบจำนวนแล้ว กรุณารอหรือยกเลิกงานเดิมก่อน"
          : data.error || "ส่งงานให้ทีม AI ไม่สำเร็จ";
        throw new Error(friendly);
      }
      localStorage.setItem("scenova-last-agent-run-v1", data.runId);
      setMessage("ส่งงานให้ทีม AI แล้ว กำลังเปิดศูนย์ควบคุม...");
      router.push(`/agent?run=${encodeURIComponent(data.runId)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ส่งงานให้ทีม AI ไม่สำเร็จ");
      setAgentSubmitting(false);
    }
  }

  const estimatedCredits = Math.max(1, Math.round(totalDuration * 3));

  return <main className={styles.main}>
    <header className={styles.hero}>
      <div>
        <span className={styles.eyebrow}>สตูดิโอสร้างตอนเดียว</span>
        <h1>สร้างตอนเดียวให้จบใน Workspace เดียว</h1>
        <p>โหมดนี้สำหรับหนังสั้น คลิป หรือตอนเดียว ตั้งเรื่อง ตัวละคร ฉาก กล้อง แสง การแสดง เสียง และ Continuity แล้วส่งต่อไป Prompt & Render</p>
      </div>
      <div className={styles.heroActions}>
        <span className={styles.status}>{message}</span>
        <button type="button" className={styles.primaryButton} onClick={() => void sendToAgent()} disabled={agentSubmitting}>{agentSubmitting ? "กำลังส่งงาน..." : "ส่งให้ทีม AI ผลิต →"}</button>
      </div>
    </header>

    <nav className={styles.flowBar} aria-label="ขั้นตอนสร้างตอนเดียว">
      <a href="#setup"><b>1</b><span>ตั้งค่าตอน<small>เรื่อง + โมเดล</small></span></a>
      <a href="#characters"><b>2</b><span>ตัวละคร<small>ล็อกตัวตน + ล็อกเสียง</small></span></a>
      <a href="#scenes"><b>3</b><span>กำกับฉาก<small>กล้อง + แสง + เสียง</small></span></a>
      <a href="#review"><b>4</b><span>ตรวจความพร้อม<small>ส่ง Storyboard ให้ทีม AI</small></span></a>
    </nav>

    <section id="setup" className={styles.panel}>
      <div className={styles.sectionHead}>
        <div><span>ตั้งค่าตอน</span><h2>กำหนดภาพรวมของตอนเดียว</h2></div>
        <p>ค่าชุดนี้เป็น Master Context ของทุกฉาก ถ้าล็อกไว้ Analyzer และ Prompt Compiler ต้องยึดค่ากลางนี้ก่อนค่าที่ AI เสนอ</p>
      </div>
      <div className={styles.setupGrid}>
        <label className={styles.field}><span>ชื่อตอน</span><input value={episodeTitle} onChange={(event) => setEpisodeTitle(event.target.value)} placeholder="เช่น คืนสุดท้ายที่สถานีรถไฟ" /><small>ชื่อสำหรับร่าง งาน Render และ Video Library</small></label>
        <div className={styles.field}>
          <span>โมเดลวิดีโอ</span>
          <div style={{ display: "grid", gridTemplateColumns: selectedModelProfile.fixedModelId ? "minmax(0,1fr)" : "minmax(0,1fr) minmax(0,1.2fr)", gap: 6 }}>
            <select aria-label="โมเดลวิดีโอ" value={model} onChange={(event) => changeModel(event.target.value)}>
              <option value=""> </option>
              {MODEL_PROFILES.map((item) => {
                const state = modelConnectionStates[item.value];
                const marker = videoConnectionLoading ? "⚪" : state?.operationalReady ? (item.mode === "generate" ? "🟢" : "🟣") : state?.adapterReady ? "🟠" : "🔴";
                const inputMarker = item.image === "ready" ? "🖼" : item.image === "adapter" ? "⚠️🖼" : item.mode === "generate" ? "" : "🎞";
                return <option key={item.value} value={item.value}>{marker} {inputMarker} {item.label}</option>;
              })}
            </select>
            {!model || !selectedModelProfile.fixedModelId ? <select aria-label="รุ่นโมเดล" value={modelVersion} onChange={(event) => setModelVersion(event.target.value)}>
              <option value=""> </option>
              {modelVersions.map((item) => {
                const versionReady = Boolean(selectedProvider?.systemConfigured) || Boolean(selectedConnection?.enabled && selectedConnection.status === "CONNECTED" && (selectedEnabledIds.length === 0 || selectedEnabledIds.includes(item.apiModelId) || selectedConnection.modelId === item.apiModelId));
                return <option key={item.apiModelId} value={item.apiModelId}>{versionReady ? "🟢" : "⚪"} {item.label}</option>;
              })}
            </select> : null}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontSize: 10 }}>
              {!model ? "⚪ ยังไม่ได้เลือกโมเดล" : videoConnectionLoading ? "⚪ กำลังตรวจ Connection…" : selectedConnectionState?.operationalReady ? (selectedModelProfile.mode === "generate" ? "🟢 คีย์เชื่อมต่อแล้ว" : "🟣 คีย์เชื่อมต่อแล้ว · เครื่องมือแปลงวิดีโอ") : selectedConnectionState?.adapterReady ? "🟠 ยังไม่ได้เชื่อมต่อ / Connection ไม่พร้อม" : "🔴 Adapter ยังไม่พร้อม"}
            </span>
            <span style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontSize: 10 }}>
              {!model ? "เลือกรูปแบบอินพุตหลังเลือกโมเดล" : selectedModelProfile.image === "ready" ? "🖼 รับรูปอ้างอิง" : selectedModelProfile.image === "adapter" ? "⚠️🖼 Model รองรับรูป แต่ SCENOVA Adapter ยังไม่ส่งรูป" : "🎞 ใช้วิดีโอต้นฉบับ ไม่รับรูป"}
            </span>
            {model && selectedModelProfile.nativeAudio ? <span style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontSize: 10 }}>🔊 Native Audio</span> : null}
            {model && selectedModelProfile.mode === "video-edit" ? <span style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid rgba(167,112,255,.35)", fontSize: 10 }}>🎞 Video Edit เท่านั้น · ต้องมีวิดีโอต้นฉบับ</span> : null}
            {model && selectedModelProfile.mode === "hdr" ? <span style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid rgba(167,112,255,.35)", fontSize: 10 }}>🎞 HDR Post-process เท่านั้น · ต้องมีวิดีโอต้นฉบับ</span> : null}
            {model && !videoConnectionLoading && selectedModelProfile.mode === "generate" && !selectedModelReady ? <Link href="/profile/api" style={{ fontSize: 10, color: "#bd8cff" }}>ตั้งค่า Provider →</Link> : null}
          </div>
          <small>{!model ? "เลือกโมเดล AI ก่อน ระบบจะไม่กำหนด Provider หรือ Version แทนคุณ" : selectedModelVersion ? `ระบบจะส่ง Model ID จริง: ${selectedModelVersion.apiModelId} · ${selectedModelVersion.note} · สิทธิ์รายโมเดลยืนยันเมื่อ Provider รับงานครั้งแรก` : "เลือกรุ่นของ Provider ที่จะใช้สร้างคลิปจริง"}</small>
        </div>
        <label className={styles.field}><span>อัตราส่วนภาพ</span><select value={aspect} onChange={(event) => setAspect(event.target.value)}><option value=""> </option>{ASPECTS.map((item) => <option key={item}>{item}</option>)}</select><small>ใช้สัดส่วนเดียวกันทุกฉากของตอนนี้</small></label>
        <label className={styles.field}><span>สไตล์ภาพ</span><select value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)}><option value=""> </option>{STYLES.map((item) => <option key={item}>{item}</option>)}</select><small>Master Style ของตอนนี้</small></label>
        <label data-ai-required-error={aiRequiredErrors.includes("source") ? "true" : undefined} className={`${styles.field} ${styles.storyField} ${aiRequiredErrors.includes("source") ? styles.requiredError : ""}`}><span>เรื่อง / เหตุการณ์ของตอน</span><textarea value={story} onChange={(event) => { setStory(event.target.value); setAiRequiredErrors((current) => current.filter((item) => item !== "source")); }} placeholder="เล่าว่าใครต้องการอะไร เกิดปัญหาอะไร เหตุการณ์ดำเนินอย่างไร และจบแบบไหน" /><small>เขียนเป็นภาษาธรรมชาติได้ Analyzer จะนำข้อมูลนี้ไปจัดโครง Prompt ภายหลัง</small></label>
        <div className={styles.episodeTiming}>
          <label className={styles.timingField}>
            <span>ความยาวรวมของตอน</span>
            <div className={styles.secondsInput}><input type="number" min={1} max={180} step={1} value={totalDuration} onChange={(event) => changeTotalDuration(Number(event.target.value))} /><b data-sc-help={`${model} รองรับสูงสุด ${providerMaxSeconds} วินาทีต่อคลิป ระบบเพิ่มฉากให้อัตโนมัติเมื่อเวลารวมยาวกว่าที่ API สร้างได้ต่อครั้ง`} data-sc-help-label="วินาที">วินาที</b></div>
          </label>
          <div className={styles.timingField}>
            <span>จำนวนฉาก</span>
            <Counter value={scenes.length} min={providerMinScenes} max={totalDuration} onChange={resizeScenes} label="จำนวนฉาก" />
          </div>
        </div>
      </div>
      <StudioStylePreviewGallery value={visualStyle} onChange={setVisualStyle} />
      <div className={styles.lockGrid}>
        {GLOBAL_LOCKS.map((lock) => <label key={lock.key} className={locks.includes(lock.key) ? styles.lockActive : ""}><input type="checkbox" checked={locks.includes(lock.key)} onChange={() => toggleLock(lock.key)} /><span><b>{lock.label}</b><small>{lock.help}</small></span></label>)}
      </div>
    </section>

    <section id="characters" className={styles.panel}>
      <div className={styles.sectionHeadRow}>
        <div className={styles.sectionHead}><div><span>ตัวละครและตัวตน</span><h2>กำหนดตัวตนก่อนกำกับกล้อง</h2></div><p>ตัวละครที่อยู่ใน Scene จะมี Blocking, Action, Emotion และ Eyeline แยกของตัวเอง กล้องสามารถเลือกตามตัวละครคนใดคนหนึ่งได้โดยตรง</p></div>
        <div className={styles.countBox}><span>จำนวนตัวละคร</span><Counter value={characters.length} min={1} max={8} onChange={resizeCharacters} label="จำนวนตัวละคร" /></div>
      </div>
      <div className={styles.characterList}>
        {characters.map((character, index) => <article className={styles.characterCard} key={character.id}>
          <div className={styles.characterNumber}>{index + 1}</div>
          <div className={styles.characterFields}>
            <div className={styles.threeGrid}>
              <label className={styles.field}><span>ชื่อ</span><input value={character.name} onChange={(event) => patchCharacter(character.id, { name: event.target.value })} placeholder={`ตัวละคร ${index + 1}`} /></label>
              <label className={styles.field}><span>บทบาท</span><select value={character.role} onChange={(event) => patchCharacter(character.id, { role: event.target.value })}><option value=""> </option>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
              <label className={styles.field}><span>โปรไฟล์เสียง</span><select value={character.voice} onChange={(event) => patchCharacter(character.id, { voice: event.target.value })}><option value=""> </option>{VOICE_PROFILES.map((voice) => <option key={voice}>{voice}</option>)}</select></label>
            </div>
            <label className={styles.field}><span>รูปลักษณ์ / เสื้อผ้า / บุคลิก / จุดจำ</span><textarea value={character.appearance} onChange={(event) => patchCharacter(character.id, { appearance: event.target.value })} placeholder="ใบหน้า ทรงผม อายุ รูปร่าง เสื้อผ้า เครื่องประดับ บุคลิก และรายละเอียดที่ห้ามเปลี่ยน" /></label>
            <div className={styles.referencePicker}>
              <div className={styles.referenceHead}>
                <div><b>รูปอ้างอิงตัวละคร</b><span>เลือกรูปจากเครื่องได้หลายไฟล์พร้อมกัน สูงสุด 8 รูป ระบบจะส่งภาพเหล่านี้เป็น Character Reference ให้โมเดลที่รองรับ</span></div>
                <label className={styles.referenceButton} aria-disabled={uploadingCharacterId === character.id}>
                  {uploadingCharacterId === character.id ? "กำลังอัปโหลด..." : "＋ เลือกรูปจากเครื่อง"}
                  <input
                    className={styles.referenceInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={uploadingCharacterId === character.id || character.references.length >= 8}
                    onChange={(event) => {
                      const files = Array.from(event.currentTarget.files || []);
                      event.currentTarget.value = "";
                      void uploadCharacterReferences(character.id, files);
                    }}
                  />
                </label>
              </div>
              {character.references.length ? <div className={styles.referenceGrid}>
                {character.references.map((reference) => <figure className={styles.referenceThumb} key={reference.id}>
                  <img src={reference.url} alt={reference.label || character.name} loading="lazy" />
                  <figcaption title={reference.label}>{reference.label}</figcaption>
                  <button type="button" onClick={() => void removeCharacterReference(character.id, reference)} aria-label={"ลบ " + reference.label}>×</button>
                </figure>)}
              </div> : <div className={styles.referenceEmpty}>ยังไม่มีรูปอ้างอิง — เลือก Front / 3/4 / Side / Full Body หรือ Expression ได้หลายรูป</div>}
            </div>
            <div className={styles.miniLocks}><label className={character.identityLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.identityLock} onChange={(event) => patchCharacter(character.id, { identityLock: event.target.checked })} />ล็อกตัวตน</label><label className={character.voiceLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.voiceLock} onChange={(event) => patchCharacter(character.id, { voiceLock: event.target.checked })} />ล็อกเสียง</label><Link href="/libraries?tab=characters" onClick={() => localStorage.setItem("scenova-character-import-target-v1", character.id)}>＋ นำเข้าตัวละครจากคลัง</Link><Link href="/libraries?tab=voices">เปิดคลังเสียง</Link></div>
          </div>
        </article>)}
      </div>
      <div className={styles.animalToggle}><div><strong>มีสัตว์หรือสิ่งมีชีวิตในตอนนี้หรือไม่?</strong><span>เปิดเฉพาะเมื่อจำเป็น เพื่อไม่เพิ่มข้อมูลที่ Generator ต้องรักษาโดยไม่จำเป็น</span></div><div><button type="button" className={!hasAnimals ? styles.toggleActive : ""} onClick={() => { setHasAnimals(false); setScenes((current) => current.map((scene) => ({ ...scene, animalIds: [] }))); }}>ไม่มี</button><button type="button" className={hasAnimals ? styles.toggleActive : ""} onClick={() => setHasAnimals(true)}>มี</button></div></div>
      {hasAnimals ? <div className={styles.animalBlock}><div className={styles.animalHead}><b>สัตว์ / Creature</b><div className={styles.countBox}><span>จำนวน</span><Counter value={animals.length} min={1} max={4} onChange={resizeAnimals} label="จำนวนสัตว์" /></div></div>{animals.map((animal) => <div className={styles.animalRow} key={animal.id}><label className={styles.field}><span>ชื่อ</span><input value={animal.name} onChange={(event) => patchAnimal(animal.id, { name: event.target.value })} /></label><label className={styles.field}><span>ชนิด</span><input value={animal.species} onChange={(event) => patchAnimal(animal.id, { species: event.target.value })} /></label><label className={styles.field}><span>พฤติกรรม</span><input value={animal.behavior} onChange={(event) => patchAnimal(animal.id, { behavior: event.target.value })} /></label><label className={styles.field}><span>รูปลักษณ์</span><input value={animal.appearance} onChange={(event) => patchAnimal(animal.id, { appearance: event.target.value })} /></label></div>)}</div> : null}
    </section>

    <section id="scenes" className={styles.panel}>
      <div className={styles.sectionHead}>
        <div><span>กำกับฉาก</span><h2>กำกับทีละฉาก พร้อมกล้องเต็มชุด</h2></div><p>แต่ละฉากมีเวลา ตัวละคร กล้อง เลนส์ แสง การแสดง เสียง และข้อห้ามของตัวเอง โดยผลรวมต้องไม่เกินเวลาตอนที่ตั้งไว้</p>
      </div>

      <div className={styles.timeline}>{scenes.map((scene, index) => <button type="button" key={scene.id} className={scene.id === selectedScene?.id ? styles.timelineActive : ""} onClick={() => setSelectedSceneId(scene.id)}><b>ฉาก {index + 1}</b><span>{scene.duration} วินาที</span></button>)}</div>

      <div className={styles.sceneWorkspace}>
        <aside className={styles.sceneList}>{scenes.map((scene, index) => { const time = sceneTimes[index]; return <button type="button" key={scene.id} className={scene.id === selectedScene?.id ? styles.sceneActive : ""} onClick={() => setSelectedSceneId(scene.id)}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{scene.title}</strong><small>{formatTime(time?.start || 0)}–{formatTime(time?.end || scene.duration)} • {scene.duration} วินาที</small></span></button>; })}</aside>

        {selectedScene ? <div className={styles.sceneEditor}>
          <div className={styles.sceneEditorHead}><div><span>ฉาก {String(scenes.findIndex((item) => item.id === selectedScene.id) + 1).padStart(2, "0")}</span><h3>{selectedScene.title}</h3></div><div><button type="button" className={styles.aiArrangeButton} onClick={() => void arrangeSceneWithAi("all")} disabled={sceneAiBusy}>{sceneAiBusy ? "AI Director กำลังคิด..." : "✦ AI ช่วยคิดทั้งฉาก"}</button><button type="button" onClick={copyCameraToAll}>คัดลอกกล้องไปทุกฉาก</button><button type="button" onClick={copyLookToAll}>คัดลอกแสงไปทุกฉาก</button></div></div>
          <SingleEpisodeAiDirectorPanel
            busy={sceneAiBusy}
            summary={sceneAiSummary}
            meta={sceneAiMeta}
            mode={aiDirectorMode}
            novelty={aiDirectorNovelty}
            canUndo={Boolean(sceneAiUndo)}
            invalidMode={aiRequiredErrors.includes("mode")}
            invalidNovelty={aiRequiredErrors.includes("novelty")}
            validationMessage={aiRequiredErrors.length ? [
              aiRequiredErrors.includes("mode") ? "เลือกโหมดผู้กำกับ AI" : "",
              aiRequiredErrors.includes("novelty") ? "เลือกระดับความแตกต่าง" : "",
              aiRequiredErrors.includes("source") ? "ใส่เรื่องหลัก หรือ Action รวมของฉากอย่างน้อย 1 ช่อง" : "",
            ].filter(Boolean).join(" • ") : ""}
            onModeChange={(value) => { setAiDirectorMode(value); setAiRequiredErrors((current) => current.filter((item) => item !== "mode")); }}
            onNoveltyChange={(value) => { setAiDirectorNovelty(value); setAiRequiredErrors((current) => current.filter((item) => item !== "novelty")); }}
            onGenerate={(scope) => void arrangeSceneWithAi(scope)}
            onUndo={undoLastAiSceneChange}
          />

          <div className={styles.twoGrid}><label className={styles.field}><span>ชื่อฉาก</span><input value={selectedScene.title} onChange={(event) => patchScene({ title: event.target.value })} /></label><label className={styles.field}><span>สถานที่</span><input list="scenova-locations" value={selectedScene.location} onChange={(event) => patchScene({ location: event.target.value })} placeholder="พิมพ์เองหรือเลือก Preset" /><datalist id="scenova-locations">{LOCATION_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</datalist></label></div>
          <div className={styles.threeGrid}><ChoiceField label="เป้าหมายฉาก" value={selectedScene.objective} options={OBJECTIVE_PRESETS} onChange={(value) => patchScene({ objective: value })} compact /><ChoiceField label="จังหวะเรื่อง" value={selectedScene.beat} options={SCENE_BEATS} onChange={(value) => patchScene({ beat: value })} compact /><ChoiceField label="การเปลี่ยนฉาก" value={selectedScene.transition} options={TRANSITIONS} onChange={(value) => patchScene({ transition: value })} compact /></div>
          <div className={styles.sceneDuration}><div><span>เวลาของฉากนี้</span><strong>{selectedScene.duration} วินาที</strong></div><input type="range" min={1} max={Math.max(1, Math.min(providerMaxSeconds, selectedScene.duration + remainingDuration))} value={selectedScene.duration} onChange={(event) => changeSceneDuration(Number(event.target.value))} /><small>ระบบไม่ให้เวลารวมเกิน {totalDuration} วินาที</small></div>

          <section className={styles.directorBlock}>
            <div className={styles.blockHead}><div><span>ตัวละครในฉาก</span><h4>ตัวละครในฉาก + ตำแหน่งและการแสดงรายคน</h4></div><p>เลือกเฉพาะคนที่อยู่ในฉาก แล้วกำหนด Blocking / Action / Emotion / Eyeline แยกทีละคน</p></div>
            <div className={styles.presenceChips}>{characters.map((character) => <label key={character.id} className={selectedScene.characterIds.includes(character.id) ? styles.chipActive : ""}><input type="checkbox" checked={selectedScene.characterIds.includes(character.id)} onChange={() => toggleSceneCharacter(character.id)} />{character.name}</label>)}</div>
            {selectedScene.characterIds.length ? <div className={styles.directionList}>{selectedScene.characterIds.map((id) => { const character = characters.find((item) => item.id === id); if (!character) return null; const direction = selectedScene.characterDirections[id] || makeDirection(); return <article key={id} className={styles.directionRow}><div className={styles.directionName}><b>{character.name}</b><small>{character.role}</small></div><label className={styles.field}><span>Blocking / ตำแหน่ง</span><input value={direction.blocking} onChange={(event) => patchCharacterDirection(id, { blocking: event.target.value })} placeholder="ซ้ายเฟรม, หน้าโต๊ะ, เดินเข้าจากขวา..." /></label><label className={styles.field}><span>Action ของคนนี้</span><input value={direction.action} onChange={(event) => patchCharacterDirection(id, { action: event.target.value })} placeholder="เดิน, หยุด, หยิบของ, หันหน้า..." /></label><ChoiceField label="Emotion" value={direction.emotion} options={EMOTIONS} onChange={(value) => patchCharacterDirection(id, { emotion: value })} compact /><label className={styles.field}><span>Eyeline / มองไปที่</span><input value={direction.eyeline} onChange={(event) => patchCharacterDirection(id, { eyeline: event.target.value })} placeholder="มองตัวละคร 2 / กล้อง / ประตู" /></label></article>; })}</div> : <div className={styles.emptyState}>ยังไม่ได้เลือกตัวละครในฉากนี้</div>}
            {hasAnimals ? <div className={styles.presenceSub}><span>สัตว์ / Creature ในฉาก</span><div className={styles.presenceChips}>{animals.map((animal) => <label key={animal.id} className={selectedScene.animalIds.includes(animal.id) ? styles.chipActive : ""}><input type="checkbox" checked={selectedScene.animalIds.includes(animal.id)} onChange={() => toggleSceneAnimal(animal.id)} />{animal.name}</label>)}</div></div> : null}
          </section>

          <section className={styles.directorBlock}>
            <div className={styles.blockHead}><div><span>เหตุการณ์และบทพูด</span><h4>Action และบทพูดรายตัวละคร</h4></div><p>บทพูดแยกตามตัวละครที่เลือกอยู่ในฉาก ระบบจะรวมชื่อกับเสียงให้ Voice Router อัตโนมัติ</p></div>
            <label data-ai-required-error={aiRequiredErrors.includes("source") ? "true" : undefined} className={`${styles.field} ${aiRequiredErrors.includes("source") ? styles.requiredError : ""}`}><span>Action รวมของฉาก</span><textarea className={styles.bigTextarea} value={selectedScene.action} onChange={(event) => { patchScene({ action: event.target.value }); setAiRequiredErrors((current) => current.filter((item) => item !== "source")); }} placeholder="ฉากเริ่มอย่างไร ใครทำอะไร จุดเปลี่ยนอยู่ตรงไหน และจบด้วยอะไร" /></label>
            {selectedScene.characterIds.length ? <div className={styles.dialogueGrid}>{selectedScene.characterIds.map((id) => { const character = characters.find((item) => item.id === id); if (!character) return null; const direction = selectedScene.characterDirections[id] || makeDirection(); const value = direction.dialogue || legacyDialogueFor(selectedScene.dialogue, character.name); return <label key={id} className={styles.dialogueCard}><span><b>{character.name}</b><small>{character.voice}</small></span><textarea value={value} onChange={(event) => patchCharacterDialogue(id, event.target.value)} placeholder={`เขียนบทพูดของ ${character.name} หรือเว้นว่างถ้าไม่มีบท`} /><em>Voice Router จะใช้ชื่อและโปรไฟล์เสียงนี้โดยอัตโนมัติ</em></label>; })}</div> : <div className={styles.emptyState}>เลือกตัวละครที่อยู่ในฉากก่อน แล้วช่องบทพูดรายคนจะปรากฏที่นี่</div>}
          </section>

          <section className={styles.directorBlock}>
            <div className={styles.blockHead}><div><span>กำกับกล้อง</span><h4>กล้อง เลนส์ มุม และการเคลื่อนครบชุด</h4></div><p>เลือก “กล้องตามใคร” ก่อน แล้วกำหนดภาษากล้องของ Shot นี้อย่างละเอียด</p></div>
            <label className={styles.field}><span>Camera Subject — กล้องโฟกัส/ตามใคร</span><select value={selectedScene.cameraSubjectId} onChange={(event) => patchScene({ cameraSubjectId: event.target.value })}><option value=""> </option>{selectedScene.characterIds.map((id) => { const character = characters.find((item) => item.id === id); return character ? <option key={id} value={id}>{character.name}</option> : null; })}</select><small>ถ้าเลือกตัวละคร ระบบ Prompt จะผูก Camera Movement และ Focus กับตัวละครคนนั้นโดยตรง</small></label>
            <div className={styles.threeGrid}><ChoiceField label="ระยะภาพ" value={selectedScene.shot} options={SHOT_TYPES} onChange={(value) => patchScene({ shot: value })} /><ChoiceField label="มุมกล้อง" value={selectedScene.angle} options={CAMERA_ANGLES} onChange={(value) => patchScene({ angle: value })} /><ChoiceField label="เลนส์" value={selectedScene.lens} options={LENSES} onChange={(value) => patchScene({ lens: value })} /></div>
            <div className={styles.threeGrid}><ChoiceField label="การเคลื่อนกล้อง" value={selectedScene.movement} options={CAMERA_MOVEMENTS} onChange={(value) => patchScene({ movement: value })} /><ChoiceField label="ความสูงกล้อง" value={selectedScene.height} options={CAMERA_HEIGHTS} onChange={(value) => patchScene({ height: value })} /><ChoiceField label="ความเร็วกล้อง" value={selectedScene.cameraSpeed} options={CAMERA_SPEEDS} onChange={(value) => patchScene({ cameraSpeed: value })} /></div>
            <div className={styles.threeGrid}><ChoiceField label="จุดโฟกัส" value={selectedScene.focus} options={FOCUS_OPTIONS} onChange={(value) => patchScene({ focus: value })} /><ChoiceField label="ระยะชัดลึก" value={selectedScene.dof} options={DOF_OPTIONS} onChange={(value) => patchScene({ dof: value })} /><ChoiceField label="องค์ประกอบภาพ" value={selectedScene.composition} options={COMPOSITION_OPTIONS} onChange={(value) => patchScene({ composition: value })} /></div>
          </section>

          <section className={styles.directorBlock}>
            <div className={styles.blockHead}><div><span>ภาพและการแสดง</span><h4>แสง สี อารมณ์ และการแสดง</h4></div><p>กำหนด Mood ของภาพและระดับการแสดงให้สัมพันธ์กับ Action และ Dialogue</p></div>
            <div className={styles.twoGrid}><ChoiceField label="รูปแบบแสง" value={selectedScene.lighting} options={LIGHTING_STYLES} onChange={(value) => patchScene({ lighting: value })} /><ChoiceField label="อุณหภูมิสี" value={selectedScene.colorTemp} options={COLOR_TEMPERATURES} onChange={(value) => patchScene({ colorTemp: value })} /></div>
            <div className={styles.twoGrid}><ChoiceField label="อารมณ์หลัก" value={selectedScene.emotion} options={EMOTIONS} onChange={(value) => patchScene({ emotion: value })} /><ChoiceField label="รูปแบบการแสดง" value={selectedScene.performance} options={PERFORMANCE_OPTIONS} onChange={(value) => patchScene({ performance: value })} /></div>
          </section>

          <section className={styles.directorBlock}>
            <div className={styles.blockHead}><div><span>ออกแบบเสียง</span><h4>Ambience, SFX, Dialogue และ Music</h4></div><p>เสียงจะถูกผูกกับ Timeline ของฉากและ Voice Profile ของตัวละคร</p></div>
            <div className={styles.twoGrid}><ChoiceField label="เสียงบรรยากาศหลัก" value={selectedScene.ambience} options={AMBIENCE_PRESETS} onChange={(value) => patchScene({ ambience: value })} /><ChoiceField label="เสียงพื้นรอง" value={selectedScene.secondaryAmbience} options={AMBIENCE_PRESETS} onChange={(value) => patchScene({ secondaryAmbience: value })} /></div>
            <div className={styles.twoGrid}><ChoiceField label="เอฟเฟกต์เสียง" value={selectedScene.sfx} options={SFX_PRESETS} onChange={(value) => patchScene({ sfx: value })} /><ChoiceField label="ดนตรี" value={selectedScene.music} options={MUSIC_PRESETS} onChange={(value) => patchScene({ music: value })} /></div>
            <label className={styles.field}><span>SFX Timeline — ระบุจังหวะเสียง</span><textarea value={selectedScene.sfxTimeline} onChange={(event) => patchScene({ sfxTimeline: event.target.value })} placeholder={'00:02.0 ฝีเท้าเริ่ม\n00:05.2 ประตูปิด\n00:07.0 รถวิ่งผ่าน'} /><small>ระบุเวลาให้สัมพันธ์กับ Duration ของฉาก</small></label>
            <div className={styles.mixGrid}>{([['Ambience', 'ambienceLevel'], ['SFX', 'sfxLevel'], ['Dialogue', 'dialogueLevel'], ['Music', 'musicLevel']] as const).map(([label, key]) => <label key={key}><span>{label}<b>{selectedScene[key]}%</b></span><input type="range" min={0} max={100} value={selectedScene[key]} onChange={(event) => patchScene({ [key]: Number(event.target.value) })} /></label>)}</div>
          </section>

          <section className={styles.directorBlock}>
            <div className={styles.blockHead}><div><span>ความต่อเนื่องและข้อห้าม</span><h4>สิ่งที่ต้องต่อเนื่องและสิ่งที่ห้ามเกิด</h4></div><p>ข้อมูลนี้จะถูกแนบไปกับ Prompt Compiler เพื่อช่วยลด Character Drift และความผิดพลาดระหว่าง Shot</p></div>
            <label className={styles.field}><span>Continuity Note — สิ่งที่ต้องต่อจากฉากก่อน</span><textarea value={selectedScene.continuityNote} onChange={(event) => patchScene({ continuityNote: event.target.value })} /></label>
            <label className={styles.field}><span>Scene Negative Prompt — ข้อห้ามเฉพาะฉาก</span><textarea value={selectedScene.negativePrompt} onChange={(event) => patchScene({ negativePrompt: event.target.value })} placeholder="เช่น ห้ามเปลี่ยนเสื้อ, ห้ามเพิ่มคน, ห้ามเปลี่ยนเวลาเป็นกลางวัน" /></label>
          </section>
        </div> : null}
      </div>
    </section>

    <section id="review" className={styles.reviewPanel}>
      <div className={styles.readiness}><div><span>ตรวจความพร้อมก่อนสร้าง</span><h2>ความพร้อมของตอนนี้</h2><p>ระบบตรวจเฉพาะข้อมูลสำคัญก่อนส่งไป Analyzer และ Prompt Compiler</p></div><strong>{readiness.score}%</strong></div>
      <div className={styles.reviewGrid}>
        <article><b>{scenes.length}</b><span>ฉาก</span><small>{usedDuration}/{totalDuration} วินาที</small></article>
        <article><b>{characters.length}</b><span>ตัวละคร</span><small>{locks.length} Locks เปิดอยู่</small></article>
        <article><b>{model || "ยังไม่ได้เลือก"}</b><span>Video Model</span><small>{aspect || "ยังไม่ได้เลือกอัตราส่วนภาพ"}</small></article>
        <article><b>{readiness.missing.length ? readiness.missing.length : "✓"}</b><span>รายการที่ต้องเติม</span><small>{readiness.missing.length ? readiness.missing.join(" • ") : "ข้อมูลหลักครบแล้ว"}</small></article>
      </div>
      <div className={styles.reviewActions}>
        <label className={styles.agentBudget}><span>วงเงินสูงสุดของงาน</span><span><input type="number" min={1} max={2000} step={50} value={agentBudgetThb} onChange={(event) => setAgentBudgetThb(Math.max(1, Math.min(2000, Number(event.target.value) || 1)))} /><b>บาท</b></span></label>
        <Link href="/profile/api" className={styles.apiLink}>ตรวจ API & Models</Link>
        <button type="button" className={styles.primaryButton} onClick={() => void sendToAgent()} disabled={agentSubmitting}>{agentSubmitting ? "กำลังส่งงาน..." : "ส่ง Storyboard ให้ทีม AI →"}</button>
      </div>
    </section>

    <aside
      id="studio-kept-preview-summary"
      className={v11.rightRail}
      aria-label="ตัวอย่างภาพและสรุปการตั้งค่า"
      style={{ width: "min(520px, 100%)", margin: "16px 0 0 auto", position: "static" }}
    >
      <section className={v11.previewCard}>
        <h3>ตัวอย่างภาพจากฉากแรก</h3>
        <div className={v11.previewImage}>
          <img src="/library/styles/sci-fi-neon.png" alt="ตัวอย่างภาพจากฉากแรก" />
        </div>
        <p className={v11.previewCaption}>ตัวอย่างภาพจากคำอธิบายและการตั้งค่าฉาก ใช้เป็นภาพอ้างอิงก่อนสร้างวิดีโอจริง</p>
        <button type="button" className={v11.previewButton} onClick={() => setMessage("ภาพตัวอย่างพร้อมตรวจสอบแล้ว")}>▧ สร้างภาพตัวอย่าง</button>
      </section>

      <section className={v11.summaryCard}>
        <div className={v11.summaryHead}>
          <h3>สรุปการตั้งค่า</h3>
          <button type="button" className={v11.summaryEdit} onClick={() => document.getElementById("setup")?.scrollIntoView({ behavior: "smooth", block: "start" })}>✎ แก้ไข</button>
        </div>

        <div className={v11.summaryRows}>
          <div><span>โมเดล</span><b>{model ? selectedModelProfile.label : "ยังไม่ได้เลือก"}</b></div>
          <div><span>รูปแบบ</span><b>แบบเดี่ยว (Single)</b></div>
          <div><span>ความยาว</span><b>{totalDuration} วินาที</b></div>
          <div><span>จำนวนฉาก</span><b>{scenes.length} ฉาก</b></div>
          <div><span>จำนวนตัวละคร</span><b>{characters.length} ตัวละคร</b></div>
          <div><span>เครดิตโดยประมาณ</span><b className={v11.purple}>~ {estimatedCredits} เครดิต</b></div>
        </div>

        <div className={v11.howTo}>
          <b>ⓘ ขั้นตอนการสร้าง</b>
          <div className={v11.howStep}><span>1</span><div><b>สร้างภาพตัวอย่าง (ไม่ใช้เครดิต)</b><small>ตรวจสอบภาพ ก่อนสร้างวิดีโอจริง</small></div></div>
          <div className={v11.howStep}><span>2</span><div><b>สร้างวิดีโอ (ใช้เครดิต)</b><small>เมื่อยืนยันแล้ว จะหักเครดิตและเริ่มสร้าง</small></div></div>
        </div>

        <button type="button" className={v11.summaryPrimary} onClick={() => setMessage("ภาพตัวอย่างพร้อมตรวจสอบแล้ว")}>✦ สร้างภาพตัวอย่างก่อน</button>
        <button
          type="button"
          className={v11.summarySecondary}
          disabled={!model || !story.trim() || !aspect || !visualStyle}
          onClick={() => {
            const target = document.getElementById("direct-render") || document.getElementById("scenova-direct-render-host");
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
            if (!target) setMessage("ส่วน Direct Render ยังไม่พร้อม กรุณารอสักครู่");
          }}
        >♙ สร้างวิดีโอ (ใช้ ~ {estimatedCredits} เครดิต)</button>
        <p className={v11.refundNote}>♡ หากเกิดข้อผิดพลาด เครดิตจะคืนให้อัตโนมัติ</p>
      </section>
    </aside>

    <footer className={styles.stickyFooter}><div><strong>{episodeTitle || "Untitled Episode"}</strong><span>{scenes.length} ฉาก • {characters.length} ตัวละคร • {usedDuration}/{totalDuration}s • พร้อม {readiness.score}% • วงเงิน ฿{agentBudgetThb.toLocaleString("th-TH")}</span></div><div><button type="button" className={styles.primaryButton} onClick={() => void sendToAgent()} disabled={agentSubmitting}>{agentSubmitting ? "กำลังส่งงาน..." : "ส่งให้ทีม AI ผลิต →"}</button></div></footer>
  </main>;
}
