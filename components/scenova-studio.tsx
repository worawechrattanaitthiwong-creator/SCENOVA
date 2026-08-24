"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./scenova-studio-v2.module.css";

type Mode = "auto" | "scene" | "pro" | "episode";
type Gender = "หญิง" | "ชาย" | "ไม่ระบุ";
type Character = { id: string; name: string; gender: Gender; age: number; nationality: string; personality: string; voice: string; hair: string; eyes: string; mouth: string; body: string; reference?: string };
type Scene = { id: string; title: string; duration: number; story: string; cast: string[]; location: string; shot: string; angle: string; lens: string; movement: string; height: string; lighting: string; emotion: string; dialogue: string; sound: string };

const MODES = [
  { id: "auto" as const, icon: "✦", name: "AI ทำให้หมด", note: "บอกสิ่งที่ต้องการ แล้ว AI ช่วยวางฉาก กล้อง และจังหวะ", tag: "ง่ายที่สุด" },
  { id: "scene" as const, icon: "▦", name: "แบ่งฉากเอง", note: "กำหนดเนื้อหาแต่ละฉากเอง แล้วให้ AI ช่วยเฉพาะจุด", tag: "ควบคุมง่าย" },
  { id: "pro" as const, icon: "◆", name: "Director Pro", note: "เพิ่มรายละเอียดกล้องและการกำกับระดับมืออาชีพ", tag: "มืออาชีพ" },
  { id: "episode" as const, icon: "EP", name: "EP / Series", note: "สร้างเป็นตอนโดยรักษาตัวละครและความต่อเนื่องเดิม", tag: "หลายตอน" },
];
const MODELS = ["Seedance 2.5", "Kling", "Veo", "Runway", "Wan"];
const STYLES = ["Cinematic Anime", "Photorealistic Film", "Warm Golden Hour", "Action Blockbuster", "Sci-Fi Neon", "Fantasy Storybook", "Dark Thriller", "Cute 3D"];
const VOICES = [["Mira","หญิง • อบอุ่น"],["Nami","หญิง • สดใส"],["Arin","ชาย • สุขุม"],["Keen","ชาย • หนักแน่น"],["Luna","หญิง • นุ่มแฟนตาซี"]] as const;
const SHOTS = ["AI เลือกให้","Extreme Wide","Wide","Full","Medium","Close-up","Extreme Close-up","POV","OTS","Insert Shot"];
const ANGLES = ["AI เลือกให้","Eye Level","Low Angle","Extreme Low Angle","High Angle","Top View","Side View","Rear View","Three-quarter"];
const LENSES = ["AI เลือกให้","18mm","24mm","28mm","35mm","50mm","65mm","85mm","100mm","Custom"];
const MOVEMENTS = ["AI เลือกให้","Static","Push-in","Pull-out","Dolly","Tracking","Pan","Tilt","Crane","Orbit","Whip Pan","Lateral Slide"];

