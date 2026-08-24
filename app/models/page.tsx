import Link from "next/link";
import { VIDEO_MODELS } from "@/lib/catalogs";

const priceLabel = (level: number) => level === 1 ? "ประหยัด" : level === 2 ? "ปานกลาง" : "พรีเมียม";

export default function ModelsPage() {
  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: 30, color: "#f5f5ef", fontSize: 13 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "end", marginBottom: 18 }}>
        <div><span style={{ color: "#f2c94c", fontSize: 10, fontWeight: 900, letterSpacing: ".14em" }}>MODEL CENTER</span><h1 style={{ margin: "7px 0 5px", fontSize: 28 }}>โมเดล & เรทราคา</h1><p style={{ margin: 0, color: "#898983", fontSize: 12, lineHeight: 1.65, maxWidth: 760 }}>เปรียบเทียบโมเดลก่อนใช้งาน ดูความยาวสูงสุด ความละเอียด Audio, Reference และระดับราคา แล้วกลับไปเลือกใน Creator</p></div>
        <Link href="/" style={{ color: "#0a0a0a", background: "#f2c94c", borderRadius: 9, padding: "9px 12px", textDecoration: "none", fontWeight: 850, fontSize: 10 }}>กลับ Creator</Link>
      </header>
      <div style={{ padding: 11, borderRadius: 11, border: "1px solid #3b351e", background: "#17160f", color: "#d9c45f", fontSize: 10, lineHeight: 1.55, marginBottom: 13 }}>ยังไม่เชื่อม Pricing API จริง จึงแสดงระดับราคาเพื่อไม่ให้ตัวเลขล้าสมัย เมื่อเชื่อม Provider ระบบจะคำนวณราคา/วินาทีและเครดิตแบบสด</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(275px,1fr))", gap: 10 }}>
        {VIDEO_MODELS.map((model) => <article key={model.id} style={{ border: "1px solid #242424", borderRadius: 15, padding: 15, background: "#0f0f0f" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><b style={{ display: "block", fontSize: 15 }}>{model.name}</b><span style={{ color: "#777771", fontSize: 9 }}>{model.provider}</span></div><span style={{ alignSelf: "start", border: "1px solid #3b351e", borderRadius: 999, padding: "4px 7px", color: "#d9c45f", background: "#17160f", fontSize: 8, fontWeight: 800 }}>{priceLabel(model.priceLevel)}</span></div>
          <p style={{ color: "#92928c", fontSize: 10, lineHeight: 1.6 }}>{model.descriptionTh}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[[`${model.maxSecondsPerGeneration} วิ`,"สูงสุดต่อ generation"],[model.resolutions.join(" / "),"Resolution"],[model.supportsAudio?"รองรับ":"ไม่รองรับ","Audio"],[model.supportsVideoReference?"รองรับ":"ไม่รองรับ","Video Reference"]].map(([value,label]) => <div key={label} style={{ padding: 9, borderRadius: 9, background: "#090909", border: "1px solid #202020" }}><b style={{ display: "block", fontSize: 10 }}>{value}</b><span style={{ color: "#6f6f69", fontSize: 8 }}>{label}</span></div>)}
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 9 }}>{model.bestFor.map((tag) => <span key={tag} style={{ color: "#d6bc5a", fontSize: 8, padding: "4px 6px", borderRadius: 6, background: "#19180f" }}>{tag}</span>)}</div>
          <Link prefetch href="/" style={{ display: "inline-block", marginTop: 12, color: "#0a0a0a", textDecoration: "none", padding: "8px 10px", borderRadius: 8, background: "#f2c94c", fontSize: 9, fontWeight: 900 }}>เลือกใน Creator →</Link>
        </article>)}
      </div>
    </main>
  );
}
