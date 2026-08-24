export default function Loading() {
  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: 30, color: "#f5f5ef" }} aria-label="กำลังเปิดหน้า">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, background: "#f2c94c", boxShadow: "0 0 18px rgba(242,201,76,.4)" }} />
        <b style={{ fontSize: 11, color: "#d7c66c" }}>กำลังสลับหน้า...</b>
      </div>
      <div style={{ height: 92, borderRadius: 16, border: "1px solid #242424", background: "linear-gradient(90deg,#0f0f0f,#17160f,#0f0f0f)", marginBottom: 14 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ height: 250, borderRadius: 16, border: "1px solid #202020", background: "#0d0d0d" }} />
        <div style={{ height: 250, borderRadius: 16, border: "1px solid #202020", background: "#0d0d0d" }} />
      </div>
    </main>
  );
}
