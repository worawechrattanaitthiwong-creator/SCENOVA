"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./library-category.module.css";

type Kind = "images" | "voices" | "characters" | "pets" | "ambience" | "plots" | "videos";
type ApiItem = { id: string; kind: string; title: string; description: string; assetUrl?: string };
type BuiltIn = { id: string; title: string; description: string; tag: string; visual: string; icon?: string; image?: string };
type VideoItem = { id: string; ep: number; epTitle: string; projectTitle: string; duration: number; createdAt: string; url?: string; status: "completed" | "processing" };

const SAMPLE_VIDEO = "/api/mock-video?ep=1";

const CONFIG: Record<Kind, { title: string; eyebrow: string; description: string; icon: string }> = {
  images: { title: "คลังภาพและสไตล์", eyebrow: "STYLE & IMAGE LIBRARY", description: "ดูตัวอย่างภาพจริงของแต่ละสไตล์ก่อนเลือกใช้ เพื่อให้เห็นโทน แสง สี และภาษาภาพที่แตกต่างกันอย่างชัดเจน", icon: "▧" },
  voices: { title: "คลังเสียง", eyebrow: "VOICE LIBRARY", description: "เสียงตัวละครพร้อมบุคลิกของเสียง กดฟังตัวอย่างก่อนเลือกใช้กับตัวละคร", icon: "♫" },
  characters: { title: "คลังตัวละคร", eyebrow: "CHARACTER LIBRARY", description: "ตัวละครที่ใช้ซ้ำได้ พร้อมแนวบุคลิก อายุ และ Reference Pack", icon: "◎" },
  pets: { title: "คลังสัตว์ / Creature", eyebrow: "CREATURE LIBRARY", description: "สัตว์เลี้ยง สิ่งมีชีวิตแฟนตาซี และ Robot companion สำหรับล็อกข้ามฉาก", icon: "◇" },
  ambience: { title: "คลังบรรยากาศ / SFX", eyebrow: "AMBIENCE LIBRARY", description: "บรรยากาศและเสียงรอบข้างที่ช่วยให้แต่ละฉากมีโลกและอารมณ์ชัดขึ้น", icon: "≈" },
  plots: { title: "คลังพล็อตเรื่อง", eyebrow: "PLOT LIBRARY", description: "พล็อตตั้งต้นพร้อมโทนเรื่อง เลือกแล้วนำไปแตกเป็น Scene ต่อใน Studio หรือ Series ได้", icon: "✦" },
  videos: { title: "คลังวิดีโอ", eyebrow: "VIDEO LIBRARY", description: "คลิปที่สร้างเสร็จจะมาอยู่ที่นี่พร้อมชื่อ Episode ชื่อตอน ระยะเวลา และปุ่มดาวน์โหลด", icon: "▸" },
};

