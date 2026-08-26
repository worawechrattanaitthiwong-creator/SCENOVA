"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./agent-control-center.module.css";

type Run = {
  id: string; status: string; stage: string; mode: string; budgetThb: number; estimatedSpendThb: number; actualSpendThb: number;
  approvalThresholdThb: number; maxEpisodes: number; stopReason?: string | null; createdAt: string; updatedAt: string; stateJson?: Record<string, unknown>;
};
type Decision = { id: string; stage: string; action: string; reason: string; providerId?: string | null; metadata?: unknown; createdAt: string };
type Approval = { id: string; status: string; estimatedCostThb: string | number; summary: string; requestedAt: string };
type Job = { id: string; status: string; attempts: number; maxAttempts: number; lockedBy?: string | null; lastError?: string | null; createdAt: string };
type LlmUsage = { id: string; modelId: string; category: string; inputTokens: number; outputTokens: number; costThb: string | number; createdAt: string };
type Details = { run: Run; decisions: Decision[]; approvals: Approval[]; jobs: Job[]; llmUsage: LlmUsage[] };

const STAGES = ["PLAN_STORY", "SELECT_STYLE", "BUILD_PROMPTS", "AWAIT_APPROVAL", "GENERATE", "VERIFY_CONTINUITY", "NEXT_EPISODE", "COMPLETED"];

function money(value: unknown) { return Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
function time(value: string) { return new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }); }

