"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./library-hub.module.css";

type Tab = "images" | "voices" | "characters" | "pets" | "ambience" | "plots" | "videos";
type ApiItem = { id: string; kind: string; title: string; description: string; assetUrl?: string };
type VideoItem = { id: string; ep: number; epTitle: string; projectTitle: string; duration: number; createdAt: string; url?: string; status: "completed" | "processing" };
type Item = { id: string; title: string; description: string; tag: string; visual: string; icon: string; url?: string; ep?: number; duration?: number };

const TABS: { id: Tab; label: string; desc: string; icon: string }[] = [
  { id: "images", label: "ภาพ & สไตล์", desc: "Style และ Reference", icon: "▧" },
  { id: "voices", label: "เสียง", desc: "Voice Preset", icon: "♫" },
  { id: "characters", label: "ตัวละคร", desc: "Character Pack", icon: "◎" },
  { id: "pets", label: "สัตว์ / Creature", desc: "Companion", icon: "◇" },
  { id: "ambience", label: "บรรยากาศ / SFX", desc: "Soundscape", icon: "≈" },
  { id: "plots", label: "พล็อต", desc: "Story Seed", icon: "✦" },
  { id: "videos", label: "วิดีโอ", desc: "Generated EP", icon: "▶" },
];

const BUILTIN: Record<Exclude<Tab, "videos">, Item[]> = {
  images: [
    { id: "anime", title: "Cinematic Anime", description: "อนิเมะภาพยนตร์ แสงมีมิติ เหมาะกับเรื่องเล่าและฉากอารมณ์", tag: "Anime • Cinematic", visual: "anime", icon: "✦" },
    { id: "golden", title: "Warm Golden Hour", description: "แสงเย็นสีทอง อบอุ่น นุ่ม เหมาะกับ Romance และ Slice of Life", tag: "Warm • Emotional", visual: "golden", icon: "☀" },
    { id: "real", title: "Photorealistic Film", description: "ภาพสมจริงโทนฟิล์ม ผิวและวัสดุเป็นธรรมชาติ", tag: "Realistic • Film", visual: "real", icon: "◫" },
    { id: "action", title: "Action Blockbuster", description: "ภาพคอนทราสต์สูง จังหวะเร็ว เหมาะกับ Chase และ Combat", tag: "Action • Dynamic", visual: "action", icon: "⚡" },
    { id: "scifi", title: "Sci‑Fi Future", description: "เมืองอนาคต เทคโนโลยี แสงคม และบรรยากาศไซไฟ", tag: "Sci‑Fi • Future", visual: "scifi", icon: "⬡" },
  ],
  voices: [
    { id: "mira", title: "Mira", description: "หญิง • อบอุ่น • เป็นธรรมชาติ เหมาะกับ Drama และ Slice of Life", tag: "หญิง • Warm", visual: "voice", icon: "♫" },
    { id: "nami", title: "Nami", description: "หญิง • สดใส • วัยรุ่น เหมาะกับ Anime และ Coming‑of‑age", tag: "หญิง • Bright", visual: "voice", icon: "♫" },
    { id: "arin", title: "Arin", description: "ชาย • สุขุม • ภาพยนตร์ เหมาะกับ Narration และตัวละครนิ่ง", tag: "ชาย • Calm", visual: "voice", icon: "♫" },
    { id: "keen", title: "Keen", description: "ชาย • หนักแน่น • แอ็กชัน เหมาะกับ Hero และ Tactical", tag: "ชาย • Strong", visual: "voice", icon: "♫" },
  ],
  characters: [
    { id: "char1", title: "Female Cinematic", description: "ตัวละครหญิงสมจริงสำหรับ Drama / Commercial พร้อม Reference Pack", tag: "Female • Realistic", visual: "character", icon: "◎" },
    { id: "char2", title: "Male Cinematic", description: "ตัวละครชายโทนภาพยนตร์ เหมาะกับ Drama / Action", tag: "Male • Realistic", visual: "character", icon: "◎" },
    { id: "char3", title: "Anime Heroine", description: "ตัวละครอนิเมะหญิง โทนอ่อนโยนและแสดงอารมณ์ชัด", tag: "Anime • Female", visual: "character", icon: "◎" },
  ],
  pets: [
    { id: "pet1", title: "แมว", description: "สัตว์เลี้ยงทั่วไป เหมาะกับ Slice of Life และ Family", tag: "Pet • Cat", visual: "pet", icon: "◇" },
    { id: "pet2", title: "Fantasy Creature", description: "สิ่งมีชีวิตแฟนตาซีตัวเล็กสำหรับเรื่องผจญภัยและมิตรภาพ", tag: "Fantasy • Creature", visual: "pet", icon: "◇" },
    { id: "pet3", title: "Robot Companion", description: "หุ่นยนต์คู่หูขนาดเล็กสำหรับ Sci‑Fi และ Future City", tag: "Sci‑Fi • Robot", visual: "pet", icon: "◇" },
  ],
  ambience: [
    { id: "amb1", title: "ฝนในเมือง", description: "ฝนตกเบา ๆ ถนนเปียก รถไกล ๆ เหมาะกับ Drama และ Mystery", tag: "Rain • City", visual: "ambience", icon: "≈" },
    { id: "amb2", title: "เมืองยามค่ำ", description: "เสียงเมือง รถ ผู้คน และบรรยากาศกลางคืน", tag: "Urban • Night", visual: "ambience", icon: "≈" },
    { id: "amb3", title: "ป่าเงียบ", description: "ลม ใบไม้ นก และเสียงธรรมชาติ เหมาะกับ Fantasy / Adventure", tag: "Forest • Nature", visual: "ambience", icon: "≈" },
  ],
  plots: [
    { id: "plot1", title: "พบสิ่งมีชีวิตลึกลับ", description: "มิตรภาพเริ่มจากการพบกันโดยบังเอิญ เหมาะกับ Fantasy Short Film", tag: "Fantasy • Friendship", visual: "plot", icon: "✦" },
    { id: "plot2", title: "ความลับในเมืองอนาคต", description: "ตัวละครค้นพบข้อมูลที่เปลี่ยนความจริงของเมืองทั้งเมือง", tag: "Sci‑Fi • Mystery", visual: "plot", icon: "✦" },
    { id: "plot3", title: "ภารกิจไล่ล่า", description: "เป้าหมายชัด จังหวะเร็ว มี Chase และจุดพลิกกลางเรื่อง", tag: "Action • Chase", visual: "plot", icon: "✦" },
  ],
};

