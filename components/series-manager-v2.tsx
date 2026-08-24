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
  return { id: `ep_${Date.now()}_${number}`, number, title: number === 1 ? "พบเพื่อนตัวเล็ก" : `ตอนที่ ${number}`, duration: previous?.duration ?? 30, synopsis: previous ? `ดำเนินเรื่องต่อจาก EP.${String(previous.number).padStart(2, "0")} — ${previous.title}` : "เด็กหญิงพบสิ่งมีชีวิตลึกลับระหว่างทางกลับบ้าน และค่อย ๆ กลายเป็นเพื่อนกัน", continuity: previous ? `เริ่มต่อจากสถานะท้ายตอนก่อน: ${previous.endingState || previous.synopsis}` : "ตอนเปิดเรื่อง — กำหนดจุดเริ่มต้นของตัวละครและโลก", endingState: "ระบุว่าตอนนี้จบตรงไหน ตัวละครอยู่ที่ใด อารมณ์เป็นอย่างไร และมีอะไรต้องต่อใน EP ถัดไป", status: "draft", createdAt: now, updatedAt: now };
}

const DEFAULT_SERIES: SeriesRecord = { projectTitle: "เด็กหญิงกับสิ่งมีชีวิตลึกลับ", updatedAt: new Date().toISOString(), episodes: [newEpisode(1)] };

