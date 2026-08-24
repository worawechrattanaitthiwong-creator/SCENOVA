"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./series-manager-v2.module.css";

type EpisodeStatus = "draft" | "ready" | "completed";
type EpisodeRecord = { id: string; number: number; title: string; duration: number; synopsis: string; continuity: string; endingState: string; status: EpisodeStatus; createdAt: string; updatedAt: string };
type SeriesRecord = { projectTitle: string; updatedAt: string; episodes: EpisodeRecord[] };
type VideoItem = { id: string; ep: number; epTitle: string; projectTitle: string; duration: number; createdAt: string; url?: string; status: "completed" | "processing" };

const SERIES_KEY = "scenova-series-history-v1";
const VIDEO_KEY = "scenova-video-library-v1";
const DURATIONS = [10, 15, 30, 60, 90, 120, 150, 180];

function newEpisode(number: number, previous?: EpisodeRecord): EpisodeRecord {
  const now = new Date().toISOString();
  return { id: `ep_${Date.now()}_${number}`, number, title: number === 1 ? "พบเพื่อนตัวเล็ก" : `Episode ${number}`, duration: previous?.duration ?? 30, synopsis: previous ? `ดำเนินเรื่องต่อจาก Episode ${String(previous.number).padStart(2, "0")} — ${previous.title}` : "เด็กหญิงพบสิ่งมีชีวิตลึกลับระหว่างทางกลับบ้าน และค่อย ๆ กลายเป็นเพื่อนกัน", continuity: previous ? `เริ่มต่อจากสถานะท้าย Episode ก่อน: ${previous.endingState || previous.synopsis}` : "Series Opening — กำหนดจุดเริ่มต้นของตัวละครและโลก", endingState: "ระบุว่าตอนนี้จบตรงไหน ตัวละครอยู่ที่ใด อารมณ์เป็นอย่างไร และมีอะไรต้องต่อใน Episode ถัดไป", status: "draft", createdAt: now, updatedAt: now };
}

const DEFAULT_SERIES: SeriesRecord = { projectTitle: "เด็กหญิงกับสิ่งมีชีวิตลึกลับ", updatedAt: new Date().toISOString(), episodes: [newEpisode(1)] };