export default function LibrariesPage() {
  const params = useSearchParams();
  const requested = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(TABS.some((item) => item.id === requested) ? requested! : "images");
  const [apiItems, setApiItems] = useState<ApiItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => { if (requested && TABS.some((item) => item.id === requested)) setTab(requested); }, [requested]);
  useEffect(() => { fetch("/api/library", { cache: "no-store" }).then((r) => r.json()).then((data) => setApiItems(data.items || [])).catch(() => setApiItems([])); }, []);
  useEffect(() => {
    const load = () => { try { setVideos(JSON.parse(localStorage.getItem("scenova-video-library-v1") || "[]")); } catch { setVideos([]); } };
    load(); window.addEventListener("scenova-video-library-updated", load); return () => window.removeEventListener("scenova-video-library-updated", load);
  }, []);

  const current = TABS.find((item) => item.id === tab)!;
  const items = useMemo<Item[]>(() => {
    if (tab === "videos") return videos.map((video) => ({ id: video.id, title: `EP.${String(video.ep).padStart(2, "0")} — ${video.epTitle}`, description: `${video.projectTitle} • ${video.duration} วินาที`, tag: video.status === "completed" ? "สร้างเสร็จแล้ว" : "กำลังประมวลผล", visual: "video", icon: "▶", url: video.url, ep: video.ep, duration: video.duration }));
    const builtins = BUILTIN[tab];
    const admin = apiItems.filter((item) => item.kind === tab).map((item) => ({ id: item.id, title: item.title, description: item.description, tag: "SCENOVA Library", visual: tab === "voices" ? "voice" : tab === "characters" ? "character" : tab === "pets" ? "pet" : tab === "ambience" ? "ambience" : tab === "plots" ? "plot" : "anime", icon: current.icon, url: item.assetUrl }));
    return [...builtins, ...admin];
  }, [tab, videos, apiItems, current.icon]);

  const filtered = items.filter((item) => `${item.title} ${item.description} ${item.tag}`.toLowerCase().includes(search.toLowerCase()));

  function playVoice(title: string) { if (!("speechSynthesis" in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(`สวัสดีค่ะ นี่คือตัวอย่างเสียง ${title} จาก SCENOVA`); u.lang = "th-TH"; speechSynthesis.speak(u); }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div><span>SCENOVA LIBRARY</span><h1>คลังเดียว เลือกประเภทที่ต้องการ</h1><p>ไม่ต้องไล่หลายเมนู ทุก Asset อยู่ในพื้นที่เดียว แล้วเลือกประเภทด้านล่างว่าจะดูภาพ เสียง ตัวละคร สัตว์ บรรยากาศ พล็อต หรือวิดีโอที่สร้างเสร็จ</p></div>
        <Link className={styles.adminLink} href="/admin">Admin จัดการคลัง →</Link>
      </header>

      <div className={styles.tabs}>{TABS.map((item) => <button key={item.id} className={tab === item.id ? styles.active : ""} onClick={() => setTab(item.id)}>{item.icon} {item.label}</button>)}</div>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><h2>{current.label}</h2><p>{current.desc} — เลือกดูตัวอย่างก่อนนำไปใช้ใน Creator หรือ EP</p></div><small>{filtered.length} รายการ</small></div>
        <div className={styles.toolbar}><input className={styles.search} placeholder={`ค้นหาใน${current.label}...`} value={search} onChange={(e) => setSearch(e.target.value)} /><span className={styles.count}>คลิกการ์ดเพื่อดูรูปแบบก่อนใช้</span></div>
        <div className={styles.grid}>
          {filtered.map((item) => (
            <article className={styles.card} key={item.id}>
              <div className={`${styles.preview} ${styles[item.visual as keyof typeof styles] || ""}`} style={item.url && tab !== "videos" ? { backgroundImage: `url(${item.url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}><span className={styles.previewIcon}>{item.icon}</span></div>
              <div className={styles.content}><b>{item.title}</b><p>{item.description}</p><span className={styles.tag}>{item.tag}</span>
                {tab === "videos" ? <div className={styles.videoMeta}><span>EP {item.ep}</span><span>{item.duration}s</span></div> : null}
                <div className={styles.actions}>
                  {tab === "voices" ? <button onClick={() => playVoice(item.title)}>▶ ฟังตัวอย่าง</button> : tab === "videos" && item.url ? <a className={styles.primary} href={item.url} download={`SCENOVA-${item.title}.mp4`}>↓ ดาวน์โหลด</a> : <button className={styles.primary}>ใช้รายการนี้</button>}
                  {tab !== "videos" ? <button>ดูรายละเอียด</button> : null}
                </div>
              </div>
            </article>
          ))}
          {filtered.length === 0 ? <div className={styles.empty}>ยังไม่มีรายการที่ตรงกับคำค้นหา</div> : null}
        </div>
      </section>
    </main>
  );
}
