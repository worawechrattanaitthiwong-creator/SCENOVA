"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./scenova-studio-v3.module.css";
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

type Mode = "ai" | "scene" | "pro";
type Character = { id: string; name: string; role: string; appearance: string; voice: string };
type Scene = {
  id: string;
  title: string;
  duration: number;
  location: string;
  objective: string;
  beat: string;
  action: string;
  transition: string;
  continuity: string;
  shot: string;
  angle: string;
  lens: string;
  movement: string;
  height: string;
  lighting: string;
  emotion: string;
  dialogue: string;
  sound: string;
  secondarySound: string;
  sfx: string;
  sfxTimeline: string;
  music: string;
  ambienceLevel: number;
  sfxLevel: number;
  dialogueLevel: number;
  musicLevel: number;
  focus: string;
  dof: string;
  composition: string;
  cameraSpeed: string;
  blocking: string;
  performance: string;
  colorTemp: string;
  keyLight: string;
  fillLight: string;
  rimLight: string;
  locks: string[];
};

const MODES = [
  {
    id: "ai" as const,
    icon: "✦",
    name: "AI Director",
    nameTh: "โหมด AI ช่วยกำกับ",
    level: "AI ASSISTED — AI ช่วยคิด",
    desc: "เหมาะสำหรับเริ่มงานเร็ว: คุณกำหนดเรื่อง ตัวละคร เวลา และสไตล์ จากนั้น AI ช่วยเสนอค่ากล้อง แสง อารมณ์ เสียง และโครง Scene เป็นชุด โดยทุกค่าที่ AI เสนอสามารถแก้เองได้ทั้งหมด",
    features: ["AI Fill — เติมร่างทั้ง Production", "AI Suggest — แนะนำทีละช่วง", "Preset + Custom — เลือกหรือกำหนดเอง"],
    bestFor: "ผู้ใช้ที่อยากได้ Draft เร็ว หรือยังไม่ต้องการกำหนดรายละเอียดทางเทคนิคทุกค่าเอง",
    userControl: "แกนเรื่อง ตัวละคร โมเดล ระยะเวลา สไตล์ เสียงบรรยากาศ SFX และแก้ค่าที่ AI เสนอได้ทุกช่อง",
    aiRole: "ช่วยเสนอแนวทางและเติม Draft เท่านั้น ไม่ล็อกการตัดสินใจแทนผู้ใช้",
  },
  {
    id: "scene" as const,
    icon: "▦",
    name: "Scene Planner",
    nameTh: "โหมดวางแผนฉาก",
    level: "SCENE CONTROL — ควบคุมฉาก",
    desc: "เหมาะสำหรับคนที่ต้องการวางจังหวะเรื่องด้วยตัวเอง ควบคุมลำดับและเวลาของแต่ละ Scene พร้อมกำหนดเป้าหมายฉาก จังหวะเรื่อง การเชื่อมฉาก บันทึกความต่อเนื่อง และ Sound Design ตามเวลา",
    features: ["Scene Timeline — ไทม์ไลน์ฉาก", "Duplicate / Split / Move — จัดโครงฉาก", "Sound Design — วางเสียงต่อฉาก", "Continuity — รักษาความต่อเนื่อง"],
    bestFor: "งานที่ต้องควบคุมการเล่าเรื่องเป็น Scene และต้องการจัดลำดับ เวลา ภาพ และเสียงอย่างแม่นยำ",
    userControl: "เพิ่ม ลบ ทำซ้ำ แบ่ง และย้าย Scene รวมถึง Objective, Beat, Transition, Ambience, SFX Timeline และ Continuity Note",
    aiRole: "ใช้ AI Suggest เป็นตัวช่วยเฉพาะช่วงที่ต้องการ แต่โครงสร้าง Scene และจังหวะเสียงอยู่ภายใต้การควบคุมของผู้ใช้",
  },
  {
    id: "pro" as const,
    icon: "◆",
    name: "Director Pro",
    nameTh: "โหมดกำกับระดับมืออาชีพ",
    level: "PRODUCTION PRO — ควบคุมเชิงเทคนิค",
    desc: "เหมาะสำหรับงานที่ต้องกำหนดภาษาภาพและเสียงอย่างละเอียด เช่น Focus (จุดโฟกัส), Depth of Field/DOF (ชัดตื้น-ชัดลึก), Composition (องค์ประกอบภาพ), Camera Speed (ความเร็วกล้อง), Blocking (ตำแหน่งตัวละคร), Performance (ระดับการแสดง), Color Temperature (โทนสีแสง), Sound Mix (ระดับเสียงแต่ละชั้น) และ Continuity Locks (ตัวล็อกความต่อเนื่อง)",
    features: ["Technical Camera — กล้องเชิงเทคนิค", "Performance Direction — กำกับการแสดง", "Sound Mix — คุมระดับเสียง", "Production Locks — ล็อกความต่อเนื่อง"],
    bestFor: "ผู้กำกับ/ผู้สร้างที่ต้องการควบคุมรายละเอียดภาพ การแสดง เสียง และความต่อเนื่องระดับ Shot/Scene",
    userControl: "จุดโฟกัส ชัดตื้น-ชัดลึก องค์ประกอบ ความเร็วกล้อง การแสดง Blocking โทนสี Sound Mix และตัวล็อกแต่ละประเภท",
    aiRole: "AI ช่วยเติมค่าได้ แต่ค่าระดับ Pro, Sound Timing และ Lock เป็นคำสั่งหลักที่ใช้ยึดการสร้าง Prompt/Render",
  },
];

