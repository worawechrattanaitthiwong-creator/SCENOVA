"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(process.env.NODE_ENV === "development" ? "admin@scenova.local" : "");
  const [password, setPassword] = useState(process.env.NODE_ENV === "development" ? "admin1234" : "");
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
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "radial-gradient(circle at 50% 15%,rgba(120,54,255,.18),transparent 34%),#07050b", color: "#f7f3ff" }}>
      <form onSubmit={login} style={{ width: "min(440px,100%)", border: "1px solid rgba(171,120,255,.2)", borderRadius: 20, background: "linear-gradient(180deg,#151021,#0d0914)", padding: 24, boxShadow: "0 28px 90px rgba(0,0,0,.42)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}><span style={{ width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#8b4cff,#d36cff)", fontWeight: 900 }}>S</span><div><b style={{ display: "block", fontSize: 16, letterSpacing: ".08em" }}>SCENOVA</b><small style={{ color: "#9489a7", fontSize: 11 }}>AI Movie & Series Studio</small></div></div>
        <h1 style={{ margin: "0 0 6px", fontSize: 24 }}>เข้าสู่ระบบ</h1>
        <p style={{ color: "#a59ab7", fontSize: 12, lineHeight: 1.6, margin: "0 0 18px" }}>ไม่มีการสมัครสมาชิกด้วยตัวเอง บัญชีใหม่จะถูกสร้างโดย Admin เท่านั้น</p>
        <label style={{ display: "block", fontSize: 12, fontWeight: 750, marginBottom: 12 }}>อีเมล<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={inputStyle} /></label>
        <label style={{ display: "block", fontSize: 12, fontWeight: 750, marginBottom: 12 }}>รหัสผ่าน<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required style={inputStyle} /></label>
        {error ? <div style={{ color: "#ffc1d0", fontSize: 11, padding: 9, marginBottom: 11, borderRadius: 9, background: "rgba(255,123,156,.06)", border: "1px solid rgba(255,123,156,.2)" }}>{error}</div> : null}
        <button disabled={loading} style={{ width: "100%", border: 0, borderRadius: 11, padding: "12px 14px", color: "white", fontWeight: 850, background: "linear-gradient(135deg,#7135f2,#b85cff)" }}>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ SCENOVA"}</button>
        {process.env.NODE_ENV === "development" ? <div style={{ marginTop: 12, color: "#81768e", fontSize: 10, lineHeight: 1.5 }}>Preview Dev: admin@scenova.local / admin1234 — เปลี่ยนผ่าน SCENOVA_ADMIN_EMAIL และ SCENOVA_ADMIN_PASSWORD ก่อน Production</div> : null}
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid rgba(171,120,255,.18)", background: "#09060e", color: "#f7f3ff", padding: "10px 11px", outline: "none" };
