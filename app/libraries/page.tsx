"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./library-hub.module.css";
import characterStyles from "./character-library.module.css";

type Tab = "images" | "voices" | "characters" | "pets" | "ambience" | "plots" | "videos";
type LibraryMetadata = {
  visualLanguage?: string;
  lighting?: string;
  colorMood?: string;
  bestFor?: string;
  promptHint?: string;
  referenceUsage?: string;
  compatibility?: string;
  lockNote?: string;
  role?: string;
  genderPresentation?: string;
  ageRange?: string;
  appearance?: string;
  personality?: string;
  costume?: string;
  voiceProfile?: string;
  emotionRange?: string;
  performanceStyle?: string;
  negativeIdentityRules?: string;
  referenceImages?: string[];
};
type ApiItem = { id: string; kind: string; title: string; description: string; assetUrl?: string; source?: "SYSTEM" | "ADMIN"; metadata?: LibraryMetadata; createdAt?: string };
type VideoClip = { id: string; url: string; shotOrder: number; providerId: string; duration: number };
type VideoItem = { id: string; runId?: string; episodeRef?: string; ep: number; epTitle: string; projectTitle: string; duration: number; createdAt: string; url?: string; status: "completed" | "processing"; kind?: "clip" | "combined"; clips?: VideoClip[] };
type Item = { id: string; title: string; description: string; tag: string; visual: string; icon: string; url?: string; ep?: number; duration?: number; source?: string; metadata?: LibraryMetadata; runId?: string; kind?: "clip" | "combined"; clips?: VideoClip[] };
type DetailInfo = { typeLabel: string; visualLanguage: string; lighting: string; colorMood: string; bestFor: string; promptHint: string; referenceUsage: string; compatibility: string; lockNote: string };

