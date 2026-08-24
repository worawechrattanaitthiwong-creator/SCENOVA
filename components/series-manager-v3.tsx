"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./series-manager-v3.module.css";
import {
  CAMERA_ANGLES, CAMERA_HEIGHTS, CAMERA_MOVEMENTS, CAMERA_SPEEDS, COLOR_TEMPERATURES,
  COMPOSITION_OPTIONS, DOF_OPTIONS, EMOTIONS, FOCUS_OPTIONS, LENSES, LIGHTING_STYLES,
  LOCATION_PRESETS, OBJECTIVE_PRESETS, PERFORMANCE_OPTIONS, SCENE_BEATS, SHOT_TYPES,
  SOUND_PRESETS, TRANSITIONS, type ProductionChoice,
} from "@/lib/production-options";

type EpisodeStatus = "draft" | "ready" | "completed";
type SeriesScene = {
  id: string; title: string; duration: number; action: string; location: string; objective: string; beat: string; transition: string;
  shot: string; angle: string; lens: string; movement: string; height: string; lighting: string; emotion: string; dialogue: string; sound: string;
  focus: string; dof: string; composition: string; cameraSpeed: string; performance: string; colorTemp: string; continuityNote: string;
};
type EpisodeRecord = {
  id: string; number: number; title: string; duration: number; synopsis: string; continuityStart: string; endingState: string;
  status: EpisodeStatus; scenes: SeriesScene[]; createdAt: string; updatedAt: string;
};
type SeriesRecord = {
  title: string; premise: string; model: string; visualStyle: string; aspect: string; canonRules: string; characterBible: string;
  locks: string[]; updatedAt: string; episodes: EpisodeRecord[];
};
type VideoItem = { id: string; ep: number; epTitle: string; projectTitle: string; duration: number; createdAt: string; url?: string; status: "completed" | "processing" };

const SERIES_KEY = "scenova-series-workspace-v3";
const LEGACY_KEY = "scenova-series-history-v1";
const VIDEO_KEY = "scenova-video-library-v1";
const DURATIONS = [10, 15, 30, 60, 90, 120, 150, 180];
const MODELS = ["Seedance 2.5", "Kling", "Veo", "Runway", "Wan"];
const STYLES = ["Cinematic Anime — อนิเมะภาพยนตร์", "Photorealistic Film — สมจริงแบบภาพยนตร์", "Warm Golden Hour — อบอุ่นแสงทอง", "Action Blockbuster — แอ็กชันบล็อกบัสเตอร์", "Sci-Fi Neon — ไซไฟนีออน", "Fantasy Storybook — แฟนตาซีภาพเล่าเรื่อง"];

function createScene(index: number, duration = 6, continuity = ""): SeriesScene {
  return {
    id: `ss_${Date.now()}_${index}_${Math.random().toString(36).slice(2,6)}`, title: `Scene ${String(index).padStart(2,"0")}`, duration,
    action: index === 1 ? "เปิด Episode โดยยืนยันสถานะจากตอนก่อน แล้วพาเรื่องเดินหน้าด้วยเหตุการณ์ใหม่" : "กำหนดเหตุการณ์ของ Scene นี้และจบด้วยแรงส่งไป Scene ถัดไป",
    location: "Japanese Suburban Alley", objective: index === 1 ? "Establish World" : "Reveal Information", beat: index === 1 ? "Opening" : "Turn", transition: "Hard Cut",
    shot: "Medium", angle: "Eye Level", lens: "50mm", movement: "Static", height: "Eye", lighting: "Natural Soft", emotion: "Natural",
    dialogue: "", sound: "Natural Ambience", focus: "Auto Subject", dof: "Natural", composition: "Rule of Thirds", cameraSpeed: "Normal",
    performance: "Natural", colorTemp: "Neutral 4500K", continuityNote: continuity || "รักษา Character Identity, Costume, Voice, Props, Screen Direction, Lighting และ Story State จาก Scene ก่อนหน้า",
  };
}

