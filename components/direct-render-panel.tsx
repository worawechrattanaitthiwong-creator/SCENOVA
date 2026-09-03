"use client";

import { useEffect, useMemo, useState } from "react";
import type { Project, PromptBundle, RenderSegment } from "@/lib/domain";
import styles from "./direct-render-panel.module.css";

type PromptSegment = {
  order: number;
  start: number;
  end: number;
  duration: number;
  sourceSceneIds: string[];
  renderSegment: RenderSegment;
  prompt: PromptBundle;
  copyText: string;
};

type PromptResponse = {
  ok?: boolean;
  error?: string;
  providerId?: string;
  providerName?: string;
  billingMode?: string;
  maxSecondsPerGeneration?: number;
  composer?: string;
  videoConnectionRequired?: boolean;
  segments?: PromptSegment[];
};

type RunSegment = {
  id: string;
  order: number;
  start: number;
  end: number;
  duration: number;
  status: string;
  provider: string;
  modelId: string;
  outputUrl?: string | null;
  lastFrameUrl?: string | null;
  estimatedCostThb?: number;
  error?: string | null;
};

type RunResponse = {
  ok?: boolean;
  error?: string;
  runId?: string;
  status?: string;
  percent?: number;
  segments?: RunSegment[];
};

function statusLabel(value: string) {
  if (value === "COMPLETED") return "เสร็จแล้ว";
  if (value === "FAILED") return "ผิดพลาด";
  if (value === "CANCELLED") return "ยกเลิกแล้ว";
  if (value === "READY") return "รอสร้าง";
  if (value === "SUBMITTING") return "กำลังส่ง Provider";
  if (value === "QUEUED") return "อยู่ในคิว";
  if (value === "GENERATING") return "กำลังสร้าง";
  return value || "รอ";
}

function statusClass(value: string) {
  if (value === "COMPLETED") return styles.completed;
  if (value === "FAILED" || value === "CANCELLED") return styles.failed;
  if (["SUBMITTING", "QUEUED", "GENERATING"].includes(value)) return styles.running;
  return "";
}

function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  return Promise.resolve();
}

