"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

type Stage = "password" | "otp" | "setup" | "recovery";
type SetupData = { secret: string; otpauthUri: string; account: string; issuer: string };
type ApiData = Record<string, unknown>;

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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<Stage>("password");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [challengeToken, setChallengeToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ email, password }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setError(apiError(data, "Authentication failed"));
        return;
      }

      const nextChallengeToken = typeof data.challengeToken === "string" ? data.challengeToken : "";
      if (data.twoFactorSetupRequired === true) {
        if (!nextChallengeToken) {
          setError("ไม่สามารถสร้างเซสชันยืนยัน 2FA ได้ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
          return;
        }
        setChallengeToken(nextChallengeToken);
        await startSetup(nextChallengeToken);
        return;
      }
      if (data.twoFactorRequired === true) {
        if (!nextChallengeToken) {
          setError("ไม่สามารถสร้างเซสชันยืนยัน 2FA ได้ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
          return;
        }
        setChallengeToken(nextChallengeToken);
        setCode("");
        setStage("otp");
        return;
      }
      enterPortal();
    } catch {
      setError("ไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบได้ กรุณาตรวจสอบเครือข่ายแล้วลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function startSetup(token = challengeToken) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/2fa/setup", {
        cache: "no-store",
        credentials: "same-origin",
        headers: token ? { "x-scenova-2fa-challenge": token } : undefined,
      });
      const data = await readJson(response);
      if (!response.ok) {
        setError(apiError(data, "Unable to start 2FA setup"));
        return;
      }
      if (typeof data.secret !== "string" || typeof data.otpauthUri !== "string" || typeof data.account !== "string" || typeof data.issuer !== "string") {
        setError("ข้อมูลตั้งค่า Authenticator ไม่สมบูรณ์ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
        return;
      }
      setSetup({
        secret: data.secret,
        otpauthUri: data.otpauthUri,
        account: data.account,
        issuer: data.issuer,
      });
      setCode("");
      setStage("setup");
    } catch {
      setError("ไม่สามารถเริ่มตั้งค่า Authenticator ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function confirmSetup(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(challengeToken ? { "x-scenova-2fa-challenge": challengeToken } : {}),
        },
        credentials: "same-origin",
        body: JSON.stringify({ code }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setError(apiError(data, "Authenticator verification failed"));
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
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(challengeToken ? { "x-scenova-2fa-challenge": challengeToken } : {}),
        },
        credentials: "same-origin",
        body: JSON.stringify({ code }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setError(apiError(data, "Verification failed"));
        return;
      }
      setChallengeToken("");
      enterPortal();
    } catch {
      setError("ไม่สามารถตรวจสอบรหัส 2FA ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  function enterPortal() {
    router.push("/portal");
    router.refresh();
  }

  function backToPassword() {
    setStage("password");
    setCode("");
    setError("");
    setSetup(null);
    setChallengeToken("");
  }

  return (
    <main className={`scenova-auth-shell ${styles.shell}`}>
      <section className={styles.hero}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>S</span>
          <div>
            <b className={styles.brandName}>SCENOVA</b>
            <small className={styles.brandSub}>AI Cinematic Production Studio</small>
          </div>
        </div>

        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>SECURE PRODUCTION WORKSPACE</span>
          <h1 className={styles.heroTitle}>Professional AI Production<br />from a Single Workspace</h1>
          <p className={styles.heroText}>Studio สำหรับ Story Development, Scene Direction, Camera Design, Series Continuity, Prompt Engineering และ Multi-model Rendering พร้อมระบบความปลอดภัยสำหรับ Admin และสมาชิก</p>
        </div>

        <small className={styles.heroFooter}>SCENOVA • SECURE CINEMATIC WORKSPACE</small>
      </section>

      <section className={styles.authPanel}>
        <div className={styles.card}>
          {stage === "password" ? (
            <form onSubmit={login}>
              <span className={styles.eyebrow}>MEMBER ACCESS</span>
              <h2 className={styles.title}>Sign in to SCENOVA</h2>
              <p className={styles.muted}>ไม่มี Public Sign-up บัญชีสมาชิกถูกสร้างและจัดการโดย Admin Console เท่านั้น</p>

              <label className={styles.label}>
                Email
                <input
                  className={styles.input}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </label>

              <label className={styles.label}>
                Password
                <input
                  className={styles.input}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>

              {error ? <ErrorBox text={error} /> : null}
              <button disabled={loading} className={styles.primary}>{loading ? "Authenticating..." : "Continue"}</button>
            </form>
          ) : null}

          {stage === "otp" ? (
            <form onSubmit={verifyOtp}>
              <span className={styles.eyebrow}>2-STEP VERIFICATION</span>
              <h2 className={styles.title}>Authenticator Verification</h2>
              <p className={styles.muted}>เปิด Authenticator แล้วกรอกรหัส 6 หลักปัจจุบัน หรือใช้ Recovery Code เมื่อไม่มีอุปกรณ์หลัก</p>

              <label className={styles.label}>
                Verification Code
                <input
                  className={`${styles.input} ${styles.codeInput}`}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                />
              </label>

              {error ? <ErrorBox text={error} /> : null}
              <button disabled={loading} className={styles.primary}>{loading ? "Verifying..." : "Verify & Continue"}</button>
              <button type="button" disabled={loading} onClick={backToPassword} className={styles.secondary}>Back to Password</button>
            </form>
          ) : null}

          {stage === "setup" ? (
            <form onSubmit={confirmSetup}>
              <span className={styles.eyebrow}>ADMIN SECURITY REQUIRED</span>
              <h2 className={styles.title}>Authenticator Setup</h2>
              <p className={styles.muted}>ใน Google/Microsoft Authenticator กด ＋ → เลือก “Enter setup key” แล้วใช้ข้อมูลด้านล่าง</p>

              <div className={styles.setupBox}>
                <small>ACCOUNT</small>
                <b>{setup?.account}</b>
                <small>SETUP KEY</small>
                <code>{setup?.secret}</code>
                <small>TYPE</small>
                <b>Time based (TOTP) • 6 digits • 30 seconds</b>
              </div>

              <button type="button" disabled={loading} onClick={() => setup?.secret && navigator.clipboard.writeText(setup.secret)} className={styles.secondary}>Copy Setup Key</button>

              <label className={styles.label}>
                Authenticator Code
                <input
                  className={`${styles.input} ${styles.codeInput}`}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="123456"
                />
              </label>

              {error ? <ErrorBox text={error} /> : null}
              <button disabled={loading} className={styles.primary}>{loading ? "Enabling 2FA..." : "Verify & Enable 2FA"}</button>
            </form>
          ) : null}

          {stage === "recovery" ? (
            <div>
              <span className={styles.eyebrow}>RECOVERY CODES</span>
              <h2 className={styles.title}>Store Recovery Codes</h2>
              <p className={styles.muted}>แต่ละรหัสใช้ได้ครั้งเดียวสำหรับกรณี Authenticator ใช้งานไม่ได้ ระบบจะแสดงชุดจริงเพียงครั้งเดียว</p>
              <div className={styles.recoveryGrid}>
                {recoveryCodes.map((item) => <code key={item} className={styles.recoveryCode}>{item}</code>)}
              </div>
              <button onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))} className={styles.secondary}>Copy All</button>
              <button onClick={enterPortal} className={styles.primary}>Saved → Enter SCENOVA</button>
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