const TABS: { id: Tab; label: string; desc: string; icon: string }[] = [
  { id: "images", label: "ภาพ & สไตล์", desc: "Style และ Reference", icon: "▧" },
  { id: "voices", label: "เสียง", desc: "Voice Preset", icon: "♫" },
  { id: "characters", label: "ตัวละคร", desc: "Character Profile & Reference Pack", icon: "◎" },
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

function downloadableVideoUrl(raw: string, title: string) {
  if (!raw.startsWith("/api/provider-media")) return raw;
  const separator = raw.includes("?") ? "&" : "?";
  const filename = `SCENOVA-${title.replace(/[^a-zA-Z0-9._-]+/g, "-")}.mp4`;
  return `${raw}${separator}download=1&filename=${encodeURIComponent(filename)}`;
}

function typeLabel(tab: Tab) {
  if (tab === "images") return "Visual Style / Image Reference — สไตล์ภาพและภาพอ้างอิง";
  if (tab === "voices") return "Voice Preset — โปรไฟล์เสียง";
  if (tab === "characters") return "Character Profile / Reference Pack — โปรไฟล์และชุดอ้างอิงตัวละคร";
  if (tab === "pets") return "Creature / Companion Reference — อ้างอิงสัตว์และสิ่งมีชีวิต";
  if (tab === "ambience") return "Ambience / SFX — บรรยากาศและเสียงประกอบ";
  return "Story Seed — พล็อตตั้งต้น";
}

function detailFor(tab: Tab, item: Item): DetailInfo {
  const metadata = item.metadata || {};
  const common = {
    compatibility: metadata.compatibility || "ใช้กับโมเดลที่รองรับ Asset / Reference ประเภทนี้ โดย Model Center จะตรวจความสามารถจริงของระบบก่อน Generate",
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
  if (tab === "characters") return { typeLabel: typeLabel(tab), visualLanguage: metadata.appearance || metadata.visualLanguage || "ใช้กำหนดใบหน้า รูปร่าง อายุ บุคลิก และเอกลักษณ์ของตัวละคร", lighting: "Reference หลักควรเห็นใบหน้าและรูปร่างชัด โดยไม่ถูกแสงหรือเลนส์บิดเอกลักษณ์มากเกินไป", colorMood: metadata.costume || metadata.colorMood || "สีผิว เสื้อผ้า ทรงผม และรายละเอียดประจำตัวควรคงที่", bestFor: metadata.bestFor || item.description, promptHint: metadata.promptHint || `รักษา Character Identity ของ ${item.title} ให้ตรง Reference ทุก Scene`, referenceUsage: metadata.referenceUsage || "ใช้ Main Reference เป็น Identity หลัก และเพิ่ม Front / 3/4 / Side / Full Body / Expression เพื่อเพิ่มความแม่นยำ", ...common };
  if (tab === "pets") return { typeLabel: typeLabel(tab), visualLanguage: metadata.visualLanguage || "กำหนดสายพันธุ์ รูปร่าง สัดส่วน พื้นผิว และเอกลักษณ์ของ Creature", lighting: metadata.lighting || "ควรรักษาการอ่าน Silhouette และ Texture ให้ชัดในทุกสภาพแสง", colorMood: metadata.colorMood || "สีขน ผิว วัสดุ ดวงตา และจุดเด่นประจำตัวต้องต่อเนื่อง", bestFor: metadata.bestFor || item.description, promptHint: metadata.promptHint || `รักษารูปร่าง สเกล สี และรายละเอียดของ ${item.title} ให้เหมือนเดิมทุก Scene`, referenceUsage: metadata.referenceUsage || "ใช้เป็น Creature Reference และผูกกับ Continuity เพื่อรักษาสเกลและรูปลักษณ์", ...common };
  if (tab === "ambience") return { typeLabel: typeLabel(tab), visualLanguage: "ใช้สร้างโลกของฉากผ่านเสียงพื้นหลังและรายละเอียดเสียงแวดล้อม", lighting: "ไม่เกี่ยวข้องกับภาพโดยตรง", colorMood: "อารมณ์เสียงควรสัมพันธ์กับ Mood และจังหวะของ Scene", bestFor: metadata.bestFor || item.description, promptHint: metadata.promptHint || `ใช้บรรยากาศ ${item.title} เป็น Sound Bed และรักษาระดับเสียงไม่ให้กลบบทสนทนา`, referenceUsage: metadata.referenceUsage || "ใช้เป็น Ambience Layer ของ Scene และปรับเพิ่ม SFX เฉพาะเหตุการณ์ได้", ...common };
  return { typeLabel: typeLabel(tab), visualLanguage: "ใช้เป็นแกนเรื่องเพื่อให้ AI Director / Scene Planner แตกเป็น Scene Objective, Beat และ Transition", lighting: "กำหนดภายหลังตาม Visual Style และอารมณ์ของแต่ละ Scene", colorMood: "อารมณ์หลักขึ้นอยู่กับ Genre และพัฒนาการของเรื่อง", bestFor: metadata.bestFor || item.description, promptHint: metadata.promptHint || `ใช้พล็อต ${item.title} เป็นแกนหลัก แล้วแตกเหตุการณ์ให้มี Setup, Development และ Payoff ชัดเจน`, referenceUsage: metadata.referenceUsage || "ส่งไป Studio หรือ Series เพื่อใช้เป็น Story Premise แล้วปรับรายละเอียดก่อน Generate", ...common };
}

function characterQuality(item: Item) {
  const metadata = item.metadata || {};
  let score = 10;
  if (item.url) score += 20;
  score += Math.min(28, (metadata.referenceImages?.length || 0) * 7);
  if (metadata.appearance) score += 8;
  if (metadata.personality) score += 6;
  if (metadata.costume) score += 6;
  if (metadata.voiceProfile) score += 6;
  if (metadata.emotionRange) score += 5;
  if (metadata.performanceStyle) score += 5;
  if (metadata.negativeIdentityRules) score += 6;
  return Math.min(100, score);
}

function voiceTuning(item: Item, voices: SpeechSynthesisVoice[]) {
  let hash = 0;
  for (let index = 0; index < item.title.length; index += 1) hash = ((hash << 5) - hash + item.title.charCodeAt(index)) | 0;
  const value = Math.abs(hash);
  const presets = [
    { pitch: .82, rate: .9 }, { pitch: .94, rate: .96 }, { pitch: 1.08, rate: .98 }, { pitch: 1.2, rate: 1.02 },
    { pitch: .74, rate: .86 }, { pitch: .9, rate: .92 }, { pitch: 1.14, rate: 1.06 }, { pitch: 1.28, rate: 1.0 },
  ];
  const candidates = voices.filter((voice) => /^th|^en/i.test(voice.lang));
  return { ...presets[value % presets.length], voice: candidates.length ? candidates[value % candidates.length] : voices[value % Math.max(1, voices.length)] };
}

export default function LibrariesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("images");
  const [apiItems, setApiItems] = useState<ApiItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [videoLoading, setVideoLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [imagePreview, setImagePreview] = useState<Item | null>(null);
  const [loadError, setLoadError] = useState("");
  const [libraryWarning, setLibraryWarning] = useState("");
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryReloadKey, setLibraryReloadKey] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

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
    let active = true;
    setLibraryLoading(true);
    fetch("/api/library", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "LIBRARY_UNAVAILABLE");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setApiItems(Array.isArray(data.items) ? data.items : []);
        setLibraryWarning(typeof data.warning === "string" ? data.warning : "");
        setLoadError("");
      })
      .catch(() => {
        if (!active) return;
        setApiItems([]);
        setLibraryWarning("");
        setLoadError("ไม่สามารถโหลด Asset Library จากเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
      })
      .finally(() => { if (active) setLibraryLoading(false); });
    return () => { active = false; };
  }, [libraryReloadKey]);

  useEffect(() => {
    let active = true;
    const readLocal = (): VideoItem[] => {
      try {
        const value = JSON.parse(localStorage.getItem("scenova-video-library-v1") || "[]");
        return Array.isArray(value) ? value : [];
      } catch { return []; }
    };
    const load = async () => {
      setVideoLoading(true);
      try {
        const response = await fetch("/api/library/videos", { cache: "no-store", credentials: "same-origin" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "VIDEO_LIBRARY_UNAVAILABLE");
        if (active) setVideos([...(Array.isArray(data.videos) ? data.videos : []), ...readLocal()]);
      } catch {
        if (active) setVideos(readLocal());
      } finally { if (active) setVideoLoading(false); }
    };
    void load();
    const onUpdate = () => { if (active) setVideos(readLocal()); };
    window.addEventListener("scenova-video-library-updated", onUpdate);
    return () => { active = false; window.removeEventListener("scenova-video-library-updated", onUpdate); };
  }, []);

  useEffect(() => {
    return () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); };
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
    if (tab === "videos") return videos.map((video) => ({ id: video.id, runId: video.runId, kind: video.kind || "clip", clips: video.clips, title: video.kind === "combined" ? `รวมคลิป — ${video.epTitle}` : `EP.${String(video.ep).padStart(2, "0")} — ${video.epTitle}`, description: `${video.projectTitle} • ${video.duration} วินาที`, tag: video.kind === "combined" ? "เล่นต่อเนื่องทั้งตอน" : video.status === "completed" ? "สร้างเสร็จแล้ว" : "กำลังประมวลผล", visual: "video", icon: "▶", url: video.url, ep: video.ep, duration: video.duration }));
    return apiItems.filter((item) => item.kind === tab).map((item) => ({ id: item.id, title: item.title, description: item.description, tag: item.source === "ADMIN" ? "Admin Upload" : "SCENOVA System", visual: visualFor(tab), icon: current.icon, url: item.assetUrl, source: item.source, metadata: item.metadata }));
  }, [tab, videos, apiItems, current.icon]);

  useEffect(() => {
    if (tab !== "videos") return;
    const runId = new URLSearchParams(window.location.search).get("run");
    if (!runId) return;
    const target = items.find((item) => item.runId === runId && item.kind === "combined") || items.find((item) => item.runId === runId);
    if (target) window.setTimeout(() => document.getElementById(`video-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }, [tab, items]);

  const filtered = items.filter((item) => `${item.title} ${item.description} ${item.tag} ${item.metadata?.role || ""} ${item.metadata?.ageRange || ""}`.toLowerCase().includes(search.toLowerCase()));
  const selectedDetail = selectedItem ? detailFor(tab, selectedItem) : null;

  function selectTab(next: Tab) {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlayingVoiceId(null); setTab(next); setSearch(""); setSelectedItem(null); setImagePreview(null);
    const url = new URL(window.location.href); url.searchParams.set("tab", next); url.hash = ""; window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function playVoice(item: Item) {
    if (!("speechSynthesis" in window)) return;
    if (playingVoiceId === item.id) {
      window.speechSynthesis.cancel();
      setPlayingVoiceId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const tuning = voiceTuning(item, voices);
    const sample = item.title.toLowerCase().includes("narrator")
      ? `นี่คือตัวอย่างผู้บรรยาย ${item.title} สำหรับงานภาพยนตร์และซีรีส์จาก SCENOVA`
      : item.title.toLowerCase().includes("nyx") || item.title.toLowerCase().includes("astra")
        ? `ระบบพร้อมแล้ว นี่คือตัวอย่างบุคลิกเสียง ${item.title} จาก SCENOVA`
        : `สวัสดี นี่คือตัวอย่างเสียง ${item.title} ลองฟังน้ำเสียง จังหวะ และบุคลิกก่อนเลือกใช้กับตัวละคร`;
    const utterance = new SpeechSynthesisUtterance(sample);
    utterance.lang = tuning.voice?.lang || "th-TH";
    if (tuning.voice) utterance.voice = tuning.voice;
    utterance.rate = tuning.rate;
    utterance.pitch = tuning.pitch;
    utterance.volume = .96;
    utterance.onstart = () => setPlayingVoiceId(item.id);
    utterance.onend = () => setPlayingVoiceId((currentId) => currentId === item.id ? null : currentId);
    utterance.onerror = () => setPlayingVoiceId((currentId) => currentId === item.id ? null : currentId);
    setPlayingVoiceId(item.id);
    window.speechSynthesis.speak(utterance);
  }

  function useCharacter(item: Item) {
    localStorage.setItem("scenova-selected-character-v1", JSON.stringify({ id: item.id, title: item.title, assetUrl: item.url, metadata: item.metadata || {} }));
    router.push("/studio#characters");
  }

  function useStyle(item: Item) {
    localStorage.setItem("scenova-selected-style-v1", JSON.stringify({ id: item.id, title: item.title, assetUrl: item.url, metadata: item.metadata || {} }));
    router.push("/studio#setup");
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div><span>SCENOVA LIBRARY</span><h1>คลังเดียว เลือกแล้วใช้ต่อได้ทันที</h1><p>รวมสไตล์ ตัวละคร เสียง บรรยากาศ พล็อต และวิดีโอไว้ในที่เดียว รายการที่เลือกสามารถนำไปใช้ต่อใน Studio หรือ Series ตามประเภทได้</p></div>
        <Link className={styles.adminLink} href="/admin">Admin จัดการคลัง →</Link>
      </header>

      <div className={styles.tabs}>{TABS.map((item) => <button key={item.id} className={tab === item.id ? styles.active : ""} onClick={() => selectTab(item.id)}>{item.icon} {item.label}</button>)}</div>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><h2>{current.label}</h2><p>{current.desc} — {tab === "characters" ? "เลือก Character Profile แล้วส่งเข้า Studio ได้โดยไม่ต้องพิมพ์ Character Bible ซ้ำ" : tab === "voices" ? "เสียงตัวอย่างใช้เสียงที่อุปกรณ์มีอยู่ พร้อมปรับโทนและจังหวะให้แต่ละโปรไฟล์แตกต่างกัน" : "ดูตัวอย่างก่อนนำไปใช้ใน Studio หรือ Series"}</p></div><small>{filtered.length} รายการ</small></div>
        {videoLoading && tab === "videos" ? <div className={styles.statusBox}>กำลังโหลดคลิปที่สร้างเสร็จจากงาน AI...</div> : null}{libraryLoading && tab !== "videos" ? <div className={styles.statusBox}>กำลังโหลด Asset Library...</div> : null}{libraryWarning && tab !== "videos" ? <div className={`${styles.statusBox} ${styles.statusWarning}`}>{libraryWarning}</div> : null}{loadError && tab !== "videos" ? <div className={`${styles.statusBox} ${styles.statusError}`}><span>{loadError}</span><button className={styles.retryButton} onClick={() => setLibraryReloadKey((value) => value + 1)}>ลองโหลดอีกครั้ง</button></div> : null}
        <div className={styles.toolbar}><input className={styles.search} placeholder={`ค้นหาใน${current.label}...`} value={search} onChange={(e) => setSearch(e.target.value)} /><span className={styles.count}>SCENOVA System • สีเขียว = Admin Upload</span></div>
        <div className={styles.grid}>
          {filtered.map((item) => {
            const isPlaying = tab === "voices" && playingVoiceId === item.id;
            const isCharacter = tab === "characters";
            const quality = isCharacter ? characterQuality(item) : 0;
            return (
              <article id={tab === "videos" ? `video-${item.id}` : undefined} className={`${styles.card} ${isPlaying ? styles.playingCard : ""}`} key={item.id}>
                {tab === "videos" && item.kind === "combined" && item.clips?.length ? <CombinedVideoPlayer clips={item.clips} /> : tab === "videos" && item.url ? <VideoCardPreview url={item.url} title={item.title} /> : (tab === "images" || tab === "characters") && item.url ? <button className={styles.previewImageButton} onClick={() => setImagePreview(item)} aria-label={`ดูรูป ${item.title} แบบเต็ม`}><img className={styles.previewImage} src={item.url} alt={item.title} loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement?.classList.add(styles.imageFailed); }} /></button> : <div className={`${styles.preview} ${styles[item.visual as keyof typeof styles] || ""} ${isPlaying ? styles.voicePlaying : ""}`} style={item.url && tab !== "videos" ? { backgroundImage: `url(${item.url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>{tab === "voices" ? <div className={styles.voiceVisualizer} aria-live="polite"><span className={styles.voiceDisc}>{isPlaying ? "■" : "♫"}</span><div className={styles.waveBars} aria-hidden="true">{[0,1,2,3,4,5,6].map((bar) => <i key={bar} style={{ animationDelay:`${bar * 70}ms` }} />)}</div><small>{isPlaying ? "กำลังเล่นตัวอย่างเสียง..." : "แตะเพื่อฟังตัวอย่าง"}</small></div> : <span className={styles.previewIcon}>{item.icon}</span>}</div>}
                <div className={styles.content}><b>{item.title}</b><p>{item.description}</p><span className={styles.tag} style={item.source === "ADMIN" ? { color: "#8bcf98", background: "#101b12", boxShadow: "inset 0 0 0 1px #28432e" } : undefined}>{item.tag}</span>
                  {isCharacter ? <><div className={characterStyles.characterCardMeta}><span><b>Role</b>{item.metadata?.role || "กำหนดใน Studio"}</span><span><b>Age</b>{item.metadata?.ageRange || "Flexible"}</span><span><b>Voice</b>{item.metadata?.voiceProfile || "เลือกภายหลัง"}</span></div><div className={characterStyles.qualityWrap}><div className={characterStyles.qualityHead}><span>Reference Quality — ความพร้อมอ้างอิง</span><strong>{quality}%</strong></div><div className={characterStyles.qualityTrack}><i style={{ width: `${quality}%` }} /></div></div></> : null}
                  {tab === "videos" ? <div className={styles.videoMeta}><span>EP {item.ep}</span><span>{item.duration}s</span></div> : null}
                  <div className={styles.actions}>
                    {tab === "voices" ? <button className={isPlaying ? styles.playingButton : ""} onClick={() => playVoice(item)} aria-pressed={isPlaying}>{isPlaying ? "■ หยุดเสียง" : "▶ ฟังตัวอย่าง"}</button> : tab === "videos" && item.kind !== "combined" && item.url ? <a className={styles.primary} href={downloadableVideoUrl(item.url, item.title)} download>↓ ดาวน์โหลด MP4</a> : tab === "videos" && item.kind === "combined" ? <span className={styles.combinedHint}>เล่นต่อเนื่อง {item.clips?.length || 0} Shot</span> : isCharacter ? <button className={styles.primary} onClick={() => useCharacter(item)}>ใช้ตัวละครนี้</button> : tab === "images" ? <button className={styles.primary} onClick={() => useStyle(item)}>ใช้เป็นสไตล์</button> : <button className={styles.primary} onClick={() => setSelectedItem(item)}>ดูรายละเอียด</button>}
                    {(tab === "voices" || tab === "images" || isCharacter) ? <button onClick={() => setSelectedItem(item)}>ดูรายละเอียด</button> : null}
                  </div>
                </div>
              </article>
            );
          })}
          {!loadError && filtered.length === 0 ? <div className={styles.empty}>ยังไม่มีรายการในหมวดนี้ หรือไม่มีรายการที่ตรงกับคำค้นหา</div> : null}
        </div>
      </section>

      {selectedItem && selectedDetail ? <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedItem(null); }}><section className={styles.detailModal} role="dialog" aria-modal="true" aria-label={`รายละเอียด ${selectedItem.title}`}><button className={styles.closeButton} onClick={() => setSelectedItem(null)} aria-label="ปิดรายละเอียด">×</button><div className={styles.detailHero} style={selectedItem.url ? { backgroundImage: `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.72)),url(${selectedItem.url})` } : undefined} onClick={() => { if (selectedItem.url) setImagePreview(selectedItem); }} role={selectedItem.url ? "button" : undefined} tabIndex={selectedItem.url ? 0 : undefined}>{!selectedItem.url ? <span className={styles.detailHeroIcon}>{selectedItem.icon}</span> : null}<div className={styles.detailHeroText}><span>{selectedDetail.typeLabel}</span><h2>{selectedItem.title}</h2><p>{selectedItem.description}</p><div className={styles.detailTags}><b style={selectedItem.source === "ADMIN" ? { color: "#8bcf98", borderColor: "#28432e", background: "rgba(16,27,18,.8)" } : undefined}>{selectedItem.tag}</b><b>Asset ID: {selectedItem.id}</b></div></div></div><div className={styles.detailBody}>
        {tab === "characters" ? <CharacterDetail item={selectedItem} onPreview={(url) => setImagePreview({ ...selectedItem, url })} /> : <><div className={styles.detailIntro}><span>PRODUCTION REFERENCE</span><h3>รายละเอียดสำหรับใช้งานจริง</h3><p>ข้อมูลนี้มาจากคลังเพื่อให้เข้าใจว่ารายการนี้ควบคุมอะไรและเหมาะกับงานแบบไหน</p></div><div className={styles.detailGrid}><article><span>ลักษณะหลัก</span><p>{selectedDetail.visualLanguage}</p></article><article><span>แนวทางแสง</span><p>{selectedDetail.lighting}</p></article><article><span>สีและอารมณ์</span><p>{selectedDetail.colorMood}</p></article><article><span>เหมาะกับงาน</span><p>{selectedDetail.bestFor}</p></article><article className={styles.wideDetail}><span>แนวทางเขียน Prompt</span><p>{selectedDetail.promptHint}</p></article><article className={styles.wideDetail}><span>วิธีใช้เป็น Reference</span><p>{selectedDetail.referenceUsage}</p></article><article><span>การรองรับโมเดล</span><p>{selectedDetail.compatibility}</p></article><article><span>การล็อกความต่อเนื่อง</span><p>{selectedDetail.lockNote}</p></article></div></>}
        <div className={styles.detailFooter}><div><span>นำ Asset ไปใช้ต่อ</span><p>{tab === "characters" ? "Character Bible, Voice Profile และ Identity Rules จะถูกส่งไปยัง Studio เพื่อใช้ต่อ" : "เลือกใช้รายการนี้จาก Library แล้วปรับรายละเอียดต่อใน Studio หรือ Series ได้"}</p></div><div className={styles.detailActions}><button className={styles.secondaryAction} onClick={() => setSelectedItem(null)}>กลับไปดู Library</button>{tab === "characters" ? <button className={styles.primaryAction} onClick={() => useCharacter(selectedItem)}>ใช้ใน Studio</button> : <button className={styles.primaryAction}>ใช้รายการนี้</button>}</div></div></div></section></div> : null}

      {imagePreview?.url ? <div className={styles.imageLightbox} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setImagePreview(null); }}><button className={styles.lightboxClose} onClick={() => setImagePreview(null)} aria-label="ปิดรูป">×</button><img className={styles.lightboxImage} src={imagePreview.url} alt={imagePreview.title} /></div> : null}
    </main>
  );
}

