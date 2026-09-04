"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./single-episode-studio.module.css";
import v11 from "./single-episode-studio-v11.module.css";
import SingleEpisodeAiDirectorPanel from "@/components/single-episode-ai-director-panel";
import ModelBrandIcon from "@/components/model-brand-icon";
import StudioModelSelect, { type StudioModelSelectOption } from "@/components/studio-model-select";
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
const STYLE_PREVIEW_BY_VALUE: Record<string, string> = {
  "Cinematic Anime — อนิเมะภาพยนตร์": "/library/styles/cinematic-anime.png",
  "Photorealistic Film — สมจริงแบบภาพยนตร์": "/library/styles/photorealistic-film.png",
  "Warm Golden Hour — อบอุ่นแสงทอง": "/library/styles/warm-golden-hour.png",
  "Action Blockbuster — แอ็กชันบล็อกบัสเตอร์": "/library/styles/action-blockbuster.png",
  "Sci-Fi Neon — ไซไฟนีออน": "/library/styles/sci-fi-neon.png",
  "Fantasy Storybook — แฟนตาซีภาพเล่าเรื่อง": "/library/styles/fantasy-storybook.png",
  "Dark Thriller — ทริลเลอร์โทนมืด": "/library/styles/dark-thriller.png",
  "Gothic Horror — สยองขวัญโกธิก": "/library/styles/gothic-horror.png",
  "Cinematic Romance — โรแมนติกภาพยนตร์": "/library/styles/cinematic-romance.png",
  "Period Drama — ดราม่าย้อนยุค": "/library/styles/period-drama.png",
};
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

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("scenova-studio-data-change"));
  }, [episodeTitle, model, modelVersion, aspect, visualStyle, story, globalNegative, locks, characters, hasAnimals, animals, totalDuration, scenes]);

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
  const modelSelectOptions = useMemo<StudioModelSelectOption[]>(() => MODEL_PROFILES.map((profile) => {
    const state = modelConnectionStates[profile.value];
    const status: StudioModelSelectOption["status"] = videoConnectionLoading
      ? "checking"
      : state?.operationalReady
        ? "ready"
        : state?.adapterReady
          ? "setup"
          : "offline";
    const statusLabel = videoConnectionLoading
      ? "กำลังตรวจ"
      : state?.operationalReady
        ? "พร้อมใช้งาน"
        : state?.adapterReady
          ? "ต้องเชื่อม API"
          : "Adapter ไม่พร้อม";
    return {
      value: profile.value,
      label: profile.label,
      status,
      statusLabel,
      image: profile.image,
      mode: profile.mode,
      nativeAudio: profile.nativeAudio,
    };
  }), [modelConnectionStates, videoConnectionLoading]);
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
  const allCharacterLocked = characters.length > 0 && characters.every((item) => item.identityLock);
  const selectedSceneIndex = selectedScene ? scenes.findIndex((item) => item.id === selectedScene.id) : 0;
  const selectedSceneTime = sceneTimes[Math.max(0, selectedSceneIndex)];
  const previewImage = STYLE_PREVIEW_BY_VALUE[visualStyle] || "/library/styles/sci-fi-neon.png";

  return <main className={`${styles.main} ${v11.main}`}>
    <header className={v11.topHeader}>
      <div>
        <div className={v11.breadcrumb}>AI Studio <span>›</span> สร้างวิดีโอ <span>›</span> สร้างตอนเดียวใน Workspace เดียว</div>
        <h1>สร้างตอนเดียวใน Workspace เดียว</h1>
        <p>เปลี่ยนไอเดียของคุณให้เป็นวิดีโอคุณภาพระดับภาพยนตร์ เพียงไม่กี่ขั้นตอน</p>
      </div>
      <div className={v11.topActions}>
        <Link href="/guide" prefetch={false}>▣ คู่มือการใช้งาน</Link>
        <Link href="/libraries?tab=videos" prefetch={false}>▷ ตัวอย่างผลงาน</Link>
        <button type="button" className={v11.avatar} aria-label="SCENOVA">S</button>
      </div>
    </header>

    <div className={v11.workspaceGrid}>
      <div className={v11.leftColumn}>
        <nav className={`${styles.flowBar} ${v11.steps}`} aria-label="ขั้นตอนสร้างวิดีโอ">
          <a href="#setup"><b>1</b><span>ไอเดีย &amp; ตั้งค่า</span></a>
          <a href="#characters"><b>2</b><span>เลือกตัวละคร</span></a>
          <a href="#scenes"><b>3</b><span>สร้างฉาก</span></a>
          <a href="#advanced"><b>4</b><span>ตรวจสอบ</span></a>
          <a href="#final-step"><b>5</b><span>สร้างวิดีโอ</span></a>
        </nav>
        <section id="setup" className={v11.stepCard}>
          <div className={v11.stepHead}>
            <div className={v11.stepTitle}>
              <span className={v11.stepBubble}>1</span>
              <div>
                <h2>ไอเดีย &amp; ตั้งค่าพื้นฐาน</h2>
                <p>บอกสิ่งที่คุณต้องการสร้าง และเลือกโมเดลกับรูปแบบการสร้าง</p>
              </div>
            </div>
            <button type="button" className={v11.tipButton} onClick={() => setMessage("ใส่ใจความสำคัญของเรื่อง สถานที่ เวลา ตัวละคร และสิ่งที่เกิดขึ้น ระบบ AI จะช่วยแตกเป็นฉากให้ต่อได้")}>♢ คำแนะนำ</button>
          </div>

          <div className={v11.ideaGrid}>
            <div className={v11.ideaBox}>
              <label>
                <span className={v11.srLabel}>เรื่อง / เหตุการณ์ของตอน</span>
                <b className={v11.semanticLabel}>ไอเดีย / เรื่องย่อ <em>*</em></b>
                <textarea
                  className={v11.ideaTextarea}
                  value={story}
                  maxLength={1000}
                  onChange={(event) => {
                    setStory(event.target.value);
                    setAiRequiredErrors((current) => current.filter((item) => item !== "source"));
                  }}
                  placeholder="เช่น หญิงนักสืบในเมืองอนาคต ต่อสู้กับมอนสเตอร์ ในเวลากลางคืน"
                />
              </label>
              <div className={v11.ideaFoot}>
                <span>{story.length.toLocaleString("th-TH")}/1,000</span>
                <button type="button" className={v11.outlineButton} onClick={() => setMessage("ตัวอย่าง Prompt: ระบุใคร + ทำอะไร + ที่ไหน + เวลา + อารมณ์ + จุดจบของฉาก")}>▣ ตัวอย่าง Prompt</button>
              </div>
            </div>

            <div className={v11.settingsBox}>
              <div className={v11.settingsTop}>
                <div className={v11.field} data-studio-model-ready={selectedModelReady ? "true" : "false"}>
                  <span className={v11.srLabel}>โมเดลวิดีโอ</span>
                  <b className={v11.fieldTitle}>เลือกโมเดล AI</b>
                  <div className={v11.modelSelectWrap}>
                    <StudioModelSelect value={model} options={modelSelectOptions} onChange={changeModel} />
                    <small className={v11.modelStatus} data-ready={selectedConnectionState?.operationalReady ? "true" : "false"}>
                      {!model ? "เลือกโมเดลก่อนเริ่มสร้าง" : videoConnectionLoading ? "กำลังตรวจ Connection…" : selectedConnectionState?.operationalReady ? "🟢 คีย์เชื่อมต่อแล้ว" : selectedConnectionState?.adapterReady ? "🟠 ยังไม่ได้เชื่อมต่อ / Connection ไม่พร้อม" : "🔴 Adapter ยังไม่พร้อม"}
                    </small>
                  </div>
                </div>

                <label className={v11.field}>
                  <span className={v11.srLabel}>รูปแบบการสร้าง</span>
                  <b className={v11.fieldTitle}>รูปแบบการสร้าง</b>
                  <select value="single" disabled aria-label="รูปแบบการสร้าง">
                    <option value="single">▦ แบบเดี่ยว (Single)</option>
                  </select>
                </label>

                <label className={v11.field}>
                  <span className={v11.srLabel}>รุ่นโมเดล</span>
                  <b className={v11.fieldTitle}>เวอร์ชัน / คุณภาพ</b>
                  <select aria-label="รุ่นโมเดล" value={modelVersion} onChange={(event) => setModelVersion(event.target.value)} disabled={!model}>
                    <option value="">Auto (แนะนำ)</option>
                    {modelVersions.map((item) => <option key={item.apiModelId} value={item.apiModelId}>{item.label}</option>)}
                  </select>
                  <small className={v11.modelStatus} data-ready={selectedModelReady ? "true" : "false"}>
                    {!model ? "เลือกโมเดลก่อน" : selectedModelReady ? `ระบบจะส่ง Model ID จริง: ${modelVersion || selectedModelProfile.fixedModelId || "Auto"} · พร้อมใช้` : selectedConnectionState?.operationalReady && !selectedVersionEnabled ? "รุ่นนี้ยังไม่ถูกเปิดใน Connection" : "ตรวจ API / Provider ก่อนสร้าง"}
                  </small>
                </label>
              </div>

              <div className={v11.modelCapabilities}>
                <span>{!model ? "⚪ ยังไม่ได้เลือกโมเดล" : videoConnectionLoading ? "⚪ กำลังตรวจ Connection…" : selectedConnectionState?.operationalReady ? selectedModelProfile.mode === "generate" ? "🟢 คีย์เชื่อมต่อแล้ว" : "🟣 คีย์เชื่อมต่อแล้ว · เครื่องมือแปลงวิดีโอ" : selectedConnectionState?.adapterReady ? "🟠 ยังไม่ได้เชื่อมต่อ / Connection ไม่พร้อม" : "🔴 Adapter ยังไม่พร้อม"}</span>
                <span>{!model ? "เลือกรูปแบบอินพุตหลังเลือกโมเดล" : selectedModelProfile.image === "ready" ? "🖼 รับรูปอ้างอิง" : selectedModelProfile.image === "adapter" ? "⚠️🖼 Model รองรับรูป แต่ SCENOVA Adapter ยังไม่ส่งรูป" : "🎞 ใช้วิดีโอต้นฉบับ ไม่รับรูป"}</span>
                {model && selectedModelProfile.nativeAudio ? <span>🔊 Native Audio</span> : null}
                {model && selectedModelProfile.mode === "video-edit" ? <span>🎞 Video Edit เท่านั้น · ต้องมีวิดีโอต้นฉบับ</span> : null}
                {model && selectedModelProfile.mode === "hdr" ? <span>🎞 HDR Post-process เท่านั้น · ต้องมีวิดีโอต้นฉบับ</span> : null}
                {model && !videoConnectionLoading && selectedModelProfile.mode === "generate" && !selectedModelReady ? <Link href="/profile/api" prefetch={false}>ตั้งค่า Provider →</Link> : null}
                {model && selectedModelVersion ? <small>ระบบจะส่ง Model ID จริง: {selectedModelVersion.apiModelId} · {selectedModelVersion.note}</small> : null}
              </div>

              <div className={v11.durationPanel}>
                <div className={v11.durationCopy}>
                  <span>ความยาววิดีโอ (วินาที)</span>
                  <div className={v11.durationChoices}>
                    {[5, 10, 15, 30, 60].map((seconds) => <button
                      type="button"
                      key={seconds}
                      data-active={totalDuration === seconds ? "true" : "false"}
                      onClick={() => changeTotalDuration(seconds)}
                    >{seconds}s</button>)}
                  </div>
                  <div className={v11.durationFineTune}>
                    <label><span>กำหนดเอง</span><input type="number" min={1} max={180} value={totalDuration} onChange={(event) => changeTotalDuration(Number(event.target.value))} /><small>วินาที</small></label>
                    <label><span>จำนวนฉาก</span><Counter value={scenes.length} min={providerMinScenes} max={totalDuration} onChange={resizeScenes} label="จำนวนฉาก" /></label>
                  </div>
                </div>
                <div className={v11.creditEstimate}>
                  <small>ใช้เครดิตโดยประมาณ</small>
                  <strong>~ {estimatedCredits} เครดิต</strong>
                </div>
              </div>
            </div>
          </div>

          <div className={v11.stateMirror} aria-hidden="true">
            <label><span>โมเดลวิดีโอ</span><select aria-label="โมเดลวิดีโอ" value={model} onChange={(event) => changeModel(event.target.value)}><option value=""></option>{MODEL_PROFILES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label><span>รุ่นโมเดล</span><select aria-label="รุ่นโมเดล" value={modelVersion} onChange={(event) => setModelVersion(event.target.value)}><option value=""></option>{modelVersions.map((item) => <option key={item.apiModelId} value={item.apiModelId}>{item.label}</option>)}</select></label>
            <label><span>ชื่อตอน</span><input value={episodeTitle} onChange={(event) => setEpisodeTitle(event.target.value)} /></label>
            <label><span>เรื่อง / เหตุการณ์ของตอน</span><textarea value={story} onChange={(event) => setStory(event.target.value)} /></label>
            <label><span>ความยาวรวมของตอน</span><input type="number" value={totalDuration} onChange={(event) => changeTotalDuration(Number(event.target.value))} /></label>
            <label><span>อัตราส่วนภาพ</span><select value={aspect} onChange={(event) => setAspect(event.target.value)}><option value=""></option>{ASPECTS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>สไตล์ภาพ</span><select value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)}><option value=""></option>{STYLES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>Global Negative Prompt</span><textarea value={globalNegative} onChange={(event) => setGlobalNegative(event.target.value)} /></label>
            {GLOBAL_LOCKS.map((lock) => <label key={lock.key}><input type="checkbox" checked={locks.includes(lock.key)} onChange={() => toggleLock(lock.key)} />{lock.label}</label>)}
          </div>
        </section>

        <section id="characters" className={v11.stepCard}>
          <div className={v11.stepHead}>
            <div className={v11.stepTitle}>
              <span className={v11.stepBubble}>2</span>
              <div>
                <h2>เลือกตัวละคร</h2>
                <p>ใช้ตัวละครจากไลบรารี หรืออัปโหลดใหม่ (ล็อกตัวละครเพื่อความคงที่)</p>
              </div>
            </div>
            <div className={v11.characterToolbar}>
              <Counter value={characters.length} min={1} max={8} onChange={resizeCharacters} label="จำนวนตัวละคร" />
              <Link className={v11.outlineButton} href="/libraries?tab=characters" prefetch={false}>♧ ไปที่ไลบรารีตัวละคร</Link>
              <button type="button" className={v11.purpleButton} onClick={() => resizeCharacters(Math.min(8, characters.length + 1))}>＋ เพิ่มตัวละครใหม่</button>
            </div>
          </div>

          <div className={v11.characterRow}>
            <div className={v11.characterCards}>
              {characters.map((character, index) => <article className={v11.characterCard} data-studio-character-card="true" key={character.id}>
                <div className={v11.characterVisual}>{(character.name || (index === 0 ? "ตัวละครหลัก" : index === 1 ? "ตัวละครรอง" : `C${index + 1}`)).trim().slice(0, 1)}</div>
                <span className={v11.characterMenu} aria-hidden="true">•••</span>
                <strong>{character.name || (index === 0 ? "ตัวละครหลัก" : index === 1 ? "ตัวละครรอง" : `ตัวละคร ${index + 1}`)}</strong>
                <details className={v11.characterDetails}>
                  <summary>แก้ไขรายละเอียด</summary>
                  <div className={v11.characterDetailsGrid}>
                    <label><span className={v11.fieldTitle}>ชื่อ</span><input value={character.name} onChange={(event) => patchCharacter(character.id, { name: event.target.value })} placeholder={`ตัวละคร ${index + 1}`} /></label>
                    <label><span className={v11.fieldTitle}>บทบาท</span><select value={character.role} onChange={(event) => patchCharacter(character.id, { role: event.target.value })}><option value=""></option>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
                    <label><span className={v11.fieldTitle}>โปรไฟล์เสียง</span><select value={character.voice} onChange={(event) => patchCharacter(character.id, { voice: event.target.value })}><option value=""></option>{VOICE_PROFILES.map((voice) => <option key={voice}>{voice}</option>)}</select></label>
                    <label className={v11.characterFull}><span className={v11.fieldTitle}>รูปลักษณ์ / เสื้อผ้า / บุคลิก / จุดจำ</span><textarea value={character.appearance} onChange={(event) => patchCharacter(character.id, { appearance: event.target.value })} /></label>

                    <div className={v11.referenceBlock}>
                      <div className={v11.referenceHead}>
                        <b>รูปอ้างอิงตัวละคร</b>
                        <label>
                          {uploadingCharacterId === character.id ? "กำลังอัปโหลด..." : "＋ เลือกรูปจากเครื่อง"}
                          <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploadingCharacterId === character.id || character.references.length >= 8} onChange={(event) => {
                            const files = Array.from(event.currentTarget.files || []);
                            event.currentTarget.value = "";
                            void uploadCharacterReferences(character.id, files);
                          }} />
                        </label>
                      </div>
                      {character.references.length ? <div className={v11.referenceThumbs}>{character.references.map((reference) => <figure key={reference.id}><img src={reference.url} alt={reference.label || character.name} /><button type="button" onClick={() => void removeCharacterReference(character.id, reference)}>×</button></figure>)}</div> : null}
                    </div>

                    <label><input type="checkbox" checked={character.identityLock} onChange={(event) => patchCharacter(character.id, { identityLock: event.target.checked })} /> ล็อกตัวตน</label>
                    <label><input type="checkbox" checked={character.voiceLock} onChange={(event) => patchCharacter(character.id, { voiceLock: event.target.checked })} /> ล็อกเสียง</label>
                    <div className={v11.characterFull}>
                      <Link className={v11.inlineLink} href="/libraries?tab=characters" prefetch={false} onClick={() => localStorage.setItem("scenova-character-import-target-v1", character.id)}>＋ นำเข้าตัวละครจากคลัง</Link>
                      <Link className={v11.inlineLink} href="/libraries?tab=voices" prefetch={false}>เปิดคลังเสียง</Link>
                    </div>
                  </div>
                </details>
              </article>)}

              {characters.length < 8 ? <button type="button" className={v11.addCharacter} onClick={() => resizeCharacters(characters.length + 1)}><span><b>＋</b>เพิ่มตัวละคร</span></button> : null}
            </div>

            <div className={v11.lockPanel}>
              <span className={v11.lockIcon}>♙</span>
              <div className={v11.lockCopy}><b>ล็อกตัวละคร (Character Lock)</b><span>รักษาหน้าตา รูปร่าง และสไตล์ให้เหมือนเดิมตลอดทั้งวิดีโอ</span></div>
              <label className={v11.switch}>
                <input type="checkbox" checked={allCharacterLocked} onChange={(event) => setCharacters((current) => current.map((item) => ({ ...item, identityLock: event.target.checked })))} />
                <span />
              </label>
            </div>
          </div>

          <div className={v11.creatureToggle}>
            <div><b>มีสัตว์หรือสิ่งมีชีวิตในตอนนี้หรือไม่?</b><small>เปิดเมื่อจำเป็น ข้อมูลจะส่งต่อไป AI Director, Prompt และ Agent เหมือน Logic เดิม</small></div>
            <div>
              <button type="button" data-active={!hasAnimals ? "true" : "false"} onClick={() => {
                setHasAnimals(false);
                setScenes((current) => current.map((scene) => ({ ...scene, animalIds: [] })));
              }}>ไม่มี</button>
              <button type="button" data-active={hasAnimals ? "true" : "false"} onClick={() => setHasAnimals(true)}>มี</button>
            </div>
          </div>

          {hasAnimals ? <div className={v11.creaturePanel}>
            <div className={v11.creatureHead}><b>สัตว์ / Creature</b><Counter value={animals.length} min={1} max={4} onChange={resizeAnimals} label="จำนวนสัตว์" /></div>
            <div className={v11.creatureGrid}>
              {animals.map((animal) => <article key={animal.id}>
                <label><span>ชื่อ</span><input value={animal.name} onChange={(event) => patchAnimal(animal.id, { name: event.target.value })} /></label>
                <label><span>ชนิด</span><input value={animal.species} onChange={(event) => patchAnimal(animal.id, { species: event.target.value })} /></label>
                <label><span>พฤติกรรม</span><input value={animal.behavior} onChange={(event) => patchAnimal(animal.id, { behavior: event.target.value })} /></label>
                <label><span>รูปลักษณ์</span><input value={animal.appearance} onChange={(event) => patchAnimal(animal.id, { appearance: event.target.value })} /></label>
              </article>)}
            </div>
          </div> : null}
        </section>

        <section id="scenes" className={v11.sceneStage}>
          <div className={`${styles.sceneEditor} ${v11.sceneEditor}`}>
            <div className={v11.stepCard}>
          <div className={v11.stepHead}>
            <div className={v11.stepTitle}>
              <span className={v11.stepBubble}>3</span>
              <div>
                <h2>สร้างฉาก</h2>
                <p>กำหนดฉาก มุมกล้อง การเคลื่อนไหว บทพูด และอารมณ์ (ตามช่วงเวลา)</p>
              </div>
            </div>
            <div className={v11.sceneToolbar}>
              <button type="button" className={v11.outlineButton} onClick={copyCameraToAll}>คัดลอกกล้องทุกฉาก</button>
              <button type="button" className={v11.outlineButton} onClick={copyLookToAll}>คัดลอกแสงทุกฉาก</button>
              <Link className={v11.outlineButton} href="/libraries?tab=images" prefetch={false}>♙ จัดการสถานที่</Link>
              <Link className={v11.outlineButton} href="/libraries?tab=images" prefetch={false}>◈ จัดการพร็อพ</Link>
              <select aria-label="เทมเพลตฉาก" defaultValue="" className={v11.outlineButton}>
                <option value="">เทมเพลตฉาก</option>
                <option value="cinematic">Cinematic</option>
                <option value="dialogue">Dialogue</option>
                <option value="action">Action</option>
              </select>
            </div>
          </div>

          <div className={v11.sceneCapture}>
            <div className={`${styles.sceneList} ${v11.sceneTabs} ${scenes.length === 1 ? v11.sceneTabsSingle : ""}`}>
              {scenes.map((scene, index) => {
                const time = sceneTimes[index];
                return <button type="button" key={scene.id} data-active={scene.id === selectedScene?.id ? "true" : "false"} onClick={() => setSelectedSceneId(scene.id)}>ฉากที่ {index + 1} · {formatTime(time?.start || 0)}–{formatTime(time?.end || scene.duration)}</button>;
              })}
            </div>

            {selectedScene ? <>
              <div className={v11.sceneRow}>
                <div className={v11.sceneThumb}>◈<small>ฉาก {selectedSceneIndex + 1}</small></div>

                <label className={`${v11.sceneField} ${v11.sceneDescription}`}>
                  <span className={v11.srLabel}>Action รวมของฉาก</span>
                  <b>คำอธิบายฉาก</b>
                  <textarea value={selectedScene.action} onChange={(event) => patchScene({ action: event.target.value })} placeholder="เช่น เมืองอนาคต เวลากลางคืน มีแสงนีออน ฝนตก" />
                </label>

                <label className={`${v11.sceneField} ${v11.sceneTimeField}`}>
                  <span className={v11.srLabel}>เวลาของฉากนี้</span>
                  <b>ช่วงเวลา</b>
                  <div className={v11.sceneTime}>
                    <input value={`${(selectedSceneTime?.start || 0).toFixed(1)}s`} readOnly />
                    <span>→</span>
                    <input type="number" min={1} max={providerMaxSeconds} value={selectedScene.duration} onChange={(event) => changeSceneDuration(Number(event.target.value))} />
                  </div>
                </label>

                <label className={v11.sceneField}>
                  <span className={v11.srLabel}>ระยะภาพ</span><b>มุมกล้อง</b>
                  <select value={selectedScene.shot} onChange={(event) => patchScene({ shot: event.target.value })}><option value=""></option>{SHOT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                </label>

                <label className={v11.sceneField}>
                  <span className={v11.srLabel}>การเคลื่อนกล้อง</span><b>การเคลื่อนไหว</b>
                  <select value={selectedScene.movement} onChange={(event) => patchScene({ movement: event.target.value })}><option value=""></option>{CAMERA_MOVEMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                </label>

                <label className={v11.sceneField}>
                  <span className={v11.srLabel}>เลนส์</span><b>เลนส์</b>
                  <select value={selectedScene.lens} onChange={(event) => patchScene({ lens: event.target.value })}><option value=""></option>{LENSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                </label>

                <label className={v11.sceneField}>
                  <span className={v11.srLabel}>รูปแบบแสง</span><b>แสง</b>
                  <select value={selectedScene.lighting} onChange={(event) => patchScene({ lighting: event.target.value })}><option value=""></option>{LIGHTING_STYLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                </label>

                <label className={v11.sceneField}>
                  <span className={v11.srLabel}>อารมณ์หลัก</span><b>อารมณ์</b>
                  <select value={selectedScene.emotion} onChange={(event) => patchScene({ emotion: event.target.value })}><option value=""></option>{EMOTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                </label>

                <label className={v11.sceneField}>
                  <span className={v11.srLabel}>บทพูด / เสียง</span><b>บทพูด / เสียง</b>
                  <select value={selectedScene.dialogue.trim() ? "dialogue" : "none"} onChange={(event) => { if (event.target.value === "none") patchScene({ dialogue: "" }); }}>
                    <option value="none">ไม่มีบทพูด</option>
                    <option value="dialogue">มีบทพูด</option>
                  </select>
                </label>

                <div className={v11.sceneActions}>
                  <button type="button" onClick={() => setMessage("คัดลอกการตั้งค่าฉากนี้แล้ว")}>▣</button>
                  <button type="button" disabled={scenes.length <= providerMinScenes} onClick={() => {
                    if (scenes.length <= providerMinScenes) return;
                    const next = distributeScenes(scenes.filter((item) => item.id !== selectedScene.id), scenes.length - 1, totalDuration);
                    setScenes(next);
                    setSelectedSceneId(next[0]?.id || "");
                  }}>⌫</button>
                </div>
              </div>

              <div className={`${styles.sceneDuration} ${v11.hiddenDuration}`}>
                <span>เวลาของฉากนี้</span>
                <input type="range" min={1} max={Math.max(1, Math.min(providerMaxSeconds, selectedScene.duration + remainingDuration))} value={selectedScene.duration} onChange={(event) => changeSceneDuration(Number(event.target.value))} />
              </div>

              <button type="button" className={v11.addScene} onClick={() => resizeScenes(Math.min(totalDuration, scenes.length + 1))}>＋ เพิ่มฉาก</button>
            </> : null}
          </div>
            </div>

            {selectedScene ? <details id="advanced" className={v11.advancedDetails}>
                <summary><span className={v11.miniBubble}>4</span><b>ตั้งค่าเพิ่มเติม (ตัวเลือก)</b><small>ล็อกสไตล์, เสียง, Negative Prompt และการควบคุมขั้นสูง</small></summary>
                <div className={v11.advancedContent}>
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
                      aiRequiredErrors.includes("source") ? "ใส่เรื่องหลัก หรือคำอธิบายฉากอย่างน้อย 1 ช่อง" : "",
                    ].filter(Boolean).join(" • ") : ""}
                    onModeChange={(value) => { setAiDirectorMode(value); setAiRequiredErrors((current) => current.filter((item) => item !== "mode")); }}
                    onNoveltyChange={(value) => { setAiDirectorNovelty(value); setAiRequiredErrors((current) => current.filter((item) => item !== "novelty")); }}
                    onGenerate={(scope) => void arrangeSceneWithAi(scope)}
                    onUndo={undoLastAiSceneChange}
                  />

                  <div className={v11.advancedGrid}>
                    <label><span className={v11.fieldTitle}>ชื่อตอน</span><input value={episodeTitle} onChange={(event) => setEpisodeTitle(event.target.value)} placeholder="Untitled Episode" /></label>
                    <label><span className={v11.fieldTitle}>อัตราส่วนภาพ</span><select value={aspect} onChange={(event) => setAspect(event.target.value)}><option value=""></option>{ASPECTS.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label><span className={v11.fieldTitle}>สไตล์ภาพ</span><select value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)}><option value=""></option>{STYLES.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label><span className={v11.fieldTitle}>สถานที่</span><input list="scenova-locations-v11" value={selectedScene.location} onChange={(event) => patchScene({ location: event.target.value })} /><datalist id="scenova-locations-v11">{LOCATION_PRESETS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</datalist></label>
                    <label><span className={v11.fieldTitle}>ชื่อฉาก</span><input value={selectedScene.title} onChange={(event) => patchScene({ title: event.target.value })} /></label>
                    <ChoiceField label="เป้าหมายฉาก" value={selectedScene.objective} options={OBJECTIVE_PRESETS} onChange={(value) => patchScene({ objective: value })} compact />
                    <ChoiceField label="จังหวะเรื่อง" value={selectedScene.beat} options={SCENE_BEATS} onChange={(value) => patchScene({ beat: value })} compact />
                    <ChoiceField label="การเปลี่ยนฉาก" value={selectedScene.transition} options={TRANSITIONS} onChange={(value) => patchScene({ transition: value })} compact />

                    <ChoiceField label="มุมกล้อง" value={selectedScene.angle} options={CAMERA_ANGLES} onChange={(value) => patchScene({ angle: value })} compact />
                    <ChoiceField label="ความสูงกล้อง" value={selectedScene.height} options={CAMERA_HEIGHTS} onChange={(value) => patchScene({ height: value })} compact />
                    <ChoiceField label="ความเร็วกล้อง" value={selectedScene.cameraSpeed} options={CAMERA_SPEEDS} onChange={(value) => patchScene({ cameraSpeed: value })} compact />
                    <ChoiceField label="จุดโฟกัส" value={selectedScene.focus} options={FOCUS_OPTIONS} onChange={(value) => patchScene({ focus: value })} compact />
                    <ChoiceField label="ระยะชัดลึก" value={selectedScene.dof} options={DOF_OPTIONS} onChange={(value) => patchScene({ dof: value })} compact />
                    <ChoiceField label="องค์ประกอบภาพ" value={selectedScene.composition} options={COMPOSITION_OPTIONS} onChange={(value) => patchScene({ composition: value })} compact />
                    <ChoiceField label="อุณหภูมิสี" value={selectedScene.colorTemp} options={COLOR_TEMPERATURES} onChange={(value) => patchScene({ colorTemp: value })} compact />
                    <ChoiceField label="รูปแบบการแสดง" value={selectedScene.performance} options={PERFORMANCE_OPTIONS} onChange={(value) => patchScene({ performance: value })} compact />

                    <ChoiceField label="เสียงบรรยากาศหลัก" value={selectedScene.ambience} options={AMBIENCE_PRESETS} onChange={(value) => patchScene({ ambience: value })} compact />
                    <ChoiceField label="เสียงพื้นรอง" value={selectedScene.secondaryAmbience} options={AMBIENCE_PRESETS} onChange={(value) => patchScene({ secondaryAmbience: value })} compact />
                    <ChoiceField label="เอฟเฟกต์เสียง" value={selectedScene.sfx} options={SFX_PRESETS} onChange={(value) => patchScene({ sfx: value })} compact />
                    <ChoiceField label="ดนตรี" value={selectedScene.music} options={MUSIC_PRESETS} onChange={(value) => patchScene({ music: value })} compact />
                    <div className={`${v11.advancedFull} ${v11.mixGrid}`}>
                      {([["Ambience", "ambienceLevel"], ["SFX", "sfxLevel"], ["Dialogue", "dialogueLevel"], ["Music", "musicLevel"]] as const).map(([label, key]) => <label key={key}><span>{label}<b>{selectedScene[key]}%</b></span><input type="range" min={0} max={100} value={selectedScene[key]} onChange={(event) => patchScene({ [key]: Number(event.target.value) })} /></label>)}
                    </div>

                    <label className={v11.advancedWide}><span className={v11.fieldTitle}>Global Negative Prompt</span><textarea value={globalNegative} onChange={(event) => setGlobalNegative(event.target.value)} /></label>
                    <label className={v11.advancedWide}><span className={v11.fieldTitle}>Continuity Note</span><textarea value={selectedScene.continuityNote} onChange={(event) => patchScene({ continuityNote: event.target.value })} /></label>
                    <label className={v11.advancedWide}><span className={v11.fieldTitle}>Scene Negative Prompt</span><textarea value={selectedScene.negativePrompt} onChange={(event) => patchScene({ negativePrompt: event.target.value })} /></label>
                    <label className={v11.advancedWide}><span className={v11.fieldTitle}>SFX Timeline</span><textarea value={selectedScene.sfxTimeline} onChange={(event) => patchScene({ sfxTimeline: event.target.value })} /></label>

                    <div className={v11.lockGrid}>
                      {GLOBAL_LOCKS.map((lock) => <label key={lock.key}><input type="checkbox" checked={locks.includes(lock.key)} onChange={() => toggleLock(lock.key)} />{lock.label}</label>)}
                    </div>

                    <section className={`${v11.advancedFull} ${v11.peopleBlock}`}>
                      <div className={v11.subsectionHead}><div><b>ตัวละครในฉาก</b><small>เลือกตัวละคร แล้วกำหนด Blocking / Action / Emotion / Eyeline / Dialogue รายคน</small></div>
                        <label><span>Camera Subject</span><select value={selectedScene.cameraSubjectId} onChange={(event) => patchScene({ cameraSubjectId: event.target.value })}><option value="">Auto / ยังไม่ระบุ</option>{selectedScene.characterIds.map((id) => { const character = characters.find((item) => item.id === id); return character ? <option key={id} value={id}>{character.name || "ตัวละคร"}</option> : null; })}</select></label>
                      </div>
                      <div className={styles.presenceChips} data-studio-character-presence="true">{characters.map((character, index) => <label key={character.id} className={selectedScene.characterIds.includes(character.id) ? styles.chipActive : ""}><input type="checkbox" checked={selectedScene.characterIds.includes(character.id)} onChange={() => toggleSceneCharacter(character.id)} />{character.name || `ตัวละคร ${index + 1}`}</label>)}</div>

                      {hasAnimals ? <div className={v11.creaturePresence}><span>สัตว์ / Creature ในฉาก</span><div className={styles.presenceChips}>{animals.map((animal) => <label key={animal.id} className={selectedScene.animalIds.includes(animal.id) ? styles.chipActive : ""}><input type="checkbox" checked={selectedScene.animalIds.includes(animal.id)} onChange={() => toggleSceneAnimal(animal.id)} />{animal.name}</label>)}</div></div> : null}

                      {selectedScene.characterIds.length ? <div className={v11.directionGrid}>{selectedScene.characterIds.map((id) => {
                        const character = characters.find((item) => item.id === id);
                        if (!character) return null;
                        const direction = selectedScene.characterDirections[id] || makeDirection();
                        const dialogue = direction.dialogue || legacyDialogueFor(selectedScene.dialogue, character.name);
                        return <article key={id} className={v11.directionCard}>
                          <div className={v11.directionHead}><b>{character.name || "ตัวละคร"}</b><small>{character.role || "ยังไม่กำหนดบทบาท"} · {character.voice || "ยังไม่กำหนดเสียง"}</small></div>
                          <label><span>Blocking / ตำแหน่ง</span><input value={direction.blocking} onChange={(event) => patchCharacterDirection(id, { blocking: event.target.value })} placeholder="ซ้ายเฟรม, หน้าโต๊ะ, เดินเข้าจากขวา..." /></label>
                          <label><span>Action ของคนนี้</span><input value={direction.action} onChange={(event) => patchCharacterDirection(id, { action: event.target.value })} placeholder="เดิน, หยุด, หยิบของ, หันหน้า..." /></label>
                          <ChoiceField label="Emotion" value={direction.emotion} options={EMOTIONS} onChange={(value) => patchCharacterDirection(id, { emotion: value })} compact />
                          <label><span>Eyeline / มองไปที่</span><input value={direction.eyeline} onChange={(event) => patchCharacterDirection(id, { eyeline: event.target.value })} placeholder="ตัวละครอีกคน / กล้อง / ประตู" /></label>
                          <label className={v11.directionDialogue} data-studio-dialogue-card="true"><span><b>{character.name || "ตัวละคร"}</b><small>Dialogue</small></span><textarea value={dialogue} onChange={(event) => patchCharacterDialogue(id, event.target.value)} placeholder="เว้นว่างได้หากไม่มีบทพูด" /></label>
                        </article>;
                      })}</div> : <p className={v11.emptyHint}>ยังไม่ได้เลือกตัวละครในฉากนี้</p>}
                    </section>
                  </div>
                </div>
              </details> : null}
          </div>
        </section>

        <section id="final-step" className={v11.collapsedStep}>
          <details className={v11.reviewDetails}>
            <summary><span className={v11.miniBubble}>5</span><b>ตรวจสอบ &amp; สร้างวิดีโอ</b><small>ตรวจสอบข้อมูลทั้งหมด จากนั้นสร้างภาพตัวอย่างก่อน แล้วค่อยสร้างวิดีโอจริง</small></summary>
            <div className={v11.advancedContent}>
              <div className={v11.summaryRows}>
                <div><span>ความพร้อมของข้อมูล</span><b>{readiness.score}%</b></div>
                <div><span>เวลาที่ใช้ในฉาก</span><b>{usedDuration}/{totalDuration} วินาที</b></div>
                <div><span>สถานะ</span><b>{message}</b></div>
              </div>
              {readiness.missing.length ? <div className={v11.missingBox}><b>ข้อมูลที่ยังควรเติม</b><p>{readiness.missing.join(" • ")}</p></div> : <div className={v11.readyBox}>✓ ข้อมูลสำคัญครบแล้ว</div>}
              <div className={v11.productionActions}>
                <label><span>วงเงินสูงสุดของ Agent</span><div><input type="number" min={1} max={2000} step={50} value={agentBudgetThb} onChange={(event) => setAgentBudgetThb(Math.max(1, Math.min(2000, Number(event.target.value) || 1)))} /><b>บาท</b></div></label>
                <Link className={v11.outlineButton} href="/profile/api" prefetch={false}>ตรวจ API &amp; Models</Link>
                <button type="button" className={v11.purpleButton} onClick={() => void sendToAgent()} disabled={agentSubmitting}>{agentSubmitting ? "กำลังส่งงาน..." : "ส่ง Storyboard ให้ทีม AI →"}</button>
              </div>
            </div>
          </details>
        </section>
      </div>

      <aside className={v11.rightRail}>
        <section className={v11.previewCard}>
          <h3>ตัวอย่างภาพจากฉากแรก</h3>
          <div className={v11.previewImage}><img src={previewImage} alt={visualStyle ? `ตัวอย่างสไตล์ ${visualStyle}` : "ตัวอย่างภาพอ้างอิง"} /></div>
          <p className={v11.previewCaption}>ภาพอ้างอิง 1 รูปจาก SCENOVA Style Library เพื่อดูโทนภาพก่อนสร้างจริง ไม่ใช้เครดิตและไม่ใช่ผลลัพธ์จากโมเดลวิดีโอ</p>
          <button type="button" className={v11.previewButton} onClick={() => setMessage(visualStyle ? `ใช้ภาพตัวอย่าง ${visualStyle} เป็นแนวทางแล้ว` : "เลือกสไตล์ภาพในตั้งค่าเพิ่มเติมก่อนใช้ภาพตัวอย่าง")}>▧ ใช้ภาพตัวอย่างนี้เป็นแนวทาง</button>
        </section>

        <section id="review" className={v11.summaryCard}>
          <div className={v11.summaryHead}><h3>สรุปการตั้งค่า</h3><button type="button" className={v11.summaryEdit} onClick={() => document.getElementById("setup")?.scrollIntoView({ behavior: "smooth", block: "start" })}>✎ แก้ไข</button></div>

          <div className={v11.summaryRows}>
            <div><span>โมเดล</span><span className={v11.modelSummary}>{model ? <ModelBrandIcon label={selectedModelProfile.label} size={24} /> : null}<b>{model ? selectedModelProfile.label : "ยังไม่ได้เลือก"}</b></span></div>
            <div><span>รูปแบบ</span><b>แบบเดี่ยว (Single)</b></div>
            <div><span>ความยาว</span><b>{totalDuration} วินาที</b></div>
            <div><span>จำนวนฉาก</span><b>{scenes.length} ฉาก</b></div>
            <div><span>จำนวนตัวละคร</span><b>{characters.length} ตัวละคร</b></div>
            <div><span>เครดิตโดยประมาณ</span><b className={v11.purple}>~ {estimatedCredits} เครดิต</b></div>
          </div>

          <div className={v11.howTo}>
            <b>ⓘ ขั้นตอนการสร้าง</b>
            <div className={v11.howStep}><span>1</span><div><b>ตรวจภาพตัวอย่าง (ไม่ใช้เครดิต)</b><small>ตรวจสอบภาพ ก่อนสร้างวิดีโอจริง</small></div></div>
            <div className={v11.howStep}><span>2</span><div><b>สร้างวิดีโอ (ใช้เครดิต)</b><small>เมื่อยืนยันแล้ว จะหักเครดิตและเริ่มสร้าง</small></div></div>
          </div>

          <button type="button" className={v11.summaryPrimary} onClick={() => setMessage("ภาพตัวอย่างพร้อมตรวจสอบแล้ว")}>✦ ตรวจภาพตัวอย่างก่อน</button>
          <button type="button" className={v11.summarySecondary} disabled={!model || !story.trim() || !aspect || !visualStyle} onClick={() => {
            const target = document.getElementById("scenova-direct-render-host") || document.getElementById("review");
            target?.scrollIntoView({ behavior: "smooth", block: "start" });
            setMessage(target ? "เปิดส่วน Prompt & Direct Render แล้ว" : "ส่วน Direct Render ยังไม่พร้อม กรุณารอสักครู่");
          }}>♙ ไปที่ Prompt &amp; Direct Render</button>
          <p className={v11.refundNote}>♡ หากเกิดข้อผิดพลาด เครดิตจะคืนให้อัตโนมัติ</p>
        </section>
      </aside>
    </div>
  </main>;
}
