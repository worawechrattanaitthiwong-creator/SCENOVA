"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VIDEO_MODELS } from "@/lib/catalogs";
import { getVideoModelVersions } from "@/lib/video-model-versions";
import styles from "./agent-run-model-editor.module.css";

type Run = {
  id: string;
  status: string;
  stage: string;
  inputJson?: {
    project?: {
      title?: string;
      mainModelId?: string;
      mainModelVersionId?: string;
      episodes?: Array<{ title?: string }>;
    };
  };
};

type Connection = {
  provider: string;
  kind: string;
  status: string;
  enabled: boolean;
};

type Provider = {
  id: string;
  kind: string;
  ready: boolean;
  systemConfigured: boolean;
};

function providerIdForModel(modelId: string) {
  return modelId === "seedance-2-5" ? "seedance" : modelId;
}

function titleOf(run: Run) {
  return run.inputJson?.project?.episodes?.[0]?.title || run.inputJson?.project?.title || "งาน AI";
}

function statusLabel(status: string) {
  if (status === "FAILED") return "ต้องตรวจสอบ";
  if (status === "PAUSED") return "พักไว้";
  if (status === "RUNNING") return "กำลังทำงาน";
  if (status === "QUEUED") return "รอ Worker";
  if (status === "WAITING_APPROVAL") return "รออนุมัติ";
  return status;
}

