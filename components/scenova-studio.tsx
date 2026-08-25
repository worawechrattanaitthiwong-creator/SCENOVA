"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./scenova-studio-v2.module.css";

type Mode = "auto" | "scene" | "pro";
type Gender = "หญิง" | "ชาย" | "ไม่ระบุ";
type Choice = { value: string; label: string; help: string };
type Character = {
  id: string; name: string; gender: Gender; age: number; nationality: string; personality: string; voice: string;
  hair: string; eyes: string; mouth: string; body: string; reference?: string;
};
type Scene = {
  id: string; title: string; duration: number; story: string; cast: string[]; location: string; objective: string; beat: string;
  transition: string; continuityNote: string; shot: string; angle: string; lens: string; movement: string; height: string;
  lighting: string; focus: string; dof: string; composition: string; cameraSpeed: string; subjectPosition: string;
  blocking: string; performance: string; keyLight: string; fillLight: string; rimLight: string; colorTemp: string;
  contrast: string; exposure: string; emotion: string; dialogue: string; voiceEmotion: string; voicePace: string;
  silenceBeat: string; sound: string; locks: string[];
};

const MODES = [
  { id: "auto" as const, icon: "✦", name: "AI Director", note: "AI ช่วยวาง Production Setup, Scene, Camera, Lighting และ Dialogue ให้ทันที แต่ทุกช่องยังเลือก Preset หรือกำหนด Custom เองได้", tag: "AI ASSISTED", features: ["AI Fill ทุกส่วน", "AI Suggest รายช่อง", "Auto Scene Breakdown"] },
  { id: "scene" as const, icon: "▦", name: "Scene Planner", note: "ควบคุมโครง Scene ด้วยตัวเอง พร้อม Split, Duplicate, Reorder, Transition, Scene Beat และเรียก AI ช่วยเฉพาะจุด", tag: "SCENE CONTROL", features: ["Scene Timeline", "Split / Duplicate", "Continuity Notes"] },
  { id: "pro" as const, icon: "◆", name: "Director Pro", note: "Professional direction ระดับ Shot พร้อม Focus, DOF, Composition, Blocking, Performance, Lighting Layers และ Continuity Locks", tag: "PRODUCTION PRO", features: ["Shot Design", "Performance Direction", "Technical Locks"] },
];

const MODELS = ["Seedance 2.5", "Kling", "Veo", "Runway", "Wan"];
const STYLES = ["Cinematic Anime", "Photorealistic Film", "Warm Golden Hour", "Action Blockbuster", "Sci-Fi Neon", "Fantasy Storybook", "Dark Thriller", "Cute 3D"];
const VOICES = [["Mira", "หญิง • อบอุ่น"], ["Nami", "หญิง • สดใส"], ["Arin", "ชาย • สุขุม"], ["Keen", "ชาย • หนักแน่น"], ["Luna", "หญิง • นุ่มแฟนตาซี"]] as const;

