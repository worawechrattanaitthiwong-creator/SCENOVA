"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./api-connections.module.css";

type ConnectionKind = "ANALYZER" | "VIDEO" | "IMAGE" | "VOICE";
type ConnectionStatus = "CONNECTED" | "INVALID" | "RATE_LIMITED" | "ERROR";

type Connection = {
  id: string;
  provider: string;
  kind: ConnectionKind;
  modelId: string;
  baseUrl: string;
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

type IconName =
  | "arrow"
  | "check"
  | "chevron"
  | "eye"
  | "eyeOff"
  | "key"
  | "plug"
  | "power"
  | "route"
  | "settings"
  | "shield"
  | "trash";

const KIND_ORDER: ConnectionKind[] = ["ANALYZER", "IMAGE", "VIDEO", "VOICE"];

const KIND_META: Record<
  ConnectionKind,
  { stage: "A" | "B" | "C" | "D"; label: string; short: string }
> = {
  ANALYZER: { stage: "A", label: "วิเคราะห์", short: "Prompt และโครงสร้างเรื่อง" },
  IMAGE: { stage: "B", label: "ภาพ / Reference", short: "ภาพอ้างอิงและตัวละคร" },
  VIDEO: { stage: "C", label: "สร้างคลิป", short: "วิดีโอจากฉากที่ Compile แล้ว" },
  VOICE: { stage: "D", label: "เสียง / พากย์", short: "เสียงพูดและเสียงประกอบ" },
};

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  CONNECTED: "พร้อมใช้งาน",
  INVALID: "คีย์ไม่ถูกต้อง",
  RATE_LIMITED: "ติด Rate limit",
  ERROR: "เชื่อมต่อไม่ได้",
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m14 7 5 5-5 5" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "eyeOff":
      return (
        <svg {...common}>
          <path d="m3 3 18 18" />
          <path d="M10.6 6.2A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.1 2.7" />
          <path d="M6.6 6.7C4 8.4 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6" />
        </svg>
      );
    case "key":
      return (
        <svg {...common}>
          <circle cx="8" cy="15" r="4" />
          <path d="m11 12 8-8" />
          <path d="m16 7 2 2" />
          <path d="m14 9 2 2" />
        </svg>
      );
    case "plug":
      return (
        <svg {...common}>
          <path d="M8 3v5" />
          <path d="M16 3v5" />
          <path d="M6 8h12v2a6 6 0 0 1-6 6v0a6 6 0 0 1-6-6V8Z" />
          <path d="M12 16v5" />
        </svg>
      );
    case "power":
      return (
        <svg {...common}>
          <path d="M12 2v10" />
          <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
        </svg>
      );
    case "route":
      return (
        <svg {...common}>
          <circle cx="6" cy="5" r="2" />
          <circle cx="18" cy="19" r="2" />
          <path d="M6 7v3a2 2 0 0 0 2 2h8a2 2 0 0 1 2 2v3" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M4 7h10" />
          <path d="M18 7h2" />
          <circle cx="16" cy="7" r="2" />
          <path d="M4 17h2" />
          <path d="M10 17h10" />
          <circle cx="8" cy="17" r="2" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 20 6v5c0 5-3.4 8.2-8 10-4.6-1.8-8-5-8-10V6l8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M9 7V4h6v3" />
          <path d="m6 7 1 14h10l1-14" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      );
  }
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
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const visibleProviders = useMemo(
    () => providers.filter((provider) => provider.kind === activeKind),
    [activeKind, providers],
  );

  const selectedProvider = useMemo(
    () =>
      providers.find(
        (provider) => provider.id === providerId && provider.kind === activeKind,
      ) ?? visibleProviders[0],
    [activeKind, providerId, providers, visibleProviders],
  );

  const activeConnections = useMemo(
    () =>
      connections
        .filter((connection) => connection.kind === activeKind)
        .sort(
          (left, right) =>
            Number(right.isDefault) - Number(left.isDefault) ||
            left.provider.localeCompare(right.provider),
        ),
    [activeKind, connections],
  );

  const connectedCount = useMemo(
    () =>
      connections.filter(
        (connection) => connection.enabled && connection.status === "CONNECTED",
      ).length,
    [connections],
  );

  const readyStageCount = useMemo(
    () => routing.filter((stage) => stage.ready).length,
    [routing],
  );

  const activeRoute = useMemo(
    () => routing.find((stage) => stage.kind === activeKind),
    [activeKind, routing],
  );

  async function loadConnections(silent = false) {
    if (!silent) setPageLoading(true);
    try {
      const response = await fetch("/api/api-connections", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "โหลดข้อมูลไม่สำเร็จ");
      setConnections(payload.connections ?? []);
      setProviders(payload.providers ?? []);
      setRouting(payload.routing ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (!silent) setPageLoading(false);
    }
  }

  useEffect(() => {
    void loadConnections();
  }, []);

  useEffect(() => {
    const current = providers.find(
      (provider) => provider.id === providerId && provider.kind === activeKind,
    );
    const next = current ?? providers.find((provider) => provider.kind === activeKind);
    if (!next) return;

    setProviderId(next.id);
    setModelId(next.defaultModelId ?? "");
    setBaseUrl(next.defaultBaseUrl);
    setApiKey("");
    setShowKey(false);
    setShowAdvanced(false);
  }, [activeKind, providers]);

  function selectKind(kind: ConnectionKind) {
    setActiveKind(kind);
    setMessage("");
    setError("");
  }

  function chooseProvider(provider: Provider) {
    setProviderId(provider.id);
    setModelId(provider.defaultModelId ?? "");
    setBaseUrl(provider.defaultBaseUrl);
    setApiKey("");
    setShowKey(false);
    setShowAdvanced(false);
    setMessage("");
    setError("");
  }

  async function connect() {
    if (!selectedProvider) return;
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/api-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          provider: selectedProvider.id,
          kind: selectedProvider.kind,
          apiKey,
          modelId,
          baseUrl,
          enabled: true,
          isDefault: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "เชื่อมต่อไม่สำเร็จ");

      setApiKey("");
      setShowKey(false);
      setMessage(`${selectedProvider.label} พร้อมใช้งานและถูกเลือกเป็นค่าเริ่มต้นแล้ว`);
      await loadConnections(true);
    } catch (connectError) {
      setError(
        connectError instanceof Error ? connectError.message : "เชื่อมต่อไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }

  async function patchConnection(
    id: string,
    patch: Partial<Pick<Connection, "enabled" | "isDefault" | "modelId">>,
  ) {
    setError("");
    const response = await fetch("/api/api-connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id, ...patch }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "อัปเดตไม่สำเร็จ");
      return;
    }
    await loadConnections(true);
  }

  async function removeConnection(id: string, provider: string) {
    if (!window.confirm(`ลบการเชื่อมต่อ ${provider} ใช่หรือไม่?`)) return;
    setError("");
    const response = await fetch(`/api/api-connections?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "ลบไม่สำเร็จ");
      return;
    }
    setMessage(`ลบการเชื่อมต่อ ${provider} แล้ว`);
    await loadConnections(true);
  }

  const canConnect =
    Boolean(selectedProvider?.ready) && apiKey.trim().length >= 8 && !loading;
  const activeMeta = KIND_META[activeKind];

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headerCopy}>
          <div className={styles.breadcrumb}>
            <span>การตั้งค่า</span>
            <Icon name="chevron" size={14} />
            <strong>API &amp; Models</strong>
          </div>
          <h1>ศูนย์เชื่อมต่อ AI</h1>
          <p>
            จัดการ Provider ที่ SCENOVA ใช้ในแต่ละขั้นตอนของงาน
            ระบบจะทดสอบคีย์ก่อนบันทึกและเลือกเส้นทางที่พร้อมใช้ให้อัตโนมัติ
          </p>
        </div>

        <div className={styles.headerSummary}>
          <div className={styles.summaryItem}>
            <span>การเชื่อมต่อที่พร้อม</span>
            <strong>{connectedCount}</strong>
            <small>จากทั้งหมด {connections.length}</small>
          </div>
          <div className={styles.summaryItem}>
            <span>สายงานที่พร้อม</span>
            <strong>{readyStageCount}/4</strong>
            <small>ขั้นตอนการผลิต</small>
          </div>
          <div className={styles.securitySummary}>
            <span className={styles.summaryIcon}>
              <Icon name="shield" />
            </span>
            <span>
              <strong>เข้ารหัสบนเซิร์ฟเวอร์</strong>
              <small>คีย์เต็มจะไม่ส่งกลับมาที่เบราว์เซอร์</small>
            </span>
          </div>
        </div>
      </header>

      <section className={styles.workflowPanel} aria-labelledby="workflow-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>WORKFLOW ROUTING</span>
            <h2 id="workflow-title">เลือกขั้นตอนที่ต้องการตั้งค่า</h2>
          </div>
          <p>หนึ่งขั้นตอนมี Provider ได้หลายราย และกำหนดค่าเริ่มต้นได้หนึ่งรายการ</p>
        </div>

        <div className={styles.stageRail}>
          {KIND_ORDER.map((kind, index) => {
            const stage = routing.find((item) => item.kind === kind);
            const meta = KIND_META[kind];
            const active = kind === activeKind;
            return (
              <button
                className={`${styles.stageButton} ${active ? styles.stageButtonActive : ""}`}
                key={kind}
                onClick={() => selectKind(kind)}
                type="button"
                aria-pressed={active}
              >
                <span className={styles.stageNumber}>{meta.stage}</span>
                <span className={styles.stageCopy}>
                  <strong>{stage?.labelTh ?? meta.label}</strong>
                  <small>{stage?.shortTh ?? meta.short}</small>
                </span>
                <span
                  className={`${styles.stageState} ${
                    stage?.ready ? styles.stageStateReady : ""
                  }`}
                >
                  <i aria-hidden="true" />
                  {stage?.ready ? stage.activeProvider : stage?.optional ? "เสริม" : "ยังไม่เชื่อม"}
                </span>
                {index < KIND_ORDER.length - 1 ? (
                  <span className={styles.stageArrow} aria-hidden="true">
                    <Icon name="chevron" size={15} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {message ? (
        <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status">
          <Icon name="check" />
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")} aria-label="ปิดข้อความ">
            ×
          </button>
        </div>
      ) : null}
      {error ? (
        <div className={`${styles.notice} ${styles.noticeError}`} role="alert">
          <span className={styles.noticeMark}>!</span>
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="ปิดข้อความ">
            ×
          </button>
        </div>
      ) : null}

      <div className={styles.workbench}>
        <section className={styles.panel} aria-labelledby="provider-title">
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelKicker}>
                {activeMeta.stage} · {activeMeta.label}
              </span>
              <h2 id="provider-title">เลือกผู้ให้บริการ</h2>
              <p>{activeRoute?.descriptionTh ?? activeMeta.short}</p>
            </div>
            <span className={styles.countPill}>{visibleProviders.length} Providers</span>
          </div>

          {pageLoading ? (
            <div className={styles.loadingState}>
              <span className={styles.spinner} aria-hidden="true" />
              กำลังโหลดรายชื่อ Provider...
            </div>
          ) : visibleProviders.length ? (
            <div className={styles.providerGrid}>
              {visibleProviders.map((provider) => {
                const selected = selectedProvider?.id === provider.id;
                const providerConnection = connections.find(
                  (connection) =>
                    connection.kind === provider.kind &&
                    connection.provider === provider.id &&
                    connection.status === "CONNECTED",
                );
                return (
                  <button
                    className={`${styles.providerCard} ${
                      selected ? styles.providerCardSelected : ""
                    }`}
                    key={provider.id}
                    onClick={() => chooseProvider(provider)}
                    type="button"
                    aria-pressed={selected}
                  >
                    <span className={styles.providerMonogram}>
                      {provider.label.slice(0, 1).toUpperCase()}
                    </span>
                    <span className={styles.providerCopy}>
                      <span className={styles.providerTitleRow}>
                        <strong>{provider.label}</strong>
                        {providerConnection ? (
                          <span className={styles.miniReady}>
                            <Icon name="check" size={12} />
                            เชื่อมแล้ว
                          </span>
                        ) : null}
                      </span>
                      <small>{provider.purposeTh}</small>
                    </span>
                    <span className={styles.providerSelectMark}>
                      {selected ? <Icon name="check" size={15} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyCompact}>ยังไม่มี Provider สำหรับสายงานนี้</div>
          )}

          {selectedProvider ? (
            <div className={styles.connectionForm}>
              <div className={styles.formHeader}>
                <div className={styles.formProvider}>
                  <span className={styles.providerMonogramLarge}>
                    {selectedProvider.label.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <small>กำลังเชื่อมต่อ</small>
                    <strong>{selectedProvider.label}</strong>
                  </span>
                </div>
                <div className={styles.formBadges}>
                  {selectedProvider.systemConfigured ? (
                    <span className={styles.systemBadge}>มีค่าระบบ</span>
                  ) : null}
                  <span
                    className={
                      selectedProvider.ready ? styles.adapterReady : styles.adapterPending
                    }
                  >
                    {selectedProvider.ready ? "Adapter พร้อม" : "Adapter กำลังพัฒนา"}
                  </span>
                </div>
              </div>

              <p className={styles.capability}>{selectedProvider.capabilityTh}</p>

              {selectedProvider.ready ? (
                <>
                  <div className={styles.fieldGroup}>
                    <div className={styles.fieldLabelRow}>
                      <label htmlFor="api-key">
                        <span className={styles.stepBadge}>1</span>
                        Credential
                      </label>
                      <span>จำเป็น</span>
                    </div>
                    <div className={styles.secretInput}>
                      <span className={styles.inputIcon}>
                        <Icon name="key" size={17} />
                      </span>
                      <input
                        id="api-key"
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder={credentialPlaceholder(selectedProvider)}
                        autoComplete="off"
                        spellCheck={false}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey((current) => !current)}
                        aria-label={showKey ? "ซ่อน Credential" : "แสดง Credential"}
                      >
                        <Icon name={showKey ? "eyeOff" : "eye"} size={18} />
                      </button>
                    </div>
                    <p className={styles.fieldHint}>
                      {selectedProvider.credentialHintTh ||
                        "ใช้ API key จากหน้า Developer ของผู้ให้บริการ"}
                    </p>
                  </div>

                  <button
                    className={styles.advancedToggle}
                    type="button"
                    onClick={() => setShowAdvanced((current) => !current)}
                    aria-expanded={showAdvanced}
                  >
                    <span>
                      <span className={styles.stepBadge}>2</span>
                      <Icon name="settings" size={17} />
                      Model และ Endpoint
                      <small>ใช้ค่าแนะนำได้โดยไม่ต้องแก้</small>
                    </span>
                    <span className={showAdvanced ? styles.chevronOpen : ""}>
                      <Icon name="chevron" size={17} />
                    </span>
                  </button>

                  {showAdvanced ? (
                    <div className={styles.advancedFields}>
                      <label>
                        <span>Model ID</span>
                        <input
                          value={modelId}
                          onChange={(event) => setModelId(event.target.value)}
                          placeholder={selectedProvider.defaultModelId || "ค่าเริ่มต้นของ Provider"}
                        />
                      </label>
                      <label>
                        <span>Base URL</span>
                        <input
                          value={baseUrl}
                          onChange={(event) => setBaseUrl(event.target.value)}
                          placeholder={selectedProvider.defaultBaseUrl}
                        />
                      </label>
                    </div>
                  ) : null}

                  <div className={styles.submitRow}>
                    <div className={styles.submitExplanation}>
                      <span className={styles.stepBadge}>3</span>
                      <span>
                        <strong>ทดสอบก่อนบันทึก</strong>
                        <small>ระบบจะเรียก Provider หนึ่งครั้งเพื่อตรวจสอบคีย์</small>
                      </span>
                    </div>
                    <button
                      className={styles.primaryButton}
                      onClick={() => void connect()}
                      disabled={!canConnect}
                      type="button"
                    >
                      {loading ? (
                        <>
                          <span className={styles.buttonSpinner} aria-hidden="true" />
                          กำลังทดสอบ...
                        </>
                      ) : (
                        <>
                          ทดสอบและเชื่อมต่อ
                          <Icon name="arrow" size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className={styles.adapterNotice}>
                  Provider นี้แสดงไว้เพื่อวางแผนสายงาน แต่ยังไม่เปิดให้บันทึก Credential
                </div>
              )}
            </div>
          ) : null}
        </section>

        <aside className={`${styles.panel} ${styles.connectionsPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelKicker}>ACTIVE CONNECTIONS</span>
              <h2>การเชื่อมต่อในสายนี้</h2>
              <p>รายการที่เปิดใช้งานจะถูกส่งให้ Workflow ตามลำดับค่าเริ่มต้น</p>
            </div>
            <span className={styles.countPill}>{activeConnections.length}</span>
          </div>

          <div className={styles.routeSummary}>
            <span className={styles.routeIcon}>
              <Icon name="route" />
            </span>
            <span>
              <small>เส้นทางปัจจุบัน</small>
              <strong>
                {activeRoute?.ready
                  ? `${activeRoute.activeProvider} · พร้อมรับงาน`
                  : "ยังไม่มีการเชื่อมต่อที่พร้อม"}
              </strong>
            </span>
            <span
              className={`${styles.routeIndicator} ${
                activeRoute?.ready ? styles.routeIndicatorReady : ""
              }`}
            />
          </div>

          {pageLoading ? (
            <div className={styles.connectionSkeleton}>
              <span />
              <span />
            </div>
          ) : activeConnections.length ? (
            <div className={styles.connectionList}>
              {activeConnections.map((connection) => {
                const provider = providers.find(
                  (item) =>
                    item.id === connection.provider && item.kind === connection.kind,
                );
                return (
                  <article
                    className={`${styles.connectionCard} ${
                      connection.isDefault ? styles.connectionCardDefault : ""
                    }`}
                    key={connection.id}
                  >
                    <div className={styles.connectionTop}>
                      <div className={styles.connectionIdentity}>
                        <span className={styles.connectionMonogram}>
                          {(provider?.label ?? connection.provider).slice(0, 1).toUpperCase()}
                        </span>
                        <span>
                          <strong>{provider?.label ?? connection.provider}</strong>
                          <small>{connection.maskedKey}</small>
                        </span>
                      </div>
                      <span
                        className={`${styles.connectionStatus} ${statusClass(
                          connection.status,
                        )}`}
                      >
                        <i aria-hidden="true" />
                        {STATUS_LABEL[connection.status]}
                      </span>
                    </div>

                    <div className={styles.connectionDetails}>
                      <div>
                        <span>Model</span>
                        <strong>{connection.modelId || "ค่าเริ่มต้นของ Provider"}</strong>
                      </div>
                      <div>
                        <span>ทดสอบล่าสุด</span>
                        <strong>{formatTestedAt(connection.lastTestedAt)}</strong>
                      </div>
                    </div>

                    {connection.lastError ? (
                      <p className={styles.connectionError}>{connection.lastError}</p>
                    ) : null}

                    <div className={styles.connectionFooter}>
                      <div className={styles.connectionFlags}>
                        {connection.isDefault ? (
                          <span className={styles.defaultFlag}>
                            <Icon name="check" size={13} />
                            ค่าเริ่มต้น
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              void patchConnection(connection.id, { isDefault: true })
                            }
                          >
                            ตั้งเป็นค่าเริ่มต้น
                          </button>
                        )}
                      </div>
                      <div className={styles.connectionActions}>
                        <button
                          className={connection.enabled ? styles.powerOn : ""}
                          type="button"
                          onClick={() =>
                            void patchConnection(connection.id, {
                              enabled: !connection.enabled,
                            })
                          }
                          title={connection.enabled ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        >
                          <Icon name="power" size={16} />
                          {connection.enabled ? "เปิดอยู่" : "ปิดอยู่"}
                        </button>
                        <button
                          className={styles.deleteButton}
                          type="button"
                          onClick={() =>
                            void removeConnection(
                              connection.id,
                              provider?.label ?? connection.provider,
                            )
                          }
                          title="ลบการเชื่อมต่อ"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                <Icon name="plug" size={24} />
              </span>
              <h3>ยังไม่มีการเชื่อมต่อในสาย {activeMeta.stage}</h3>
              <p>
                เลือก Provider ทางซ้าย วาง Credential แล้วกด “ทดสอบและเชื่อมต่อ”
                รายการที่ผ่านจะมาแสดงตรงนี้ทันที
              </p>
              <ol>
                <li>
                  <span>1</span> เลือกผู้ให้บริการ
                </li>
                <li>
                  <span>2</span> ใส่ Credential
                </li>
                <li>
                  <span>3</span> ทดสอบและบันทึก
                </li>
              </ol>
            </div>
          )}

          <div className={styles.securityNote}>
            <Icon name="shield" size={17} />
            <p>
              <strong>Credential ถูกเก็บแบบเข้ารหัส</strong>
              หลังบันทึก หน้านี้จะแสดงเฉพาะส่วนท้ายของคีย์เพื่อใช้ตรวจสอบเท่านั้น
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
