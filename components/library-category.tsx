"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./library-category.module.css";

type Kind = "images" | "voices" | "characters" | "pets" | "ambience" | "plots" | "videos";
type ApiItem = { id: string; kind: string; title: string; description: string; assetUrl?: string };
type BuiltIn = { id: string; title: string; description: string; tag: string; visual: string; icon?: string };
type VideoItem = { id: string; ep: number; epTitle: string; projectTitle: string; duration: number; createdAt: string; url?: string; status: "completed" | "processing" };

const SAMPLE_VIDEO = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAPubW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAAlgAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAxl0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAAlgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAKAAAABaAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAJYAAAEAAABAAAAAAKRbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAyAAAAHgBVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAACPG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAfxzdGJsAAAAwHN0c2QAAAAAAAAAAQAAALBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAKAAWgBIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANmF2Y0MBZAAL/+EAGWdkAAus2UKN+TARAAADAAEAAAMAMg8UKZYBAAZo6+PLIsD9+PgAAAAAEHBhc3AAAAABAAAAAQAAABRidHJ0AAAAAAAAUzoAAAAAAAAAGHN0dHMAAAAAAAAAAQAAAA8AAAIAAAAAFHN0c3MAAAAAAAAAAQAAAAEAAACIY3R0cwAAAAAAAAAPAAAAAQAABAAAAAABAAAKAAAAAAEAAAQAAAAAAQAAAAAAAAABAAACAAAAAAEAAAoAAAAAAQAABAAAAAABAAAAAAAAAAEAAAIAAAAAAQAACgAAAAABAAAEAAAAAAEAAAAAAAAAAQAAAgAAAAABAAAGAAAAAAEAAAIAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAAPAAAAAQAAAFBzdHN6AAAAAAAAAAAAAAAPAAAFcAAAAA8AAAANAAAADAAAAAwAAAAVAAAADwAAAAwAAAAMAAAAFQAAAA8AAAAMAAAADAAAABYAAAAMAAAAFHN0Y28AAAAAAAAAAQAABB4AAABhdWR0YQAAAFltZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAACxpbHN0AAAAJKl0b28AAAAcZGF0YQAAAAEAAAAATGF2ZjYxLjcuMTAzAAAACGZyZWUAAAZGbWRhdAAAAq4GBf//qtxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0xIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMiBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0zIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0yNSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAArpliIQAO//+46v4FNhn0HFzlb/0Y0/PFJds8hM3HLBVD8+q5W7wZbatD4KpmqgC6KtUjB7iDQZCLEjkAQIB/OSpsRqdMhgvNoUQ2ouXgeEpBD5LaT9nvz3e1J47W/62SYyvgYbovh7dlQbaw7qI2Cc03JgTT06Agt0YMYi6TyE8wW2hRxZPC+Iq/K8gC2iq2IX1sBknN2iDaHxUXh+o/mQeUb1G1nwfhcCPA4u0JsgUnYSzoKsiTRukKKsrmFhUH+HEdQkk9yssvoYM2PHbSqx6isns0LAQ2LTTJ0xqZP7Hdl0OcNWhZ6xHlPSsndLYWV6KDbPJbV5hR271igmH3bsAjxjEZa2ncbxRyQCIuLUvlAms9pylIVMHNFH7cN9wumx8xXvNb+98/tTCyiadIxGW4pxkz51bpE/q9IyoA3isvq/XpbjfaPG4pf3VzZsr8ykLThQu0jUQU6FZ+eARNmWXRXkDp3DoKhdJ+0Dd88qAiH9EbZE5lsFcK2fH22SDMLi/j/VuteG+JtPgFS3h1YOJihibw09kmIjp4rPNnNEfM2rutPuzPx+zj+oEFqG5gt3uHerSkJ+rILr+ghOWn2TeC/eufRCE57T6bze2w8/NGOUx2arpkWj+hYiBrLEQ5tpQdhOXl9i9Cd22jChx7j6E49mHz03z0AeWG0UX9Ees2kSQgApX+W7BlpUf0Ubn3UxlmjONWywpE7Ao9Y566iUwSSqYn3V8g/UBaM7yhA+dAcmpa7ag8H5KYWANTq3IVa0c9bU2TwWYinY0pEvss67+jV64+rComOAaTCHBA/hIkEtdyUZ0+KOqdsCjC9sKO3cBWh4d1rlLIjMPR8G/MmMqE3K9KBNVWL9dKQdxeAm9Et+Gg6RlLFmTmpcwnqWc5y3vwVaxn7/imw41bPD4Gp+MaWHKWwdC7QAqYQAAAAtBmiRsQ3/+p4QBxwAAAAlBnkJ4hf8A84EAAAAIAZ5hdEK/AVMAAAAIAZ5jakK/AVMAAAARQZpoSahBaJlMCG///qeEAccAAAALQZ6GRREsL/8A84EAAAAIAZ6ldEK/AVMAAAAIAZ6nakK/AVMAAAARQZqsSahBbJlMCGf//p4QBswAAAALQZ7KRRUsL/8A84EAAAAIAZ7pdEK/AVMAAAAIAZ7rakK/AVMAAAASQZruSahBbJlMFEwr//44QBoxAAAACAGfDWpCvwFT";