export default function SeriesManagerV2() {
  const [series, setSeries] = useState<SeriesRecord>(DEFAULT_SERIES);
  const [selectedId, setSelectedId] = useState(DEFAULT_SERIES.episodes[0].id);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("ระบบจะบันทึกประวัติ EP ไว้ในเบราว์เซอร์ Preview นี้อัตโนมัติ");

  useEffect(() => { try { const raw = localStorage.getItem(SERIES_KEY); if (raw) { const parsed = JSON.parse(raw) as SeriesRecord; if (parsed.episodes?.length) { setSeries(parsed); setSelectedId(parsed.episodes[parsed.episodes.length - 1].id); } } } catch { setMessage("อ่านประวัติเดิมไม่สำเร็จ จึงเริ่มจากข้อมูล Preview ใหม่"); } finally { setHydrated(true); } }, []);
  useEffect(() => { if (!hydrated) return; localStorage.setItem(SERIES_KEY, JSON.stringify(series)); }, [series, hydrated]);

  const selected = useMemo(() => series.episodes.find((ep) => ep.id === selectedId) ?? series.episodes[0], [series, selectedId]);
  const lastEpisode = series.episodes[series.episodes.length - 1];
  const canCreateNext = lastEpisode.status === "completed";

  function patchSelected(patch: Partial<EpisodeRecord>) { const now = new Date().toISOString(); setSeries((current) => ({ ...current, updatedAt: now, episodes: current.episodes.map((ep) => ep.id === selected.id ? { ...ep, ...patch, updatedAt: now } : ep) })); }
  function createNextEpisode() { if (!canCreateNext) { setMessage(`ต้องสร้าง EP.${String(lastEpisode.number).padStart(2, "0")} ให้เสร็จก่อน จึงเริ่มตอนถัดไปได้`); return; } const next = newEpisode(lastEpisode.number + 1, lastEpisode); setSeries((current) => ({ ...current, updatedAt: new Date().toISOString(), episodes: [...current.episodes, next] })); setSelectedId(next.id); setMessage(`สร้างโครง EP.${String(next.number).padStart(2, "0")} แล้ว และดึงสถานะต่อเนื่องจากตอนก่อนมาให้`); }
  function markReady() { patchSelected({ status: "ready" }); setMessage(`EP.${String(selected.number).padStart(2, "0")} พร้อมส่งไป Creator / Render แล้ว`); }
  function completeEpisode() {
    const completedAt = new Date().toISOString(); patchSelected({ status: "completed", updatedAt: completedAt });
    try { const raw = localStorage.getItem(VIDEO_KEY); const items = raw ? JSON.parse(raw) as VideoItem[] : []; const video: VideoItem = { id: `video_${selected.id}`, ep: selected.number, epTitle: selected.title, projectTitle: series.projectTitle, duration: selected.duration, createdAt: completedAt, url: `/api/mock-video?ep=${selected.number}`, status: "completed" }; const nextItems = [video, ...items.filter((item) => item.id !== video.id)]; localStorage.setItem(VIDEO_KEY, JSON.stringify(nextItems)); window.dispatchEvent(new Event("scenova-video-library-updated")); } catch {}
    setMessage(`EP.${String(selected.number).padStart(2, "0")} สร้างเสร็จแล้ว คลิปถูกส่งไปคลังวิดีโอ และตอนถัดไปสามารถเริ่มได้`);
  }

  const statusLabel: Record<EpisodeStatus, string> = { draft: "กำลังทำ", ready: "พร้อมสร้าง", completed: "เสร็จแล้ว" };

  return <main className={styles.main}>
    <header className={styles.header}><div><span>EP / SERIES WORKSPACE</span><h1>ทำซีรีส์ต่อได้ทีละ 1 EP</h1><p>แต่ละตอนมีประวัติของตัวเอง ระบบจำเรื่องย่อ จุดต่อเนื่อง และสถานะท้ายตอน เพื่อกลับมาทำต่อภายหลังโดยไม่ต้องเริ่มใหม่</p></div><div className={styles.headerActions}><Link href="/libraries?tab=videos">▶ คลังวิดีโอ</Link><button onClick={createNextEpisode} disabled={!canCreateNext}>＋ สร้างตอนถัดไป</button></div></header>
    <div className={styles.message}>{message}</div>
    <section id="history" className={styles.historySection}><div className={styles.sectionHead}><div><span>ประวัติ EP</span><h2>{series.projectTitle}</h2></div><div className={styles.projectMeta}>{series.episodes.length} ตอน · บันทึกล่าสุด {new Date(series.updatedAt).toLocaleString("th-TH")}</div></div><div className={styles.historyRail}>{series.episodes.map((ep) => <button key={ep.id} onClick={() => setSelectedId(ep.id)} className={selected.id === ep.id ? styles.activeEpisode : ""}><span className={styles.epNo}>EP.{String(ep.number).padStart(2, "0")}</span><b>{ep.title}</b><small>{ep.duration}s · {statusLabel[ep.status]}</small><em>{new Date(ep.updatedAt).toLocaleDateString("th-TH")}</em></button>)}</div></section>
    <section id="episode-editor" className={styles.editorGrid}>
      <article className={styles.card}><div className={styles.cardHead}><div><span>ตอนที่กำลังทำ</span><h2>EP.{String(selected.number).padStart(2, "0")} — {selected.title}</h2></div><strong data-status={selected.status}>{statusLabel[selected.status]}</strong></div><label><span>ชื่อตอน</span><input value={selected.title} onChange={(e) => patchSelected({ title: e.target.value })} /></label><div className={styles.twoCol}><label><span>ความยาว EP</span><select value={selected.duration} onChange={(e) => patchSelected({ duration: Number(e.target.value) })}>{DURATIONS.map((seconds) => <option key={seconds} value={seconds}>{seconds < 60 ? `${seconds} วินาที` : `${seconds / 60} นาที`}</option>)}</select></label><label><span>สถานะ</span><input value={statusLabel[selected.status]} readOnly /></label></div><label><span>เรื่องย่อ / สิ่งที่จะเกิดในตอนนี้</span><textarea value={selected.synopsis} onChange={(e) => patchSelected({ synopsis: e.target.value })} /></label><div className={styles.actions}><button onClick={markReady}>✓ พร้อมสร้าง</button><button className={styles.primary} onClick={completeEpisode}>▶ จำลองสร้าง EP นี้เสร็จ</button></div><p className={styles.previewNote}>Preview ใช้คลิปตัวอย่างสั้นเพื่อทดสอบระบบคลัง/ดาวน์โหลด เมื่อเชื่อม Video Provider จริง ปุ่มสร้างจะรอผลลัพธ์จริงแล้วบันทึกไฟล์จริงแทน</p></article>
      <article id="continuity" className={styles.card}><div className={styles.cardHead}><div><span>Story Continuity</span><h2>สิ่งที่ต้องต่อจากตอนก่อน</h2></div><strong>LOCK</strong></div><label><span>จุดเริ่มตอน / ความต่อเนื่อง</span><textarea value={selected.continuity} onChange={(e) => patchSelected({ continuity: e.target.value })} /></label><label><span>สถานะตอนจบสำหรับ EP ถัดไป</span><textarea value={selected.endingState} onChange={(e) => patchSelected({ endingState: e.target.value })} /></label><div className={styles.continuityInfo}>เมื่อ EP นี้สร้างเสร็จ ค่า “สถานะตอนจบ” จะถูกนำไปตั้งเป็นจุดเริ่มต้นของ EP ถัดไปอัตโนมัติ ทำให้เรื่อง ตัวละคร และเหตุการณ์ต่อกันเป็นสายเดียว</div>{selected.status === "completed" ? <Link className={styles.videoLink} href="/libraries?tab=videos">เปิดคลิป EP.{String(selected.number).padStart(2, "0")} ในคลังวิดีโอ →</Link> : null}</article>
    </section>
    <section className={styles.ruleCard}><b>กติกา EP ของ SCENOVA</b><span>สร้างได้ทีละ 1 EP เท่านั้น</span><span>ตอนถัดไปเปิดได้เมื่อ EP ล่าสุดสร้างเสร็จ</span><span>ประวัติและจุดต่อเนื่องถูกบันทึกไว้เพื่อกลับมาทำต่อ</span><span>คลิปที่เสร็จแล้วเข้า Video Library พร้อมชื่อ EP และดาวน์โหลดได้</span></section>
  </main>;
}
