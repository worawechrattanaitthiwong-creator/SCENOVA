"use client";

const sections = [
  { id: "images", icon: "▧", title: "คลังภาพ", desc: "เก็บ Style Preview, Character Reference, Location Reference และภาพอ้างอิงที่ใช้ซ้ำในโปรเจกต์", items: ["Cinematic Anime", "Photorealistic Film", "Warm Golden Hour", "Action Blockbuster", "Sci‑Fi Neon", "Fantasy Storybook"] },
  { id: "voices", icon: "♫", title: "คลังเสียง", desc: "เลือกเสียงตัวละครและฟังตัวอย่างก่อนนำไปใช้จริง เมื่อเชื่อม Voice Provider จะเก็บ Voice ID ไว้ล็อกข้ามฉากและ EP", items: ["Mira — หญิง อบอุ่น", "Nami — หญิง สดใส", "Arin — ชาย สุขุม", "Keen — ชาย แอ็กชัน", "Luna — หญิง แฟนตาซี"] },
  { id: "characters", icon: "◎", title: "คลังตัวละคร", desc: "ตัวละครที่สร้างหรืออัปโหลดไว้ พร้อม Reference Pack, อายุ, สัญชาติ, ผม, ตา, ปาก, รูปร่าง และ Voice Lock", items: ["ตัวละครมนุษย์", "ตัวละคร Anime", "ตัวละครสมจริง", "Custom Upload", "Character Version / Costume"] },
  { id: "pets", icon: "◇", title: "คลังสัตว์เลี้ยง / Creature", desc: "สัตว์ สัตว์แฟนตาซี หุ่นยนต์ตัวเล็ก หรือ Companion ที่ต้องการล็อกหน้าตาและสเกลให้เหมือนเดิม", items: ["แมว", "สุนัข", "กระต่าย", "จิ้งจอก", "Fantasy Creature", "Robot Companion"] },
  { id: "ambience", icon: "≈", title: "คลังบรรยากาศ", desc: "เสียงรอบข้าง, SFX และบรรยากาศประจำฉาก เพื่อเลือกใช้จาก Scene Editor ได้ทันที", items: ["เมืองตอนเย็น", "ฝนตก", "ป่า", "สถานีรถไฟ", "ยานอวกาศ", "ห้องเงียบ", "ฝูงชน", "ลมและใบไม้"] },
  { id: "plots", icon: "✦", title: "คลังพล็อตเรื่อง", desc: "พล็อตตั้งต้นที่เลือกแล้วส่งกลับไปหน้า Studio จากนั้นแก้ตัวละคร จำนวนฉาก และกล้องต่อได้", items: ["พบสิ่งมีชีวิตลึกลับ", "รักในเมืองอนาคต", "ภารกิจช่วยตัวประกัน", "Mecha Battle", "ความลับในโรงเรียน", "ครอบครัวอบอุ่น", "สืบสวนคืนฝนตก", "ผจญภัยต่างโลก"] },
];

function playVoice(label: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(`สวัสดีค่ะ นี่คือตัวอย่างจาก ${label}`);
  utterance.lang = "th-TH";
  window.speechSynthesis.speak(utterance);
}

export default function LibrariesPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#07050b", color: "#f7f3ff", padding: "28px", fontFamily: "Inter, system-ui, Noto Sans Thai, sans-serif" }}>
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <a href="/" style={{ color: "#c4a3ff", textDecoration: "none", fontSize: 12 }}>← กลับ SCENOVA Studio</a>
        <div style={{ margin: "14px 0 22px" }}><div style={{ color: "#b88cff", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>ASSET LIBRARIES</div><h1 style={{ margin: "6px 0", fontSize: 32 }}>คลังของ SCENOVA</h1><p style={{ margin: 0, color: "#a59ab7", lineHeight: 1.65 }}>รวมของที่ใช้ซ้ำทั้งหมดไว้ที่เดียว ไม่ต้องสร้างใหม่ทุกฉาก เมื่อเลือกของจากคลัง ระบบจะส่ง ID และ Lock กลับไปใช้ใน Studio</p></div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12 }}>{sections.map((section) => <a key={section.id} href={`#${section.id}`} style={{ flex: "0 0 auto", color: "#eee5ff", textDecoration: "none", border: "1px solid rgba(181,129,255,.2)", borderRadius: 10, padding: "8px 11px", background: "#151021", fontSize: 11 }}>{section.title}</a>)}</div>
        {sections.map((section) => (
          <section id={section.id} key={section.id} style={{ scrollMarginTop: 20, marginTop: 14, border: "1px solid rgba(171,120,255,.16)", borderRadius: 17, padding: 18, background: "linear-gradient(180deg,#151021,#0d0914)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "start" }}><div><div style={{ color: "#bd96ff", fontWeight: 900 }}>{section.icon}</div><h2 style={{ margin: "5px 0 4px", fontSize: 20 }}>{section.title}</h2><p style={{ margin: 0, color: "#9c91ad", fontSize: 12, lineHeight: 1.6 }}>{section.desc}</p></div><button style={{ color: "white", border: "1px solid rgba(181,129,255,.24)", background: "#181124", borderRadius: 10, padding: "8px 11px", fontWeight: 800 }}>＋ เพิ่มเข้า Library</button></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 9, marginTop: 14 }}>
              {section.items.map((item) => <div key={item} style={{ border: "1px solid rgba(171,120,255,.12)", background: "#0a0710", borderRadius: 12, padding: 11 }}><b style={{ display: "block", fontSize: 11 }}>{item}</b><span style={{ display: "block", color: "#81768e", fontSize: 9, marginTop: 4 }}>ตัวอย่าง / Placeholder — พร้อมเชื่อม Asset จริงภายหลัง</span>{section.id === "voices" ? <button onClick={() => playVoice(item)} style={{ marginTop: 8, color: "white", border: "1px solid rgba(181,129,255,.2)", background: "#1a1228", borderRadius: 8, padding: "5px 8px", fontSize: 9 }}>▶ ฟังตัวอย่าง</button> : null}</div>)}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
