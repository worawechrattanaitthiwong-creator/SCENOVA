"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./library-hub.module.css";

type Tab = "images" | "voices" | "characters" | "pets" | "ambience" | "plots" | "videos";
type ApiItem = { id: string; kind: string; title: string; description: string; assetUrl?: string };
type VideoItem = { id: string; ep: number; epTitle: string; projectTitle: string; duration: number; createdAt: string; url?: string; status: "completed" | "processing" };
type Item = { id: string; title: string; description: string; tag: string; visual: string; icon: string; url?: string; ep?: number; duration?: number };
type DetailInfo = {
  typeLabel: string;
  visualLanguage: string;
  lighting: string;
  colorMood: string;
  bestFor: string;
  promptHint: string;
  referenceUsage: string;
  compatibility: string;
  lockNote: string;
};

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
    { id: "anime", title: "Cinematic Anime", description: "อนิเมะภาพยนตร์ แสงมีมิติ เหมาะกับเรื่องเล่า Coming-of-age และ Fantasy", tag: "Anime • Cinematic", visual: "anime", icon: "✦", url: "/library/styles/cinematic-anime.png" },
    { id: "golden", title: "Warm Golden Hour", description: "แสงเย็นสีทอง อบอุ่น นุ่ม เหมาะกับ Romance, Slice of Life และฉากความทรงจำ", tag: "Warm • Emotional", visual: "golden", icon: "☀", url: "/library/styles/warm-golden-hour.png" },
    { id: "real", title: "Photorealistic Film", description: "ภาพสมจริงแบบภาพยนตร์ ผิว วัสดุ และแสงเป็นธรรมชาติ", tag: "Realistic • Film", visual: "real", icon: "◫", url: "/library/styles/photorealistic-film.png" },
    { id: "action", title: "Action Blockbuster", description: "ภาพพลังงานสูง คอนทราสต์แรง เหมาะกับ Chase, Combat และฉากแอ็กชันขนาดใหญ่", tag: "Action • Dynamic", visual: "action", icon: "⚡", url: "/library/styles/action-blockbuster.png" },
    { id: "scifi", title: "Sci-Fi Neon", description: "เมืองอนาคต เทคโนโลยี แสงนีออน และโครงสร้างล้ำยุค", tag: "Sci-Fi • Neon", visual: "scifi", icon: "⬡", url: "/library/styles/sci-fi-neon.png" },
    { id: "fantasy", title: "Fantasy Storybook", description: "โลกแฟนตาซีขนาดใหญ่ แสงเหนือจริง และภูมิทัศน์มหัศจรรย์", tag: "Fantasy • Epic", visual: "plot", icon: "✦", url: "/library/styles/fantasy-storybook.png" },
    { id: "thriller", title: "Dark Thriller", description: "ตรอกกลางคืนเปียกฝน แสงน้อย คอนทราสต์จัด เหมาะกับ Crime, Noir และ Suspense", tag: "Thriller • Noir", visual: "action", icon: "◐", url: "/library/styles/dark-thriller.png" },
    { id: "gothic", title: "Gothic Horror", description: "คฤหาสน์โกธิก หมอกกลางคืน และโทนเย็นลึกลับ เหมาะกับ Horror และ Dark Fantasy", tag: "Gothic • Horror", visual: "real", icon: "◇", url: "/library/styles/gothic-horror.png" },
    { id: "romance", title: "Cinematic Romance", description: "โทนอุ่นยามอาทิตย์ตก ชัดตื้น และอารมณ์ใกล้ชิด เหมาะกับ Romance และ Emotional Drama", tag: "Romance • Warm", visual: "golden", icon: "♡", url: "/library/styles/cinematic-romance.png" },
    { id: "period", title: "Period Drama", description: "งานย้อนยุคหรูหรา เครื่องแต่งกายและสถาปัตยกรรมละเอียด เหมาะกับ Historical และ Costume Film", tag: "Period • Elegant", visual: "plot", icon: "♜", url: "/library/styles/period-drama.png" },
  ],
  voices: [
    { id: "mira", title: "Mira", description: "หญิง • อบอุ่น • เป็นธรรมชาติ เหมาะกับ Drama และ Slice of Life", tag: "หญิง • Warm", visual: "voice", icon: "♫" },
    { id: "nami", title: "Nami", description: "หญิง • สดใส • วัยรุ่น เหมาะกับ Anime และ Coming-of-age", tag: "หญิง • Bright", visual: "voice", icon: "♫" },
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
    { id: "pet3", title: "Robot Companion", description: "หุ่นยนต์คู่หูขนาดเล็กสำหรับ Sci-Fi และ Future City", tag: "Sci-Fi • Robot", visual: "pet", icon: "◇" },
  ],
  ambience: [
    { id: "amb1", title: "ฝนในเมือง", description: "ฝนตกเบา ๆ ถนนเปียก รถไกล ๆ เหมาะกับ Drama และ Mystery", tag: "Rain • City", visual: "ambience", icon: "≈" },
    { id: "amb2", title: "เมืองยามค่ำ", description: "เสียงเมือง รถ ผู้คน และบรรยากาศกลางคืน", tag: "Urban • Night", visual: "ambience", icon: "≈" },
    { id: "amb3", title: "ป่าเงียบ", description: "ลม ใบไม้ นก และเสียงธรรมชาติ เหมาะกับ Fantasy / Adventure", tag: "Forest • Nature", visual: "ambience", icon: "≈" },
  ],
  plots: [
    { id: "plot1", title: "พบสิ่งมีชีวิตลึกลับ", description: "มิตรภาพเริ่มจากการพบกันโดยบังเอิญ เหมาะกับ Fantasy Short Film", tag: "Fantasy • Friendship", visual: "plot", icon: "✦" },
    { id: "plot2", title: "ความลับในเมืองอนาคต", description: "ตัวละครค้นพบข้อมูลที่เปลี่ยนความจริงของเมืองทั้งเมือง", tag: "Sci-Fi • Mystery", visual: "plot", icon: "✦" },
    { id: "plot3", title: "ภารกิจไล่ล่า", description: "เป้าหมายชัด จังหวะเร็ว มี Chase และจุดพลิกกลางเรื่อง", tag: "Action • Chase", visual: "plot", icon: "✦" },
  ],
};