const CONFIG: Record<Kind, { title: string; eyebrow: string; description: string; icon: string }> = {
  images: { title: "คลังภาพ", eyebrow: "STYLE & IMAGE LIBRARY", description: "เลือกสไตล์ภาพหรือ Reference โดยดูตัวอย่างก่อน ทุกการ์ดมีชื่อและคำอธิบายสั้นว่าให้ภาพแบบไหน", icon: "▧" },
  voices: { title: "คลังเสียง", eyebrow: "VOICE LIBRARY", description: "เสียงตัวละครพร้อมบุคลิกของเสียง กดฟังตัวอย่างก่อนเลือกใช้กับตัวละคร", icon: "♫" },
  characters: { title: "คลังตัวละคร", eyebrow: "CHARACTER LIBRARY", description: "ตัวละครที่ใช้ซ้ำได้ พร้อมแนวบุคลิก อายุ และ Reference Pack", icon: "◎" },
  pets: { title: "คลังสัตว์ / Creature", eyebrow: "CREATURE LIBRARY", description: "สัตว์เลี้ยง สิ่งมีชีวิตแฟนตาซี และ Robot companion สำหรับล็อกข้ามฉาก", icon: "◇" },
  ambience: { title: "คลังบรรยากาศ / SFX", eyebrow: "AMBIENCE LIBRARY", description: "บรรยากาศและเสียงรอบข้างที่ช่วยให้แต่ละฉากมีโลกและอารมณ์ชัดขึ้น", icon: "≈" },
  plots: { title: "คลังพล็อตเรื่อง", eyebrow: "PLOT LIBRARY", description: "พล็อตตั้งต้นพร้อมโทนเรื่อง เลือกแล้วนำไปแตกเป็นฉากต่อใน Creator หรือ EP ได้", icon: "✦" },
  videos: { title: "คลังวิดีโอ", eyebrow: "VIDEO LIBRARY", description: "คลิปที่สร้างเสร็จจะมาอยู่ที่นี่พร้อมชื่อ EP ชื่อตอน ระยะเวลา และปุ่มดาวน์โหลด", icon: "▸" },
};