const BUILT_INS: Record<Exclude<Kind, "videos">, BuiltIn[]> = {
  images: [
    { id: "cinematic-anime", title: "Cinematic Anime", description: "อนิเมะภาพยนตร์ แสงมีมิติ โฟกัสตัวละครและองค์ประกอบแบบหนัง เหมาะกับ Anime, Coming-of-age และ Fantasy", tag: "Anime • Cinematic", visual: "anime", image: "/library/styles/cinematic-anime.jpg" },
    { id: "golden-hour", title: "Warm Golden Hour", description: "แสงเย็นสีทอง อบอุ่น นุ่ม เหมาะกับ Romance, Slice of Life และฉากความทรงจำ", tag: "Warm • Emotional", visual: "golden", image: "/library/styles/warm-golden-hour.jpg" },
    { id: "photoreal", title: "Photorealistic Film", description: "ภาพสมจริงแบบภาพยนตร์ ผิว วัสดุ และแสงเป็นธรรมชาติ เหมาะกับ Drama, Commercial และงานเล่าเรื่องจริงจัง", tag: "Realistic • Film", visual: "real", image: "/library/styles/photorealistic-film.jpg" },
    { id: "action", title: "Action Blockbuster", description: "ภาพพลังงานสูง คอนทราสต์แรง การเคลื่อนไหวชัด เหมาะกับ Chase, Combat และฉากแอ็กชันขนาดใหญ่", tag: "Action • Dynamic", visual: "action", image: "/library/styles/action-blockbuster.jpg" },
    { id: "scifi", title: "Sci-Fi Neon", description: "เมืองอนาคต เทคโนโลยี แสงนีออนและโครงสร้างล้ำยุค เหมาะกับ Cyberpunk, Space Opera และ Future World", tag: "Sci-Fi • Neon", visual: "scifi", image: "/library/styles/sci-fi-neon.jpg" },
    { id: "storybook", title: "Fantasy Storybook", description: "โลกแฟนตาซีขนาดใหญ่ แสงเหนือจริงและภูมิทัศน์มหัศจรรย์ เหมาะกับ Adventure, Creature และ Epic Fantasy", tag: "Fantasy • Epic", visual: "storybook", image: "/library/styles/fantasy-storybook.jpg" },
    { id: "dark-thriller", title: "Dark Thriller", description: "ตรอกกลางคืนเปียกฝน แสงน้อย คอนทราสต์จัด เหมาะกับ Crime, Mystery, Noir และ Suspense", tag: "Thriller • Noir", visual: "action", image: "/library/styles/dark-thriller.jpg" },
    { id: "gothic-horror", title: "Gothic Horror", description: "คฤหาสน์โกธิก หมอกกลางคืนและโทนเย็นลึกลับ เหมาะกับ Horror, Supernatural และ Dark Fantasy", tag: "Gothic • Horror", visual: "real", image: "/library/styles/gothic-horror.jpg" },
    { id: "cinematic-romance", title: "Cinematic Romance", description: "โทนอุ่นยามอาทิตย์ตก ชัดตื้นและอารมณ์ใกล้ชิด เหมาะกับ Romance, Relationship และ Emotional Drama", tag: "Romance • Warm", visual: "golden", image: "/library/styles/cinematic-romance.jpg" },
    { id: "period-drama", title: "Period Drama", description: "งานย้อนยุคหรูหรา เครื่องแต่งกายและสถาปัตยกรรมละเอียด เหมาะกับ Historical, Royal Drama และ Costume Film", tag: "Period • Elegant", visual: "storybook", image: "/library/styles/period-drama.jpg" },
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
  const utterance = new SpeechSynthesisUtterance(`สวัสดีค่ะ นี่คือตัวอย่างเสียง ${label} จาก SCENOVA`);
  utterance.lang = "th-TH";
  window.speechSynthesis.speak(utterance);
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
        const parsed = raw ? (JSON.parse(raw) as VideoItem[]) : [];
        setVideos(parsed.length ? parsed : [{ id: "sample-ep1", ep: 1, epTitle: "พบเพื่อนตัวเล็ก", projectTitle: "เด็กหญิงกับสิ่งมีชีวิตลึกลับ", duration: 30, createdAt: new Date().toISOString(), url: SAMPLE_VIDEO, status: "completed" }]);
      } catch {
        setVideos([]);
      }
      return;
    }

    fetch("/api/library", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setApiItems((data.items || []).filter((item: ApiItem) => item.kind === safeKind)))
      .catch(() => setApiItems([]));
  }, [safeKind]);

  const builtIns = useMemo(() => (safeKind === "videos" ? [] : BUILT_INS[safeKind]), [safeKind]);

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
                <Link href="/series">กลับไป Series</Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <>
          <section className={styles.grid}>
            {builtIns.map((item) => (
              <article className={styles.card} key={item.id}>
                {item.image ? <img className={styles.uploadedImage} src={item.image} alt={`ตัวอย่างสไตล์ ${item.title}`} loading="lazy" /> : <div className={`${styles.preview} ${styles[item.visual] || ""}`}>{item.icon ? <span>{item.icon}</span> : <span className={styles.previewTitle}>{item.title}</span>}</div>}
                <div className={styles.cardBody}>
                  <span className={styles.tag}>{item.tag}</span><h2>{item.title}</h2><p>{item.description}</p>
                  <div className={styles.cardActions}>{safeKind === "voices" ? <button onClick={() => playVoice(item.title)}>▶ ฟังตัวอย่าง</button> : <button>{safeKind === "images" ? "ใช้สไตล์นี้" : "ใช้รายการนี้"}</button>}</div>
                </div>
              </article>
            ))}
          </section>

          {apiItems.length > 0 ? <section className={styles.adminSection}><div className={styles.sectionHead}><h2>รายการที่ Admin เพิ่ม</h2><span>{apiItems.length} รายการ</span></div><div className={styles.grid}>{apiItems.map((item) => <article className={styles.card} key={item.id}>{item.assetUrl && safeKind === "images" ? <img className={styles.uploadedImage} src={item.assetUrl} alt={item.title} /> : <div className={`${styles.preview} ${styles.uploaded}`}><span>{config.icon}</span></div>}<div className={styles.cardBody}><span className={styles.tag}>Admin Library</span><h2>{item.title}</h2><p>{item.description}</p><div className={styles.cardActions}>{safeKind === "voices" ? <button onClick={() => playVoice(item.title)}>▶ ฟังตัวอย่าง</button> : <button>{safeKind === "images" ? "ใช้สไตล์นี้" : "ใช้รายการนี้"}</button>}</div></div></article>)}</div></section> : null}
        </>
      )}
    </main>
  );
}
