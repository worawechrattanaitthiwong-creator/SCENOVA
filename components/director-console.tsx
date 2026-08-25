"use client";

import { useMemo, useState } from "react";
import { DIRECTOR_PRESETS } from "@/lib/director-presets";
import { applyDirectorPreset } from "@/lib/director-engine";
import { createTimelineSegments, validateTimeline } from "@/lib/episode-engine";
import type { Episode, EpisodeDuration } from "@/lib/domain";

const durationOptions: EpisodeDuration[] = [10, 15, 30, 60, 90, 120, 150, 180];

function createEpisode(duration: EpisodeDuration): Episode {
  return {
    id: "director-demo",
    number: 1,
    title: "Custom Director Timeline",
    duration,
    synopsis: "ผู้ใช้กำหนดทุกช่วงเวลาเอง",
    status: "draft",
    segments: createTimelineSegments(duration, duration <= 30 ? 10 : 30),
  };
}

export default function DirectorConsole() {
  const [episode, setEpisode] = useState<Episode>(() => createEpisode(30));
  const [selectedSegmentId, setSelectedSegmentId] = useState(episode.segments[0]?.id ?? "");
  const selected = episode.segments.find((segment) => segment.id === selectedSegmentId) ?? episode.segments[0];
  const validation = useMemo(() => validateTimeline(episode), [episode]);

  const updateSelected = (patch: Partial<typeof selected>) => {
    setEpisode((current) => ({ ...current, segments: current.segments.map((segment) => (segment.id === selected.id ? { ...segment, ...patch } : segment)) }));
  };

  const setDuration = (duration: EpisodeDuration) => {
    const next = createEpisode(duration);
    setEpisode(next);
    setSelectedSegmentId(next.segments[0]?.id ?? "");
  };

  const applyPreset = (presetId: string) => {
    setEpisode((current) => ({
      ...current,
      segments: current.segments.map((segment) => (segment.id === selected.id ? applyDirectorPreset(segment, presetId) : segment)),
    }));
  };

  return (
    <div className="content" style={{ maxWidth: 1350 }}>
      <div className="page-head">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><h1>Director Console — กำกับละเอียดตามช่วงเวลา</h1><p>เหมาะกับผู้ใช้ที่ต้องการกำหนด 0–10 วิ, 10–20 วิ, 20–30 วิ หรือความยาว Custom พร้อม Action, Dialogue, Emotion, Lighting และหลายมุมกล้องแบบ Production</p></div>
          <a href="/" className="btn">← กลับ Studio</a>
        </div>
      </div>

      <div className="card">
        <div className="grid-3">
          <div><label className="label">ความยาววิดีโอ</label><select className="select" value={episode.duration} onChange={(e) => setDuration(Number(e.target.value) as EpisodeDuration)}>{durationOptions.map((value) => <option value={value} key={value}>{value < 60 ? `${value} วินาที` : `${value / 60} นาที`}</option>)}</select><div className="help">ⓘ 3 นาทีคือ Timeline 180 วินาที ส่วน Render Planner จะแบ่งเป็นงานย่อยตามโมเดลภายหลัง</div></div>
          <div><label className="label">แบ่งช่วงอัตโนมัติ</label><div className="row"><button className="btn" onClick={() => setEpisode((current) => ({ ...current, segments: createTimelineSegments(current.duration, 10) }))}>ทุก 10 วิ</button><button className="btn" onClick={() => setEpisode((current) => ({ ...current, segments: createTimelineSegments(current.duration, 15) }))}>ทุก 15 วิ</button><button className="btn" onClick={() => setEpisode((current) => ({ ...current, segments: createTimelineSegments(current.duration, 30) }))}>ทุก 30 วิ</button></div><div className="help">ⓘ ใช้เป็นโครงเริ่มต้น แล้วค่อย Custom รายช่วงได้</div></div>
          <div><label className="label">ความถูกต้อง Timeline</label><div className={`notice ${validation.valid ? "success" : ""}`}>{validation.valid ? "✓ ครบทุกช่วง ไม่มีช่องว่าง" : validation.errors.join(" · ")}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="timeline-ruler">{[0,1,2,3,4,5,6].map((n) => <span key={n}>{Math.round(episode.duration / 6 * n)}s</span>)}</div>
        <div className="timeline-track">{episode.segments.map((segment) => <button onClick={() => setSelectedSegmentId(segment.id)} key={segment.id} className="timeline-segment" style={{ left: `${segment.start / episode.duration * 100}%`, width: `${(segment.end-segment.start)/episode.duration*100}%`, cursor: "pointer", color: "white", textAlign: "left" }}><b>{segment.title}</b><span>{segment.start}–{segment.end}s</span></button>)}</div>
      </div>

      {selected && <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-title"><div><h2>{selected.start}–{selected.end}s · {selected.title}</h2><p>ทุกค่าด้านล่างเป็น Hard/Soft Constraint ที่ Prompt Composer ใช้ ไม่ใช่ข้อความก้อนตายตัว</p></div></div>
          <label className="label">ชื่อช่วง</label><input className="input" value={selected.title} onChange={(e) => updateSelected({ title: e.target.value })} />
          <div style={{ height: 10 }} />
          <label className="label">ฉาก / เหตุการณ์</label><textarea className="textarea" value={selected.scene} onChange={(e) => updateSelected({ scene: e.target.value })} />
          <div className="help">ⓘ ตัวอย่าง: “มิกิเดินไปหน้าประตู หยุดฟังเสียง แล้วหันกลับทางขวา”</div>
          <div style={{ height: 10 }} />
          <label className="label">Action / Blocking</label><textarea className="textarea" value={selected.action} onChange={(e) => updateSelected({ action: e.target.value })} />
          <div className="help">ⓘ Blocking คือการกำหนดว่าตัวละครยืน/เดิน/เคลื่อนจากตรงไหนไปตรงไหน</div>
          <div style={{ height: 10 }} />
          <label className="label">อารมณ์</label><input className="input" value={selected.emotion} onChange={(e) => updateSelected({ emotion: e.target.value })} />
          <div style={{ height: 10 }} />
          <label className="label">แสง</label><input className="input" value={selected.lighting} onChange={(e) => updateSelected({ lighting: e.target.value })} />
        </div>

        <div className="card">
          <div className="card-title"><div><h2>Director Presets</h2><p>กด Preset เพื่อวาง Shot Sequence อัตโนมัติ จากนั้นยังแก้ Lens/Angle/Movement ราย Shot ได้ใน Timeline Editor</p></div></div>
          <div className="stack">
            {DIRECTOR_PRESETS.map((preset) => <button className="model-card" style={{ textAlign: "left" }} key={preset.id} onClick={() => applyPreset(preset.id)}><div className="row" style={{ justifyContent: "space-between" }}><h3>{preset.nameTh}</h3><span className="badge">{preset.category}</span></div><p>{preset.descriptionTh}</p><div className="help">ลำดับ: {preset.shotSequence.map((shot) => `${shot.shotType} ${shot.lensMm}mm`).join(" → ")}</div></button>)}
          </div>
        </div>
      </div>}

      {selected && <div className="card">
        <div className="card-title"><div><h2>Camera Shots ของช่วงนี้</h2><p>ผลลัพธ์หลังเลือก Preset หรือแก้ Custom ระบบจะนำเวลาและกล้องแต่ละช็อตไปประกอบ Prompt โดยตรง</p></div><span className="badge">{selected.cameraShots.length} shots</span></div>
        <div className="grid-3">{selected.cameraShots.map((shot) => <div className="shot-card" key={shot.id}><span className="badge">{shot.start}–{shot.end}s</span><h3 style={{ marginBottom: 5 }}>{shot.shotType}</h3><div className="muted" style={{ fontSize: 12, lineHeight: 1.7 }}>{shot.angle}<br/>{shot.lensMm}mm · {shot.movement}<br/>ความสูง: {shot.cameraHeight}<br/>DOF: {shot.depthOfField}</div></div>)}</div>
      </div>}
    </div>
  );
}