const BUILT_INS: Record<Exclude<Kind, "videos">, BuiltIn[]> = {
  images: [
    { id: "cinematic-anime", title: "Cinematic Anime", description: "อนิเมะภาพยนตร์ แสงมีมิติ โฟกัสตัวละครและองค์ประกอบแบบหนัง", tag: "Anime • Cinematic", visual: "anime" },
    { id: "golden-hour", title: "Warm Golden Hour", description: "แสงเย็นสีทอง อบอุ่น นุ่ม เหมาะกับ Romance, Slice of Life และความทรงจำ", tag: "Warm • Emotional", visual: "golden" },
    { id: "photoreal", title: "Photorealistic Film", description: "ภาพสมจริง โทนฟิล์ม ผิวและวัสดุธรรมชาติ เหมาะกับ Drama และ Commercial", tag: "Realistic • Film", visual: "real" },
    { id: "action", title: "Action Blockbuster", description: "คอนทราสต์สูง จังหวะภาพแรง เหมาะกับ Chase, Combat และฉากพลังงานสูง", tag: "Action • Dynamic", visual: "action" },
    { id: "scifi", title: "Sci-Fi Neon", description: "เมืองอนาคต แสงนีออน โฮโลแกรมและบรรยากาศเทคโนโลยี", tag: "Sci-Fi • Neon", visual: "scifi" },
    { id: "storybook", title: "Fantasy Storybook", description: "ภาพวาดนุ่มเหมือนนิทาน เหมาะกับ Creature, Fairy Tale และโลกแฟนตาซี", tag: "Fantasy • Painterly", visual: "storybook" },
  ],
  voices: [
    { id: "mira", title: "Mira", description: "หญิง • อบอุ่น • เป็นธรรมชาติ เหมาะกับ Drama และ Slice of Life", tag: "หญิง • Warm", visual: "voice1", icon: "♫" },
    { id: "nami", title: "Nami", description: "หญิง • สดใส • วัยรุ่น เหมาะกับ Anime, Creator และ Coming-of-age", tag: "หญิง • Bright", visual: "voice2", icon: "♫" },
    { id: "arin", title: "Arin", description: "ชาย • สุขุม • ภาพยนตร์ เหมาะกับ Narration และตัวละครที่มีความนิ่ง", tag: "ชาย • Calm", visual: "voice3", icon: "♫" },
    { id: "keen", title: "Keen", description: "ชาย • หนักแน่น • แอ็กชัน เหมาะกับ Hero, Tactical และฉากเร่งจังหวะ", tag: "ชาย • Strong", visual: "voice4", icon: "♫" },
  ],
  characters: [
    { id: "char-f-01", title: "Mina — Explorer", description: "หญิงวัย 20s ใจดี ช่างสังเกต เหมาะกับ Adventure และ Slice of Life", tag: "หญิง • 22 • JP", visual: "char1", icon: "M" },
    { id: "char-m-01", title: "Rain — Calm Hero", description: "ชายวัย 20s สุขุม อ่อนโยน เหมาะกับ Drama, Romance และ Action เบา", tag: "ชาย • 24 • JP", visual: "char2", icon: "R" },
    { id: "char-scifi", title: "Nova — Android", description: "แอนดรอยด์ลุคสะอาดสำหรับ Sci-Fi พร้อมเอกลักษณ์ใบหน้าและวัสดุโลหะ", tag: "Android • Sci-Fi", visual: "char3", icon: "N" },
  ],
  pets: [
    { id: "pet-cat", title: "Mochi — แมวขาว", description: "แมวขนขาวตัวเล็ก บุคลิกขี้สงสัย ใช้เป็นสัตว์เลี้ยงประจำตัวละคร", tag: "Cat • Cute", visual: "pet1", icon: "🐈" },
    { id: "pet-fox", title: "Hoshi — จิ้งจอกแฟนตาซี", description: "จิ้งจอกตัวเล็กมีแสงเรือง เหมาะกับ Fantasy และ Storybook", tag: "Fox • Fantasy", visual: "pet2", icon: "🦊" },
    { id: "pet-robot", title: "PICO — Robot Companion", description: "หุ่นเพื่อนตัวเล็กสำหรับ Sci-Fi มีไฟสถานะและสเกลคงที่", tag: "Robot • Sci-Fi", visual: "pet3", icon: "◉" },
  ],
  ambience: [
    { id: "amb-city", title: "เมืองตอนเย็น", description: "เสียงรถเบา ฝีเท้า ลม และผู้คนไกล ๆ สำหรับฉากเมืองที่ไม่วุ่นวาย", tag: "City • Evening", visual: "amb1", icon: "≈" },
    { id: "amb-rain", title: "ฝนตกริมหน้าต่าง", description: "ฝนต่อเนื่อง หยดน้ำ และบรรยากาศปิด เหมาะกับ Drama และ Romance", tag: "Rain • Emotional", visual: "amb2", icon: "≈" },
    { id: "amb-space", title: "ยานอวกาศ", description: "เสียงระบบ เครื่องจักรต่ำ และ ambience ล้ำยุคสำหรับ Sci-Fi interior", tag: "Space • Tech", visual: "amb3", icon: "≈" },
  ],
  plots: [
    { id: "plot-creature", title: "พบสิ่งมีชีวิตลึกลับ", description: "ตัวเอกพบ Creature ระหว่างทาง ก่อนความกลัวเปลี่ยนเป็นมิตรภาพ", tag: "Fantasy • Friendship", visual: "plot1", icon: "01" },
    { id: "plot-future", title: "รักในเมืองอนาคต", description: "ความสัมพันธ์ของคนสองคนท่ามกลางเมือง AI และเทคโนโลยีที่ควบคุมความทรงจำ", tag: "Sci-Fi • Romance", visual: "plot2", icon: "02" },
    { id: "plot-chase", title: "ภารกิจไล่ล่ากลางคืน", description: "ตัวละครต้องนำข้อมูลสำคัญข้ามเมืองก่อนเวลาหมด พร้อม Action หลายช่วง", tag: "Action • Thriller", visual: "plot3", icon: "03" },
  ],
};