const newCharacter = (index: number): Character => ({ id: `c${Date.now()}${index}`, name: `ตัวละคร ${index}`, gender: index % 2 ? "หญิง" : "ชาย", age: 24, nationality: "ไทย", personality: "กำหนดบุคลิกของตัวละคร", voice: index % 2 ? "Mira" : "Arin", hair: "", eyes: "", mouth: "", body: "" });
const newScene = (index: number, cast: string[]): Scene => ({ id: `s${Date.now()}${index}`, title: `ฉาก ${index}`, duration: 6, story: index === 1 ? "เปิดเรื่องและแนะนำบรรยากาศ" : "อธิบายสิ่งที่เกิดขึ้นในฉากนี้", cast, location: "", shot: "AI เลือกให้", angle: "AI เลือกให้", lens: "AI เลือกให้", movement: "AI เลือกให้", height: "AI เลือกให้", lighting: "AI เลือกให้", emotion: "เป็นธรรมชาติ", dialogue: "", sound: "" });

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}
function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return <div className={styles.stepHead}><b>{n}</b><div><strong>{title}</strong><span>{desc}</span></div></div>;
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
  const [scenes, setScenes] = useState<Scene[]>(() => [newScene(1, []), newScene(2, []), newScene(3, [])]);
  const [selectedId, setSelectedId] = useState("");
  const [ep, setEp] = useState(1);
  const [continuity, setContinuity] = useState("ต่อเนื่องจากตอนก่อนหน้า");
  const [status, setStatus] = useState("พร้อมออกแบบ");
  const [prompt, setPrompt] = useState("");
  const selected = scenes.find((scene) => scene.id === selectedId) ?? scenes[0];
  const modeInfo = MODES.find((item) => item.id === mode) ?? MODES[0];
  const sceneSeconds = useMemo(() => scenes.reduce((sum, s) => sum + Number(s.duration || 0), 0), [scenes]);

  function setCharacterCount(count: number) {
    setCharacters((current) => count <= current.length ? current.slice(0, count) : [...current, ...Array.from({ length: count - current.length }, (_, i) => newCharacter(current.length + i + 1))]);
  }
  function patchCharacter(id: string, patch: Partial<Character>) { setCharacters((current) => current.map((c) => c.id === id ? { ...c, ...patch } : c)); }
  function setSceneCount(count: number) {
    setScenes((current) => count <= current.length ? current.slice(0, Math.max(1, count)) : [...current, ...Array.from({ length: count - current.length }, (_, i) => newScene(current.length + i + 1, characters.slice(0, 1).map((c) => c.id)))]);
  }
  function patchScene(id: string, patch: Partial<Scene>) { setScenes((current) => current.map((s) => s.id === id ? { ...s, ...patch } : s)); }
  function addScene() { const scene = newScene(scenes.length + 1, characters.slice(0, 1).map((c) => c.id)); setScenes((current) => [...current, scene]); setSelectedId(scene.id); }
  function removeScene(id: string) { if (scenes.length <= 1) return; const next = scenes.filter((s) => s.id !== id); setScenes(next); setSelectedId(next[0]?.id || ""); }
  function toggleCast(id: string) { if (!selected) return; patchScene(selected.id, { cast: selected.cast.includes(id) ? selected.cast.filter((x) => x !== id) : [...selected.cast, id] }); }
  function playVoice(character: Character) {
    if (!("speechSynthesis" in window)) return setStatus("เบราว์เซอร์นี้ยังเล่นเสียงตัวอย่างไม่ได้");
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(character.gender === "ชาย" ? "สวัสดีครับ นี่คือตัวอย่างเสียงตัวละครจาก SCENOVA" : "สวัสดีค่ะ นี่คือตัวอย่างเสียงตัวละครจาก SCENOVA"); u.lang = "th-TH"; u.rate = character.voice === "Nami" ? 1.08 : .98; u.pitch = ["Arin","Keen"].includes(character.voice) ? .82 : 1.05; speechSynthesis.speak(u); setStatus(`กำลังเล่นเสียง ${character.voice}`);
  }
  function aiFill() {
    setScenes((current) => current.map((s, i) => ({ ...s, story: s.story || `AI วางเหตุการณ์ฉาก ${i + 1}`, shot: s.shot === "AI เลือกให้" ? (i % 3 === 0 ? "Wide" : i % 3 === 1 ? "Medium" : "Close-up") : s.shot, angle: s.angle === "AI เลือกให้" ? "Eye Level" : s.angle, lens: s.lens === "AI เลือกให้" ? (i % 2 ? "65mm" : "35mm") : s.lens, movement: s.movement === "AI เลือกให้" ? (i % 2 ? "Push-in" : "Tracking") : s.movement })));
    setStatus("AI เติมแนวทางให้แล้ว ทุกช่องยังแก้เองได้");
  }
  function buildPrompt() {
    const cast = characters.map((c) => `${c.name}: ${c.gender}, ${c.age} ปี, ${c.nationality}, ${c.personality}, voice ${c.voice}, hair ${c.hair || "locked from reference"}, eyes ${c.eyes || "locked from reference"}, mouth ${c.mouth || "locked from reference"}, body ${c.body || "locked from reference"}`).join("\n");
    const sceneText = scenes.map((s, i) => `SCENE ${i + 1} | ${s.duration}s\n${s.story}\nLocation: ${s.location || "AI choose"}\nCamera: ${s.shot}, ${s.angle}, ${s.lens}, ${s.movement}, height ${s.height}\nLighting: ${s.lighting}\nEmotion: ${s.emotion}\nDialogue: ${s.dialogue || "No dialogue"}\nSound: ${s.sound || "Natural ambience"}`).join("\n\n");
    setPrompt(`SCENOVA PRODUCTION PROMPT\nMODE: ${modeInfo.name}\nMODEL: ${model}\nFORMAT: ${aspect}\nDURATION: ${duration}s\nSTYLE: ${style}${mode === "episode" ? `\nEP: ${ep}\nCONTINUITY: ${continuity}` : ""}\n\nSTORY\n${story}\n\nCHARACTERS\n${cast}${pet ? `\nPET/CREATURE: ${petText}` : ""}\n\n${sceneText}\n\nCONSISTENCY: keep identity, age, face, hair, body, voice, costume and visual style locked across every scene.`); setStatus("สร้าง Prompt Preview แล้ว");
  }

  return <main className={styles.main}>
    <section className={styles.titleRow}>
      <div><span>SCENOVA CREATOR</span><h1>สร้างหนังด้วยขั้นตอนเดียวกันทุกโหมด</h1><p>เลือกโหมด แล้วทำ 4 ขั้นตอนด้านล่าง ไม่ต้องวิ่งไปตั้งค่าหลายหน้า เมนูหลักอยู่ซ้าย และคลังย่อยอยู่ด้านบน</p></div>
      <div className={styles.actionRow}><span className={styles.status}>{status}</span><button className={styles.secondary} onClick={buildPrompt}>✦ สร้าง Prompt</button><button className={styles.primary} onClick={() => setStatus("วางแผนสร้างคลิปแล้ว — Mock Provider")}>▶ สร้างคลิปเลย</button></div>
    </section>

    <section className={styles.modeGrid}>{MODES.map((m) => <button key={m.id} onClick={() => setMode(m.id)} className={mode === m.id ? styles.modeActive : ""}><i>{m.icon}</i><div><strong>{m.name}</strong><p>{m.note}</p><span>{m.tag}</span></div></button>)}</section>

    <section id="setup" className={styles.card}><Step n={1} title="ตั้งค่างาน" desc="เลือกโมเดล เวลา จำนวนฉาก จำนวนคน และสไตล์ — ทุกโหมดเหมือนกัน" />
      <div className={styles.sixGrid}>
        <Field label="โมเดล"><select value={model} onChange={(e) => setModel(e.target.value)}>{MODELS.map((x) => <option key={x}>{x}</option>)}</select><Link href="/models">ดูโมเดล & ราคา →</Link></Field>
        <Field label="ความยาว"><select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[10,15,30,60,90,120,150,180].map((x) => <option key={x} value={x}>{x < 60 ? `${x} วินาที` : `${x / 60} นาที`}</option>)}</select></Field>
        <Field label="จำนวนฉาก"><select value={scenes.length} onChange={(e) => setSceneCount(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+1).map((x)=><option key={x} value={x}>{x} ฉาก</option>)}</select></Field>
        <Field label="จำนวนคน"><select value={characters.length} onChange={(e) => setCharacterCount(Number(e.target.value))}>{Array.from({length:8},(_,i)=>i+1).map((x)=><option key={x} value={x}>{x} คน</option>)}</select></Field>
        <Field label="อัตราส่วนภาพ"><select value={aspect} onChange={(e) => setAspect(e.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option><option>4:5</option></select></Field>
        <Field label="สไตล์ภาพ"><select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES.map((x)=><option key={x}>{x}</option>)}</select><Link href="/libraries#images">เปิดคลังภาพ →</Link></Field>
      </div>
      {mode === "episode" ? <div className={styles.twoGrid}><Field label="ตอนที่"><input type="number" min={1} value={ep} onChange={(e) => setEp(Number(e.target.value))} /></Field><Field label="ความต่อเนื่อง"><select value={continuity} onChange={(e)=>setContinuity(e.target.value)}><option>ต่อเนื่องจากตอนก่อนหน้า</option><option>ข้ามเวลา</option><option>วันถัดไป</option><option>สถานที่ใหม่</option><option>Flashback</option><option>Flash Forward</option></select></Field></div> : null}
      <Field label="เรื่อง / ไอเดียหลัก" hint={mode === "auto" ? "เขียนสั้น ๆ ได้ AI จะช่วยแตกเป็นฉาก" : "เป็นแกนเรื่อง ส่วนรายละเอียดแก้แยกรายฉากด้านล่าง"}><textarea className={styles.story} value={story} onChange={(e)=>setStory(e.target.value)} /></Field>
    </section>

    <section id="characters" className={styles.card}><Step n={2} title="ตัวละครและเสียง" desc="เลือกจากคลังหรือกำหนดเอง ถ้าไม่มีต้นฉบับให้ใส่รายละเอียดหน้าตาเพิ่ม" />
      <div className={styles.quickLinks}><Link href="/libraries#characters">＋ คลังตัวละคร</Link><Link href="/libraries#voices">♫ คลังเสียง</Link><Link href="/libraries#pets">◇ คลังสัตว์เลี้ยง</Link></div>
      <div className={styles.characterGrid}>{characters.map((c,i)=><article key={c.id} className={styles.characterCard}><header><b>{i+1}</b><strong>{c.name}</strong><label>↑ รูป<input hidden type="file" accept="image/*" onChange={(e)=>patchCharacter(c.id,{reference:e.target.files?.[0]?.name})}/></label></header>{c.reference?<small className={styles.fileTag}>{c.reference}</small>:null}<div className={styles.twoGrid}><Field label="ชื่อ"><input value={c.name} onChange={(e)=>patchCharacter(c.id,{name:e.target.value})}/></Field><Field label="เพศ"><select value={c.gender} onChange={(e)=>patchCharacter(c.id,{gender:e.target.value as Gender})}><option>หญิง</option><option>ชาย</option><option>ไม่ระบุ</option></select></Field><Field label="อายุ"><input type="number" value={c.age} onChange={(e)=>patchCharacter(c.id,{age:Number(e.target.value)})}/></Field><Field label="สัญชาติ"><input value={c.nationality} onChange={(e)=>patchCharacter(c.id,{nationality:e.target.value})}/></Field></div><Field label="คาแรกเตอร์ / บุคลิก"><input value={c.personality} onChange={(e)=>patchCharacter(c.id,{personality:e.target.value})}/></Field><Field label="เสียง"><div className={styles.voice}><select value={c.voice} onChange={(e)=>patchCharacter(c.id,{voice:e.target.value})}>{VOICES.map(([n,d])=><option key={n} value={n}>{n} — {d}</option>)}</select><button onClick={()=>playVoice(c)}>▶ ฟัง</button></div></Field><details><summary>＋ รายละเอียดเพิ่ม กรณีไม่มีต้นฉบับ</summary><div className={styles.twoGrid}><Field label="ผม"><input value={c.hair} onChange={(e)=>patchCharacter(c.id,{hair:e.target.value})}/></Field><Field label="ตา"><input value={c.eyes} onChange={(e)=>patchCharacter(c.id,{eyes:e.target.value})}/></Field><Field label="ปาก"><input value={c.mouth} onChange={(e)=>patchCharacter(c.id,{mouth:e.target.value})}/></Field><Field label="รูปร่าง / ส่วนสูง"><input value={c.body} onChange={(e)=>patchCharacter(c.id,{body:e.target.value})}/></Field></div></details></article>)}</div>
      <div className={styles.petRow}><Field label="สัตว์เลี้ยง / Creature"><select value={pet?"yes":"no"} onChange={(e)=>setPet(e.target.value==="yes")}><option value="no">ไม่มี</option><option value="yes">มี</option></select></Field>{pet?<Field label="รายละเอียด"><input value={petText} onChange={(e)=>setPetText(e.target.value)}/></Field>:null}</div>
    </section>

    <section id="scenes" className={styles.card}><Step n={3} title="แบ่งฉากและตั้งกล้อง" desc="ทุกฉากมีค่าของตัวเอง เพิ่ม/ลบได้ และไม่กระทบฉากอื่น" />
      <div className={styles.sceneTools}><span>รวม {scenes.length} ฉาก · ตั้งเวลาไว้ {sceneSeconds}s / เป้าหมาย {duration}s</span><div><button onClick={aiFill}>✦ AI ช่วยเติม</button><button onClick={addScene}>＋ เพิ่มฉาก</button></div></div>
      <div className={styles.sceneWorkspace}><aside>{scenes.map((s,i)=><button key={s.id} onClick={()=>setSelectedId(s.id)} className={selected?.id===s.id?styles.sceneActive:""}><b>{String(i+1).padStart(2,"0")}</b><span><strong>{s.title}</strong><small>{s.duration}s · {s.shot}</small></span></button>)}</aside>{selected?<div className={styles.sceneEditor}><div className={styles.sceneTitle}><input value={selected.title} onChange={(e)=>patchScene(selected.id,{title:e.target.value})}/><button onClick={()=>removeScene(selected.id)}>ลบฉาก</button></div><div className={styles.twoGrid}><Field label="เวลาในฉาก"><input type="number" min={1} value={selected.duration} onChange={(e)=>patchScene(selected.id,{duration:Number(e.target.value)})}/></Field><Field label="สถานที่"><input value={selected.location} onChange={(e)=>patchScene(selected.id,{location:e.target.value})}/></Field></div><Field label="เกิดอะไรขึ้นในฉากนี้"><textarea value={selected.story} onChange={(e)=>patchScene(selected.id,{story:e.target.value})}/></Field><div className={styles.castChoice}><span>ตัวละครในฉาก</span>{characters.map((c)=><button key={c.id} onClick={()=>toggleCast(c.id)} className={selected.cast.includes(c.id)?styles.castActive:""}>{c.name}</button>)}</div><div className={styles.cameraGrid}><Field label="Shot Type"><select value={selected.shot} onChange={(e)=>patchScene(selected.id,{shot:e.target.value})}>{SHOTS.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Camera Angle"><select value={selected.angle} onChange={(e)=>patchScene(selected.id,{angle:e.target.value})}>{ANGLES.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Lens"><select value={selected.lens} onChange={(e)=>patchScene(selected.id,{lens:e.target.value})}>{LENSES.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Movement"><select value={selected.movement} onChange={(e)=>patchScene(selected.id,{movement:e.target.value})}>{MOVEMENTS.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Camera Height"><input value={selected.height} onChange={(e)=>patchScene(selected.id,{height:e.target.value})}/></Field><Field label="Lighting"><input value={selected.lighting} onChange={(e)=>patchScene(selected.id,{lighting:e.target.value})}/></Field></div><div className={styles.twoGrid}><Field label="อารมณ์"><input value={selected.emotion} onChange={(e)=>patchScene(selected.id,{emotion:e.target.value})}/></Field><Field label="เสียง / SFX"><input value={selected.sound} onChange={(e)=>patchScene(selected.id,{sound:e.target.value})}/></Field></div><Field label="บทพูด"><textarea value={selected.dialogue} onChange={(e)=>patchScene(selected.id,{dialogue:e.target.value})}/></Field>{mode==="pro"?<div className={styles.proNote}>Director Pro: ขั้นต่อไปจะเปิด Focus, DOF, Composition, Foreground Occlusion และหลาย Shot ภายในฉาก โดยยังคงอยู่ในฉากเดียว ไม่ต้องย้ายหน้า</div>:null}</div>:null}</div>
    </section>

    <section id="review" className={styles.card}><Step n={4} title="ตรวจและสร้าง" desc="ดูสรุปก่อนส่ง AI Prompt Director หรือ Video Provider" /><div className={styles.reviewGrid}><div><b>โหมด</b><span>{modeInfo.name}</span></div><div><b>โมเดล</b><span>{model}</span></div><div><b>เวลา</b><span>{duration}s</span></div><div><b>ฉาก</b><span>{scenes.length}</span></div><div><b>ตัวละคร</b><span>{characters.length}</span></div><div><b>สไตล์</b><span>{style}</span></div></div><div className={styles.finalActions}><button className={styles.secondary} onClick={buildPrompt}>✦ สร้าง Prompt</button><button className={styles.primary} onClick={()=>setStatus("พร้อมส่ง AI + Video Provider เมื่อเชื่อม API")}>▶ สร้างคลิปเลย</button></div></section>
    {prompt?<section className={styles.prompt}><header><b>Prompt Preview</b><button onClick={()=>navigator.clipboard?.writeText(prompt)}>คัดลอก</button></header><pre>{prompt}</pre></section>:null}
  </main>;
}
