"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./library-hub.module.css";

type Tab = "images" | "voices" | "characters" | "pets" | "ambience" | "plots" | "videos";
type LibraryMetadata = { visualLanguage?: string; lighting?: string; colorMood?: string; bestFor?: string; promptHint?: string; referenceUsage?: string; compatibility?: string; lockNote?: string };
type ApiItem = { id: string; kind: string; title: string; description: string; assetUrl?: string; source?: "SYSTEM" | "ADMIN"; metadata?: LibraryMetadata; createdAt?: string };
type VideoItem = { id: string; ep: number; epTitle: string; projectTitle: string; duration: number; createdAt: string; url?: string; status: "completed" | "processing" };
type Item = { id: string; title: string; description: string; tag: string; visual: string; icon: string; url?: string; ep?: number; duration?: number; source?: string; metadata?: LibraryMetadata };
type DetailInfo = { typeLabel: string; visualLanguage: string; lighting: string; colorMood: string; bestFor: string; promptHint: string; referenceUsage: string; compatibility: string; lockNote: string };

const TABS: { id: Tab; label: string; desc: string; icon: string }[] = [
  { id: "images", label: "ภาพ & สไตล์", desc: "Style และ Reference", icon: "▧" },
  { id: "voices", label: "เสียง", desc: "Voice Preset", icon: "♫" },
  { id: "characters", label: "ตัวละคร", desc: "Character Pack", icon: "◎" },
  { id: "pets", label: "สัตว์ / Creature", desc: "Companion", icon: "◇" },
  { id: "ambience", label: "บรรยากาศ / SFX", desc: "Soundscape", icon: "≈" },
  { id: "plots", label: "พล็อต", desc: "Story Seed", icon: "✦" },
  { id: "videos", label: "วิดีโอ", desc: "Generated EP", icon: "▶" },
];

const isTab = (value: string | null): value is Tab => TABS.some((item) => item.id === value);

function visualFor(tab: Tab) {
  if (tab === "voices") return "voice";
  if (tab === "characters") return "character";
  if (tab === "pets") return "pet";
  if (tab === "ambience") return "ambience";
  if (tab === "plots") return "plot";
  return "anime";
}

function typeLabel(tab: Tab) {
  if (tab === "images") return "Visual Style / Image Reference — สไตล์ภาพและภาพอ้างอิง";
  if (tab === "voices") return "Voice Preset — โปรไฟล์เสียง";
  if (tab === "characters") return "Character Reference Pack — ชุดอ้างอิงตัวละคร";
  if (tab === "pets") return "Creature / Companion Reference — อ้างอิงสัตว์และสิ่งมีชีวิต";
  if (tab === "ambience") return "Ambience / SFX — บรรยากาศและเสียงประกอบ";
  return "Story Seed — พล็อตตั้งต้น";
}

