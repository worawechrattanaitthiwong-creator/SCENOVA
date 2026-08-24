"use client";

import { useMemo, useState } from "react";
import styles from "./scenova-studio.module.css";

type Mode = "auto" | "scene" | "pro" | "episode";
type Gender = "หญิง" | "ชาย" | "ไม่ระบุ";

type CharacterSetup = {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  nationality: string;
  personality: string;
  voice: string;
  hair: string;
  eyes: string;
  mouth: string;
  body: string;
  source: "library" | "custom";
  referenceName?: string;
};

type ScenePlan = {
  id: string;
  title: string;
  duration: number;
  summary: string;
  castIds: string[];
  location: string;
  shotType: string;
  angle: string;
  lens: string;
  movement: string;
  cameraHeight: string;
  lighting: string;
  emotion: string;
  dialogue: string;
  sound: string;
  notes: string;
};

const MODES = [
  {
    id: "auto" as const,
    icon: "✦",
    title: "AI ทำให้หมด",
    desc: "คุณกำหนดโมเดล เวลา ตัวละคร เสียง และจำนวนฉาก แล้ว AI ช่วยวางเรื่อง กล้อง แสง และจังหวะให้",
    badge: "ง่ายที่สุด",
  },
  {
    id: "scene" as const,
    icon: "▦",
    title: "แบ่งฉากเอง",
    desc: "ใช้ขั้นตอนเดียวกัน แต่คุณเป็นคนกำหนดว่าแต่ละฉากเกิดอะไรขึ้น แล้ว AI ช่วยเฉพาะจุดได้",
    badge: "ควบคุมมากขึ้น",
  },
  {
    id: "pro" as const,
    icon: "◆",
    title: "Director Pro",
    desc: "โครงเหมือนเดิมทุกอย่าง แต่เปิดรายละเอียดกล้องและการกำกับระดับมืออาชีพเพิ่มขึ้น",
    badge: "มืออาชีพ",
  },
  {
    id: "episode" as const,
    icon: "EP",
    title: "EP / Series",
    desc: "สร้างเป็นตอน ใช้ตัวละครและความต่อเนื่องเดิม แล้วกำหนดฉากของ EP นี้ด้วยหน้าจอแบบเดียวกัน",
    badge: "หลายตอน",
  },
] as const;

const LIBRARY_LINKS = [
  ["/models", "โมเดล & ราคา", "ดูความสามารถและเรทราคา"],
  ["/libraries#images", "คลังภาพ", "สไตล์ภาพ / Reference"],
  ["/libraries#voices", "คลังเสียง", "เสียงตัวละครพร้อมตัวอย่าง"],
  ["/libraries#characters", "คลังตัวละคร", "เลือกคนที่เคยสร้างไว้"],
  ["/libraries#pets", "คลังสัตว์เลี้ยง", "สัตว์ / Creature / Robot companion"],
  ["/libraries#ambience", "คลังบรรยากาศ", "เสียงรอบข้าง / SFX / ambience"],
  ["/libraries#plots", "คลังพล็อตเรื่อง", "พล็อตพร้อมเริ่มสร้าง"],
  ["/reference", "Reference Lab", "วิเคราะห์ภาพหรือวิดีโอตัวอย่าง"],
] as const;

const MODELS = ["Seedance 2.5", "Kling", "Veo", "Runway", "Wan"];
const STYLES = ["Cinematic Anime", "Photorealistic Film", "Warm Golden Hour", "Action Blockbuster", "Sci‑Fi Neon", "Fantasy Storybook", "Dark Thriller", "Cute 3D"];
const VOICES = [
  ["Mira", "หญิง • อบอุ่น • เป็นธรรมชาติ"],
  ["Nami", "หญิง • สดใส • วัยรุ่น"],
  ["Arin", "ชาย • สุขุม • ภาพยนตร์"],
  ["Keen", "ชาย • หนักแน่น • แอ็กชัน"],
  ["Luna", "หญิง • นุ่ม • แฟนตาซี"],
] as const;
const SHOTS = ["AI เลือกให้", "Extreme Wide", "Wide", "Full", "Medium", "Close-up", "Extreme Close-up", "POV", "OTS", "Insert Shot"];
const ANGLES = ["AI เลือกให้", "Eye Level", "Low Angle", "Extreme Low Angle", "High Angle", "Top View", "Side View", "Rear View", "Three-quarter"];
const LENSES = ["AI เลือกให้", "18mm", "24mm", "28mm", "35mm", "50mm", "65mm", "85mm", "100mm", "Custom"];
const MOVEMENTS = ["AI เลือกให้", "Static", "Push-in", "Pull-out", "Dolly", "Tracking", "Pan", "Tilt", "Crane", "Orbit", "Whip Pan", "Lateral Slide"];