const SHOTS: Choice[] = [
  { value: "AI เลือกให้", label: "AI Suggest", help: "ให้ AI เลือกระยะภาพตามเหตุการณ์และอารมณ์" },
  { value: "Extreme Wide", label: "Extreme Wide — ภาพกว้างมาก", help: "เน้น Environment และ Scale เหมาะกับ Establishing หรือฉากขนาดใหญ่" },
  { value: "Wide", label: "Wide — ภาพกว้าง", help: "เห็นตัวละครเต็มตัวพร้อมสภาพแวดล้อม เหมาะกับ Movement และ Action" },
  { value: "Full", label: "Full — เต็มตัว", help: "เห็นรูปร่างและภาษากายครบ เหมาะกับ Character Blocking" },
  { value: "Medium", label: "Medium — ครึ่งตัว", help: "สมดุลระหว่างสีหน้าและท่าทาง เหมาะกับ Dialogue" },
  { value: "Close-up", label: "Close-up — ภาพใกล้", help: "เน้นใบหน้าและ Emotion" },
  { value: "Extreme Close-up", label: "Extreme Close-up — ใกล้มาก", help: "เน้นรายละเอียด เช่น ดวงตา มือ หรือวัตถุสำคัญ" },
  { value: "POV", label: "POV — มุมสายตาตัวละคร", help: "ให้ผู้ชมรับรู้เหตุการณ์จากมุมมองตัวละคร" },
  { value: "OTS", label: "OTS — Over the Shoulder", help: "เหมาะกับ Dialogue และการเผชิญหน้า" },
  { value: "Insert Shot", label: "Insert Shot — ภาพแทรก", help: "ใช้เน้นรายละเอียดหรือ Prop สำคัญ" },
];
const ANGLES: Choice[] = [
  { value: "AI เลือกให้", label: "AI Suggest", help: "ให้ AI เลือก Camera Angle ตาม Scene Objective" },
  { value: "Eye Level", label: "Eye Level — ระดับสายตา", help: "ธรรมชาติและเป็นกลาง" },
  { value: "Low Angle", label: "Low Angle — มุมเงย", help: "เพิ่มพลังและความโดดเด่น" },
  { value: "Extreme Low Angle", label: "Extreme Low — ต่ำติดพื้น", help: "เหมาะกับ Action, Creature, Vehicle หรือ Mecha" },
  { value: "High Angle", label: "High Angle — มุมกด", help: "ให้ตัวละครดูเล็กหรือแสดงพื้นที่ได้มากขึ้น" },
  { value: "Top View", label: "Top View — มองจากด้านบน", help: "เหมาะกับ Blocking และ Composition เชิงกราฟิก" },
  { value: "Side View", label: "Side View — ด้านข้าง", help: "เหมาะกับ Tracking, Run และ Fight" },
  { value: "Rear View", label: "Rear View — ด้านหลัง", help: "เหมาะกับ Follow Shot และการเข้าสู่สถานที่" },
  { value: "Three-quarter", label: "Three-quarter — สามส่วนสี่", help: "ให้มิติของใบหน้าและร่างกายพร้อมกัน" },
];
const LENSES: Choice[] = [
  { value: "AI เลือกให้", label: "AI Suggest", help: "ให้ AI เลือก Lens ให้สัมพันธ์กับ Shot และพื้นที่" },
  { value: "18mm", label: "18mm — Ultra Wide", help: "กว้างมากและมี Perspective ชัด" },
  { value: "24mm", label: "24mm — Cinematic Wide", help: "เหมาะกับ Environment และ Action" },
  { value: "28mm", label: "28mm — Natural Wide", help: "กว้างแต่บิดเบี้ยวน้อยกว่า 24mm" },
  { value: "35mm", label: "35mm — Contextual", help: "ใช้ง่ายกับ Narrative และ Movement" },
  { value: "50mm", label: "50mm — Natural", help: "สัดส่วนใกล้สายตามนุษย์" },
  { value: "65mm", label: "65mm — Character Focus", help: "แยกตัวละครจากฉากหลังมากขึ้น" },
  { value: "85mm", label: "85mm — Portrait", help: "เหมาะกับ Close-up และ Emotion" },
  { value: "100mm", label: "100mm — Tele", help: "บีบมิติและเน้นรายละเอียด" },
  { value: "Macro", label: "Macro — Detail", help: "ใช้กับรายละเอียดขนาดเล็กมาก" },
];
const MOVEMENTS: Choice[] = [
  { value: "AI เลือกให้", label: "AI Suggest", help: "ให้ AI เลือก Movement ตาม Rhythm และ Action" },
  { value: "Static", label: "Static — กล้องนิ่ง", help: "นิ่ง มั่นคง เหมาะกับ Dialogue หรือ Tension" },
  { value: "Push-in", label: "Push-in — เคลื่อนเข้า", help: "เน้น Emotion หรือ Discovery" },
  { value: "Pull-out", label: "Pull-out — ถอยออก", help: "Reveal Environment หรือใช้ปิด Scene" },
  { value: "Dolly", label: "Dolly — เลื่อนกล้อง", help: "Movement นุ่มแบบภาพยนตร์" },
  { value: "Tracking", label: "Tracking — ติดตาม", help: "ตาม Character, Vehicle หรือ Action" },
  { value: "Pan", label: "Pan — หมุนซ้ายขวา", help: "เปลี่ยนจุดสนใจตามแนวนอน" },
  { value: "Tilt", label: "Tilt — ก้มเงย", help: "Reveal ตามแนวตั้ง" },
  { value: "Crane", label: "Crane — ยกกล้อง", help: "Movement แนวดิ่งขนาดใหญ่" },
  { value: "Orbit", label: "Orbit — วนรอบ", help: "เพิ่มมิติและพลังให้ Subject" },
  { value: "Whip Pan", label: "Whip Pan — ปัดเร็ว", help: "เหมาะกับ Action และ Transition" },
  { value: "Lateral Slide", label: "Lateral Slide — เลื่อนข้าง", help: "สร้าง Parallax และ Reveal" },
  { value: "Handheld", label: "Handheld — ถือกล้อง", help: "เพิ่มความสด ดิบ และเร่งด่วน" },
];
const HEIGHTS: Choice[] = [
  { value: "AI เลือกให้", label: "AI Suggest", help: "AI เลือกระดับ Camera Height ให้สัมพันธ์กับ Shot" },
  { value: "10 cm", label: "10 cm — Ground Level", help: "เหมาะกับ Creature, Feet, Wheel หรือ Extreme Low" },
  { value: "Knee", label: "Knee Level", help: "มุมต่ำสำหรับ Movement และ Action" },
  { value: "Waist", label: "Waist Level", help: "ติดตามตัวละครพร้อมความรู้สึกมีพลัง" },
  { value: "Chest", label: "Chest Level", help: "เหมาะกับ Medium Shot และ Dialogue" },
  { value: "Eye", label: "Eye Level", help: "ธรรมชาติที่สุด" },
  { value: "Above Head", label: "Above Head", help: "เห็นพื้นที่และ Blocking ชัดขึ้น" },
];
const LIGHTS: Choice[] = [
  { value: "AI เลือกให้", label: "AI Suggest", help: "AI จัด Lighting ตาม Time, Location, Mood และ Style" },
  { value: "Natural Soft", label: "Natural Soft", help: "แสงธรรมชาตินุ่ม เหมาะกับ Narrative สมจริง" },
  { value: "Golden Hour", label: "Golden Hour", help: "อบอุ่น มี Rim Light เหมาะกับ Romance และ Memory" },
  { value: "Blue Hour", label: "Blue Hour", help: "โทนเย็น ลึกลับ และสงบ" },
  { value: "Low Key", label: "Low Key", help: "เงาจัด เหมาะกับ Thriller, Horror และ Noir" },
  { value: "High Key", label: "High Key", help: "สว่างสะอาด เหมาะกับ Beauty และ Commercial" },
  { value: "Neon", label: "Neon", help: "เหมาะกับ Sci-Fi และ Cyberpunk" },
  { value: "Volumetric", label: "Volumetric", help: "ลำแสงและหมอกเพื่อเพิ่มมิติ" },
  { value: "Backlight", label: "Backlight", help: "สร้าง Rim และ Silhouette" },
  { value: "Overcast", label: "Overcast", help: "แสงกระจาย เหมาะกับ Drama และ Rain" },
];
const FOCUS: Choice[] = [
  { value: "Auto Subject", label: "Auto Subject", help: "ยึด Subject หลักเป็นจุด Focus" },
  { value: "Rack Focus", label: "Rack Focus", help: "ย้าย Focus ระหว่าง Subject เพื่อเปลี่ยนความสนใจ" },
  { value: "Deep Focus", label: "Deep Focus", help: "รักษาความชัดหลายระยะ" },
];
const DOF: Choice[] = [
  { value: "Natural", label: "Natural", help: "Depth of Field สมดุล" },
  { value: "Shallow", label: "Shallow", help: "แยก Subject ชัด เหมาะกับ Portrait" },
  { value: "Deep", label: "Deep", help: "เห็น Environment และ Blocking ชัด" },
];
const COMPOSITIONS: Choice[] = [
  { value: "Rule of Thirds", label: "Rule of Thirds", help: "องค์ประกอบสมดุลและเป็นธรรมชาติ" },
  { value: "Centered", label: "Centered", help: "ให้ความรู้สึกมั่นคง สมมาตร หรือกดดัน" },
  { value: "Leading Lines", label: "Leading Lines", help: "ใช้เส้นนำสายตาไปยัง Subject" },
  { value: "Negative Space", label: "Negative Space", help: "ใช้พื้นที่ว่างสร้างอารมณ์และ Movement Space" },
];

const TRANSITIONS = ["Hard Cut", "Match Cut", "Cross Dissolve", "Fade", "Whip Transition", "AI Seamless"];
const LOCKS = ["Character", "Costume", "Location", "Prop", "Style", "Voice", "Camera Language", "Lighting", "Canon"];
const aiPick = <T,>(items: T[], seed = 0) => items[Math.abs(Date.now() + seed) % items.length];

