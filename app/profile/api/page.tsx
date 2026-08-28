"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./api-connections.module.css";

type Connection = {
  id: string;
  provider: string;
  kind: "ANALYZER" | "VIDEO" | "IMAGE" | "VOICE";
  modelId: string | null;
  baseUrl: string | null;
  maskedKey: string;
  status: "CONNECTED" | "INVALID" | "RATE_LIMITED" | "ERROR";
  enabled: boolean;
  isDefault: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
};

export default function ApiConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [provider, setProvider] = useState("groq");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("openai/gpt-oss-20b");
  const [baseUrl, setBaseUrl] = useState("https://api.groq.com/openai/v1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const analyzerConnections = useMemo(() => connections.filter((item) => item.kind === "ANALYZER"), [connections]);

  async function loadConnections() {
    const response = await fetch("/api/api-connections", { cache: "no-store", credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "โหลด API Connections ไม่สำเร็จ");
    setConnections(data.connections || []);
  }

  useEffect(() => { void loadConnections().catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ")); }, []);

  async function connect() {
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/api-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ provider, kind: "ANALYZER", apiKey, modelId, baseUrl, enabled: true, isDefault: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || "เชื่อมต่อไม่สำเร็จ");
      setApiKey("");
      setMessage("เชื่อมต่อและบันทึก API Key แบบเข้ารหัสเรียบร้อยแล้ว");
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เชื่อมต่อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function patch(connection: Connection, changes: Partial<Pick<Connection, "enabled" | "isDefault" | "modelId">>) {
    setError(""); setMessage("");
    const response = await fetch("/api/api-connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id: connection.id, ...changes }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.error || "แก้ไขการเชื่อมต่อไม่สำเร็จ");
    setMessage("อัปเดตการเชื่อมต่อแล้ว");
    await loadConnections();
  }

  async function remove(connection: Connection) {
    if (!window.confirm(`ลบ API Key ของ ${connection.provider.toUpperCase()} ออกจาก SCENOVA?`)) return;
    setError(""); setMessage("");
    const response = await fetch(`/api/api-connections?id=${encodeURIComponent(connection.id)}`, { method: "DELETE", credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.error || "ลบการเชื่อมต่อไม่สำเร็จ");
    setMessage("ลบ API Key เรียบร้อยแล้ว");
    await loadConnections();
  }

  function statusClass(status: Connection["status"]) {
    if (status === "CONNECTED") return `${styles.badge} ${styles.ok}`;
    if (status === "RATE_LIMITED") return `${styles.badge} ${styles.warn}`;
    return `${styles.badge} ${styles.bad}`;
  }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <span className={styles.eyebrow}>API & MODELS</span>
      <h1>เชื่อมต่อ API ของคุณ</h1>
      <p>นำ API Key ของคุณมาวางแล้วกดเชื่อมต่อ SCENOVA จะทดสอบ Key ก่อนบันทึก และเก็บเฉพาะข้อมูลที่เข้ารหัสไว้ฝั่ง Server เท่านั้น หน้าเว็บจะเห็นเพียงท้าย Key 4 ตัว</p>
    </header>

    {message ? <div className={styles.notice}>{message}</div> : null}
    {error ? <div className={`${styles.notice} ${styles.error}`}>{error}</div> : null}

    <div className={styles.grid}>
      <section className={styles.card}>
        <h2>AI Analyzer</h2>
        <p className={styles.muted}>Analyzer ทำหน้าที่อ่านคำสั่ง แยกฉาก กล้อง ตัวละคร แสง เสียง และ Lock แล้วคืน Structured JSON ก่อนส่งต่อไปยัง AI Generator ตัวจริง</p>

        <label className={styles.field}><span>Provider</span>
          <select className={styles.select} value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="groq">Groq — พร้อมใช้งาน</option>
          </select>
        </label>
        <label className={styles.field}><span>API Key</span><input className={styles.input} type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="gsk_••••••••••••" /></label>
        <label className={styles.field}><span>Model</span><input className={styles.input} value={modelId} onChange={(event) => setModelId(event.target.value)} placeholder="openai/gpt-oss-20b" /></label>
        <label className={styles.field}><span>API Base URL</span><input className={styles.input} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>

        <div className={styles.actions}><button type="button" className={styles.primary} disabled={loading || apiKey.trim().length < 8} onClick={connect}>{loading ? "กำลังทดสอบ…" : "ทดสอบและเชื่อมต่อ"}</button></div>
        <div className={styles.note}><b>BYOK:</b> ค่า AI ของ Groq จะถูกคิดกับบัญชี Groq ของผู้ใช้โดยตรง ส่วน SCENOVA สามารถคิด Platform Credit แยกได้ด้วยตัวแปร <code>SCENOVA_BYOK_ANALYZER_CREDIT_FEE</code>.</div>
      </section>

      <section className={styles.card}>
        <h2>การเชื่อมต่อของฉัน</h2>
        <p className={styles.muted}>Key เต็มจะไม่ถูกส่งกลับมาที่ Browser หลังบันทึก หากต้องการเปลี่ยน Key ให้วาง Key ใหม่แล้วเชื่อมต่อซ้ำ</p>
        <div className={styles.list}>
          {analyzerConnections.length === 0 ? <div className={styles.empty}>ยังไม่มี Analyzer API ที่เชื่อมต่อ</div> : analyzerConnections.map((connection) => <article className={styles.connection} key={connection.id}>
            <div className={styles.connectionHead}>
              <div><h3>{connection.provider.toUpperCase()}</h3><small>{connection.maskedKey}</small></div>
              <span className={statusClass(connection.status)}>{connection.status}</span>
            </div>
            <div className={styles.meta}>
              <div><small>Model</small><b>{connection.modelId || "Default"}</b></div>
              <div><small>โหมด</small><b>{connection.isDefault ? "ค่าเริ่มต้น" : "สำรอง"}</b></div>
              <div><small>สถานะใช้งาน</small><b>{connection.enabled ? "เปิด" : "ปิด"}</b></div>
              <div><small>ทดสอบล่าสุด</small><b>{connection.lastTestedAt ? new Date(connection.lastTestedAt).toLocaleString("th-TH") : "—"}</b></div>
            </div>
            {connection.lastError ? <p className={styles.muted}>ล่าสุด: {connection.lastError}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={() => patch(connection, { enabled: !connection.enabled })}>{connection.enabled ? "ปิดใช้งาน" : "เปิดใช้งาน"}</button>
              {!connection.isDefault ? <button type="button" className={styles.secondary} onClick={() => patch(connection, { isDefault: true })}>ตั้งเป็นค่าเริ่มต้น</button> : null}
              <button type="button" className={styles.danger} onClick={() => remove(connection)}>ลบ Key</button>
            </div>
          </article>)}
        </div>
      </section>
    </div>
  </main>;
}