export default function DirectRenderPanel({
  project,
  providerId,
  modelVersionId,
  modelLabel,
  modelReady,
  modelMode,
}: {
  project: Project;
  providerId: string;
  modelVersionId?: string;
  modelLabel: string;
  modelReady: boolean;
  modelMode: "generate" | "video-edit" | "hdr";
}) {
  const [promptData, setPromptData] = useState<PromptResponse | null>(null);
  const [promptBusy, setPromptBusy] = useState(false);
  const [renderBusy, setRenderBusy] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(1);
  const [run, setRun] = useState<RunResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sourceSignature = useMemo(() => JSON.stringify({
    providerId,
    modelVersionId,
    project: {
      title: project.title,
      story: project.story,
      mainModelId: project.mainModelId,
      mainModelVersionId: project.mainModelVersionId,
      aspectRatio: project.aspectRatio,
      resolution: project.resolution,
      styleId: project.styleId,
      locks: project.locks,
      characters: project.characters,
      episodes: project.episodes,
    },
  }), [providerId, modelVersionId, project]);

  useEffect(() => {
    setPromptData(null);
    setRun(null);
    setError("");
    setNotice("");
    setSelectedOrder(1);
  }, [sourceSignature]);

  const selectedPrompt = promptData?.segments?.find((segment) => segment.order === selectedOrder) || promptData?.segments?.[0];
  const sourceEpisode = project.episodes[0];
  const sceneName = (id: string) => sourceEpisode?.segments.find((segment) => segment.id === id)?.title || id;
  const allPromptText = (promptData?.segments || []).map((segment) => segment.copyText).join("\n\n\n--- NEXT GENERATION SEGMENT ---\n\n");
  const activeRun = Boolean(run?.runId && !["COMPLETED", "FAILED", "CANCELLED"].includes(run.status || ""));

  async function createPrompts() {
    if (promptBusy) return null;
    setPromptBusy(true);
    setError("");
    setNotice("กำลังให้ OpenAI Prompt Composer จัด Prompt ตาม Timeline และข้อจำกัดของโมเดล...");
    try {
      const response = await fetch("/api/direct-render/prompt", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, providerId, modelVersionId }),
      });
      const data = await response.json() as PromptResponse;
      if (!response.ok || !Array.isArray(data.segments)) throw new Error(data.error || "สร้าง Prompt ไม่สำเร็จ");
      setPromptData(data);
      setSelectedOrder(data.segments[0]?.order || 1);
      const composer = data.composer === "openai-production-prompt" ? "OpenAI Prompt Composer" : "SCENOVA Deterministic Prompt";
      setNotice(`สร้าง Prompt แล้ว ${data.segments.length} ช่วง · ${composer} · โมเดลสร้างได้สูงสุด ${data.maxSecondsPerGeneration || "-"} วินาทีต่อครั้ง`);
      return data;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "สร้าง Prompt ไม่สำเร็จ";
      setError(message);
      setNotice("");
      return null;
    } finally {
      setPromptBusy(false);
    }
  }

  async function copySegment() {
    if (!selectedPrompt) return;
    await copyToClipboard(selectedPrompt.copyText);
    setNotice(`คัดลอก Prompt ช่วงสร้าง ${selectedPrompt.order} แล้ว`);
  }

  async function copyAll() {
    if (!allPromptText) return;
    await copyToClipboard(allPromptText);
    setNotice("คัดลอก Prompt ทุกช่วงสร้างแล้ว");
  }

  async function startRender() {
    if (renderBusy || activeRun) return;
    if (modelMode !== "generate") {
      setError("โมเดลนี้เป็นเครื่องมือ Video Edit / HDR ไม่ใช่โมเดลสร้างวิดีโอใหม่โดยตรง");
      return;
    }
    if (!modelReady) {
      setError("Video Provider ของโมเดลนี้ยังไม่พร้อม กรุณาเชื่อมต่อ API ก่อนสร้างวิดีโอ");
      return;
    }
    setRenderBusy(true);
    setError("");
    setNotice("กำลังเตรียม Direct Render โดยไม่ผ่าน AI Agent...");
    try {
      const prompts = promptData?.segments?.length ? promptData : await createPrompts();
      if (!prompts?.segments?.length) throw new Error("กรุณาสร้าง Prompt ก่อนเริ่ม Direct Render");
      const response = await fetch("/api/direct-render", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, providerId, modelVersionId, promptSegments: prompts.segments }),
      });
      const data = await response.json() as RunResponse;
      if (!response.ok || !data.runId) throw new Error(data.error || "เริ่ม Direct Render ไม่สำเร็จ");
      setRun(data);
      setNotice("เริ่มสร้างวิดีโอตรงแล้ว · SCENOVA จะส่งทีละ Generation Segment ตามเวลาสูงสุดของโมเดล");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "เริ่ม Direct Render ไม่สำเร็จ";
      setError(message);
    } finally {
      setRenderBusy(false);
    }
  }

  async function cancelRender() {
    if (!run?.runId) return;
    setRenderBusy(true);
    try {
      const response = await fetch(`/api/direct-render?runId=${encodeURIComponent(run.runId)}`, { method: "DELETE", credentials: "same-origin" });
      const data = await response.json() as RunResponse;
      if (!response.ok) throw new Error(data.error || "ยกเลิก Direct Render ไม่สำเร็จ");
      setRun(data);
      setNotice("ยกเลิก Direct Render แล้ว งานที่ Provider สร้างเสร็จไปแล้วจะยังคงอยู่");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ยกเลิก Direct Render ไม่สำเร็จ");
    } finally {
      setRenderBusy(false);
    }
  }

  useEffect(() => {
    if (!run?.runId || !activeRun) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/direct-render?runId=${encodeURIComponent(run.runId!)}`, { credentials: "same-origin", cache: "no-store" });
        const data = await response.json() as RunResponse;
        if (cancelled) return;
        if (response.ok) {
          setRun(data);
          if (data.status === "COMPLETED") setNotice("Direct Render สร้างครบทุกช่วงแล้ว");
          if (data.status === "FAILED") setError(data.segments?.find((segment) => segment.status === "FAILED")?.error || "Direct Render มีช่วงที่สร้างไม่สำเร็จ");
        }
      } catch {
        // Keep polling; provider polling can be temporarily unavailable.
      }
    };
    const timer = window.setInterval(() => void poll(), 3500);
    void poll();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [run?.runId, activeRun]);

  return <section className={styles.panel} id="direct-render">
    <div className={styles.head}>
      <div>
        <span className={styles.eyebrow}>DIRECT RENDER · ไม่ผ่าน AI AGENT</span>
        <h3>สร้าง Prompt แล้วส่งตรงไปโมเดลวิดีโอ</h3>
        <p>SCENOVA จะใช้ Scene, Shot, กล้อง, เลนส์, Action, Dialogue, แสง,เสียง และ Continuity ที่คุณกำหนดไว้ แล้วรวมหลาย Scene ที่อยู่ในช่วงเวลาที่โมเดลรองรับเป็น Prompt เดียว / Provider Request เดียว</p>
      </div>
      <span className={styles.mode}>Direct Generation</span>
    </div>

    <div className={styles.summary}>
      <article><small>โมเดล</small><b>{modelLabel}</b></article>
      <article><small>เวลาวิดีโอทั้งหมด</small><b>{sourceEpisode?.duration || 0} วินาที</b></article>
      <article><small>ช่วงสร้างตามข้อจำกัดโมเดล</small><b className={styles.accent}>{promptData?.segments?.length || Math.max(1, Math.ceil(Number(sourceEpisode?.duration || 1) / Math.max(1, Number(promptData?.maxSecondsPerGeneration || 1))))} ช่วง</b></article>
      <article><small>Prompt Composer</small><b>{promptData?.composer === "openai-production-prompt" ? "OpenAI" : promptData?.composer ? "SCENOVA" : "รอสร้าง Prompt"}</b></article>
    </div>

    <div className={styles.actions}>
      <button type="button" className={styles.secondary} onClick={() => void createPrompts()} disabled={promptBusy || activeRun}>{promptBusy ? "กำลังสร้าง Prompt..." : "✦ สร้าง Prompt"}</button>
      <button type="button" className={styles.secondary} onClick={() => void copySegment()} disabled={!selectedPrompt}>คัดลอก Prompt ช่วงนี้</button>
      <button type="button" className={styles.secondary} onClick={() => void copyAll()} disabled={!allPromptText}>คัดลอกทั้งหมด</button>
      <button type="button" className={styles.primary} onClick={() => void startRender()} disabled={renderBusy || activeRun || modelMode !== "generate" || !modelReady}>{renderBusy ? "กำลังเริ่ม..." : "▶ สร้างวิดีโอตรง"}</button>
      {activeRun ? <button type="button" className={styles.danger} onClick={() => void cancelRender()} disabled={renderBusy}>ยกเลิกงาน</button> : null}
    </div>
    <p className={styles.hint}><strong>หลักการ:</strong> Scene ไม่เท่ากับ Render Job — ระบบจะแตก Generation Segment เฉพาะเมื่อเวลารวมเกินเพดานของรุ่นที่เลือกเท่านั้น เช่น Veo 8s จะสร้างเป็นช่วง 0–8, 8–16… แต่ในแต่ละช่วงยังมีหลาย Scene/Shot ได้</p>

    {notice ? <p className={styles.hint}>{notice}</p> : null}
    {error ? <div className={styles.error}>{error}</div> : null}

    {promptData?.segments?.length ? <>
      <div className={styles.segmentTabs}>
        {promptData.segments.map((segment) => {
          const job = run?.segments?.find((item) => item.order === segment.order);
          return <button type="button" key={segment.order} className={`${styles.segmentTab} ${selectedOrder === segment.order ? styles.active : ""} ${job?.status === "COMPLETED" ? styles.done : ""} ${job?.status === "FAILED" ? styles.failed : ""}`} onClick={() => setSelectedOrder(segment.order)}>
            <strong>ช่วงสร้าง {segment.order}</strong>
            <span>{segment.start}–{segment.end}s · {segment.sourceSceneIds.map(sceneName).join(" + ") || "Timeline"}</span>
          </button>;
        })}
      </div>
      {selectedPrompt ? <div className={styles.promptBox}>
        <div className={styles.promptHead}><div><b>Production Prompt · ช่วงสร้าง {selectedPrompt.order}</b><small>{selectedPrompt.start}–{selectedPrompt.end} วินาที · {selectedPrompt.duration} วินาทีต่อ Provider Request</small></div><button type="button" onClick={() => void copySegment()}>Copy</button></div>
        <textarea className={styles.prompt} readOnly value={selectedPrompt.copyText} aria-label={`Prompt ช่วงสร้าง ${selectedPrompt.order}`} />
      </div> : null}
    </> : null}

    {run?.runId ? <div className={styles.progress}>
      <div className={styles.progressHead}><b>Direct Render · {run.status || "READY"}</b><span>{run.percent || 0}%</span></div>
      <div className={styles.track}><div className={styles.bar} style={{ width: `${Math.max(0, Math.min(100, run.percent || 0))}%` }} /></div>
      <div className={styles.jobs}>{(run.segments || []).map((segment) => <article className={styles.job} key={segment.id}>
        <span className={styles.index}>{String(segment.order).padStart(2, "0")}</span>
        <div><strong>ช่วงสร้าง {segment.order} · {segment.start}–{segment.end}s</strong><small>{segment.provider} · {segment.duration}s{segment.estimatedCostThb ? ` · ประมาณ ฿${segment.estimatedCostThb.toFixed(2)}` : " · BYOK"}</small></div>
        <span className={`${styles.status} ${statusClass(segment.status)}`}>{statusLabel(segment.status)}</span>
        {segment.outputUrl ? <div className={styles.output}><video src={segment.outputUrl} controls preload="metadata" /><a href={segment.outputUrl} target="_blank" rel="noreferrer">เปิดไฟล์จาก Provider ↗</a></div> : null}
        {segment.error ? <div className={styles.outputError}>{segment.error}</div> : null}
      </article>)}</div>
    </div> : null}
  </section>;
}
