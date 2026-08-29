"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/settings-ui.module.css";

type Me = {
  authenticated: boolean;
  name?: string;
  email?: string;
  role?: string;
  twoFactorEnabled?: boolean;
  twoFactorRequired?: boolean;
};
type SetupData = { secret: string; account: string; otpauthUri: string; issuer: string };

export default function TwoFactorSettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me>({ authenticated: false });
  const [loaded, setLoaded] = useState(false);
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadMe() {
    const response = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await response.json();
    setMe(data);
    setLoaded(true);
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

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.breadcrumb}><Link href="/profile">การตั้งค่า</Link><span>›</span><strong>2FA</strong></div>
          <h1>การยืนยันตัวตน 2 ชั้น</h1>
          <p>เพิ่มชั้นป้องกันบัญชีด้วย Authenticator ที่สร้างรหัส 6 หลักใหม่ทุก 30 วินาที พร้อม Recovery Codes สำหรับกรณีเข้าถึงแอป Authenticator ไม่ได้</p>
        </div>
        <div className={styles.headerStatus}><i />{!loaded ? "กำลังตรวจสอบสถานะ" : me.twoFactorEnabled ? "2FA เปิดใช้งาน" : me.twoFactorRequired ? "บัญชีนี้จำเป็นต้องเปิด 2FA" : "2FA ยังไม่เปิด"}</div>
      </header>

      {message ? <div className={styles.notice}>{message}</div> : null}

      {!loaded ? <div className={styles.notice}>กำลังโหลดสถานะความปลอดภัย...</div> : !me.authenticated ? (
        <section className={styles.panel}><div className={styles.panelBody}><p className={styles.help}>ไม่พบ Session กรุณาเข้าสู่ระบบใหม่</p><div className={styles.actions}><button className={styles.primary} onClick={() => router.push("/login")}>เข้าสู่ระบบ</button></div></div></section>
      ) : (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.kicker}>AUTHENTICATOR 2FA</span>
              <h2>สถานะและการตั้งค่า</h2>
              <p>{me.role === "ADMIN" ? "บัญชี Administrator ต้องใช้ Authenticator ตามนโยบายความปลอดภัยของ SCENOVA" : "เปิดใช้เพื่อเพิ่มความปลอดภัยให้บัญชี โดยระบบจะขอรหัส Authenticator ตอนเข้าสู่ระบบตามเงื่อนไขที่กำหนด"}</p>
            </div>
            <span className={`${styles.badge} ${me.twoFactorEnabled ? styles.badgeGood : ""}`}>{me.twoFactorEnabled ? "เปิดใช้งาน" : me.twoFactorRequired ? "จำเป็น" : "ยังไม่เปิด"}</span>
          </div>
          <div className={styles.panelBody}>
            {!me.twoFactorEnabled && !setup ? <button onClick={startTwoFactor} disabled={loading} className={styles.primary}>{loading ? "กำลังเตรียม..." : "เปิด Authenticator 2FA"}</button> : null}
            {me.twoFactorEnabled && !recoveryCodes.length ? <p className={styles.help}>Authenticator เปิดใช้งานแล้ว ระบบจะไม่แสดง Secret หรือ Recovery Codes เดิมซ้ำเพื่อความปลอดภัย</p> : null}

            {setup ? <div className={styles.setupPanel}>
              <h3>เพิ่ม SCENOVA ใน Authenticator</h3>
              <p className={styles.help}>ใน Google Authenticator หรือ Microsoft Authenticator กดเพิ่มบัญชี แล้วเลือกป้อนคีย์การตั้งค่า จากนั้นใส่ข้อมูลด้านล่าง</p>
              <div className={styles.setupBox}>
                <small>ACCOUNT</small><b>{setup.account}</b>
                <small>SETUP KEY</small><code>{setup.secret}</code>
                <small>TYPE</small><b>Time based (TOTP) · 6 digits · 30 seconds</b>
              </div>
              <div className={styles.actions}><button onClick={() => navigator.clipboard.writeText(setup.secret)} className={styles.secondary}>คัดลอก Setup Key</button></div>
              <label className={styles.label}>รหัส 6 หลักจากแอป<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="123456" className={`${styles.input} ${styles.codeInput}`} /></label>
              <button onClick={confirmTwoFactor} disabled={loading || code.length !== 6} className={styles.primary}>{loading ? "กำลังยืนยัน..." : "ยืนยันและเปิดใช้งาน"}</button>
            </div> : null}

            {recoveryCodes.length > 0 ? <div className={styles.recoveryPanel}>
              <h3>Recovery Codes — เก็บไว้ในที่ปลอดภัย</h3>
              <p className={styles.help}>แต่ละรหัสใช้ได้ครั้งเดียว และระบบจะแสดงชุดนี้เพียงครั้งนี้เท่านั้น ควรบันทึกไว้ใน Password Manager หรือพื้นที่ที่ปลอดภัย</p>
              <div className={styles.recoveryGrid}>{recoveryCodes.map((item) => <code key={item} className={styles.recoveryCode}>{item}</code>)}</div>
              <div className={styles.actions}><button onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))} className={styles.secondary}>คัดลอกรหัสทั้งหมด</button></div>
            </div> : null}
          </div>
        </section>
      )}
    </main>
  );
}