function CharacterDetail({ item, onPreview }: { item: Item; onPreview: (url: string) => void }) {
  const metadata = item.metadata || {};
  const quality = characterQuality(item);
  const references = [item.url, ...(metadata.referenceImages || [])].filter((url): url is string => Boolean(url));
  return <>
    <div className={characterStyles.characterDetailLead}><div><span>CHARACTER BIBLE — ข้อมูลตัวละครกลาง</span><p>ใช้เป็น Identity Source ของตัวละครก่อนสร้าง Shot / Scene และช่วยลด Character Drift เมื่อเปิด Lock ที่เกี่ยวข้อง</p></div><div className={characterStyles.qualityBadge}><b>{quality}%</b><small>Reference Quality</small></div></div>
    <div className={characterStyles.profileGrid}>
      <article><span>ROLE — บทบาท</span><p>{metadata.role || "ยังไม่กำหนด"}</p></article>
      <article><span>GENDER / AGE — ลักษณะเพศและช่วงอายุ</span><p>{[metadata.genderPresentation, metadata.ageRange].filter(Boolean).join(" • ") || "ยังไม่กำหนด"}</p></article>
      <article className={characterStyles.wide}><span>APPEARANCE — รูปลักษณ์ที่ต้องรักษา</span><p>{metadata.appearance || "กำหนดใบหน้า ทรงผม สีผิว รูปร่าง สัดส่วน และจุดเด่นที่ห้ามเปลี่ยน"}</p></article>
      <article><span>PERSONALITY — บุคลิก</span><p>{metadata.personality || "ยังไม่กำหนด"}</p></article>
      <article><span>COSTUME PROFILE — เครื่องแต่งกาย</span><p>{metadata.costume || "เลือก/กำหนด Costume ใน Production"}</p></article>
      <article><span>VOICE PROFILE — โปรไฟล์เสียง</span><p>{metadata.voiceProfile || "เลือกจาก Voice Library ภายหลัง"}</p></article>
      <article><span>EMOTION RANGE — ช่วงอารมณ์</span><p>{metadata.emotionRange || "Neutral, Happy, Sad, Angry, Fear, Surprise"}</p></article>
      <article><span>PERFORMANCE STYLE — ลักษณะการแสดง</span><p>{metadata.performanceStyle || "Natural cinematic performance"}</p></article>
      <article><span>BEST FOR — เหมาะกับงาน</span><p>{metadata.bestFor || item.description}</p></article>
      <article className={characterStyles.wide}><span>CHARACTER PROMPT — คำสั่งรักษาตัวละคร</span><p>{metadata.promptHint || `รักษา Character Identity ของ ${item.title} ให้ตรง Reference ทุก Shot และ Scene`}</p></article>
      <article className={`${characterStyles.wide} ${characterStyles.identityRules}`}><span>NEGATIVE IDENTITY RULES — สิ่งที่ห้ามเปลี่ยน</span><p>{metadata.negativeIdentityRules || "ห้ามเปลี่ยนรูปหน้า อายุโดยประมาณ ทรงผม สีตา สัดส่วนร่างกาย และรายละเอียดเอกลักษณ์โดยไม่ตั้งใจ"}</p></article>
      <article className={characterStyles.wide}><span>REFERENCE USAGE — วิธีใช้ Reference Pack</span><p>{metadata.referenceUsage || "Main Reference ใช้เป็น Identity หลัก; เพิ่ม Front / 3/4 / Side / Full Body / Expression เพื่อเพิ่มความแม่นยำ"}</p></article>
    </div>
    <div className={characterStyles.lockPills}><span>✓ Character Lock — ล็อกตัวละคร</span><span>✓ Costume Lock — ล็อกชุด</span><span>✓ Voice Lock — ล็อกเสียง</span></div>
    <div className={characterStyles.referenceSection}><div className={characterStyles.referenceHead}><div><b>Reference Pack — ชุดภาพอ้างอิง</b><span>กดภาพเพื่อดูต้นฉบับเต็ม ใช้หลายมุมช่วยลด Character Drift</span></div><small>{references.length} ภาพ</small></div><div className={characterStyles.referenceGrid}>{references.length ? references.map((url, index) => <button className={characterStyles.referenceButton} key={`${url}-${index}`} onClick={() => onPreview(url)}><img src={url} alt={`${item.title} reference ${index + 1}`} /><span>{index === 0 ? "Main Reference" : `Reference ${index}`}</span></button>) : <div className={characterStyles.emptyReference}>ยังไม่มีภาพ Reference จริง — Character Profile ยังใช้เป็น Template ได้ แต่ควร Upload Main Reference และเพิ่ม 3/4 / Side / Full Body / Expression ก่อนงานที่ต้องการความต่อเนื่องสูง</div>}</div></div>
  </>;
}

