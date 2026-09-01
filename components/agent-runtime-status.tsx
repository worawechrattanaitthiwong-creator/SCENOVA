"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./agent-runtime-status.module.css";

type WorkerHeartbeat = {
  workerId: string;
  pid: number;
  state: "starting" | "idle" | "working" | "blocked" | "error" | "stopping";
  activeLanes: number;
  concurrency: number;
  reason?: string | null;
  lastJobAt?: string | null;
  lastError?: string | null;
  updatedAt: string;
  ageMs: number;
  online: boolean;
};

type RuntimeHealth = {
  runtimeState: string;
  message: string;
  viewerRole?: string;
  worker?: WorkerHeartbeat | null;
  security: {
    blocked: boolean;
    lockdownEnabled: boolean;
    agentDisabled: boolean;
    queuePaused: boolean;
    environmentHardLock: boolean;
    reason?: string | null;
  };
  run: null | {
    id: string;
    status: string;
    stage: string;
    stopReason?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  queue: null | {
    id: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    lockedBy?: string | null;
    lastError?: string | null;
    availableAt?: string | null;
    heartbeatAt?: string | null;
    leaseExpiresAt?: string | null;
    updatedAt: string;
    queueAgeMs: number;
    heartbeatAgeMs?: number | null;
  };
  task: null | {
    id: string;
    agentKey: string;
    stage: string;
    status: string;
    attempt: number;
    maxAttempts: number;
    lastError?: string | null;
    startedAt?: string | null;
    updatedAt: string;
  };
  checkedAt: string;
};

const STATE_LABELS: Record<string, string> = {
  idle: "ไม่มีงานในคิว",
  blocked: "ระบบถูกบล็อก",
  starting: "กำลังเริ่มงาน",
  working: "AI กำลังทำงาน",
  waiting: "กำลังรอ Provider",
  stalled: "Worker ไม่รับงาน",
  orphaned: "คิวขาดตอน",
  waiting_approval: "รออนุมัติ",
  paused: "พักงาน",
  completed: "เสร็จสมบูรณ์",
  failed: "งานมีข้อผิดพลาด",
  cancelled: "ยกเลิกแล้ว",
};

const WORKER_LABELS: Record<string, string> = {
  starting: "กำลังเริ่ม Worker",
  idle: "Worker Online · ว่าง",
  working: "Worker Online · กำลังทำงาน",
  blocked: "Worker Online · ถูก Security พัก",
  error: "Worker Online · พบข้อผิดพลาด",
  stopping: "Worker กำลังหยุด",
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
  GENERATE: "กำลังสร้างวิดีโอ",
  VERIFY_CONTINUITY: "ตรวจความต่อเนื่อง",
  POST_PRODUCTION: "หลังการผลิต",
  FINAL_QUALITY: "ตรวจคุณภาพ",
  NEXT_EPISODE: "เตรียมตอนถัดไป",
  COMPLETED: "เสร็จสมบูรณ์",
  FAILED: "หยุดเพราะข้อผิดพลาด",
};

function seconds(ms?: number | null) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  return `${Math.max(0, Math.round(ms / 1000))} วิ`;
}

