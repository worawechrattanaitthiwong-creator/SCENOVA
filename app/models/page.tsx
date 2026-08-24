import Link from "next/link";
import { VIDEO_MODELS } from "@/lib/catalogs";

const priceLabel = (level: number) => level === 1 ? "ประหยัด" : level === 2 ? "ปานกลาง" : "พรีเมียม";

export default function ModelsPage() {
  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: 28, color: "#f7f3ff", fontSize: 13 }}>
      <header style={{ marginBottom: 16 }}><span style={{ color: "#b994ed", fontSize: 10, fontWeight: 850, letterSpacing: ".12em" }}>MODEL CENTER</span><h1 style={{ margin: "6px 0", fontSize: 26 }}>โมเดล & เรทราคา</h1><p style={{ margin: 0, color: "#9c91ad", fontSize: 12, lineHeight: 1.6 }}>หน้านี้เป็นศูนย์เปรียบเทียบโมเดลแบบเดิม ดูความสามารถ ความยาวสูงสุด Audio, Reference และระดับราคา แล้วกลับไปเลือกใน Creator</p></header>
      <div style={{ padding: 11, borderRadius: 11, border: "1px solid rgba(255,210,122,.18)", background: "rgba(255,210,122,.04)", color: "#d8c79f", fontSize: 10, lineHeight: 1.55, marginBottom: 12 }}>ตอนนี้ยังไม่เชื่อม Pricing API จริง จึงแสดงระดับราคาเพื่อป้องกันตัวเลขล้าสมัย เมื่อเชื่อม Provider จะคำนวณราคา/วินาทีและเครดิตแบบสด</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 10 }}>
        {VIDEO_MODELS.map((model) => <article key={model.id} style={{ border: "1px solid rgba(171,120,255,.15)", borderRadius: 15, padding: 14, background: "linear-gradient(180deg,#151021,#0d0914)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><b style={{ display: "block", fontSize: 14 }}>{model.name}</b><span style={{ color: "#8e839f", fontSize: 9 }}>{model.provider}</span></div><span style={{ alignSelf: "start", border: "1px solid rgba(181,129,255,.2)", borderRadius: 999, padding: "4px 7px", color: "#d2bbf5", fontSize: 8 }}>{priceLabel(model.priceLevel)}</span></div>
          <p style={{ color: "#a59ab7", fontSize: 10, lineHeight: 1.6 }}>{model.descriptionTh}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[[`${model.maxSecondsPerGeneration} วิ`,"สูงสุดต่อ generation"],[model.resolutions.join(" / "),"Resolution"],[model.supportsAudio?"รองรับ":"ไม่รองรับ","Audio"],[model.supportsVideoReference?"รองรับ":"ไม่รองรับ","Video Reference"]].map(([value,label]) => <div key={label} style={{ padding: 8, borderRadius: 9, background: "#09060e" }}><b style={{ display: "block", fontSize: 10 }}>{value}</b><span style={{ color: "#81768e", fontSize: 8 }}>{label}</span></div>)}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 9 }}>{model.bestFor.map((tag) => <span key={tag} style={{ color: "#c4a8eb", fontSize: 8, padding: "3px 5px", borderRadius: 6, background: "rgba(157,97,255,.07)" }}>{tag}</span>)}</div>
          <Link prefetch href="/" style={{ display: "inline-block", marginTop: 11, color: "white", textDecoration: "none", padding: "7px 9px", borderRadius: 8, background: "linear-gradient(135deg,#7135f2,#a94bff)", fontSize: 9, fontWeight: 800 }}>เลือกใน Creator →</Link>
        </article>)}
      </div>
    </main>
  );
}
