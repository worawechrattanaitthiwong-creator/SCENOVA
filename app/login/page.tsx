"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "password" | "otp" | "setup" | "recovery";
type SetupData = { secret: string; otpauthUri: string; account: string; issuer: string };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("password");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setError(data.error || "Authentication failed");
    if (data.twoFactorSetupRequired) return startSetup();
    if (data.twoFactorRequired) { setStage("otp"); return; }
    enterPortal();
  }

  async function startSetup() {
    setLoading(true); setError("");
    const response = await fetch("/api/auth/2fa/setup", { cache: "no-store" });
    const data = await response.json(); setLoading(false);
    if (!response.ok) return setError(data.error || "Unable to start 2FA setup");
    setSetup(data); setStage("setup");
  }

  async function confirmSetup(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/2fa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) return setError(data.error || "Authenticator verification failed");
    setRecoveryCodes(data.recoveryCodes || []); setStage("recovery");
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const response = await fetch("/api/auth/2fa/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) return setError(data.error || "Verification failed");
    enterPortal();
  }

  function enterPortal() { router.push("/portal"); router.refresh(); }

  return (
    <main style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "1.1fr .9fr", background: "#090909", color: "#f5f5ef" }}>
      <section style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "42px 48px", borderRight: "1px solid #222", background: "linear-gradient(145deg,#0a0a0a,#11100b)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}><span style={{ width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: "#f2c94c", color: "#0a0a0a", fontWeight: 950 }}>S</span><div><b style={{ display: "block", fontSize: 17, letterSpacing: ".08em" }}>SCENOVA</b><small style={{ color: "#777771", fontSize: 10 }}>AI Cinematic Production Studio</small></div></div>
        <div style={{ maxWidth: 620 }}><span style={eyebrow}>SECURE PRODUCTION WORKSPACE</span><h1 style={{ fontSize: 42, lineHeight: 1.08, margin: "10px 0 14px", letterSpacing: "-.04em" }}>Professional AI Production<br />from a Single Workspace</h1><p style={heroText}>Studio สำหรับ Story Development, Scene Direction, Camera Design, Series Continuity, Prompt Engineering และ Multi-model Rendering พร้อมระบบความปลอดภัยสำหรับ Admin และสมาชิก</p></div>
        <small style={{ color: "#575752", fontSize: 9 }}>SCENOVA • SECURE CINEMATIC WORKSPACE</small>
      </section>

      <section style={{ display: "grid", placeItems: "center", padding: 28 }}>
        <div style={card}>
          {stage === "password" ? <form onSubmit={login}><span style={eyebrow}>MEMBER ACCESS</span><h2 style={title}>Sign in to SCENOVA</h2><p style={muted}>ไม่มี Public Sign-up บัญชีสมาชิกถูกสร้างและจัดการโดย Admin Console เท่านั้น</p><label style={labelStyle}>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required style={inputStyle} /></label><label style={labelStyle}>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required style={inputStyle} /></label>{error ? <ErrorBox text={error} /> : null}<button disabled={loading} style={primary}>{loading ? "Authenticating..." : "Continue"}</button></form> : null}

          {stage === "otp" ? <form onSubmit={verifyOtp}><span style={eyebrow}>2-STEP VERIFICATION</span><h2 style={title}>Authenticator Verification</h2><p style={muted}>เปิด Authenticator แล้วกรอกรหัส 6 หลักปัจจุบัน หรือใช้ Recovery Code เมื่อไม่มีอุปกรณ์หลัก</p><label style={labelStyle}>Verification Code<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoFocus placeholder="123456" style={{ ...inputStyle, fontSize: 20, letterSpacing: ".18em", textAlign: "center" }} /></label>{error ? <ErrorBox text={error} /> : null}<button disabled={loading} style={primary}>{loading ? "Verifying..." : "Verify & Continue"}</button><button type="button" onClick={() => { setStage("password"); setCode(""); setError(""); }} style={secondary}>Back to Password</button></form> : null}

          {stage === "setup" ? <form onSubmit={confirmSetup}><span style={eyebrow}>ADMIN SECURITY REQUIRED</span><h2 style={title}>Authenticator Setup</h2><p style={muted}>ใน Google/Microsoft Authenticator กด ＋ → เลือก “Enter setup key” แล้วใช้ข้อมูลด้านล่าง</p><div style={setupBox}><small>ACCOUNT</small><b>{setup?.account}</b><small>SETUP KEY</small><code>{setup?.secret}</code><small>TYPE</small><b>Time based (TOTP) • 6 digits • 30 seconds</b></div><button type="button" onClick={() => setup?.secret && navigator.clipboard.writeText(setup.secret)} style={secondary}>Copy Setup Key</button><label style={labelStyle}>Authenticator Code<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoFocus placeholder="123456" style={{ ...inputStyle, fontSize: 20, letterSpacing: ".18em", textAlign: "center" }} /></label>{error ? <ErrorBox text={error} /> : null}<button disabled={loading} style={primary}>{loading ? "Enabling 2FA..." : "Verify & Enable 2FA"}</button></form> : null}

          {stage === "recovery" ? <div><span style={eyebrow}>RECOVERY CODES</span><h2 style={title}>Store Recovery Codes</h2><p style={muted}>แต่ละรหัสใช้ได้ครั้งเดียวสำหรับกรณี Authenticator ใช้งานไม่ได้ ระบบจะแสดงชุดจริงเพียงครั้งเดียว</p><div style={recoveryGrid}>{recoveryCodes.map((item) => <code key={item} style={recoveryCode}>{item}</code>)}</div><button onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))} style={secondary}>Copy All</button><button onClick={enterPortal} style={primary}>Saved → Enter SCENOVA</button></div> : null}
        </div>
      </section>
    </main>
  );
}

