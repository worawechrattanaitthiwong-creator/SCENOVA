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
const STAGE_LABELS: Record<string, string> = {
  PLAN_STORY: "วางแผนเรื่อง",
  SELECT_STYLE: "เลือกแนวภาพ",
  BUILD_PROMPTS: "เตรียม Prompt",
  AWAIT_APPROVAL: "รออนุมัติ",
  GENERATE: "กำลังสร้าง",
  VERIFY_CONTINUITY: "ตรวจความต่อเนื่อง",
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
};

function money(value: unknown) { return Number(value || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
function time(value: string) { return new Date(value).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }); }
function stageLabel(value: string) { return STAGE_LABELS[value] || value; }
function statusLabel(value: string) { return STATUS_LABELS[value] || value; }

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
    setSelectedId((current) => current || data.runs?.[0]?.id || "");
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
    if (!selectedId) { setDetails(null); return; }
    void loadDetails(selectedId).catch((error) => setMessage(error.message));
    const timer = window.setInterval(() => { void loadDetails(selectedId).catch(() => undefined); void loadRuns().catch(() => undefined); }, 3000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadDetails, loadRuns]);

  async function action(name: "approve" | "reject" | "pause" | "resume" | "cancel") {
    if (!selectedId || busy) return;
    if ((name === "cancel" || name === "reject") && !window.confirm(name === "cancel" ? "ยืนยันยกเลิกงาน AI นี้? งานที่ยังไม่คิดเงินจริงจะถูกพยายามคืนเครดิตตามสถานะจริง" : "ไม่อนุมัติแผนนี้และยกเลิกงานใช่หรือไม่?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/agent/runs/${selectedId}/${name}`, { method: "POST", credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `${name} ไม่สำเร็จ`);
      setMessage(name === "approve" ? "อนุมัติแล้ว ระบบจะทำงานต่อ" : name === "reject" ? "ไม่อนุมัติและหยุดงานแล้ว" : name === "pause" ? "พักงานแล้ว" : name === "resume" ? "เริ่มทำงานต่อแล้ว" : "ยกเลิกงานแล้ว");
      await Promise.all([loadRuns(), loadDetails(selectedId)]);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }

  const run = details?.run;
  const currentStageIndex = run ? STAGES.indexOf(run.stage) : -1;
  const llmCost = useMemo(() => (details?.llmUsage || []).reduce((sum, item) => sum + Number(item.costThb || 0), 0), [details]);
  const pendingApproval = details?.approvals?.find((approval) => approval.status === "PENDING");

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
      <aside className={styles.runList}><div className={styles.runTitle}><div><b>งาน AI</b><small>{runs.length} รายการ</small></div><button onClick={() => void loadRuns()} aria-label="รีเฟรชงาน AI">↻</button></div>{runs.length ? runs.map((item) => <button key={item.id} className={item.id === selectedId ? styles.selected : ""} onClick={() => setSelectedId(item.id)}><span><b>{stageLabel(item.stage)}</b><i data-status={item.status}>{statusLabel(item.status)}</i></span><small>{time(item.createdAt)} · สูงสุด {item.maxEpisodes} ตอน</small></button>) : <div className={styles.emptyState}><span>✦</span><h2>ยังไม่มีงาน AI</h2><p>เริ่มสร้างงานจาก Studio ก่อน เมื่อมี Agent Run งานจะมาแสดงที่นี่อัตโนมัติ</p><Link href="/studio">เปิด Studio</Link></div>}</aside>

      <section className={styles.main}>{!run ? <div className={styles.welcomePanel}><span>AI AGENT WORKSPACE</span><h2>เลือกงาน AI เพื่อดูรายละเอียด</h2><p>เมื่อมีงาน ระบบจะแสดงขั้นตอน ค่าใช้จ่าย จุดรออนุมัติ และสถานะคิวแบบอัปเดตต่อเนื่อง</p><div><Link href="/studio">เริ่มจาก Studio</Link><Link href="/wallet">ดูเครดิต</Link></div></div> : <>
        <div className={styles.statusBar}><div><small>สถานะ</small><strong>{statusLabel(run.status)}</strong></div><div><small>ขั้นตอนปัจจุบัน</small><strong>{stageLabel(run.stage)}</strong></div><div><small>วงเงินสูงสุด</small><strong>฿{money(run.budgetThb)}</strong></div><div><small>คาดการณ์ / ใช้จริง</small><strong>฿{money(run.estimatedSpendThb)} / ฿{money(run.actualSpendThb)}</strong></div><div><small>ค่า AI วางแผน</small><strong>฿{money(llmCost)}</strong></div></div>

        <div className={styles.timeline}>{STAGES.map((stage, index) => <div key={stage} className={index < currentStageIndex || run.stage === "COMPLETED" ? styles.done : index === currentStageIndex ? styles.current : ""}><i>{index < currentStageIndex || run.stage === "COMPLETED" ? "✓" : index + 1}</i><span>{stageLabel(stage)}</span></div>)}</div>

        {pendingApproval ? <div className={styles.approval} id="approvals"><span>ต้องการการอนุมัติจากคุณ</span><h2>AI พร้อมทำขั้นตอนถัดไป แต่จะยังไม่ใช้ทรัพยากรจนกว่าคุณจะอนุมัติ</h2><p>{pendingApproval.summary}</p><strong>ประมาณ ฿{money(pendingApproval.estimatedCostThb)}</strong><small>วงเงินงานสูงสุด ฿{money(run.budgetThb)} · AI ไม่สามารถเพิ่มวงเงินเองได้</small><div><button disabled={busy} onClick={() => void action("approve")}>อนุมัติและทำต่อ</button><button disabled={busy} className={styles.danger} onClick={() => void action("reject")}>ไม่อนุมัติ</button></div></div> : <div id="approvals" />}

        {run.stopReason ? <div className={styles.stopReason}><b>ข้อมูลเพิ่มเติม</b><span>{run.stopReason}</span></div> : null}
        <div className={styles.controls}>{run.status === "PAUSED" ? <button disabled={busy} onClick={() => void action("resume")}>▶ ทำงานต่อ</button> : !["COMPLETED","FAILED","CANCELLED","WAITING_APPROVAL"].includes(run.status) ? <button disabled={busy} onClick={() => void action("pause")}>Ⅱ พักงาน</button> : null}<button disabled={busy || ["COMPLETED","FAILED","CANCELLED"].includes(run.status)} className={styles.danger} onClick={() => void action("cancel")}>ยกเลิกงาน</button></div>

        <div className={styles.grid}>
          <article className={styles.panel}><div className={styles.panelTitle}><h2>บันทึกการตัดสินใจของ AI</h2><span>ทำอะไร · เพราะอะไร</span></div><div className={styles.scroll}>{details.decisions?.length ? [...details.decisions].reverse().map((item) => <div className={styles.log} key={item.id}><span><b>{item.action}</b><i>{stageLabel(item.stage)}</i></span><p>{item.reason}</p><small>{time(item.createdAt)}{item.providerId ? ` · ${item.providerId}` : ""}</small></div>) : <p className={styles.muted}>ยังไม่มีบันทึกการตัดสินใจ</p>}</div></article>
          <article className={styles.panel}><div className={styles.panelTitle}><h2>การใช้ AI วางแผน</h2><span>{details.llmUsage?.length || 0} ครั้ง</span></div><div className={styles.scroll}>{details.llmUsage?.length ? [...details.llmUsage].reverse().map((item) => <div className={styles.log} key={item.id}><span><b>{item.category}</b><i>{item.modelId}</i></span><p>{item.inputTokens.toLocaleString()} input · {item.outputTokens.toLocaleString()} output</p><small>฿{money(item.costThb)} · {time(item.createdAt)}</small></div>) : <p className={styles.muted}>งานนี้ยังไม่มีค่าใช้ AI วางแผนที่บันทึกไว้</p>}</div></article>
        </div>

        <article className={styles.panel}><div className={styles.panelTitle}><h2>คิวงานและการกู้คืน</h2><span>{details.jobs?.length || 0} งานย่อย</span></div><div className={styles.jobs}>{details.jobs?.slice(0,12).map((job) => <div key={job.id}><b>{statusLabel(job.status)}</b><span>ลอง {job.attempts}/{job.maxAttempts}</span><span>{job.lockedBy ? "กำลังประมวลผล" : "พร้อม"}</span><small>{job.lastError || time(job.createdAt)}</small></div>)}</div></article>
      </>}</section>
    </div>
  </main>;
}
