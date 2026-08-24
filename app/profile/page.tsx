"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = { authenticated: boolean; id?: string; name?: string; email?: string; role?: string; twoFactorEnabled?: boolean; twoFactorRequired?: boolean };
type SetupData = { secret: string; account: string; otpauthUri: string; issuer: string };

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me>({ authenticated: false });
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadMe() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();
    setMe(data);
  }
  useEffect(() => { loadMe(); }, []);

  async function startTwoFactor() {
    setLoading(true); setMessage("");
    const response = await fetch("/api/auth/2fa/setup", { cache: "no-store" });
    const data = await response.json(); setLoading(false);
    if (!response.ok) return setMessage(data.error || "เริ่มตั้งค่า 2FA ไม่สำเร็จ");
    if (data.enabled) return setMessage("Authenticator เปิดใช้งานอยู่แล้ว");
    setSetup(data);
  }

  async function confirmTwoFactor() {
    setLoading(true); setMessage("");
    const response = await fetch("/api/auth/2fa/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) return setMessage(data.error || "ยืนยัน Authenticator ไม่สำเร็จ");
    setRecoveryCodes(data.recoveryCodes || []); setSetup(null); setCode(""); setMessage("เปิด Authenticator 2FA เรียบร้อยแล้ว"); await loadMe();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login"); router.refresh();
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: 30, color: "#f5f5ef" }}>
      <header style={{ marginBottom: 18 }}><span style={eyebrow}>PROFILE & SECURITY</span><h1 style={{ margin: "7px 0 5px", fontSize: 28 }}>โปรไฟล์และความปลอดภัย</h1><p style={muted}>จัดการบัญชีและ Authenticator ของ SCENOVA จากที่นี่ บัญชี Admin บังคับใช้การยืนยันตัวตน 2 ชั้น</p></header>
      {message ? <div style={notice}>{message}</div> : null}
      {!me.authenticated ? (
        <div style={card}><p style={muted}>ยังไม่ได้เข้าสู่ระบบ</p><button onClick={() => router.push("/login")} style={primary}>เข้าสู่ระบบ</button></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 14 }}>
          <div style={card}><div style={{ width: 76, height: 76, borderRadius: 20, display: "grid", placeItems: "center", background: "#f2c94c", color: "#0a0a0a", fontSize: 27, fontWeight: 950 }}>{me.name?.slice(0,1).toUpperCase()}</div><h2 style={{ fontSize: 16, margin: "12px 0 2px" }}>{me.name}</h2><span style={{ color: "#f2c94c", fontSize: 9, fontWeight: 850 }}>{me.role}</span><div style={{ marginTop: 12, ...securityBadge, ...(me.twoFactorEnabled ? enabledBadge : {}) }}>{me.twoFactorEnabled ? "✓ 2FA เปิดอยู่" : "! 2FA ยังไม่เปิด"}</div></div>

          <div style={{ display: "grid", gap: 14 }}>
            <section style={card}><div style={row}><b>ชื่อ</b><span>{me.name}</span></div><div style={row}><b>อีเมล</b><span>{me.email}</span></div><div style={row}><b>สิทธิ์</b><span>{me.role === "ADMIN" ? "Administrator — จัดการสมาชิก เครดิต และคลัง" : "Member — ใช้งาน Studio"}</span></div><button onClick={logout} style={logoutButton}>ออกจากระบบ</button></section>

            <section style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}><div><span style={eyebrow}>AUTHENTICATOR 2FA</span><h2 style={{ fontSize: 17, margin: "5px 0" }}>การยืนยันตัวตน 2 ชั้น</h2><p style={muted}>{me.role === "ADMIN" ? "บัญชี Admin ต้องใช้รหัส 6 หลักจาก Authenticator ทุกครั้งที่เข้าสู่ระบบ" : "เปิดเพิ่มได้เพื่อป้องกันบัญชีด้วยรหัสที่เปลี่ยนทุก 30 วินาที"}</p></div><span style={{ ...securityBadge, ...(me.twoFactorEnabled ? enabledBadge : {}) }}>{me.twoFactorEnabled ? "เปิดใช้งาน" : me.twoFactorRequired ? "จำเป็น" : "ยังไม่เปิด"}</span></div>

              {!me.twoFactorEnabled && !setup ? <button onClick={startTwoFactor} disabled={loading} style={primary}>{loading ? "กำลังเตรียม..." : "เปิด Authenticator 2FA"}</button> : null}

              {setup ? <div style={setupPanel}><h3 style={{ margin: "0 0 6px", fontSize: 14 }}>เพิ่ม SCENOVA ใน Authenticator</h3><p style={muted}>ใน Google/Microsoft Authenticator กด ＋ → “Enter setup key / ป้อนคีย์การตั้งค่า” แล้วใส่ข้อมูลด้านล่าง</p><div style={setupBox}><small>ACCOUNT</small><b>{setup.account}</b><small>SETUP KEY</small><code>{setup.secret}</code><small>TYPE</small><b>Time based (TOTP) • 6 digits • 30 seconds</b></div><button onClick={() => navigator.clipboard.writeText(setup.secret)} style={secondary}>คัดลอก Setup Key</button><label style={label}>รหัส 6 หลักจากแอป<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" style={input} /></label><button onClick={confirmTwoFactor} disabled={loading} style={primary}>{loading ? "กำลังยืนยัน..." : "ยืนยันและเปิดใช้งาน"}</button></div> : null}

              {recoveryCodes.length > 0 ? <div style={recoveryPanel}><h3 style={{ margin: "0 0 5px", fontSize: 14 }}>Recovery Codes — เก็บไว้ในที่ปลอดภัย</h3><p style={muted}>แต่ละรหัสใช้ได้ครั้งเดียว ระบบจะแสดงชุดนี้ครั้งนี้ครั้งเดียว</p><div style={recoveryGrid}>{recoveryCodes.map((item) => <code key={item} style={recoveryCode}>{item}</code>)}</div><button onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))} style={secondary}>คัดลอกรหัสทั้งหมด</button></div> : null}
            </section>
          </div>
        </div>
      )}
    </main>
  );
}

