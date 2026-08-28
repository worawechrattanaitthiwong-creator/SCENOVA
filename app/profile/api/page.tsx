"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./api-connections.module.css";

type ConnectionKind = "ANALYZER" | "VIDEO" | "IMAGE" | "VOICE";
type ConnectionStatus = "CONNECTED" | "INVALID" | "RATE_LIMITED" | "ERROR";

type Connection = {
  id: string;
  provider: string;
  kind: ConnectionKind;
  modelId: string | null;
  baseUrl: string | null;
  maskedKey: string;
  status: ConnectionStatus;
  enabled: boolean;
  isDefault: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
};

type Provider = {
  id: string;
  label: string;
  kind: ConnectionKind;
  defaultBaseUrl: string;
  defaultModelId?: string;
  ready: boolean;
  purposeTh: string;
  capabilityTh: string;
  stageId: string;
  stageLabelTh: string;
  status: "READY" | "ADAPTER_PENDING";
  systemConfigured: boolean;
};

type RouteStage = {
  id: string;
  kind: ConnectionKind;
  labelTh: string;
  shortTh: string;
  descriptionTh: string;
  optional: boolean;
  connectionCount: number;
  activeConnectionId: string | null;
  activeProvider: string | null;
  activeStatus: ConnectionStatus | null;
  ready: boolean;
};

const KIND_ORDER: ConnectionKind[] = ["ANALYZER", "IMAGE", "VIDEO", "VOICE"];
const KIND_LABEL: Record<ConnectionKind, string> = {
  ANALYZER: "A · วิเคราะห์",
  IMAGE: "B · ภาพ / Reference",
  VIDEO: "C · สร้างคลิป",
  VOICE: "D · เสียง / พากย์",
};

function statusText(status: ConnectionStatus) {
  if (status === "CONNECTED") return "เชื่อมต่อแล้ว";
  if (status === "RATE_LIMITED") return "จำกัดการเรียกชั่วคราว";
  if (status === "INVALID") return "Key ไม่ถูกต้อง";
  return "มีปัญหาการเชื่อมต่อ";
}

