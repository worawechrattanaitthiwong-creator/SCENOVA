"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./api-connections.module.css";

type ConnectionKind = "ANALYZER" | "VIDEO" | "IMAGE" | "VOICE";
type ConnectionStatus = "CONNECTED" | "INVALID" | "RATE_LIMITED" | "ERROR";
type ModelAvailability = "AVAILABLE" | "SUPPORTED" | "UNVERIFIED";

type ModelOption = {
  apiModelId: string;
  label: string;
  note?: string;
  recommended?: boolean;
  availability?: ModelAvailability;
};

type Connection = {
  id: string;
  provider: string;
  kind: ConnectionKind;
  modelId: string | null;
  enabledModelIds: string[];
  availableModels: ModelOption[];
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
  credentialHintTh?: string;
  stageId: "A" | "B" | "C" | "D";
  stageLabelTh: string;
  status: "READY" | "ADAPTER_PENDING";
  systemConfigured: boolean;
  models: ModelOption[];
};

type RouteStage = {
  id: "A" | "B" | "C" | "D";
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

type IconName = "arrow" | "check" | "chevron" | "eye" | "eyeOff" | "key" | "plug" | "power" | "settings" | "shield" | "trash";

const KIND_ORDER: ConnectionKind[] = ["ANALYZER", "IMAGE", "VIDEO", "VOICE"];
const KIND_META: Record<ConnectionKind, { stage: "A" | "B" | "C" | "D"; label: string; short: string }> = {
  ANALYZER: { stage: "A", label: "วิเคราะห์", short: "Prompt และโครงสร้างเรื่อง" },
  IMAGE: { stage: "B", label: "ภาพ / Reference", short: "ภาพอ้างอิงและตัวละคร" },
  VIDEO: { stage: "C", label: "สร้างคลิป", short: "วิดีโอจากฉากที่ Compile แล้ว" },
  VOICE: { stage: "D", label: "เสียง / พากย์", short: "เสียงพูดและเสียงประกอบ" },
};
const STATUS_LABEL: Record<ConnectionStatus, string> = {
  CONNECTED: "คีย์เชื่อมต่อแล้ว",
  INVALID: "คีย์ไม่ถูกต้อง",
  RATE_LIMITED: "ติด Rate limit",
  ERROR: "เชื่อมต่อไม่ได้",
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "arrow") return <svg {...common}><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>;
  if (name === "chevron") return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>;
  if (name === "eye") return <svg {...common}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
  if (name === "eyeOff") return <svg {...common}><path d="m3 3 18 18"/><path d="M10.6 6.2A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.1 2.7"/><path d="M6.6 6.7C4 8.4 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6"/></svg>;
  if (name === "key") return <svg {...common}><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8"/><path d="m16 7 2 2"/></svg>;
  if (name === "plug") return <svg {...common}><path d="M8 3v5"/><path d="M16 3v5"/><path d="M6 8h12v2a6 6 0 0 1-12 0V8Z"/><path d="M12 16v5"/></svg>;
  if (name === "power") return <svg {...common}><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/></svg>;
  if (name === "settings") return <svg {...common}><path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg>;
  return <svg {...common}><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 14h10l1-14"/></svg>;
}

function credentialPlaceholder(provider?: Provider) {
  if (!provider) return "วาง API key ที่นี่";
  if (provider.id === "kling") return "AccessKey:SecretKey";
  if (provider.id === "runway") return "key_...";
  if (provider.id === "elevenlabs") return "sk_...";
  return "วาง API key ของคุณ";
}

function statusClass(status: ConnectionStatus) {
  if (status === "CONNECTED") return styles.statusConnected;
  if (status === "RATE_LIMITED") return styles.statusWarning;
  return styles.statusError;
}