function ErrorBox({ text }: { text: string }) { return <div style={{ color: "#eaa3a3", fontSize: 10, padding: 9, marginBottom: 11, borderRadius: 9, background: "#1b1111", border: "1px solid #4b2929" }}>{text}</div>; }
const card: React.CSSProperties = { width: "min(430px,100%)", border: "1px solid #242424", borderRadius: 18, background: "#0f0f0f", padding: 24 };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 800, marginBottom: 12 };
const inputStyle: React.CSSProperties = { width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid #292929", background: "#090909", color: "#f5f5ef", padding: "10px 11px", outline: "none" };
const primary: React.CSSProperties = { width: "100%", border: "1px solid #f2c94c", borderRadius: 10, padding: "11px 14px", color: "#0a0a0a", fontWeight: 900, background: "#f2c94c", cursor: "pointer", marginTop: 6 };
const secondary: React.CSSProperties = { width: "100%", border: "1px solid #333", borderRadius: 10, padding: "10px 12px", color: "#d8d8d2", fontWeight: 800, background: "#151515", cursor: "pointer", margin: "6px 0 12px" };
const eyebrow: React.CSSProperties = { color: "#f2c94c", fontSize: 9, fontWeight: 900, letterSpacing: ".12em" };
const title: React.CSSProperties = { margin: "7px 0 5px", fontSize: 24 };
const muted: React.CSSProperties = { color: "#85857f", fontSize: 11, lineHeight: 1.6, margin: "0 0 18px" };
const heroText: React.CSSProperties = { color: "#898983", fontSize: 13, lineHeight: 1.7 };
const setupBox: React.CSSProperties = { display: "grid", gap: 6, padding: 14, borderRadius: 12, background: "#17160f", border: "1px solid #38331b", marginBottom: 8, wordBreak: "break-all", fontSize: 11 };
const recoveryGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 8 };
const recoveryCode: React.CSSProperties = { border: "1px solid #34301e", borderRadius: 8, padding: 8, background: "#15140e", color: "#f2d86d", textAlign: "center", fontSize: 10 };
