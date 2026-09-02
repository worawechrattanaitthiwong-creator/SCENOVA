"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AGENT_RUN_SELECTION_EVENT, readSelectedAgentRunId, selectAgentRun, selectedAgentRunIdFromEvent } from "@/lib/agent/run-selection";
import styles from "./agent-control-center.module.css";
import teamStyles from "./agent-team-workflow.module.css";

type Run = {
  id: string; status: string; stage: string; mode: string; budgetThb: number; estimatedSpendThb: number; actualSpendThb: number;
  approvalThresholdThb: number; maxEpisodes: number; stopReason?: string | null; createdAt: string; updatedAt: string; stateJson?: Record<string, unknown>;
  inputJson?: { project?: { title?: string; episodes?: Array<{ title?: string }> } };
};
type Decision = { id: string; stage: string; action: string; reason: string; providerId?: string | null; metadata?: unknown; createdAt: string };
type Approval = { id: string; status: string; estimatedCostThb: string | number; summary: string; requestedAt: string };
type Job = { id: string; status: string; attempts: number; maxAttempts: number; lockedBy?: string | null; lastError?: string | null; createdAt: string };
type LlmUsage = { id: string; modelId: string; category: string; inputTokens: number; outputTokens: number; costThb: string | number; createdAt: string };
type AgentTask = { id: string; agentKey: string; stage: string; scopeKey: string; status: string; sequence: number; attempt: number; maxAttempts: number; lastError?: string | null };
type AgentArtifact = { id: string; taskId: string; type: string; version: number; status: string; summary: string; createdAt: string };
type AgentHandoff = { id: string; fromTaskId: string; toTaskId: string; status: string; createdAt: string };
type HumanCheckpoint = { id: string; kind: string; status: string; summary: string; requestedAt: string };
type Workflow = { id: string; status: string; workflowKey: string; version: number; tasks: AgentTask[]; artifacts: AgentArtifact[]; handoffs: AgentHandoff[]; checkpoints: HumanCheckpoint[] };
type VideoGeneration = {
  id: string;
  shotOrder: number;
  providerId: string;
  status: string;
  outputUrl?: string | null;
};
type Details = { run: Run; decisions: Decision[]; approvals: Approval[]; jobs: Job[]; llmUsage: LlmUsage[]; videoGenerations?: VideoGeneration[]; workflow?: Workflow | null };

