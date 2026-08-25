"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./scenova-studio-v3.module.css";
import {
  CAMERA_ANGLES, CAMERA_HEIGHTS, CAMERA_MOVEMENTS, CAMERA_SPEEDS, COLOR_TEMPERATURES,
  COMPOSITION_OPTIONS, DOF_OPTIONS, EMOTIONS, FOCUS_OPTIONS, LENSES, LIGHTING_STYLES,
  LOCATION_PRESETS, OBJECTIVE_PRESETS, PERFORMANCE_OPTIONS, SCENE_BEATS, SHOT_TYPES,
  SOUND_PRESETS, TRANSITIONS, type ProductionChoice,
} from "@/lib/production-options";

type Mode = "ai" | "scene" | "pro";
type Character = { id: string; name: string; role: string; appearance: string; voice: string };
type Scene = {
  id: string; title: string; duration: number; location: string; objective: string; beat: string; action: string;
  transition: string; continuity: string; shot: string; angle: string; lens: string; movement: string; height: string;
  lighting: string; emotion: string; dialogue: string; sound: string; focus: string; dof: string; composition: string;
  cameraSpeed: string; blocking: string; performance: string; colorTemp: string; keyLight: string; fillLight: string;
  rimLight: string; locks: string[];
};

const MODES = [
  { id: "ai" as const, icon: "✦", name: "AI Director", level: "AI ASSISTED", desc: "กำหนดแกนหลัก แล้วใช้ AI Suggest แบบรวมรายช่วง หรือ AI Fill Production เติม Scene, Camera, Lighting และ Dialogue ให้ทันที ทุกช่องยังเลือก Preset หรือพิมพ์ Custom เองได้", features: ["AI Fill ทั้ง Production", "AI Suggest แบบรวมรายช่วง", "Preset + Custom ทุกช่อง"] },
  { id: "scene" as const, icon: "▦", name: "Scene Planner", level: "SCENE CONTROL", desc: "วางโครง Scene ด้วยตัวเองและใช้ AI ช่วยเฉพาะช่วงที่ต้องการ มี Scene Objective, Beat, Transition, Continuity Note, Duplicate, Split และ Reorder", features: ["Scene Timeline", "Duplicate / Split / Move", "Continuity ต่อ Scene"] },
  { id: "pro" as const, icon: "◆", name: "Director Pro", level: "PRODUCTION PRO", desc: "ควบคุมระดับมืออาชีพทั้ง Focus, DOF, Composition, Camera Speed, Blocking, Performance, Light Layers, Color Temperature และ Continuity Locks", features: ["Technical Camera", "Performance Direction", "Production Locks"] },
];

const MODELS = ["Seedance 2.5", "Kling", "Veo", "Runway", "Wan"];
const STYLES = [
  "Cinematic Anime — อนิเมะภาพยนตร์", "Photorealistic Film — สมจริงแบบภาพยนตร์", "Warm Golden Hour — อบอุ่นแสงทอง",
  "Action Blockbuster — แอ็กชันบล็อกบัสเตอร์", "Sci-Fi Neon — ไซไฟนีออน", "Fantasy Storybook — แฟนตาซีภาพเล่าเรื่อง",
  "Dark Thriller — ทริลเลอร์โทนมืด", "Cute 3D — สามมิติน่ารัก",
];
const VOICES = ["Mira — หญิง อบอุ่น", "Nami — หญิง สดใส", "Arin — ชาย สุขุม", "Keen — ชาย หนักแน่น", "Luna — หญิง นุ่มแฟนตาซี"];