export default function ApiConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [routing, setRouting] = useState<RouteStage[]>([]);
  const [activeKind, setActiveKind] = useState<ConnectionKind>("ANALYZER");
  const [providerId, setProviderId] = useState("groq");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState("openai/gpt-oss-20b");
  const [baseUrl, setBaseUrl] = useState("https://api.groq.com/openai/v1");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const visibleProviders = useMemo(() => providers.filter((item) => item.kind === activeKind), [providers, activeKind]);
  const selectedProvider = useMemo(() => providers.find((item) => item.id === providerId && item.kind === activeKind) || visibleProviders[0] || null, [providers, providerId, activeKind, visibleProviders]);

  async function loadConnections() {
    const response = await fetch("/api/api-connections", { cache: "no-store", credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "โหลด API Connections ไม่สำเร็จ");
    setConnections(data.connections || []);
    setProviders(data.providers || []);
    setRouting(data.routing || []);
  }

  useEffect(() => {
    void loadConnections().catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  useEffect(() => {
    if (!visibleProviders.length) return;
    const current = visibleProviders.find((item) => item.id === providerId) || visibleProviders[0];
    if (current.id !== providerId) setProviderId(current.id);
    setModelId(current.defaultModelId || "");
    setBaseUrl(current.defaultBaseUrl || "");
  }, [activeKind, providers]);

  function chooseProvider(provider: Provider) {
    setProviderId(provider.id);
    setModelId(provider.defaultModelId || "");
    setBaseUrl(provider.defaultBaseUrl || "");
    setApiKey("");
    setError("");
    setMessage("");
  }

  async function connect() {
    if (!selectedProvider?.ready) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/api-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          provider: selectedProvider.id,
          kind: selectedProvider.kind,
          apiKey,
          modelId: modelId.trim() || null,
          baseUrl: baseUrl.trim() || selectedProvider.defaultBaseUrl || null,
          enabled: true,
          isDefault: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || "เชื่อมต่อไม่สำเร็จ");
      setApiKey("");
      setMessage(`${selectedProvider.label} เชื่อมต่อสำเร็จและบันทึก Key แบบเข้ารหัสแล้ว`);
      await loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เชื่อมต่อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function patch(connection: Connection, changes: Partial<Pick<Connection, "enabled" | "isDefault" | "modelId">>) {
    setError("");
    setMessage("");
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
    setError("");
    setMessage("");
    const response = await fetch(`/api/api-connections?id=${encodeURIComponent(connection.id)}`, { method: "DELETE", credentials: "same-origin" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setError(data.error || "ลบการเชื่อมต่อไม่สำเร็จ");
    setMessage("ลบ API Key เรียบร้อยแล้ว");
    await loadConnections();
  }

  function statusClass(status: ConnectionStatus) {
    if (status === "CONNECTED") return `${styles.badge} ${styles.ok}`;
    if (status === "RATE_LIMITED") return `${styles.badge} ${styles.warn}`;
    return `${styles.badge} ${styles.bad}`;
  }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <span className={styles.eyebrow}>API & MODELS · CONNECTION CENTER</span>
      <h1>ศูนย์เชื่อมต่อ AI ของ SCENOVA</h1>
      <p>ทุก API ถูกจัดตาม “สายงาน” เดียวกันทั้งระบบ เพื่อไม่ให้ต่อผิดหน้าที่: A วิเคราะห์ → B ภาพอ้างอิง → C สร้างคลิป → D เสียง ผู้ใช้สามารถใช้ BYOK ได้เฉพาะ Provider ที่ Adapter เปิดใช้งานจริงแล้วเท่านั้น</p>
    </header>

    <section className={styles.pipeline} aria-label="สายการทำงาน API">
      {routing.map((stage, index) => <div className={styles.pipelineUnit} key={stage.id}>
        <article className={`${styles.stage} ${stage.ready ? styles.stageReady : ""}`}>
          <div className={styles.stageTop}><b>{stage.id}</b><span>{stage.shortTh}</span></div>
          <h2>{stage.labelTh.replace(`${stage.id} · `, "")}</h2>
          <p>{stage.descriptionTh}</p>
          <div className={styles.stageState}>
            <span className={stage.ready ? styles.dotReady : styles.dotIdle} />
            {stage.ready ? `${stage.activeProvider?.toUpperCase()} พร้อมใช้งาน` : stage.connectionCount ? "มี Connection แต่ยังไม่พร้อม" : stage.optional ? "ยังไม่ต่อ · ข้ามได้" : "รอ Connection"}
          </div>
        </article>
        {index < routing.length - 1 ? <span className={styles.pipelineArrow} aria-hidden>→</span> : null}
      </div>)}
    </section>

    {message ? <div className={styles.notice}>{message}</div> : null}
    {error ? <div className={`${styles.notice} ${styles.error}`}>{error}</div> : null}

    <div className={styles.layout}>
      <section className={styles.card}>
        <div className={styles.cardHeading}>
          <div><span className={styles.sectionKicker}>เลือกสายที่ต้องการเชื่อม</span><h2>Provider Registry</h2></div>
          <span className={styles.securePill}>🔒 Server encrypted</span>
        </div>

        <div className={styles.kindTabs} role="tablist" aria-label="ประเภท API">
          {KIND_ORDER.map((kind) => <button key={kind} type="button" role="tab" aria-selected={activeKind === kind} className={activeKind === kind ? styles.kindActive : ""} onClick={() => setActiveKind(kind)}>{KIND_LABEL[kind]}</button>)}
        </div>

        <div className={styles.providerGrid}>
          {visibleProviders.map((provider) => {
            const connected = connections.find((item) => item.provider === provider.id && item.kind === provider.kind);
            const selected = selectedProvider?.id === provider.id;
            return <button type="button" className={`${styles.providerCard} ${selected ? styles.providerSelected : ""}`} key={`${provider.kind}:${provider.id}`} onClick={() => chooseProvider(provider)}>
              <div className={styles.providerTop}>
                <span className={styles.plug}>{provider.stageId}</span>
                <span className={provider.ready ? `${styles.badge} ${styles.ok}` : `${styles.badge} ${styles.pending}`}>{provider.ready ? "Adapter พร้อม" : "กำลังเตรียม Adapter"}</span>
              </div>
              <strong>{provider.label}</strong>
              <small>{provider.purposeTh}</small>
              <p>{provider.capabilityTh}</p>
              <div className={styles.providerFoot}>
                <span>{connected ? statusText(connected.status) : "ยังไม่เชื่อม"}</span>
                {provider.systemConfigured ? <b>System API ✓</b> : <b>BYOK</b>}
              </div>
            </button>;
          })}
        </div>

        {selectedProvider ? <div className={styles.connector}>
          <div className={styles.connectorHead}>
            <div><span className={styles.plugLarge}>{selectedProvider.stageId}</span><div><h3>{selectedProvider.label}</h3><p>{selectedProvider.stageLabelTh}</p></div></div>
            <span className={selectedProvider.ready ? `${styles.badge} ${styles.ok}` : `${styles.badge} ${styles.pending}`}>{selectedProvider.ready ? "รับ Key ได้" : "ยังไม่รับ Key"}</span>
          </div>

          {selectedProvider.ready ? <>
            <label className={styles.field}><span>API Key</span><input className={styles.input} type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="วาง API Key ของ Provider นี้" /></label>
            <label className={styles.field}><span>Model</span><input className={styles.input} value={modelId} onChange={(event) => setModelId(event.target.value)} placeholder="Default model" /></label>
            <label className={styles.field}><span>API Base URL</span><input className={styles.input} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="Provider API endpoint" /></label>
            <div className={styles.actions}><button type="button" className={styles.primary} disabled={loading || apiKey.trim().length < 8} onClick={connect}>{loading ? "กำลังตรวจสอบ…" : "ทดสอบ Key และเชื่อมสาย"}</button></div>
            <div className={styles.note}><b>BYOK:</b> ค่าเรียก Provider ถูกคิดกับบัญชี Provider ของเจ้าของ Key โดยตรง ส่วน SCENOVA สามารถคิด Platform Credit สำหรับ Workflow/Analyzer/Storage แยกต่างหากได้</div>
          </> : <div className={styles.pendingBox}>
            <b>ยังไม่เปิดรับ API Key เพื่อป้องกันสถานะหลอก</b>
            <p>สล็อตและสายงานของ {selectedProvider.label} ถูกเตรียมไว้แล้ว แต่ Adapter ฝั่ง Server ยังไม่เปิดใช้งานจริง เมื่อ Adapter พร้อม สถานะจะเปลี่ยนเป็น “รับ Key ได้” และปุ่มเชื่อมต่อจะเปิดอัตโนมัติ</p>
          </div>}
        </div> : null}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeading}>
          <div><span className={styles.sectionKicker}>สถานะจริงจากบัญชีนี้</span><h2>การเชื่อมต่อของฉัน</h2></div>
          <span className={styles.countPill}>{connections.length} Connections</span>
        </div>
        <p className={styles.muted}>Key เต็มจะไม่ถูกส่งกลับมาที่ Browser หลังบันทึก การ์ดด้านล่างแสดงเฉพาะสถานะ, Model, สายงาน และท้าย Key เท่านั้น</p>

        <div className={styles.connectionGroups}>
          {KIND_ORDER.map((kind) => {
            const items = connections.filter((item) => item.kind === kind);
            return <div className={styles.connectionGroup} key={kind}>
              <div className={styles.groupTitle}><span>{KIND_LABEL[kind]}</span><b>{items.length}</b></div>
              {items.length === 0 ? <div className={styles.empty}>ยังไม่มี Connection ในสายนี้</div> : items.map((connection) => <article className={styles.connection} key={connection.id}>
                <div className={styles.connectionHead}>
                  <div><h3>{connection.provider.toUpperCase()}</h3><small>{connection.maskedKey}</small></div>
                  <span className={statusClass(connection.status)}>{statusText(connection.status)}</span>
                </div>
                <div className={styles.meta}>
                  <div><small>Model</small><b>{connection.modelId || "Default"}</b></div>
                  <div><small>Routing</small><b>{connection.isDefault ? "Default ของสาย" : "สำรอง"}</b></div>
                  <div><small>ใช้งาน</small><b>{connection.enabled ? "เปิด" : "ปิด"}</b></div>
                  <div><small>ทดสอบล่าสุด</small><b>{connection.lastTestedAt ? new Date(connection.lastTestedAt).toLocaleString("th-TH") : "—"}</b></div>
                </div>
                {connection.lastError ? <p className={styles.connectionError}>ล่าสุด: {connection.lastError}</p> : null}
                <div className={styles.actions}>
                  <button type="button" className={styles.secondary} onClick={() => patch(connection, { enabled: !connection.enabled })}>{connection.enabled ? "ปิดใช้งาน" : "เปิดใช้งาน"}</button>
                  {!connection.isDefault ? <button type="button" className={styles.secondary} onClick={() => patch(connection, { isDefault: true })}>ตั้งเป็น Default</button> : null}
                  <button type="button" className={styles.danger} onClick={() => remove(connection)}>ลบ Key</button>
                </div>
              </article>)}
            </div>;
          })}
        </div>
      </section>
    </div>
  </main>;
}