function detailFor(tab: Tab, item: Item): DetailInfo {
  const metadata = item.metadata || {};
  const common = {
    compatibility: metadata.compatibility || "ใช้กับโมเดลที่รองรับ Asset / Reference ประเภทนี้ โดย Model Center จะตรวจความสามารถจริงของ Provider ก่อน Generate",
    lockNote: metadata.lockNote || "เมื่อนำไปใช้ใน Production สามารถเปิด Lock ที่เกี่ยวข้องเพื่อรักษาความต่อเนื่องข้าม Scene / Episode ได้",
  };
  if (tab === "images") return {
    typeLabel: typeLabel(tab),
    visualLanguage: metadata.visualLanguage || "ใช้เป็นภาษาภาพหลักเพื่อกำหนดทิศทางภาพ องค์ประกอบ และบรรยากาศของ Production",
    lighting: metadata.lighting || "ระบบจะนำแนวทางแสงจาก Reference ไปประกอบ Prompt โดยยังปรับใน Director Pro ได้",
    colorMood: metadata.colorMood || "ปรับตามภาพอ้างอิงและ Mood ของ Production",
    bestFor: metadata.bestFor || "Studio และ Series ที่ต้องการกำหนด Visual Language ให้ชัดตั้งแต่ต้น",
    promptHint: metadata.promptHint || `ใช้ ${item.title} เป็น Visual Style หลัก รักษาโทนภาพและอารมณ์ให้ต่อเนื่องตลอด Scene`,
    referenceUsage: metadata.referenceUsage || "เลือกเป็น Style Reference เพื่อใช้คุมโทนทั้ง Production หรือใช้เป็น Image Reference เฉพาะ Scene ได้",
    ...common,
  };
  if (tab === "voices") return { typeLabel: typeLabel(tab), visualLanguage: "กำหนดบุคลิก น้ำหนัก และลักษณะการพูดของตัวละคร", lighting: "ไม่เกี่ยวข้องกับภาพโดยตรง", colorMood: "ใช้ Emotion / Performance Direction ควบคุมอารมณ์การพูด", bestFor: metadata.bestFor || item.description, promptHint: metadata.promptHint || `ใช้เสียง ${item.title} และรักษาบุคลิกเสียงให้คงที่ตลอดบทสนทนา`, referenceUsage: metadata.referenceUsage || "ผูกกับ Character แล้วเปิด Voice Lock เพื่อรักษาเสียงเดิมข้าม Scene / Episode", ...common };
  if (tab === "characters") return { typeLabel: typeLabel(tab), visualLanguage: metadata.visualLanguage || "ใช้กำหนดใบหน้า รูปร่าง อายุ บุคลิก และเอกลักษณ์ของตัวละคร", lighting: metadata.lighting || "Reference ควรเห็นลักษณะตัวละครชัดและไม่ถูกแสงเปลี่ยนรูปหน้ามากเกินไป", colorMood: metadata.colorMood || "สีผิว เสื้อผ้า ทรงผม และรายละเอียดประจำตัวควรคงที่", bestFor: metadata.bestFor || item.description, promptHint: metadata.promptHint || `รักษา Character Identity ของ ${item.title} ให้ตรง Reference ทุก Scene`, referenceUsage: metadata.referenceUsage || "ใช้เป็น Character Reference และเปิด Character Lock; Costume สามารถล็อกแยกต่างหาก", ...common };
  if (tab === "pets") return { typeLabel: typeLabel(tab), visualLanguage: metadata.visualLanguage || "กำหนดสายพันธุ์ รูปร่าง สัดส่วน พื้นผิว และเอกลักษณ์ของ Creature", lighting: metadata.lighting || "ควรรักษาการอ่าน Silhouette และ Texture ให้ชัดในทุกสภาพแสง", colorMood: metadata.colorMood || "สีขน ผิว วัสดุ ดวงตา และจุดเด่นประจำตัวต้องต่อเนื่อง", bestFor: metadata.bestFor || item.description, promptHint: metadata.promptHint || `รักษารูปร่าง สเกล สี และรายละเอียดของ ${item.title} ให้เหมือนเดิมทุก Scene`, referenceUsage: metadata.referenceUsage || "ใช้เป็น Creature Reference และผูกกับ Continuity เพื่อรักษาสเกลและรูปลักษณ์", ...common };
  if (tab === "ambience") return { typeLabel: typeLabel(tab), visualLanguage: "ใช้สร้างโลกของฉากผ่านเสียงพื้นหลังและรายละเอียดเสียงแวดล้อม", lighting: "ไม่เกี่ยวข้องกับภาพโดยตรง", colorMood: "อารมณ์เสียงควรสัมพันธ์กับ Mood และจังหวะของ Scene", bestFor: metadata.bestFor || item.description, promptHint: metadata.promptHint || `ใช้บรรยากาศ ${item.title} เป็น Sound Bed และรักษาระดับเสียงไม่ให้กลบบทสนทนา`, referenceUsage: metadata.referenceUsage || "ใช้เป็น Ambience Layer ของ Scene และปรับเพิ่ม SFX เฉพาะเหตุการณ์ได้", ...common };
  return { typeLabel: typeLabel(tab), visualLanguage: "ใช้เป็นแกนเรื่องเพื่อให้ AI Director / Scene Planner แตกเป็น Scene Objective, Beat และ Transition", lighting: "กำหนดภายหลังตาม Visual Style และอารมณ์ของแต่ละ Scene", colorMood: "อารมณ์หลักขึ้นอยู่กับ Genre และพัฒนาการของเรื่อง", bestFor: metadata.bestFor || item.description, promptHint: metadata.promptHint || `ใช้พล็อต ${item.title} เป็นแกนหลัก แล้วแตกเหตุการณ์ให้มี Setup, Development และ Payoff ชัดเจน`, referenceUsage: metadata.referenceUsage || "ส่งไป Studio หรือ Series เพื่อใช้เป็น Story Premise แล้วปรับรายละเอียดก่อน Generate", ...common };
}

