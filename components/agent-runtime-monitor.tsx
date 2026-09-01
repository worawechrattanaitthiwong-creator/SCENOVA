"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./agent-runtime-status.module.css";

type RuntimeHealth = {
  runtimeState: string;
  message: string;
  viewerRole?: string;
  security: {
    blocked: boolean;
    environmentHardLock: boolean;
  };
  run: null | { id: string; status: string; stage: string };
  queue: null | {
    status: string;
    attempts: number;
    maxAttempts: number;
    lastError?: string | null;
    queueAgeMs: number;
  };
  task: null | {
    agentKey: string;
    status: string;
    lastError?: string | null;
  };
  worker?: null | {
    state: string;
    activeLanes: number;
    concurrency: number;
    ageMs: number;
    online: boolean;
    lastError?: string | null;
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

function seconds(ms?: number | null) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  return `${Math.max(0, Math.round(ms / 1000))} วิ`;
}

function friendlyError(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (upper.includes("VEO_HTTP_429") || upper.includes("RESOURCE_EXHAUSTED") || upper.includes("EXCEEDED YOUR CURRENT QUOTA")) {
    return "คำขอ Veo รอบล่าสุดถูก Google ตอบ HTTP 429 (quota/rate limit) การเชื่อมต่อ Credential อาจยังปกติ ให้เลือกงานนั้นในรายการงาน AI แล้วกดบังคับเริ่มเฉพาะงานนั้นหลังตรวจ Rate Limit หรือรอข้อจำกัดคลาย";
  }
  if (upper.includes("VIDEO_PROVIDER_NOT_FOUND")) return "ไม่พบ Video Provider ที่ตรงกับโมเดลของงานนี้ กรุณาตรวจ Model/Provider แล้วเลือกงานนี้เพื่อเริ่มใหม่";
  if (upper.includes("PROVIDER_CONNECTION_REQUIRED")) return "งานนี้ยังไม่มี Provider ที่เชื่อมต่อ กรุณาตรวจ API & Models ก่อนเริ่มใหม่";
  if (upper.includes("INVALID_API_KEY") || upper.includes("CREDENTIAL_REQUIRED")) return "Credential ของ Provider ไม่ผ่าน กรุณาทดสอบใน API & Models ก่อนเริ่มใหม่";
  return raw;
}

export default function AgentRuntimeMonitor() {
  const [health, setHealth] = useState<RuntimeHealth | null>(null);
  const [error, setError] = useState("");
  const [repairing, setRepairing] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const runId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("run") : null;
    const suffix = runId ? `?run=${encodeURIComponent(runId)}` : "";
    const response = await fetch(`/api/agent/runtime${suffix}`, { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json() as RuntimeHealth & { error?: string };
    if (!response.ok) throw new Error(payload.error || "โหลดสถานะ AI Runtime ไม่สำเร็จ");
    if (mounted.current) {
      setHealth(payload);
      setError("");
    }
  }, []);

  const repair = useCallback(async () => {
    const runId = health?.run?.id;
    if (!runId || repairing) return;
    setRepairing(true);
    setError("");
    try {
      const response = await fetch("/api/agent/runtime", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      const payload = await response.json() as { error?: string; kickError?: string | null };
      if (!response.ok) throw new Error(payload.error || payload.kickError || "ซ่อมคิว AI ไม่สำเร็จ");
      await load();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (mounted.current) setRepairing(false);
    }
  }, [health?.run?.id, load, repairing]);

  useEffect(() => {
    mounted.current = true;
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    const timer = window.setInterval(() => void load().catch(() => undefined), 3000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [load]);

  const state = health?.runtimeState || "idle";
  const run = health?.run;
  const queue = health?.queue;
  const task = health?.task;
  const worker = health?.worker;
  const canRepair = Boolean(run && !health?.security.blocked && ["stalled", "orphaned", "starting"].includes(state));
  const queueError = friendlyError(queue?.lastError || task?.lastError);
  const needsProviderSettings = /PROVIDER_(NOT_FOUND|CONNECTION_REQUIRED)|INVALID_API_KEY|CREDENTIAL_REQUIRED/i.test(String(queue?.lastError || task?.lastError || ""));
  const workerLabel = worker ? worker.online ? `Worker Online · ${worker.state === "working" ? "กำลังทำงาน" : "พร้อม"}` : "Worker Offline" : "กำลังตรวจ Worker";

  return <section className={styles.panel} data-state={state} aria-live="polite">
    <div className={styles.head}>
      <div className={styles.titleRow}>
        <span className={styles.dot} aria-hidden="true" />
        <div>
          <h2>AI Runtime · {STATE_LABELS[state] || state}</h2>
          <small>ส่วนนี้ใช้ดูสถานะและซ่อม Worker เท่านั้น การบังคับเริ่มต้องทำจากงานที่เลือกในรายการงาน AI</small>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => void load()} disabled={repairing}>↻ ตรวจอีกครั้ง</button>
        {canRepair ? <button type="button" className={styles.repair} onClick={() => void repair()} disabled={repairing}>{repairing ? "กำลังช่วยเริ่ม Worker..." : "▶ ช่วยเริ่ม Worker"}</button> : null}
        {needsProviderSettings ? <Link href="/profile/api">API &amp; Models →</Link> : null}
      </div>
    </div>

    <div className={styles.message}>
      <strong>{queueError || health?.message || "กำลังอ่านสถานะระบบ..."}</strong>
      {repairing ? <span>กำลังตรวจคิวและเรียก Worker กลับมาทำงาน โดยไม่สร้างคำสั่ง Retry ของ Run ใหม่</span> : null}
    </div>

    <div className={styles.grid}>
      <div className={styles.cell}><small>Run</small><b>{run?.status || "—"}</b><em>{run?.id ? run.id.slice(0, 12) : "ยังไม่มีงาน"}</em></div>
      <div className={styles.cell}><small>ขั้นตอนปัจจุบัน</small><b>{run?.stage || "—"}</b><em>{state}</em></div>
      <div className={styles.cell}><small>Agent ที่กำลังทำ</small><b>{task?.agentKey ? AGENT_LABELS[task.agentKey] || task.agentKey : "ยังไม่มี Agent รับงาน"}</b><em>{task?.status || "PENDING"}</em></div>
      <div className={styles.cell}><small>Queue / Attempt</small><b>{queue ? `${queue.status} · ${queue.attempts}/${queue.maxAttempts}` : "ไม่มี Active Job"}</b><em>อายุคิว {seconds(queue?.queueAgeMs)}</em></div>
      <div className={styles.cell}><small>Dedicated Worker</small><b>{workerLabel}</b><em>{worker ? `${worker.activeLanes}/${worker.concurrency} lanes · heartbeat ${seconds(worker.ageMs)} ที่แล้ว` : "—"}</em></div>
    </div>

    <div className={styles.notice} data-error={Boolean(error || queueError)}>
      {error ? `ข้อผิดพลาด Runtime: ${friendlyError(error)}` : queueError || worker?.lastError ? friendlyError(queueError || worker?.lastError) : health?.security.environmentHardLock ? "Environment Hard Lock เปิดอยู่ ต้องแก้ Production Environment ก่อน" : "เลือกงานจากรายการงาน AI ด้านล่างก่อนใช้คำสั่งพัก ทำงานต่อ หรือบังคับเริ่ม เพื่อให้คำสั่งมีผลกับ Run ที่ต้องการเท่านั้น"}
    </div>
  </section>;
}