const card: React.CSSProperties = { border: "1px solid #242424", borderRadius: 16, padding: 18, background: "#0f0f0f" };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, padding: "11px 0", borderBottom: "1px solid #202020", fontSize: 11 };
const primary: React.CSSProperties = { border: "1px solid #f2c94c", borderRadius: 10, padding: "10px 13px", background: "#f2c94c", color: "#0a0a0a", fontWeight: 900, cursor: "pointer" };
const secondary: React.CSSProperties = { border: "1px solid #383838", borderRadius: 9, padding: "8px 10px", background: "#151515", color: "#e1e1db", fontWeight: 800, cursor: "pointer", margin: "8px 0" };
const logoutButton: React.CSSProperties = { marginTop: 16, border: "1px solid #4b2929", borderRadius: 10, padding: "9px 12px", background: "#1b1111", color: "#e8a0a0", fontWeight: 800, cursor: "pointer" };
const eyebrow: React.CSSProperties = { color: "#f2c94c", fontSize: 9, fontWeight: 900, letterSpacing: ".12em" };
const muted: React.CSSProperties = { color: "#898983", fontSize: 10, lineHeight: 1.6, margin: "4px 0 12px" };
const notice: React.CSSProperties = { border: "1px solid #3b351e", borderRadius: 11, background: "#17160f", color: "#d9c45f", padding: "10px 12px", fontSize: 10, marginBottom: 14 };
const securityBadge: React.CSSProperties = { display: "inline-flex", padding: "6px 8px", borderRadius: 999, border: "1px solid #4b3a22", background: "#1a130c", color: "#e0b765", fontSize: 9, fontWeight: 850 };
const enabledBadge: React.CSSProperties = { borderColor: "#28432e", background: "#101b12", color: "#8bcf98" };
const setupPanel: React.CSSProperties = { marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid #34301e", background: "#11110c" };
const setupBox: React.CSSProperties = { display: "grid", gap: 5, padding: 12, borderRadius: 10, background: "#17160f", border: "1px solid #38331b", wordBreak: "break-all", fontSize: 10 };
const label: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 800, margin: "8px 0" };
const input: React.CSSProperties = { width: "100%", marginTop: 6, borderRadius: 10, border: "1px solid #292929", background: "#090909", color: "#f5f5ef", padding: "10px 11px", outline: "none", fontSize: 18, letterSpacing: ".15em", textAlign: "center" };
const recoveryPanel: React.CSSProperties = { marginTop: 14, padding: 14, borderRadius: 12, border: "1px solid #314225", background: "#10170e" };
const recoveryGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7 };
const recoveryCode: React.CSSProperties = { border: "1px solid #38432f", borderRadius: 8, padding: 8, background: "#0c120b", color: "#b7d99f", textAlign: "center", fontSize: 10 };
