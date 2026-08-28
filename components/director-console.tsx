"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createTimelineSegments, validateTimeline } from "@/lib/episode-engine";
import type { Episode, EpisodeDuration } from "@/lib/domain";
import styles from "./director-console.module.css";

const durationOptions: EpisodeDuration[] = [10, 15, 30, 60, 90, 120, 150, 180];
const thumbnails = [
  "/library/styles/dark-thriller.png",
  "/library/styles/sci-fi-neon.png",
  "/library/styles/action-blockbuster.png",
  "/library/styles/photorealistic-film.png",
  "/library/styles/fantasy-storybook.png",
  "/library/styles/gothic-horror.png",
];

type DirectorSegment = Episode["segments"][number];

function createEpisode(duration: EpisodeDuration): Episode {
  return {
    id: "storyboard-workspace",
    number: 1,
    title: "Storyboard",
    duration,
    synopsis: "จัดลำดับภาพ เหตุการณ์ และจังหวะของเรื่องก่อนส่งต่อไปกำกับกล้องและสร้างวิดีโอ",
    status: "draft",
    segments: createTimelineSegments(duration, duration <= 30 ? 10 : 30),
  };
}

function shotLabel(index: number) {
  return `SH.${String(index + 1).padStart(2, "0")}`;
}

function formatDuration(value: number) {
  if (value < 60) return `${value} วินาที`;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return seconds ? `${minutes} นาที ${seconds} วินาที` : `${minutes} นาที`;
}

