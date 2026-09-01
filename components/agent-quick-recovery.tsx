"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./agent-quick-recovery.module.css";

type Run = {
  id: string;
  status: string;
  stage: string;
  stopReason?: string | null;
  inputJson?: {
    project?: {
      title?: string;
      episodes?: Array<{ title?: string }>;
    };
  };
};

type Task = {
  status: string;
  lastError?: string | null;
};

type Job = {
  lastError?: string | null;
};

type RunDetails = {
  run: Run;
  jobs?: Job[];
  workflow?: { tasks?: Task[] } | null;
};

function titleOf(run: Run) {
  return run.inputJson?.project?.episodes?.[0]?.title || run.inputJson?.project?.title || "งาน AI";
}

function isQuotaError(value?: string | null) {
  const text = String(value || "").toLowerCase();
  return text.includes("exceeded your current quota") ||
    text.includes("check your plan and billing") ||
    text.includes("billing details") ||
    (text.includes("resource_exhausted") && text.includes("quota"));
}

function shortError(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "งานหยุดและรอให้ผู้ใช้ตรวจสอบก่อนเริ่มใหม่";
  if (isQuotaError(raw)) return "Veo ปฏิเสธงานเพราะโควตาหรือสิทธิ์ Billing ของบัญชีไม่พร้อม การ Retry ซ้ำทันทีจะไม่ช่วย";
  if (raw.toLowerCase().includes("video_provider_not_found")) return "ไม่พบ Video Provider ที่พร้อมสำหรับโมเดลของงานนี้";
  return raw.length > 170 ? `${raw.slice(0, 167)}…` : raw;
}

export default function AgentQuickRecovery() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [details, setDetails] = useState<RunDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedId = useMemo(() => {
    if (!runs.length) return "";
    const queryId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("run") : null;
    if (queryId && runs.some((run) => run.id === queryId)) return queryId;
    return runs.find((run) => run.status === "FAILED")?.id || "";
  }, [runs]);

  const loadRuns = useCallback(async () => {
    const response = await fetch("/api/agent/runs", { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "โหลดงาน AI ไม่สำเร็จ");
    setRuns((payload.runs || []) as Run[]);
  }, []);

  const loadDetails = useCallback(async (id: string) => {
    if (!id) {
      setDetails(null);
      return;
    }
    const response = await fetch(`/api/agent/runs/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "same-origin" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "โหลดรายละเอียดงานไม่สำเร็จ");
    setDetails(payload as RunDetails);
    setError("");
  }, []);

  useEffect(() => {
    void loadRuns().catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    const timer = window.setInterval(() => void loadRuns().catch(() => undefined), 5000);
    return () => window.clearInterval(timer);
  }, [loadRuns]);

  useEffect(() => {
    if (!selectedId) {
      setDetails(null);
      return;
    }
    void loadDetails(selectedId).catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
    const timer = window.setInterval(() => void loadDetails(selectedId).catch(() => undefined), 3000);
    return () => window.clearInterval(timer);
  }, [selectedId, loadDetails]);

  const run = details?.run || runs.find((item) => item.id === selectedId) || null;
  const failedTask = details?.workflow?.tasks?.find((task) => task.status === "FAILED");
  const latestError = failedTask?.lastError || details?.jobs?.find((job) => job.lastError)?.lastError || run?.stopReason || error;
  const quota = isQuotaError(latestError);

  function goToModelEditor() {
    const target = document.querySelector<HTMLElement>('[aria-label="แก้โมเดลของงาน AI"]');
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus?.({ preventScroll: true });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function forceRetry() {
    if (!run || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/agent/runs/${encodeURIComponent(run.id)}/retry`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "นำงานกลับเข้าคิวไม่สำเร็จ");
      setMessage("นำงานกลับเข้าคิวแล้ว ระบบจะทำต่อจากขั้นที่ล้มโดยคงรายละเอียดและ Artifact เดิมไว้");
      await Promise.all([loadRuns(), loadDetails(run.id)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  if (!run || run.status !== "FAILED") return null;

  return <aside className={styles.panel} data-quota={quota ? "true" : "false"} aria-label="เครื่องมือแก้ไขงานที่ล้มเหลว">
    <div className={styles.top}>
      <span className={styles.icon} aria-hidden="true">↻</span>
      <div className={styles.copy}>
        <b>{titleOf(run)}</b>
        <strong>{quota ? "โควตา Provider ไม่พร้อม" : "งานหยุด · พร้อมแก้และเริ่มใหม่"}</strong>
        <p>{shortError(latestError)}</p>
      </div>
    </div>

    {message ? <div className={styles.success}>{message}</div> : null}
    {error ? <div className={styles.error}>{error}</div> : null}

    <div className={styles.actions}>
      <button type="button" className={styles.model} onClick={goToModelEditor}>แก้โมเดล</button>
      {quota ? <Link href="/profile/api">API &amp; Models</Link> : null}
      <button type="button" className={styles.retry} onClick={() => void forceRetry()} disabled={busy}>
        {busy ? "กำลังนำกลับเข้าคิว..." : quota ? "▶ บังคับเริ่มหลังแก้โควตา" : "▶ บังคับเริ่ม"}
      </button>
    </div>
  </aside>;
}
