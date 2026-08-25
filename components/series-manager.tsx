"use client";

import { useMemo, useState } from "react";
import { createNextEpisode, createTimelineSegments, resizeEpisode, validateTimeline } from "@/lib/episode-engine";
import type { EpisodeDuration, Project } from "@/lib/domain";
import { SAMPLE_PROJECT } from "@/lib/sample-project";

const durations: EpisodeDuration[] = [10, 15, 30, 60, 90, 120, 150, 180];

export default function SeriesManager() {
  const [project, setProject] = useState<Project>(() => JSON.parse(JSON.stringify(SAMPLE_PROJECT)) as Project);
  const [selected, setSelected] = useState(0);
  const episode = project.episodes[selected] ?? project.episodes[0];
  const validation = useMemo(() => validateTimeline(episode), [episode]);

  const addEpisode = () => {
    const next = createNextEpisode(project, { duration: episode.duration });
    setProject((current) => ({ ...current, episodes: [...current.episodes, next] }));
    setSelected(project.episodes.length);
  };

  const updateEpisode = (patch: Partial<typeof episode>) => {
    setProject((current) => ({ ...current, episodes: current.episodes.map((item, index) => (index === selected ? { ...item, ...patch } : item)) }));
  };

  const changeDuration = (value: EpisodeDuration) => {
    setProject((current) => ({ ...current, episodes: current.episodes.map((item, index) => (index === selected ? resizeEpisode(item, value) : item)) }));
  };

  return (
    <div className="content" style={{ maxWidth: 1250 }}>
      <div className="page-head">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><h1>Series & Episode Manager</h1><p>กำหนดจำนวน EP หรือสร้างแบบต่อเนื่องทีละตอน แต่ละ EP ยาว 10 วินาทีถึง 3 นาที และยึด Project Bible / Character Lock / Style Lock เดิมของโปรเจกต์</p></div>
          <a href="/" className="btn">← กลับ Studio</a>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title"><div><h2>ตอนทั้งหมด (Episodes)</h2><p>กด “สร้างตอนถัดไป” เมื่อต้องการ ระบบไม่ Generate ตอนใหม่เองจนกว่าผู้ใช้จะสั่ง</p></div><button className="btn btn-primary" onClick={addEpisode}>+ สร้างตอนถัดไป</button></div>
          <div className="stack">
            {project.episodes.map((item, index) => (
              <button key={item.id} className={`model-card ${selected === index ? "selected" : ""}`} style={{ textAlign: "left" }} onClick={() => setSelected(index)}>
                <div className="row" style={{ justifyContent: "space-between" }}><h3>EP.{String(item.number).padStart(2, "0")} — {item.title}</h3><span className="badge">{item.duration}s</span></div>
                <p>{item.synopsis}</p>
                <span className={`badge ${item.status === "completed" ? "good" : ""}`}>{item.status}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title"><div><h2>ตั้งค่า EP.{String(episode.number).padStart(2, "0")}</h2><p>แก้ชื่อ ความยาว และ Story Plan ของตอนนี้ได้โดยไม่เปลี่ยนตอนอื่น</p></div></div>
          <label className="label">ชื่อตอน</label>
          <input className="input" value={episode.title} onChange={(e) => updateEpisode({ title: e.target.value })} />
          <div className="help">ⓘ ชื่อตอนใช้ใน Dashboard และ Prompt Header สามารถให้ AI ช่วยตั้งภายหลังได้</div>
          <div style={{ height: 14 }} />
          <label className="label">ความยาวตอน</label>
          <select className="select" value={episode.duration} onChange={(e) => changeDuration(Number(e.target.value) as EpisodeDuration)}>
            {durations.map((value) => <option key={value} value={value}>{value < 60 ? `${value} วินาที` : `${value / 60} นาที`}</option>)}
          </select>
          <div className="help">ⓘ เมื่อเปลี่ยนเวลา ระบบจะปรับ Timeline เดิมตามสัดส่วน ส่วน Render Planner จะแตกเป็น Generation Jobs ตามความยาวสูงสุดของโมเดลภายหลัง</div>
          <div style={{ height: 14 }} />
          <label className="label">เรื่องย่อ / แผนตอน</label>
          <textarea className="textarea" value={episode.synopsis} onChange={(e) => updateEpisode({ synopsis: e.target.value })} />
        </div>
      </div>

      <div className="card">
        <div className="card-title"><div><h2>Timeline Coverage</h2><p>Timeline ต้องครอบคลุมตั้งแต่ 0 ถึงเวลาจบ EP โดยไม่มีช่องว่าง เพื่อให้ Generate/ต่อคลิปได้ครบตามเวลาที่ผู้ใช้เลือก</p></div><span className={`badge ${validation.valid ? "good" : "warn"}`}>{validation.valid ? "✓ Timeline ถูกต้อง" : "⚠ ต้องแก้ Timeline"}</span></div>
        {!validation.valid && <div className="notice">{validation.errors.join(" · ")}</div>}
        <div className="timeline-ruler">{[0,1,2,3,4,5,6].map((n) => <span key={n}>{Math.round((episode.duration / 6) * n)}s</span>)}</div>
        <div className="timeline-track">
          {episode.segments.map((segment) => <div key={segment.id} className="timeline-segment" style={{ left: `${segment.start / episode.duration * 100}%`, width: `${(segment.end - segment.start) / episode.duration * 100}%` }}><b>{segment.title}</b><span>{segment.start}–{segment.end}s</span></div>)}
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => updateEpisode({ segments: createTimelineSegments(episode.duration, 10) })}>แบ่งอัตโนมัติทุก 10 วิ</button>
          <button className="btn" onClick={() => updateEpisode({ segments: createTimelineSegments(episode.duration, 15) })}>แบ่งอัตโนมัติทุก 15 วิ</button>
          <button className="btn" onClick={() => updateEpisode({ segments: createTimelineSegments(episode.duration, 30) })}>แบ่งอัตโนมัติทุก 30 วิ</button>
        </div>
        <div className="help">ⓘ Auto Segment เป็นเพียงจุดเริ่มต้น ผู้ใช้ยังแก้เวลา Shot/Scene แบบ Custom ใน Time Segment Director ได้</div>
      </div>
    </div>
  );
}