const DEFAULT_CHARACTERS: CharacterSetup[] = [
  { id: "c1", name: "มินะ", gender: "หญิง", age: 22, nationality: "ญี่ปุ่น", personality: "ใจดี ช่างสงสัย กล้าขึ้นเมื่อจำเป็น", voice: "Mira", hair: "ผมดำยาว มัดครึ่งศีรษะ", eyes: "น้ำตาลเข้ม รูปอัลมอนด์", mouth: "ริมฝีปากบางธรรมชาติ", body: "รูปร่างสมส่วน สูงปานกลาง", source: "custom" },
  { id: "c2", name: "เรน", gender: "ชาย", age: 24, nationality: "ญี่ปุ่น", personality: "สุขุม อ่อนโยน ปกป้องเพื่อน", voice: "Arin", hair: "ผมดำสั้นยุ่งเล็กน้อย", eyes: "น้ำตาลเข้ม", mouth: "ริมฝีปากธรรมชาติ", body: "รูปร่างสูงสมส่วน", source: "custom" },
];

const makeCharacter = (index: number): CharacterSetup => ({
  id: `c-${Date.now()}-${index}`,
  name: `ตัวละคร ${index}`,
  gender: "ไม่ระบุ",
  age: 25,
  nationality: "ไทย",
  personality: "กำหนดบุคลิกของตัวละคร",
  voice: index % 2 === 0 ? "Arin" : "Mira",
  hair: "กำหนดสี ทรง และความยาวผม",
  eyes: "กำหนดสีและรูปทรงดวงตา",
  mouth: "กำหนดลักษณะปาก",
  body: "กำหนดรูปร่างและส่วนสูง",
  source: "custom",
});

const makeScene = (index: number, castIds: string[]): ScenePlan => ({
  id: `scene-${Date.now()}-${index}`,
  title: `ฉาก ${index}`,
  duration: 6,
  summary: index === 1 ? "เปิดเรื่องและแนะนำบรรยากาศ" : "อธิบายว่าเกิดอะไรขึ้นในฉากนี้",
  castIds,
  location: "สถานที่ของฉาก",
  shotType: "AI เลือกให้",
  angle: "AI เลือกให้",
  lens: "AI เลือกให้",
  movement: "AI เลือกให้",
  cameraHeight: "AI เลือกให้",
  lighting: "AI เลือกให้",
  emotion: "เป็นธรรมชาติ",
  dialogue: "",
  sound: "Natural ambience",
  notes: "",
});

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function StepTitle({ number, title, desc }: { number: number; title: string; desc: string }) {
  return (
    <div className={styles.stepTitle}>
      <span>{number}</span>
      <div><b>{title}</b><small>{desc}</small></div>
    </div>
  );
}