const PRO_LOCKS = [
  { key: "Character", label: "Character Lock — ล็อกตัวละคร", help: "รักษาใบหน้า รูปร่าง อายุ และเอกลักษณ์ของตัวละครให้เหมือนเดิมใน Scene ต่อไป" },
  { key: "Style", label: "Style Lock — ล็อกสไตล์ภาพ", help: "รักษาโทนภาพ สี รายละเอียด และลักษณะงานภาพให้เป็นแนวเดียวกัน" },
  { key: "Voice", label: "Voice Lock — ล็อกเสียงตัวละคร", help: "รักษาเสียง น้ำเสียง และบุคลิกการพูดของตัวละครให้คงที่" },
  { key: "Soundscape", label: "Soundscape Lock — ล็อกบรรยากาศเสียง", help: "รักษา Ambience หลักและลักษณะพื้นที่เสียงให้ต่อเนื่องเมื่อยังอยู่ในสถานที่/ช่วงเวลาเดียวกัน" },
  { key: "Costume", label: "Costume Lock — ล็อกเครื่องแต่งกาย", help: "รักษาชุด สี เสื้อผ้า และเครื่องประดับให้ต่อเนื่องจาก Scene ก่อนหน้า" },
  { key: "Location", label: "Location Lock — ล็อกสถานที่", help: "รักษารูปลักษณ์ ผัง ทิศทาง และรายละเอียดสำคัญของสถานที่เดิม" },
  { key: "Prop", label: "Prop Lock — ล็อกอุปกรณ์ประกอบฉาก", help: "รักษารูปร่าง สี ตำแหน่ง และผู้ถือ/เจ้าของวัตถุสำคัญให้ต่อเนื่อง" },
  { key: "Camera Language", label: "Camera Language Lock — ล็อกภาษากล้อง", help: "รักษาแนวระยะภาพ มุม เลนส์ ทิศทาง และการเคลื่อนกล้องให้มีรูปแบบเดียวกัน" },
  { key: "Lighting", label: "Lighting Lock — ล็อกแสง", help: "รักษาทิศทาง คุณภาพ ความเข้ม และโทนสีของแสงให้ต่อเนื่อง" },
] as const;

const MODELS = ["Seedance 2.5", "Kling", "Veo", "Runway", "Wan"];
const STYLES = [
  "Cinematic Anime — อนิเมะภาพยนตร์",
  "Photorealistic Film — สมจริงแบบภาพยนตร์",
  "Warm Golden Hour — อบอุ่นแสงทอง",
  "Action Blockbuster — แอ็กชันบล็อกบัสเตอร์",
  "Sci-Fi Neon — ไซไฟนีออน",
  "Fantasy Storybook — แฟนตาซีภาพเล่าเรื่อง",
  "Dark Thriller — ทริลเลอร์โทนมืด",
  "Cute 3D — สามมิติน่ารัก",
];
const VOICES = VOICE_PROFILES;

function createScene(index: number, duration = 6): Scene {
  return {
    id: `scene_${Date.now()}_${index}`,
    title: `Scene ${String(index).padStart(2, "0")}`,
    duration,
    location: index === 1 ? "Japanese Suburban Alley" : "",
    objective: index === 1 ? "Establish World" : "Reveal Information",
    beat: index === 1 ? "Opening" : "Turn",
    action: index === 1 ? "เปิดบรรยากาศและพาผู้ชมเข้าสู่เหตุการณ์หลัก" : "กำหนด Action หรือ Narrative ของ Scene นี้",
    transition: "Hard Cut",
    continuity: "รักษาตำแหน่งตัวละคร เครื่องแต่งกาย แสง เสียงบรรยากาศ และทิศทางการเคลื่อนจาก Scene ก่อนหน้า",
    shot: "AI",
    angle: "AI",
    lens: "AI",
    movement: "AI",
    height: "AI",
    lighting: "AI",
    emotion: "Natural",
    dialogue: "",
    sound: index === 1 ? "City Day" : "Room Tone",
    secondarySound: "Silence",
    sfx: "None",
    sfxTimeline: "",
    music: "None",
    ambienceLevel: 55,
    sfxLevel: 80,
    dialogueLevel: 100,
    musicLevel: 35,
    focus: "Auto Subject",
    dof: "Natural",
    composition: "Rule of Thirds",
    cameraSpeed: "Normal",
    blocking: "AI วางตำแหน่งตัวละครให้สัมพันธ์กับ Action และ Camera",
    performance: "Natural",
    colorTemp: "Neutral 4500K",
    keyLight: "AI",
    fillLight: "AI",
    rimLight: "AI",
    locks: ["Character", "Style", "Voice"],
  };
}

