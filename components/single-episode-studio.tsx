"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./single-episode-studio.module.css";
import { buildStudioAgentProject } from "@/lib/agent/studio-project";
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

type Character = {
  id: string;
  name: string;
  role: string;
  appearance: string;
  voice: string;
  identityLock: boolean;
  voiceLock: boolean;
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

type DraftPayload = {
  schemaVersion?: number;
  mode?: string;
  episodeTitle?: string;
  model?: string;
  aspect?: string;
  visualStyle?: string;
  story?: string;
  globalNegative?: string;
  locks?: string[];
  characters?: Partial<Character>[];
  hasAnimals?: boolean;
  animals?: Animal[];
  totalDuration?: number;
  scenes?: Partial<StoryScene>[];
  agentBudgetThb?: number;
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
  };
};

const DRAFT_KEY = "scenova-story-draft-v1";
const MODELS = ["Seedance 2.5", "Kling", "Veo", "Runway", "Wan"];
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
    name: `ตัวละคร ${index}`,
    role: index === 1 ? "ตัวละครหลัก" : "ตัวละครรอง",
    appearance: "",
    voice: VOICE_PROFILES[0] || "Default",
    identityLock: true,
    voiceLock: true,
  };
}

function normalizeCharacter(input: Partial<Character>, index: number): Character {
  const base = makeCharacter(index);
  return {
    ...base,
    ...input,
    id: input.id || base.id,
    name: input.name || base.name,
    identityLock: input.identityLock ?? true,
    voiceLock: input.voiceLock ?? true,
  };
}

function makeAnimal(index: number): Animal {
  return { id: makeId("animal"), name: `สัตว์ ${index}`, species: "", appearance: "", behavior: "" };
}

function makeDirection(): CharacterDirection {
  return { blocking: "", action: "", emotion: "Natural", eyeline: "" };
}

