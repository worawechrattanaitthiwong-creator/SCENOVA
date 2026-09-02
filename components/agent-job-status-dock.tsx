"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { VIDEO_MODELS } from "@/lib/catalogs";
import { AGENT_RUN_SELECTION_EVENT, readSelectedAgentRunId, selectAgentRun, selectedAgentRunIdFromEvent } from "@/lib/agent/run-selection";
import { getVideoModelVersionLabel } from "@/lib/video-model-versions";
import styles from "./agent-job-status-dock.module.css";

type Run = {
  id: string;
  status: string;
  stage: string;
  stopReason?: string | null;
  updatedAt: string;
  inputJson?: {
    project?: {
      title?: string;
      mainModelId?: string;
      mainModelVersionId?: string;
      episodes?: Array<{ title?: string }>;
    };
  };
};

type Task = {
  id: string;
  agentKey: string;
  stage: string;
  status: string;
  sequence: number;
  attempt: number;
  maxAttempts: number;
  lastError?: string | null;
};

type Job = {
  id: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

type VideoGeneration = {
  id: string;
  shotOrder: number;
  providerId: string;
  status: string;
  providerTaskId?: string | null;
  providerSubmissionCount: number;
  outputUrl?: string | null;
  errorMessage?: string | null;
};

type Details = {
  run: Run;
  jobs?: Job[];
  workflow?: { tasks?: Task[] } | null;
  videoGenerations?: VideoGeneration[];
};

type Runtime = {
  runtimeState?: string;
  message?: string;
  worker?: {
    online?: boolean;
    state?: string;
    activeLanes?: number;
    concurrency?: number;
    ageMs?: number;
    lastError?: string | null;
  } | null;
};

const PHASES = [
  { label: "วางแผนเรื่อง", detail: "Producer + Story Architect", stages: ["PLAN_STORY", "STORY_ARCHITECT"] },
  { label: "เขียนและตรวจบท", detail: "Script Writer + Editor", stages: ["SCRIPT_WRITE", "SCRIPT_EDIT"] },
  { label: "กำกับฉาก", detail: "Director + Cinematography", stages: ["DIRECT_SCENES", "PLAN_CINEMATOGRAPHY"] },
  { label: "ภาพและ Prompt", detail: "Style + Prompt Composer", stages: ["SELECT_STYLE", "BUILD_PROMPTS"] },
  { label: "Storyboard", detail: "Storyboard + Approval", stages: ["STORYBOARD", "AWAIT_APPROVAL"] },
  { label: "สร้างวิดีโอ", detail: "Render Operator", stages: ["GENERATE", "GENERATE_SHOT"] },
  { label: "ตรวจและตัดต่อ", detail: "Continuity + Post", stages: ["VERIFY_CONTINUITY", "POST_PRODUCTION"] },
  { label: "QC และส่งมอบ", detail: "Quality + Complete", stages: ["FINAL_QUALITY", "NEXT_EPISODE", "COMPLETED"] },
] as const;

const STATUS_LABELS: Record<string, string> = {
  QUEUED: "รอเริ่ม",
  RUNNING: "กำลังทำงาน",
  WAITING_APPROVAL: "รออนุมัติ",
  PAUSED: "พักไว้",
  COMPLETED: "เสร็จสมบูรณ์",
  FAILED: "ต้องตรวจสอบ",
  CANCELLED: "ยกเลิกแล้ว",
};

const AGENT_LABELS: Record<string, string> = {
  AI_PRODUCER: "AI Producer",
  STORY_ARCHITECT: "Story Architect",
  SCRIPT_WRITER: "Script Writer",
  SCRIPT_EDITOR: "Script Editor",
  AI_DIRECTOR: "AI Director",
  CINEMATOGRAPHER: "Cinematographer",
  PROMPT_COMPOSER: "Prompt Composer",
  STORYBOARD_ARTIST: "Storyboard Artist",
  RENDER_OPERATOR: "Render Operator",
  CONTINUITY_SUPERVISOR: "Continuity Supervisor",
  POST_PRODUCTION_SUPERVISOR: "Post-production",
  QUALITY_CONTROLLER: "Quality Controller",
};

function runTitle(run?: Run | null) {
  return run?.inputJson?.project?.episodes?.[0]?.title || run?.inputJson?.project?.title || "งาน AI";
}

function friendlyError(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (lower.includes("negativeprompt") && lower.includes("isn't supported")) {
    return "Veo รุ่นที่เลือกไม่รองรับ negativePrompt แบบ parameter แยก ระบบ Adapter รุ่นล่าสุดจะส่งคำสั่งหลีกเลี่ยงรวมใน Prompt หลักแทน";
  }
  if (lower.includes("numberofvideos") && lower.includes("isn't supported")) {
    return "Veo รุ่นที่เลือกกำหนดจำนวนผลลัพธ์ไว้ที่ 1 คลิปอยู่แล้ว และไม่รับ numberOfVideos แบบ explicit ระบบ Adapter รุ่นล่าสุดจะไม่ส่ง field นี้อีก";
  }
  if (lower.includes("isn't supported by this model")) {
    const field = raw.match(/['\"]([^'\"]+)['\"]/i)?.[1];
    return field ? `โมเดลที่เลือกไม่รองรับค่า ${field} ระบบหยุดไว้เพื่อไม่ให้เสียเครดิตซ้ำ` : "โมเดลที่เลือกไม่รองรับ parameter บางรายการ ระบบหยุดไว้เพื่อให้ตรวจสอบก่อนลองใหม่";
  }
  if (lower.includes("video_provider_not_found")) return "ไม่พบ Video Provider ที่ตรงกับโมเดลของงานนี้ กรุณาตรวจโมเดลและ Provider ก่อนทำต่อ";
  return raw;
}

function phaseForStage(stage?: string | null) {
  if (!stage) return -1;
  return PHASES.findIndex((phase) => phase.stages.includes(stage as never));
}

function phaseState(index: number, current: number, runStatus?: string) {
  if (runStatus === "COMPLETED") return "done";
  if (current < 0) return "pending";
  if (index < current) return "done";
  if (index > current) return "pending";
  if (runStatus === "FAILED") return "failed";
  return "active";
}

function phaseStateLabel(state: string) {
  if (state === "done") return "เสร็จแล้ว";
  if (state === "active") return "กำลังทำ";
  if (state === "failed") return "ต้องตรวจ";
  return "รอคิว";
}

function tone(status?: string) {
  if (status === "FAILED") return "failed";
  if (status === "PAUSED" || status === "WAITING_APPROVAL") return "paused";
  if (status === "RUNNING" || status === "QUEUED") return "working";
  return "idle";
}

function timeAgo(value?: string | null) {
  if (!value) return "—";
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  if (diff < 60_000) return `${Math.max(1, Math.round(diff / 1000))} วินาทีที่แล้ว`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} นาทีที่แล้ว`;
  return `${Math.round(diff / 3_600_000)} ชม.ที่แล้ว`;
}

export default function AgentJobStatusDock() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState<Details | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const loadRuns = useCallback(async () => {
    const response = await fetch("/api/agent/runs", { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "โหลดงาน AI ไม่สำเร็จ");
    const next = (payload.runs || []) as Run[];
    setRuns(next);
    setSelectedId((current) => {
      if (current && next.some((run) => run.id === current)) return current;
       const queryId = readSelectedAgentRunId();
      if (queryId && next.some((run) => run.id === queryId)) return queryId;
      return next.find((run) => !["COMPLETED", "CANCELLED"].includes(run.status))?.id || next[0]?.id || "";
    });
  }, []);

  const loadSelected = useCallback(async (id: string) => {
    if (!id) return;
    const [detailsResponse, runtimeResponse] = await Promise.all([
      fetch(`/api/agent/runs/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "same-origin" }),
      fetch(`/api/agent/runtime?run=${encodeURIComponent(id)}`, { cache: "no-store", credentials: "same-origin" }),
    ]);
    const detailsPayload = await detailsResponse.json();
    const runtimePayload = await runtimeResponse.json();
    if (!detailsResponse.ok) throw new Error(detailsPayload.error || "โหลดรายละเอียดงานไม่สำเร็จ");
    setDetails(detailsPayload);
    if (runtimeResponse.ok) setRuntime(runtimePayload);
    setError("");
  }, []);

  useEffect(() => {
    void loadRuns().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    const timer = window.setInterval(() => void loadRuns().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, [loadRuns]);

  useEffect(() => {
    if (!selectedId) return;
    void loadSelected(selectedId).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    const timer = window.setInterval(() => void loadSelected(selectedId).catch(() => undefined), 3000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadSelected]);
  useEffect(() => {
    const syncSelection = (event: Event) => {
      const runId = selectedAgentRunIdFromEvent(event);
      if (runId) setSelectedId(runId);
    };
    window.addEventListener(AGENT_RUN_SELECTION_EVENT, syncSelection);
    return () => window.removeEventListener(AGENT_RUN_SELECTION_EVENT, syncSelection);
  }, []);

  useEffect(() => {
    if (!open) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
    };
  }, [open]);

  const run = details?.run || runs.find((item) => item.id === selectedId) || null;
  const tasks = details?.workflow?.tasks || [];
  const failedTask = tasks.find((task) => task.status === "FAILED") || null;
  const activeTask = tasks.find((task) => ["RUNNING", "WAITING_REVIEW", "WAITING_USER"].includes(task.status)) || failedTask;
  const effectiveStage = failedTask?.stage || activeTask?.stage || run?.stage || "";
  const currentPhase = phaseForStage(effectiveStage);
  const completedPhases = run?.status === "COMPLETED" ? PHASES.length : Math.max(0, currentPhase);
  const progress = run?.status === "COMPLETED" ? 100 : currentPhase >= 0 ? Math.round(((completedPhases + (run?.status === "FAILED" ? 0 : .45)) / PHASES.length) * 100) : 0;
  const latestJob = details?.jobs?.[0] || null;
  const latestGeneration = [...(details?.videoGenerations || [])].reverse().find((item) => item.status !== "SETTLED") || details?.videoGenerations?.at(-1) || null;
  const latestError = failedTask?.lastError || details?.jobs?.find((job) => job.lastError)?.lastError || run?.stopReason || error;
  const model = VIDEO_MODELS.find((item) => item.id === run?.inputJson?.project?.mainModelId);
  const modelName = model?.name || run?.inputJson?.project?.mainModelId || "—";
  const versionLabel = model ? getVideoModelVersionLabel(model.name, run?.inputJson?.project?.mainModelVersionId) : run?.inputJson?.project?.mainModelVersionId || "Provider default";
  const workerLabel = runtime?.worker?.online
    ? runtime.worker.state === "working" ? "Worker Online · ทำงาน" : "Worker Online · พร้อม"
    : runtime?.worker ? "Worker Offline" : "กำลังตรวจ Worker";
  const statusText = STATUS_LABELS[run?.status || ""] || run?.status || "กำลังโหลด";

  const recentTasks = useMemo(() => [...tasks]
    .filter((task) => task.status !== "PENDING")
    .sort((a, b) => b.sequence - a.sequence)
    .slice(0, 5), [tasks]);

  if (!runs.length && !run) return null;

  return <>
    <aside className={styles.dock} data-tone={tone(run?.status)}>
      <button type="button" className={styles.dockButton} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className={styles.pulse} aria-hidden="true" />
        <span className={styles.dockCopy}>
          <b>{runTitle(run)}</b>
          <small>{statusText} · {latestGeneration ? `Generation ${latestGeneration.id.slice(0, 8)} · ${latestGeneration.status}` : currentPhase >= 0 ? PHASES[currentPhase].label : effectiveStage || "กำลังอ่านสถานะ"}</small>
        </span>
        <span className={styles.dockProgress}>{progress}% <span aria-hidden="true">›</span></span>
      </button>
      <div className={styles.progressTrack} aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
    </aside>

    {open ? <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label={`สถานะงาน ${runTitle(run)}`}>
        <header className={styles.modalHeader}>
          <div>
            <span className={styles.eyebrow}>LIVE JOB MAP · SCENOVA AGENT</span>
            <h2>{runTitle(run)}</h2>
            <p>แผนผังนี้อ่านสถานะ Run, Workflow Task, Queue และ Worker จริงจากงานนี้ และรีเฟรชอัตโนมัติทุก 3 วินาที</p>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.statusChip} data-status={run?.status || ""}>{statusText}</span>
            <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="ปิดสถานะงาน">×</button>
          </div>
        </header>

        <div className={styles.body}>
          <div className={styles.toolbar}>
            <label className={styles.jobSelect}>
              <span>งานที่กำลังดู</span>
              <select value={selectedId} onChange={(event) => selectAgentRun(event.target.value)}>
                {runs.map((item) => <option key={item.id} value={item.id}>{runTitle(item)} · {STATUS_LABELS[item.status] || item.status}</option>)}
              </select>
            </label>
            <div className={styles.metric}><span>โมเดล</span><b>{modelName}</b><small>{versionLabel}</small></div>
            <div className={styles.metric}><span>Agent ปัจจุบัน</span><b>{activeTask ? AGENT_LABELS[activeTask.agentKey] || activeTask.agentKey : "—"}</b><small>{effectiveStage || "รอเริ่ม"}</small></div>
            <div className={styles.metric}><span>Queue / Retry</span><b>{latestJob ? `${latestJob.status} · ${latestJob.attempts}/${latestJob.maxAttempts}` : "ไม่มี Active Job"}</b><small>{latestJob?.createdAt ? timeAgo(latestJob.createdAt) : "—"}</small></div>
            <div className={styles.metric}><span>Worker</span><b>{workerLabel}</b><small>{runtime?.worker?.concurrency ? `${runtime.worker.activeLanes || 0}/${runtime.worker.concurrency} lanes` : runtime?.message || "—"}</small></div>
            <div className={styles.metric}><span>Generation ID</span><b>{latestGeneration ? latestGeneration.id.slice(0, 12) : "ยังไม่ส่ง Provider"}</b><small>{latestGeneration ? `${latestGeneration.providerId.toUpperCase()} · ${latestGeneration.status} · ส่ง ${latestGeneration.providerSubmissionCount}/1` : "Precheck / รอคิว"}</small></div>
          </div>

          <section className={styles.flowPanel}>
            <div className={styles.flowHead}>
              <div><h3>เส้นทางการผลิตของงานนี้</h3><p>ไล่จากวางเรื่อง → Prompt → Render → QC โดยคงรายละเอียดและ Artifact ที่ผ่านแล้ว</p></div>
              <strong>ความคืบหน้า {progress}%</strong>
            </div>
            <div className={styles.flow}>
              {PHASES.map((phase, index) => {
                const state = phaseState(index, currentPhase, run?.status);
                return <div className={styles.phase} data-state={state} key={phase.label}>
                  <span className={styles.phaseIndex}>{state === "done" ? "✓" : index + 1}</span>
                  <span className={styles.phaseState}>{phaseStateLabel(state)}</span>
                  <b>{phase.label}</b>
                  <small>{phase.detail}</small>
                </div>;
              })}
            </div>
          </section>

          <div className={styles.detailGrid}>
            <section className={`${styles.detailCard} ${latestError ? styles.errorBox : ""}`}>
              <h4>{latestError ? "สาเหตุที่งานหยุด / ต้องตรวจ" : "สถานะล่าสุด"}</h4>
              {latestError ? <><strong>{activeTask ? AGENT_LABELS[activeTask.agentKey] || activeTask.agentKey : "ระบบสร้างวิดีโอ"}</strong><p>{friendlyError(latestError)}</p></> : <p>{runtime?.message || `ระบบกำลังอยู่ที่ขั้น ${effectiveStage || "รอเริ่ม"}`}</p>}
            </section>
            <section className={styles.detailCard}>
              <h4>กิจกรรมล่าสุดของทีม AI</h4>
              <div className={styles.timeline}>
                {recentTasks.length ? recentTasks.map((task) => <div className={styles.timelineRow} data-status={task.status} key={task.id}>
                  <span className={styles.timelineDot} aria-hidden="true" />
                  <span><b>{AGENT_LABELS[task.agentKey] || task.agentKey}</b><small>{task.stage}</small></span>
                  <em>{task.status}</em>
                </div>) : <p>ยังไม่มี Task ที่เริ่มทำงาน</p>}
              </div>
            </section>
          </div>

          <footer className={styles.footer}>
            <small>อัปเดตล่าสุด {timeAgo(run?.updatedAt)} · Popup นี้เป็นมุมมองสถานะ ไม่เปลี่ยน Workflow หรือเครดิตของงาน</small>
            <div className={styles.footerActions}>
              <button type="button" onClick={() => selectedId && void loadSelected(selectedId)}>↻ รีเฟรช</button>
              <button type="button" className={styles.primary} onClick={() => { setOpen(false); window.setTimeout(() => document.getElementById("runs")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}>ไปยังรายละเอียดงาน</button>
            </div>
          </footer>
        </div>
      </section>
    </div> : null}
  </>;
}