function formatTestedAt(value: string | null) {
  if (!value) return "ยังไม่เคยทดสอบ";
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function availabilityLabel(value?: ModelAvailability) {
  if (value === "AVAILABLE") return "ตรวจพบจากบัญชี";
  if (value === "SUPPORTED") return "ระบบรองรับ · ยังไม่ยืนยันสิทธิ์";
  return "ยังยืนยันรายรุ่นไม่ได้";
}

const modelPanelStyle = { marginTop: 14, border: "1px solid var(--api-line)", borderRadius: 14, overflow: "hidden", background: "var(--api-surface-raised)" } as const;
const modelRowStyle = { display: "grid", gridTemplateColumns: "24px minmax(0,1fr) auto", gap: 10, alignItems: "center", padding: "10px 12px", borderTop: "1px solid var(--api-line)" } as const;
const mutedStyle = { color: "var(--api-muted)", fontSize: 11, lineHeight: 1.5 } as const;

export default function ApiConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [routing, setRouting] = useState<RouteStage[]>([]);
  const [activeKind, setActiveKind] = useState<ConnectionKind>("ANALYZER");
  // Put the configured Analyzer brain first so Mercury is discoverable without
  // requiring the user to hunt through the provider list.
  const [providerId, setProviderId] = useState("inception");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [defaultModelId, setDefaultModelId] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [editConnectionId, setEditConnectionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const visibleProviders = useMemo(() => providers.filter((provider) => provider.kind === activeKind), [activeKind, providers]);
  const selectedProvider = useMemo(() => providers.find((provider) => provider.id === providerId && provider.kind === activeKind) ?? visibleProviders[0], [activeKind, providerId, providers, visibleProviders]);
  const activeConnections = useMemo(() => connections.filter((connection) => connection.kind === activeKind).sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.provider.localeCompare(right.provider)), [activeKind, connections]);
  const connectedCount = useMemo(() => connections.filter((connection) => connection.enabled && connection.status === "CONNECTED").length, [connections]);
  const readyStageCount = useMemo(() => routing.filter((stage) => stage.ready).length, [routing]);
  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    if (!query) return models;
    return models.filter((model) => `${model.label} ${model.apiModelId} ${model.note || ""}`.toLowerCase().includes(query));
  }, [models, modelSearch]);

  async function loadConnections(silent = false) {
    if (!silent) setPageLoading(true);
    try {
      const response = await fetch("/api/api-connections", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
      setConnections(payload.connections ?? []);
      setProviders(payload.providers ?? []);
      setRouting(payload.routing ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (!silent) setPageLoading(false);
    }
  }

  useEffect(() => { void loadConnections(); }, []);

  useEffect(() => {
    const current = providers.find((provider) => provider.id === providerId && provider.kind === activeKind);
    const next = current ?? providers.find((provider) => provider.kind === activeKind);
    if (!next) return;
    setProviderId(next.id);
    if (!editConnectionId) {
      setBaseUrl(next.defaultBaseUrl);
      setModels([]);
      setSelectedModelIds([]);
      setDefaultModelId("");
      setApiKey("");
      setModelSearch("");
    }
  }, [activeKind, providers, providerId, editConnectionId]);

  function resetForm(provider?: Provider) {
    setApiKey("");
    setShowKey(false);
    setShowAdvanced(false);
    setModels([]);
    setSelectedModelIds([]);
    setDefaultModelId("");
    setModelSearch("");
    setEditConnectionId(null);
    setBaseUrl(provider?.defaultBaseUrl || "");
    setMessage("");
    setError("");
  }

  function selectKind(kind: ConnectionKind) {
    setActiveKind(kind);
    const next = providers.find((provider) => provider.kind === kind);
    if (next) {
      setProviderId(next.id);
      resetForm(next);
    } else resetForm();
  }

  function chooseProvider(provider: Provider) {
    setProviderId(provider.id);
    resetForm(provider);
  }

  async function discoverModels() {
    if (!selectedProvider || apiKey.trim().length < 8 || loading) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/api-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "DISCOVER", provider: selectedProvider.id, kind: selectedProvider.kind, apiKey, baseUrl: selectedProvider.defaultBaseUrl }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "ตรวจสอบ Provider ไม่สำเร็จ");
      const nextModels = (payload.models || []) as ModelOption[];
      const nextDefault = String(payload.defaultModelId || nextModels.find((model) => model.recommended)?.apiModelId || nextModels[0]?.apiModelId || "");
      setModels(nextModels);
      setBaseUrl(payload.baseUrl || selectedProvider.defaultBaseUrl);
      setDefaultModelId(nextDefault);
      setSelectedModelIds(nextDefault ? [nextDefault] : []);
      setMessage(`ตรวจสอบ ${selectedProvider.label} สำเร็จ เลือกรุ่นที่ต้องการเปิดใช้งานได้เลย`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ตรวจสอบ Provider ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function toggleModel(modelId: string, checked: boolean) {
    setSelectedModelIds((current) => {
      const next = checked ? Array.from(new Set([...current, modelId])) : current.filter((id) => id !== modelId);
      if (!checked && defaultModelId === modelId) setDefaultModelId(next[0] || "");
      if (checked && !defaultModelId) setDefaultModelId(modelId);
      return next;
    });
  }

  function selectAllModels() {
    const ids = models.map((model) => model.apiModelId);
    setSelectedModelIds(ids);
    if (!defaultModelId || !ids.includes(defaultModelId)) setDefaultModelId(ids[0] || "");
  }

  async function saveConnection() {
    if (!selectedProvider || !apiKey.trim() || !selectedModelIds.length || !defaultModelId || loading) return;
    const existingConnection = connections.find((connection) => connection.kind === selectedProvider.kind && connection.provider === selectedProvider.id);
    const hasDefault = connections.some((connection) => connection.kind === selectedProvider.kind && connection.isDefault);
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/api-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          provider: selectedProvider.id,
          kind: selectedProvider.kind,
          apiKey,
          modelId: defaultModelId,
          enabledModelIds: selectedModelIds,
          baseUrl,
          enabled: true,
          isDefault: existingConnection?.isDefault ?? !hasDefault,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "เชื่อมต่อไม่สำเร็จ");
      setMessage(`${selectedProvider.label} เชื่อมต่อแล้ว เลือกใช้ ${selectedModelIds.length} โมเดล (สิทธิ์รายโมเดลยืนยันเมื่อ Provider รับงาน)`);
      setApiKey("");
      setShowKey(false);
      setModels([]);
      setSelectedModelIds([]);
      setDefaultModelId("");
      await loadConnections(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "เชื่อมต่อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function startEditModels(connection: Connection) {
    const provider = providers.find((item) => item.id === connection.provider && item.kind === connection.kind);
    setActiveKind(connection.kind);
    setProviderId(connection.provider);
    setEditConnectionId(connection.id);
    setApiKey("");
    setShowKey(false);
    setModels(connection.availableModels.length ? connection.availableModels : provider?.models || []);
    setSelectedModelIds(connection.enabledModelIds.length ? connection.enabledModelIds : connection.modelId ? [connection.modelId] : []);
    setDefaultModelId(connection.modelId || connection.enabledModelIds[0] || "");
    setBaseUrl(connection.baseUrl || provider?.defaultBaseUrl || "");
    setModelSearch("");
    setMessage(`กำลังแก้รุ่นของ ${provider?.label || connection.provider}`);
    setError("");
  }

  async function saveModelSelection() {
    if (!editConnectionId || !selectedModelIds.length || !defaultModelId || loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/api-connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id: editConnectionId, enabledModelIds: selectedModelIds, modelId: defaultModelId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "บันทึกรุ่นไม่สำเร็จ");
      setMessage(`บันทึกรุ่นที่เปิดใช้งานแล้ว ${selectedModelIds.length} รุ่น`);
      await loadConnections(true);
      startEditModels(payload.connection);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกรุ่นไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function patchConnection(id: string, patch: Partial<Pick<Connection, "enabled" | "isDefault">>) {
    setError("");
    const response = await fetch("/api/api-connections", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id, ...patch }) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error || "อัปเดตไม่สำเร็จ"); return; }
    await loadConnections(true);
  }

  async function syncConnectionModels(connection: Connection) {
    if (loading) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/api-connections", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ id: connection.id, syncModels: true }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || "Sync Models ไม่สำเร็จ");
      setMessage(`อัปเดตรายชื่อรุ่นของ ${connection.provider} แล้ว`);
      await loadConnections(true);
      if (editConnectionId === connection.id) startEditModels(payload.connection);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sync Models ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function removeConnection(id: string, provider: string) {
    if (!window.confirm(`ลบการเชื่อมต่อ ${provider} พร้อมรายการรุ่นที่เลือกไว้ใช่หรือไม่?`)) return;
    setError("");
    const response = await fetch(`/api/api-connections?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error || "ลบไม่สำเร็จ"); return; }
    if (editConnectionId === id) resetForm(selectedProvider);
    setMessage(`ลบการเชื่อมต่อ ${provider} แล้ว`);
    await loadConnections(true);
  }

  const activeMeta = KIND_META[activeKind];
  const editConnection = editConnectionId ? connections.find((connection) => connection.id === editConnectionId) || null : null;
  const canSaveModels = selectedModelIds.length > 0 && Boolean(defaultModelId) && selectedModelIds.includes(defaultModelId) && !loading;

  return (
    <main className={styles.page} data-keep-small>
      <header className={styles.pageHeader}>
        <div className={styles.headerCopy}>
          <div className={styles.breadcrumb}><span>การตั้งค่า</span><Icon name="chevron" size={14}/><strong>API &amp; Models</strong></div>
          <h1>ศูนย์เชื่อมต่อ AI</h1>
          <p>เชื่อมต่อ API เพียงครั้งเดียว แล้วเลือกโมเดลจริงที่ต้องการใช้ ระบบจะแสดง Model ID ที่ส่งไปหลังบ้านอย่างชัดเจน</p>
        </div>
        <div className={styles.headerSummary}>
          <div className={styles.summaryItem}><span>การเชื่อมต่อที่พร้อม</span><strong>{connectedCount}</strong><small>จากทั้งหมด {connections.length}</small></div>
          <div className={styles.summaryItem}><span>ประเภทที่เชื่อมแล้ว</span><strong>{readyStageCount}/4</strong><small>Connection Categories</small></div>
          <div className={styles.securitySummary}><span className={styles.summaryIcon}><Icon name="shield"/></span><span><strong>เข้ารหัสบนเซิร์ฟเวอร์</strong><small>คีย์เต็มไม่ถูกส่งกลับ Browser</small></span></div>
        </div>
      </header>

      <section className={styles.workflowPanel}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>CONNECTION CATEGORIES</span><h2>เลือกประเภทที่ต้องการเชื่อมต่อ</h2></div><p>หนึ่ง Provider Connection สามารถเปิดหลายรุ่นได้โดยไม่ต้องเก็บ API Key ซ้ำ</p></div>
        <div className={styles.stageRail}>
          {KIND_ORDER.map((kind) => {
            const stage = routing.find((item) => item.kind === kind);
            const meta = KIND_META[kind];
            return <button key={kind} type="button" className={`${styles.stageButton} ${kind === activeKind ? styles.stageButtonActive : ""}`} onClick={() => selectKind(kind)}>
              <span className={styles.stageNumber}>{meta.stage}</span><span className={styles.stageCopy}><strong>{stage?.labelTh ?? meta.label}</strong><small>{stage?.shortTh ?? meta.short}</small></span>
              <span className={`${styles.stageState} ${stage?.ready ? styles.stageStateReady : ""}`}><i aria-hidden="true"/>{stage?.connectionCount ? `${stage.connectionCount} Connection` : "ยังไม่เชื่อม"}</span>
            </button>;
          })}
        </div>
      </section>

      {message ? <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status"><Icon name="check"/><span>{message}</span><button type="button" onClick={() => setMessage("")}>×</button></div> : null}
      {error ? <div className={`${styles.notice} ${styles.noticeError}`} role="alert"><span>!</span><span>{error}</span><button type="button" onClick={() => setError("")}>×</button></div> : null}

      <div className={styles.workbench}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><span className={styles.panelKicker}>{activeMeta.stage} · {activeMeta.label}</span><h2>เลือกผู้ให้บริการ</h2><p>{activeMeta.short}</p></div><span className={styles.countPill}>{visibleProviders.length} Providers</span></div>

          {pageLoading ? <div className={styles.loadingState}>กำลังโหลด Provider...</div> : <div className={styles.providerGrid}>
            {visibleProviders.map((provider) => {
              const connected = connections.some((connection) => connection.provider === provider.id && connection.kind === provider.kind && connection.status === "CONNECTED");
              return <button key={provider.id} type="button" className={`${styles.providerCard} ${selectedProvider?.id === provider.id ? styles.providerCardSelected : ""}`} onClick={() => chooseProvider(provider)}>
                <span className={styles.providerMonogram}>{provider.label.slice(0,1).toUpperCase()}</span>
                <span className={styles.providerCopy}><span className={styles.providerTitleRow}><strong>{provider.label}</strong>{connected ? <span className={styles.miniReady}><Icon name="check" size={12}/>เชื่อมแล้ว</span> : null}</span><small>{provider.purposeTh}</small></span>
                <span className={styles.providerSelectMark}>{selectedProvider?.id === provider.id ? <Icon name="check" size={15}/> : null}</span>
              </button>;
            })}
          </div>}

          {selectedProvider ? <div className={styles.connectionForm}>
            <div className={styles.formHeader}><div className={styles.formProvider}><span className={styles.providerMonogramLarge}>{selectedProvider.label.slice(0,1).toUpperCase()}</span><span><small>{editConnection ? "แก้รุ่นที่เชื่อมต่อ" : "กำลังเชื่อมต่อ"}</small><strong>{selectedProvider.label}</strong></span></div><div className={styles.formBadges}>{selectedProvider.systemConfigured ? <span className={styles.systemBadge}>มีค่าระบบ</span> : null}<span className={styles.adapterReady}>Adapter พร้อม</span></div></div>
            <p className={styles.capability}>{selectedProvider.capabilityTh}</p>
            {selectedProvider.id === "inception" ? <div className={styles.providerCallout} role="note"><strong>Mercury 2 · AI Brain</strong><span>ใช้สำหรับวิเคราะห์บทและจัดตัวเลือกตามบริบท ไม่ใช่ Provider สำหรับสร้างวิดีโอ และจะไม่หักเครดิตการเรนเดอร์</span><a href="https://docs.inceptionlabs.ai/capabilities/chat-completions" target="_blank" rel="noreferrer">ดูวิธีใช้ API ↗</a></div> : null}

            {!editConnection ? <div className={styles.fieldGroup}>
              <div className={styles.fieldLabelRow}><label htmlFor="api-key"><span className={styles.stepBadge}>1</span>Credential</label><span>จำเป็น</span></div>
              <div className={styles.secretInput}><span className={styles.inputIcon}><Icon name="key" size={17}/></span><input id="api-key" type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => { setApiKey(event.target.value); setModels([]); setSelectedModelIds([]); setDefaultModelId(""); }} placeholder={credentialPlaceholder(selectedProvider)} autoComplete="off" spellCheck={false}/><button type="button" onClick={() => setShowKey((value) => !value)}><Icon name={showKey ? "eyeOff" : "eye"} size={18}/></button></div>
              <p className={styles.fieldHint}>{selectedProvider.credentialHintTh}</p>
              <div className={styles.submitRow}><div className={styles.submitExplanation}><span className={styles.stepBadge}>2</span><span><strong>ตรวจสอบคีย์และโหลดรายการโมเดล</strong><small>ไม่สั่ง Generate และยังไม่ยืนยันสิทธิ์รายโมเดลจนกว่าจะสร้างงานจริง</small></span></div><button type="button" className={styles.primaryButton} disabled={apiKey.trim().length < 8 || loading} onClick={() => void discoverModels()}>{loading ? "กำลังตรวจสอบ..." : <>ตรวจสอบ Key และค้นหารุ่น <Icon name="arrow" size={18}/></>}</button></div>
            </div> : <div className={styles.fieldGroup}><div className={styles.fieldLabelRow}><label><span className={styles.stepBadge}>1</span>Credential เดิม</label><span>{editConnection.maskedKey}</span></div><p className={styles.fieldHint}>แก้รายการรุ่นได้โดยไม่ต้องกรอก API Key ใหม่ หากต้องการเปลี่ยน Key ให้เลือก Provider ใหม่แล้วเชื่อมต่อซ้ำ</p></div>}

            {(models.length > 0 || editConnection) ? <>
              <button className={styles.advancedToggle} type="button" onClick={() => setShowAdvanced((value) => !value)}><span><span className={styles.stepBadge}>3</span><Icon name="settings" size={17}/>ค่าที่ระบบกำหนดให้อัตโนมัติ<small>ไม่ต้องกรอก Model ID หรือ Base URL เอง</small></span><span className={showAdvanced ? styles.chevronOpen : ""}><Icon name="chevron" size={17}/></span></button>
              {showAdvanced ? <div className={styles.advancedFields}><label><span>Default Model ID</span><input value={defaultModelId} readOnly/></label><label><span>Base URL</span><input value={baseUrl || selectedProvider.defaultBaseUrl} readOnly/></label></div> : null}

              <div style={modelPanelStyle}>
                <div style={{ padding: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 220px" }}><strong style={{ display: "block", fontSize: 13 }}>เลือกรุ่นที่ต้องการเปิด</strong><small style={mutedStyle}>ติ๊กได้หลายรุ่น และเลือกรุ่น Default หนึ่งรุ่น</small></div>
                  <input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="ค้นหาชื่อหรือ Model ID" style={{ flex: "1 1 200px", minWidth: 0, padding: "9px 10px", border: "1px solid var(--api-line)", borderRadius: 9, background: "var(--api-surface)", color: "var(--api-text)" }}/>
                  <button type="button" onClick={selectAllModels} style={{ border: "1px solid var(--api-line)", borderRadius: 9, padding: "8px 10px", background: "var(--api-surface)", color: "var(--api-text)", cursor: "pointer" }}>เลือกทั้งหมด</button>
                </div>
                {filteredModels.map((model, index) => {
                  const checked = selectedModelIds.includes(model.apiModelId);
                  return <div key={model.apiModelId} style={{ ...modelRowStyle, borderTop: index === 0 ? "1px solid var(--api-line)" : modelRowStyle.borderTop }}>
                    <input type="checkbox" checked={checked} onChange={(event) => toggleModel(model.apiModelId, event.target.checked)}/>
                    <div><strong style={{ display: "block", fontSize: 12 }}>{model.label}</strong><code style={{ fontSize: 10, color: "var(--api-muted)", wordBreak: "break-all" }}>{model.apiModelId}</code>{model.note ? <small style={{ ...mutedStyle, display: "block" }}>{model.note}</small> : null}</div>
                    <div style={{ textAlign: "right" }}><small style={mutedStyle}>{availabilityLabel(model.availability)}</small><label style={{ display: "block", marginTop: 5, fontSize: 10, cursor: checked ? "pointer" : "not-allowed", opacity: checked ? 1 : .45 }}><input type="radio" name="default-model" checked={defaultModelId === model.apiModelId} disabled={!checked} onChange={() => setDefaultModelId(model.apiModelId)}/> Default</label></div>
                  </div>;
                })}
                {!filteredModels.length ? <div style={{ padding: 16, ...mutedStyle }}>ไม่พบรุ่นตามคำค้น</div> : null}
              </div>

              <div className={styles.submitRow}><div className={styles.submitExplanation}><span className={styles.stepBadge}>4</span><span><strong>{editConnection ? "บันทึกรุ่นที่เปิดใช้งาน" : "บันทึก Connection"}</strong><small>{selectedModelIds.length} รุ่น · Default: {defaultModelId || "ยังไม่ได้เลือก"}</small></span></div><button type="button" className={styles.primaryButton} disabled={!canSaveModels || (!editConnection && !apiKey.trim())} onClick={() => void (editConnection ? saveModelSelection() : saveConnection())}>{loading ? "กำลังบันทึก..." : editConnection ? "บันทึกการแก้ไข" : "เชื่อมต่อและบันทึก"}</button></div>
            </> : null}
          </div> : null}
        </section>

        <aside className={`${styles.panel} ${styles.connectionsPanel}`}>
          <div className={styles.panelHeader}><div><span className={styles.panelKicker}>CONNECTED PROVIDERS</span><h2>การเชื่อมต่อในสายนี้</h2><p>แก้รุ่น, Sync รุ่นล่าสุด, เปิด/ปิด หรือลบ Connection ได้จากที่นี่</p></div><span className={styles.countPill}>{activeConnections.length}</span></div>
          <div className={styles.routeSummary}><span className={styles.routeIcon}><Icon name="plug"/></span><span><small>พร้อมให้หน้าสร้างเลือก</small><strong>{activeConnections.filter((connection) => connection.enabled && connection.status === "CONNECTED").length} API Connection เชื่อมต่อแล้ว</strong></span><span className={`${styles.routeIndicator} ${activeConnections.some((connection) => connection.enabled && connection.status === "CONNECTED") ? styles.routeIndicatorReady : ""}`}/></div>

          {activeConnections.length ? <div className={styles.connectionList}>{activeConnections.map((connection) => {
            const provider = providers.find((item) => item.id === connection.provider && item.kind === connection.kind);
            return <article className={`${styles.connectionCard} ${connection.isDefault ? styles.connectionCardDefault : ""}`} key={connection.id}>
              <div className={styles.connectionTop}><div className={styles.connectionIdentity}><span className={styles.connectionMonogram}>{(provider?.label || connection.provider).slice(0,1).toUpperCase()}</span><span><strong>{provider?.label || connection.provider}</strong><small>{connection.maskedKey}</small></span></div><span className={`${styles.connectionStatus} ${statusClass(connection.status)}`}><i aria-hidden="true"/>{STATUS_LABEL[connection.status]}</span></div>
              <div className={styles.connectionDetails}><div><span>รุ่นที่เปิด</span><strong>{connection.enabledModelIds.length} รุ่น</strong></div><div><span>Default Model</span><strong>{connection.modelId || "—"}</strong></div><div><span>ทดสอบล่าสุด</span><strong>{formatTestedAt(connection.lastTestedAt)}</strong></div></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, margin: "8px 0" }}>{connection.enabledModelIds.slice(0, 8).map((id) => <span key={id} style={{ padding: "4px 7px", border: "1px solid var(--api-line)", borderRadius: 999, fontSize: 9, color: "var(--api-muted)" }}>{connection.availableModels.find((model) => model.apiModelId === id)?.label || id}</span>)}{connection.enabledModelIds.length > 8 ? <span style={{ fontSize: 10, color: "var(--api-muted)", alignSelf: "center" }}>+{connection.enabledModelIds.length - 8}</span> : null}</div>
              {connection.lastError ? <p className={styles.connectionError}>{connection.lastError}</p> : null}
              <div className={styles.connectionFooter}><div className={styles.connectionFlags}>{connection.isDefault ? <span className={styles.defaultFlag}><Icon name="check" size={13}/>ตัวสำรองอัตโนมัติ</span> : <button type="button" onClick={() => void patchConnection(connection.id, { isDefault: true })}>ตั้งเป็นตัวสำรอง</button>}</div><div className={styles.connectionActions}>
                <button type="button" onClick={() => startEditModels(connection)} title="แก้รุ่น"><Icon name="settings" size={16}/>แก้รุ่น</button>
                <button type="button" onClick={() => void syncConnectionModels(connection)} title="ตรวจสอบรุ่นล่าสุด" disabled={loading}>↻ Sync</button>
                <button className={connection.enabled ? styles.powerOn : ""} type="button" onClick={() => void patchConnection(connection.id, { enabled: !connection.enabled })}><Icon name="power" size={16}/>{connection.enabled ? "เปิดอยู่" : "ปิดอยู่"}</button>
                <button className={styles.deleteButton} type="button" onClick={() => void removeConnection(connection.id, provider?.label || connection.provider)} title="ลบการเชื่อมต่อ"><Icon name="trash" size={16}/></button>
              </div></div>
            </article>;
          })}</div> : <div className={styles.emptyState}><span className={styles.emptyIcon}><Icon name="plug" size={24}/></span><h3>ยังไม่มี Connection ในประเภท {activeMeta.stage}</h3><p>เลือก Provider ทางซ้าย วาง Credential กดตรวจสอบ แล้วติ๊กรุ่นที่ต้องการใช้</p><ol><li><span>1</span>วาง Credential</li><li><span>2</span>ค้นหา Models อัตโนมัติ</li><li><span>3</span>ติ๊กรุ่นและบันทึก</li></ol></div>}

          <div className={styles.securityNote}><Icon name="shield" size={17}/><p><strong>Credential ถูกเก็บแบบเข้ารหัส</strong> Model ID และ Base URL เป็น metadata เท่านั้น คีย์เต็มไม่ถูกส่งกลับมายังหน้านี้</p></div>
        </aside>
      </div>
    </main>
  );
}
