"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { VIDEO_MODELS } from "@/lib/catalogs";
import { AGENT_RUN_SELECTION_EVENT, readSelectedAgentRunId, selectAgentRun, selectedAgentRunIdFromEvent } from "@/lib/agent/run-selection";
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
  if (status === "CANCELLED") return "ยกเลิกแล้ว";
  if (status === "COMPLETED") return "เสร็จสมบูรณ์";
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
      const requested = readSelectedAgentRunId();
      if (requested && nextRuns.some((run) => run.id === requested)) return requested;
      return nextRuns.find((run) => !["COMPLETED", "CANCELLED"].includes(run.status))?.id || nextRuns[0]?.id || "";
    });
  }, []);

  useEffect(() => {
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [load]);

  useEffect(() => {
    const syncSelection = (event: Event) => {
      const runId = selectedAgentRunIdFromEvent(event);
      if (runId) setSelectedRunId(runId);
    };
    window.addEventListener(AGENT_RUN_SELECTION_EVENT, syncSelection);
    return () => window.removeEventListener(AGENT_RUN_SELECTION_EVENT, syncSelection);
  }, []);

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
  const cancelled = selectedRun?.status === "CANCELLED";
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
      setMessage("พักงานแล้ว แก้โมเดลและรุ่นได้โดยที่รายละเอียดงานเดิมยังอยู่ครบ");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function saveModel() {
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
      setMessage("บันทึกโมเดลและรุ่นใหม่แล้ว งานยังหยุดอยู่ กด “เริ่มงาน” ที่การ์ดงานเมื่อต้องการทำต่อ");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCancelledRun() {
    if (!selectedRun || !cancelled || busy) return;
    const confirmed = window.confirm(`ลบ “${titleOf(selectedRun)}” ออกจากรายการงาน AI ถาวรใช่หรือไม่?\n\nคำสั่งนี้ลบ Run/Workflow/คิวและประวัติ Agent ของงานนี้ แต่จะไม่ลบ Project ต้นฉบับใน Studio`);
    if (!confirmed) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/agent/runs/${encodeURIComponent(selectedRun.id)}/delete`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "ลบงานไม่สำเร็จ");
      window.location.assign("/agent");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  }

  if (!runs.length) return null;

  return (
    <section className={styles.panel} id="agent-model-editor" aria-label={cancelled ? "จัดการงาน AI ที่ยกเลิก" : "แก้โมเดลของงาน AI"}>
      <div className={styles.head}>
        <div>
          <span className={styles.eyebrow}>{cancelled ? "CANCELLED JOB · งานเดิม" : "MODEL OVERRIDE · งานเดิม"}</span>
          <h2>{cancelled ? "งานที่ยกเลิก" : "แก้เฉพาะโมเดลและรุ่นของงานนี้"}</h2>
          <p>{cancelled ? "กด “เรียกกลับมา” ที่การ์ดงานด้านซ้ายเพื่อคืนงานเป็นสถานะพักไว้ งานจะยังไม่เริ่มจนกด “เริ่มงาน”" : "Story, ตัวละคร, ฉาก, Prompt/Artifact และความคืบหน้าเดิมจะไม่ถูกลบ"}</p>
        </div>
        <span className={styles.status} data-status={selectedRun?.status || ""}>{selectedRun ? statusLabel(selectedRun.status) : "—"}</span>
      </div>

      <div className={styles.body}>
        <label>
          <span>งานที่เลือก</span>
          <select value={selectedRunId} onChange={(event) => selectAgentRun(event.target.value)} disabled={busy}>
            {runs.map((run) => (
              <option value={run.id} key={run.id}>{titleOf(run)} · {statusLabel(run.status)}</option>
            ))}
          </select>
        </label>

        {!cancelled ? <>
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
        </> : null}
      </div>

      <div className={styles.meta}>
        <span>โมเดล: <b>{VIDEO_MODELS.find((item) => item.id === currentProject?.mainModelId)?.name || currentProject?.mainModelId || "—"}</b></span>
        <span>รุ่น: <b>{currentProject?.mainModelVersionId || "Provider default"}</b></span>
        {!cancelled && !ready && selectedModel ? <strong>{selectedModel.name} ยังไม่พร้อมใช้งาน — เชื่อมต่อ/ทดสอบ Provider ก่อน</strong> : null}
        {cancelled ? <strong>ข้อมูลและ Shot ที่ทำสำเร็จแล้วจะยังคงอยู่จนกว่าจะลบถาวร</strong> : null}
      </div>

      {message ? <div className={styles.success}>{message}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.actions}>
        {cancelled ? <button type="button" className={styles.danger} disabled={busy} onClick={() => void deleteCancelledRun()}>{busy ? "กำลังลบ..." : "ลบถาวร"}</button> : <>
          {canPause ? <button type="button" className={styles.pause} disabled={busy} onClick={() => void pauseForEdit()}>{busy ? "กำลังพักงาน..." : "Ⅱ พักงานเพื่อแก้โมเดล"}</button> : null}
          {stopped ? <button type="button" className={styles.primary} disabled={busy || !ready || !versionId} onClick={() => void saveModel()}>{busy ? "กำลังบันทึก..." : "บันทึกโมเดล"}</button> : null}
          {!ready ? <Link href="/profile/api">API &amp; Models →</Link> : null}
        </>}
      </div>
    </section>
  );
}