export default function SeriesManagerV2() {
  const [series, setSeries] = useState<SeriesRecord>(DEFAULT_SERIES);
  const [selectedId, setSelectedId] = useState(DEFAULT_SERIES.episodes[0].id);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("Series History จะบันทึก Episode ที่กำลังทำไว้เพื่อกลับมาดำเนินการต่อ");

  useEffect(() => { try { const raw = localStorage.getItem(SERIES_KEY); if (raw) { const parsed = JSON.parse(raw) as SeriesRecord; if (parsed.episodes?.length) { setSeries(parsed); setSelectedId(parsed.episodes[parsed.episodes.length - 1].id); } } } catch { setMessage("Unable to read previous Series history. Preview data has been restored."); } finally { setHydrated(true); } }, []);
  useEffect(() => { if (!hydrated) return; localStorage.setItem(SERIES_KEY, JSON.stringify(series)); }, [series, hydrated]);

  const selected = useMemo(() => series.episodes.find((ep) => ep.id === selectedId) ?? series.episodes[0], [series, selectedId]);
  const lastEpisode = series.episodes[series.episodes.length - 1];
  const canCreateNext = lastEpisode.status === "completed";

  function patchSelected(patch: Partial<EpisodeRecord>) { const now = new Date().toISOString(); setSeries((current) => ({ ...current, updatedAt: now, episodes: current.episodes.map((ep) => ep.id === selected.id ? { ...ep, ...patch, updatedAt: now } : ep) })); }
  function createNextEpisode() { if (!canCreateNext) { setMessage(`Episode ${String(lastEpisode.number).padStart(2, "0")} ต้องเสร็จก่อนจึงเริ่ม Episode ถัดไปได้`); return; } const next = newEpisode(lastEpisode.number + 1, lastEpisode); setSeries((current) => ({ ...current, updatedAt: new Date().toISOString(), episodes: [...current.episodes, next] })); setSelectedId(next.id); setMessage(`Episode ${String(next.number).padStart(2, "0")} ถูกสร้างพร้อม Continuity จากตอนก่อนหน้า`); }
  function markReady() { patchSelected({ status: "ready" }); setMessage(`Episode ${String(selected.number).padStart(2, "0")} is ready for Studio / Render Queue`); }
  function completeEpisode() {
    const completedAt = new Date().toISOString(); patchSelected({ status: "completed", updatedAt: completedAt });
    try { const raw = localStorage.getItem(VIDEO_KEY); const items = raw ? JSON.parse(raw) as VideoItem[] : []; const video: VideoItem = { id: `video_${selected.id}`, ep: selected.number, epTitle: selected.title, projectTitle: series.projectTitle, duration: selected.duration, createdAt: completedAt, url: `/api/mock-video?ep=${selected.number}`, status: "completed" }; const nextItems = [video, ...items.filter((item) => item.id !== video.id)]; localStorage.setItem(VIDEO_KEY, JSON.stringify(nextItems)); window.dispatchEvent(new Event("scenova-video-library-updated")); } catch {}
    setMessage(`Episode ${String(selected.number).padStart(2, "0")} completed and added to Generated Episodes`);
  }

  const statusLabel: Record<EpisodeStatus, string> = { draft: "In Progress", ready: "Ready", completed: "Completed" };

  return <main className={styles.main}>
    <header className={styles.header}><div><span>SERIES WORKSPACE</span><h1>Series Production & Episode Continuity</h1><p>จัดการ Episode ต่อเนื่องภายใต้ Series เดียว เก็บ Synopsis, Continuity และ Ending State เพื่อให้กลับมาดำเนินงานต่อได้โดยไม่สูญเสีย Canon</p></div><div className={styles.headerActions}><Link href="/libraries?tab=videos">▶ Generated Episodes</Link><button onClick={createNextEpisode} disabled={!canCreateNext}>＋ New Episode</button></div></header>
    <div className={styles.message}>{message}</div>
    <section id="history" className={styles.historySection}><div className={styles.sectionHead}><div><span>SERIES HISTORY</span><h2>{series.projectTitle}</h2></div><div className={styles.projectMeta}>{series.episodes.length} Episodes · Updated {new Date(series.updatedAt).toLocaleString("th-TH")}</div></div><div className={styles.historyRail}>{series.episodes.map((ep) => <button key={ep.id} onClick={() => setSelectedId(ep.id)} className={selected.id === ep.id ? styles.activeEpisode : ""}><span className={styles.epNo}>EP.{String(ep.number).padStart(2, "0")}</span><b>{ep.title}</b><small>{ep.duration}s · {statusLabel[ep.status]}</small><em>{new Date(ep.updatedAt).toLocaleDateString("th-TH")}</em></button>)}</div></section>
    <section id="episode-editor" className={styles.editorGrid}>
      <article className={styles.card}><div className={styles.cardHead}><div><span>EPISODE WORKSPACE</span><h2>EP.{String(selected.number).padStart(2, "0")} — {selected.title}</h2></div><strong data-status={selected.status}>{statusLabel[selected.status]}</strong></div><label><span>Episode Title</span><input value={selected.title} onChange={(e) => patchSelected({ title: e.target.value })} /></label><div className={styles.twoCol}><label><span>Episode Duration</span><select value={selected.duration} onChange={(e) => patchSelected({ duration: Number(e.target.value) })}>{DURATIONS.map((seconds) => <option key={seconds} value={seconds}>{seconds < 60 ? `${seconds} sec` : `${seconds / 60} min`}</option>)}</select></label><label><span>Status</span><input value={statusLabel[selected.status]} readOnly /></label></div><label><span>Synopsis / Episode Direction</span><textarea value={selected.synopsis} onChange={(e) => patchSelected({ synopsis: e.target.value })} /></label><div className={styles.actions}><button onClick={markReady}>✓ Mark Ready</button><button className={styles.primary} onClick={completeEpisode}>▶ Complete Preview Episode</button></div><p className={styles.previewNote}>Preview mode uses a sample output. เมื่อเชื่อม Video Provider จริง ระบบจะรอ Generation Job และบันทึกวิดีโอจริงเข้า Asset Library</p></article>
      <article id="continuity" className={styles.card}><div className={styles.cardHead}><div><span>SERIES CONTINUITY</span><h2>Canon & Continuity State</h2></div><strong>LOCK</strong></div><label><span>Episode Entry State</span><textarea value={selected.continuity} onChange={(e) => patchSelected({ continuity: e.target.value })} /></label><label><span>Ending State for Next Episode</span><textarea value={selected.endingState} onChange={(e) => patchSelected({ endingState: e.target.value })} /></label><div className={styles.continuityInfo}>เมื่อ Episode นี้ Completed ค่า Ending State จะถูกใช้เป็น Entry State ของ Episode ถัดไป เพื่อรักษาตัวละคร เหตุการณ์ Location และ Story Canon ให้ต่อเนื่อง</div>{selected.status === "completed" ? <Link className={styles.videoLink} href="/libraries?tab=videos">Open EP.{String(selected.number).padStart(2, "0")} in Generated Episodes →</Link> : null}</article>
    </section>
    <section className={styles.ruleCard}><b>SCENOVA SERIES RULES</b><span>สร้างและอนุมัติทีละ 1 Episode</span><span>Episode ถัดไปเปิดหลัง Episode ล่าสุด Completed</span><span>Continuity และ Canon ถูกเก็บเพื่อกลับมาดำเนินงานต่อ</span><span>Completed output เข้า Generated Episodes พร้อมชื่อและ Download</span></section>
  </main>;
}