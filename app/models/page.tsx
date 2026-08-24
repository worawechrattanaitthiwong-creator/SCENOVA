import { VIDEO_MODELS } from "@/lib/catalogs";

const priceLabel = (level: number) => level === 1 ? "ประหยัด" : level === 2 ? "ปานกลาง" : "พรีเมียม";

export default function ModelsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#07050b", color: "#f7f3ff", padding: "28px", fontFamily: "Inter, system-ui, Noto Sans Thai, sans-serif" }}>
      <div style={{ maxWidth: 1250, margin: "0 auto" }}>
        <a href="/" style={{ color: "#c4a3ff", textDecoration: "none", fontSize: 12 }}>← กลับ SCENOVA Studio</a>
        <div style={{ margin: "14px 0 22px" }}>
          <div style={{ color: "#b88cff", fontSize: 11, fontWeight: 800, letterSpacing: ".12em" }}>MODEL CENTER</div>
          <h1 style={{ margin: "6px 0", fontSize: 32 }}>โมเดล & เรทราคา</h1>
          <p style={{ margin: 0, color: "#a59ab7", lineHeight: 1.65 }}>หน้านี้เอาไว้เปรียบเทียบโมเดลก่อนเลือกใน Studio โดยระบบจริงจะดึงราคา API ล่าสุดและแปลงเป็นเครดิตก่อนผู้ใช้กดสร้าง เพื่อไม่ให้ราคาในหน้า Creator รกเกินไป</p>
        </div>

        <div style={{ padding: 13, borderRadius: 13, border: "1px solid rgba(255,210,122,.2)", background: "rgba(255,210,122,.05)", color: "#dcc79d", fontSize: 11, lineHeight: 1.55, marginBottom: 13 }}>
          ตอนนี้ Core ยังไม่เชื่อม Provider และ Pricing API จริง จึงแสดง “ระดับราคา” แทนเงินบาท เพื่อไม่ใส่ตัวเลขที่อาจเปลี่ยนหรือทำให้เข้าใจผิด เมื่อเชื่อม API ขั้นท้าย หน้านี้จะมีราคา/วินาที, ความละเอียด, Audio, Reference และราคาประมาณต่อคลิปแบบสด
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
          {VIDEO_MODELS.map((model) => (
            <article key={model.id} style={{ border: "1px solid rgba(171,120,255,.16)", borderRadius: 17, padding: 16, background: "linear-gradient(180deg,#151021,#0d0914)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><div><b style={{ display: "block", fontSize: 17 }}>{model.name}</b><span style={{ color: "#8e839f", fontSize: 10 }}>{model.provider}</span></div><span style={{ alignSelf: "start", border: "1px solid rgba(181,129,255,.2)", borderRadius: 999, padding: "4px 7px", color: "#d2bbf5", fontSize: 9 }}>{priceLabel(model.priceLevel)}</span></div>
              <p style={{ color: "#a59ab7", fontSize: 11, lineHeight: 1.6 }}>{model.descriptionTh}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                <div style={{ padding: 9, borderRadius: 10, background: "#0a0710" }}><b style={{ display: "block", fontSize: 10 }}>{model.maxSecondsPerGeneration} วิ</b><span style={{ color: "#81768e", fontSize: 8 }}>สูงสุดต่อ generation</span></div>
                <div style={{ padding: 9, borderRadius: 10, background: "#0a0710" }}><b style={{ display: "block", fontSize: 10 }}>{model.resolutions.join(" / ")}</b><span style={{ color: "#81768e", fontSize: 8 }}>Resolution</span></div>
                <div style={{ padding: 9, borderRadius: 10, background: "#0a0710" }}><b style={{ display: "block", fontSize: 10 }}>{model.supportsAudio ? "รองรับ" : "ยังไม่รองรับ"}</b><span style={{ color: "#81768e", fontSize: 8 }}>Audio</span></div>
                <div style={{ padding: 9, borderRadius: 10, background: "#0a0710" }}><b style={{ display: "block", fontSize: 10 }}>{model.supportsVideoReference ? "รองรับ" : "ไม่รองรับ"}</b><span style={{ color: "#81768e", fontSize: 8 }}>Video Reference</span></div>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 11 }}>{model.bestFor.map((tag) => <span key={tag} style={{ color: "#c4a8eb", fontSize: 8, padding: "4px 6px", borderRadius: 7, background: "rgba(157,97,255,.07)" }}>{tag}</span>)}</div>
              <a href="/" style={{ display: "inline-block", marginTop: 13, color: "white", textDecoration: "none", padding: "8px 10px", borderRadius: 9, background: "linear-gradient(135deg,#7135f2,#a94bff)", fontSize: 10, fontWeight: 800 }}>เลือกใน Studio →</a>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
