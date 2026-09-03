"use client";

import { useEffect, useMemo, useState } from "react";
import type { Project, PromptBundle, RenderSegment } from "@/lib/domain";
import { CINEMATIC_COVERAGE_PRESETS, type CinematicCoveragePreset } from "@/lib/cinematic-coverage-presets";
import { SCENOVA_BOT_IMAGE } from "@/lib/scenova-bot-image";
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

type CoverageShot = {
  sceneId: string;
  start: number;
  end: number;
  subject: string;
  coverageRole: string;
  cameraSlot: string;
  shotType: string;
  angle: string;
  lensMm: number;
  movement: string;
  screenDirection: string;
  eyelineTarget: string;
  transitionIn: string;
  transitionOut: string;
  continuityAnchor: string;
};

type CoveragePlan = {
  schemaVersion: "1.0";
  presetId: string;
  summary: string;
  axisOfAction: string;
  spatialMap: string;
  lightingAnchor: string;
  continuityRules: string[];
  warnings: string[];
  shots: CoverageShot[];
};

type PromptResponse = {
  ok?: boolean;
  error?: string;
  providerId?: string;
  providerName?: string;
  billingMode?: string;
  maxSecondsPerGeneration?: number;
  supportsMultiShot?: boolean;
  editorialShotCount?: number;
  composer?: string;
  videoConnectionRequired?: boolean;
  renderProject?: Project;
  coverage?: CoveragePlan;
  coverageMeta?: {
    modelId?: string;
    costThb?: number;
    preset?: CinematicCoveragePreset;
  };
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

type CoverageCategory = "all" | CinematicCoveragePreset["category"];

const COVERAGE_CATEGORIES: Array<{ id: CoverageCategory; label: string }> = [
  { id: "all", label: "ทั้งหมด" },
  { id: "dialogue", label: "สนทนา" },
  { id: "action", label: "Action" },
  { id: "suspense", label: "ระทึก" },
  { id: "drama", label: "Drama" },
  { id: "cinematic", label: "Cinematic" },
  { id: "narrative", label: "Narrative" },
];

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

function composerLabel(value?: string) {
  if (!value) return "รอ AI สร้าง Prompt";
  if (value.startsWith("ai-brain:")) return `AI Brain · ${value.slice("ai-brain:".length)}`;
  if (value === "ai-brain-production-prompt") return "AI Brain";
  if (value === "openai-production-prompt") return "OpenAI";
  if (value === "mock-prompt-assistant") return "SCENOVA Rules";
  return "AI Brain";
}

function providerConnectionMessage(providerId: string, modelLabel: string) {
  const provider = providerId === "veo" ? "Veo — Google"
    : providerId === "runway" ? "Runway Developer API"
      : providerId === "kling" ? "Kling"
        : providerId === "wan" ? "Wan"
          : modelLabel || providerId;
  return `ยังไม่ได้เชื่อมต่อ Video Provider สำหรับ ${provider} กรุณาไปที่ การตั้งค่า → API Connections → สร้างคลิป (VIDEO) แล้วเชื่อมต่อคีย์ก่อนกด Generate`;
}

function renderErrorMessage(value: string, providerId: string, modelLabel: string) {
  if (value.includes("VIDEO_PROVIDER_CONNECTION_REQUIRED")) return providerConnectionMessage(providerId, modelLabel);
  if (value === "INSUFFICIENT_CREDITS") return "เครดิตไม่เพียงพอสำหรับ Generate งานนี้ กรุณาเติมเครดิตก่อนเริ่มสร้าง";
  return value;
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
  const [coveragePresetId, setCoveragePresetId] = useState("creature-encounter");
  const [coverageInstruction, setCoverageInstruction] = useState("");
  const [coverageCategory, setCoverageCategory] = useState<CoverageCategory>("all");
  const [coverageSearch, setCoverageSearch] = useState("");
  const [finalReady, setFinalReady] = useState(false);
  const [finalFailed, setFinalFailed] = useState(false);
  const [hudCollapsed, setHudCollapsed] = useState(false);

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
    setFinalReady(false);
    setFinalFailed(false);
  }, [sourceSignature]);

  const selectedPreset = useMemo(
    () => CINEMATIC_COVERAGE_PRESETS.find((preset) => preset.id === coveragePresetId) || CINEMATIC_COVERAGE_PRESETS[10]!,
    [coveragePresetId],
  );
  const visiblePresets = useMemo(() => {
    const query = coverageSearch.trim().toLocaleLowerCase();
    return CINEMATIC_COVERAGE_PRESETS.filter((preset) => {
      if (coverageCategory !== "all" && preset.category !== coverageCategory) return false;
      if (!query) return true;
      return `${preset.nameTh} ${preset.nameEn} ${preset.descriptionTh}`.toLocaleLowerCase().includes(query);
    });
  }, [coverageCategory, coverageSearch]);

  const selectedPrompt = promptData?.segments?.find((segment) => segment.order === selectedOrder) || promptData?.segments?.[0];
  const sourceEpisode = (promptData?.renderProject || project).episodes[0];
  const sceneName = (id: string) => sourceEpisode?.segments.find((segment) => segment.id === id)?.title || id;
  const allPromptText = (promptData?.segments || []).map((segment) => segment.copyText).join("\n\n\n--- NEXT GENERATION SEGMENT ---\n\n");
  const activeRun = Boolean(run?.runId && !["COMPLETED", "FAILED", "CANCELLED"].includes(run.status || ""));
  const serverProviderReady = promptData ? promptData.videoConnectionRequired !== true : null;
  const providerReadyHint = serverProviderReady ?? modelReady;
  const finalVideoUrl = run?.runId && run.status === "COMPLETED"
    ? `/api/direct-render/final?runId=${encodeURIComponent(run.runId)}`
    : "";
  const finalDownloadUrl = finalVideoUrl ? `${finalVideoUrl}&download=1` : "";
  const currentRunSegment = run?.segments?.find((segment) => !["COMPLETED", "FAILED", "CANCELLED"].includes(segment.status));
  const assemblingFinal = Boolean(run?.runId && run.status === "COMPLETED" && !finalReady && !finalFailed);
  const hudVisible = promptBusy || renderBusy || activeRun || assemblingFinal || finalFailed;

  const hudState = useMemo(() => {
    if (finalFailed) return { title: "Final Assembly ต้องตรวจสอบ", detail: "คลิปย่อยสร้างครบแล้ว แต่การรวม Final Video มีปัญหา", percent: 100, tone: "error" };
    if (assemblingFinal) return { title: "กำลังประกอบ Final Video", detail: "SCENOVA Bot กำลังเรียง Shot, ต่อเสียง และตัดเวลาให้ตรง Timeline", percent: 96, tone: "assemble" };
    if (promptBusy) return { title: "AI Brain กำลังวาง Coverage", detail: `${selectedPreset.nameTh} · วิเคราะห์มุมกล้อง, eyeline, 180° axis และ Continuity`, percent: 14, tone: "brain" };
    if (renderBusy && !run?.runId) return { title: "กำลังเตรียม Generate", detail: "ตรวจ Video Provider, Prompt และ Shot Timeline", percent: 24, tone: "prepare" };
    if (activeRun) {
      const status = currentRunSegment?.status || run?.status || "READY";
      const action = status === "SUBMITTING" ? "กำลังส่ง Shot ไป Provider"
        : status === "QUEUED" ? "Provider รับงานแล้ว · กำลังรอคิว"
          : status === "GENERATING" ? "กำลังสร้าง Shot ตามมุมกล้องที่วางไว้"
            : "กำลังเตรียม Shot ถัดไป";
      return {
        title: action,
        detail: currentRunSegment ? `Shot/ช่วง ${currentRunSegment.order} · ${currentRunSegment.start}-${currentRunSegment.end}s · ${modelLabel}` : modelLabel,
        percent: Math.max(1, run?.percent || 1),
        tone: "generate",
      };
    }
    return { title: "SCENOVA Bot พร้อมทำงาน", detail: "เลือก Coverage แล้วกดสร้าง Prompt", percent: 0, tone: "idle" };
  }, [activeRun, assemblingFinal, currentRunSegment, finalFailed, modelLabel, promptBusy, renderBusy, run?.percent, run?.runId, run?.status, selectedPreset.nameTh]);

  function invalidatePrompt() {
    setPromptData(null);
    setRun(null);
    setSelectedOrder(1);
    setFinalReady(false);
    setFinalFailed(false);
    setError("");
    setNotice("");
  }

  function choosePreset(id: string) {
    setCoveragePresetId(id);
    invalidatePrompt();
  }

  async function createPrompts() {
    if (promptBusy) return null;
    setPromptBusy(true);
    setHudCollapsed(false);
    setError("");
    setNotice(`กำลังให้ AI Brain วิเคราะห์เรื่องและวาง Cinematic Coverage แบบ “${selectedPreset.nameTh}” ก่อนสร้าง Production Prompt...`);
    try {
      const response = await fetch("/api/direct-render/prompt", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          providerId,
          modelVersionId,
          coveragePresetId,
          coverageInstruction,
        }),
      });
      const data = await response.json() as PromptResponse;
      if (!response.ok || !Array.isArray(data.segments)) throw new Error(data.error || "สร้าง Prompt ไม่สำเร็จ");
      setPromptData(data);
      setSelectedOrder(data.segments[0]?.order || 1);
      const shotCount = data.coverage?.shots.length || data.editorialShotCount || 0;
      setNotice(`AI วาง Coverage ${shotCount} Shot และสร้าง Prompt แล้ว · ${composerLabel(data.composer)} · ${data.segments.length} Generation Segment ภายใน · ผลลัพธ์สุดท้าย 1 คลิป`);
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
    setRenderBusy(true);
    setHudCollapsed(false);
    setFinalReady(false);
    setFinalFailed(false);
    setError("");
    setNotice("กำลังตรวจ Video Provider และเตรียม Generate จาก Cinematic Shot Timeline...");
    try {
      const prompts = promptData?.segments?.length ? promptData : await createPrompts();
      if (!prompts?.segments?.length) throw new Error("กรุณาสร้าง Prompt ก่อน Generate");
      if (prompts.videoConnectionRequired === true) throw new Error(providerConnectionMessage(providerId, modelLabel));
      const response = await fetch("/api/direct-render", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: prompts.renderProject || project,
          providerId,
          modelVersionId,
          promptSegments: prompts.segments,
        }),
      });
      const data = await response.json() as RunResponse;
      if (!response.ok || !data.runId) throw new Error(renderErrorMessage(data.error || "เริ่ม Generate ไม่สำเร็จ", providerId, modelLabel));
      setRun(data);
      setNotice("เริ่ม Generate แล้ว · SCENOVA จะสร้าง Shot/Generation Segment ภายในตามความสามารถโมเดล แล้วประกอบเป็น Final Video 1 คลิป");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "เริ่ม Generate ไม่สำเร็จ";
      setError(renderErrorMessage(message, providerId, modelLabel));
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
      if (!response.ok) throw new Error(data.error || "ยกเลิก Generate ไม่สำเร็จ");
      setRun(data);
      setNotice("ยกเลิก Generate แล้ว งานที่ Provider สร้างเสร็จไปแล้วจะยังคงอยู่");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ยกเลิก Generate ไม่สำเร็จ");
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
          if (data.status === "COMPLETED") setNotice("สร้างครบทุก Shot แล้ว · SCENOVA Bot กำลังประกอบเป็น Final Video 1 คลิป");
          if (data.status === "FAILED") setError(data.segments?.find((segment) => segment.status === "FAILED")?.error || "Generate มีช่วงที่สร้างไม่สำเร็จ");
        }
      } catch {
        // Keep polling; provider polling can be temporarily unavailable.
      }
    };
    const timer = window.setInterval(() => void poll(), 3500);
    void poll();
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [run?.runId, activeRun]);

  return <>
    <section className={styles.panel} id="direct-render">
      <div className={styles.head}>
        <div>
          <span className={styles.eyebrow}>CINEMATIC COVERAGE → AI PROMPT → GENERATE</span>
          <h3>AI Brain วางมุมกล้องแบบหนัง แล้วสร้าง Final Video ต่อเนื่อง</h3>
          <p>AI จะวิเคราะห์เรื่องก่อนวาง Shot / Reverse Shot, Reaction, POV, OTS, Insert, Master และการกลับมามุมเดิม พร้อมล็อก 180° axis, eyeline, screen direction, ตัวละคร, เสื้อผ้า, Location, Props และแสง ก่อนส่งไปโมเดลวิดีโอ ระบบอาจสร้างไฟล์ย่อยภายใน แต่ผู้ใช้จะได้รับ Final Video 1 คลิป</p>
        </div>
        <span className={styles.mode}>Cinematic Coverage Director</span>
      </div>

      <div className={styles.summary}>
        <article><small>โมเดลวิดีโอ</small><b>{modelLabel}</b></article>
        <article><small>เวลาวิดีโอทั้งหมด</small><b>{sourceEpisode?.duration || 0} วินาที</b></article>
        <article><small>Editorial Shots</small><b className={styles.accent}>{promptData?.coverage?.shots.length || "AI วางให้"}</b></article>
        <article><small>ผลลัพธ์สุดท้าย</small><b>Final Video 1 คลิป</b></article>
      </div>

      <div className={styles.coverageDirector}>
        <div className={styles.coverageTitle}>
          <div><span>🎬 CINEMATIC COVERAGE</span><h4>เลือกวิธีเล่าเรื่องด้วยมุมกล้อง</h4><p>มี 30 แบบให้เลือก หรือเลือกแล้วพิมพ์คำสั่งเพิ่มได้ เช่น “เน้นหน้าเด็กแล้วตัดกลับไปสัตว์ประหลาดหลายครั้ง”</p></div>
          <strong>30 PRESETS</strong>
        </div>
        <div className={styles.coverageToolbar}>
          <div className={styles.coverageCategories}>{COVERAGE_CATEGORIES.map((item) => <button type="button" key={item.id} className={coverageCategory === item.id ? styles.coverageCategoryActive : ""} onClick={() => setCoverageCategory(item.id)}>{item.label}</button>)}</div>
          <input value={coverageSearch} onChange={(event) => setCoverageSearch(event.target.value)} placeholder="ค้นหา เช่น POV, Reaction, Action, Twist..." aria-label="ค้นหา Cinematic Coverage" />
        </div>
        <div className={styles.presetGrid}>
          {visiblePresets.map((preset) => <button type="button" key={preset.id} className={`${styles.presetCard} ${coveragePresetId === preset.id ? styles.presetActive : ""}`} onClick={() => choosePreset(preset.id)}>
            <span>{preset.nameTh}</span><b>{preset.nameEn}</b><small>{preset.descriptionTh}</small>
          </button>)}
        </div>
        <div className={styles.selectedCoverage}>
          <div><small>เลือกอยู่</small><strong>{selectedPreset.nameTh}</strong><span>{selectedPreset.descriptionTh}</span></div>
          <textarea value={coverageInstruction} onChange={(event) => { setCoverageInstruction(event.target.value); invalidatePrompt(); }} placeholder="คำสั่งเพิ่มเติม (ไม่บังคับ) เช่น: กลับมาที่ Close-up ตัวละคร A อย่างน้อย 3 ครั้ง, ใช้ foreground wipe ตอนเปลี่ยนมุม, ห้ามข้ามแกน 180°" aria-label="คำสั่ง Cinematic Coverage เพิ่มเติม" />
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={() => void createPrompts()} disabled={promptBusy || activeRun}>{promptBusy ? "AI กำลังวิเคราะห์ + สร้าง Prompt..." : "✦ วิเคราะห์ Coverage + สร้าง Prompt"}</button>
        <button type="button" className={styles.secondary} onClick={() => void copySegment()} disabled={!selectedPrompt}>คัดลอก Prompt ช่วงนี้</button>
        <button type="button" className={styles.secondary} onClick={() => void copyAll()} disabled={!allPromptText}>คัดลอกทั้งหมด</button>
        <button type="button" className={styles.primary} onClick={() => void startRender()} disabled={renderBusy || activeRun || modelMode !== "generate"}>{renderBusy ? "กำลัง Generate..." : "Generate"}</button>
        {activeRun ? <button type="button" className={styles.danger} onClick={() => void cancelRender()} disabled={renderBusy}>ยกเลิกงาน</button> : null}
      </div>
      <p className={styles.hint}><strong>Video Provider:</strong> {providerReadyHint ? "พร้อมตรวจสอบและ Generate" : "เมื่อกด Generate ระบบจะตรวจ Connection จาก Server อีกครั้ง"}</p>
      <p className={styles.hint}><strong>Continuity:</strong> ระบบใช้ Camera Slot, 180° Axis, Screen Direction, Eyeline และ Spatial Anchor เพื่อให้ตัด A → B → A หรือ POV → Reaction → POV แล้วกลับมามุมเดิมได้อย่างต่อเนื่อง</p>

      {promptData?.videoConnectionRequired === true ? <div className={styles.error}>{providerConnectionMessage(providerId, modelLabel)}</div> : null}
      {notice ? <p className={styles.hint}>{notice}</p> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      {promptData?.coverage ? <div className={styles.coverageResult}>
        <div className={styles.coverageResultHead}>
          <div><span>AI COVERAGE PLAN</span><strong>{promptData.coverage.summary}</strong><small>{promptData.coverage.shots.length} Shots · {promptData.coverageMeta?.modelId || "System AI"}</small></div>
          <b>{promptData.supportsMultiShot ? "Native Multi-Shot" : "Shot-level Assembly"}</b>
        </div>
        <div className={styles.continuityStrip}>
          <span><b>180° Axis</b>{promptData.coverage.axisOfAction}</span>
          <span><b>Spatial</b>{promptData.coverage.spatialMap}</span>
          <span><b>Lighting</b>{promptData.coverage.lightingAnchor}</span>
        </div>
        <div className={styles.shotTimeline}>{promptData.coverage.shots.map((shot, index) => <article key={`${shot.sceneId}-${index}`}>
          <i>{String(index + 1).padStart(2, "0")}</i>
          <div><strong>{shot.start.toFixed(1)}–{shot.end.toFixed(1)}s · {shot.coverageRole}</strong><span>{shot.cameraSlot} · {shot.shotType} · {shot.angle} · {shot.lensMm}mm</span><small>{shot.subject} · {shot.transitionOut}</small></div>
        </article>)}</div>
        {promptData.coverage.warnings.length ? <div className={styles.coverageWarnings}>{promptData.coverage.warnings.map((warning) => <span key={warning}>⚠ {warning}</span>)}</div> : null}
      </div> : null}

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
          <div className={styles.promptHead}><div><b>AI Production Prompt · ช่วงสร้าง {selectedPrompt.order}</b><small>{selectedPrompt.start}–{selectedPrompt.end} วินาที · {selectedPrompt.duration} วินาทีต่อ Provider Request</small></div><button type="button" onClick={() => void copySegment()}>Copy</button></div>
          <textarea className={styles.prompt} readOnly value={selectedPrompt.copyText} aria-label={`Prompt ช่วงสร้าง ${selectedPrompt.order}`} />
        </div> : null}
      </> : null}

      {run?.runId ? <div className={styles.progress}>
        <div className={styles.progressHead}><b>Generate · {run.status || "READY"}</b><span>{run.percent || 0}%</span></div>
        <div className={styles.track}><div className={styles.bar} style={{ width: `${Math.max(0, Math.min(100, run.percent || 0))}%` }} /></div>

        {finalVideoUrl ? <div className={styles.finalOutput}>
          <div className={styles.finalHead}>
            <div><strong>Final Video · {sourceEpisode?.duration || 0} วินาที</strong><small>รวม {(run.segments || []).length} งานภายในเป็นวิดีโอเดียวอัตโนมัติ</small></div>
            <span>FINAL</span>
          </div>
          <video
            key={finalVideoUrl}
            src={finalVideoUrl}
            controls
            preload="metadata"
            onCanPlay={() => { setFinalReady(true); setFinalFailed(false); setNotice("Final Video พร้อมแล้ว · รวมทุกมุมกล้องเป็นคลิปเดียวเรียบร้อย"); }}
            onError={() => { setFinalFailed(true); setError("รวม Final Video ไม่สำเร็จ กรุณาลองโหลดใหม่ หากยังมีปัญหาให้ตรวจไฟล์ย่อยด้านล่าง"); }}
          />
          <div className={styles.finalActions}><a href={finalDownloadUrl}>ดาวน์โหลด Final Video</a></div>
        </div> : null}

        <details className={styles.segmentDetails}>
          <summary>รายละเอียดงานภายใน ({(run.segments || []).length} ช่วง/Shot)</summary>
          <div className={styles.jobs}>{(run.segments || []).map((segment) => <article className={styles.job} key={segment.id}>
            <span className={styles.index}>{String(segment.order).padStart(2, "0")}</span>
            <div><strong>ช่วงสร้าง {segment.order} · {segment.start}–{segment.end}s</strong><small>{segment.provider} · {segment.duration}s{segment.estimatedCostThb ? ` · ประมาณ ฿${segment.estimatedCostThb.toFixed(2)}` : " · BYOK"}</small></div>
            <span className={`${styles.status} ${statusClass(segment.status)}`}>{statusLabel(segment.status)}</span>
            {segment.outputUrl ? <div className={styles.segmentLink}><a href={segment.outputUrl} target="_blank" rel="noreferrer">เปิดไฟล์ย่อยจาก Provider ↗</a></div> : null}
            {segment.error ? <div className={styles.outputError}>{segment.error}</div> : null}
          </article>)}</div>
        </details>
      </div> : null}
    </section>

    {hudVisible ? <aside className={`${styles.generationHud} ${hudCollapsed ? styles.hudCollapsed : ""}`} aria-live="polite">
      <button type="button" className={styles.hudToggle} onClick={() => setHudCollapsed((value) => !value)} aria-label={hudCollapsed ? "ขยายสถานะ Generate" : "ย่อสถานะ Generate"}>{hudCollapsed ? "+" : "−"}</button>
      <div className={styles.botStage}>
        <span className={styles.botAura} />
        <img src={SCENOVA_BOT_IMAGE} alt="SCENOVA Bot" className={styles.botImage} />
        <span className={styles.botShadow} />
      </div>
      <div className={styles.hudCopy}>
        <small>SCENOVA BOT · LIVE PRODUCTION</small>
        <strong>{hudState.title}</strong>
        {!hudCollapsed ? <><span>{hudState.detail}</span><div className={styles.hudTrack}><i style={{ width: `${Math.max(3, Math.min(100, hudState.percent))}%` }} /></div><em>{hudState.percent}%</em></> : null}
      </div>
      {!hudCollapsed ? <div className={styles.botDots}><i /><i /><i /></div> : null}
    </aside> : null}
  </>;
}