const STAGES = ["PLAN_STORY", "STORY_ARCHITECT", "SCRIPT_WRITE", "SCRIPT_EDIT", "DIRECT_SCENES", "PLAN_CINEMATOGRAPHY", "SELECT_STYLE", "BUILD_PROMPTS", "STORYBOARD", "AWAIT_APPROVAL", "GENERATE", "VERIFY_CONTINUITY", "POST_PRODUCTION", "FINAL_QUALITY", "NEXT_EPISODE", "COMPLETED"];
const STAGE_LABELS: Record<string, string> = {
  PLAN_STORY: "Producer วางแผน",
  STORY_ARCHITECT: "วางโครงเรื่อง",
  SCRIPT_WRITE: "เขียนบท",
  SCRIPT_EDIT: "ตรวจบท",
  DIRECT_SCENES: "กำกับฉาก",
  PLAN_CINEMATOGRAPHY: "ออกแบบภาพ",
  SELECT_STYLE: "เลือกแนวภาพ",
  BUILD_PROMPTS: "เตรียม Prompt",
  STORYBOARD: "Storyboard",
  AWAIT_APPROVAL: "รออนุมัติ",
  GENERATE: "กำลังสร้าง",
  GENERATE_SHOT: "เรนเดอร์ Shot",
  VERIFY_CONTINUITY: "ตรวจความต่อเนื่อง",
  POST_PRODUCTION: "หลังการผลิต",
  FINAL_QUALITY: "ตรวจคุณภาพ",
  NEXT_EPISODE: "เตรียมตอนถัดไป",
  COMPLETED: "เสร็จสมบูรณ์",
};
const STATUS_LABELS: Record<string, string> = {
  QUEUED: "รอเริ่ม",
  RUNNING: "กำลังทำงาน",
  WAITING_APPROVAL: "รออนุมัติ",
  PAUSED: "พักไว้",
  COMPLETED: "เสร็จแล้ว",
  FAILED: "ต้องตรวจสอบ",
  CANCELLED: "ยกเลิกแล้ว",
  PENDING: "รอข้อมูลต้นทาง",
  READY: "พร้อมรับงาน",
  WAITING_REVIEW: "รอตรวจ",
  WAITING_USER: "รอผู้ใช้",
  RETURNED: "ส่งกลับแก้",
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

function money(value: unknown) { return Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
function time(value: string) { return new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }); }
function stageLabel(value: string) { return STAGE_LABELS[value] || value; }
function statusLabel(value: string) { return STATUS_LABELS[value] || value; }
function runTitle(run: Run) { return run.inputJson?.project?.episodes?.[0]?.title || run.inputJson?.project?.title || "งาน AI"; }
function friendlyAgentError(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  const target = raw.includes(":") ? raw.split(":").slice(1).join(":").trim() : "โมเดลวิดีโอที่เลือก";
  if (upper.includes("VEO_HTTP_429") || upper.includes("RESOURCE_EXHAUSTED") || upper.includes("EXCEEDED YOUR CURRENT QUOTA")) {
    return "Veo ตอบ HTTP 429 ซึ่งอาจเป็น Rate Limit, Model Quota หรือ Spend Limit ไม่ได้แปลว่ายอดเงินคงเหลือหมดเสมอไป ระบบหยุด Retry อัตโนมัติเพื่อไม่ยิงงานซ้ำ ให้ตรวจ Rate Limit แล้วกด “เริ่มงาน” ที่การ์ดงานด้านซ้ายเมื่อต้องการลองอีกครั้ง";
  }
  if (upper.startsWith("VIDEO_PROVIDER_NOT_FOUND")) {
    return target.toLowerCase().includes("seedance")
      ? `รอบก่อนระบบจับคู่ชื่อ ${target} กับ Seedance Provider ไม่สำเร็จ จุดนี้แก้แล้ว สามารถกด “เริ่มงาน” ที่การ์ดงานเพื่อทำต่อได้`
      : `ไม่พบ Video Provider ที่ตรงกับ ${target}`;
  }
  if (upper.startsWith("VIDEO_PROVIDER_CONNECTION_REQUIRED") || upper.startsWith("PROVIDER_CONNECTION_REQUIRED")) {
    return `ยังไม่มี Video Provider ที่เชื่อมต่อพร้อมใช้สำหรับ ${target} กรุณาตรวจ API & Models ก่อนเริ่มอีกครั้ง`;
  }
  if (upper.includes("INVALID_API_KEY") || upper.includes("CREDENTIAL_REQUIRED")) {
    return "Credential ของ Video Provider ยังไม่พร้อมใช้งาน กรุณาทดสอบการเชื่อมต่อใน API & Models";
  }
  if (upper === "SUPERSEDED_BY_USER_RETRY") return "คิวเดิมถูกแทนที่ด้วยการเริ่มงานใหม่แล้ว";
  return raw;
}

function isQuotaError(value?: string | null) {
  return /VEO_HTTP_429|RESOURCE_EXHAUSTED|EXCEEDED YOUR CURRENT QUOTA|RATE.?LIMIT|MODEL QUOTA|SPEND LIMIT/i.test(String(value || ""));
}

function needsProviderSettings(value?: string | null) {
  return /PROVIDER_(NOT_FOUND|CONNECTION_REQUIRED)|INVALID_API_KEY|CREDENTIAL_REQUIRED/i.test(String(value || ""));
}

function runCardActionState(run: Run) {
  if (run.status === "CANCELLED") return { label: "ลบ", kind: "delete", enabled: true };
  if (["FAILED", "PAUSED"].includes(run.status)) return { label: "▶ เริ่มงาน", kind: "start", enabled: true };
  if (["QUEUED", "RUNNING"].includes(run.status)) return { label: "กำลังทำงาน", kind: "active", enabled: false };
  if (run.status === "WAITING_APPROVAL") return { label: "รออนุมัติ", kind: "waiting", enabled: false };
  if (run.status === "COMPLETED") return { label: "เสร็จแล้ว", kind: "done", enabled: false };
  return { label: "เริ่มงาน", kind: "start", enabled: false };
}