function createEpisode(number: number, previous?: EpisodeRecord): EpisodeRecord {
  const now = new Date().toISOString();
  const continuityStart = previous ? previous.endingState || previous.synopsis : "Episode แรก: เริ่มจาก Series Bible และ Character Bible โดยไม่มีเหตุการณ์ก่อนหน้า";
  const first = createScene(1, 6, continuityStart);
  if (previous?.scenes?.length) {
    const last = previous.scenes[previous.scenes.length - 1];
    Object.assign(first, { location:last.location, shot:last.shot, angle:last.angle, lens:last.lens, movement:last.movement, height:last.height, lighting:last.lighting, colorTemp:last.colorTemp });
  }
  return {
    id:`episode_${Date.now()}_${number}`, number, title:number===1?"Episode 01":"Episode "+String(number).padStart(2,"0"), duration:previous?.duration??30,
    synopsis:previous?`ดำเนินเรื่องต่อจาก Episode ${String(previous.number).padStart(2,"0")} โดยเริ่มจากสถานะท้ายตอนก่อนและสร้าง Conflict/Goal ใหม่ที่ต่อเนื่องกัน` : "กำหนดเหตุการณ์หลักของ Episode แรก และวางจุดจบที่ชัดเจนเพื่อใช้ต่อ Episode ถัดไป",
    continuityStart, endingState:"ระบุให้ชัดว่าเมื่อ Episode จบ ตัวละครแต่ละคนอยู่ที่ไหน อารมณ์อย่างไร ใครรู้อะไร มี Prop ใดอยู่กับใคร และเหตุการณ์ค้างตรงไหน",
    status:"draft", scenes:[first, createScene(2,6), createScene(3,6)], createdAt:now, updatedAt:now,
  };
}

const DEFAULT_SERIES: SeriesRecord = {
  title:"Untitled Series", premise:"กำหนดแกนเรื่องหลักของ Series เพื่อให้ทุก Episode เดินไปในทิศทางเดียวกัน", model:"Seedance 2.5", visualStyle:STYLES[0], aspect:"9:16 — Vertical",
  canonRules:"ห้ามเปลี่ยนชื่อ ตัวตน ความสัมพันธ์ และข้อเท็จจริงสำคัญโดยไม่มีเหตุผลในเนื้อเรื่อง", characterBible:"บันทึกลักษณะตัวละคร อายุ รูปลักษณ์ เสื้อผ้าหลัก บุคลิก เสียง เป้าหมาย และความสัมพันธ์",
  locks:["Character","Voice","Visual Style","Canon","Costume"], updatedAt:new Date().toISOString(), episodes:[createEpisode(1)],
};