export default function AgentControlCenter() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState<Details | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadRuns = useCallback(async () => {
    const response = await fetch("/api/agent/runs", { cache: "no-store", credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "โหลด Agent Runs ไม่สำเร็จ");
    setRuns(data.runs || []);
    setSelectedId((current) => current || data.runs?.[0]?.id || "");
  }, []);

  const loadDetails = useCallback(async (id: string) => {
    if (!id) return;
    const response = await fetch(`/api/agent/runs/${id}`, { cache: "no-store", credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "โหลด Agent Run ไม่สำเร็จ");
    setDetails(data);
  }, []);

  useEffect(() => { void loadRuns().catch((error) => setMessage(error.message)); }, [loadRuns]);
  useEffect(() => {
    if (!selectedId) return;
    void loadDetails(selectedId).catch((error) => setMessage(error.message));
    const timer = window.setInterval(() => { void loadDetails(selectedId).catch(() => undefined); void loadRuns().catch(() => undefined); }, 3000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadDetails, loadRuns]);

  async function action(name: "approve" | "reject" | "pause" | "resume" | "cancel") {
    if (!selectedId || busy) return;
    if ((name === "cancel" || name === "reject") && !window.confirm(name === "cancel" ? "ยืนยันยกเลิก Agent Run? ระบบจะพยายาม Cancel Provider Task และคืน Reservation ที่ยังไม่ settle" : "ไม่อนุมัติแผนนี้และยกเลิก Run ใช่หรือไม่?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/agent/runs/${selectedId}/${name}`, { method: "POST", credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${name} ไม่สำเร็จ`);
      setMessage(`${name.toUpperCase()} สำเร็จ`);
      await Promise.all([loadRuns(), loadDetails(selectedId)]);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  const run = details?.run;
  const currentStageIndex = run ? STAGES.indexOf(run.stage) : -1;
  const llmCost = useMemo(() => (details?.llmUsage || []).reduce((sum, item) => sum + Number(item.costThb || 0), 0), [details]);
  const pendingApproval = details?.approvals?.find((approval) => approval.status === "PENDING");

  return <main className={styles.page}>
    <header className={styles.hero}><div><span>SCENOVA · ORCHESTRATION</span><h1>AI Agent Control Center</h1><p>ติดตาม Agent Brain, Human Approval, Provider Recovery, Queue และ LLM Decision Log จากจุดเดียว</p></div><Link href="/studio">เปิด Studio →</Link></header>
    {message ? <div className={styles.message}>{message}</div> : null}

    <div className={styles.layout}>
      <aside className={styles.runList}><div className={styles.runTitle}><b>Agent Runs</b><button onClick={() => void loadRuns()}>↻</button></div>{runs.length ? runs.map((item) => <button key={item.id} className={item.id === selectedId ? styles.selected : ""} onClick={() => setSelectedId(item.id)}><span><b>{item.stage}</b><i data-status={item.status}>{item.status}</i></span><small>{time(item.createdAt)} · max {item.maxEpisodes} EP</small></button>) : <div className={styles.empty}>ยังไม่มี Agent Run<br/><Link href="/studio">เริ่มจาก Studio</Link></div>}</aside>

      <section className={styles.main}>{!run ? <div className={styles.empty}>เลือก Agent Run เพื่อดูรายละเอียด</div> : <>
        <div className={styles.statusBar}><div><small>STATUS</small><strong>{run.status}</strong></div><div><small>CURRENT STAGE</small><strong>{run.stage}</strong></div><div><small>MAX SPENDING LIMIT</small><strong>฿{money(run.budgetThb)}</strong></div><div><small>ESTIMATE / ACTUAL</small><strong>฿{money(run.estimatedSpendThb)} / ฿{money(run.actualSpendThb)}</strong></div><div><small>LLM COST</small><strong>฿{money(llmCost)}</strong></div></div>

        <div className={styles.timeline}>{STAGES.map((stage, index) => <div key={stage} className={index < currentStageIndex || run.stage === "COMPLETED" ? styles.done : index === currentStageIndex ? styles.current : ""}><i>{index < currentStageIndex || run.stage === "COMPLETED" ? "✓" : index + 1}</i><span>{stage}</span></div>)}</div>

        {pendingApproval ? <div className={styles.approval}><span>HUMAN-IN-THE-LOOP CHECKPOINT</span><h2>Agent ต้องการอนุมัติก่อนใช้ทรัพยากรต่อ</h2><p>{pendingApproval.summary}</p><strong>ประมาณ ฿{money(pendingApproval.estimatedCostThb)}</strong><small>วงเงิน Run สูงสุด ฿{money(run.budgetThb)} · Agent ไม่มีสิทธิ์เพิ่มวงเงินเอง</small><div><button disabled={busy} onClick={() => void action("approve")}>อนุมัติและดำเนินการต่อ</button><button disabled={busy} className={styles.danger} onClick={() => void action("reject")}>ไม่อนุมัติ</button></div></div> : null}

        {run.stopReason ? <div className={styles.stopReason}><b>สถานะเพิ่มเติม</b><span>{run.stopReason}</span></div> : null}
        <div className={styles.controls}>{run.status === "PAUSED" ? <button disabled={busy} onClick={() => void action("resume")}>▶ Resume</button> : !["COMPLETED","FAILED","CANCELLED","WAITING_APPROVAL"].includes(run.status) ? <button disabled={busy} onClick={() => void action("pause")}>Ⅱ Pause</button> : null}<button disabled={busy || ["COMPLETED","FAILED","CANCELLED"].includes(run.status)} className={styles.danger} onClick={() => void action("cancel")}>Cancel Run</button></div>

        <div className={styles.grid}>
          <article className={styles.panel}><div className={styles.panelTitle}><h2>Agent Decision Log</h2><span>ทำอะไร · ทำไม</span></div><div className={styles.scroll}>{details.decisions?.length ? [...details.decisions].reverse().map((item) => <div className={styles.log} key={item.id}><span><b>{item.action}</b><i>{item.stage}</i></span><p>{item.reason}</p><small>{time(item.createdAt)}{item.providerId ? ` · ${item.providerId}` : ""}</small></div>) : <p className={styles.muted}>ยังไม่มี Decision Log</p>}</div></article>
          <article className={styles.panel}><div className={styles.panelTitle}><h2>LLM Usage</h2><span>{details.llmUsage?.length || 0} calls</span></div><div className={styles.scroll}>{details.llmUsage?.length ? [...details.llmUsage].reverse().map((item) => <div className={styles.log} key={item.id}><span><b>{item.category}</b><i>{item.modelId}</i></span><p>{item.inputTokens.toLocaleString()} in · {item.outputTokens.toLocaleString()} out</p><small>฿{money(item.costThb)} · {time(item.createdAt)}</small></div>) : <p className={styles.muted}>Run นี้ยังไม่ได้เรียก LLM จริง หรือใช้ deterministic fallback</p>}</div></article>
        </div>

        <article className={styles.panel}><div className={styles.panelTitle}><h2>Queue / Worker Recovery</h2><span>{details.jobs?.length || 0} jobs</span></div><div className={styles.jobs}>{details.jobs?.slice(0,12).map((job) => <div key={job.id}><b>{job.status}</b><span>Attempt {job.attempts}/{job.maxAttempts}</span><span>{job.lockedBy || "—"}</span><small>{job.lastError || time(job.createdAt)}</small></div>)}</div></article>
      </>}</section>
    </div>
  </main>;
}