function makeScene(index: number, duration: number): StoryScene {
  return {
    id: makeId("scene"),
    title: `ฉาก ${index}`,
    duration,
    location: "",
    objective: index === 1 ? "Establish World" : "Reveal Information",
    beat: index === 1 ? "Opening" : "Turn",
    transition: "Hard Cut",
    action: "",
    dialogue: "",
    characterIds: [],
    animalIds: [],
    characterDirections: {},
    cameraSubjectId: "",
    shot: "Medium",
    angle: "Eye Level",
    lens: "50mm",
    movement: "Static",
    height: "Eye",
    cameraSpeed: "Normal",
    focus: "Auto Subject",
    dof: "Natural",
    composition: "Rule of Thirds",
    lighting: "Natural Soft",
    colorTemp: "Neutral 4500K",
    emotion: "Natural",
    performance: "Natural",
    ambience: "Room Tone",
    secondaryAmbience: "Silence",
    sfx: "None",
    sfxTimeline: "",
    music: "None",
    ambienceLevel: 55,
    sfxLevel: 80,
    dialogueLevel: 100,
    musicLevel: 35,
    continuityNote: "รักษาหน้าตา เสื้อผ้า Props ทิศทางการเคลื่อน แสง และสถานะจากฉากก่อนหน้า",
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
    characterDirections: input.characterDirections || {},
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
      {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
    {selected?.help ? <small>{selected.help}</small> : null}
  </label>;
}

export default function SingleEpisodeStudio() {
  const router = useRouter();
  const [episodeTitle, setEpisodeTitle] = useState("Untitled Episode");
  const [model, setModel] = useState("Seedance 2.5");
  const [aspect, setAspect] = useState("16:9 — Widescreen");
  const [visualStyle, setVisualStyle] = useState(STYLES[0]);
  const [story, setStory] = useState("");
  const [globalNegative, setGlobalNegative] = useState("character drift, face change, costume change, extra fingers, duplicated limbs, warped anatomy, unwanted text, watermark");
  const [locks, setLocks] = useState<string[]>(["Character", "Voice", "Visual Style", "Camera Language"]);
  const [characters, setCharacters] = useState<Character[]>([makeCharacter(1), makeCharacter(2)]);
  const [hasAnimals, setHasAnimals] = useState(false);
  const [animals, setAnimals] = useState<Animal[]>([makeAnimal(1)]);
  const [totalDuration, setTotalDuration] = useState(30);
  const [scenes, setScenes] = useState<StoryScene[]>(() => distributeScenes([], 3, 30));
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [message, setMessage] = useState("พร้อมสร้างตอนเดียว");
  const [agentBudgetThb, setAgentBudgetThb] = useState(500);
  const [agentSubmitting, setAgentSubmitting] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as DraftPayload;
      if (draft.episodeTitle) setEpisodeTitle(draft.episodeTitle);
      if (draft.model && MODELS.includes(draft.model)) setModel(draft.model);
      if (draft.aspect && ASPECTS.includes(draft.aspect)) setAspect(draft.aspect);
      if (draft.visualStyle && STYLES.includes(draft.visualStyle)) setVisualStyle(draft.visualStyle);
      if (typeof draft.story === "string") setStory(draft.story);
      if (typeof draft.globalNegative === "string") setGlobalNegative(draft.globalNegative);
      if (Array.isArray(draft.locks)) setLocks(draft.locks);
      if (Array.isArray(draft.characters) && draft.characters.length) setCharacters(draft.characters.slice(0, 8).map((item, index) => normalizeCharacter(item, index + 1)));
      if (typeof draft.hasAnimals === "boolean") setHasAnimals(draft.hasAnimals);
      if (Array.isArray(draft.animals) && draft.animals.length) setAnimals(draft.animals.slice(0, 4));
      if (typeof draft.totalDuration === "number") setTotalDuration(Math.max(1, Math.min(180, Math.round(draft.totalDuration))));
      if (Array.isArray(draft.scenes) && draft.scenes.length) setScenes(draft.scenes.slice(0, 180).map((scene, index) => normalizeScene(scene, index + 1)));
      if (typeof draft.agentBudgetThb === "number") setAgentBudgetThb(Math.max(1, Math.min(2000, Math.round(draft.agentBudgetThb))));
      setMessage("เปิดร่างล่าสุดแล้ว");
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      setMessage("ร่างเดิมเสียหาย ระบบเริ่มร่างใหม่ให้แล้ว");
    }
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
        role: meta.role?.toLowerCase().includes("protagonist") ? "ตัวละครหลัก" : "ตัวละครรอง",
        appearance: detail || "นำเข้าจากคลังตัวละคร",
        voice: meta.voiceProfile && VOICE_PROFILES.includes(meta.voiceProfile) ? meta.voiceProfile : VOICE_PROFILES[0] || "Default",
        identityLock: true,
        voiceLock: true,
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

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];
  const videoCapability = getVideoUiCapability(model);
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
      { ok: story.trim().length > 12, label: "เขียนแก่นเรื่อง" },
      { ok: characters.every((character) => character.name.trim() && character.appearance.trim().length > 5), label: "ใส่ข้อมูลตัวละคร" },
      { ok: usedDuration === totalDuration, label: "จัดเวลาฉากให้ครบ" },
      { ok: scenes.every((scene) => scene.location.trim() && scene.action.trim().length > 5), label: "ใส่สถานที่และ Action ทุกฉาก" },
      { ok: scenes.every((scene) => scene.shot && scene.angle && scene.lens && scene.movement), label: "กำหนดกล้องทุกฉาก" },
    ];
    return { score: Math.round(checks.filter((item) => item.ok).length / checks.length * 100), missing: checks.filter((item) => !item.ok).map((item) => item.label) };
  }, [episodeTitle, story, characters, scenes, totalDuration, usedDuration]);

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
    const capability = getVideoUiCapability(nextModel);
    const maxSeconds = Math.max(...capability.durationSeconds);
    const requiredScenes = Math.max(1, Math.ceil(totalDuration / maxSeconds));
    setModel(nextModel);
    setScenes((current) => {
      const nextCount = Math.max(requiredScenes, Math.min(current.length, totalDuration));
      const needsRedistribution = current.length !== nextCount || current.some((scene) => scene.duration > maxSeconds);
      return needsRedistribution ? distributeScenes(current, nextCount, totalDuration) : current;
    });
  }

  function patchCharacter(id: string, patch: Partial<Character>) {
    setCharacters((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
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

  function currentDraft() {
    return {
      schemaVersion: 2,
      mode: "single-episode",
      episodeTitle,
      model,
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
      agentBudgetThb,
      readiness: readiness.score,
      updatedAt: new Date().toISOString(),
    };
  }

  function saveDraft() {
    const payload = currentDraft();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setMessage("บันทึกร่าง Single Episode แล้ว");
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
    const draft = currentDraft();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));

    try {
      const project = buildStudioAgentProject({
        episodeTitle,
        model,
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

  return <main className={styles.main}>
    <header className={styles.hero}>
      <div>
        <span className={styles.eyebrow}>สตูดิโอสร้างตอนเดียว</span>
        <h1>สร้างตอนเดียวให้จบใน Workspace เดียว</h1>
        <p>โหมดนี้สำหรับหนังสั้น คลิป หรือตอนเดียว ตั้งเรื่อง ตัวละคร ฉาก กล้อง แสง การแสดง เสียง และ Continuity แล้วส่งต่อไป Prompt & Render</p>
      </div>
      <div className={styles.heroActions}>
        <span className={styles.status}>{message}</span>
        <button type="button" className={styles.secondaryButton} onClick={saveDraft}>บันทึกร่าง</button>
        <Link href="/render" className={styles.secondaryButton} onClick={saveDraft}>ดูคิวเรนเดอร์</Link>
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
        <label className={styles.field}><span>โมเดลวิดีโอ</span><select value={model} onChange={(event) => changeModel(event.target.value)}>{MODELS.map((item) => <option key={item}>{item}</option>)}</select><small>เลือก Provider ที่จะใช้สร้างคลิปจริง</small></label>
        <label className={styles.field}><span>อัตราส่วนภาพ</span><select value={aspect} onChange={(event) => setAspect(event.target.value)}>{ASPECTS.map((item) => <option key={item}>{item}</option>)}</select><small>ใช้สัดส่วนเดียวกันทุกฉากของตอนนี้</small></label>
        <label className={styles.field}><span>สไตล์ภาพ</span><select value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)}>{STYLES.map((item) => <option key={item}>{item}</option>)}</select><small>Master Style ของตอนนี้</small></label>
        <label className={`${styles.field} ${styles.storyField}`}><span>เรื่อง / เหตุการณ์ของตอน</span><textarea value={story} onChange={(event) => setStory(event.target.value)} placeholder="เล่าว่าใครต้องการอะไร เกิดปัญหาอะไร เหตุการณ์ดำเนินอย่างไร และจบแบบไหน" /><small>เขียนเป็นภาษาธรรมชาติได้ Analyzer จะนำข้อมูลนี้ไปจัดโครง Prompt ภายหลัง</small></label>
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
              <label className={styles.field}><span>ชื่อ</span><input value={character.name} onChange={(event) => patchCharacter(character.id, { name: event.target.value })} /></label>
              <label className={styles.field}><span>บทบาท</span><select value={character.role} onChange={(event) => patchCharacter(character.id, { role: event.target.value })}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
              <label className={styles.field}><span>โปรไฟล์เสียง</span><select value={character.voice} onChange={(event) => patchCharacter(character.id, { voice: event.target.value })}>{VOICE_PROFILES.map((voice) => <option key={voice}>{voice}</option>)}</select></label>
            </div>
            <label className={styles.field}><span>รูปลักษณ์ / เสื้อผ้า / บุคลิก / จุดจำ</span><textarea value={character.appearance} onChange={(event) => patchCharacter(character.id, { appearance: event.target.value })} placeholder="ใบหน้า ทรงผม อายุ รูปร่าง เสื้อผ้า เครื่องประดับ บุคลิก และรายละเอียดที่ห้ามเปลี่ยน" /></label>
            <div className={styles.miniLocks}><label className={character.identityLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.identityLock} onChange={(event) => patchCharacter(character.id, { identityLock: event.target.checked })} />ล็อกตัวตน</label><label className={character.voiceLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.voiceLock} onChange={(event) => patchCharacter(character.id, { voiceLock: event.target.checked })} />ล็อกเสียง</label><Link href="/libraries?tab=characters" onClick={() => localStorage.setItem("scenova-character-import-target-v1", character.id)}>＋ นำเข้าตัวละครจากคลัง</Link></div>
          </div>
        </article>)}
      </div>
      <div className={styles.castUtilities}><Link href="/libraries?tab=voices">เปิดคลังเสียง</Link></div>

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
          <div className={styles.sceneEditorHead}><div><span>ฉาก {String(scenes.findIndex((item) => item.id === selectedScene.id) + 1).padStart(2, "0")}</span><h3>{selectedScene.title}</h3></div><div><button type="button" onClick={copyCameraToAll}>คัดลอกกล้องไปทุกฉาก</button><button type="button" onClick={copyLookToAll}>คัดลอกแสงไปทุกฉาก</button></div></div>

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
            <div className={styles.blockHead}><div><span>เหตุการณ์และบทพูด</span><h4>เหตุการณ์และบทพูด</h4></div><p>เขียน Action รวมของฉาก และระบุชื่อผู้พูดใน Dialogue ให้ตรงกับ Cast</p></div>
            <label className={styles.field}><span>Action รวมของฉาก</span><textarea className={styles.bigTextarea} value={selectedScene.action} onChange={(event) => patchScene({ action: event.target.value })} placeholder="ฉากเริ่มอย่างไร ใครทำอะไร จุดเปลี่ยนอยู่ตรงไหน และจบด้วยอะไร" /></label>
            <label className={styles.field}><span>Dialogue / บทพูด</span><textarea value={selectedScene.dialogue} onChange={(event) => patchScene({ dialogue: event.target.value })} placeholder={'ตัวละคร 1: ...\nตัวละคร 2: ...'} /><small>ใช้ชื่อเดียวกับ Cast เพื่อให้ Voice Router จับคู่เสียงได้ถูกต้อง</small></label>
          </section>

          <section className={styles.directorBlock}>
            <div className={styles.blockHead}><div><span>กำกับกล้อง</span><h4>กล้อง เลนส์ มุม และการเคลื่อนครบชุด</h4></div><p>เลือก “กล้องตามใคร” ก่อน แล้วกำหนดภาษากล้องของ Shot นี้อย่างละเอียด</p></div>
            <label className={styles.field}><span>Camera Subject — กล้องโฟกัส/ตามใคร</span><select value={selectedScene.cameraSubjectId} onChange={(event) => patchScene({ cameraSubjectId: event.target.value })}><option value="">ฉากโดยรวม / Environment</option>{selectedScene.characterIds.map((id) => { const character = characters.find((item) => item.id === id); return character ? <option key={id} value={id}>{character.name}</option> : null; })}</select><small>ถ้าเลือกตัวละคร ระบบ Prompt จะผูก Camera Movement และ Focus กับตัวละครคนนั้นโดยตรง</small></label>
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
        <article><b>{model}</b><span>Video Model</span><small>{aspect}</small></article>
        <article><b>{readiness.missing.length ? readiness.missing.length : "✓"}</b><span>รายการที่ต้องเติม</span><small>{readiness.missing.length ? readiness.missing.join(" • ") : "ข้อมูลหลักครบแล้ว"}</small></article>
      </div>
      <div className={styles.reviewActions}>
        <label className={styles.agentBudget}><span>วงเงินสูงสุดของงาน</span><span><input type="number" min={1} max={2000} step={50} value={agentBudgetThb} onChange={(event) => setAgentBudgetThb(Math.max(1, Math.min(2000, Number(event.target.value) || 1)))} /><b>บาท</b></span></label>
        <button type="button" className={styles.secondaryButton} onClick={saveDraft}>บันทึกร่าง</button>
        <Link href="/profile/api" className={styles.apiLink}>ตรวจ API & Models</Link>
        <Link href="/render" className={styles.secondaryButton} onClick={saveDraft}>ดูคิวเรนเดอร์</Link>
        <button type="button" className={styles.primaryButton} onClick={() => void sendToAgent()} disabled={agentSubmitting}>{agentSubmitting ? "กำลังส่งงาน..." : "ส่ง Storyboard ให้ทีม AI →"}</button>
      </div>
    </section>

    <footer className={styles.stickyFooter}><div><strong>{episodeTitle || "Untitled Episode"}</strong><span>{scenes.length} ฉาก • {characters.length} ตัวละคร • {usedDuration}/{totalDuration}s • พร้อม {readiness.score}% • วงเงิน ฿{agentBudgetThb.toLocaleString("th-TH")}</span></div><div><button type="button" className={styles.secondaryButton} onClick={saveDraft}>บันทึกร่าง</button><Link href="/render" className={styles.secondaryButton} onClick={saveDraft}>คิวเรนเดอร์</Link><button type="button" className={styles.primaryButton} onClick={() => void sendToAgent()} disabled={agentSubmitting}>{agentSubmitting ? "กำลังส่งงาน..." : "ส่งให้ทีม AI ผลิต →"}</button></div></footer>
  </main>;
}