export default function ScenovaStudio() {
  const [mode, setMode] = useState<Mode>("auto");
  const [model, setModel] = useState("Seedance 2.5");
  const [duration, setDuration] = useState(30);
  const [aspect, setAspect] = useState("9:16");
  const [style, setStyle] = useState("Cinematic Anime");
  const [story, setStory] = useState("เด็กหญิงพบสิ่งมีชีวิตลึกลับระหว่างทางกลับบ้าน และค่อย ๆ กลายเป็นเพื่อนกัน");
  const [characters, setCharacters] = useState<CharacterSetup[]>(DEFAULT_CHARACTERS);
  const [petEnabled, setPetEnabled] = useState(true);
  const [petName, setPetName] = useState("โมจิ");
  const [petType, setPetType] = useState("สิ่งมีชีวิตแฟนตาซีตัวเล็ก");
  const [scenes, setScenes] = useState<ScenePlan[]>([
    makeScene(1, ["c1"]),
    makeScene(2, ["c1", "c2"]),
    makeScene(3, ["c1", "c2"]),
    makeScene(4, ["c1"]),
  ]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [continuity, setContinuity] = useState("ต่อเนื่องจากตอนก่อนหน้า");
  const [status, setStatus] = useState("พร้อมออกแบบ");
  const [promptPreview, setPromptPreview] = useState("");

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? scenes[0];
  const modeInfo = MODES.find((item) => item.id === mode) ?? MODES[0];
  const totalSceneSeconds = useMemo(() => scenes.reduce((sum, scene) => sum + Number(scene.duration || 0), 0), [scenes]);

  const patchCharacter = (id: string, patch: Partial<CharacterSetup>) => {
    setCharacters((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const setCharacterCount = (count: number) => {
    setCharacters((current) => {
      if (count === current.length) return current;
      if (count < current.length) return current.slice(0, count);
      const next = [...current];
      for (let i = current.length + 1; i <= count; i += 1) next.push(makeCharacter(i));
      return next;
    });
  };

  const patchScene = (id: string, patch: Partial<ScenePlan>) => {
    setScenes((current) => current.map((scene) => scene.id === id ? { ...scene, ...patch } : scene));
  };

  const setSceneCount = (count: number) => {
    setScenes((current) => {
      if (count === current.length) return current;
      if (count < current.length) {
        const sliced = current.slice(0, count);
        if (!sliced.some((scene) => scene.id === selectedSceneId)) setSelectedSceneId(sliced[0]?.id ?? "");
        return sliced;
      }
      const next = [...current];
      const castIds = characters.map((character) => character.id);
      for (let i = current.length + 1; i <= count; i += 1) next.push(makeScene(i, castIds.slice(0, 1)));
      return next;
    });
  };

  const addScene = () => {
    const next = makeScene(scenes.length + 1, characters.slice(0, 1).map((character) => character.id));
    setScenes((current) => [...current, next]);
    setSelectedSceneId(next.id);
  };

  const removeScene = (id: string) => {
    if (scenes.length <= 1) return;
    const next = scenes.filter((scene) => scene.id !== id);
    setScenes(next);
    if (selectedSceneId === id) setSelectedSceneId(next[0]?.id ?? "");
  };

  const toggleSceneCharacter = (characterId: string) => {
    if (!selectedScene) return;
    const exists = selectedScene.castIds.includes(characterId);
    patchScene(selectedScene.id, { castIds: exists ? selectedScene.castIds.filter((id) => id !== characterId) : [...selectedScene.castIds, characterId] });
  };

  const playVoice = (voiceName: string, gender: Gender) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus("เบราว์เซอร์นี้ยังเล่นเสียงตัวอย่างไม่ได้");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(gender === "ชาย" ? "สวัสดีครับ นี่คือตัวอย่างเสียงตัวละครจาก SCENOVA" : "สวัสดีค่ะ นี่คือตัวอย่างเสียงตัวละครจาก SCENOVA");
    utterance.lang = "th-TH";
    utterance.rate = voiceName === "Keen" ? 0.9 : voiceName === "Nami" ? 1.08 : 0.98;
    utterance.pitch = voiceName === "Arin" || voiceName === "Keen" ? 0.82 : voiceName === "Luna" ? 1.15 : 1.03;
    const thaiVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("th"));
    if (thaiVoice) utterance.voice = thaiVoice;
    window.speechSynthesis.speak(utterance);
    setStatus(`กำลังเล่นเสียง ${voiceName}`);
  };

  const aiFill = () => {
    setScenes((current) => current.map((scene, index) => ({
      ...scene,
      summary: scene.summary === "อธิบายว่าเกิดอะไรขึ้นในฉากนี้" ? `AI วางเหตุการณ์สำหรับฉาก ${index + 1} ให้ต่อเนื่องกับเรื่องหลัก` : scene.summary,
      shotType: scene.shotType === "AI เลือกให้" ? (index % 3 === 0 ? "Wide" : index % 3 === 1 ? "Medium" : "Close-up") : scene.shotType,
      angle: scene.angle === "AI เลือกให้" ? (index % 2 === 0 ? "Eye Level" : "Three-quarter") : scene.angle,
      lens: scene.lens === "AI เลือกให้" ? (index % 2 === 0 ? "35mm" : "65mm") : scene.lens,
      movement: scene.movement === "AI เลือกให้" ? (index % 2 === 0 ? "Tracking" : "Slow Push-in") : scene.movement,
    })));
    setStatus("AI เติมแนวทางของแต่ละฉากให้แล้ว คุณยังแก้ทุกช่องได้");
  };

  const buildPrompt = () => {
    const cast = characters.map((character) => `${character.name} | ${character.gender} | ${character.age} ปี | ${character.nationality} | ${character.personality} | hair: ${character.hair} | eyes: ${character.eyes} | mouth: ${character.mouth} | body: ${character.body} | voice: ${character.voice}`).join("\n");
    const sceneText = scenes.map((scene, index) => {
      const names = characters.filter((character) => scene.castIds.includes(character.id)).map((character) => character.name).join(", ") || "ไม่มีตัวละครหลัก";
      return `SCENE ${index + 1} — ${scene.title}\nDuration: ${scene.duration}s\nCast: ${names}\nLocation: ${scene.location}\nStory: ${scene.summary}\nCamera: ${scene.shotType}; ${scene.angle}; ${scene.lens}; ${scene.movement}; height ${scene.cameraHeight}\nLighting: ${scene.lighting}\nEmotion: ${scene.emotion}\nDialogue: ${scene.dialogue || "No dialogue"}\nSound: ${scene.sound || "Natural ambience"}\nNotes: ${scene.notes || "-"}`;
    }).join("\n\n");
    setPromptPreview(`SCENOVA PRODUCTION PROMPT\nMODE: ${modeInfo.title}\nMODEL: ${model}\nFORMAT: ${aspect}\nTARGET DURATION: ${duration}s\nSTYLE: ${style}${mode === "episode" ? `\nEPISODE: ${episodeNumber}\nCONTINUITY: ${continuity}` : ""}\n\nSTORY\n${story}\n\nCHARACTERS\n${cast}${petEnabled ? `\nPet/Creature: ${petName} — ${petType}` : ""}\n\n${sceneText}\n\nGLOBAL CONSISTENCY\nPreserve character identity, age, face, hair, eyes, body, costume, voice, location logic and visual style across all scenes. Respect each scene camera settings as hard constraints unless a field is set to AI choice.\n\nNEGATIVE\nno identity drift, no voice swap, no random costume change, no duplicated characters, no malformed anatomy, no camera teleportation, no random text or watermark.`);
    setStatus("สร้าง Prompt Preview แล้ว");
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}><span>S</span><div><b>SCENOVA</b><small>AI Movie & Series Studio</small></div></div>
        <div className={styles.headerSummary}><b>{modeInfo.title}</b><small>{model} · {duration} วินาที · {scenes.length} ฉาก · {characters.length} ตัวละคร</small></div>
        <div className={styles.headerActions}>
          <span className={styles.status}>{status}</span>
          <button className={styles.secondaryButton} onClick={buildPrompt}>✦ สร้าง Prompt</button>
          <button className={styles.primaryButton} onClick={() => setStatus("วางแผนสร้างคลิปแล้ว — Mock Provider ยังไม่หักเครดิต")}>▶ สร้างคลิปเลย</button>
        </div>
      </header>

      <nav className={styles.libraryBar} aria-label="คลังและเครื่องมือ">
        {LIBRARY_LINKS.map(([href, label, desc]) => <a href={href} key={href}><b>{label}</b><small>{desc}</small></a>)}
      </nav>

      <main className={styles.main}>
        <section className={styles.intro}>
          <div><span className={styles.eyebrow}>ใช้งานแบบเดียวกันทุกโหมด</span><h1>เลือกโหมด แล้วทำตาม 4 ขั้นตอน</h1><p>ทุกโหมดใช้โครงเดียวกัน: ตั้งค่างาน → ตัวละคร → แบ่งฉาก → ตรวจและสร้าง ต่างกันแค่ระดับที่ AI เข้ามาช่วยและรายละเอียดมืออาชีพที่เปิดเพิ่ม</p></div>
          <div className={styles.modeGrid}>
            {MODES.map((item) => <button key={item.id} onClick={() => setMode(item.id)} className={mode === item.id ? styles.modeActive : ""}><span className={styles.modeIcon}>{item.icon}</span><div><b>{item.title}</b><small>{item.desc}</small><em>{item.badge}</em></div></button>)}
          </div>
        </section>

        <section className={styles.card}>
          <StepTitle number={1} title="ตั้งค่างาน" desc="เริ่มจากโมเดล เวลา จำนวนฉาก จำนวนคน และสไตล์ — เหมือนกันทุกโหมด" />
          <div className={styles.setupGrid}>
            <Field label="โมเดล"><select value={model} onChange={(e) => setModel(e.target.value)}>{MODELS.map((item) => <option key={item}>{item}</option>)}</select><a className={styles.inlineLink} href="/models">ดูเรทราคาและความสามารถ →</a></Field>
            <Field label="ความยาวคลิป"><select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[10,15,30,60,90,120,150,180].map((item) => <option value={item} key={item}>{item < 60 ? `${item} วินาที` : `${item / 60} นาที`}</option>)}</select></Field>
            <Field label="จำนวนฉาก"><select value={scenes.length} onChange={(e) => setSceneCount(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => i + 1).map((item) => <option key={item} value={item}>{item} ฉาก</option>)}</select></Field>
            <Field label="จำนวนตัวละครหลัก"><select value={characters.length} onChange={(e) => setCharacterCount(Number(e.target.value))}>{Array.from({ length: 8 }, (_, i) => i + 1).map((item) => <option key={item} value={item}>{item} คน</option>)}</select></Field>
            <Field label="อัตราส่วนภาพ"><select value={aspect} onChange={(e) => setAspect(e.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option><option>4:5</option></select></Field>
            <Field label="สไตล์ภาพ"><select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES.map((item) => <option key={item}>{item}</option>)}</select><a className={styles.inlineLink} href="/libraries#images">เปิดคลังภาพ →</a></Field>
          </div>
          {mode === "episode" ? <div className={styles.episodeRow}><Field label="ตอนที่ (EP)"><input type="number" min={1} value={episodeNumber} onChange={(e) => setEpisodeNumber(Number(e.target.value))} /></Field><Field label="ความต่อเนื่อง"><select value={continuity} onChange={(e) => setContinuity(e.target.value)}><option>ต่อเนื่องจากตอนก่อนหน้า</option><option>ข้ามเวลา</option><option>วันถัดไป</option><option>สถานที่ใหม่</option><option>Flashback</option><option>Flash Forward</option></select></Field></div> : null}
          <Field label="เรื่อง / ไอเดียหลัก" hint={mode === "auto" ? "โหมด AI ทำให้หมด เขียนสั้น ๆ ได้ AI จะช่วยแตกเป็นฉาก" : "ใช้เป็นแกนเรื่อง แต่รายละเอียดแต่ละฉากแก้แยกด้านล่างได้"}><textarea className={styles.storyBox} value={story} onChange={(e) => setStory(e.target.value)} /></Field>
        </section>

        <section className={styles.card}>
          <StepTitle number={2} title="ตัวละครและเสียง" desc="เลือกจากคลังหรือสร้างใหม่ ถ้าไม่มีต้นฉบับให้กรอกรายละเอียดใบหน้า อายุ เชื้อชาติ/สัญชาติ และรูปร่างได้" />
          <div className={styles.sectionActions}><a className={styles.ghostButton} href="/libraries#characters">＋ เลือกจากคลังตัวละคร</a><a className={styles.ghostButton} href="/libraries#voices">♫ เปิดคลังเสียง</a></div>
          <div className={styles.characterGrid}>
            {characters.map((character, index) => (
              <article className={styles.characterCard} key={character.id}>
                <div className={styles.characterHead}><span>{index + 1}</span><div><b>{character.name}</b><small>{character.source === "library" ? "จากคลัง" : "กำหนดเอง"}</small></div><label className={styles.uploadButton}>↑ อัปโหลดรูป<input hidden type="file" accept="image/*" onChange={(e) => patchCharacter(character.id, { source: "custom", referenceName: e.target.files?.[0]?.name ?? "" })} /></label></div>
                {character.referenceName ? <div className={styles.fileTag}>Reference: {character.referenceName}</div> : null}
                <div className={styles.twoCol}>
                  <Field label="ชื่อ"><input value={character.name} onChange={(e) => patchCharacter(character.id, { name: e.target.value })} /></Field>
                  <Field label="เพศ"><select value={character.gender} onChange={(e) => patchCharacter(character.id, { gender: e.target.value as Gender })}><option>หญิง</option><option>ชาย</option><option>ไม่ระบุ</option></select></Field>
                  <Field label="อายุ"><input type="number" min={1} max={120} value={character.age} onChange={(e) => patchCharacter(character.id, { age: Number(e.target.value) })} /></Field>
                  <Field label="สัญชาติ"><input value={character.nationality} onChange={(e) => patchCharacter(character.id, { nationality: e.target.value })} /></Field>
                </div>
                <Field label="คาแรกเตอร์ / บุคลิก"><input value={character.personality} onChange={(e) => patchCharacter(character.id, { personality: e.target.value })} /></Field>
                <Field label="เสียง" hint="ตัวอย่างตอนนี้ใช้เสียงของเบราว์เซอร์ ก่อนเชื่อม Voice Provider จริง"><div className={styles.voiceRow}><select value={character.voice} onChange={(e) => patchCharacter(character.id, { voice: e.target.value })}>{VOICES.map(([name, desc]) => <option value={name} key={name}>{name} — {desc}</option>)}</select><button onClick={() => playVoice(character.voice, character.gender)}>▶ ฟัง</button></div></Field>
                <details className={styles.details}><summary>＋ รายละเอียดเพิ่ม กรณีไม่มีตัวต้นฉบับ</summary><div className={styles.twoCol}><Field label="ผม"><input value={character.hair} onChange={(e) => patchCharacter(character.id, { hair: e.target.value })} /></Field><Field label="ดวงตา"><input value={character.eyes} onChange={(e) => patchCharacter(character.id, { eyes: e.target.value })} /></Field><Field label="ปาก"><input value={character.mouth} onChange={(e) => patchCharacter(character.id, { mouth: e.target.value })} /></Field><Field label="รูปร่าง / ส่วนสูง"><input value={character.body} onChange={(e) => patchCharacter(character.id, { body: e.target.value })} /></Field></div></details>
              </article>
            ))}
          </div>
          <div className={styles.petRow}><Field label="มีสัตว์เลี้ยง / Creature"><select value={petEnabled ? "yes" : "no"} onChange={(e) => setPetEnabled(e.target.value === "yes")}><option value="no">ไม่มี</option><option value="yes">มี</option></select></Field>{petEnabled ? <><Field label="ชื่อ"><input value={petName} onChange={(e) => setPetName(e.target.value)} /></Field><Field label="ประเภท"><input value={petType} onChange={(e) => setPetType(e.target.value)} /></Field><a className={styles.libraryButton} href="/libraries#pets">เปิดคลังสัตว์เลี้ยง →</a></> : null}</div>
        </section>

        <section className={styles.card}>
          <div className={styles.stepWithAction}><StepTitle number={3} title="แบ่งฉากและตั้งกล้องรายฉาก" desc="เลือกฉากทางซ้าย แล้วแก้เรื่องตรงกลางและกล้องทางขวา ค่าของแต่ละฉากไม่กระทบฉากอื่น" /><div><button className={styles.ghostButton} onClick={addScene}>＋ เพิ่มฉาก</button><button className={styles.aiButton} onClick={aiFill}>✦ AI ช่วยเติม</button></div></div>
          <div className={styles.sceneWorkspace}>
            <aside className={styles.sceneRail}>
              <div className={styles.sceneRailHead}><b>{scenes.length} ฉาก</b><small>รวม {totalSceneSeconds} วิ / เป้าหมาย {duration} วิ</small></div>
              {scenes.map((scene, index) => <button key={scene.id} onClick={() => setSelectedSceneId(scene.id)} className={selectedScene?.id === scene.id ? styles.sceneActive : ""}><span>{index + 1}</span><div><b>{scene.title}</b><small>{scene.duration} วิ · {scene.shotType}</small></div></button>)}
            </aside>

            {selectedScene ? <div className={styles.sceneEditor}>
              <div className={styles.sceneEditorHead}><div><span>SCENE</span><h3>{selectedScene.title}</h3></div><button className={styles.deleteButton} disabled={scenes.length <= 1} onClick={() => removeScene(selectedScene.id)}>ลบฉาก</button></div>
              <div className={styles.twoCol}><Field label="ชื่อฉาก"><input value={selectedScene.title} onChange={(e) => patchScene(selectedScene.id, { title: e.target.value })} /></Field><Field label="ความยาว"><input type="number" min={1} max={30} value={selectedScene.duration} onChange={(e) => patchScene(selectedScene.id, { duration: Number(e.target.value) })} /></Field></div>
              <Field label="เกิดอะไรขึ้นในฉากนี้"><textarea value={selectedScene.summary} onChange={(e) => patchScene(selectedScene.id, { summary: e.target.value })} /></Field>
              <Field label="สถานที่"><input value={selectedScene.location} onChange={(e) => patchScene(selectedScene.id, { location: e.target.value })} /></Field>
              <div className={styles.castPicker}><b>ใครอยู่ในฉากนี้</b><div>{characters.map((character) => <label key={character.id}><input type="checkbox" checked={selectedScene.castIds.includes(character.id)} onChange={() => toggleSceneCharacter(character.id)} /><span>{character.name}</span></label>)}{petEnabled ? <label><input type="checkbox" defaultChecked /><span>{petName}</span></label> : null}</div></div>
              <Field label="บทพูด"><textarea value={selectedScene.dialogue} onChange={(e) => patchScene(selectedScene.id, { dialogue: e.target.value })} placeholder="มินะ: เราไปทางนี้กันเถอะ" /></Field>
              <div className={styles.twoCol}><Field label="อารมณ์"><input value={selectedScene.emotion} onChange={(e) => patchScene(selectedScene.id, { emotion: e.target.value })} /></Field><Field label="เสียง / SFX / บรรยากาศ"><input value={selectedScene.sound} onChange={(e) => patchScene(selectedScene.id, { sound: e.target.value })} /></Field></div>
              <Field label="หมายเหตุเพิ่มเติม"><input value={selectedScene.notes} onChange={(e) => patchScene(selectedScene.id, { notes: e.target.value })} /></Field>
            </div> : null}

            {selectedScene ? <aside className={styles.cameraPanel}>
              <div className={styles.cameraHead}><span>CAMERA · ฉากนี้เท่านั้น</span><b>{selectedScene.title}</b><small>เปลี่ยนตรงนี้แล้วไม่ไปเปลี่ยนฉากอื่น</small></div>
              <Field label="Shot Type"><select value={selectedScene.shotType} onChange={(e) => patchScene(selectedScene.id, { shotType: e.target.value })}>{SHOTS.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Camera Angle"><select value={selectedScene.angle} onChange={(e) => patchScene(selectedScene.id, { angle: e.target.value })}>{ANGLES.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Lens"><select value={selectedScene.lens} onChange={(e) => patchScene(selectedScene.id, { lens: e.target.value })}>{LENSES.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Movement"><select value={selectedScene.movement} onChange={(e) => patchScene(selectedScene.id, { movement: e.target.value })}>{MOVEMENTS.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Camera Height"><input value={selectedScene.cameraHeight} onChange={(e) => patchScene(selectedScene.id, { cameraHeight: e.target.value })} placeholder="เช่น ระดับเอว / 20 ซม. / Eye Level" /></Field>
              <Field label="Lighting"><input value={selectedScene.lighting} onChange={(e) => patchScene(selectedScene.id, { lighting: e.target.value })} /></Field>
              {mode === "pro" ? <div className={styles.proNote}><b>Director Pro</b><span>ต่อไปจะเพิ่ม Focus, DOF, Composition, Foreground Occlusion และหลาย Shot ภายในฉากตรงแผงนี้ โดยยังยึด UX แบบเดียวกัน</span></div> : <div className={styles.aiHint}>ไม่แน่ใจให้เลือก “AI เลือกให้” ได้ AI จะเลือกตามเรื่องและอารมณ์ของฉาก</div>}
            </aside> : null}
          </div>
        </section>

        <section className={styles.card}>
          <StepTitle number={4} title="ตรวจแล้วสร้าง" desc="ดูสรุปก่อน ระบบจะใช้ค่าทั้งหมดเป็นข้อกำหนด แล้วให้ AI ช่วยเรียบเรียง Prompt สำหรับโมเดลที่เลือก" />
          <div className={styles.reviewGrid}><div><b>{model}</b><small>โมเดล</small></div><div><b>{duration} วิ</b><small>ความยาวเป้าหมาย</small></div><div><b>{scenes.length} ฉาก</b><small>ฉากทั้งหมด</small></div><div><b>{characters.length} คน</b><small>ตัวละครหลัก</small></div><div><b>{style}</b><small>สไตล์</small></div><div><b>{modeInfo.title}</b><small>โหมด</small></div></div>
          <div className={styles.finalActions}><button className={styles.secondaryButton} onClick={buildPrompt}>✦ สร้าง Prompt</button><button className={styles.primaryButton} onClick={() => setStatus("วางแผนสร้างคลิปแล้ว — Mock Provider ยังไม่หักเครดิต")}>▶ สร้างคลิปเลย</button></div>
          {promptPreview ? <div className={styles.promptBox}><div><b>Prompt Preview</b><button onClick={() => navigator.clipboard?.writeText(promptPreview)}>คัดลอก</button></div><pre>{promptPreview}</pre></div> : null}
        </section>
      </main>
    </div>
  );
}