function ChoiceField({label,value,options,onChange}:{label:string;value:string;options:ProductionChoice[];onChange:(v:string)=>void}) {
  const match=options.find(o=>o.value===value);
  return <label className={styles.field}><span>{label}</span><select value={match?value:"__custom"} onChange={e=>e.target.value!=="__custom"&&onChange(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}<option value="__custom">Custom — กำหนดเอง</option></select><input value={match?"":value} onChange={e=>onChange(e.target.value)} placeholder="หรือพิมพ์เอง (Custom)"/><small>{match?.help||"เลือก Preset หรือพิมพ์ค่าที่ต้องการเอง"}</small></label>;
}

export default function SeriesManagerV3(){
  const [series,setSeries]=useState<SeriesRecord>(DEFAULT_SERIES);
  const [selectedEpisodeId,setSelectedEpisodeId]=useState(DEFAULT_SERIES.episodes[0].id);
  const [selectedSceneId,setSelectedSceneId]=useState(DEFAULT_SERIES.episodes[0].scenes[0].id);
  const [hydrated,setHydrated]=useState(false);
  const [message,setMessage]=useState("Series Workspace พร้อมใช้งาน — เริ่มจาก Series Bible แล้วทำทีละ Episode");

  useEffect(()=>{try{
    const raw=localStorage.getItem(SERIES_KEY);
    if(raw){const parsed=JSON.parse(raw) as SeriesRecord;if(parsed.episodes?.length){setSeries(parsed);const ep=parsed.episodes[parsed.episodes.length-1];setSelectedEpisodeId(ep.id);setSelectedSceneId(ep.scenes?.[0]?.id||"");}}
    else {const legacy=localStorage.getItem(LEGACY_KEY);if(legacy){const old=JSON.parse(legacy);if(old?.projectTitle){setSeries(current=>({...current,title:old.projectTitle}));}}}
  }catch{setMessage("อ่าน Series History เดิมไม่สำเร็จ จึงเปิด Workspace ใหม่");}finally{setHydrated(true);}},[]);
  useEffect(()=>{if(hydrated)localStorage.setItem(SERIES_KEY,JSON.stringify(series));},[series,hydrated]);

  const episode=useMemo(()=>series.episodes.find(ep=>ep.id===selectedEpisodeId)??series.episodes[0],[series,selectedEpisodeId]);
  const scene=useMemo(()=>episode.scenes.find(s=>s.id===selectedSceneId)??episode.scenes[0],[episode,selectedSceneId]);
  const used=useMemo(()=>episode.scenes.reduce((sum,s)=>sum+s.duration,0),[episode.scenes]);
  const remaining=Math.max(0,episode.duration-used);
  const lastEpisode=series.episodes[series.episodes.length-1];
  const previousEpisode=series.episodes.find(ep=>ep.number===episode.number-1);
  const statusLabel:Record<EpisodeStatus,string>={draft:"กำลังวางแผน",ready:"พร้อม Production",completed:"Completed"};
  const continuityScore=Math.min(100,[series.premise,series.canonRules,series.characterBible,episode.continuityStart,episode.endingState,...episode.scenes.map(s=>s.continuityNote)].filter(v=>String(v).trim().length>8).length*12);

  function patchSeries(patch:Partial<SeriesRecord>){setSeries(current=>({...current,...patch,updatedAt:new Date().toISOString()}));}
  function patchEpisode(patch:Partial<EpisodeRecord>){setSeries(current=>({...current,updatedAt:new Date().toISOString(),episodes:current.episodes.map(ep=>ep.id===episode.id?{...ep,...patch,updatedAt:new Date().toISOString()}:ep)}));}
  function patchScene(patch:Partial<SeriesScene>){patchEpisode({scenes:episode.scenes.map(s=>s.id===scene.id?{...s,...patch}:s)});}
  function addScene(){if(remaining<1)return setMessage("เพิ่ม Scene ไม่ได้ เพราะใช้เวลาครบ Target Duration แล้ว");const next=createScene(episode.scenes.length+1,Math.min(6,remaining),scene.continuityNote);patchEpisode({scenes:[...episode.scenes,next]});setSelectedSceneId(next.id);}
  function removeScene(){if(episode.scenes.length<=1)return;const next=episode.scenes.filter(s=>s.id!==scene.id);patchEpisode({scenes:next});setSelectedSceneId(next[0].id);}
  function setDuration(value:number){const other=used-scene.duration;patchScene({duration:Math.max(1,Math.min(value,episode.duration-other))});}
  function createNext(){if(lastEpisode.status!=="completed")return setMessage(`ต้อง Completed Episode ${String(lastEpisode.number).padStart(2,"0")} ก่อน จึงสร้างตอนถัดไปได้`);const next=createEpisode(lastEpisode.number+1,lastEpisode);setSeries(current=>({...current,updatedAt:new Date().toISOString(),episodes:[...current.episodes,next]}));setSelectedEpisodeId(next.id);setSelectedSceneId(next.scenes[0].id);setMessage(`สร้าง Episode ${String(next.number).padStart(2,"0")} แล้ว ระบบ Carry Forward Ending State และ Camera/Lighting จากตอนก่อนมาเป็นจุดเริ่มต้น`);}
  function markReady(){patchEpisode({status:"ready"});setMessage("Episode นี้พร้อม Production แล้ว ตรวจ Continuity Score และ Scene Timing ก่อน Render");}
  function complete(){const now=new Date().toISOString();patchEpisode({status:"completed",updatedAt:now});try{const raw=localStorage.getItem(VIDEO_KEY);const items=raw?JSON.parse(raw) as VideoItem[]:[];const video:VideoItem={id:`video_${episode.id}`,ep:episode.number,epTitle:episode.title,projectTitle:series.title,duration:episode.duration,createdAt:now,url:`/api/mock-video?ep=${episode.number}`,status:"completed"};localStorage.setItem(VIDEO_KEY,JSON.stringify([video,...items.filter(i=>i.id!==video.id)]));window.dispatchEvent(new Event("scenova-video-library-updated"));}catch{}setMessage("Episode Completed — Ending State ถูกล็อกไว้เพื่อสร้าง Episode ถัดไป และรายการส่งไป Video Library แล้ว");}
  function aiContinuity(){const previous=previousEpisode?.endingState||series.premise;patchEpisode({continuityStart:`เริ่มจาก Canon เดิม: ${previous}\nรักษา Character / Voice / Costume / Props / Location State และความสัมพันธ์เดิมทั้งหมดก่อนเพิ่มเหตุการณ์ใหม่`,endingState:`บันทึกตอนจบให้ครบ: ตำแหน่งตัวละคร, อารมณ์, ความสัมพันธ์, สิ่งที่ตัวละครรู้, Prop ที่ถืออยู่, Location, เวลาในเรื่อง และ Hook สำหรับ Episode ${String(episode.number+1).padStart(2,"0")}`});setMessage("AI Continuity Assist เติมโครง Carry Forward ให้แล้ว กรุณาปรับรายละเอียดให้ตรงกับเนื้อเรื่องจริง");}

  return <main className={styles.main}>
    <header className={styles.hero}><div><span>SCENOVA SERIES PRODUCTION</span><h1>Series Continuity Workspace</h1><p>โหมดสำหรับงานหลาย Episode ที่ต้องรักษาเรื่อง ตัวละคร ภาพ เสียง และ Camera Language ให้ต่อเนื่องที่สุด พร้อม Scene Direction ระดับเดียวกับ Studio</p></div><div className={styles.heroActions}><Link href="/libraries?tab=videos">Video Library</Link><button onClick={createNext} disabled={lastEpisode.status!=="completed"}>＋ Next Episode</button></div></header>

    <section className={styles.guide}><div className={styles.guideHead}><b>วิธีใช้งาน Series แบบง่าย</b><span>ทำตาม 4 ขั้นนี้ ระบบจะพยายามรักษา Continuity ให้มากที่สุด</span></div><div className={styles.guideGrid}><article><b>1</b><strong>ตั้ง Series Bible</strong><span>กำหนดแกนเรื่อง Character Bible, Canon Rules, Model และ Visual Style เพียงครั้งเดียว</span></article><article><b>2</b><strong>ทำทีละ Episode</strong><span>เขียน Synopsis และตรวจ Continuity Start ที่ดึงจาก Ending State ของตอนก่อน</span></article><article><b>3</b><strong>กำกับ Scene</strong><span>ปรับเวลา Shot, Angle, Lens, Movement, Lighting, Dialogue และ Sound ได้เหมือน Studio</span></article><article><b>4</b><strong>ล็อก Ending State</strong><span>ก่อน Complete ให้บันทึกสถานะตอนจบให้ครบ เพื่อเป็นจุดเริ่ม Episode ถัดไปโดยอัตโนมัติ</span></article></div></section>

    <section className={styles.bible}><div className={styles.sectionTitle}><div><span>SERIES BIBLE</span><h2>ข้อมูลกลางที่ทุก Episode ต้องยึด</h2></div><div className={styles.score}><span>Continuity Health</span><b>{continuityScore}%</b></div></div><div className={styles.four}><label><span>Series Title — ชื่อ Series</span><input value={series.title} onChange={e=>patchSeries({title:e.target.value})}/><small>ชื่อกลางของงานทั้งหมด</small></label><label><span>Video Model — โมเดลหลัก</span><select value={series.model} onChange={e=>patchSeries({model:e.target.value})}>{MODELS.map(v=><option key={v}>{v}</option>)}</select><small>ใช้ Model เดียวกันช่วยลดความเสี่ยง Character Drift</small></label><label><span>Visual Style — สไตล์ภาพหลัก</span><select value={series.visualStyle} onChange={e=>patchSeries({visualStyle:e.target.value})}>{STYLES.map(v=><option key={v}>{v}</option>)}</select><small>ใช้เป็น Master Style Lock ของ Series</small></label><label><span>Aspect Ratio — อัตราส่วนภาพ</span><select value={series.aspect} onChange={e=>patchSeries({aspect:e.target.value})}><option>9:16 — Vertical</option><option>16:9 — Widescreen</option><option>1:1 — Square</option><option>4:5 — Portrait</option></select><small>ใช้รูปแบบเดียวกันตลอด Series เมื่อเป็นไปได้</small></label></div><div className={styles.two}><label><span>Series Premise — แกนเรื่อง</span><textarea value={series.premise} onChange={e=>patchSeries({premise:e.target.value})}/><small>เป้าหมายใหญ่ของเรื่องและสิ่งที่ไม่ควรหลุดออกนอกแกน</small></label><label><span>Character Bible — ข้อมูลตัวละครกลาง</span><textarea value={series.characterBible} onChange={e=>patchSeries({characterBible:e.target.value})}/><small>เก็บรูปลักษณ์ บุคลิก ความสัมพันธ์ Voice และเป้าหมาย เพื่อรักษาตัวตนข้าม Episode</small></label></div><label className={styles.full}><span>Canon Rules — กฎของโลกและข้อเท็จจริงที่ห้ามขัดกัน</span><textarea value={series.canonRules} onChange={e=>patchSeries({canonRules:e.target.value})}/></label><div className={styles.locks}>{["Character","Voice","Visual Style","Canon","Costume","Location","Props","Camera Language","Lighting"].map(lock=><label key={lock}><input type="checkbox" checked={series.locks.includes(lock)} onChange={e=>patchSeries({locks:e.target.checked?[...series.locks,lock]:series.locks.filter(v=>v!==lock)})}/><span>{lock} Lock</span></label>)}</div></section>

    <section id="history" className={styles.history}><div className={styles.sectionTitle}><div><span>SERIES HISTORY</span><h2>Episode Timeline</h2></div><span>{series.episodes.length} Episodes • บันทึกอัตโนมัติ</span></div><div className={styles.historyRail}>{series.episodes.map(ep=><button key={ep.id} className={ep.id===episode.id?styles.activeEpisode:""} onClick={()=>{setSelectedEpisodeId(ep.id);setSelectedSceneId(ep.scenes[0]?.id||"")}}><span>EPISODE {String(ep.number).padStart(2,"0")}</span><b>{ep.title}</b><small>{ep.duration}s • {statusLabel[ep.status]}</small></button>)}</div></section>

    <section id="episode-editor" className={styles.episodeGrid}><article className={styles.card}><div className={styles.cardHead}><div><span>EPISODE CONTROL</span><h2>Episode {String(episode.number).padStart(2,"0")}</h2></div><strong data-status={episode.status}>{statusLabel[episode.status]}</strong></div><label><span>Episode Title — ชื่อตอน</span><input value={episode.title} onChange={e=>patchEpisode({title:e.target.value})}/></label><div className={styles.two}><label><span>Target Duration — เวลาตอน</span><select value={episode.duration} onChange={e=>patchEpisode({duration:Number(e.target.value)})}>{DURATIONS.map(v=><option key={v} value={v}>{v<60?`${v} วินาที`:`${v/60} นาที`}</option>)}</select><small>เวลารวม Scene ต้องไม่เกินค่านี้</small></label><label><span>Episode Status — สถานะ</span><input value={statusLabel[episode.status]} readOnly/><small>Complete แล้วจึงเปิด Episode ถัดไปได้</small></label></div><label><span>Episode Synopsis — เหตุการณ์หลักของตอน</span><textarea value={episode.synopsis} onChange={e=>patchEpisode({synopsis:e.target.value})}/><small>ระบุ Goal, Conflict, การเปลี่ยนแปลง และสิ่งที่ต้องเกิดใน Episode นี้</small></label><div className={styles.actions}><button onClick={markReady}>✓ Mark Ready</button><button className={styles.primary} onClick={complete}>Complete Episode</button></div></article>

      <article id="continuity" className={styles.card}><div className={styles.cardHead}><div><span>CONTINUITY CORE</span><h2>เชื่อมเรื่องระหว่าง Episode</h2></div><button onClick={aiContinuity}>✦ AI Continuity Assist</button></div>{previousEpisode?<div className={styles.previous}><b>Ending State จาก Episode {String(previousEpisode.number).padStart(2,"0")}</b><p>{previousEpisode.endingState}</p></div>:<div className={styles.previous}><b>Episode แรก</b><p>ใช้ Series Bible เป็นจุดเริ่มต้น ไม่มี Episode ก่อนหน้า</p></div>}<label><span>Continuity Start — สถานะที่ต้องรับต่อ</span><textarea value={episode.continuityStart} onChange={e=>patchEpisode({continuityStart:e.target.value})}/><small>ระบบจะใช้ข้อมูลนี้เป็น Hard Context ก่อนสร้าง Scene แรก เพื่อไม่ให้เหตุการณ์ย้อนแย้ง</small></label><label><span>Ending State — สถานะตอนจบสำหรับตอนถัดไป</span><textarea value={episode.endingState} onChange={e=>patchEpisode({endingState:e.target.value})}/><small>ควรระบุ Location, Character State, Costume, Props, Emotion, Story Knowledge, Relationship, Time และ Hook ให้ครบ</small></label></article></section>

    <section id="scene-direction" className={styles.sceneSection}><div className={styles.sectionTitle}><div><span>SCENE DIRECTION</span><h2>Camera, Image, Dialogue & Sound ต่อ Scene</h2></div><div><b>{used}/{episode.duration}s</b><span>{remaining}s remaining</span></div></div><div className={styles.timeline}>{episode.scenes.map((s,i)=><button key={s.id} className={s.id===scene.id?styles.activeScene:""} onClick={()=>setSelectedSceneId(s.id)} style={{flexGrow:Math.max(1,s.duration)}}><b>{i+1}</b><span>{s.duration}s</span></button>)}</div><div className={styles.sceneTools}><span>Scene ทุกตัวใช้ Preset ภาษาไทย + Custom ได้เหมือน Studio</span><button onClick={addScene}>＋ Add Scene</button></div><div className={styles.sceneWorkspace}><aside>{episode.scenes.map((s,i)=><button key={s.id} className={s.id===scene.id?styles.activeList:""} onClick={()=>setSelectedSceneId(s.id)}><b>{String(i+1).padStart(2,"0")}</b><span><strong>{s.title}</strong><small>{s.shot} • {s.lens}</small></span></button>)}</aside><div className={styles.sceneEditor}><div className={styles.sceneTitle}><input value={scene.title} onChange={e=>patchScene({title:e.target.value})}/><button onClick={removeScene}>Delete Scene</button></div><div className={styles.durationBox}><div><b>Scene Duration — เวลาของ Scene</b><strong>{scene.duration}s</strong></div><input type="range" min={1} max={Math.max(1,scene.duration+remaining)} value={scene.duration} onChange={e=>setDuration(Number(e.target.value))}/><small>ระบบป้องกันไม่ให้เวลารวมเกิน {episode.duration} วินาที</small></div><div className={styles.three}><ChoiceField label="Location — สถานที่" value={scene.location} options={LOCATION_PRESETS} onChange={v=>patchScene({location:v})}/><ChoiceField label="Scene Objective — เป้าหมาย Scene" value={scene.objective} options={OBJECTIVE_PRESETS} onChange={v=>patchScene({objective:v})}/><ChoiceField label="Scene Beat — จังหวะเรื่อง" value={scene.beat} options={SCENE_BEATS} onChange={v=>patchScene({beat:v})}/></div><label><span>Scene Action / Narrative — เหตุการณ์ใน Scene</span><textarea value={scene.action} onChange={e=>patchScene({action:e.target.value})}/><small>เขียน Action และ Narrative เองได้เต็มที่ โดยควรต่อจาก Continuity Note และ Scene ก่อนหน้า</small></label><div className={styles.three}><ChoiceField label="Shot Type — ระยะภาพ" value={scene.shot} options={SHOT_TYPES} onChange={v=>patchScene({shot:v})}/><ChoiceField label="Camera Angle — มุมกล้อง" value={scene.angle} options={CAMERA_ANGLES} onChange={v=>patchScene({angle:v})}/><ChoiceField label="Lens — ระยะเลนส์" value={scene.lens} options={LENSES} onChange={v=>patchScene({lens:v})}/><ChoiceField label="Movement — การเคลื่อนกล้อง" value={scene.movement} options={CAMERA_MOVEMENTS} onChange={v=>patchScene({movement:v})}/><ChoiceField label="Camera Height — ความสูงกล้อง" value={scene.height} options={CAMERA_HEIGHTS} onChange={v=>patchScene({height:v})}/><ChoiceField label="Lighting — รูปแบบแสง" value={scene.lighting} options={LIGHTING_STYLES} onChange={v=>patchScene({lighting:v})}/><ChoiceField label="Emotion — อารมณ์" value={scene.emotion} options={EMOTIONS} onChange={v=>patchScene({emotion:v})}/><ChoiceField label="Sound / Ambience — เสียง" value={scene.sound} options={SOUND_PRESETS} onChange={v=>patchScene({sound:v})}/><ChoiceField label="Transition — การเชื่อม Scene" value={scene.transition} options={TRANSITIONS} onChange={v=>patchScene({transition:v})}/></div><details><summary>Advanced Direction — กล้องและการแสดงระดับ Pro</summary><div className={styles.three}><ChoiceField label="Focus — จุดโฟกัส" value={scene.focus} options={FOCUS_OPTIONS} onChange={v=>patchScene({focus:v})}/><ChoiceField label="Depth of Field — ชัดตื้น/ชัดลึก" value={scene.dof} options={DOF_OPTIONS} onChange={v=>patchScene({dof:v})}/><ChoiceField label="Composition — องค์ประกอบภาพ" value={scene.composition} options={COMPOSITION_OPTIONS} onChange={v=>patchScene({composition:v})}/><ChoiceField label="Camera Speed — ความเร็วกล้อง" value={scene.cameraSpeed} options={CAMERA_SPEEDS} onChange={v=>patchScene({cameraSpeed:v})}/><ChoiceField label="Performance — ระดับการแสดง" value={scene.performance} options={PERFORMANCE_OPTIONS} onChange={v=>patchScene({performance:v})}/><ChoiceField label="Color Temperature — อุณหภูมิสี" value={scene.colorTemp} options={COLOR_TEMPERATURES} onChange={v=>patchScene({colorTemp:v})}/></div></details><div className={styles.two}><label><span>Dialogue — บทพูด</span><textarea value={scene.dialogue} onChange={e=>patchScene({dialogue:e.target.value})}/><small>ระบุ Character: Dialogue และรักษา Voice/Personality ตาม Character Bible</small></label><label><span>Continuity Note — สิ่งที่ Scene ถัดไปต้องรับต่อ</span><textarea value={scene.continuityNote} onChange={e=>patchScene({continuityNote:e.target.value})}/><small>สำคัญมากสำหรับ Series: Position, Costume, Prop, Emotion, Camera Direction, Lighting และ Story State</small></label></div></div></div></section>

    <section className={styles.rule}><b>กติกาเพื่อ Continuity ที่ดีที่สุด</b><span>ใช้ Series Bible เดิมตลอดงาน</span><span>ทำทีละ Episode และ Complete ก่อนเปิดตอนถัดไป</span><span>Ending State ต้องครบก่อน Complete</span><span>Scene แรกของตอนใหม่ Carry Forward Camera/Lighting จาก Scene สุดท้ายเดิม</span><span>Character / Voice / Visual Style / Canon Lock ควรเปิดไว้เป็นค่าเริ่มต้น</span></section>
  </main>;
}