const newCharacter = (index: number): Character => ({ id: `c${Date.now()}${index}`, name: `Character ${index}`, gender: index % 2 ? "หญิง" : "ชาย", age: 24, nationality: "ไทย", personality: "สุขุม มีความอยากรู้อยากเห็น", voice: index % 2 ? "Mira" : "Arin", hair: "", eyes: "", mouth: "", body: "" });
const newScene = (index: number, cast: string[], duration = 6): Scene => ({
  id: `s${Date.now()}${index}`, title: `Scene ${String(index).padStart(2, "0")}`, duration, story: index === 1 ? "Opening beat และ Establish Environment" : "กำหนดเหตุการณ์หลักของ Scene นี้", cast, location: "", objective: "ขับเคลื่อนเรื่องและอารมณ์", beat: "Setup → Development → Exit", transition: "Hard Cut", continuityNote: "",
  shot: "AI เลือกให้", angle: "AI เลือกให้", lens: "AI เลือกให้", movement: "AI เลือกให้", height: "AI เลือกให้", lighting: "AI เลือกให้", focus: "Auto Subject", dof: "Natural", composition: "Rule of Thirds", cameraSpeed: "Natural", subjectPosition: "Rule of Thirds",
  blocking: "AI วาง Blocking ตาม Action", performance: "Natural cinematic performance", keyLight: "AI", fillLight: "AI", rimLight: "AI", colorTemp: "Neutral 5200K", contrast: "Medium", exposure: "0 EV", emotion: "เป็นธรรมชาติ", dialogue: "", voiceEmotion: "Natural", voicePace: "Normal", silenceBeat: "None", sound: "", locks: ["Character", "Style", "Voice"]
});

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}
function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return <div className={styles.stepHead}><b>{n}</b><div><strong>{title}</strong><span>{desc}</span></div></div>;
}
function SmartChoice({ label, value, options, onChange, onAi }: { label: string; value: string; options: Choice[]; onChange: (value: string) => void; onAi: () => void }) {
  const known = options.some((item) => item.value === value);
  const selected = options.find((item) => item.value === value);
  return <Field label={label} hint={selected?.help || "Custom value — กำหนดเองตาม Production Requirement"}><div className={styles.smartRow}><select value={known ? value : "__custom"} onChange={(event) => onChange(event.target.value === "__custom" ? "" : event.target.value)}>{options.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}<option value="__custom">Custom — กำหนดเอง</option></select><button type="button" onClick={onAi}>✦ AI</button></div>{!known ? <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Custom value" /> : null}</Field>;
}
function AiText({ label, value, onChange, onAi, multiline = false, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; onAi: () => void; multiline?: boolean; hint?: string; placeholder?: string }) {
  return <Field label={label} hint={hint}><div className={styles.aiText}>{multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /> : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}<button type="button" onClick={onAi}>✦ AI Suggest</button></div></Field>;
}

export default function ScenovaStudio() {
  const [mode, setMode] = useState<Mode>("auto");
  const [model, setModel] = useState("Seedance 2.5");
  const [duration, setDuration] = useState(30);
  const [aspect, setAspect] = useState("9:16");
  const [style, setStyle] = useState("Cinematic Anime");
  const [story, setStory] = useState("เด็กหญิงพบสิ่งมีชีวิตลึกลับระหว่างทางกลับบ้าน และค่อย ๆ กลายเป็นเพื่อนกัน");
  const [characters, setCharacters] = useState<Character[]>([newCharacter(1), newCharacter(2)]);
  const [pet, setPet] = useState(true);
  const [petText, setPetText] = useState("แมวสีขาวตัวเล็ก");
  const [scenes, setScenes] = useState<Scene[]>(() => [newScene(1, [], 6), newScene(2, [], 6), newScene(3, [], 6)]);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("Production workspace ready");
  const [prompt, setPrompt] = useState("");

  const selected = scenes.find((scene) => scene.id === selectedId) ?? scenes[0];
  const selectedIndex = scenes.findIndex((scene) => scene.id === selected?.id);
  const modeInfo = MODES.find((item) => item.id === mode) ?? MODES[0];
  const usedSeconds = useMemo(() => scenes.reduce((sum, scene) => sum + Number(scene.duration || 0), 0), [scenes]);
  const remainingSeconds = Math.max(0, duration - usedSeconds);
  const selectedMax = selected ? selected.duration + remainingSeconds : duration;

  function setCharacterCount(count: number) { setCharacters((current) => count <= current.length ? current.slice(0, count) : [...current, ...Array.from({ length: count - current.length }, (_, index) => newCharacter(current.length + index + 1))]); }
  function patchCharacter(id: string, patch: Partial<Character>) { setCharacters((current) => current.map((character) => character.id === id ? { ...character, ...patch } : character)); }
  function patchScene(id: string, patch: Partial<Scene>) { setScenes((current) => current.map((scene) => scene.id === id ? { ...scene, ...patch } : scene)); }
  function fitToTarget(input: Scene[], target: number) {
    if (!input.length) return input;
    if (input.length > target) input = input.slice(0, target);
    const total = input.reduce((sum, scene) => sum + scene.duration, 0);
    if (total <= target) return input;
    const base = Math.max(1, Math.floor(target / input.length)); let rest = target - base * input.length;
    return input.map((scene) => ({ ...scene, duration: Math.max(1, base + (rest-- > 0 ? 1 : 0)) }));
  }
  function changeTargetDuration(next: number) { setDuration(next); setScenes((current) => fitToTarget([...current], next)); setStatus(`Target duration set to ${next}s`); }
  function setSceneCount(count: number) {
    if (count > duration) return setStatus("Scene count exceeds total duration");
    setScenes((current) => {
      const next = count <= current.length ? current.slice(0, Math.max(1, count)) : [...current, ...Array.from({ length: count - current.length }, (_, index) => newScene(current.length + index + 1, characters.slice(0, 1).map((c) => c.id), 1))];
      return fitToTarget(next, duration);
    });
  }
  function addScene() {
    if (scenes.length >= 12) return setStatus("Maximum 12 scenes per workspace");
    if (remainingSeconds < 1) return setStatus("No remaining duration. Reduce another scene or increase target duration.");
    const scene = newScene(scenes.length + 1, characters.slice(0, 1).map((c) => c.id), Math.min(6, remainingSeconds));
    setScenes((current) => [...current, scene]); setSelectedId(scene.id);
  }
  function removeScene(id: string) { if (scenes.length <= 1) return; const next = scenes.filter((scene) => scene.id !== id); setScenes(next); setSelectedId(next[0]?.id || ""); }
  function setSceneDuration(value: number) { if (!selected) return; const other = usedSeconds - selected.duration; patchScene(selected.id, { duration: Math.max(1, Math.min(value, duration - other)) }); }
  function toggleCast(id: string) { if (!selected) return; patchScene(selected.id, { cast: selected.cast.includes(id) ? selected.cast.filter((item) => item !== id) : [...selected.cast, id] }); }
  function moveScene(direction: -1 | 1) { if (!selected || selectedIndex < 0) return; const to = selectedIndex + direction; if (to < 0 || to >= scenes.length) return; setScenes((current) => { const copy = [...current]; [copy[selectedIndex], copy[to]] = [copy[to], copy[selectedIndex]]; return copy; }); }
  function duplicateScene() { if (!selected || remainingSeconds < 1 || scenes.length >= 12) return setStatus("Need at least 1 second remaining to duplicate"); const clone = { ...selected, id: `s${Date.now()}copy`, title: `${selected.title} Copy`, duration: Math.min(selected.duration, remainingSeconds), cast: [...selected.cast], locks: [...selected.locks] }; const next = [...scenes]; next.splice(selectedIndex + 1, 0, clone); setScenes(next); setSelectedId(clone.id); }
  function splitScene() { if (!selected || selected.duration < 2 || scenes.length >= 12) return setStatus("Scene requires at least 2 seconds to split"); const first = Math.max(1, Math.floor(selected.duration / 2)); const second = selected.duration - first; const nextScene = { ...selected, id: `s${Date.now()}split`, title: `${selected.title} B`, duration: second, story: `${selected.story} — continuation`, cast: [...selected.cast], locks: [...selected.locks] }; const currentScene = { ...selected, title: `${selected.title} A`, duration: first }; const next = [...scenes]; next.splice(selectedIndex, 1, currentScene, nextScene); setScenes(next); setSelectedId(nextScene.id); }
  function toggleLock(lock: string) { if (!selected) return; patchScene(selected.id, { locks: selected.locks.includes(lock) ? selected.locks.filter((item) => item !== lock) : [...selected.locks, lock] }); }

  function playVoice(character: Character) {
    if (!("speechSynthesis" in window)) return setStatus("Voice preview is unavailable in this browser");
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(character.gender === "ชาย" ? "สวัสดีครับ นี่คือตัวอย่างเสียงจาก SCENOVA" : "สวัสดีค่ะ นี่คือตัวอย่างเสียงจาก SCENOVA");
    utterance.lang = "th-TH"; utterance.rate = character.voice === "Nami" ? 1.08 : .98; utterance.pitch = ["Arin", "Keen"].includes(character.voice) ? .82 : 1.05; speechSynthesis.speak(utterance); setStatus(`Voice preview: ${character.voice}`);
  }

  function aiSuggestScene(sceneId = selected?.id) {
    if (!sceneId) return;
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    patchScene(sceneId, {
      objective: aiPick(["Reveal character motivation", "Escalate tension", "Build emotional connection", "Advance plot information"], index),
      beat: aiPick(["Setup → Discovery → Reaction", "Approach → Conflict → Exit", "Question → Reveal → Decision", "Action → Pause → Emotional Turn"], index + 1),
      shot: aiPick(["Wide", "Medium", "Close-up", "OTS"], index + 2), angle: aiPick(["Eye Level", "Three-quarter", "Low Angle", "Side View"], index + 3),
      lens: aiPick(["35mm", "50mm", "65mm", "85mm"], index + 4), movement: aiPick(["Tracking", "Push-in", "Static", "Lateral Slide"], index + 5), height: aiPick(["Chest", "Eye", "Waist"], index + 6),
      lighting: aiPick(["Natural Soft", "Golden Hour", "Blue Hour", "Low Key", "Neon"], index + 7),
      emotion: aiPick(["สงสัยและระวังตัว", "อบอุ่นแต่ยังไม่แน่ใจ", "ตึงเครียดและเร่งด่วน", "สงบและใกล้ชิด"], index + 8),
    }); setStatus(`AI suggestions applied to ${scenes[index]?.title || "scene"}`);
  }
  function aiFillProduction() {
    setStyle(aiPick(STYLES));
    setScenes((current) => current.map((scene, index) => ({ ...scene,
      location: scene.location || aiPick(["Japanese suburban alley", "Modern interior", "Rainy city street", "Futuristic transit platform"], index),
      objective: aiPick(["Introduce visual context", "Advance relationship", "Escalate conflict", "Deliver emotional payoff"], index), beat: aiPick(["Setup → Turn → Exit", "Approach → Discovery → Reaction", "Conflict → Decision → Transition"], index),
      shot: aiPick(["Wide", "Medium", "Close-up"], index), angle: aiPick(["Eye Level", "Three-quarter", "Side View"], index), lens: aiPick(["35mm", "50mm", "65mm"], index), movement: aiPick(["Tracking", "Push-in", "Static"], index), height: aiPick(["Chest", "Eye", "Waist"], index), lighting: aiPick(["Natural Soft", "Golden Hour", "Blue Hour"], index),
      dialogue: scene.dialogue || (index === 1 ? `${characters[0]?.name || "Character"}: เราไปต่อกันเถอะ` : ""), sound: scene.sound || "Natural ambience with subtle cinematic texture"
    })));
    setCharacters((current) => current.map((character, index) => ({ ...character, personality: character.personality || aiPick(["สุขุม รอบคอบ", "สดใส กล้าตัดสินใจ", "ลึกลับ แต่มีความอ่อนโยน"], index), hair: character.hair || aiPick(["ผมดำธรรมชาติ", "ผมสีน้ำตาลเข้ม", "ผมสั้นมี Texture"], index), eyes: character.eyes || aiPick(["ดวงตาสีน้ำตาลเข้ม", "ดวงตาคม สีดำ", "ดวงตากลมโทนอุ่น"], index) })));
    setStatus("AI Director filled the production draft. Every field remains editable.");
  }

  function buildPrompt() {
    const cast = characters.map((c) => `${c.name}: ${c.gender}, ${c.age}, ${c.nationality}; personality ${c.personality}; voice ${c.voice}; hair ${c.hair || "reference lock"}; eyes ${c.eyes || "reference lock"}; mouth ${c.mouth || "reference lock"}; body ${c.body || "reference lock"}`).join("\n");
    const sceneText = scenes.map((s, index) => `SCENE ${index + 1} | ${s.duration}s\nObjective: ${s.objective}\nBeat: ${s.beat}\nAction: ${s.story}\nLocation: ${s.location || "AI choose"}\nCamera: ${s.shot}, ${s.angle}, ${s.lens}, ${s.movement}, height ${s.height}\nFocus/DOF/Composition: ${s.focus}; ${s.dof}; ${s.composition}\nPro Direction: speed ${s.cameraSpeed}; subject ${s.subjectPosition}; blocking ${s.blocking}; performance ${s.performance}\nLighting: ${s.lighting}; key ${s.keyLight}; fill ${s.fillLight}; rim ${s.rimLight}; temp ${s.colorTemp}; contrast ${s.contrast}; exposure ${s.exposure}\nEmotion: ${s.emotion}; Voice ${s.voiceEmotion}/${s.voicePace}\nDialogue: ${s.dialogue || "No dialogue"}\nSound: ${s.sound || "Natural ambience"}; Silence beat: ${s.silenceBeat}\nTransition: ${s.transition}\nContinuity: ${s.continuityNote || "Maintain previous state"}\nLocks: ${s.locks.join(", ")}`).join("\n\n");
    setPrompt(`SCENOVA PRODUCTION PROMPT\nWORKFLOW: ${modeInfo.name}\nMODEL: ${model}\nFORMAT: ${aspect}\nTARGET: ${duration}s\nSTYLE: ${style}\n\nSTORY\n${story}\n\nCHARACTERS\n${cast}${pet ? `\nCOMPANION/CREATURE: ${petText}` : ""}\n\n${sceneText}\n\nGLOBAL CONSISTENCY: preserve locked identity, age, face, body, costume, voice, style, world state and camera language across all scenes.`);
    setStatus("Production Prompt generated");
  }

  return <main className={styles.main}>
    <section className={styles.titleRow}>
      <div><span>SCENOVA PRODUCTION STUDIO</span><h1>AI-assisted Cinematic Production Workspace</h1><p>Production Setup → Characters → Scene Direction → Prompt & Render ใช้ Workflow เดียวกันทุกระดับ แต่เครื่องมือจะเพิ่มตาม AI Director, Scene Planner และ Director Pro</p></div>
      <div className={styles.actionRow}><span className={styles.status}>{status}</span><button className={styles.secondary} onClick={buildPrompt}>✦ Generate Prompt</button><button className={styles.primary} onClick={() => setStatus("Render plan prepared — connect Video Provider to submit")}>▶ Send to Render Queue</button></div>
    </section>

    <section className={styles.modeGrid}>{MODES.map((item) => <button key={item.id} onClick={() => setMode(item.id)} className={mode === item.id ? styles.modeActive : ""}><i>{item.icon}</i><div><strong>{item.name}</strong><p>{item.note}</p><span>{item.tag}</span><ul>{item.features.map((f) => <li key={f}>{f}</li>)}</ul></div></button>)}</section>

    <section className={styles.modeBrief} data-mode={mode}>
      <div><b>{modeInfo.name}</b><span>{mode === "auto" ? "กด AI Suggest ในแต่ละช่องหรือ AI Fill Production เพื่อให้ระบบเติม Draft ทันที แล้วแก้เองได้ทุกค่า" : mode === "scene" ? "เพิ่ม/ลบ/เรียง/Split/Duplicate Scene ได้อย่างอิสระ พร้อม Scene Beat, Objective, Transition และ Continuity Note" : "ปลดล็อก Shot-level technical controls, Performance Direction, Lighting Layers และ Continuity Locks"}</span></div>
      {mode === "auto" ? <button onClick={aiFillProduction}>✦ AI Fill Production</button> : mode === "scene" ? <button onClick={() => aiSuggestScene()}>✦ AI Assist Selected Scene</button> : <Link href="/camera">Open Camera Lab →</Link>}
    </section>

    <section id="setup" className={styles.card}>
      <Step n={1} title="Production Setup" desc="กำหนด Model, Target Duration, Scene Count, Cast, Aspect Ratio และ Visual Style" />
      <div className={styles.sixGrid}>
        <Field label="Model" hint="เลือกเฉพาะ Provider ที่ระบบรองรับ"><div className={styles.smartRow}><select value={model} onChange={(e) => setModel(e.target.value)}>{MODELS.map((item) => <option key={item}>{item}</option>)}</select><button type="button" onClick={() => { setModel(aiPick(MODELS)); setStatus("AI recommended model based on current draft"); }}>✦ AI</button></div><Link href="/models">Model Center →</Link></Field>
        <Field label="Target Duration" hint="ผลรวม Scene จะไม่เกินเวลานี้"><div className={styles.smartRow}><select value={duration} onChange={(e) => changeTargetDuration(Number(e.target.value))}>{[10,15,30,60,90,120,150,180].map((item) => <option value={item} key={item}>{item < 60 ? `${item} sec` : `${item / 60} min`}</option>)}</select><button type="button" onClick={() => changeTargetDuration(30)}>✦ AI</button></div></Field>
        <Field label="Scene Count" hint="เพิ่มหรือลบภายหลังได้ สูงสุด 12"><div className={styles.smartRow}><select value={scenes.length} onChange={(e) => setSceneCount(Number(e.target.value))}>{Array.from({ length: Math.min(12,duration) },(_,i)=>i+1).map((item)=><option key={item}>{item}</option>)}</select><button type="button" onClick={() => setSceneCount(Math.min(6, Math.max(3, Math.ceil(duration / 8))))}>✦ AI</button></div></Field>
        <Field label="Primary Cast"><div className={styles.smartRow}><select value={characters.length} onChange={(e) => setCharacterCount(Number(e.target.value))}>{Array.from({length:8},(_,i)=>i+1).map((item)=><option key={item}>{item}</option>)}</select><button type="button" onClick={() => setCharacterCount(2)}>✦ AI</button></div></Field>
        <Field label="Aspect Ratio"><div className={styles.smartRow}><select value={aspect} onChange={(e) => setAspect(e.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option><option>4:5</option></select><button type="button" onClick={() => setAspect("16:9")}>✦ AI</button></div></Field>
        <Field label="Visual Style"><div className={styles.smartRow}><select value={STYLES.includes(style) ? style : "__custom"} onChange={(e) => setStyle(e.target.value === "__custom" ? "" : e.target.value)}>{STYLES.map((item)=><option key={item}>{item}</option>)}<option value="__custom">Custom</option></select><button type="button" onClick={() => setStyle(aiPick(STYLES))}>✦ AI</button></div>{!STYLES.includes(style) ? <input value={style} onChange={(e)=>setStyle(e.target.value)} placeholder="Custom visual style" /> : null}<Link href="/libraries">Asset Library →</Link></Field>
      </div>
      <AiText label="Story Concept / Creative Brief" value={story} onChange={setStory} multiline onAi={() => setStory(aiPick(["หญิงสาวตามรอยสัญญาณปริศนาในเมืองอนาคต และค้นพบความจริงเกี่ยวกับความทรงจำของตนเอง", "เพื่อนสองคนออกเดินทางในเมืองฝนตกเพื่อคืนวัตถุสำคัญก่อนรุ่งเช้า", "นักบินทดสอบพบสิ่งมีชีวิตขนาดเล็กบนสถานีอวกาศและต้องตัดสินใจว่าจะปกป้องมันหรือส่งมอบให้หน่วยวิจัย"]))} hint="ใส่เองได้เต็มที่ หรือกด AI Suggest เพื่อสร้าง Creative Brief ตัวอย่างทันที" />
    </section>

    <section id="characters" className={styles.card}>
      <Step n={2} title="Characters & Voice" desc="เลือก Reference จาก Asset Library หรือกำหนด Character Profile เอง พร้อม AI Suggest รายช่อง" />
      <div className={styles.quickLinks}><Link href="/libraries">▦ Asset Library</Link><Link href="/libraries#characters">Character References</Link><Link href="/libraries#voices">Voice Library</Link></div>
      <div className={styles.characterGrid}>{characters.map((character,index)=><article className={styles.characterCard} key={character.id}><header><b>{index+1}</b><strong>{character.name}</strong><label>Upload Reference<input hidden type="file" accept="image/*" onChange={(e)=>patchCharacter(character.id,{reference:e.target.files?.[0]?.name||""})}/></label></header>{character.reference?<span className={styles.fileTag}>Reference: {character.reference}</span>:null}
        <div className={styles.twoGrid}>
          <AiText label="Character Name" value={character.name} onChange={(v)=>patchCharacter(character.id,{name:v})} onAi={()=>patchCharacter(character.id,{name:aiPick(["Mira","Rin","Kira","Arin","Noah"],index)})}/>
          <Field label="Gender"><div className={styles.smartRow}><select value={character.gender} onChange={(e)=>patchCharacter(character.id,{gender:e.target.value as Gender})}><option>หญิง</option><option>ชาย</option><option>ไม่ระบุ</option></select><button type="button" onClick={()=>patchCharacter(character.id,{gender:aiPick<Gender>(["หญิง","ชาย","ไม่ระบุ"],index)})}>✦ AI</button></div></Field>
          <Field label="Age"><div className={styles.smartRow}><input type="number" min={1} max={120} value={character.age} onChange={(e)=>patchCharacter(character.id,{age:Number(e.target.value)})}/><button type="button" onClick={()=>patchCharacter(character.id,{age:aiPick([19,24,28,32,41],index)})}>✦ AI</button></div></Field>
          <AiText label="Nationality / Origin" value={character.nationality} onChange={(v)=>patchCharacter(character.id,{nationality:v})} onAi={()=>patchCharacter(character.id,{nationality:aiPick(["ไทย","ญี่ปุ่น","เกาหลี","International / Undefined"],index)})}/>
        </div>
        <AiText label="Character Profile / Personality" value={character.personality} onChange={(v)=>patchCharacter(character.id,{personality:v})} onAi={()=>patchCharacter(character.id,{personality:aiPick(["สุขุม รอบคอบ และสังเกตเก่ง","สดใส กล้าตัดสินใจ แต่ซ่อนความกังวล","ลึกลับ พูดน้อย มีความอ่อนโยน"] ,index)})}/>
        <Field label="Voice Profile" hint="Preview ก่อนเลือกได้"><div className={styles.voice}><select value={character.voice} onChange={(e)=>patchCharacter(character.id,{voice:e.target.value})}>{VOICES.map(([name,desc])=><option value={name} key={name}>{name} — {desc}</option>)}</select><button type="button" onClick={()=>patchCharacter(character.id,{voice:aiPick(VOICES.map(([name])=>name),index)})}>✦ AI</button><button type="button" onClick={()=>playVoice(character)}>▶ Preview</button></div></Field>
        <details><summary>Character Appearance — กรณีไม่มี Reference</summary><div className={styles.twoGrid}><AiText label="Hair" value={character.hair} onChange={(v)=>patchCharacter(character.id,{hair:v})} onAi={()=>patchCharacter(character.id,{hair:aiPick(["ผมดำตรงระดับไหล่","ผมสั้น Texture สีดำ","ผมสีน้ำตาลเข้มรวบสูง"],index)})}/><AiText label="Eyes" value={character.eyes} onChange={(v)=>patchCharacter(character.id,{eyes:v})} onAi={()=>patchCharacter(character.id,{eyes:aiPick(["ดวงตากลมสีน้ำตาลเข้ม","ดวงตาคมสีดำ","ดวงตาโทนอำพัน"],index)})}/><AiText label="Mouth / Face Detail" value={character.mouth} onChange={(v)=>patchCharacter(character.id,{mouth:v})} onAi={()=>patchCharacter(character.id,{mouth:"ริมฝีปากธรรมชาติ สีอ่อน ใบหน้าสมดุล"})}/><AiText label="Body / Height" value={character.body} onChange={(v)=>patchCharacter(character.id,{body:v})} onAi={()=>patchCharacter(character.id,{body:aiPick(["รูปร่างสมส่วน สูงประมาณ 165 ซม.","รูปร่างสูงเพรียว สูงประมาณ 178 ซม.","รูปร่างกระชับแบบนักกีฬา"],index)})}/></div></details>
      </article>)}</div>
      <div className={styles.petRow}><Field label="Companion / Creature"><div className={styles.smartRow}><select value={pet?"yes":"no"} onChange={(e)=>setPet(e.target.value==="yes")}><option value="no">None</option><option value="yes">Included</option></select><button type="button" onClick={()=>setPet(true)}>✦ AI</button></div></Field>{pet?<AiText label="Creature Profile" value={petText} onChange={setPetText} onAi={()=>setPetText(aiPick(["แมวสีขาวตัวเล็ก มีปลอกคอโลหะ","สิ่งมีชีวิตขนฟูสีน้ำเงินเข้ม หูใหญ่และกระดิ่งรูปดาว","โดรน companion ขนาดเล็กทรงกลม มีไฟสถานะสีอำพัน"]))}/>:null}</div>
    </section>

    <section id="scenes" className={styles.card}>
      <Step n={3} title="Scene Direction & Camera" desc="ควบคุม Duration, Scene Beat, Camera, Dialogue และ Continuity ต่อ Scene โดยรวมเวลาไม่เกิน Target" />
      <div className={styles.timeBudget}><div><b>{usedSeconds} / {duration} seconds allocated</b><span>{remainingSeconds}s remaining</span></div><div className={styles.timeline}>{scenes.map((scene,index)=><button key={scene.id} onClick={()=>setSelectedId(scene.id)} className={selected?.id===scene.id?styles.timelineActive:""} style={{flexGrow:Math.max(1,scene.duration)}}><b>{index+1}</b><span>{scene.duration}s</span></button>)}</div></div>
      <div className={styles.sceneTools}><span>{scenes.length} Scenes • Total duration protected</span><div><button onClick={()=>aiSuggestScene()}>✦ AI Assist</button>{mode!=="auto"?<><button onClick={()=>moveScene(-1)}>↑ Move</button><button onClick={()=>moveScene(1)}>↓ Move</button><button onClick={duplicateScene}>Duplicate</button><button onClick={splitScene}>Split</button></>:null}<button onClick={addScene}>＋ Add Scene</button></div></div>
      <div className={styles.sceneWorkspace}><aside>{scenes.map((scene,index)=><button key={scene.id} onClick={()=>setSelectedId(scene.id)} className={selected?.id===scene.id?styles.sceneActive:""}><b>{String(index+1).padStart(2,"0")}</b><span><strong>{scene.title}</strong><small>{scene.duration}s • {scene.shot}</small></span></button>)}</aside>
      {selected?<div className={styles.sceneEditor}>
        <div className={styles.sceneTitle}><input value={selected.title} onChange={(e)=>patchScene(selected.id,{title:e.target.value})}/><button onClick={()=>removeScene(selected.id)}>Delete Scene</button></div>
        <div className={styles.durationBox}><div><b>Scene Duration</b><span>{selected.duration}s</span></div><input type="range" min={1} max={Math.max(1,selectedMax)} value={selected.duration} onChange={(e)=>setSceneDuration(Number(e.target.value))}/><small>1–{selectedMax}s • ระบบป้องกันไม่ให้ Scene รวมเกิน {duration}s</small></div>

        <div className={styles.twoGrid}><AiText label="Location" value={selected.location} onChange={(v)=>patchScene(selected.id,{location:v})} onAi={()=>patchScene(selected.id,{location:aiPick(["Japanese suburban alley at dusk","Futuristic transit station","Rainy rooftop at night","Warm apartment interior"])})}/><AiText label="Scene Objective" value={selected.objective} onChange={(v)=>patchScene(selected.id,{objective:v})} onAi={()=>patchScene(selected.id,{objective:aiPick(["Reveal motivation","Escalate conflict","Build emotional connection","Deliver story information"])})}/></div>
        {mode!=="auto"?<div className={styles.twoGrid}><AiText label="Scene Beat" value={selected.beat} onChange={(v)=>patchScene(selected.id,{beat:v})} onAi={()=>patchScene(selected.id,{beat:aiPick(["Setup → Discovery → Reaction","Approach → Conflict → Decision","Action → Pause → Emotional Turn"])})}/><Field label="Transition"><div className={styles.smartRow}><select value={selected.transition} onChange={(e)=>patchScene(selected.id,{transition:e.target.value})}>{TRANSITIONS.map((item)=><option key={item}>{item}</option>)}</select><button type="button" onClick={()=>patchScene(selected.id,{transition:aiPick(TRANSITIONS)})}>✦ AI</button></div></Field></div>:null}
        <AiText label="Scene Action / Narrative" value={selected.story} onChange={(v)=>patchScene(selected.id,{story:v})} multiline onAi={()=>patchScene(selected.id,{story:aiPick(["ตัวละครเดินเข้าสู่พื้นที่อย่างระวัง ก่อนหยุดเมื่อได้ยินเสียงจากนอกเฟรม","การสนทนาเริ่มสงบ แต่มีข้อมูลใหม่ทำให้อารมณ์ของฉากเปลี่ยนทันที","ตัวละครเคลื่อนผ่าน Foreground ขณะกล้องติดตามและ Reveal จุดหมายปลายทาง"] )})}/>
        <div className={styles.castChoice}><span>Cast in Scene</span>{characters.map((character)=><button key={character.id} onClick={()=>toggleCast(character.id)} className={selected.cast.includes(character.id)?styles.castActive:""}>{character.name}</button>)}</div>

        <div className={styles.cameraGrid}><SmartChoice label="Shot Type" value={selected.shot} options={SHOTS} onChange={(v)=>patchScene(selected.id,{shot:v})} onAi={()=>patchScene(selected.id,{shot:aiPick(SHOTS.slice(1)).value})}/><SmartChoice label="Camera Angle" value={selected.angle} options={ANGLES} onChange={(v)=>patchScene(selected.id,{angle:v})} onAi={()=>patchScene(selected.id,{angle:aiPick(ANGLES.slice(1)).value})}/><SmartChoice label="Lens" value={selected.lens} options={LENSES} onChange={(v)=>patchScene(selected.id,{lens:v})} onAi={()=>patchScene(selected.id,{lens:aiPick(LENSES.slice(1)).value})}/><SmartChoice label="Movement" value={selected.movement} options={MOVEMENTS} onChange={(v)=>patchScene(selected.id,{movement:v})} onAi={()=>patchScene(selected.id,{movement:aiPick(MOVEMENTS.slice(1)).value})}/><SmartChoice label="Camera Height" value={selected.height} options={HEIGHTS} onChange={(v)=>patchScene(selected.id,{height:v})} onAi={()=>patchScene(selected.id,{height:aiPick(HEIGHTS.slice(1)).value})}/><SmartChoice label="Lighting" value={selected.lighting} options={LIGHTS} onChange={(v)=>patchScene(selected.id,{lighting:v})} onAi={()=>patchScene(selected.id,{lighting:aiPick(LIGHTS.slice(1)).value})}/></div>

        {mode==="pro"?<div className={styles.proPanel}><div className={styles.proTitle}><span>DIRECTOR PRO / SHOT INSPECTOR</span><b>Technical Direction</b></div><div className={styles.cameraGrid}><SmartChoice label="Focus" value={selected.focus} options={FOCUS} onChange={(v)=>patchScene(selected.id,{focus:v})} onAi={()=>patchScene(selected.id,{focus:aiPick(FOCUS).value})}/><SmartChoice label="Depth of Field" value={selected.dof} options={DOF} onChange={(v)=>patchScene(selected.id,{dof:v})} onAi={()=>patchScene(selected.id,{dof:aiPick(DOF).value})}/><SmartChoice label="Composition" value={selected.composition} options={COMPOSITIONS} onChange={(v)=>patchScene(selected.id,{composition:v})} onAi={()=>patchScene(selected.id,{composition:aiPick(COMPOSITIONS).value})}/><AiText label="Camera Speed" value={selected.cameraSpeed} onChange={(v)=>patchScene(selected.id,{cameraSpeed:v})} onAi={()=>patchScene(selected.id,{cameraSpeed:aiPick(["Slow controlled","Natural","Fast precise","Variable ramp"])})}/><AiText label="Subject Position" value={selected.subjectPosition} onChange={(v)=>patchScene(selected.id,{subjectPosition:v})} onAi={()=>patchScene(selected.id,{subjectPosition:aiPick(["Left third","Centered","Right third","Dynamic edge framing"])})}/><AiText label="Character Blocking" value={selected.blocking} onChange={(v)=>patchScene(selected.id,{blocking:v})} onAi={()=>patchScene(selected.id,{blocking:aiPick(["Enter foreground → cross frame → stop on mark","Two-shot facing 3/4 with controlled eyeline","Subject remains foreground while secondary character reveals in depth"])})}/><AiText label="Performance Direction" value={selected.performance} onChange={(v)=>patchScene(selected.id,{performance:v})} onAi={()=>patchScene(selected.id,{performance:aiPick(["Restrained emotion, subtle eye movement","High urgency with controlled gestures","Soft delivery, longer pauses, minimal body movement"])})}/><AiText label="Key Light" value={selected.keyLight} onChange={(v)=>patchScene(selected.id,{keyLight:v})} onAi={()=>patchScene(selected.id,{keyLight:"Soft 45° key from camera-left"})}/><AiText label="Fill Light" value={selected.fillLight} onChange={(v)=>patchScene(selected.id,{fillLight:v})} onAi={()=>patchScene(selected.id,{fillLight:"Low-intensity neutral fill"})}/><AiText label="Rim Light" value={selected.rimLight} onChange={(v)=>patchScene(selected.id,{rimLight:v})} onAi={()=>patchScene(selected.id,{rimLight:"Warm subtle rim from rear-right"})}/><AiText label="Color Temperature" value={selected.colorTemp} onChange={(v)=>patchScene(selected.id,{colorTemp:v})} onAi={()=>patchScene(selected.id,{colorTemp:aiPick(["3200K warm","4300K mixed","5200K neutral","6500K cool"])})}/><AiText label="Contrast" value={selected.contrast} onChange={(v)=>patchScene(selected.id,{contrast:v})} onAi={()=>patchScene(selected.id,{contrast:aiPick(["Low","Medium","High cinematic"])})}/></div><div className={styles.locks}><span>Continuity Locks</span>{LOCKS.map((lock)=><button key={lock} onClick={()=>toggleLock(lock)} className={selected.locks.includes(lock)?styles.lockActive:""}>{selected.locks.includes(lock)?"LOCKED":"FREE"} · {lock}</button>)}</div></div>:<details className={styles.advanced}><summary>Advanced Camera Controls</summary><div className={styles.cameraGrid}><SmartChoice label="Focus" value={selected.focus} options={FOCUS} onChange={(v)=>patchScene(selected.id,{focus:v})} onAi={()=>patchScene(selected.id,{focus:aiPick(FOCUS).value})}/><SmartChoice label="Depth of Field" value={selected.dof} options={DOF} onChange={(v)=>patchScene(selected.id,{dof:v})} onAi={()=>patchScene(selected.id,{dof:aiPick(DOF).value})}/><SmartChoice label="Composition" value={selected.composition} options={COMPOSITIONS} onChange={(v)=>patchScene(selected.id,{composition:v})} onAi={()=>patchScene(selected.id,{composition:aiPick(COMPOSITIONS).value})}/></div></details>}

        <div id="sound" className={styles.twoGrid}><AiText label="Dialogue" value={selected.dialogue} onChange={(v)=>patchScene(selected.id,{dialogue:v})} multiline onAi={()=>patchScene(selected.id,{dialogue:`${characters.find((c)=>selected.cast.includes(c.id))?.name || characters[0]?.name || "Character"}: ${aiPick(["เดี๋ยวก่อน...คุณได้ยินเหมือนกันใช่ไหม","เรายังกลับไปไม่ได้ จนกว่าจะรู้ว่าเกิดอะไรขึ้น","ไม่เป็นไร ฉันจะอยู่ตรงนี้เอง"])}`})}/><AiText label="Sound / SFX / Ambience" value={selected.sound} onChange={(v)=>patchScene(selected.id,{sound:v})} multiline onAi={()=>patchScene(selected.id,{sound:aiPick(["Soft city ambience, distant traffic, light wind","Interior room tone, subtle cloth movement, quiet footsteps","Rain texture, distant thunder, restrained cinematic drone"])})}/></div>
        {mode==="pro"?<div className={styles.threeGrid}><AiText label="Voice Emotion" value={selected.voiceEmotion} onChange={(v)=>patchScene(selected.id,{voiceEmotion:v})} onAi={()=>patchScene(selected.id,{voiceEmotion:aiPick(["Restrained","Warm","Tense","Vulnerable"])})}/><AiText label="Voice Pace" value={selected.voicePace} onChange={(v)=>patchScene(selected.id,{voicePace:v})} onAi={()=>patchScene(selected.id,{voicePace:aiPick(["Slow","Natural","Fast controlled"])})}/><AiText label="Silence Beat" value={selected.silenceBeat} onChange={(v)=>patchScene(selected.id,{silenceBeat:v})} onAi={()=>patchScene(selected.id,{silenceBeat:aiPick(["0.5s before reply","1.0s after reveal","None"])})}/></div>:null}
        {mode!=="auto"?<AiText label="Continuity Notes" value={selected.continuityNote} onChange={(v)=>patchScene(selected.id,{continuityNote:v})} onAi={()=>patchScene(selected.id,{continuityNote:"Maintain character screen direction, costume state, prop position, lighting direction and emotional state from previous scene"})} hint="ใช้สำหรับบังคับความต่อเนื่องข้าม Scene"/>:null}
      </div>:null}</div>
    </section>

    <section id="review" className={styles.card}>
      <Step n={4} title="Prompt & Render Review" desc="ตรวจ Production Configuration ก่อน Generate Prompt หรือส่งเข้า Render Queue" />
      <div className={styles.reviewGrid}><div><b>Workflow</b><span>{modeInfo.name}</span></div><div><b>Model</b><span>{model}</span></div><div><b>Target</b><span>{duration}s</span></div><div><b>Allocated</b><span>{usedSeconds}s</span></div><div><b>Scenes</b><span>{scenes.length}</span></div><div><b>Characters</b><span>{characters.length}</span></div></div>
      <div className={styles.finalActions}><Link className={styles.libraryButton} href="/libraries">▦ Asset Library</Link><button className={styles.secondary} onClick={buildPrompt}>✦ Generate Production Prompt</button><button className={styles.primary} onClick={()=>setStatus("Render configuration ready for Video Provider")}>▶ Send to Render Queue</button></div>
    </section>
    {prompt?<section className={styles.prompt}><header><strong>Production Prompt Preview</strong><button onClick={()=>navigator.clipboard?.writeText(prompt)}>Copy</button></header><pre>{prompt}</pre></section>:null}
  </main>;
}
