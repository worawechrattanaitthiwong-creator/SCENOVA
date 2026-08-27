"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./profile.module.css";

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

  useEffect(() => { void loadMe(); }, []);

  async function startTwoFactor() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/2fa/setup", { cache: "no-store" });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(data.error || "เริ่มตั้งค่า 2FA ไม่สำเร็จ");
    if (data.enabled) return setMessage("Authenticator เปิดใช้งานอยู่แล้ว");
    setSetup(data);
  }

  async function confirmTwoFactor() {
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/2fa/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(data.error || "ยืนยัน Authenticator ไม่สำเร็จ");
    setRecoveryCodes(data.recoveryCodes || []);
    setSetup(null);
    setCode("");
    setMessage("เปิด Authenticator 2FA เรียบร้อยแล้ว");
    await loadMe();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <span className={styles.eyebrow}>SETTINGS</span>
      <h1>การตั้งค่า</h1>
      <p>บัญชี 2FA และการตั้งค่าความปลอดภัยของ SCENOVA รวมอยู่ในพื้นที่เดียวกัน</p>
    </header>

    {message ? <div className={styles.notice}>{message}</div> : null}

    {!me.authenticated ? <section className={styles.card}>
      <p className={styles.muted}>ยังไม่ได้เข้าสู่ระบบ</p>
      <button onClick={() => router.push("/login")} className={styles.primary}>เข้าสู่ระบบ</button>
    </section> : <div className={styles.layout}>
      <aside className={styles.identityCard}>
        <div className={`${styles.avatar} ${me.role === "ADMIN" ? "scenova-admin-avatar" : ""}`}>{me.role === "ADMIN" ? "" : me.name?.slice(0, 1).toUpperCase()}</div>
        <h2>{me.name}</h2>
        <span className={styles.role}>{me.role}</span>
        <div className={`${styles.securityBadge} ${me.twoFactorEnabled ? styles.enabledBadge : ""}`}>{me.twoFactorEnabled ? "✓ 2FA เปิดอยู่" : "! 2FA ยังไม่เปิด"}</div>
      </aside>

      <div className={styles.stack}>
        <section className={styles.card}>
          <div className={styles.row}><b>ชื่อ</b><span>{me.name}</span></div>
          <div className={styles.row}><b>อีเมล</b><span>{me.email}</span></div>
          <div className={styles.row}><b>สิทธิ์</b><span>{me.role === "ADMIN" ? "Administrator" : "Member"}</span></div>
          <button onClick={logout} className={styles.logout}>ออกจากระบบ</button>
        </section>

        {me.role === "ADMIN" ? <section className={styles.card}>
          <div className={styles.securityHead}>
            <div>
              <span className={styles.eyebrow}>ADMIN SETTINGS</span>
              <h2>ความปลอดภัยและการควบคุมระบบ</h2>
              <p className={styles.muted}>Security Center, Emergency Control และ AI Cost Control อยู่ในเมนูการตั้งค่า ไม่ปะปนกับหน้าจัดการผู้ใช้</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => router.push("/admin/security")} className={styles.primary}>Security Center</button>
            <button type="button" onClick={() => router.push("/admin/ai-costs")} className={styles.secondary}>AI & Cost Control</button>
          </div>
        </section> : null}

        <section className={styles.card} id="security">
          <div className={styles.securityHead}>
            <div>
              <span className={styles.eyebrow}>AUTHENTICATOR 2FA</span>
              <h2>การยืนยันตัวตน 2 ชั้น</h2>
              <p className={styles.muted}>{me.role === "ADMIN" ? "บัญชี Admin ต้องใช้รหัส 6 หลักจาก Authenticator ทุกครั้งที่เข้าสู่ระบบ" : "เปิดเพิ่มได้เพื่อป้องกันบัญชีด้วยรหัสที่เปลี่ยนทุก 30 วินาที"}</p>
            </div>
            <span className={`${styles.securityBadge} ${me.twoFactorEnabled ? styles.enabledBadge : ""}`}>{me.twoFactorEnabled ? "เปิดใช้งาน" : me.twoFactorRequired ? "จำเป็น" : "ยังไม่เปิด"}</span>
          </div>

          {!me.twoFactorEnabled && !setup ? <button onClick={startTwoFactor} disabled={loading} className={styles.primary}>{loading ? "กำลังเตรียม..." : "เปิด Authenticator 2FA"}</button> : null}

          {setup ? <div className={styles.setupPanel}>
            <h3>เพิ่ม SCENOVA ใน Authenticator</h3>
            <p className={styles.muted}>ใน Google/Microsoft Authenticator กด ＋ → “Enter setup key / ป้อนคีย์การตั้งค่า” แล้วใส่ข้อมูลด้านล่าง</p>
            <div className={styles.setupBox}>
              <small>ACCOUNT</small><b>{setup.account}</b>
              <small>SETUP KEY</small><code>{setup.secret}</code>
              <small>TYPE</small><b>Time based (TOTP) • 6 digits • 30 seconds</b>
            </div>
            <button onClick={() => navigator.clipboard.writeText(setup.secret)} className={styles.secondary}>คัดลอก Setup Key</button>
            <label className={styles.label}>รหัส 6 หลักจากแอป<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" className={styles.input} /></label>
            <button onClick={confirmTwoFactor} disabled={loading} className={styles.primary}>{loading ? "กำลังยืนยัน..." : "ยืนยันและเปิดใช้งาน"}</button>
          </div> : null}

          {recoveryCodes.length > 0 ? <div className={styles.recoveryPanel}>
            <h3>Recovery Codes — เก็บไว้ในที่ปลอดภัย</h3>
            <p className={styles.muted}>แต่ละรหัสใช้ได้ครั้งเดียว ระบบจะแสดงชุดนี้ครั้งนี้ครั้งเดียว</p>
            <div className={styles.recoveryGrid}>{recoveryCodes.map((item) => <code key={item} className={styles.recoveryCode}>{item}</code>)}</div>
            <button onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))} className={styles.secondary}>คัดลอกรหัสทั้งหมด</button>
          </div> : null}
        </section>
      </div>
    </div>}
  </main>;
}