function createScene(index: number, duration = 6): Scene {
  return {
    id: `scene_${Date.now()}_${index}`, title: `Scene ${String(index).padStart(2, "0")}`, duration,
    location: index === 1 ? "Japanese Suburban Alley" : "", objective: index === 1 ? "Establish World" : "Reveal Information",
    beat: index === 1 ? "Opening" : "Turn", action: index === 1 ? "เปิดบรรยากาศและพาผู้ชมเข้าสู่เหตุการณ์หลัก" : "กำหนด Action หรือ Narrative ของ Scene นี้",
    transition: "Hard Cut", continuity: "รักษาตำแหน่งตัวละคร เครื่องแต่งกาย แสง และทิศทางการเคลื่อนจาก Scene ก่อนหน้า",
    shot: "AI", angle: "AI", lens: "AI", movement: "AI", height: "AI", lighting: "AI", emotion: "Natural",
    dialogue: "", sound: "Natural Ambience", focus: "Auto Subject", dof: "Natural", composition: "Rule of Thirds",
    cameraSpeed: "Normal", blocking: "AI วางตำแหน่งตัวละครให้สัมพันธ์กับ Action และ Camera", performance: "Natural",
    colorTemp: "Neutral 4500K", keyLight: "AI", fillLight: "AI", rimLight: "AI", locks: ["Character", "Style", "Voice"],
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

export default function ScenovaStudioV3() {
  const [mode, setMode] = useState<Mode>("ai");
  const [model, setModel] = useState("Seedance 2.5");
  const [duration, setDuration] = useState(30);
  const [style, setStyle] = useState(STYLES[0]);
  const [aspect, setAspect] = useState("9:16 — Vertical / TikTok / Reels");
  const [story, setStory] = useState("เด็กหญิงพบสิ่งมีชีวิตลึกลับระหว่างทางกลับบ้าน และความสัมพันธ์ของทั้งคู่ค่อย ๆ เปลี่ยนจากความสงสัยเป็นมิตรภาพ");
  const [characters, setCharacters] = useState<Character[]>([
    { id: "c1", name: "Character 1", role: "Protagonist — ตัวละครหลัก", appearance: "หญิงวัยรุ่น บุคลิกอบอุ่น สังเกตเก่ง", voice: VOICES[0] },
    { id: "c2", name: "Character 2", role: "Supporting — ตัวละครสนับสนุน", appearance: "กำหนดรูปลักษณ์หรือเลือกจาก Asset Library", voice: VOICES[2] },
  ]);
  const [scenes, setScenes] = useState<Scene[]>([createScene(1, 6), createScene(2, 6), createScene(3, 6)]);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("Production Workspace พร้อมใช้งาน");

  const selected = scenes.find((scene) => scene.id === selectedId) ?? scenes[0];
  const used = useMemo(() => scenes.reduce((sum, scene) => sum + scene.duration, 0), [scenes]);
  const remaining = Math.max(0, duration - used);
  const modeInfo = MODES.find((item) => item.id === mode)!;

  function patchScene(patch: Partial<Scene>) { setScenes((current) => current.map((scene) => scene.id === selected.id ? { ...scene, ...patch } : scene)); }
  function patchCharacter(id: string, patch: Partial<Character>) { setCharacters((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function choose<T extends { value: string }>(options: T[], index = 1) { return options[index % Math.max(1, options.length)].value; }

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
      sound: choose(SOUND_PRESETS, i),
      focus: choose(FOCUS_OPTIONS, i),
      dof: choose(DOF_OPTIONS, i),
      composition: choose(COMPOSITION_OPTIONS, i),
      cameraSpeed: choose(CAMERA_SPEEDS, i),
      performance: choose(PERFORMANCE_OPTIONS, i),
      colorTemp: choose(COLOR_TEMPERATURES, i),
      blocking: "วาง Subject หลักในตำแหน่งที่สอดคล้องกับ Composition และรักษาทิศทางสายตาจาก Shot ก่อนหน้า",
    });
    setMessage(`AI Suggest เติม Scene Direction & Camera สำหรับ ${selected.title} ให้ครบทั้งช่วงแล้ว`);
  }

  function fillProduction() {
    setScenes((current) => current.map((scene, index) => ({ ...scene,
      location: choose(LOCATION_PRESETS, index), objective: choose(OBJECTIVE_PRESETS, index), beat: choose(SCENE_BEATS, index),
      shot: choose(SHOT_TYPES, index + 1), angle: choose(CAMERA_ANGLES, index), lens: choose(LENSES, index + 3), movement: choose(CAMERA_MOVEMENTS, index + 1),
      height: choose(CAMERA_HEIGHTS, index + 2), lighting: choose(LIGHTING_STYLES, index + 1), emotion: choose(EMOTIONS, index), sound: choose(SOUND_PRESETS, index),
      action: index === 0 ? "Establish Environment และแนะนำตัวละครหลักอย่างเป็นธรรมชาติ" : index === current.length - 1 ? "จบ Beat ด้วยการตัดสินใจหรือภาพที่ส่งต่อไปเหตุการณ์ถัดไป" : "เดินหน้าเหตุการณ์พร้อม Reaction ของตัวละครและข้อมูลใหม่",
    })));
    setMessage("AI Fill Production เติม Draft ให้ทุก Scene แล้ว ทุกค่าปรับต่อได้เอง");
  }

  function addScene() {
    if (scenes.length >= 12 || remaining < 1) return setMessage("เพิ่ม Scene ไม่ได้: เวลารวมถูกใช้ครบหรือถึงจำนวนสูงสุดแล้ว");
    const scene = createScene(scenes.length + 1, Math.min(6, remaining)); setScenes((current) => [...current, scene]); setSelectedId(scene.id);
  }
  function duplicateScene() {
    if (remaining < 1) return setMessage("ต้องเหลือเวลาอย่างน้อย 1 วินาทีจึง Duplicate ได้");
    const copy = { ...selected, id: `scene_${Date.now()}_copy`, title: `${selected.title} Copy`, duration: Math.min(selected.duration, remaining) };
    setScenes((current) => [...current, copy]); setSelectedId(copy.id);
  }
  function splitScene() {
    if (selected.duration < 2) return setMessage("Scene ต้องยาวอย่างน้อย 2 วินาทีจึง Split ได้");
    const a = Math.ceil(selected.duration / 2); const b = selected.duration - a;
    const copy = { ...selected, id: `scene_${Date.now()}_split`, title: `${selected.title} B`, duration: b, beat: "Reaction" };
    setScenes((current) => current.flatMap((scene) => scene.id === selected.id ? [{ ...scene, duration: a, title: `${scene.title} A` }, copy] : [scene])); setSelectedId(copy.id);
  }
  function moveScene(direction: -1 | 1) {
    setScenes((current) => { const index = current.findIndex((scene) => scene.id === selected.id); const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  function removeScene() { if (scenes.length <= 1) return; const next = scenes.filter((scene) => scene.id !== selected.id); setScenes(next); setSelectedId(next[0].id); }
  function setSceneDuration(value: number) { const other = used - selected.duration; patchScene({ duration: Math.max(1, Math.min(value, duration - other)) }); }

  return <main className={styles.main}>
    <header className={styles.hero}><div><span>SCENOVA PRODUCTION STUDIO</span><h1>Cinematic Production Workspace</h1><p>Workflow เดียวกันทุกระดับ: Production Setup → Characters → Scene Direction → Prompt & Render แต่ความลึกของเครื่องมือจะเพิ่มขึ้นตามโหมด</p></div><div className={styles.heroActions}><span>{message}</span>{mode === "ai" ? <button onClick={fillProduction}>✦ AI Fill Production</button> : null}<button className={styles.primary}>Prompt & Render</button></div></header>

    <section className={styles.modeGrid}>{MODES.map((item) => <button key={item.id} className={mode === item.id ? styles.modeActive : ""} onClick={() => setMode(item.id)}><i>{item.icon}</i><div><div className={styles.modeTitle}><strong>{item.name}</strong><span>{item.level}</span></div><p>{item.desc}</p><ul>{item.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></div></button>)}</section>

    <section id="setup" className={styles.card}><div className={styles.step}><b>1</b><div><strong>Production Setup</strong><span>กำหนดข้อจำกัดหลักของงาน ทุกช่องมี Preset และแก้ Custom ได้</span></div></div>
      {mode === "ai" ? <div className={styles.quick}><button onClick={suggestSetup}>✦ AI Suggest ช่วง Production Setup</button></div> : null}
      <div className={styles.setupGrid}>
        <div className={styles.field}><b>Video Model — โมเดลวิดีโอ</b><select value={model} onChange={(e) => setModel(e.target.value)}>{MODELS.map((item) => <option key={item}>{item}</option>)}</select><small>เลือก Provider หลักสำหรับการวาง Render Plan ดูราคาและข้อจำกัดได้ที่ Model Center</small><Link href="/models">เปิด Model Center →</Link></div>
        <div className={styles.field}><b>Target Duration — เวลารวม</b><select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[10,15,30,60,90,120,150,180].map((v) => <option value={v} key={v}>{v < 60 ? `${v} วินาที` : `${v/60} นาที`}</option>)}</select><small>Scene ทั้งหมดรวมกันต้องไม่เกิน Target นี้</small></div>
        <div className={styles.field}><b>Aspect Ratio — อัตราส่วนภาพ</b><select value={aspect} onChange={(e) => setAspect(e.target.value)}><option>9:16 — Vertical / TikTok / Reels</option><option>16:9 — Widescreen / YouTube / Film</option><option>1:1 — Square</option><option>4:5 — Social Portrait</option></select><small>กำหนดกรอบภาพหลักของ Production</small></div>
        <div className={styles.field}><b>Visual Style — สไตล์ภาพ</b><select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES.map((item) => <option key={item}>{item}</option>)}</select><small>Style จะถูกใช้เป็น Visual Language หลักและนำไปสร้าง Prompt</small></div>
      </div>
      <div className={styles.field}><div className={styles.fieldLabel}><b>Story Premise — แกนเรื่องหลัก</b></div><textarea value={story} onChange={(e) => setStory(e.target.value)} /><small>เขียนแกนเรื่องแบบสั้นหรือยาวได้ ระบบจะใช้เป็นบริบทกลางให้ Scene และ Prompt</small></div>
    </section>

    <section id="characters" className={styles.card}><div className={styles.step}><b>2</b><div><strong>Characters & Voice</strong><span>กำหนดตัวละครหลัก เลือกจาก Library หรือกรอกเอง พร้อม Voice Profile</span></div></div>
      {mode === "ai" ? <div className={styles.quick}><button onClick={suggestCharacters}>✦ AI Suggest ช่วง Characters & Voice</button></div> : null}
      <div className={styles.quick}><Link href="/libraries?tab=characters">Character Library</Link><Link href="/libraries?tab=voices">Voice Library</Link><button onClick={() => setCharacters((c) => [...c, { id:`c${Date.now()}`, name:`Character ${c.length+1}`, role:"Supporting — ตัวละครสนับสนุน", appearance:"กำหนดรูปลักษณ์", voice:VOICES[0] }])}>＋ Add Character</button></div>
      <div className={styles.characters}>{characters.map((character) => <article key={character.id}><input className={styles.characterName} value={character.name} onChange={(e) => patchCharacter(character.id,{name:e.target.value})}/><div className={styles.two}><div className={styles.field}><b>Role — บทบาท</b><select value={character.role} onChange={(e)=>patchCharacter(character.id,{role:e.target.value})}><option>Protagonist — ตัวละครหลัก</option><option>Supporting — ตัวละครสนับสนุน</option><option>Antagonist — ฝ่ายตรงข้าม</option><option>Guest — ตัวละครรับเชิญ</option></select><small>บทบาทช่วยให้ AI ให้ความสำคัญของตัวละครถูกระดับ</small></div><div className={styles.field}><b>Voice Profile — โปรไฟล์เสียง</b><select value={character.voice} onChange={(e)=>patchCharacter(character.id,{voice:e.target.value})}>{VOICES.map(v=><option key={v}>{v}</option>)}</select><small>เลือกเสียงตัวอย่างจากคลังได้ก่อนเชื่อม Voice Provider จริง</small></div></div><div className={styles.field}><div className={styles.fieldLabel}><b>Appearance & Personality — รูปลักษณ์และบุคลิก</b></div><textarea value={character.appearance} onChange={(e)=>patchCharacter(character.id,{appearance:e.target.value})}/><small>ถ้ามี Reference ให้เลือกจาก Asset Library; หากไม่มีให้บรรยายผม ตา ใบหน้า รูปร่าง อายุ เสื้อผ้า และบุคลิก</small></div></article>)}</div>
    </section>

    <section id="scenes" className={styles.card}><div className={styles.step}><b>3</b><div><strong>Scene Direction & Camera</strong><span>ควบคุม Duration, Narrative, Camera, Lighting, Dialogue และ Continuity ต่อ Scene โดยรวมเวลาไม่เกิน Target</span></div></div>
      <div className={styles.quick}><button onClick={suggestSceneSection}>✦ AI Suggest ช่วง Scene Direction & Camera</button></div>
      <div className={styles.budget}><div><b>{used} / {duration} seconds allocated</b><span>{remaining}s remaining</span></div><div>{scenes.map((scene,index)=><button key={scene.id} className={scene.id===selected.id?styles.timelineActive:""} onClick={()=>setSelectedId(scene.id)} style={{flexGrow:Math.max(1,scene.duration)}}><b>{index+1}</b><span>{scene.duration}s</span></button>)}</div></div>
      <div className={styles.sceneToolbar}><span>{scenes.length} Scenes • Total duration protected</span><div>{mode !== "ai" ? <><button onClick={()=>moveScene(-1)}>← Move</button><button onClick={()=>moveScene(1)}>Move →</button><button onClick={duplicateScene}>Duplicate</button><button onClick={splitScene}>Split</button></>:null}<button onClick={addScene}>＋ Add Scene</button></div></div>
      <div className={styles.sceneWorkspace}><aside>{scenes.map((scene,index)=><button key={scene.id} className={scene.id===selected.id?styles.sceneActive:""} onClick={()=>setSelectedId(scene.id)}><b>{String(index+1).padStart(2,"0")}</b><span><strong>{scene.title}</strong><small>{scene.duration}s • {scene.shot === "AI" ? "AI Suggest" : scene.shot}</small></span></button>)}</aside><div className={styles.sceneEditor}>
        <div className={styles.sceneTitle}><input value={selected.title} onChange={(e)=>patchScene({title:e.target.value})}/><button onClick={removeScene}>Delete Scene</button></div>
        <div className={styles.durationBox}><div><b>Scene Duration — เวลาของ Scene</b><strong>{selected.duration}s</strong></div><input type="range" min={1} max={Math.max(1,selected.duration+remaining)} value={selected.duration} onChange={(e)=>setSceneDuration(Number(e.target.value))}/><small>เลื่อนปรับเวลาได้ ระบบล็อกไม่ให้ Scene รวมเกิน {duration} วินาที</small></div>
        <div className={styles.two}><ChoiceField label="Location — สถานที่" help="เลือก Preset หรือพิมพ์สถานที่เอง" value={selected.location} options={LOCATION_PRESETS} onChange={(v)=>patchScene({location:v})}/><ChoiceField label="Scene Objective — เป้าหมายของ Scene" help="บอกว่า Scene นี้ต้องทำหน้าที่อะไรในเรื่อง" value={selected.objective} options={OBJECTIVE_PRESETS} onChange={(v)=>patchScene({objective:v})}/></div>
        <div className={styles.two}><ChoiceField label="Scene Beat — จังหวะของเรื่อง" help="เลือกตำแหน่งทาง Dramatic Structure ของ Scene" value={selected.beat} options={SCENE_BEATS} onChange={(v)=>patchScene({beat:v})}/><ChoiceField label="Transition — วิธีเชื่อม Scene" help="กำหนดการเปลี่ยนจาก Scene นี้ไป Scene ถัดไป" value={selected.transition} options={TRANSITIONS} onChange={(v)=>patchScene({transition:v})}/></div>
        <div className={styles.field}><div className={styles.fieldLabel}><b>Scene Action / Narrative — เหตุการณ์ใน Scene</b></div><textarea value={selected.action} onChange={(e)=>patchScene({action:e.target.value})}/><small>บรรยายว่าใครทำอะไร เกิดอะไรขึ้น และ Scene จบด้วยสถานะอะไร สามารถพิมพ์เองได้เต็มที่</small></div>
        {mode !== "ai" ? <div className={styles.field}><b>Continuity Note — บันทึกความต่อเนื่อง</b><textarea value={selected.continuity} onChange={(e)=>patchScene({continuity:e.target.value})}/><small>ระบุ Position, Costume, Prop, Emotion, Lighting และ Movement ที่ Scene ถัดไปต้องต่อให้ตรง</small></div>:null}
        <div className={styles.cameraGrid}><ChoiceField label="Shot Type — ระยะภาพ" help="กำหนดขนาด Subject ใน Frame" value={selected.shot} options={SHOT_TYPES} onChange={(v)=>patchScene({shot:v})}/><ChoiceField label="Camera Angle — มุมกล้อง" help="กำหนดระดับและทิศทางการมอง Subject" value={selected.angle} options={CAMERA_ANGLES} onChange={(v)=>patchScene({angle:v})}/><ChoiceField label="Lens — ระยะเลนส์" help="กำหนด Perspective และความรู้สึกของภาพ" value={selected.lens} options={LENSES} onChange={(v)=>patchScene({lens:v})}/><ChoiceField label="Movement — การเคลื่อนกล้อง" help="กำหนด Motion ของ Camera" value={selected.movement} options={CAMERA_MOVEMENTS} onChange={(v)=>patchScene({movement:v})}/><ChoiceField label="Camera Height — ความสูงกล้อง" help="กำหนดระดับกล้องจากพื้น" value={selected.height} options={CAMERA_HEIGHTS} onChange={(v)=>patchScene({height:v})}/><ChoiceField label="Lighting — รูปแบบแสง" help="กำหนด Mood และคุณภาพของแสง" value={selected.lighting} options={LIGHTING_STYLES} onChange={(v)=>patchScene({lighting:v})}/></div>
        <div className={styles.two}><ChoiceField label="Emotion — อารมณ์หลัก" help="อารมณ์หลักของ Subject ใน Scene" value={selected.emotion} options={EMOTIONS} onChange={(v)=>patchScene({emotion:v})}/><ChoiceField label="Sound / SFX / Ambience — เสียง" help="เลือกบรรยากาศเสียงหรือพิมพ์รายละเอียดเอง" value={selected.sound} options={SOUND_PRESETS} onChange={(v)=>patchScene({sound:v})}/></div>
        <div className={styles.field}><div className={styles.fieldLabel}><b>Dialogue — บทพูด</b></div><textarea value={selected.dialogue} onChange={(e)=>patchScene({dialogue:e.target.value})} placeholder="Character 1: ..."/><small>พิมพ์ชื่อผู้พูดและบทพูดโดยตรง หรือใช้ AI Suggest ของช่วง Scene Direction แล้วแก้ต่อได้</small></div>
        <details open={mode === "pro"} className={styles.advanced}><summary>Director Pro Controls — เครื่องมือกำกับระดับมืออาชีพ</summary><div className={styles.cameraGrid}><ChoiceField label="Focus — จุดโฟกัส" help="กำหนด Subject หรือการย้าย Focus" value={selected.focus} options={FOCUS_OPTIONS} onChange={(v)=>patchScene({focus:v})}/><ChoiceField label="Depth of Field — ชัดตื้น/ชัดลึก" help="กำหนดการแยก Subject จากฉากหลัง" value={selected.dof} options={DOF_OPTIONS} onChange={(v)=>patchScene({dof:v})}/><ChoiceField label="Composition — การจัดองค์ประกอบ" help="กำหนดตำแหน่งภาพและสายตาผู้ชม" value={selected.composition} options={COMPOSITION_OPTIONS} onChange={(v)=>patchScene({composition:v})}/><ChoiceField label="Camera Speed — ความเร็วกล้อง" help="กำหนดความเร็วของ Movement" value={selected.cameraSpeed} options={CAMERA_SPEEDS} onChange={(v)=>patchScene({cameraSpeed:v})}/><ChoiceField label="Performance — ระดับการแสดง" help="กำหนดความเข้มของสีหน้าและภาษากาย" value={selected.performance} options={PERFORMANCE_OPTIONS} onChange={(v)=>patchScene({performance:v})}/><ChoiceField label="Color Temperature — อุณหภูมิสี" help="กำหนดโทนอุ่น/กลาง/เย็นของแสง" value={selected.colorTemp} options={COLOR_TEMPERATURES} onChange={(v)=>patchScene({colorTemp:v})}/></div><div className={styles.field}><b>Character Blocking — ตำแหน่งและการเคลื่อนของตัวละคร</b><textarea value={selected.blocking} onChange={(e)=>patchScene({blocking:e.target.value})}/><small>กำหนดจุดยืน ทิศทางเดิน Eye Line และความสัมพันธ์กับ Camera</small></div><div className={styles.lockGrid}>{["Character","Style","Voice","Costume","Location","Prop","Camera Language","Lighting"].map((lock)=><label key={lock}><input type="checkbox" checked={selected.locks.includes(lock)} onChange={(e)=>patchScene({locks:e.target.checked?[...selected.locks,lock]:selected.locks.filter(x=>x!==lock)})}/><span>{lock} Lock</span></label>)}</div></details>
      </div></div>
    </section>

    <section id="review" className={styles.card}><div className={styles.step}><b>4</b><div><strong>Prompt & Render Review</strong><span>ตรวจ Production Constraints ก่อนสร้าง Prompt หรือส่ง Render Queue</span></div></div><div className={styles.review}><div><b>Mode</b><span>{modeInfo.name}</span></div><div><b>Model</b><span>{model}</span></div><div><b>Style</b><span>{style}</span></div><div><b>Format</b><span>{aspect}</span></div><div><b>Scenes</b><span>{scenes.length}</span></div><div><b>Duration</b><span>{used}/{duration}s</span></div></div><div className={styles.finalActions}><Link href="/libraries">Asset Library</Link><button>✦ Generate Production Prompt</button><button className={styles.primary}>▶ Prepare Render</button></div></section>
  </main>;
}