export default function LibrariesPage() {
  const [tab, setTab] = useState<Tab>("images");
  const [apiItems, setApiItems] = useState<ApiItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [imagePreview, setImagePreview] = useState<Item | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const syncFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const queryTab = params.get("tab");
      const hashTab = window.location.hash.replace("#", "");
      if (isTab(queryTab)) setTab(queryTab);
      else if (isTab(hashTab)) setTab(hashTab);
    };
    syncFromLocation();
    window.addEventListener("hashchange", syncFromLocation);
    window.addEventListener("popstate", syncFromLocation);
    return () => { window.removeEventListener("hashchange", syncFromLocation); window.removeEventListener("popstate", syncFromLocation); };
  }, []);

  useEffect(() => {
    fetch("/api/library", { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "LIBRARY_UNAVAILABLE"); return data; })
      .then((data) => { setApiItems(data.items || []); setLoadError(""); })
      .catch(() => { setApiItems([]); setLoadError("โหลด Asset Library ไม่สำเร็จ กรุณาตรวจสอบ Database migration"); });
  }, []);

  useEffect(() => {
    const load = () => { try { setVideos(JSON.parse(localStorage.getItem("scenova-video-library-v1") || "[]")); } catch { setVideos([]); } };
    load(); window.addEventListener("scenova-video-library-updated", load); return () => window.removeEventListener("scenova-video-library-updated", load);
  }, []);

  useEffect(() => {
    if (!selectedItem && !imagePreview) return;
    const previous = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (imagePreview) setImagePreview(null); else setSelectedItem(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [selectedItem, imagePreview]);

  const current = TABS.find((item) => item.id === tab)!;
  const items = useMemo<Item[]>(() => {
    if (tab === "videos") return videos.map((video) => ({ id: video.id, title: `EP.${String(video.ep).padStart(2, "0")} — ${video.epTitle}`, description: `${video.projectTitle} • ${video.duration} วินาที`, tag: video.status === "completed" ? "สร้างเสร็จแล้ว" : "กำลังประมวลผล", visual: "video", icon: "▶", url: video.url, ep: video.ep, duration: video.duration }));
    return apiItems.filter((item) => item.kind === tab).map((item) => ({ id: item.id, title: item.title, description: item.description, tag: item.source === "SYSTEM" ? "SCENOVA Style" : "Admin Asset", visual: visualFor(tab), icon: current.icon, url: item.assetUrl, source: item.source, metadata: item.metadata }));
  }, [tab, videos, apiItems, current.icon]);

  const filtered = items.filter((item) => `${item.title} ${item.description} ${item.tag}`.toLowerCase().includes(search.toLowerCase()));
  const selectedDetail = selectedItem ? detailFor(tab, selectedItem) : null;

  function selectTab(next: Tab) {
    setTab(next); setSearch(""); setSelectedItem(null); setImagePreview(null);
    const url = new URL(window.location.href); url.searchParams.set("tab", next); url.hash = ""; window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function playVoice(title: string) { if (!("speechSynthesis" in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(`สวัสดีค่ะ นี่คือตัวอย่างเสียง ${title} จาก SCENOVA`); u.lang = "th-TH"; speechSynthesis.speak(u); }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div><span>SCENOVA LIBRARY</span><h1>คลังเดียว เลือกประเภทที่ต้องการ</h1><p>รายการในหน้านี้ซิงก์กับ Admin Console โดยตรง Admin เพิ่มหรือลบแล้วคลังผู้ใช้จะเปลี่ยนตามจริง</p></div>
        <Link className={styles.adminLink} href="/admin">Admin จัดการคลัง →</Link>
      </header>

      <div className={styles.tabs}>{TABS.map((item) => <button key={item.id} className={tab === item.id ? styles.active : ""} onClick={() => selectTab(item.id)}>{item.icon} {item.label}</button>)}</div>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><h2>{current.label}</h2><p>{current.desc} — ดูตัวอย่างก่อนนำไปใช้ใน Studio หรือ Series</p></div><small>{filtered.length} รายการ</small></div>
        {loadError && tab !== "videos" ? <div className={styles.empty}>{loadError}</div> : null}
        <div className={styles.toolbar}><input className={styles.search} placeholder={`ค้นหาใน${current.label}...`} value={search} onChange={(e) => setSearch(e.target.value)} /><span className={styles.count}>ข้อมูลจากคลัง Admin ตามจริง</span></div>
        <div className={styles.grid}>
          {filtered.map((item) => (
            <article className={styles.card} key={item.id}>
              {tab === "images" && item.url ? <button className={styles.previewImageButton} onClick={() => setImagePreview(item)} aria-label={`ดูรูป ${item.title} แบบเต็ม`}><img className={styles.previewImage} src={item.url} alt={item.title} /></button> : <div className={`${styles.preview} ${styles[item.visual as keyof typeof styles] || ""}`} style={item.url && tab !== "videos" ? { backgroundImage: `url(${item.url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}><span className={styles.previewIcon}>{item.icon}</span></div>}
              <div className={styles.content}><b>{item.title}</b><p>{item.description}</p><span className={styles.tag}>{item.tag}</span>
                {tab === "videos" ? <div className={styles.videoMeta}><span>EP {item.ep}</span><span>{item.duration}s</span></div> : null}
                <div className={styles.actions}>
                  {tab === "voices" ? <button onClick={() => playVoice(item.title)}>▶ ฟังตัวอย่าง</button> : tab === "videos" && item.url ? <a className={styles.primary} href={item.url} download={`SCENOVA-${item.title}.mp4`}>↓ ดาวน์โหลด</a> : <button className={styles.primary}>ใช้รายการนี้</button>}
                  {tab !== "videos" ? <button onClick={() => setSelectedItem(item)}>ดูรายละเอียด</button> : null}
                </div>
              </div>
            </article>
          ))}
          {!loadError && filtered.length === 0 ? <div className={styles.empty}>ยังไม่มีรายการในหมวดนี้ หรือไม่มีรายการที่ตรงกับคำค้นหา</div> : null}
        </div>
      </section>

      {selectedItem && selectedDetail ? <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedItem(null); }}><section className={styles.detailModal} role="dialog" aria-modal="true" aria-label={`รายละเอียด ${selectedItem.title}`}><button className={styles.closeButton} onClick={() => setSelectedItem(null)} aria-label="ปิดรายละเอียด">×</button><div className={styles.detailHero} style={selectedItem.url ? { backgroundImage: `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.72)),url(${selectedItem.url})` } : undefined} onClick={() => { if (selectedItem.url) setImagePreview(selectedItem); }} role={selectedItem.url ? "button" : undefined} tabIndex={selectedItem.url ? 0 : undefined}>{!selectedItem.url ? <span className={styles.detailHeroIcon}>{selectedItem.icon}</span> : null}<div className={styles.detailHeroText}><span>{selectedDetail.typeLabel}</span><h2>{selectedItem.title}</h2><p>{selectedItem.description}</p><div className={styles.detailTags}><b>{selectedItem.tag}</b><b>Asset ID: {selectedItem.id}</b></div></div></div><div className={styles.detailBody}><div className={styles.detailIntro}><span>PRODUCTION REFERENCE</span><h3>รายละเอียดสำหรับใช้งานจริง</h3><p>ข้อมูลนี้มาจากคลัง Admin เพื่อให้ผู้ใช้เข้าใจว่ารายการนี้ควบคุมอะไรและเหมาะกับงานแบบไหน</p></div><div className={styles.detailGrid}><article><span>VISUAL LANGUAGE — ภาษาภาพ / ลักษณะหลัก</span><p>{selectedDetail.visualLanguage}</p></article><article><span>LIGHTING — แนวทางแสง</span><p>{selectedDetail.lighting}</p></article><article><span>COLOR & MOOD — สีและอารมณ์</span><p>{selectedDetail.colorMood}</p></article><article><span>BEST FOR — เหมาะกับงาน</span><p>{selectedDetail.bestFor}</p></article><article className={styles.wideDetail}><span>PROMPT GUIDANCE — แนวทางเขียน Prompt</span><p>{selectedDetail.promptHint}</p></article><article className={styles.wideDetail}><span>REFERENCE USAGE — วิธีใช้เป็น Reference</span><p>{selectedDetail.referenceUsage}</p></article><article><span>MODEL / PROVIDER — การรองรับโมเดล</span><p>{selectedDetail.compatibility}</p></article><article><span>LOCK & CONTINUITY — การล็อกความต่อเนื่อง</span><p>{selectedDetail.lockNote}</p></article></div><div className={styles.detailFooter}><div><span>นำ Asset ไปใช้ต่อ</span><p>เลือกใช้รายการนี้จาก Library แล้วปรับรายละเอียดต่อใน Studio หรือ Series ได้</p></div><div className={styles.detailActions}><button className={styles.secondaryAction} onClick={() => setSelectedItem(null)}>กลับไปดู Library</button><button className={styles.primaryAction}>ใช้รายการนี้</button></div></div></div></section></div> : null}

      {imagePreview?.url ? <div className={styles.imageLightbox} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setImagePreview(null); }}><button className={styles.lightboxClose} onClick={() => setImagePreview(null)} aria-label="ปิดรูป">×</button><img className={styles.lightboxImage} src={imagePreview.url} alt={imagePreview.title} /></div> : null}
    </main>
  );
}
