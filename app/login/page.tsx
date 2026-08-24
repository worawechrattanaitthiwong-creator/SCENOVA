"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
    router.push("/"); router.refresh();
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1.1fr .9fr", background: "#090909", color: "#f5f5ef" }}>
      <section style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "42px 48px", borderRight: "1px solid #222", background: "linear-gradient(145deg,#0a0a0a,#11100b)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}><span style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "#f2c94c", color: "#0a0a0a", fontWeight: 950 }}>S</span><div><b style={{ display: "block", fontSize: 17, letterSpacing: ".08em" }}>SCENOVA</b><small style={{ color: "#777771", fontSize: 10 }}>AI Movie & Series Studio</small></div></div>
        <div style={{ maxWidth: 560 }}><span style={{ color: "#f2c94c", fontSize: 10, fontWeight: 900, letterSpacing: ".14em" }}>CREATE WITH CONTROL</span><h1 style={{ fontSize: 42, lineHeight: 1.08, margin: "10px 0 14px", letterSpacing: "-.04em" }}>สร้างหนังและซีรีส์<br />จากหน้าจอเดียว</h1><p style={{ color: "#898983", fontSize: 13, lineHeight: 1.7 }}>เลือกตัวละคร วางฉาก กำหนดกล้อง เสียง และความต่อเนื่องของ EP แล้วให้ AI ช่วยในระดับที่คุณต้องการ</p></div>
        <small style={{ color: "#575752", fontSize: 9 }}>SCENOVA • Black / Yellow Studio UI</small>
      </section>

      <section style={{ display: "grid", placeItems: "center", padding: 28 }}>
        <form onSubmit={login} style={{ width: "min(410px,100%)", border: "1px solid #242424", borderRadius: 18, background: "#0f0f0f", padding: 24 }}>
          <span style={{ color: "#f2c94c", fontSize: 9, fontWeight: 900, letterSpacing: ".12em" }}>MEMBER ACCESS</span>
          <h2 style={{ margin: "7px 0 5px", fontSize: 24 }}>เข้าสู่ระบบ</h2>
          <p style={{ color: "#85857f", fontSize: 11, lineHeight: 1.6, margin: "0 0 18px" }}>ไม่มี Public Sign-up บัญชีสมาชิกสร้างโดย Admin เท่านั้น</p>
          <label style={labelStyle}>อีเมล<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required style={inputStyle} /></label>
          <label style={labelStyle}>รหัสผ่าน<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required style={inputStyle} /></label>
          {error ? <div style={{ color: "#eaa3a3", fontSize: 10, padding: 9, marginBottom: 11, borderRadius: 9, background: "#1b1111", border: "1px solid #4b2929" }}>{error}</div> : null}
          <button disabled={loading} style={{ width: "100%", border: "1px solid #f2c94c", borderRadius: 10, padding: "11px 14px", color: "#0a0a0a", fontWeight: 900, background: "#f2c94c" }}>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ SCENOVA"}</button>
        </form>
      </section>
    </main>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 800, marginBottom: 12 };
const inputStyle: React.CSSProperties = { width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid #292929", background: "#090909", color: "#f5f5ef", padding: "10px 11px", outline: "none" };
