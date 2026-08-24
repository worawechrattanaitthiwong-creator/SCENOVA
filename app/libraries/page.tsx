"use client";

import { useEffect, useMemo, useState } from "react";

type LibraryItem = { id: string; kind: string; title: string; description: string; assetUrl?: string };
const SECTIONS = [
  ["images","▧","คลังภาพ","Style Preview, Character Reference และภาพอ้างอิง"],
  ["voices","♫","คลังเสียง","เสียงตัวละครพร้อมตัวอย่าง"],
  ["characters","◎","คลังตัวละคร","ตัวละครและ Reference Pack ที่ใช้ซ้ำได้"],
  ["pets","◇","คลังสัตว์เลี้ยง / Creature","สัตว์ สิ่งมีชีวิต และ Robot companion"],
  ["ambience","≈","คลังบรรยากาศ","เสียงรอบข้าง SFX และ ambience"],
  ["plots","✦","คลังพล็อตเรื่อง","พล็อตตั้งต้นสำหรับเริ่มสร้างเร็ว"],
] as const;

export default function LibrariesPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  useEffect(() => { fetch("/api/library", { cache: "no-store" }).then((r) => r.json()).then((data) => setItems(data.items || [])).catch(() => setItems([])); }, []);
  const grouped = useMemo(() => Object.fromEntries(SECTIONS.map(([id]) => [id, items.filter((item) => item.kind === id)])), [items]);

  function playVoice(label: string) {
    if (!("speechSynthesis" in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(`สวัสดีค่ะ นี่คือตัวอย่างเสียง ${label} จาก SCENOVA`); u.lang = "th-TH"; speechSynthesis.speak(u);
  }

  return <main style={{ maxWidth: 1320, margin: "0 auto", padding: 28, color: "#f7f3ff", fontSize: 13 }}>
    <header style={{ marginBottom: 15 }}><span style={eyebrow}>ASSET LIBRARIES</span><h1 style={{ fontSize: 26, margin: "6px 0" }}>คลังของ SCENOVA</h1><p style={muted}>ของที่ใช้ซ้ำทั้งหมดอยู่ที่เดียว ผู้ใช้เลือกจากคลัง ส่วน Admin เป็นผู้เพิ่มและดูแลรายการกลาง</p></header>
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8 }}>{SECTIONS.map(([id,,title]) => <a key={id} href={`#${id}`} style={chip}>{title}</a>)}</div>
    {SECTIONS.map(([id,icon,title,desc]) => <section id={id} key={id} style={{ ...card, marginTop: 10, scrollMarginTop: 72 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}><div><span style={{ color: "#bd96ff", fontWeight: 900 }}>{icon}</span><h2 style={{ margin: "4px 0", fontSize: 16 }}>{title}</h2><p style={muted}>{desc}</p></div><span style={{ color: "#8f849f", fontSize: 9 }}>{grouped[id]?.length || 0} รายการ</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
        {(grouped[id] || []).map((item: LibraryItem) => <article key={item.id} style={{ border: "1px solid rgba(171,120,255,.12)", borderRadius: 11, background: "#09060e", padding: 9 }}>{item.assetUrl ? <img src={item.assetUrl} alt={item.title} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} /> : <div style={{ height: 70, display: "grid", placeItems: "center", borderRadius: 8, background: "linear-gradient(135deg,#1e1530,#4b2b70)", color: "#c7a8ef", marginBottom: 8 }}>{icon}</div>}<b style={{ display: "block", fontSize: 11 }}>{item.title}</b><p style={{ color: "#8f849f", fontSize: 9, lineHeight: 1.5, minHeight: 27 }}>{item.description}</p>{id === "voices" ? <button onClick={() => playVoice(item.title)} style={smallButton}>▶ ฟังตัวอย่าง</button> : <button style={smallButton}>ใช้รายการนี้</button>}</article>)}
        {(grouped[id] || []).length === 0 ? <div style={{ color: "#81768e", fontSize: 10 }}>ยังไม่มีรายการในคลังนี้ Admin สามารถเพิ่มจากหลังบ้านได้</div> : null}
      </div>
    </section>)}
  </main>;
}

const card: React.CSSProperties = { border: "1px solid rgba(171,120,255,.15)", borderRadius: 15, padding: 14, background: "linear-gradient(180deg,#151021,#0d0914)" };
const muted: React.CSSProperties = { margin: "0 0 11px", color: "#9c91ad", fontSize: 10, lineHeight: 1.6 };
const eyebrow: React.CSSProperties = { color: "#b994ed", fontSize: 10, fontWeight: 850, letterSpacing: ".12em" };
const chip: React.CSSProperties = { flex: "0 0 auto", color: "#eee5ff", textDecoration: "none", border: "1px solid rgba(181,129,255,.17)", borderRadius: 9, padding: "7px 9px", background: "#100b18", fontSize: 10, fontWeight: 700 };
const smallButton: React.CSSProperties = { border: "1px solid rgba(181,129,255,.18)", borderRadius: 8, background: "#171023", color: "#fff", fontSize: 9, padding: "5px 7px", fontWeight: 750, cursor: "pointer" };