function checkedTime(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function friendlyRuntimeError(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  const target = raw.includes(":") ? raw.split(":").slice(1).join(":").trim() : "โมเดลวิดีโอที่เลือก";
  if (upper.startsWith("VIDEO_PROVIDER_NOT_FOUND")) {
    if (target.toLowerCase().includes("seedance")) {
      return `งานรอบก่อนจับคู่ชื่อ ${target} กับ Seedance Provider ไม่สำเร็จ ระบบรองรับ alias นี้แล้ว กด “บังคับเริ่ม” เพื่อทำต่อจากขั้นเดิม`;
    }
    return `ไม่พบ Video Provider ที่ตรงกับ ${target} กรุณาตรวจ Model/Provider แล้วกด “บังคับเริ่ม”`;
  }
  if (upper.startsWith("VIDEO_PROVIDER_CONNECTION_REQUIRED") || upper.startsWith("PROVIDER_CONNECTION_REQUIRED")) {
    return `ยังไม่มี Video Provider ที่เชื่อมต่อพร้อมใช้สำหรับ ${target} กรุณาเชื่อมต่อ Provider ใน API & Models ก่อนเริ่มงานอีกครั้ง`;
  }
  if (upper.includes("INVALID_API_KEY") || upper.includes("CREDENTIAL_REQUIRED")) {
    return "Credential ของ Video Provider ยังไม่พร้อมใช้งาน กรุณาทดสอบการเชื่อมต่อใน API & Models แล้วเริ่มงานอีกครั้ง";
  }
  if (upper === "SUPERSEDED_BY_USER_RETRY") return "คิวเดิมถูกแทนที่ด้วยคำสั่งบังคับเริ่มใหม่แล้ว";
  return raw;
}

export default function AgentRuntimeStatus() {
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [error, setError] = useState("");
  const [repairing, setRepairing] = useState(false);
  const [forceStarting, setForceStarting] = useState(false);
  const lastAutoRepairAt = useRef(0);
  const mounted = useRef(true);

  const runParam = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("run") || "";
  }, []);

  const load = useCallback(async () => {
    const suffix = runParam ? `?run=${encodeURIComponent(runParam)}` : "";
    const response = await fetch(`/api/agent/runtime${suffix}`, { cache: "no-store", credentials: "same-origin" });
    const data = await response.json() as RuntimeHealth & { error?: string };
    if (!response.ok) throw new Error(data.error || "โหลดสถานะ AI Runtime ไม่สำเร็จ");
    if (!mounted.current) return;
    setHealth(data);
    setError("");
  }, [runParam]);

  const repair = useCallback(async (automatic = false) => {
    const runId = health?.run?.id;
    if (!runId || repairing) return;
    setRepairing(true);
    if (!automatic) setError("");
    try {
      const response = await fetch("/api/agent/runtime", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      const data = await response.json() as { health?: RuntimeHealth; worker?: WorkerHeartbeat | null; error?: string; kickError?: string | null };
      if (!response.ok) throw new Error(data.error || data.kickError || "ซ่อมคิว AI ไม่สำเร็จ");
      if (!mounted.current) return;
      if (data.health) setHealth({ ...data.health, worker: data.worker ?? health?.worker, viewerRole: health?.viewerRole });
      setError(data.kickError || "");
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (mounted.current) setRepairing(false);
    }
  }, [health, repairing]);

  const forceStart = useCallback(async () => {
    const runId = health?.run?.id;
    if (!runId || forceStarting) return;
    setForceStarting(true);
    setError("");
    try {
      const response = await fetch(`/api/agent/runs/${encodeURIComponent(runId)}/retry`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error || "บังคับเริ่มงานไม่สำเร็จ");
      await load();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (mounted.current) setForceStarting(false);
    }
  }, [forceStarting, health, load]);

  useEffect(() => {
    mounted.current = true;
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    const timer = window.setInterval(() => {
      void load().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    }, 3000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!health?.run || health.security.blocked) return;
    if (!["stalled", "orphaned"].includes(health.runtimeState)) return;
    const now = Date.now();
    if (now - lastAutoRepairAt.current < 15_000) return;
    lastAutoRepairAt.current = now;
    void repair(true);
  }, [health, repair]);

  const state = health?.runtimeState || "idle";
  const run = health?.run;
  const queue = health?.queue;
  const task = health?.task;
  const worker = health?.worker;
  const canRepair = Boolean(run && !health?.security.blocked && ["stalled", "orphaned", "starting"].includes(state));
  const canForceStart = Boolean(run && run.status === "FAILED" && !health?.security.blocked);
  const activeAgent = task?.agentKey ? AGENT_LABELS[task.agentKey] || task.agentKey : "ยังไม่มี Agent รับงาน";
  const stage = run?.stage ? STAGE_LABELS[run.stage] || run.stage : "—";
  const workerLabel = worker
    ? worker.online
      ? WORKER_LABELS[worker.state] || worker.state
      : "Worker Offline · Heartbeat ขาด"
    : "ยังไม่พบ Worker Heartbeat";
  const workerDetail = worker
    ? `${worker.activeLanes}/${worker.concurrency} lanes · heartbeat ${seconds(worker.ageMs)} ที่แล้ว`
    : `ตรวจล่าสุด ${checkedTime(health?.checkedAt)}`;
  const queueError = friendlyRuntimeError(queue?.lastError || task?.lastError);
  const needsProviderSettings = /PROVIDER_(NOT_FOUND|CONNECTION_REQUIRED)|INVALID_API_KEY|CREDENTIAL_REQUIRED/i.test(String(queue?.lastError || task?.lastError || ""));

  return <section className={styles.panel} data-state={state} aria-live="polite">
    <div className={styles.head}>
      <div className={styles.titleRow}>
        <span className={styles.dot} aria-hidden="true" />
        <div>
          <h2>AI Runtime · {STATE_LABELS[state] || state}</h2>
          <small>ตรวจ Worker, Queue และ Security แบบสดทุก 3 วินาที พร้อมซ่อมคิวที่ค้างให้อัตโนมัติ</small>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => void load()} disabled={repairing || forceStarting}>↻ ตรวจอีกครั้ง</button>
        {canForceStart ? <button type="button" className={styles.repair} onClick={() => void forceStart()} disabled={forceStarting}>{forceStarting ? "กำลังนำงานกลับเข้าคิว..." : "▶ บังคับเริ่ม"}</button> : null}
        {canRepair ? <button type="button" className={styles.repair} onClick={() => void repair(false)} disabled={repairing}>{repairing ? "กำลังช่วยเริ่ม Worker..." : "▶ ช่วยเริ่ม Worker"}</button> : null}
        {needsProviderSettings ? <Link href="/profile/api">API & Models →</Link> : null}
        {health?.security.blocked && health.viewerRole === "ADMIN" ? <Link className={styles.security} href="/admin/security">Security Center →</Link> : null}
      </div>
    </div>

    <div className={styles.message}>
      <strong>{queueError || health?.message || "กำลังอ่านสถานะระบบ..."}</strong>
      {repairing ? <span>ระบบกำลังตรวจคิว ซ่อม Queue Job ที่ขาด และเรียก Web Fallback Worker หาก Worker หลักยังไม่รับงาน</span> : null}
      {forceStarting ? <span>ระบบจะเก็บ Artifact ที่เสร็จแล้วไว้ รีเซ็ตเฉพาะขั้นที่ล้มเหลว และนำขั้นนั้นกลับเข้า Queue</span> : null}
    </div>

    <div className={styles.grid}>
      <div className={styles.cell}><small>Run</small><b>{run?.status || "—"}</b><em>{run?.id ? run.id.slice(0, 12) : "ยังไม่มีงาน"}</em></div>
      <div className={styles.cell}><small>ขั้นตอนปัจจุบัน</small><b>{stage}</b><em>{run?.stage || "—"}</em></div>
      <div className={styles.cell}><small>Agent ที่กำลังทำ</small><b>{activeAgent}</b><em>{task?.status || "PENDING"}</em></div>
      <div className={styles.cell}><small>Queue / Attempt</small><b>{queue ? `${queue.status} · ${queue.attempts}/${queue.maxAttempts}` : "ไม่มี Active Job"}</b><em>อายุคิว {seconds(queue?.queueAgeMs)}</em></div>
      <div className={styles.cell}><small>Dedicated Worker</small><b>{workerLabel}</b><em>{workerDetail}</em></div>
    </div>

    <div className={styles.notice} data-error={Boolean(error || queueError)}>
      {error
        ? `ข้อผิดพลาด Runtime: ${friendlyRuntimeError(error)}`
        : worker?.lastError
          ? `Worker รายงานล่าสุด: ${friendlyRuntimeError(worker.lastError)}`
          : queueError
            ? queueError
            : health?.security.environmentHardLock
              ? "Environment Hard Lock เปิดอยู่ ต้องแก้ค่า Production Environment ก่อนจึงจะเดินงานต่อได้"
              : worker && !worker.online
                ? "Dedicated Worker ไม่ส่ง heartbeat แล้ว ระบบ Web Fallback จะช่วยประมวลผลคิวที่ค้างโดยอัตโนมัติจน Worker หลักกลับมา"
                : "ถ้า Worker หลักหยุดรับงานเกิน 12 วินาที ระบบจะเรียก Fallback Worker ให้อัตโนมัติ โดยยังใช้ Queue Lock เดิมเพื่อป้องกันงานซ้ำ"}
    </div>
  </section>;
}