export default function AgentControlCenter() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState<Details | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadRuns = useCallback(async () => {
    const response = await fetch("/api/agent/runs", { cache: "no-store", credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "โหลดงาน AI ไม่สำเร็จ");
    setRuns(data.runs || []);
    setSelectedId((current) => {
      if (current) return current;
      const requestedId = readSelectedAgentRunId();
      return data.runs?.some((run: Run) => run.id === requestedId) ? requestedId || "" : data.runs?.[0]?.id || "";
    });
  }, []);

  const loadDetails = useCallback(async (id: string) => {
    if (!id) return;
    const response = await fetch(`/api/agent/runs/${id}`, { cache: "no-store", credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "โหลดรายละเอียดงาน AI ไม่สำเร็จ");
    setDetails(data);
  }, []);

  useEffect(() => { void loadRuns().catch((error) => setMessage(error.message)); }, [loadRuns]);
  useEffect(() => {
    const syncSelection = (event: Event) => {
      const runId = selectedAgentRunIdFromEvent(event);
      if (runId) setSelectedId(runId);
    };
    window.addEventListener(AGENT_RUN_SELECTION_EVENT, syncSelection);
    return () => window.removeEventListener(AGENT_RUN_SELECTION_EVENT, syncSelection);
  }, []);
  useEffect(() => {
    if (selectedId) selectAgentRun(selectedId);
  }, [selectedId]);
  useEffect(() => {
    if (!selectedId) { setDetails(null); return; }
    void loadDetails(selectedId).catch((error) => setMessage(error.message));
    const timer = window.setInterval(() => { void loadDetails(selectedId).catch(() => undefined); void loadRuns().catch(() => undefined); }, 3000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadDetails, loadRuns]);

  async function action(name: "approve" | "reject" | "pause" | "resume" | "retry" | "cancel" | "accept-continuity") {
    if (!selectedId || busy) return;
    if ((name === "cancel" || name === "reject") && !window.confirm(name === "cancel" ? "ยืนยันยกเลิกงาน AI นี้? งานที่ยังไม่คิดเงินจริงจะถูกพยายามคืนเครดิตตามสถานะจริง" : "ไม่อนุมัติแผนนี้และยกเลิกงานใช่หรือไม่?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/agent/runs/${selectedId}/${name}`, { method: "POST", credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${name} ไม่สำเร็จ`);
      setMessage(name === "approve" ? "อนุมัติแล้ว ระบบจะทำงานต่อ" : name === "reject" ? "ไม่อนุมัติและหยุดงานแล้ว" : name === "pause" ? "พักงานแล้ว" : name === "resume" ? "เริ่มทำงานต่อแล้ว" : name === "retry" ? "นำขั้นที่ล้มเหลวของงานที่เลือกกลับเข้าคิวแล้ว" : name === "accept-continuity" ? "ยืนยัน Continuity แล้ว ระบบทำ Post-production ต่อ" : "ยกเลิกงานแล้ว");
      await Promise.all([loadRuns(), loadDetails(selectedId)]);
    } catch (error) { setMessage(error instanceof Error ? friendlyAgentError(error.message) : String(error)); }
    finally { setBusy(false); }
  }

  async function runCardAction(item: Run) {
    const state = runCardActionState(item);
    if (!state.enabled || busy) return;
    setSelectedId(item.id);
    selectAgentRun(item.id);
    setBusy(true);
    setMessage("");
    try {
      if (item.status === "CANCELLED") {
        if (!window.confirm("ลบงานที่ยกเลิกนี้ออกจากรายการถาวรใช่หรือไม่?")) return;
        const response = await fetch(`/api/agent/runs/${encodeURIComponent(item.id)}/delete`, { method: "POST", credentials: "same-origin" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "ลบงานที่ยกเลิกไม่สำเร็จ");
        const remaining = runs.filter((runItem) => runItem.id !== item.id);
        const next = remaining[0] || null;
        setRuns(remaining);
        setDetails(null);
        setSelectedId(next?.id || "");
        if (next) selectAgentRun(next.id);
        setMessage("ลบงานที่ยกเลิกออกจากรายการแล้ว");
        if (next) await loadDetails(next.id);
        return;
      } else {
        let command: "retry" | "resume" = item.status === "FAILED" ? "retry" : "resume";
        if (item.status === "PAUSED") {
          const detailResponse = await fetch(`/api/agent/runs/${encodeURIComponent(item.id)}`, { cache: "no-store", credentials: "same-origin" });
          const detailPayload = await detailResponse.json() as Details & { error?: string };
          if (!detailResponse.ok) throw new Error(detailPayload.error || "ตรวจสถานะงานไม่สำเร็จ");
          const tasks = detailPayload.workflow?.tasks || [];
          const hasFailedTask = tasks.some((task) => task.status === "FAILED" || Boolean(task.lastError));
          command = hasFailedTask ? "retry" : "resume";
        }
        const response = await fetch(`/api/agent/runs/${encodeURIComponent(item.id)}/${command}`, { method: "POST", credentials: "same-origin" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "เริ่มงานไม่สำเร็จ");
        setMessage("เริ่มงานแล้ว ระบบทำต่อจากจุดเดิมโดยคงงานและ Artifact ที่สำเร็จไว้");
      }
      await Promise.all([loadRuns(), loadDetails(item.id)]);
    } catch (error) {
      setMessage(error instanceof Error ? friendlyAgentError(error.message) : String(error));
    } finally {
      setBusy(false);
    }
  }

  const run = details?.run;
  const currentStageIndex = run ? STAGES.indexOf(run.stage) : -1;
  const llmCost = useMemo(() => (details?.llmUsage || []).reduce((sum, item) => sum + Number(item.costThb || 0), 0), [details]);
  const pendingApproval = details?.approvals?.find((approval) => approval.status === "PENDING");
  const workflowTasks = details?.workflow?.tasks || [];
  const primaryTasks = workflowTasks.filter((task) => task.stage !== "GENERATE_SHOT");
  const shotTasks = workflowTasks.filter((task) => task.stage === "GENERATE_SHOT");
  const workflowArtifacts = details?.workflow?.artifacts || [];
  const latestJobError = details?.jobs?.find((job) => job.lastError)?.lastError || null;
  const failedWorkflowTask = [...workflowTasks].reverse().find((task) => task.lastError) || workflowTasks.find((task) => task.status === "FAILED") || null;
  const rootError = failedWorkflowTask?.lastError || latestJobError || run?.stopReason || "";
  const stopMessage = friendlyAgentError(rootError);
  const completedShots = shotTasks.filter((task) => task.status === "COMPLETED").length;
  const completedClips = (details?.videoGenerations || []).filter((generation) => Boolean(generation.outputUrl));
  const pendingShot = shotTasks.find((task) => task.status !== "COMPLETED");
  const pendingShotNumber = pendingShot?.scopeKey.split(":").at(-1);
  const recoveryAgent = failedWorkflowTask ? AGENT_LABELS[failedWorkflowTask.agentKey] || failedWorkflowTask.agentKey : stageLabel(run?.stage || "");
  const cancelledAfterFailure = run?.status === "CANCELLED" && Boolean(failedWorkflowTask?.lastError);
  const showRecovery = Boolean(run && (rootError || ["FAILED", "PAUSED", "CANCELLED"].includes(run.status)));

  return <main className={styles.page}>
    <header className={styles.hero}><div><span>SCENOVA AI AGENT</span><h1>AI Agent — ศูนย์ควบคุมงานอัตโนมัติ</h1><p>ดูงานที่ AI กำลังทำ ตรวจจุดที่ต้องอนุมัติ ติดตามค่าใช้จ่าย และไปต่อยังคิวสร้างวิดีโอได้จากหน้าเดียว</p></div><Link href="/studio">เริ่มงานใน Studio →</Link></header>

    <section className={styles.quickFlow} aria-label="ทางลัด AI Agent">
      <Link href="/studio"><i>01</i><span><b>สร้างงาน</b><small>กำหนดเรื่อง ตัวละคร และฉากใน Studio</small></span><strong>→</strong></Link>
      <Link href="/libraries?tab=characters"><i>02</i><span><b>เลือกตัวละครและเสียง</b><small>ใช้ Asset Library เพื่อรักษาความต่อเนื่อง</small></span><strong>→</strong></Link>
      <Link href="/wallet"><i>03</i><span><b>เช็กเครดิต</b><small>ดูยอดพร้อมใช้และประวัติการใช้เครดิต</small></span><strong>→</strong></Link>
      <Link href="/render"><i>04</i><span><b>ดูคิวสร้างวิดีโอ</b><small>ติดตามงานที่กำลังสร้างและผลลัพธ์</small></span><strong>→</strong></Link>
    </section>

    {message ? <div className={styles.message}>{message}</div> : null}

    <div className={styles.layout} id="runs">
      <aside className={styles.runList}>
        <div className={styles.runTitle}><div><b>งาน AI</b><small>{runs.length} รายการ</small></div><button onClick={() => void loadRuns()} aria-label="รีเฟรชงาน AI">↻</button></div>
        {runs.length ? runs.map((item) => {
          const cardAction = runCardActionState(item);
          return <div key={item.id} className={`sc-run-card${item.id === selectedId ? " is-selected" : ""}`}>
            <button type="button" className="sc-run-card-main" onClick={() => selectAgentRun(item.id)}>
              <span><b>{runTitle(item)}</b><i data-status={item.status}>{statusLabel(item.status)}</i></span>
              <small>{stageLabel(item.stage)} · {time(item.createdAt)}</small>
            </button>
            <button type="button" className="sc-run-card-action" data-kind={cardAction.kind} disabled={busy || !cardAction.enabled} onClick={() => void runCardAction(item)}>{busy && item.id === selectedId ? "กำลัง..." : cardAction.label}</button>
          </div>;
        }) : <div className={styles.emptyState}><span>✦</span><h2>ยังไม่มีงาน AI</h2><p>เริ่มสร้างงานจาก Studio ก่อน เมื่อมี Agent Run งานจะมาแสดงที่นี่อัตโนมัติ</p><Link href="/studio">เปิด Studio</Link></div>}
      </aside>

      <section className={styles.main}>{!run ? <div className={styles.welcomePanel}><span>AI AGENT WORKSPACE</span><h2>เลือกงาน AI เพื่อดูรายละเอียด</h2><p>เมื่อมีงาน ระบบจะแสดงขั้นตอน ค่าใช้จ่าย จุดรออนุมัติ และสถานะคิวแบบอัปเดตต่อเนื่อง</p><div><Link href="/studio">เริ่มจาก Studio</Link><Link href="/wallet">ดูเครดิต</Link></div></div> : <>
        <div className={styles.statusBar}><div><small>สถานะ</small><strong>{statusLabel(run.status)}</strong></div><div><small>ขั้นตอนปัจจุบัน</small><strong>{stageLabel(run.stage)}</strong></div><div><small>วงเงินสูงสุด</small><strong>฿{money(run.budgetThb)}</strong></div><div><small>คาดการณ์ / ใช้จริง</small><strong>฿{money(run.estimatedSpendThb)} / ฿{money(run.actualSpendThb)}</strong></div><div><small>ค่า AI วางแผน</small><strong>฿{money(llmCost)}</strong></div></div>

        {showRecovery ? <section className={styles.recovery} data-tone={isQuotaError(rootError) ? "quota" : run.status === "CANCELLED" ? "cancelled" : "error"}>
          <div className={styles.recoveryIcon} aria-hidden="true">{isQuotaError(rootError) ? "429" : run.status === "CANCELLED" ? "×" : "!"}</div>
          <div className={styles.recoveryBody}>
            <span>RECOVERY CENTER · {recoveryAgent || "AI Runtime"}</span>
            <h2>{cancelledAfterFailure ? "งานถูกยกเลิกหลัง Render Operator หยุด" : isQuotaError(rootError) ? "Google Veo จำกัดคำขอของ Render Operator" : `${recoveryAgent || "งานนี้"} ต้องการการตรวจสอบ`}</h2>
            <p>{isQuotaError(rootError) ? `${completedShots} จาก ${shotTasks.length || "ทั้งหมด"} Shot ทำสำเร็จแล้ว แต่คำขอถัดไปได้รับ HTTP 429 ระบบหยุดไว้เพื่อไม่ส่งคำขอซ้ำและไม่เสี่ยงคิดค่าใช้จ่ายซ้ำ${run.status === "CANCELLED" ? " จากนั้นงานนี้ถูกยกเลิก จึงไม่ส่งต่อไปยัง Agent ตัวถัดไป" : ""}` : stopMessage || "ตรวจสาเหตุและเลือกวิธีดำเนินการต่อด้านล่าง"}</p>
            <div className={styles.recoveryFacts}>
              <span><small>จุดที่หยุด</small><b>{recoveryAgent || stageLabel(run.stage)}</b></span>
              <span><small>Render shots</small><b>{shotTasks.length ? `${completedShots}/${shotTasks.length} สำเร็จ` : "ยังไม่มี Shot"}</b></span>
              <span><small>งานถัดไป</small><b>{pendingShotNumber ? `Shot ${Number(pendingShotNumber) + 1}` : stageLabel(run.stage)}</b></span>
            </div>
          </div>
          <div className={styles.recoveryActions}>
            {run.status === "PAUSED" && run.stage === "VERIFY_CONTINUITY" ? <button type="button" className={styles.primaryAction} disabled={busy} onClick={() => void action("accept-continuity")}>ยืนยันผลตรวจและทำต่อ</button> : null}
            <button type="button" className={styles.secondaryAction} onClick={() => document.getElementById("agent-model-editor")?.scrollIntoView({ behavior: "smooth", block: "center" })}>เปลี่ยนโมเดล / รุ่น</button>
            {needsProviderSettings(rootError) || isQuotaError(rootError) ? <Link className={styles.secondaryAction} href="/profile/api">ตรวจ API &amp; Models</Link> : null}
          </div>
        </section> : null}

        <div className={styles.timeline}>{STAGES.map((stage, index) => <div key={stage} className={index < currentStageIndex || run.stage === "COMPLETED" ? styles.done : index === currentStageIndex ? styles.current : ""}><i>{index < currentStageIndex || run.stage === "COMPLETED" ? "✓" : index + 1}</i><span>{stageLabel(stage)}</span></div>)}</div>

        {completedClips.length ? <section className={styles.clipResults} aria-label="คลิปที่สร้างเสร็จแล้ว">
          <div className={styles.clipResultsTitle}>
            <div><span>VIDEO OUTPUT</span><h2>คลิปที่สร้างแล้ว</h2><p>ผลลัพธ์จริงจากงานนี้ เปิดดูหรือดาวน์โหลดได้ทันที</p></div>
            <strong>{completedClips.length} คลิป</strong>
          </div>
          <div className={styles.clipGrid}>{completedClips.map((clip) => <article className={styles.clipCard} key={clip.id}>
            <video controls preload="metadata" src={clip.outputUrl || undefined}>เบราว์เซอร์นี้ไม่รองรับการเล่นวิดีโอ</video>
            <div className={styles.clipMeta}>
              <span><b>Shot {clip.shotOrder + 1}</b><small>{clip.providerId.toUpperCase()} · {clip.status}</small></span>
              <div>
                <a href={clip.outputUrl || "#"} target="_blank" rel="noreferrer">เปิดคลิป</a>
                <a href={clip.outputUrl || "#"} download={`scenova-shot-${clip.shotOrder + 1}.mp4`}>ดาวน์โหลด</a>
              </div>
            </div>
          </article>)}</div>
        </section> : null}

        {details.workflow ? <article className={teamStyles.teamPanel}>
          <div className={teamStyles.panelTitle}><div><h2>ทีมผลิตภาพยนตร์ AI</h2><p>แต่ละฝ่ายรับ Artifact จากงานก่อนหน้า ตรวจตามหน้าที่ แล้วส่งต่อผ่าน Handoff ที่ตรวจสอบย้อนหลังได้</p></div><span>{workflowArtifacts.length} Artifacts · {details.workflow.handoffs.length} Handoffs</span></div>
          <div className={teamStyles.agentGrid}>{primaryTasks.map((task) => {
            const artifacts = workflowArtifacts.filter((artifact) => artifact.taskId === task.id);
            const latest = artifacts.at(-1);
            return <div key={task.id} className={teamStyles.agentCard} data-state={task.status} data-error={Boolean(task.lastError)}>
              <div><i>{task.sequence.toString().padStart(2, "0")}</i><span><b>{AGENT_LABELS[task.agentKey] || task.agentKey}</b><small>{stageLabel(task.stage)}</small></span><em>{statusLabel(task.status)}</em></div>
              <p>{task.lastError ? friendlyAgentError(task.lastError) : latest?.summary || (task.status === "PENDING" ? "รอรับ Artifact จาก Agent ก่อนหน้า" : "เตรียมดำเนินงานตามสัญญาส่งมอบ")}</p>
              <footer><span>{latest ? `${artifacts.length} Artifact · v${latest.version}` : "ยังไม่มี Artifact"}</span><span>{task.attempt ? `ทำงาน ${task.attempt}/${task.maxAttempts}` : "ยังไม่เริ่ม"}</span></footer>
            </div>;
          })}</div>
          {shotTasks.length ? <div className={teamStyles.shotRail}><div><b>Render Shot Tasks</b><span>{completedShots}/{shotTasks.length} สำเร็จ</span></div><div>{shotTasks.map((task) => <span key={task.id} data-state={task.status} title={`${task.scopeKey} · ${statusLabel(task.status)}`}><i>{task.status === "COMPLETED" ? "✓" : Number(task.scopeKey.split(":").at(-1) || 0) + 1}</i><b>Shot {Number(task.scopeKey.split(":").at(-1) || 0) + 1}</b><small>{statusLabel(task.status)}</small></span>)}</div></div> : null}
        </article> : null}

        {pendingApproval ? <div className={styles.approval} id="approvals"><span>ต้องการการอนุมัติจากคุณ</span><h2>AI พร้อมทำขั้นตอนถัดไป แต่จะยังไม่ใช้ทรัพยากรจนกว่าคุณจะอนุมัติ</h2><p>{pendingApproval.summary}</p><strong>ประมาณ ฿{money(pendingApproval.estimatedCostThb)}</strong><small>วงเงินงานสูงสุด ฿{money(run.budgetThb)} · AI ไม่สามารถเพิ่มวงเงินเองได้</small><div><button disabled={busy} onClick={() => void action("approve")}>อนุมัติและทำต่อ</button><button disabled={busy} className={styles.danger} onClick={() => void action("reject")}>ไม่อนุมัติ</button></div></div> : <div id="approvals" />}

        {stopMessage && !showRecovery ? <div className={styles.stopReason}><b>ข้อมูลเพิ่มเติม</b><span>{stopMessage}</span>{needsProviderSettings(rootError) ? <Link href="/profile/api">ตรวจ API & Models →</Link> : null}</div> : null}
        <div className={styles.controls}>
          {!["PAUSED","FAILED","COMPLETED","CANCELLED","WAITING_APPROVAL"].includes(run.status) ? <button disabled={busy} onClick={() => void action("pause")}>Ⅱ พักงาน</button> : null}
          {run.status === "CANCELLED" ? <button disabled={busy} className={styles.danger} onClick={() => void runCardAction(run)}>ลบงานนี้</button> : <button disabled={busy || ["COMPLETED","FAILED"].includes(run.status)} className={styles.danger} onClick={() => void action("cancel")}>ยกเลิกงาน</button>}
        </div>

        <div className={styles.grid}>
          <article className={styles.panel}><div className={styles.panelTitle}><h2>บันทึกการตัดสินใจของ AI</h2><span>ทำอะไร · เพราะอะไร</span></div><div className={styles.scroll}>{details.decisions?.length ? [...details.decisions].reverse().map((item) => <div className={styles.log} key={item.id}><span><b>{item.action}</b><i>{stageLabel(item.stage)}</i></span><p>{item.reason}</p><small>{time(item.createdAt)}{item.providerId ? ` · ${item.providerId}` : ""}</small></div>) : <p className={styles.muted}>ยังไม่มีบันทึกการตัดสินใจ</p>}</div></article>
          <article className={styles.panel}><div className={styles.panelTitle}><h2>การใช้ AI วางแผน</h2><span>{details.llmUsage?.length || 0} ครั้ง</span></div><div className={styles.scroll}>{details.llmUsage?.length ? [...details.llmUsage].reverse().map((item) => <div className={styles.log} key={item.id}><span><b>{item.category}</b><i>{item.modelId}</i></span><p>{item.inputTokens.toLocaleString()} input · {item.outputTokens.toLocaleString()} output</p><small>฿{money(item.costThb)} · {time(item.createdAt)}</small></div>) : <p className={styles.muted}>งานนี้ยังไม่มีค่าใช้ AI วางแผนที่บันทึกไว้</p>}</div></article>
        </div>

        <article className={styles.panel}><div className={styles.panelTitle}><h2>คิวงานและการกู้คืน</h2><span>{details.jobs?.length || 0} งานย่อย</span></div><div className={styles.jobs}>{details.jobs?.slice(0,12).map((job) => <div key={job.id}><b>{statusLabel(job.status)}</b><span>ลอง {job.attempts}/{job.maxAttempts}</span><span>{job.lockedBy ? "กำลังประมวลผล" : "พร้อม"}</span><small>{job.lastError ? friendlyAgentError(job.lastError) : time(job.createdAt)}</small></div>)}</div></article>
      </>}</section>
    </div>
  </main>;
}