const STYLE_DETAILS: Record<string, Partial<DetailInfo>> = {
  anime: { visualLanguage: "อนิเมะภาพยนตร์ที่ใช้มุมกล้องและองค์ประกอบแบบหนังจริง เส้นสะอาด ฉากมีมิติ และเน้นอารมณ์ของตัวละคร", lighting: "แสงนุ่มแบบภาพยนตร์ มี Rim Light และแสงบรรยากาศช่วยแยกตัวละครออกจากฉาก", colorMood: "สีสดแต่คุมโทน อบอุ่นและมีช่วง Highlight ชัด", bestFor: "Anime, Coming-of-age, Fantasy, Romance และเรื่องเล่าที่เน้นอารมณ์", promptHint: "ระบุ cinematic anime, expressive character acting, dimensional background, controlled film lighting และรายละเอียดช่วงเวลาของวัน" },
  golden: { visualLanguage: "ภาพเน้นความอบอุ่น ความทรงจำ และความใกล้ชิด ใช้แสงอาทิตย์ต่ำสร้างมิติและเงายาว", lighting: "Golden Hour / Backlight / Soft Flare แสงอุ่นจากด้านหลังหรือด้านข้าง", colorMood: "ทอง ส้ม น้ำตาลอ่อน และ Skin Tone อบอุ่น", bestFor: "Romance, Slice of Life, Family, Memory และ Emotional Scene", promptHint: "ระบุ warm golden-hour sunlight, soft backlight, natural atmosphere, gentle contrast และ emotional cinematic framing" },
  real: { visualLanguage: "ภาพสมจริงแบบกองถ่ายภาพยนตร์ เน้นผิว วัสดุ สภาพอากาศ และ Depth ที่เป็นธรรมชาติ", lighting: "Motivated Lighting เลียนแบบแหล่งแสงจริงในฉาก พร้อม Contrast แบบฟิล์ม", colorMood: "Natural Film Color, Skin Tone สมจริง และ Saturation พอดี", bestFor: "Drama, Commercial, Documentary-style, Thriller และงานสมจริง", promptHint: "ระบุ photorealistic cinematic film, natural skin texture, realistic materials, motivated lighting, shallow depth of field ตามความเหมาะสม" },
  action: { visualLanguage: "ภาพพลังงานสูง มี Perspective แรง การเคลื่อนไหวชัด และองค์ประกอบที่นำสายตาไปยังเหตุการณ์หลัก", lighting: "Hard Light, Practical Explosion Light และ Contrast สูงเพื่อเพิ่มแรงกระแทก", colorMood: "ดำ เทา ส้มไฟ และโทนเย็นตัดร้อน", bestFor: "Action, Chase, Combat, Disaster และ Hero Moment", promptHint: "ระบุ high-energy blockbuster action, dynamic camera perspective, debris and motion, dramatic contrast และ clear subject readability" },
  scifi: { visualLanguage: "สถาปัตยกรรมอนาคต เทคโนโลยีซับซ้อน เส้นนำสายตา และ Scale ขนาดใหญ่", lighting: "Neon, Holographic Light, Volumetric Glow และแสงเมืองอนาคต", colorMood: "น้ำเงิน Cyan ม่วง และแสง Accent สีสดบนพื้นมืด", bestFor: "Sci-Fi, Cyberpunk, Space Opera, AI World และ Future City", promptHint: "ระบุ futuristic cinematic city, advanced architecture, holographic interfaces, neon accent lighting, atmospheric depth และ scale" },
  fantasy: { visualLanguage: "โลกแฟนตาซีขนาดใหญ่ เน้นภูมิประเทศ สถาปัตยกรรมมหัศจรรย์ และความรู้สึก Epic", lighting: "God Rays, Atmospheric Light และแสงเหนือจริงที่ยังรักษาทิศทางชัด", colorMood: "เขียว น้ำเงิน ทอง และสีธรรมชาติที่มี Magical Accent", bestFor: "Epic Fantasy, Adventure, Creature, Quest และ Storybook", promptHint: "ระบุ epic fantasy kingdom, vast landscape, magical atmospheric light, detailed architecture, cinematic scale และ clear foreground-midground-background" },
  thriller: { visualLanguage: "ภาพกดดันแบบ Noir ใช้พื้นที่มืด Negative Space และมุมมองที่ทำให้ผู้ชมรู้สึกไม่ปลอดภัย", lighting: "Low-key Lighting, Street Practical, Reflection บนพื้นเปียก และแสงเฉียง", colorMood: "ดำ เทา เขียวอมฟ้า มีแดงหรือส้มเป็น Accent เล็กน้อย", bestFor: "Crime, Mystery, Noir, Suspense และ Psychological Thriller", promptHint: "ระบุ dark cinematic thriller, rain-soaked street, low-key lighting, deep shadows, restrained color palette และ suspenseful composition" },
  gothic: { visualLanguage: "สถาปัตยกรรมโกธิก เงารูปทรงใหญ่ หมอก และองค์ประกอบที่ให้ความรู้สึกโดดเดี่ยว", lighting: "Moonlight, Fog Diffusion, Window Practical และแสงเย็นความเข้มต่ำ", colorMood: "น้ำเงินดำ เทา และทองหม่นจากหน้าต่าง", bestFor: "Gothic Horror, Supernatural, Dark Fantasy และ Haunted Location", promptHint: "ระบุ gothic mansion, moonlit fog, ominous silhouette, cold cinematic palette, atmospheric horror และ detailed architecture" },
  romance: { visualLanguage: "ภาพใกล้ชิด เน้นใบหน้า Eye Line และภาษากาย ใช้ Depth ตื้นเพื่อแยกคู่ตัวละครจากฉาก", lighting: "Soft Sunset Light, Beauty Light และ Backlight บาง ๆ รอบเส้นผม", colorMood: "ส้มชมพู น้ำตาลอุ่น และ Skin Tone นุ่ม", bestFor: "Romance, Relationship, Wedding, Emotional Drama และ Intimate Scene", promptHint: "ระบุ intimate cinematic romance, soft sunset light, shallow depth of field, natural skin tone, subtle expression และ elegant composition" },
  period: { visualLanguage: "ภาพย้อนยุคที่เน้น Production Design เครื่องแต่งกาย วัสดุ และสถาปัตยกรรมตามยุค", lighting: "Natural Window Light, Candle / Practical และ Soft Directional Light", colorMood: "ทอง ครีม น้ำเงินเข้ม และสีผ้าหรูที่ Saturation คุมไว้", bestFor: "Historical Drama, Royal Drama, Costume Film และ Period Romance", promptHint: "ระบุ period cinematic drama, historically inspired costume, ornate architecture, natural period lighting, elegant composition และ detailed production design" },
};