function playVoice(label: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(`สวัสดีค่ะ นี่คือตัวอย่างเสียง ${label} จาก SCENOVA`);
  u.lang = "th-TH";
  window.speechSynthesis.speak(u);
}

export default function LibraryCategory({ kind }: { kind: string }) {
  const safeKind = (Object.keys(CONFIG).includes(kind) ? kind : "images") as Kind;
  const config = CONFIG[safeKind];
  const [apiItems, setApiItems] = useState<ApiItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);

  useEffect(() => {
    if (safeKind === "videos") {
      try {
        const raw = localStorage.getItem("scenova-video-library-v1");
        const parsed = raw ? JSON.parse(raw) as VideoItem[] : [];
        setVideos(parsed.length ? parsed : [{ id: "sample-ep1", ep: 1, epTitle: "พบเพื่อนตัวเล็ก", projectTitle: "เด็กหญิงกับสิ่งมีชีวิตลึกลับ", duration: 30, createdAt: new Date().toISOString(), url: SAMPLE_VIDEO, status: "completed" }]);
      } catch {
        setVideos([]);
      }
      return;
    }
    fetch("/api/library", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setApiItems((data.items || []).filter((item: ApiItem) => item.kind === safeKind)))
      .catch(() => setApiItems([]));
  }, [safeKind]);

  const builtIns = useMemo(() => safeKind === "videos" ? [] : BUILT_INS[safeKind], [safeKind]);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.icon}>{config.icon}</div>
        <div><span>{config.eyebrow}</span><h1>{config.title}</h1><p>{config.description}</p></div>
        <Link href="/libraries" className={styles.back}>← ภาพรวมคลัง</Link>
      </header>

      {safeKind === "videos" ? (
        <section className={styles.videoGrid}>
          {videos.map((video) => (
            <article className={styles.videoCard} key={video.id}>
              <div className={styles.videoFrame}>{video.url ? <video controls preload="metadata" src={video.url} /> : <div>กำลังรอไฟล์จาก Video Provider</div>}</div>
              <div className={styles.videoMeta}><span>EP.{String(video.ep).padStart(2, "0")}</span><span>{video.duration}s</span><span>{video.status === "completed" ? "สร้างเสร็จ" : "กำลังประมวลผล"}</span></div>
              <h2>EP.{String(video.ep).padStart(2, "0")} — {video.epTitle}</h2>
              <p>{video.projectTitle}</p>
              <small>สร้างเมื่อ {new Date(video.createdAt).toLocaleString("th-TH")}</small>
              <div className={styles.cardActions}>
                {video.url ? <a href={video.url} download={`SCENOVA_EP${String(video.ep).padStart(2, "0")}_${video.epTitle}.mp4`}>↓ ดาวน์โหลดวิดีโอ</a> : <button disabled>รอไฟล์วิดีโอ</button>}
                <Link href="/series">กลับไป EP</Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <>
          <section className={styles.grid}>
            {builtIns.map((item) => (
              <article className={styles.card} key={item.id}>
                <div className={`${styles.preview} ${styles[item.visual] || ""}`}>{item.icon ? <span>{item.icon}</span> : <span className={styles.previewTitle}>{item.title}</span>}</div>
                <div className={styles.cardBody}><span className={styles.tag}>{item.tag}</span><h2>{item.title}</h2><p>{item.description}</p><div className={styles.cardActions}>{safeKind === "voices" ? <button onClick={() => playVoice(item.title)}>▶ ฟังตัวอย่าง</button> : <button>ใช้รายการนี้</button>}</div></div>
              </article>
            ))}
          </section>

          {apiItems.length > 0 ? <section className={styles.adminSection}><div className={styles.sectionHead}><h2>รายการที่ Admin เพิ่ม</h2><span>{apiItems.length} รายการ</span></div><div className={styles.grid}>{apiItems.map((item) => <article className={styles.card} key={item.id}>{item.assetUrl && safeKind === "images" ? <img className={styles.uploadedImage} src={item.assetUrl} alt={item.title} /> : <div className={`${styles.preview} ${styles.uploaded}`}><span>{config.icon}</span></div>}<div className={styles.cardBody}><span className={styles.tag}>Admin Library</span><h2>{item.title}</h2><p>{item.description}</p><div className={styles.cardActions}>{safeKind === "voices" ? <button onClick={() => playVoice(item.title)}>▶ ฟังตัวอย่าง</button> : <button>ใช้รายการนี้</button>}</div></div></article>)}</div></section> : null}
        </>
      )}
    </main>
  );
}
