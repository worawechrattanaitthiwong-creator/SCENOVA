"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./series-video-history.module.css";

type VideoItem = {
  id: string;
  ep: number;
  epTitle: string;
  projectTitle: string;
  duration: number;
  createdAt: string;
  url?: string;
  status: "completed" | "processing";
};

const VIDEO_KEY = "scenova-video-library-v1";

function readVideos(): VideoItem[] {
  try {
    const raw = localStorage.getItem(VIDEO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VideoItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function SeriesVideoHistory({ embedded = false }: { embedded?: boolean }) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setVideos(readVideos());
    sync();
    setReady(true);
    window.addEventListener("scenova-video-library-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("scenova-video-library-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const sorted = useMemo(
    () => [...videos].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [videos],
  );

  function write(next: VideoItem[]) {
    localStorage.setItem(VIDEO_KEY, JSON.stringify(next));
    setVideos(next);
    window.dispatchEvent(new Event("scenova-video-library-updated"));
  }

  function removeVideo(item: VideoItem) {
    const ok = window.confirm(`ลบประวัติ VDO ของ Episode ${String(item.ep).padStart(2, "0")} — ${item.epTitle} ใช่หรือไม่?\n\nการลบนี้จะลบเฉพาะรายการ VDO ในประวัติ ไม่ลบ Episode หรือข้อมูล Continuity`);
    if (!ok) return;
    write(videos.filter((video) => video.id !== item.id));
  }

  function clearHistory() {
    if (!videos.length) return;
    const ok = window.confirm("ล้างประวัติ VDO ใน Series ทั้งหมดใช่หรือไม่?\n\nEpisode, Series Bible และ Continuity จะยังอยู่เหมือนเดิม");
    if (!ok) return;
    write([]);
  }

  return (
    <section className={`${styles.wrap} ${embedded ? styles.embedded : ""}`} id="video-history">
      <header className={styles.header}>
        <div>
          <span>SERIES VIDEO HISTORY</span>
          <h2>ประวัติ VDO ที่สร้าง</h2>
          <p>ดู ดาวน์โหลด หรือลบเฉพาะประวัติ VDO ได้ โดยไม่กระทบ Episode, Series Bible หรือ Continuity</p>
        </div>
        <div className={styles.headerActions}>
          <strong>{sorted.length} รายการ</strong>
          <button type="button" onClick={clearHistory} disabled={!sorted.length}>ล้างประวัติทั้งหมด</button>
        </div>
      </header>

      {!ready ? <div className={styles.empty}>กำลังโหลดประวัติ VDO...</div> : null}
      {ready && !sorted.length ? <div className={styles.empty}>ยังไม่มี VDO ในประวัติ Series</div> : null}

      {sorted.length ? (
        <div className={styles.grid}>
          {sorted.map((item) => (
            <article className={styles.card} key={item.id}>
              <div className={styles.preview}>
                {item.url ? <video src={item.url} muted playsInline preload="metadata" /> : <span>VDO</span>}
                <i>{item.status === "completed" ? "COMPLETED" : "PROCESSING"}</i>
              </div>
              <div className={styles.body}>
                <div className={styles.episode}>Episode {String(item.ep).padStart(2, "0")}</div>
                <h3>{item.epTitle || `Episode ${String(item.ep).padStart(2, "0")}`}</h3>
                <p>{item.projectTitle}</p>
                <div className={styles.meta}>
                  <span>{item.duration}s</span>
                  <span>{new Date(item.createdAt).toLocaleString("th-TH")}</span>
                </div>
                <div className={styles.actions}>
                  {item.url ? <a href={item.url} download>ดาวน์โหลด VDO</a> : <button type="button" disabled>ยังไม่มีไฟล์</button>}
                  <button type="button" className={styles.delete} onClick={() => removeVideo(item)}>ลบประวัติ</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