function CombinedVideoPlayer({ clips }: { clips: VideoClip[] }) {
  const [index, setIndex] = useState(0);
  const current = clips[index];
  if (!current) return null;
  return <div className={styles.combinedPlayer}>
    <video controls playsInline preload="auto" src={current.url} onEnded={() => setIndex((value) => value + 1 < clips.length ? value + 1 : 0)}>
      เบราว์เซอร์นี้ไม่รองรับการเล่นวิดีโอ
    </video>
    <div className={styles.combinedControls}>
      <span>รวม Shot {index + 1} / {clips.length}</span>
      <div><button type="button" onClick={() => setIndex((value) => (value - 1 + clips.length) % clips.length)} aria-label="Shot ก่อนหน้า">‹</button><button type="button" onClick={() => setIndex((value) => (value + 1) % clips.length)} aria-label="Shot ถัดไป">›</button></div>
    </div>
  </div>;
}

function VideoCardPreview({ url, title }: { url: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const capturedRef = useRef(false);
  const [poster, setPoster] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    capturedRef.current = false;
    setPoster("");
    setFailed(false);
  }, [url]);

  function captureFrame(video: HTMLVideoElement) {
    if (capturedRef.current || !video.videoWidth || !video.videoHeight) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(video.videoWidth, 960);
      canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPoster(canvas.toDataURL("image/jpeg", 0.82));
      capturedRef.current = true;
      video.pause();
    } catch {
      // The playable first frame remains visible even if canvas capture is unavailable.
    }
  }

  return <div className={`${styles.videoCardPreview} ${failed ? styles.videoFailed : ""}`}>
    <video
      ref={videoRef}
      controls
      playsInline
      preload="auto"
      poster={poster || undefined}
      src={url}
      aria-label={`เล่นวิดีโอ ${title}`}
      onLoadedMetadata={(event) => {
        const video = event.currentTarget;
        if (Number.isFinite(video.duration) && video.duration > 0.2) video.currentTime = Math.min(0.25, video.duration / 10);
      }}
      onLoadedData={(event) => captureFrame(event.currentTarget)}
      onSeeked={(event) => captureFrame(event.currentTarget)}
      onError={() => setFailed(true)}
    >
      เบราว์เซอร์นี้ไม่รองรับการเล่นวิดีโอ
    </video>
    {failed ? <span>เปิดคลิปไม่ได้ กรุณาตรวจ API Key หรือดาวน์โหลดใหม่</span> : null}
  </div>;
}
