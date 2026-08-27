"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DIRECTOR_PRESETS } from "@/lib/director-presets";
import { applyDirectorPreset } from "@/lib/director-engine";
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
    id: "director-demo",
    number: 1,
    title: "Custom Director Timeline",
    duration,
    synopsis: "Storyboard สำหรับกำกับฉาก ช็อต กล้อง Action และ Continuity ตามช่วงเวลา",
    status: "draft",
    segments: createTimelineSegments(duration, duration <= 30 ? 10 : 30),
  };
}

function formatDuration(value: number) {
  if (value < 60) return `${value} วินาที`;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return seconds ? `${minutes} นาที ${seconds} วินาที` : `${minutes} นาที`;
}

function shotLabel(index: number) {
  return `SH.${String(index + 1).padStart(2, "0")}`;
}

export default function DirectorConsole() {
  const [episode, setEpisode] = useState<Episode>(() => createEpisode(30));
  const [selectedSegmentId, setSelectedSegmentId] = useState(episode.segments[0]?.id ?? "");

  const selectedIndex = Math.max(0, episode.segments.findIndex((segment) => segment.id === selectedSegmentId));
  const selected = episode.segments[selectedIndex] ?? episode.segments[0];
  const previous = selectedIndex > 0 ? episode.segments[selectedIndex - 1] : null;
  const next = selectedIndex < episode.segments.length - 1 ? episode.segments[selectedIndex + 1] : null;
  const validation = useMemo(() => validateTimeline(episode), [episode]);

  const readiness = useMemo(() => {
    if (!selected) return 0;
    const checks = [
      selected.scene.trim().length > 8,
      selected.action.trim().length > 8,
      selected.emotion.trim().length > 0,
      selected.lighting.trim().length > 0,
      selected.location.trim().length > 0,
      selected.cameraShots.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [selected]);

  if (!selected) return null;

  const updateSelected = (patch: Partial<DirectorSegment>) => {
    setEpisode((current) => ({
      ...current,
      segments: current.segments.map((segment) => segment.id === selected.id ? { ...segment, ...patch } : segment),
    }));
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

  const applyPreset = (presetId: string) => {
    setEpisode((current) => ({
      ...current,
      segments: current.segments.map((segment) => segment.id === selected.id ? applyDirectorPreset(segment, presetId) : segment),
    }));
  };

  const currentShot = selected.cameraShots[0];
  const timelineReady = validation.valid ? "Timeline ครบทุกช่วง" : `${validation.errors.length} จุดต้องตรวจ`;

  return (
    <main className={styles.page}>
      <header className={styles.heroHeader}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>STORYBOARD CONTROL ROOM</span>
          <div className={styles.titleRow}>
            <h1>Storyboard — {episode.title}</h1>
            <span className={styles.editMark}>✎</span>
          </div>
          <div className={styles.subtitleRow}>
            <span className={styles.episodeBadge}>EP.{String(episode.number).padStart(2, "0")}</span>
            <strong>กำกับภาพและลำดับ Shot แบบ Production</strong>
            <span className={styles.durationBadge}>{formatDuration(episode.duration)}</span>
          </div>
          <div className={styles.lockRow}>
            <span>▣ Story Locked</span>
            <span>◉ Camera Ready</span>
            <span>◇ Timeline Locked</span>
            <span>♫ Dialogue Sync</span>
            <span className={validation.valid ? styles.goodChip : styles.warnChip}>● {timelineReady}</span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <div className={styles.healthWrap}>
            <div
              className={styles.healthGauge}
              style={{ background: `conic-gradient(#f0d064 0deg ${readiness * 2.85}deg, #7f4bd1 ${readiness * 2.85}deg ${readiness * 3.6}deg, rgba(255,255,255,.07) ${readiness * 3.6}deg 360deg)` }}
            >
              <div><strong>{readiness}%</strong></div>
            </div>
            <span>Storyboard Health</span>
            <small>ความพร้อมของ Shot ปัจจุบัน</small>
          </div>
          <div className={styles.actionButtons}>
            <Link href="/studio#review" className={styles.primaryAction}>✦ สร้าง Prompt & Render</Link>
            <Link href="/camera" className={styles.secondaryAction}>▷ เปิด Camera Lab</Link>
          </div>
        </div>
      </header>

      <section className={styles.workflow} aria-label="Storyboard workflow">
        {[
          ["1", "Story Setup", "โครงเรื่องและฉาก"],
          ["2", "Sequence", "แบ่งช่วงเวลา"],
          ["3", "Storyboard", "สร้าง Shot"],
          ["4", "Direction", "กล้องและ Blocking"],
          ["5", "Render", "Prompt & Video"],
        ].map(([number, title, detail], index) => (
          <div key={number} className={`${styles.step} ${index < 2 ? styles.done : ""} ${index === 2 ? styles.activeStep : ""}`}>
            <span className={styles.stepNumber}>{index < 2 ? "✓" : number}</span>
            <span><b>{title}</b><small>{detail}</small></span>
          </div>
        ))}
      </section>

      <section className={styles.boardGrid}>
        <aside className={styles.navigatorPanel}>
          <div className={styles.panelHeading}>
            <div><span>SHOT NAVIGATOR</span><small>{episode.segments.length} Shot ใน Episode นี้</small></div>
          </div>

          <button className={styles.newShotButton} type="button" onClick={() => splitTimeline(10)}>＋ แบ่ง Shot ทุก 10 วินาที</button>

          <div className={styles.shotList}>
            {episode.segments.map((segment, index) => {
              const active = segment.id === selected.id;
              return (
                <button
                  type="button"
                  key={segment.id}
                  className={`${styles.shotNavItem} ${active ? styles.shotNavActive : ""}`}
                  onClick={() => setSelectedSegmentId(segment.id)}
                >
                  <span className={styles.shotThumb}><img src={thumbnails[index % thumbnails.length]} alt="" /></span>
                  <span className={styles.shotNavCopy}>
                    <b>{shotLabel(index)}</b>
                    <strong>{segment.title}</strong>
                    <small>{segment.start}–{segment.end}s · {segment.cameraShots.length} camera shot</small>
                    <em>{segment.cameraShots.length ? "Ready" : "Draft"}</em>
                  </span>
                  {active ? <span className={styles.moreDot}>⋮</span> : null}
                </button>
              );
            })}
          </div>

          <div className={styles.navigatorFooter}>
            <label>ความยาว Episode</label>
            <select value={episode.duration} onChange={(event) => setDuration(Number(event.target.value) as EpisodeDuration)}>
              {durationOptions.map((value) => <option value={value} key={value}>{formatDuration(value)}</option>)}
            </select>
            <div className={styles.splitButtons}>
              <button type="button" onClick={() => splitTimeline(10)}>10s</button>
              <button type="button" onClick={() => splitTimeline(15)}>15s</button>
              <button type="button" onClick={() => splitTimeline(30)}>30s</button>
            </div>
          </div>
        </aside>

        <section className={styles.centerColumn}>
          <div className={styles.mainPanel}>
            <div className={styles.panelTopline}>
              <div>
                <span className={styles.panelLabel}>STORYBOARD CANVAS</span>
                <h2>{shotLabel(selectedIndex)} · {selected.title}</h2>
              </div>
              <span className={styles.timePill}>{selected.start}–{selected.end}s</span>
            </div>

            <div className={styles.tabs}>
              <span className={styles.tabActive}>Overview</span>
              <span>Scene</span>
              <span>Action / Blocking</span>
              <span>Camera</span>
              <span>Dialogue</span>
              <span>Lighting</span>
            </div>

            <div className={styles.storyOverview}>
              <div className={styles.framePreview}>
                <img src={thumbnails[selectedIndex % thumbnails.length]} alt={`ภาพอ้างอิง ${shotLabel(selectedIndex)}`} />
                <div className={styles.frameShade} />
                <span className={styles.frameTag}>{shotLabel(selectedIndex)}</span>
                <span className={styles.frameTime}>{selected.start}–{selected.end}s</span>
              </div>
              <div className={styles.storyFacts}>
                <div><small>ฉาก / เหตุการณ์</small><strong>{selected.scene}</strong></div>
                <div><small>Action / Blocking</small><strong>{selected.action}</strong></div>
                <div><small>สถานที่</small><strong>{selected.location}</strong></div>
                <div><small>อารมณ์</small><strong>{selected.emotion}</strong></div>
                <div><small>Lighting</small><strong>{selected.lighting}</strong></div>
                <div><small>Camera Language</small><strong>{currentShot ? `${currentShot.shotType} · ${currentShot.lensMm}mm · ${currentShot.movement}` : "ยังไม่ได้ตั้งค่ากล้อง"}</strong></div>
              </div>
            </div>
          </div>

          <div className={styles.timelinePanel}>
            <div className={styles.sectionTitleRow}>
              <div><span className={styles.panelLabel}>SHOT TIMELINE</span><small>คลิก Shot เพื่อเลือกและแก้ไขรายละเอียด</small></div>
              <span className={validation.valid ? styles.readyText : styles.warningText}>{validation.valid ? "● Timeline Ready" : "▲ ตรวจ Timeline"}</span>
            </div>
            <div className={styles.timelineStrip}>
              {episode.segments.map((segment, index) => (
                <button
                  type="button"
                  key={segment.id}
                  onClick={() => setSelectedSegmentId(segment.id)}
                  className={segment.id === selected.id ? styles.timelineActive : ""}
                >
                  <span>{shotLabel(index)}</span>
                  <b>{segment.title}</b>
                  <small>{segment.start}–{segment.end}s</small>
                </button>
              ))}
            </div>
            <div className={styles.timelineRail}>
              <span style={{ left: `${(selected.start / episode.duration) * 100}%`, width: `${((selected.end - selected.start) / episode.duration) * 100}%` }} />
            </div>
          </div>

          <div className={styles.handoffGrid}>
            <article className={styles.handoffCard}>
              <span>PREVIOUS SHOT</span>
              <h3>{previous ? `${shotLabel(selectedIndex - 1)} · ${previous.title}` : "เริ่มต้น Sequence"}</h3>
              {previous ? <><p>Ending action: {previous.action}</p><p>Emotion: {previous.emotion}</p><p>Lighting: {previous.lighting}</p></> : <p>ไม่มี Shot ก่อนหน้า — ใช้เป็น Establishing Shot หรือจุดเริ่มต้นของฉาก</p>}
            </article>
            <article className={`${styles.handoffCard} ${styles.currentCard}`}>
              <span>CURRENT SHOT</span>
              <h3>{shotLabel(selectedIndex)} · {selected.title}</h3>
              <p>Blocking: {selected.action}</p>
              <p>Focus: {currentShot?.focus ?? "ตัวละครหลัก"}</p>
              <p>Composition: {currentShot?.composition ?? "กำหนดใน Camera Lab"}</p>
            </article>
            <article className={styles.handoffCard}>
              <span>NEXT SHOT HANDOFF</span>
              <h3>{next ? `${shotLabel(selectedIndex + 1)} · ${next.title}` : "จบ Sequence"}</h3>
              {next ? <><p>เตรียม Location: {next.location}</p><p>Next emotion: {next.emotion}</p><p>Next light: {next.lighting}</p></> : <p>ไม่มี Shot ถัดไป — พร้อมส่งต่อไป Prompt & Render</p>}
            </article>
          </div>

          <div className={styles.directionPanel}>
            <div className={styles.sectionTitleRow}>
              <div><span className={styles.panelLabel}>CAMERA SHOTS & DIRECTOR PRESETS</span><small>เลือกรูปแบบกำกับ แล้วปรับรายละเอียดต่อได้</small></div>
              <span className={styles.countBadge}>{selected.cameraShots.length} camera shot</span>
            </div>

            <div className={styles.presetRow}>
              {DIRECTOR_PRESETS.slice(0, 4).map((preset) => (
                <button type="button" key={preset.id} onClick={() => applyPreset(preset.id)}>
                  <b>{preset.nameTh}</b>
                  <small>{preset.category}</small>
                </button>
              ))}
            </div>

            <div className={styles.cameraGrid}>
              {selected.cameraShots.map((shot, index) => (
                <article key={shot.id}>
                  <span>CAM {String(index + 1).padStart(2, "0")} · {shot.start}–{shot.end}s</span>
                  <h3>{shot.shotType}</h3>
                  <p>{shot.angle} · {shot.lensMm}mm</p>
                  <p>{shot.movement} · {shot.cameraHeight}</p>
                  <p>DOF: {shot.depthOfField}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <aside className={styles.inspectorColumn}>
          <section className={styles.inspectorPanel}>
            <div className={styles.panelHeading}>
              <div><span>SHOT INSPECTOR</span><small>ความพร้อมของ {shotLabel(selectedIndex)}</small></div>
            </div>
            <div className={styles.inspectorHealth}>
              <strong>{readiness}%</strong>
              <span>{readiness >= 90 ? "พร้อม" : readiness >= 70 ? "เกือบพร้อม" : "ต้องตรวจ"}</span>
              <div><i style={{ width: `${readiness}%` }} /></div>
            </div>
            <div className={styles.checkList}>
              <span><b>✓</b> Scene Description <em>ผ่าน</em></span>
              <span><b>✓</b> Action / Blocking <em>ผ่าน</em></span>
              <span><b>✓</b> Emotion <em>ผ่าน</em></span>
              <span><b>✓</b> Lighting <em>ผ่าน</em></span>
              <span><b>✓</b> Camera Shot <em>{selected.cameraShots.length}/{selected.cameraShots.length}</em></span>
              <span><b className={validation.valid ? "" : styles.checkWarn}>{validation.valid ? "✓" : "!"}</b> Timeline <em>{validation.valid ? "ผ่าน" : "ตรวจ"}</em></span>
            </div>
          </section>

          <section className={styles.editorPanel}>
            <div className={styles.panelHeading}>
              <div><span>EDIT CURRENT SHOT</span><small>แก้ข้อมูลที่ใช้สร้าง Prompt โดยตรง</small></div>
            </div>
            <label>ชื่อ Shot</label>
            <input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} />
            <label>ฉาก / เหตุการณ์</label>
            <textarea value={selected.scene} onChange={(event) => updateSelected({ scene: event.target.value })} />
            <label>Action / Blocking</label>
            <textarea value={selected.action} onChange={(event) => updateSelected({ action: event.target.value })} />
            <div className={styles.twoFields}>
              <div><label>อารมณ์</label><input value={selected.emotion} onChange={(event) => updateSelected({ emotion: event.target.value })} /></div>
              <div><label>สถานที่</label><input value={selected.location} onChange={(event) => updateSelected({ location: event.target.value })} /></div>
            </div>
            <label>Lighting</label>
            <input value={selected.lighting} onChange={(event) => updateSelected({ lighting: event.target.value })} />
          </section>

          <section className={styles.alertPanel}>
            <div className={styles.panelHeading}>
              <div><span>STORYBOARD ALERTS</span><small>เฉพาะสิ่งที่กระทบ Shot และ Continuity</small></div>
            </div>
            <div className={styles.alertItem}>
              <span>i</span>
              <p><b>ตรวจการเชื่อม Shot</b><small>{previous ? `ให้ Action ของ ${shotLabel(selectedIndex - 1)} ต่อเนื่องกับ ${shotLabel(selectedIndex)}` : "Shot แรกควรกำหนด Establishing ให้ชัดเจน"}</small></p>
            </div>
            <div className={styles.alertItem}>
              <span>i</span>
              <p><b>Camera continuity</b><small>{currentShot ? `${currentShot.shotType} ${currentShot.lensMm}mm · ${currentShot.movement}` : "ยังไม่มี Camera Shot"}</small></p>
            </div>
            {!validation.valid ? <div className={`${styles.alertItem} ${styles.alertDanger}`}><span>!</span><p><b>Timeline ต้องตรวจ</b><small>{validation.errors.join(" · ")}</small></p></div> : null}
          </section>
        </aside>
      </section>

      <footer className={styles.statusBar}>
        <span>◷ บันทึกล่าสุด <b>Storyboard Draft</b></span>
        <span className={validation.valid ? styles.statusGood : styles.statusWarn}>● {validation.valid ? "Auto Save · Timeline Valid" : "Timeline ต้องตรวจ"}</span>
        <span>Episode {String(episode.number).padStart(2, "0")} · {episode.segments.length} Shot · {formatDuration(episode.duration)}</span>
      </footer>
    </main>
  );
}
