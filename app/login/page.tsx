"use client";

import { useState } from "react";
import styles from "./login.module.css";

type Stage = "password" | "otp" | "setup" | "recovery";
type SetupData = { secret: string; otpauthUri: string; account: string; issuer: string };
type ApiData = Record<string, unknown>;
type SessionProbe = { authenticated?: boolean; reason?: string };

async function readJson(response: Response): Promise<ApiData> {
  try {
    return await response.json() as ApiData;
  } catch {
    return {};
  }
}

function apiError(data: ApiData, fallback: string) {
  return typeof data.error === "string" && data.error ? data.error : fallback;
}

function parseSetupData(value: unknown): SetupData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (
    typeof data.secret !== "string" ||
    typeof data.otpauthUri !== "string" ||
    typeof data.account !== "string" ||
    typeof data.issuer !== "string"
  ) {
    return null;
  }
  return {
    secret: data.secret,
    otpauthUri: data.otpauthUri,
    account: data.account,
    issuer: data.issuer,
  };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function sessionError(reason: string) {
  if (reason === "SESSION_COOKIE_MISSING") return "ยืนยันตัวตนสำเร็จ แต่เบราว์เซอร์ยังไม่ได้รับ Session Cookie กรุณาลองอีกครั้งหลังหน้าเว็บอัปเดต";
  if (reason === "SESSION_COOKIE_INVALID") return "ยืนยันตัวตนสำเร็จ แต่ Session Cookie ไม่ผ่านการตรวจลายเซ็น";
  if (reason === "SESSION_REJECTED") return "ยืนยันตัวตนสำเร็จ แต่ระบบปฏิเสธ Session หลังตรวจฐานข้อมูล";
  if (reason === "SESSION_CHECK_FAILED") return "ยืนยันตัวตนสำเร็จ แต่ระบบตรวจ Session ฝั่งเซิร์ฟเวอร์ไม่สำเร็จ";
  return `ยืนยันตัวตนสำเร็จ แต่ Session ยังไม่พร้อม${reason ? ` (${reason})` : ""}`;
}

function ScenovaMark() {
  return <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="login-logo-gold" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fff0a8" />
        <stop offset=".45" stopColor="#e8b83d" />
        <stop offset="1" stopColor="#80601e" />
      </linearGradient>
    </defs>
    <path d="M32 7c9.5 0 17.7 5.7 21.2 13.8l-13.5 1.8a11.5 11.5 0 0 0-18.8 2.3L13 14.1A23.5 23.5 0 0 1 32 7Z" fill="none" stroke="url(#login-logo-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#login-logo-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(120 32 32)" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#login-logo-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(240 32 32)" />
    <path d="M32 23.8 34.7 29l5.5 3-5.5 2.8L32 40l-2.7-5.2-5.5-2.8 5.5-3 2.7-5.2Z" fill="url(#login-logo-gold)" />
  </svg>;
}

function AccessIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7.5 10V7.7a4.5 4.5 0 0 1 9 0V10" />
    <rect x="5" y="10" width="14" height="10" rx="2.5" />
    <path d="M12 14v2.5" />
  </svg>;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("password");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [challengeToken, setChallengeToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function probeSession() {
    let reason = "SESSION_NOT_READY";

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const response = await fetch(`/api/auth/me?t=${Date.now()}-${attempt}`, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        const data = await readJson(response) as SessionProbe;
        if (response.ok && data.authenticated === true) return { ok: true, reason: "" };
        if (typeof data.reason === "string" && data.reason) reason = data.reason;
        else reason = `HTTP_${response.status}`;
      } catch {
        reason = "SESSION_PROBE_NETWORK_ERROR";
      }

      if (attempt < 3) await delay(250 * (attempt + 1));
    }

    return { ok: false, reason };
  }

  async function enterPortal() {
    setLoading(true);
    const probe = await probeSession();
    if (!probe.ok) {
      setError(sessionError(probe.reason));
      setLoading(false);
      return false;
    }

    // Use a full document navigation only after /api/auth/me proves that the
    // browser is sending the authenticated cookie back to the Worker. This
    // avoids a client-router race immediately after a Set-Cookie response.
    window.location.replace("/portal");
    return true;
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      });
      const data = await readJson(response);

      if (!response.ok) {
        setError(apiError(data, `Authentication failed (HTTP ${response.status})`));
        return;
      }

      const nextChallengeToken = typeof data.challengeToken === "string" ? data.challengeToken : "";

      if (data.twoFactorSetupRequired === true) {
        const setupData = parseSetupData(data.setup);
        if (!nextChallengeToken || !setupData) {
          setError("ไม่สามารถเตรียมข้อมูล Authenticator ได้ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
          return;
        }
        setChallengeToken(nextChallengeToken);
        setSetup(setupData);
        setCode("");
        setPassword("");
        setStage("setup");
        return;
      }

      if (data.twoFactorRequired === true) {
        if (!nextChallengeToken) {
          setError("ไม่สามารถสร้างเซสชันยืนยัน 2FA ได้ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
          return;
        }
        setChallengeToken(nextChallengeToken);
        setCode("");
        setPassword("");
        setStage("otp");
        return;
      }

      setPassword("");
      await enterPortal();
    } catch {
      setError("ไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบได้ กรุณาตรวจสอบเครือข่ายแล้วลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function confirmSetup(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!challengeToken) {
      setError("เซสชันตั้งค่า 2FA หมดอายุ กรุณากลับไปเข้าสู่ระบบใหม่");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-scenova-2fa-challenge": challengeToken,
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ code }),
      });
      const data = await readJson(response);

      if (!response.ok) {
        setError(apiError(data, `Authenticator verification failed (HTTP ${response.status})`));
        return;
      }

      const codes = Array.isArray(data.recoveryCodes)
        ? data.recoveryCodes.filter((item): item is string => typeof item === "string")
        : [];
      setRecoveryCodes(codes);
      setCode("");
      setChallengeToken("");
      setStage("recovery");
    } catch {
      setError("ไม่สามารถยืนยัน Authenticator ได้ กรุณาลองรหัสใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!challengeToken) {
      setError("เซสชันยืนยัน 2FA หมดอายุ กรุณากลับไปเข้าสู่ระบบใหม่");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-scenova-2fa-challenge": challengeToken,
        },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ code }),
      });
      const data = await readJson(response);

      if (!response.ok) {
        setError(apiError(data, `Verification failed (HTTP ${response.status})`));
        return;
      }

      const entered = await enterPortal();
      if (entered) setChallengeToken("");
    } catch {
      setError("ไม่สามารถตรวจสอบรหัส 2FA ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  function backToPassword() {
    setStage("password");
    setPassword("");
    setCode("");
    setError("");
    setSetup(null);
    setRecoveryCodes([]);
    setChallengeToken("");
  }

  return (
    <main className={`scenova-auth-shell ${styles.shell}`} data-keep-small>
      <section className={styles.hero}>
        <div className={styles.cinematicBackdrop} aria-hidden="true">
          <div className={styles.cinematicOverlay} />
        </div>
        <div className={styles.brand}>
          <span className={styles.brandMark}><ScenovaMark /></span>
          <div className={styles.brandIdentity}>
            <b className={styles.brandWordmarkText}>SCENOVA</b>
            <span className={styles.brandStudioText}>AI CINEMATIC PRODUCTION</span>
          </div>
        </div>

        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>PRODUCTION WORKSPACE</span>
          <h1 className={styles.heroTitle}>ทุกองค์ประกอบของภาพยนตร์<br /><em>อยู่ภายใต้การควบคุมของคุณ</em></h1>
          <p className={styles.heroText}>จัดการบท ตัวละคร ภาพ เสียง และการสร้างวิดีโอในพื้นที่ทำงานเดียว พร้อมรักษาความต่อเนื่องของผลงานตั้งแต่แนวคิดจนถึงไฟล์พร้อมเผยแพร่</p>
          <div className={styles.heroFeatures}><span>Unified Workflow</span><span>Consistent Characters</span><span>Protected Access</span></div>
        </div>

        <small className={styles.heroFooter}>SCENOVA • SECURE CINEMATIC WORKSPACE</small>
      </section>

      <section className={styles.authPanel}>
        <div className={styles.card}>
          {stage === "password" ? (
            <form onSubmit={login}>
              <header className={styles.cardHeader}>
                <span className={styles.accessIcon}><AccessIcon /></span>
                <div>
                  <span className={styles.eyebrow}>MEMBER PORTAL</span>
                  <h2 className={styles.title}>เข้าสู่ระบบ</h2>
                </div>
              </header>

              <label className={styles.label}>
                อีเมล
                <input
                  className={styles.input}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="name@company.com"
                  required
                />
              </label>

              <label className={styles.label}>
                รหัสผ่าน
                <input
                  className={styles.input}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="กรอกรหัสผ่าน"
                  required
                />
              </label>

              {error ? <ErrorBox text={error} /> : null}
              <button disabled={loading} className={styles.primary}>{loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}</button>
              <div className={styles.loginAssurance}>
                <span>สำหรับสมาชิก SCENOVA</span>
                <i aria-hidden="true" />
                <span>รองรับการยืนยันตัวตน 2 ขั้นตอน</span>
              </div>
            </form>
          ) : null}

          {stage === "otp" ? (
            <form onSubmit={verifyOtp}>
              <span className={styles.eyebrow}>2-STEP VERIFICATION</span>
              <h2 className={styles.title}>ยืนยันตัวตน 2 ขั้นตอน</h2>
              <p className={styles.muted}>เปิด Authenticator แล้วกรอกรหัส 6 หลักปัจจุบัน หรือใช้ Recovery Code เมื่อไม่มีอุปกรณ์หลัก</p>

              <label className={styles.label}>
                รหัสยืนยัน <small>Verification code</small>
                <input
                  className={`${styles.input} ${styles.codeInput}`}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="text"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                />
              </label>

              {error ? <ErrorBox text={error} /> : null}
              <button disabled={loading} className={styles.primary}>{loading ? "กำลังยืนยัน Session..." : "ยืนยันและเข้าสู่ระบบ"}</button>
              <button type="button" disabled={loading} onClick={backToPassword} className={styles.secondary}>กลับไปใช้รหัสผ่าน</button>
            </form>
          ) : null}

          {stage === "setup" ? (
            <form onSubmit={confirmSetup}>
              <span className={styles.eyebrow}>ADMIN SECURITY REQUIRED</span>
              <h2 className={styles.title}>ตั้งค่า Authenticator</h2>
              <p className={styles.muted}>ใน Google/Microsoft Authenticator กด ＋ → เลือก “Enter setup key” แล้วใช้ข้อมูลด้านล่าง</p>

              <div className={styles.setupBox}>
                <small>ACCOUNT</small>
                <b>{setup?.account}</b>
                <small>SETUP KEY</small>
                <code>{setup?.secret}</code>
                <small>TYPE</small>
                <b>Time based (TOTP) • 6 digits • 30 seconds</b>
              </div>

              <button type="button" disabled={loading} onClick={() => setup?.secret && navigator.clipboard.writeText(setup.secret)} className={styles.secondary}>คัดลอก Setup Key</button>

              <label className={styles.label}>
                รหัสจาก Authenticator
                <input
                  className={`${styles.input} ${styles.codeInput}`}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                  maxLength={6}
                />
              </label>

              {error ? <ErrorBox text={error} /> : null}
              <button disabled={loading} className={styles.primary}>{loading ? "กำลังเปิด 2FA..." : "ยืนยันและเปิด 2FA"}</button>
              <button type="button" disabled={loading} onClick={backToPassword} className={styles.secondary}>เริ่มใหม่</button>
            </form>
          ) : null}

          {stage === "recovery" ? (
            <div>
              <span className={styles.eyebrow}>RECOVERY CODES</span>
              <h2 className={styles.title}>เก็บรหัสกู้คืน</h2>
              <p className={styles.muted}>แต่ละรหัสใช้ได้ครั้งเดียวสำหรับกรณี Authenticator ใช้งานไม่ได้ ระบบจะแสดงชุดจริงเพียงครั้งเดียว</p>
              <div className={styles.recoveryGrid}>
                {recoveryCodes.map((item) => <code key={item} className={styles.recoveryCode}>{item}</code>)}
              </div>
              {error ? <ErrorBox text={error} /> : null}
              <button onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))} className={styles.secondary}>คัดลอกทั้งหมด</button>
              <button disabled={loading} onClick={() => void enterPortal()} className={styles.primary}>{loading ? "กำลังยืนยัน Session..." : "บันทึกแล้ว → เข้า SCENOVA"}</button>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function ErrorBox({ text }: { text: string }) {
  return <div className={styles.error} role="alert" aria-live="polite">{text}</div>;
}