export default function DirectorConsole() {
  const [episode, setEpisode] = useState<Episode>(() => createEpisode(30));
  const [selectedSegmentId, setSelectedSegmentId] = useState(episode.segments[0]?.id ?? "");

  const selectedIndex = Math.max(0, episode.segments.findIndex((segment) => segment.id === selectedSegmentId));
  const selected = episode.segments[selectedIndex] ?? episode.segments[0];
  const validation = useMemo(() => validateTimeline(episode), [episode]);

  if (!selected) return null;

  const currentShot = selected.cameraShots[0];
  const dialogueText = selected.dialogue[0]?.text ?? "";

  const updateSelected = (patch: Partial<DirectorSegment>) => {
    setEpisode((current) => ({
      ...current,
      segments: current.segments.map((segment) => segment.id === selected.id ? { ...segment, ...patch } : segment),
    }));
  };

  const updateDialogue = (text: string) => {
    const existing = selected.dialogue[0];
    const beat = existing
      ? { ...existing, text }
      : {
          id: `dialogue-${selected.id}`,
          characterId: "",
          start: selected.start,
          end: selected.end,
          text,
          emotion: selected.emotion || "Natural",
          speed: "Normal",
        };
    updateSelected({ dialogue: [beat, ...selected.dialogue.slice(1)] });
  };

  const setDuration = (duration: EpisodeDuration) => {
    const nextEpisode = createEpisode(duration);
    setEpisode(nextEpisode);
    setSelectedSegmentId(nextEpisode.segments[0]?.id ?? "");
  };

  const splitTimeline = (segmentLength: 10 | 15 | 30) => {
    const segments = createTimelineSegments(episode.duration, segmentLength);
    setEpisode((current) => ({ ...current, segments }));
    setSelectedSegmentId(segments[0]?.id ?? "");
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>STORYBOARD</span>
          <h1>วางภาพและลำดับฉาก</h1>
          <p>จัด Shot ให้เข้าใจง่ายก่อนกำกับกล้อง รายละเอียดที่ซับซ้อนค่อยไปปรับใน Camera Lab</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton}>บันทึกร่าง</button>
          <Link href="/studio#review" className={styles.primaryButton}>Prompt & Render →</Link>
        </div>
      </header>

      <section className={styles.setupBar} aria-label="ตั้งค่าสตอรี่บอร์ด">
        <label>
          <span>ความยาวงาน</span>
          <select value={episode.duration} onChange={(event) => setDuration(Number(event.target.value) as EpisodeDuration)}>
            {durationOptions.map((value) => <option key={value} value={value}>{formatDuration(value)}</option>)}
          </select>
        </label>
        <div className={styles.splitGroup}>
          <span>แบ่ง Shot อัตโนมัติ</span>
          <div>
            <button type="button" onClick={() => splitTimeline(10)}>ทุก 10 วิ</button>
            <button type="button" onClick={() => splitTimeline(15)}>ทุก 15 วิ</button>
            <button type="button" onClick={() => splitTimeline(30)}>ทุก 30 วิ</button>
          </div>
        </div>
        <div className={styles.timelineState} data-valid={validation.valid}>
          <span>{validation.valid ? "ลำดับเวลาครบ" : "ต้องตรวจเวลา"}</span>
          <small>{episode.segments.length} Shot · {formatDuration(episode.duration)}</small>
        </div>
        <Link href="/camera" className={styles.cameraLink}>เปิด Camera Lab →</Link>
      </section>

      <div className={styles.workspace}>
        <aside className={styles.shotSidebar}>
          <div className={styles.sectionHeading}>
            <div>
              <span>SHOT LIST</span>
              <h2>ลำดับภาพ</h2>
            </div>
            <b>{episode.segments.length}</b>
          </div>

          <div className={styles.shotList}>
            {episode.segments.map((segment, index) => (
              <button
                type="button"
                key={segment.id}
                className={segment.id === selected.id ? styles.shotActive : styles.shotItem}
                onClick={() => setSelectedSegmentId(segment.id)}
              >
                <span className={styles.thumb}><img src={thumbnails[index % thumbnails.length]} alt="" /></span>
                <span className={styles.shotCopy}>
                  <small>{shotLabel(index)} · {segment.start}–{segment.end}s</small>
                  <strong>{segment.title}</strong>
                  <span>{segment.location || "ยังไม่กำหนดสถานที่"}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className={styles.editor}>
          <div className={styles.editorTop}>
            <div>
              <span className={styles.eyebrow}>{shotLabel(selectedIndex)}</span>
              <h2>{selected.title}</h2>
            </div>
            <span className={styles.timeBadge}>{selected.start}–{selected.end} วินาที</span>
          </div>

          <div className={styles.previewAndSummary}>
            <div className={styles.preview}>
              <img src={thumbnails[selectedIndex % thumbnails.length]} alt={`ภาพอ้างอิง ${shotLabel(selectedIndex)}`} />
              <span>{shotLabel(selectedIndex)}</span>
            </div>
            <div className={styles.quickSummary}>
              <div><small>สถานที่</small><strong>{selected.location || "ยังไม่กำหนด"}</strong></div>
              <div><small>อารมณ์</small><strong>{selected.emotion || "ยังไม่กำหนด"}</strong></div>
              <div><small>แสง</small><strong>{selected.lighting || "ยังไม่กำหนด"}</strong></div>
              <div><small>กล้อง</small><strong>{currentShot ? `${currentShot.shotType} · ${currentShot.lensMm}mm · ${currentShot.movement}` : "ไปกำหนดใน Camera Lab"}</strong></div>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.fullField}>
              <span>ชื่อ Shot</span>
              <input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} />
            </label>
            <label className={styles.fullField}>
              <span>เกิดอะไรขึ้นใน Shot นี้</span>
              <textarea value={selected.scene} onChange={(event) => updateSelected({ scene: event.target.value })} placeholder="อธิบายภาพและเหตุการณ์ที่ผู้ชมจะเห็น" />
            </label>
            <label className={styles.fullField}>
              <span>การกระทำ / Blocking</span>
              <textarea value={selected.action} onChange={(event) => updateSelected({ action: event.target.value })} placeholder="ใครทำอะไร เคลื่อนจากจุดไหนไปจุดไหน" />
            </label>
            <label>
              <span>สถานที่</span>
              <input value={selected.location} onChange={(event) => updateSelected({ location: event.target.value })} />
            </label>
            <label>
              <span>อารมณ์</span>
              <input value={selected.emotion} onChange={(event) => updateSelected({ emotion: event.target.value })} />
            </label>
            <label>
              <span>แสง</span>
              <input value={selected.lighting} onChange={(event) => updateSelected({ lighting: event.target.value })} />
            </label>
            <label>
              <span>เสียงบรรยากาศ</span>
              <input value={selected.sound} onChange={(event) => updateSelected({ sound: event.target.value })} />
            </label>
            <label className={styles.fullField}>
              <span>บทพูดใน Shot นี้</span>
              <textarea value={dialogueText} onChange={(event) => updateDialogue(event.target.value)} placeholder="เว้นว่างได้ถ้า Shot นี้ไม่มีบทพูด" />
            </label>
          </div>
        </section>
      </div>

      <section className={styles.timelineSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span>TIMELINE</span>
            <h2>เวลาแต่ละ Shot</h2>
          </div>
          <small>คลิกช่วงเวลาเพื่อเลือก Shot</small>
        </div>
        <div className={styles.timelineTrack}>
          {episode.segments.map((segment, index) => {
            const width = ((segment.end - segment.start) / episode.duration) * 100;
            return (
              <button
                type="button"
                key={segment.id}
                className={segment.id === selected.id ? styles.timelineActive : styles.timelineSegment}
                style={{ width: `${width}%` }}
                onClick={() => setSelectedSegmentId(segment.id)}
              >
                <b>{shotLabel(index)}</b>
                <span>{segment.start}–{segment.end}s</span>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