export default function AgentRunModelEditor() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [modelId, setModelId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [runsResponse, connectionsResponse] = await Promise.all([
      fetch("/api/agent/runs", { cache: "no-store", credentials: "same-origin" }),
      fetch("/api/api-connections", { cache: "no-store", credentials: "same-origin" }),
    ]);
    const runsPayload = await runsResponse.json();
    const connectionsPayload = await connectionsResponse.json();
    if (!runsResponse.ok) throw new Error(runsPayload.error || "โหลดงาน AI ไม่สำเร็จ");
    if (!connectionsResponse.ok) throw new Error(connectionsPayload.error || "โหลดสถานะโมเดลไม่สำเร็จ");

    const nextRuns = (runsPayload.runs || []) as Run[];
    setRuns(nextRuns);
    setConnections(connectionsPayload.connections || []);
    setProviders(connectionsPayload.providers || []);
    setSelectedRunId((current) => {
      if (current && nextRuns.some((run) => run.id === current)) return current;
      const requested = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("run") : null;
      if (requested && nextRuns.some((run) => run.id === requested)) return requested;
      return nextRuns.find((run) => !["COMPLETED", "CANCELLED"].includes(run.status))?.id || nextRuns[0]?.id || "";
    });
  }, []);

  useEffect(() => {
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [load]);

  const selectedRun = runs.find((run) => run.id === selectedRunId) || null;
  const currentProject = selectedRun?.inputJson?.project;

  useEffect(() => {
    if (!selectedRun) return;
    const nextModelId = currentProject?.mainModelId || VIDEO_MODELS[0]?.id || "";
    const model = VIDEO_MODELS.find((item) => item.id === nextModelId) || VIDEO_MODELS[0];
    const versions = model ? getVideoModelVersions(model.name) : [];
    const currentVersion = currentProject?.mainModelVersionId || "";
    const resolvedVersion = versions.find((item) => item.apiModelId === currentVersion || item.id === currentVersion)
      || versions.find((item) => item.recommended)
      || versions[0];
    setModelId(model?.id || "");
    setVersionId(resolvedVersion?.apiModelId || "");
    setMessage("");
    setError("");
  }, [selectedRunId, selectedRun, currentProject?.mainModelId, currentProject?.mainModelVersionId]);

  const selectedModel = VIDEO_MODELS.find((item) => item.id === modelId) || null;
  const versions = selectedModel ? getVideoModelVersions(selectedModel.name) : [];

  function modelReady(id: string) {
    const providerId = providerIdForModel(id);
    const provider = providers.find((item) => item.kind === "VIDEO" && item.id === providerId);
    const connected = connections.some((item) => item.kind === "VIDEO" && item.provider === providerId && item.enabled && item.status === "CONNECTED");
    return Boolean(provider?.ready && (connected || provider.systemConfigured));
  }

  const ready = selectedModel ? modelReady(selectedModel.id) : false;
  const stopped = Boolean(selectedRun && ["FAILED", "PAUSED"].includes(selectedRun.status));
  const canPause = Boolean(selectedRun && !["FAILED", "PAUSED", "COMPLETED", "CANCELLED"].includes(selectedRun.status));

  function chooseModel(nextModelId: string) {
    setModelId(nextModelId);
    const model = VIDEO_MODELS.find((item) => item.id === nextModelId);
    const nextVersions = model ? getVideoModelVersions(model.name) : [];
    const nextVersion = nextVersions.find((item) => item.recommended) || nextVersions[0];
    setVersionId(nextVersion?.apiModelId || "");
    setMessage("");
    setError("");
  }

  async function pauseForEdit() {
    if (!selectedRun || busy || !canPause) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/agent/runs/${encodeURIComponent(selectedRun.id)}/pause`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "พักงานไม่สำเร็จ");
      setMessage("พักงานแล้ว ตอนนี้แก้ได้เฉพาะโมเดลและรุ่น รายละเอียดงานเดิมยังอยู่ครบ");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function saveModel(continueAfterSave: boolean) {
    if (!selectedRun || !stopped || !ready || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/agent/runs/${encodeURIComponent(selectedRun.id)}/model`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, modelVersionId: versionId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "บันทึกโมเดลไม่สำเร็จ");

      if (continueAfterSave) {
        const action = selectedRun.status === "FAILED" ? "retry" : "resume";
        const continueResponse = await fetch(`/api/agent/runs/${encodeURIComponent(selectedRun.id)}/${action}`, {
          method: "POST",
          credentials: "same-origin",
        });
        const continuePayload = await continueResponse.json();
        if (!continueResponse.ok) throw new Error(continuePayload.error || "บันทึกแล้ว แต่เริ่มงานต่อไม่สำเร็จ");
        setMessage("เปลี่ยนโมเดลและรุ่นแล้ว ระบบกำลังทำงานเดิมต่อจากจุดที่หยุด โดยคงรายละเอียดและ Artifact เดิมไว้");
      } else {
        setMessage("บันทึกโมเดลและรุ่นใหม่แล้ว งานยังหยุดอยู่ รายละเอียดและ Artifact เดิมไม่ถูกลบ");
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!runs.length) return null;

  return (
    <section className={styles.panel} aria-label="แก้โมเดลของงาน AI">
      <div className={styles.head}>
        <div>
          <span className={styles.eyebrow}>MODEL OVERRIDE · งานเดิม</span>
          <h2>แก้เฉพาะโมเดลและรุ่นของงานนี้</h2>
          <p>Story, ตัวละคร, ฉาก, Prompt/Artifact ที่ทำเสร็จแล้ว และความคืบหน้าเดิมจะไม่ถูกลบ</p>
        </div>
        <span className={styles.status} data-status={selectedRun?.status || ""}>{selectedRun ? statusLabel(selectedRun.status) : "—"}</span>
      </div>

      <div className={styles.body}>
        <label>
          <span>งานที่ต้องการแก้</span>
          <select value={selectedRunId} onChange={(event) => setSelectedRunId(event.target.value)} disabled={busy}>
            {runs.filter((run) => !["COMPLETED", "CANCELLED"].includes(run.status)).map((run) => (
              <option value={run.id} key={run.id}>{titleOf(run)} · {statusLabel(run.status)}</option>
            ))}
          </select>
        </label>

        <label>
          <span>โมเดลวิดีโอ</span>
          <select value={modelId} onChange={(event) => chooseModel(event.target.value)} disabled={!stopped || busy}>
            {VIDEO_MODELS.filter((model) => model.enabled).map((model) => {
              const isReady = modelReady(model.id);
              return <option key={model.id} value={model.id} disabled={!isReady}>{model.name}{isReady ? " · พร้อมใช้งาน" : " · ยังไม่พร้อมใช้งาน"}</option>;
            })}
          </select>
        </label>

        <label>
          <span>รุ่น / Version</span>
          <select value={versionId} onChange={(event) => setVersionId(event.target.value)} disabled={!stopped || !ready || busy}>
            {versions.map((version) => <option key={version.apiModelId} value={version.apiModelId}>{version.label}{version.recommended ? " · แนะนำ" : ""}</option>)}
          </select>
        </label>
      </div>

      <div className={styles.meta}>
        <span>โมเดลเดิม: <b>{VIDEO_MODELS.find((item) => item.id === currentProject?.mainModelId)?.name || currentProject?.mainModelId || "—"}</b></span>
        <span>รุ่นเดิม: <b>{currentProject?.mainModelVersionId || "Provider default"}</b></span>
        {!ready && selectedModel ? <strong>{selectedModel.name} ยังไม่พร้อมใช้งาน — เชื่อมต่อ/ทดสอบ Provider ก่อนจึงจะเลือกได้</strong> : null}
      </div>

      {message ? <div className={styles.success}>{message}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.actions}>
        {canPause ? <button type="button" className={styles.pause} disabled={busy} onClick={() => void pauseForEdit()}>{busy ? "กำลังพักงาน..." : "Ⅱ พักงานเพื่อแก้โมเดล"}</button> : null}
        {stopped ? <>
          <button type="button" disabled={busy || !ready || !versionId} onClick={() => void saveModel(false)}>บันทึกโมเดลอย่างเดียว</button>
          <button type="button" className={styles.primary} disabled={busy || !ready || !versionId} onClick={() => void saveModel(true)}>{busy ? "กำลังบันทึก..." : "บันทึกและทำงานต่อ →"}</button>
        </> : null}
        {!ready ? <Link href="/profile/api">ไปที่ API &amp; Models →</Link> : null}
      </div>
    </section>
  );
}