const isTab = (value: string | null): value is Tab => TABS.some((item) => item.id === value);
const normalizeTitle = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g, " ").trim();

function detailFor(tab: Tab, item: Item): DetailInfo {
  const common = {
    compatibility: "ใช้เป็น Reference ได้กับโมเดลที่รองรับภาพ/สไตล์อ้างอิง โดย Model Center จะตรวจความสามารถจริงของ Provider ก่อน Generate",
    lockNote: "เมื่อนำไปใช้ใน Production สามารถเปิด Lock ที่เกี่ยวข้องเพื่อรักษาความต่อเนื่องข้าม Scene / Episode ได้",
  };
  if (tab === "images") return {
    typeLabel: "Visual Style / Image Reference — สไตล์ภาพและภาพอ้างอิง",
    visualLanguage: "ใช้เป็นภาษาภาพหลักเพื่อกำหนดทิศทางภาพ องค์ประกอบ และบรรยากาศของ Production",
    lighting: "ระบบจะนำแนวทางแสงจาก Reference ไปประกอบ Prompt โดยยังปรับใน Director Pro ได้",
    colorMood: item.tag,
    bestFor: "Studio และ Series ที่ต้องการกำหนด Visual Language ให้ชัดตั้งแต่ต้น",
    promptHint: `ใช้ ${item.title} เป็น Visual Style หลัก รักษาโทนภาพและอารมณ์ให้ต่อเนื่องตลอด Scene`,
    referenceUsage: "เลือกเป็น Style Reference เพื่อใช้คุมโทนทั้ง Production หรือใช้เป็น Image Reference เฉพาะ Scene ได้",
    ...common,
    ...(STYLE_DETAILS[item.id] || {}),
  };
  if (tab === "voices") return { typeLabel: "Voice Preset — โปรไฟล์เสียง", visualLanguage: "กำหนดบุคลิก น้ำหนัก และลักษณะการพูดของตัวละคร", lighting: "ไม่เกี่ยวข้องกับภาพโดยตรง", colorMood: "ใช้ Emotion / Performance Direction ใน Scene เพื่อควบคุมอารมณ์การพูด", bestFor: item.description, promptHint: `ใช้เสียง ${item.title} และรักษาบุคลิกเสียงให้คงที่ตลอดบทสนทนา`, referenceUsage: "ผูกกับ Character แล้วเปิด Voice Lock เพื่อรักษาเสียงเดิมข้าม Scene / Episode", ...common };
  if (tab === "characters") return { typeLabel: "Character Reference Pack — ชุดอ้างอิงตัวละคร", visualLanguage: "ใช้กำหนดใบหน้า รูปร่าง อายุ บุคลิก และเอกลักษณ์ของตัวละคร", lighting: "Reference ควรมีภาพที่เห็นลักษณะตัวละครชัดและไม่ถูกแสงเปลี่ยนรูปหน้ามากเกินไป", colorMood: "สีผิว เสื้อผ้า ทรงผม และรายละเอียดประจำตัวควรคงที่", bestFor: item.description, promptHint: `รักษา Character Identity ของ ${item.title} ให้ตรง Reference ทุก Scene`, referenceUsage: "ใช้เป็น Character Reference และเปิด Character Lock; Costume สามารถล็อกแยกต่างหาก", ...common };
  if (tab === "pets") return { typeLabel: "Creature / Companion Reference — อ้างอิงสัตว์และสิ่งมีชีวิต", visualLanguage: "กำหนดสายพันธุ์ รูปร่าง สัดส่วน พื้นผิว และเอกลักษณ์ของ Creature", lighting: "ควรรักษาการอ่าน Silhouette และ Texture ให้ชัดในทุกสภาพแสง", colorMood: "สีขน ผิว วัสดุ ดวงตา และจุดเด่นประจำตัวต้องต่อเนื่อง", bestFor: item.description, promptHint: `รักษารูปร่าง สเกล สี และรายละเอียดของ ${item.title} ให้เหมือนเดิมทุก Scene`, referenceUsage: "ใช้เป็น Creature Reference และผูกกับ Continuity เพื่อรักษาสเกลและรูปลักษณ์", ...common };
  if (tab === "ambience") return { typeLabel: "Ambience / SFX — บรรยากาศและเสียงประกอบ", visualLanguage: "ใช้สร้างโลกของฉากผ่านเสียงพื้นหลังและรายละเอียดเสียงแวดล้อม", lighting: "ไม่เกี่ยวข้องกับภาพโดยตรง", colorMood: "อารมณ์เสียงควรสัมพันธ์กับ Mood และจังหวะของ Scene", bestFor: item.description, promptHint: `ใช้บรรยากาศ ${item.title} เป็น Sound Bed และรักษาระดับเสียงไม่ให้กลบบทสนทนา`, referenceUsage: "ใช้เป็น Ambience Layer ของ Scene และปรับเพิ่ม SFX เฉพาะเหตุการณ์ได้", ...common };
  return { typeLabel: "Story Seed — พล็อตตั้งต้น", visualLanguage: "ใช้เป็นแกนเรื่องเพื่อให้ AI Director / Scene Planner แตกเป็น Scene Objective, Beat และ Transition", lighting: "กำหนดภายหลังตาม Visual Style และอารมณ์ของแต่ละ Scene", colorMood: "อารมณ์หลักขึ้นอยู่กับ Genre และพัฒนาการของเรื่อง", bestFor: item.description, promptHint: `ใช้พล็อต ${item.title} เป็นแกนหลัก แล้วแตกเหตุการณ์ให้มี Setup, Development และ Payoff ชัดเจน`, referenceUsage: "ส่งไป Studio หรือ Series เพื่อใช้เป็น Story Premise แล้วปรับรายละเอียดก่อน Generate", ...common };
}