function ChoiceField({ label, help, value, options, onChange }: { label: string; help: string; value: string; options: ProductionChoice[]; onChange: (value: string) => void }) {
  const selected = options.find((item) => item.value === value);
  return <div className={styles.field}>
    <div className={styles.fieldLabel}><b>{label}</b></div>
    <select value={selected ? value : "__custom"} onChange={(event) => event.target.value !== "__custom" && onChange(event.target.value)}>
      {options.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
      <option value="__custom">Custom — กำหนดเอง</option>
    </select>
    <input value={selected ? "" : value} onChange={(event) => onChange(event.target.value)} placeholder="หรือพิมพ์ค่าที่ต้องการเอง (Custom)" />
    <small>{selected?.help || help}</small>
  </div>;
}

function LevelField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className={styles.field}>
    <div className={styles.fieldLabel}><b>{label}</b><span>{value}%</span></div>
    <input type="range" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    <small>ระดับสำหรับการวาง Sound Mix ใน Production Plan; Provider จริงอาจรองรับการ Mix แตกต่างกัน</small>
  </div>;
}

export default function ScenovaStudioV3() {
  const [mode, setMode] = useState<Mode>("ai");
  const [model, setModel] = useState("Seedance 2.5");
  const [duration, setDuration] = useState(30);
  const [style, setStyle] = useState(STYLES[0]);
  const [aspect, setAspect] = useState("9:16 — Vertical / TikTok / Reels");
  const [story, setStory] = useState("เด็กหญิงพบสิ่งมีชีวิตลึกลับระหว่างทางกลับบ้าน และความสัมพันธ์ของทั้งคู่ค่อย ๆ เปลี่ยนจากความสงสัยเป็นมิตรภาพ");
  const [characters, setCharacters] = useState<Character[]>([
    { id: "c1", name: "Character 1", role: "Protagonist — ตัวละครหลัก", appearance: "หญิงวัยรุ่น บุคลิกอบอุ่น สังเกตเก่ง", voice: VOICES[0] },
    { id: "c2", name: "Character 2", role: "Supporting — ตัวละครสนับสนุน", appearance: "กำหนดรูปลักษณ์หรือเลือกจาก Asset Library", voice: VOICES[4] },
  ]);
  const [scenes, setScenes] = useState<Scene[]>([createScene(1, 6), createScene(2, 6), createScene(3, 6)]);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("Production Workspace พร้อมใช้งาน");

  const selected = scenes.find((scene) => scene.id === selectedId) ?? scenes[0];
  const used = useMemo(() => scenes.reduce((sum, scene) => sum + scene.duration, 0), [scenes]);
  const remaining = Math.max(0, duration - used);
  const modeInfo = MODES.find((item) => item.id === mode)!;

  function patchScene(patch: Partial<Scene>) {
    setScenes((current) => current.map((scene) => scene.id === selected.id ? { ...scene, ...patch } : scene));
  }
  function patchCharacter(id: string, patch: Partial<Character>) {
    setCharacters((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }
  function choose<T extends { value: string }>(options: T[], index = 1) {
    return options[index % Math.max(1, options.length)].value;
  }

  function suggestSetup() {
    setStory("ตัวละครหลักพบเหตุการณ์ที่เปลี่ยนชีวิตอย่างไม่คาดคิด ความสัมพันธ์และเป้าหมายของเขาค่อย ๆ ชัดขึ้นผ่านการค้นพบในแต่ละ Scene");
    setMessage("AI Suggest เติมแนวทาง Production Setup ให้แล้ว ทุกค่ายังแก้เองได้");
  }

  function suggestCharacters() {
    setCharacters((current) => current.map((character, index) => ({
      ...character,
      appearance: `${character.name}: ใบหน้าจดจำง่าย รูปร่างและการแต่งตัวสอดคล้องกับบทบาท ${character.role} บุคลิกชัดเจน และรักษารูปลักษณ์ต่อเนื่องทุก Scene${index === 0 ? " โดยมี Silhouette ที่อ่านง่ายในทุกระยะภาพ" : ""}`,
    })));
    setMessage("AI Suggest เติมแนวทาง Characters & Voice ทั้งช่วงให้แล้ว ทุกตัวละครยังแก้เองได้");
  }

  function suggestSceneSection() {
    const i = Math.max(1, scenes.findIndex((scene) => scene.id === selected.id) + 1);
    patchScene({
      location: choose(LOCATION_PRESETS, i),
      objective: choose(OBJECTIVE_PRESETS, i),
      beat: choose(SCENE_BEATS, i),
      action: i % 2 ? "ตัวละครสังเกตเห็นรายละเอียดใหม่ที่เปลี่ยนความเข้าใจของเหตุการณ์ และตอบสนองอย่างเป็นธรรมชาติ" : "เหตุการณ์เดินหน้าอย่างชัดเจน พร้อม Action ที่นำไปสู่ Scene ถัดไป",
      transition: choose(TRANSITIONS, i),
      shot: choose(SHOT_TYPES, i + 1),
      angle: choose(CAMERA_ANGLES, i),
      lens: choose(LENSES, i + 2),
      movement: choose(CAMERA_MOVEMENTS, i + 1),
      height: choose(CAMERA_HEIGHTS, i),
      lighting: choose(LIGHTING_STYLES, i + 1),
      emotion: choose(EMOTIONS, i),
      dialogue: i % 2 ? "Character 1: เราคงไม่ได้บังเอิญมาเจอกันอีกใช่ไหม" : "",
      sound: choose(AMBIENCE_PRESETS, i),
      secondarySound: choose(AMBIENCE_PRESETS, i + 5),
      sfx: choose(SFX_PRESETS, i + 2),
      sfxTimeline: i % 2 ? "00:02.0 — Footsteps — ฝีเท้าเข้าใกล้\n00:04.5 — Car Pass — รถวิ่งผ่านด้านหลัง" : "00:03.0 — Door Close — ปิดประตูตรงจังหวะจบ Beat",
      music: choose(MUSIC_PRESETS, i),
      focus: choose(FOCUS_OPTIONS, i),
      dof: choose(DOF_OPTIONS, i),
      composition: choose(COMPOSITION_OPTIONS, i),
      cameraSpeed: choose(CAMERA_SPEEDS, i),
      performance: choose(PERFORMANCE_OPTIONS, i),
      colorTemp: choose(COLOR_TEMPERATURES, i),
      blocking: "วาง Subject หลักในตำแหน่งที่สอดคล้องกับ Composition และรักษาทิศทางสายตาจาก Shot ก่อนหน้า",
    });
    setMessage(`AI Suggest เติม Scene Direction, Camera และ Sound Design สำหรับ ${selected.title} ให้แล้ว`);
  }

  function fillProduction() {
    setScenes((current) => current.map((scene, index) => ({
      ...scene,
      location: choose(LOCATION_PRESETS, index),
      objective: choose(OBJECTIVE_PRESETS, index),
      beat: choose(SCENE_BEATS, index),
      shot: choose(SHOT_TYPES, index + 1),
      angle: choose(CAMERA_ANGLES, index),
      lens: choose(LENSES, index + 3),
      movement: choose(CAMERA_MOVEMENTS, index + 1),
      height: choose(CAMERA_HEIGHTS, index + 2),
      lighting: choose(LIGHTING_STYLES, index + 1),
      emotion: choose(EMOTIONS, index),
      sound: choose(AMBIENCE_PRESETS, index + 2),
      secondarySound: choose(AMBIENCE_PRESETS, index + 7),
      sfx: choose(SFX_PRESETS, index + 1),
      music: choose(MUSIC_PRESETS, index),
      action: index === 0 ? "Establish Environment และแนะนำตัวละครหลักอย่างเป็นธรรมชาติ" : index === current.length - 1 ? "จบ Beat ด้วยการตัดสินใจหรือภาพที่ส่งต่อไปเหตุการณ์ถัดไป" : "เดินหน้าเหตุการณ์พร้อม Reaction ของตัวละครและข้อมูลใหม่",
    })));
    setMessage("AI Fill Production เติม Draft ภาพและ Sound Design ให้ทุก Scene แล้ว ทุกค่าปรับต่อได้เอง");
  }

  function addScene() {
    if (scenes.length >= 12 || remaining < 1) return setMessage("เพิ่ม Scene ไม่ได้: เวลารวมถูกใช้ครบหรือถึงจำนวนสูงสุดแล้ว");
    const scene = createScene(scenes.length + 1, Math.min(6, remaining));
    setScenes((current) => [...current, scene]);
    setSelectedId(scene.id);
  }
  function duplicateScene() {
    if (remaining < 1) return setMessage("ต้องเหลือเวลาอย่างน้อย 1 วินาทีจึง Duplicate ได้");
    const copy = { ...selected, id: `scene_${Date.now()}_copy`, title: `${selected.title} Copy`, duration: Math.min(selected.duration, remaining) };
    setScenes((current) => [...current, copy]);
    setSelectedId(copy.id);
  }
  function splitScene() {
    if (selected.duration < 2) return setMessage("Scene ต้องยาวอย่างน้อย 2 วินาทีจึง Split ได้");
    const a = Math.ceil(selected.duration / 2);
    const b = selected.duration - a;
    const copy = { ...selected, id: `scene_${Date.now()}_split`, title: `${selected.title} B`, duration: b, beat: "Reaction" };
    setScenes((current) => current.flatMap((scene) => scene.id === selected.id ? [{ ...scene, duration: a, title: `${scene.title} A` }, copy] : [scene]));
    setSelectedId(copy.id);
  }
  function moveScene(direction: -1 | 1) {
    setScenes((current) => {
      const index = current.findIndex((scene) => scene.id === selected.id);
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function removeScene() {
    if (scenes.length <= 1) return;
    const next = scenes.filter((scene) => scene.id !== selected.id);
    setScenes(next);
    setSelectedId(next[0].id);
  }
  function setSceneDuration(value: number) {
    const other = used - selected.duration;
    patchScene({ duration: Math.max(1, Math.min(value, duration - other)) });
  }

  return <main className={styles.main}>
    <header className={styles.hero}>
      <div><span>SCENOVA PRODUCTION STUDIO</span><h1>Cinematic Production Workspace</h1><p>Workflow เดียวกันทุกระดับ: Production Setup → Characters → Scene Direction + Sound Design → Prompt & Render แต่ความลึกของเครื่องมือจะเพิ่มขึ้นตามโหมด</p></div>
      <div className={styles.heroActions}><span>{message}</span>{mode === "ai" ? <button className={styles.aiAction} onClick={fillProduction}>✦ AI Fill Production — ให้ AI เติมร่างทั้งงาน</button> : null}<button className={styles.primary}>Prompt & Render</button></div>
    </header>

    <section className={styles.modeGrid}>{MODES.map((item) => <button key={item.id} className={mode === item.id ? styles.modeActive : ""} onClick={() => setMode(item.id)}><i>{item.icon}</i><div><div className={styles.modeTitle}><strong>{item.name}</strong><span>{item.level}</span></div><b className={styles.modeThai}>{item.nameTh}</b><p>{item.desc}</p><ul>{item.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></div></button>)}</section>

    <section className={styles.modeGuide}>
      <div className={styles.modeGuideHead}><span>คำอธิบายโหมดที่เลือก</span><h2>{modeInfo.name} — {modeInfo.nameTh}</h2><p>{modeInfo.desc}</p></div>
      <div className={styles.modeGuideGrid}>
        <article><b>เหมาะกับงานแบบไหน</b><span>{modeInfo.bestFor}</span></article>
        <article><b>ผู้ใช้ควบคุมอะไร</b><span>{modeInfo.userControl}</span></article>
        <article><b>AI ทำหน้าที่อะไร</b><span>{modeInfo.aiRole}</span></article>
      </div>
    </section>

    <section id="setup" className={styles.card}>
      <div className={styles.step}><b>1</b><div><strong>Production Setup</strong><span>กำหนดข้อจำกัดหลักของงาน ทุกช่องมี Preset และแก้ Custom ได้</span></div></div>
      {mode === "ai" ? <div className={styles.quick}><button className={styles.aiAction} onClick={suggestSetup}>✦ AI ช่วยแนะนำช่วง Production Setup</button></div> : null}
      <div className={styles.setupGrid}>
        <div className={styles.field}><b>Video Model — โมเดลวิดีโอ</b><select value={model} onChange={(e) => setModel(e.target.value)}>{MODELS.map((item) => <option key={item}>{item}</option>)}</select><small>เลือก Provider หลักสำหรับการวาง Render Plan ดูราคาและข้อจำกัดได้ที่ Model Center</small><Link href="/models">เปิด Model Center →</Link></div>
        <div className={styles.field}><b>Target Duration — เวลารวม</b><select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[10,15,30,60,90,120,150,180].map((v) => <option value={v} key={v}>{v < 60 ? `${v} วินาที` : `${v/60} นาที`}</option>)}</select><small>Scene ทั้งหมดรวมกันต้องไม่เกิน Target นี้</small></div>
        <div className={styles.field}><b>Aspect Ratio — อัตราส่วนภาพ</b><select value={aspect} onChange={(e) => setAspect(e.target.value)}><option>9:16 — Vertical / TikTok / Reels</option><option>16:9 — Widescreen / YouTube / Film</option><option>1:1 — Square</option><option>4:5 — Social Portrait</option></select><small>กำหนดกรอบภาพหลักของ Production</small></div>
        <div className={styles.field}><b>Visual Style — สไตล์ภาพ</b><select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES.map((item) => <option key={item}>{item}</option>)}</select><small>Style จะถูกใช้เป็น Visual Language หลักและนำไปสร้าง Prompt</small></div>
      </div>
      <div className={styles.field}><div className={styles.fieldLabel}><b>Story Premise — แกนเรื่องหลัก</b></div><textarea value={story} onChange={(e) => setStory(e.target.value)} /><small>เขียนแกนเรื่องแบบสั้นหรือยาวได้ ระบบจะใช้เป็นบริบทกลางให้ Scene และ Prompt</small></div>
    </section>

    <section id="characters" className={styles.card}>
      <div className={styles.step}><b>2</b><div><strong>Characters & Voice</strong><span>กำหนดตัวละครหลัก เลือกจาก Library หรือกรอกเอง พร้อม Voice Profile</span></div></div>
      {mode === "ai" ? <div className={styles.quick}><button className={styles.aiAction} onClick={suggestCharacters}>✦ AI ช่วยแนะนำช่วง Characters & Voice</button></div> : null}
      <div className={styles.quick}><Link href="/libraries?tab=characters">Character Library</Link><Link href="/libraries?tab=voices">Voice Library</Link><button onClick={() => setCharacters((current) => [...current, { id:`c${Date.now()}`, name:`Character ${current.length+1}`, role:"Supporting — ตัวละครสนับสนุน", appearance:"กำหนดรูปลักษณ์", voice:VOICES[0] }])}>＋ Add Character</button></div>
      <div className={styles.characters}>{characters.map((character) => <article key={character.id}>
        <input className={styles.characterName} value={character.name} onChange={(e) => patchCharacter(character.id, { name: e.target.value })} />
        <div className={styles.two}>
          <div className={styles.field}><b>Role — บทบาท</b><select value={character.role} onChange={(e) => patchCharacter(character.id, { role:e.target.value })}><option>Protagonist — ตัวละครหลัก</option><option>Supporting — ตัวละครสนับสนุน</option><option>Antagonist — ฝ่ายตรงข้าม</option><option>Guest — ตัวละครรับเชิญ</option></select><small>บทบาทช่วยให้ AI ให้ความสำคัญของตัวละครถูกระดับ</small></div>
          <div className={styles.field}><b>Voice Profile — โปรไฟล์เสียง</b><select value={character.voice} onChange={(e) => patchCharacter(character.id, { voice:e.target.value })}>{VOICES.map((voice) => <option key={voice}>{voice}</option>)}</select><small>เลือกเสียงจาก Voice Library; เมื่อเชื่อม Provider จริงระบบจะผูก Voice ID ฝั่ง Server</small></div>
        </div>
        <div className={styles.field}><div className={styles.fieldLabel}><b>Appearance & Personality — รูปลักษณ์และบุคลิก</b></div><textarea value={character.appearance} onChange={(e) => patchCharacter(character.id, { appearance:e.target.value })} /><small>ถ้ามี Reference ให้เลือกจาก Asset Library; หากไม่มีให้บรรยายผม ตา ใบหน้า รูปร่าง อายุ เสื้อผ้า และบุคลิก</small></div>
      </article>)}</div>
    </section>

    <section id="scenes" className={styles.card}>
      <div className={styles.step}><b>3</b><div><strong>Scene Direction, Camera & Sound Design</strong><span>ควบคุม Duration, Narrative, Camera, Lighting, Dialogue, Ambience, SFX และ Continuity ต่อ Scene โดยรวมเวลาไม่เกิน Target</span></div></div>
      <div className={styles.quick}><button className={styles.aiAction} onClick={suggestSceneSection}>✦ AI ช่วยแนะนำช่วง Scene Direction & Sound</button><Link href="/libraries?tab=ambience">♫ Sound Library — คลังบรรยากาศ / SFX</Link></div>
      <div className={styles.budget}><div><b>{used} / {duration} seconds allocated</b><span>{remaining}s remaining</span></div><div>{scenes.map((scene,index) => <button key={scene.id} className={scene.id === selected.id ? styles.timelineActive : ""} onClick={() => setSelectedId(scene.id)} style={{ flexGrow:Math.max(1,scene.duration) }}><b>{index+1}</b><span>{scene.duration}s</span></button>)}</div></div>
      <div className={styles.sceneToolbar}><span>{scenes.length} Scenes • Total duration protected</span><div>{mode !== "ai" ? <><button onClick={() => moveScene(-1)}>← Move</button><button onClick={() => moveScene(1)}>Move →</button><button onClick={duplicateScene}>Duplicate</button><button onClick={splitScene}>Split</button></> : null}<button onClick={addScene}>＋ Add Scene</button></div></div>
      <div className={styles.sceneWorkspace}>
        <aside>{scenes.map((scene,index) => <button key={scene.id} className={scene.id === selected.id ? styles.sceneActive : ""} onClick={() => setSelectedId(scene.id)}><b>{String(index+1).padStart(2,"0")}</b><span><strong>{scene.title}</strong><small>{scene.duration}s • {scene.shot === "AI" ? "AI Suggest" : scene.shot}</small></span></button>)}</aside>
        <div className={styles.sceneEditor}>
          <div className={styles.sceneTitle}><input value={selected.title} onChange={(e) => patchScene({ title:e.target.value })} /><button onClick={removeScene}>Delete Scene</button></div>
          <div className={styles.durationBox}><div><b>Scene Duration — เวลาของ Scene</b><strong>{selected.duration}s</strong></div><input type="range" min={1} max={Math.max(1,selected.duration+remaining)} value={selected.duration} onChange={(e) => setSceneDuration(Number(e.target.value))} /><small>เลื่อนปรับเวลาได้ ระบบล็อกไม่ให้ Scene รวมเกิน {duration} วินาที</small></div>
          <div className={styles.two}><ChoiceField label="Location — สถานที่" help="เลือก Preset หรือพิมพ์สถานที่เอง" value={selected.location} options={LOCATION_PRESETS} onChange={(value) => patchScene({ location:value })} /><ChoiceField label="Scene Objective — เป้าหมายของ Scene" help="บอกว่า Scene นี้ต้องทำหน้าที่อะไรในเรื่อง" value={selected.objective} options={OBJECTIVE_PRESETS} onChange={(value) => patchScene({ objective:value })} /></div>
          <div className={styles.two}><ChoiceField label="Scene Beat — จังหวะของเรื่อง" help="เลือกตำแหน่งทาง Dramatic Structure ของ Scene" value={selected.beat} options={SCENE_BEATS} onChange={(value) => patchScene({ beat:value })} /><ChoiceField label="Transition — วิธีเชื่อม Scene" help="กำหนดการเปลี่ยนจาก Scene นี้ไป Scene ถัดไป" value={selected.transition} options={TRANSITIONS} onChange={(value) => patchScene({ transition:value })} /></div>
          <div className={styles.field}><div className={styles.fieldLabel}><b>Scene Action / Narrative — เหตุการณ์ใน Scene</b></div><textarea value={selected.action} onChange={(e) => patchScene({ action:e.target.value })} /><small>บรรยายว่าใครทำอะไร เกิดอะไรขึ้น และ Scene จบด้วยสถานะอะไร สามารถพิมพ์เองได้เต็มที่</small></div>
          {mode !== "ai" ? <div className={styles.field}><b>Continuity Note — บันทึกความต่อเนื่อง</b><textarea value={selected.continuity} onChange={(e) => patchScene({ continuity:e.target.value })} /><small>ระบุ Position, Costume, Prop, Emotion, Lighting, Movement และ Soundscape ที่ Scene ถัดไปต้องต่อให้ตรง</small></div> : null}
          <div className={styles.cameraGrid}><ChoiceField label="Shot Type — ระยะภาพ" help="กำหนดขนาดตัวละครหรือวัตถุหลักในกรอบภาพ" value={selected.shot} options={SHOT_TYPES} onChange={(value) => patchScene({ shot:value })} /><ChoiceField label="Camera Angle — มุมกล้อง" help="กำหนดระดับและทิศทางที่กล้องมองตัวละครหรือวัตถุ" value={selected.angle} options={CAMERA_ANGLES} onChange={(value) => patchScene({ angle:value })} /><ChoiceField label="Lens — ระยะเลนส์" help="กำหนดมุมมอง Perspective และความรู้สึกกว้าง/แคบของภาพ" value={selected.lens} options={LENSES} onChange={(value) => patchScene({ lens:value })} /><ChoiceField label="Movement — การเคลื่อนกล้อง" help="กำหนดวิธีและทิศทางที่กล้องเคลื่อนระหว่าง Shot" value={selected.movement} options={CAMERA_MOVEMENTS} onChange={(value) => patchScene({ movement:value })} /><ChoiceField label="Camera Height — ความสูงกล้อง" help="กำหนดระดับกล้องจากพื้นเพื่อควบคุมมุมมองและความรู้สึกของภาพ" value={selected.height} options={CAMERA_HEIGHTS} onChange={(value) => patchScene({ height:value })} /><ChoiceField label="Lighting — รูปแบบแสง" help="กำหนดคุณภาพ ทิศทาง และอารมณ์ของแสงใน Scene" value={selected.lighting} options={LIGHTING_STYLES} onChange={(value) => patchScene({ lighting:value })} /></div>
          <div className={styles.field}><ChoiceField label="Emotion — อารมณ์หลัก" help="กำหนดอารมณ์หลักที่ตัวละครต้องสื่อใน Scene" value={selected.emotion} options={EMOTIONS} onChange={(value) => patchScene({ emotion:value })} /></div>
          <div className={styles.field}><div className={styles.fieldLabel}><b>Dialogue — บทพูด</b></div><textarea value={selected.dialogue} onChange={(e) => patchScene({ dialogue:e.target.value })} placeholder="Character 1: ..." /><small>พิมพ์ชื่อผู้พูดและบทพูดโดยตรง ระบบจะยึด Voice Profile ของตัวละครเป็นหลัก</small></div>

          <details open className={styles.advanced}>
            <summary>Sound Design — ออกแบบเสียงฉาก</summary>
            <p className={styles.advancedIntro}>แยกเสียงเป็นชั้นเพื่อควบคุมง่าย: Ambience = เสียงบรรยากาศต่อเนื่อง, SFX = เสียงเหตุการณ์เฉพาะจังหวะ, Dialogue = บทพูด และ Music = ดนตรีประกอบ หาก Provider วิดีโอไม่สร้างเสียง ระบบยังเก็บข้อมูลชุดนี้ไว้ใช้กับ Audio Provider / Post-production ต่อได้</p>
            <div className={styles.quick}><Link href="/libraries?tab=ambience">♫ เปิดคลัง Ambience / SFX</Link></div>
            <div className={styles.cameraGrid}>
              <ChoiceField label="Primary Ambience — บรรยากาศหลัก" help="เสียงพื้นหลักที่เล่นต่อเนื่องตลอด Scene" value={selected.sound} options={AMBIENCE_PRESETS} onChange={(value) => patchScene({ sound:value })} />
              <ChoiceField label="Secondary Ambience — บรรยากาศเสริม" help="เสียงชั้นที่สอง เช่น ลม ใบไม้ ฝูงชน หรือเครื่องปรับอากาศ" value={selected.secondarySound} options={AMBIENCE_PRESETS} onChange={(value) => patchScene({ secondarySound:value })} />
              <ChoiceField label="SFX Event — เสียงเหตุการณ์" help="เสียงเฉพาะจังหวะ เช่น รถผ่าน ประตู ฝีเท้า น้ำกระเซ็น หรือ Whoosh" value={selected.sfx} options={SFX_PRESETS} onChange={(value) => patchScene({ sfx:value })} />
              <ChoiceField label="Music — ดนตรีประกอบ" help="เลือก Mood ของดนตรีหรือปิดดนตรีได้" value={selected.music} options={MUSIC_PRESETS} onChange={(value) => patchScene({ music:value })} />
            </div>
            <div className={styles.field}><div className={styles.fieldLabel}><b>SFX Timeline — กำหนดเวลาเสียงเหตุการณ์</b></div><textarea value={selected.sfxTimeline} onChange={(e) => patchScene({ sfxTimeline:e.target.value })} placeholder={'00:02.0 — Car Pass — รถวิ่งผ่านด้านหลัง\n00:04.5 — Door Close — ปิดประตู'} /><small>ระบุเวลาเป็นวินาทีเพื่อให้ Prompt / Render Plan รู้ว่าเสียงควรเกิดตรงไหน ตัวอย่าง 00:03.2 — Wave Crash — คลื่นซัดแรง</small></div>
            <div className={styles.cameraGrid}>
              <LevelField label="Ambience Level — ระดับบรรยากาศ" value={selected.ambienceLevel} onChange={(value) => patchScene({ ambienceLevel:value })} />
              <LevelField label="SFX Level — ระดับเอฟเฟกต์" value={selected.sfxLevel} onChange={(value) => patchScene({ sfxLevel:value })} />
              <LevelField label="Dialogue Level — ระดับบทพูด" value={selected.dialogueLevel} onChange={(value) => patchScene({ dialogueLevel:value })} />
              <LevelField label="Music Level — ระดับดนตรี" value={selected.musicLevel} onChange={(value) => patchScene({ musicLevel:value })} />
            </div>
          </details>

          <details open={mode === "pro"} className={styles.advanced}>
            <summary>Director Pro Controls — เครื่องมือกำกับระดับมืออาชีพ</summary>
            <p className={styles.advancedIntro}>ส่วนนี้ใช้ควบคุมรายละเอียดเชิงภาพและการแสดงระดับ Shot/Scene โดยตรง ทุกศัพท์เทคนิคมีคำอธิบายภาษาไทยด้านล่าง และค่า Lock ใช้บอกระบบว่าสิ่งใดต้องรักษาให้ต่อเนื่อง ห้ามเปลี่ยนโดยไม่ตั้งใจ</p>
            <div className={styles.cameraGrid}><ChoiceField label="Focus — จุดโฟกัส" help="กำหนดว่าสิ่งใดต้องชัดที่สุด หรือให้จุดชัดย้ายจากวัตถุหนึ่งไปอีกวัตถุหนึ่ง" value={selected.focus} options={FOCUS_OPTIONS} onChange={(value) => patchScene({ focus:value })} /><ChoiceField label="Depth of Field (DOF) — ชัดตื้น/ชัดลึก" help="กำหนดระดับความเบลอของฉากหน้า/ฉากหลัง เพื่อแยกตัวละครออกจากฉากหรือให้ทั้งภาพชัด" value={selected.dof} options={DOF_OPTIONS} onChange={(value) => patchScene({ dof:value })} /><ChoiceField label="Composition — การจัดองค์ประกอบภาพ" help="กำหนดตำแหน่งตัวละคร วัตถุ และพื้นที่ว่างในเฟรม เพื่อควบคุมสายตาผู้ชม" value={selected.composition} options={COMPOSITION_OPTIONS} onChange={(value) => patchScene({ composition:value })} /><ChoiceField label="Camera Speed — ความเร็วกล้อง" help="กำหนดความเร็วของการเคลื่อนกล้อง เพื่อให้ภาพนิ่ง นุ่ม เร่ง หรือกดดันตามอารมณ์" value={selected.cameraSpeed} options={CAMERA_SPEEDS} onChange={(value) => patchScene({ cameraSpeed:value })} /><ChoiceField label="Performance — ระดับการแสดง" help="กำหนดความเข้มของสีหน้า ภาษากาย จังหวะ และพลังการแสดงของตัวละคร" value={selected.performance} options={PERFORMANCE_OPTIONS} onChange={(value) => patchScene({ performance:value })} /><ChoiceField label="Color Temperature — อุณหภูมิสีของแสง" help="กำหนดโทนแสงอุ่น กลาง หรือเย็น ซึ่งส่งผลต่อบรรยากาศและอารมณ์ของภาพ" value={selected.colorTemp} options={COLOR_TEMPERATURES} onChange={(value) => patchScene({ colorTemp:value })} /></div>
            <div className={styles.field}><b>Character Blocking — ตำแหน่งและการเคลื่อนของตัวละคร</b><textarea value={selected.blocking} onChange={(e) => patchScene({ blocking:e.target.value })} /><small>กำหนดว่าตัวละครยืน/เดินตรงไหน หันหน้าไปทางใด, Eye Line (ทิศทางสายตา) และความสัมพันธ์กับตำแหน่ง Camera (กล้อง)</small></div>
            <div className={styles.lockHeading}><b>Continuity Locks — ตัวล็อกความต่อเนื่อง</b><span>ติ๊กสิ่งที่ต้องการให้ระบบรักษาเหมือนเดิมเมื่อสร้าง Scene/Shot ถัดไป</span></div>
            <div className={styles.lockGrid}>{PRO_LOCKS.map((lock) => <label key={lock.key}><input type="checkbox" checked={selected.locks.includes(lock.key)} onChange={(e) => patchScene({ locks:e.target.checked ? [...selected.locks,lock.key] : selected.locks.filter((item) => item !== lock.key) })} /><span><b>{lock.label}</b><small>{lock.help}</small></span></label>)}</div>
          </details>
        </div>
      </div>
    </section>

    <section id="review" className={styles.card}>
      <div className={styles.step}><b>4</b><div><strong>Prompt & Render Review</strong><span>ตรวจ Production Constraints ก่อนสร้าง Prompt หรือส่ง Render Queue</span></div></div>
      <div className={styles.review}><div><b>Mode — โหมด</b><span>{modeInfo.name} — {modeInfo.nameTh}</span></div><div><b>Model — โมเดล</b><span>{model}</span></div><div><b>Style — สไตล์</b><span>{style}</span></div><div><b>Format — รูปแบบภาพ</b><span>{aspect}</span></div><div><b>Scenes — จำนวนฉาก</b><span>{scenes.length}</span></div><div><b>Duration — เวลารวม</b><span>{used}/{duration}s</span></div><div><b>Sound Design — เสียง</b><span>{scenes.filter((scene) => scene.sound !== "Silence" || scene.sfx !== "None").length}/{scenes.length} Scene มีแผนเสียง</span></div></div>
      <div className={styles.finalActions}><Link href="/libraries">Asset Library</Link><Link href="/libraries?tab=ambience">Sound Library</Link><button>✦ Generate Production Prompt</button><button className={styles.primary}>▶ Prepare Render</button></div>
    </section>
  </main>;
}
