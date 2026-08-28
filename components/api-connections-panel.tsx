"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./api-connections-panel.module.css";

type Category = "ANALYZER" | "VIDEO" | "IMAGE" | "VOICE";

type CatalogItem = {
  id: string;
  name: string;
  category: Category;
  defaultModel: string | null;
  descriptionTh: string;
  canTest: boolean;
};

type Connection = {
  id: string;
  provider: string;
  category: Category;
  label: string;
  modelId: string | null;
  maskedKey: string;
  enabled: boolean;
  isDefault: boolean;
  status: string;
  lastTestedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiPayload = {
  ok?: boolean;
  error?: string;
  catalog?: CatalogItem[];
  connections?: Connection[];
  test?: { ok: boolean; verified: boolean; code: string } | null;
};

const categoryLabel: Record<Category, string> = {
  ANALYZER: "AI Analyzer",
  VIDEO: "Video Generator",
  IMAGE: "Image Generator",
  VOICE: "Voice / TTS",
};

const errorText: Record<string, string> = {
  UNAUTHORIZED: "กรุณาเข้าสู่ระบบใหม่",
  INVALID_REQUEST: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง",
  INVALID_API_KEY: "API Key สั้นหรือยาวเกินกว่าที่ระบบรองรับ",
  UNSUPPORTED_PROVIDER: "Provider นี้ยังไม่รองรับใน API Manager",
  PROVIDER_CONNECTION_NOT_FOUND: "ไม่พบการเชื่อมต่อนี้",
  SCENOVA_BYOK_MASTER_KEY_REQUIRED: "Server ยังไม่ได้ตั้งค่า SCENOVA_BYOK_MASTER_KEY",
  SCENOVA_BYOK_MASTER_KEY_INVALID: "SCENOVA_BYOK_MASTER_KEY มีรูปแบบไม่ถูกต้อง",
  PROVIDER_CONNECTION_ERROR: "เกิดข้อผิดพลาดในการจัดการ API Key",
};

function providerName(catalog: CatalogItem[], provider: string) {
  return catalog.find((item) => item.id === provider)?.name || provider;
}

function statusText(connection: Connection) {
  if (!connection.enabled) return "ปิดใช้งาน";
  if (connection.status === "CONNECTED") return "เชื่อมต่อแล้ว";
  if (connection.status === "ERROR") return "เชื่อมต่อไม่สำเร็จ";
  if (connection.status === "STORED") return "บันทึกแล้ว";
  return "ยังไม่ได้ทดสอบ";
}

export default function ApiConnectionsPanel() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [category, setCategory] = useState<Category>("ANALYZER");
  const [provider, setProvider] = useState("groq");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("openai/gpt-oss-20b");
  const [isDefault, setIsDefault] = useState(true);

  const availableProviders = useMemo(() => catalog.filter((item) => item.category === category), [catalog, category]);
  const selectedCatalog = useMemo(() => catalog.find((item) => item.id === provider && item.category === category) || null, [catalog, provider, category]);

  useEffect(() => {
    let active = true;
    fetch("/api/provider-connections", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const data = await response.json() as ApiPayload;
        if (!response.ok) throw new Error(data.error || "PROVIDER_CONNECTION_ERROR");
        return data;
      })
      .then((data) => {
        if (!active) return;
        const nextCatalog = data.catalog || [];
        setCatalog(nextCatalog);
        setConnections(data.connections || []);
        const first = nextCatalog.find((item) => item.category === "ANALYZER");
        if (first) {
          setProvider(first.id);
          setModelId(first.defaultModel || "");
        }
      })
      .catch((error) => {
        if (!active) return;
        const code = error instanceof Error ? error.message : "PROVIDER_CONNECTION_ERROR";
        setNotice({ kind: "error", text: errorText[code] || code });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function changeCategory(next: Category) {
    setCategory(next);
    const first = catalog.find((item) => item.category === next);
    setProvider(first?.id || "");
    setModelId(first?.defaultModel || "");
    setNotice(null);
  }

  function changeProvider(next: string) {
    setProvider(next);
    const item = catalog.find((candidate) => candidate.id === next && candidate.category === category);
    setModelId(item?.defaultModel || "");
    setNotice(null);
  }

  async function postAction(payload: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/provider-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const data = await response.json() as ApiPayload;
      if (!response.ok) throw new Error(data.error || "PROVIDER_CONNECTION_ERROR");
      if (data.connections) setConnections(data.connections);
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!provider || apiKey.trim().length < 8) {
      setNotice({ kind: "error", text: "กรุณาเลือก Provider และวาง API Key ให้ครบ" });
      return;
    }
    try {
      const result = await postAction({
        action: "save",
        provider,
        category,
        apiKey,
        modelId: modelId.trim() || null,
        isDefault,
        testAfterSave: true,
      });
      setApiKey("");
      if (result.test?.verified && result.test.ok) {
        setNotice({ kind: "success", text: "เชื่อมต่อสำเร็จ — คีย์ถูกเข้ารหัสและเก็บฝั่ง Server แล้ว" });
      } else if (result.test && !result.test.verified) {
        setNotice({ kind: "success", text: "บันทึกคีย์แบบเข้ารหัสแล้ว — Provider Adapter นี้จะเปิดการทดสอบในขั้นเชื่อม Generator" });
      } else {
        setNotice({ kind: "error", text: `บันทึกคีย์แล้ว แต่การทดสอบไม่ผ่าน (${result.test?.code || "UNKNOWN"})` });
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "PROVIDER_CONNECTION_ERROR";
      setNotice({ kind: "error", text: errorText[code] || code });
    }
  }

  async function runAction(connection: Connection, action: "test" | "delete" | "set-default" | "toggle") {
    if (action === "delete" && !window.confirm(`ลบ API Key ของ ${providerName(catalog, connection.provider)} ออกจาก SCENOVA หรือไม่?`)) return;
    try {
      const payload = action === "toggle"
        ? { action, id: connection.id, enabled: !connection.enabled }
        : { action, id: connection.id };
      const result = await postAction(payload);
      if (action === "test") {
        setNotice(result.test?.ok
          ? { kind: "success", text: result.test.verified ? "ทดสอบการเชื่อมต่อสำเร็จ" : "คีย์ถูกเก็บแล้ว แต่ Adapter นี้ยังไม่เปิดการตรวจสอบกับ Provider" }
          : { kind: "error", text: `ทดสอบไม่ผ่าน (${result.test?.code || "UNKNOWN"})` });
      } else if (action === "delete") {
        setNotice({ kind: "success", text: "ลบ API Key ออกจากระบบแล้ว" });
      } else if (action === "set-default") {
        setNotice({ kind: "success", text: "ตั้งเป็น Provider เริ่มต้นแล้ว" });
      } else {
        setNotice({ kind: "success", text: connection.enabled ? "ปิดการใช้งาน API Key แล้ว" : "เปิดการใช้งาน API Key แล้ว" });
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "PROVIDER_CONNECTION_ERROR";
      setNotice({ kind: "error", text: errorText[code] || code });
    }
  }

  return <main className={styles.page}>
    <section className={styles.hero}>
      <p className={styles.eyebrow}>SCENOVA API MANAGER</p>
      <h1>API & Models</h1>
      <p>เชื่อม AI Analyzer และ Generator ด้วย API Key ของระบบหรือคีย์ของผู้ใช้เอง (BYOK) โดยแยก Provider ออกจาก Prompt Compiler และ Generation Pipeline</p>
      <div className={styles.securityStrip}>
        <span className={styles.securityIcon}>⌁</span>
        <div>
          <strong>Secret อยู่ฝั่ง Server เท่านั้น</strong>
          <small>API Key ถูกเข้ารหัสด้วย AES-256-GCM ก่อนบันทึก Database และหน้าเว็บจะได้รับกลับมาเฉพาะรูปแบบปิดบังท้าย 4 ตัว ระบบไม่ส่ง Secret เต็มกลับ Browser</small>
        </div>
      </div>
    </section>

    <section className={styles.grid}>
      <article className={styles.card}>
        <header className={styles.cardHeader}>
          <h2>เพิ่ม API Connection</h2>
          <p>คัดลอก API Key จาก Provider → วาง → เลือกโมเดล → บันทึกและทดสอบ</p>
        </header>
        <div className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="api-category">ประเภทการใช้งาน</label>
            <select id="api-category" value={category} onChange={(event) => changeCategory(event.target.value as Category)} disabled={busy || loading}>
              <option value="ANALYZER">AI Analyzer — วิเคราะห์คำสั่ง</option>
              <option value="VIDEO">Video Generator — สร้างวิดีโอ</option>
              <option value="IMAGE">Image Generator — สร้างภาพ</option>
              <option value="VOICE">Voice / TTS — สร้างเสียง</option>
            </select>
          </div>

          <div className={styles.field}>
            <label htmlFor="api-provider">Provider</label>
            <select id="api-provider" value={provider} onChange={(event) => changeProvider(event.target.value)} disabled={busy || loading || availableProviders.length === 0}>
              {availableProviders.length === 0 ? <option value="">ยังไม่มี Provider ในหมวดนี้</option> : null}
              {availableProviders.map((item) => <option key={`${item.category}:${item.id}`} value={item.id}>{item.name}</option>)}
            </select>
            {selectedCatalog ? <small className={styles.help}>{selectedCatalog.descriptionTh}</small> : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="api-key">API Key</label>
            <input id="api-key" type="password" autoComplete="off" spellCheck={false} placeholder="วาง API Key ที่นี่" value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={busy || !provider} />
            <small className={styles.help}>หลังบันทึก SCENOVA จะไม่แสดงคีย์เต็มอีก หากต้องเปลี่ยนคีย์ให้วางคีย์ใหม่ทับ Provider เดิม</small>
          </div>

          <div className={styles.field}>
            <label htmlFor="api-model">Model ID</label>
            <input id="api-model" value={modelId} onChange={(event) => setModelId(event.target.value)} placeholder={selectedCatalog?.defaultModel || "กรอก Model ID เมื่อ Provider ต้องการ"} disabled={busy || !provider} />
          </div>

          <label className={styles.checkRow}>
            <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} disabled={busy} />
            ตั้งเป็นค่าเริ่มต้นของหมวด {categoryLabel[category]}
          </label>

          <button type="button" className={styles.primary} onClick={save} disabled={busy || loading || !provider || apiKey.trim().length < 8}>
            {busy ? "กำลังเชื่อมต่อ…" : "บันทึกและทดสอบการเชื่อมต่อ"}
          </button>
        </div>
        {notice ? <p className={styles.notice} data-kind={notice.kind}>{notice.text}</p> : null}
      </article>

      <article className={styles.card}>
        <header className={styles.cardHeader}>
          <h2>Connections ของคุณ</h2>
          <p>เปิด/ปิด ทดสอบ ตั้งค่าเริ่มต้น หรือลบ Secret ได้โดยไม่เปิดเผยคีย์เต็ม</p>
        </header>
        <div className={styles.connectionList}>
          {loading ? <div className={styles.empty}>กำลังโหลด API Connections…</div> : null}
          {!loading && connections.length === 0 ? <div className={styles.empty}>ยังไม่มี API Key ที่บันทึกไว้<br />เริ่มจาก Groq สำหรับ Analyzer ได้ทันที</div> : null}
          {connections.map((connection) => <div className={styles.connection} key={connection.id}>
            <div>
              <div className={styles.connectionTop}>
                <h3>{providerName(catalog, connection.provider)}</h3>
                <span className={styles.badge}>{categoryLabel[connection.category]}</span>
                {connection.isDefault ? <span className={styles.defaultBadge}>DEFAULT</span> : null}
                <span className={styles.status} data-status={connection.enabled ? connection.status : "DISABLED"}>{statusText(connection)}</span>
              </div>
              <div className={styles.meta}>
                <span>Key <code>{connection.maskedKey}</code></span>
                {connection.modelId ? <span>Model <code>{connection.modelId}</code></span> : null}
                {connection.lastTestedAt ? <span>ทดสอบล่าสุด {new Date(connection.lastTestedAt).toLocaleString("th-TH")}</span> : null}
                {connection.lastErrorCode ? <span>Error <code>{connection.lastErrorCode}</code></span> : null}
              </div>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.secondary} onClick={() => runAction(connection, "test")} disabled={busy}>ทดสอบ</button>
              {!connection.isDefault ? <button type="button" className={styles.ghost} onClick={() => runAction(connection, "set-default")} disabled={busy}>ตั้ง Default</button> : null}
              <button type="button" className={styles.ghost} onClick={() => runAction(connection, "toggle")} disabled={busy}>{connection.enabled ? "ปิด" : "เปิด"}</button>
              <button type="button" className={styles.danger} onClick={() => runAction(connection, "delete")} disabled={busy}>ลบ</button>
            </div>
          </div>)}
        </div>
      </article>
    </section>

    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <h2>โหมดค่าใช้จ่าย</h2>
        <p>Generation Pipeline จะแยกแหล่งคีย์ออกจากงานสร้าง เพื่อให้ Billing รู้ว่าใครเป็นคนรับค่า Provider</p>
      </header>
      <div className={styles.modeCard}>
        <div className={styles.mode}>
          <strong>System API</strong>
          <small>SCENOVA ใช้ API Key ของระบบ ต้นทุน Provider อยู่ฝั่งระบบและนำไปคิดราคาเครดิตตาม Pricing Engine</small>
        </div>
        <div className={styles.mode}>
          <strong>BYOK — API Key ของผู้ใช้</strong>
          <small>Provider เรียกเก็บค่า Generate จากบัญชีของผู้ใช้เอง ส่วน SCENOVA สามารถคิดเฉพาะค่าระบบ เช่น Analyzer, Workflow, Locks, Queue และ Storage ตาม Billing Policy</small>
        </div>
      </div>
    </section>
  </main>;
}