export default function LibrariesPage() {
  const [tab, setTab] = useState<Tab>("images");
  const [apiItems, setApiItems] = useState<ApiItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [imagePreview, setImagePreview] = useState<Item | null>(null);

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

  useEffect(() => { fetch("/api/library", { cache: "no-store" }).then((r) => r.json()).then((data) => setApiItems(data.items || [])).catch(() => setApiItems([])); }, []);
  useEffect(() => {
    const load = () => { try { setVideos(JSON.parse(localStorage.getItem("scenova-video-library-v1") || "[]")); } catch { setVideos([]); } };
    load(); window.addEventListener("scenova-video-library-updated", load); return () => window.removeEventListener("scenova-video-library-updated", load);
  }, []);
  useEffect(() => {
    if (!selectedItem && !imagePreview) return;
    const previous = document.body.style.overflow;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (imagePreview) setImagePreview(null);
      else setSelectedItem(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, [selectedItem, imagePreview]);

  const current = TABS.find((item) => item.id === tab)!;
  const items = useMemo<Item[]>(() => {
    if (tab === "videos") return videos.map((video) => ({ id: video.id, title: `EP.${String(video.ep).padStart(2, "0")} — ${video.epTitle}`, description: `${video.projectTitle} • ${video.duration} วินาที`, tag: video.status === "completed" ? "สร้างเสร็จแล้ว" : "กำลังประมวลผล", visual: "video", icon: "▶", url: video.url, ep: video.ep, duration: video.duration }));
    const builtins = BUILTIN[tab];
    const builtinTitles = new Set(builtins.map((item) => normalizeTitle(item.title)));
    const admin = apiItems
      .filter((item) => item.kind === tab)
      .filter((item) => !builtinTitles.has(normalizeTitle(item.title)))
      .map((item) => ({ id: item.id, title: item.title, description: item.description, tag: "SCENOVA Library", visual: tab === "voices" ? "voice" : tab === "characters" ? "character" : tab === "pets" ? "pet" : tab === "ambience" ? "ambience" : tab === "plots" ? "plot" : "anime", icon: current.icon, url: item.assetUrl }));
    return [...builtins, ...admin];
  }, [tab, videos, apiItems, current.icon]);

  const filtered = items.filter((item) => `${item.title} ${item.description} ${item.tag}`.toLowerCase().includes(search.toLowerCase()));
  const selectedDetail = selectedItem ? detailFor(tab, selectedItem) : null;

  function selectTab(next: Tab) {
    setTab(next);
    setSearch("");
    setSelectedItem(null);
    setImagePreview(null);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    url.hash = "";
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function playVoice(title: string) { if (!("speechSynthesis" in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(`สวัสดีค่ะ นี่คือตัวอย่างเสียง ${title} จาก SCENOVA`); u.lang = "th-TH"; speechSynthesis.speak(u); }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div><span>SCENOVA LIBRARY</span><h1>คลังเดียว เลือกประเภทที่ต้องการ</h1><p>ทุก Asset อยู่ในพื้นที่เดียว เลือกด้านล่างว่าจะดูภาพ เสียง ตัวละคร สัตว์ บรรยากาศ พล็อต หรือวิดีโอที่สร้างเสร็จ</p></div>
        <Link className={styles.adminLink} href="/admin">Admin จัดการคลัง →</Link>
      </header>

      <div className={styles.tabs}>{TABS.map((item) => <button key={item.id} className={tab === item.id ? styles.active : ""} onClick={() => selectTab(item.id)}>{item.icon} {item.label}</button>)}</div>

      <section className={styles.section}>
        <div className={styles.sectionHead}><div><h2>{current.label}</h2><p>{current.desc} — ดูตัวอย่างก่อนนำไปใช้ใน Studio หรือ Series</p></div><small>{filtered.length} รายการ</small></div>
        <div className={styles.toolbar}><input className={styles.search} placeholder={`ค้นหาใน${current.label}...`} value={search} onChange={(e) => setSearch(e.target.value)} /><span className={styles.count}>เลือกประเภทด้านบน ไม่ต้องเปลี่ยนหน้า</span></div>
        <div className={styles.grid}>
          {filtered.map((item) => (
            <article className={styles.card} key={item.id}>
              {tab === "images" && item.url ? (
                <button className={styles.previewImageButton} onClick={() => setImagePreview(item)} aria-label={`ดูรูป ${item.title} แบบเต็ม`}>
                  <img className={styles.previewImage} src={item.url} alt={item.title} />
                </button>
              ) : (
                <div className={`${styles.preview} ${styles[item.visual as keyof typeof styles] || ""}`} style={item.url && tab !== "videos" ? { backgroundImage: `url(${item.url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}><span className={styles.previewIcon}>{item.icon}</span></div>
              )}
              <div className={styles.content}><b>{item.title}</b><p>{item.description}</p><span className={styles.tag}>{item.tag}</span>
                {tab === "videos" ? <div className={styles.videoMeta}><span>EP {item.ep}</span><span>{item.duration}s</span></div> : null}
                <div className={styles.actions}>
                  {tab === "voices" ? <button onClick={() => playVoice(item.title)}>▶ ฟังตัวอย่าง</button> : tab === "videos" && item.url ? <a className={styles.primary} href={item.url} download={`SCENOVA-${item.title}.mp4`}>↓ ดาวน์โหลด</a> : <button className={styles.primary}>ใช้รายการนี้</button>}
                  {tab !== "videos" ? <button onClick={() => setSelectedItem(item)}>ดูรายละเอียด</button> : null}
                </div>
              </div>
            </article>
          ))}
          {filtered.length === 0 ? <div className={styles.empty}>ยังไม่มีรายการที่ตรงกับคำค้นหา</div> : null}
        </div>
      </section>

      {selectedItem && selectedDetail ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedItem(null); }}>
          <section className={styles.detailModal} role="dialog" aria-modal="true" aria-label={`รายละเอียด ${selectedItem.title}`}>
            <button className={styles.closeButton} onClick={() => setSelectedItem(null)} aria-label="ปิดรายละเอียด">×</button>
            <div className={styles.detailHero} style={selectedItem.url ? { backgroundImage: `linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.72)),url(${selectedItem.url})` } : undefined} onClick={() => { if (selectedItem.url) setImagePreview(selectedItem); }} role={selectedItem.url ? "button" : undefined} tabIndex={selectedItem.url ? 0 : undefined}>
              {!selectedItem.url ? <span className={styles.detailHeroIcon}>{selectedItem.icon}</span> : null}
              <div className={styles.detailHeroText}><span>{selectedDetail.typeLabel}</span><h2>{selectedItem.title}</h2><p>{selectedItem.description}</p><div className={styles.detailTags}><b>{selectedItem.tag}</b><b>Asset ID: {selectedItem.id}</b></div></div>
            </div>

            <div className={styles.detailBody}>
              <div className={styles.detailIntro}><span>PRODUCTION REFERENCE</span><h3>รายละเอียดสำหรับใช้งานจริง</h3><p>ข้อมูลด้านล่างบอกว่า Asset นี้ควบคุมอะไร เหมาะกับงานแบบไหน และควรส่งข้อมูลอะไรเข้า Prompt / Reference เพื่อให้ผลลัพธ์ต่อเนื่อง</p></div>
              <div className={styles.detailGrid}>
                <article><span>VISUAL LANGUAGE — ภาษาภาพ / ลักษณะหลัก</span><p>{selectedDetail.visualLanguage}</p></article>
                <article><span>LIGHTING — แนวทางแสง</span><p>{selectedDetail.lighting}</p></article>
                <article><span>COLOR & MOOD — สีและอารมณ์</span><p>{selectedDetail.colorMood}</p></article>
                <article><span>BEST FOR — เหมาะกับงาน</span><p>{selectedDetail.bestFor}</p></article>
                <article className={styles.wideDetail}><span>PROMPT GUIDANCE — แนวทางเขียน Prompt</span><p>{selectedDetail.promptHint}</p></article>
                <article className={styles.wideDetail}><span>REFERENCE USAGE — วิธีใช้เป็น Reference</span><p>{selectedDetail.referenceUsage}</p></article>
                <article><span>MODEL / PROVIDER — การรองรับโมเดล</span><p>{selectedDetail.compatibility}</p></article>
                <article><span>LOCK & CONTINUITY — การล็อกความต่อเนื่อง</span><p>{selectedDetail.lockNote}</p></article>
              </div>

              <div className={styles.detailFooter}>
                <div><span>นำ Asset ไปใช้ต่อ</span><p>เลือกใช้รายการนี้จาก Library แล้วสามารถปรับค่ารายละเอียดต่อใน Studio หรือ Series ได้</p></div>
                <div className={styles.detailActions}><button className={styles.secondaryAction} onClick={() => setSelectedItem(null)}>กลับไปดู Library</button><button className={styles.primaryAction}>ใช้รายการนี้</button></div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {imagePreview?.url ? (
        <div className={styles.imageLightboxBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setImagePreview(null); }}>
          <button className={styles.imageOnlyClose} onClick={() => setImagePreview(null)} aria-label="ปิดรูป">×</button>
          <img className={styles.imageLightboxImage} src={imagePreview.url} alt={imagePreview.title} />
        </div>
      ) : null}
    </main>
  );
}
