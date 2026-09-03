"use client";

import { useEffect, useState } from "react";
import { agentStructuredPlanSchema, type AgentPlanEpisode, type AgentPlanScene, type AgentStructuredPlan } from "@/lib/agent/plan-schema";
import { clearPendingAgentPlan, readPendingAgentPlan, type AgentPlanTransferEnvelope } from "@/lib/agent/plan-transfer-client";
import styles from "./agent-plan-apply-bridge.module.css";

const SERIES_KEY = "scenova-series-workspace-v3";
type ApplyMode = "replace" | "merge";

type SeriesScene = {
  id: string; title: string; duration: number; action: string; location: string; objective: string; beat: string; transition: string;
  shot: string; angle: string; lens: string; movement: string; height: string; lighting: string; emotion: string; dialogue: string;
  sound: string; secondarySound: string; sfx: string; sfxTimeline: string; music: string; ambienceLevel: number; sfxLevel: number;
  dialogueLevel: number; musicLevel: number; focus: string; dof: string; composition: string; cameraSpeed: string; performance: string;
  colorTemp: string; continuityNote: string;
};
type EpisodeRecord = { id: string; number: number; title: string; duration: number; synopsis: string; continuityStart: string; endingState: string; status: "draft" | "ready" | "completed"; scenes: SeriesScene[]; createdAt: string; updatedAt: string };
type SeriesRecord = { title: string; premise: string; model: string; visualStyle: string; aspect: string; canonRules: string; characterBible: string; locks: string[]; updatedAt: string; episodes: EpisodeRecord[] };

function compact(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function safeId(prefix: string, suffix: string | number) {
  return `${prefix}_${Date.now()}_${String(suffix).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function cameraParts(scene: AgentPlanScene) {
  const primary = scene.shots[0];
  return {
    shot: primary?.camera || scene.camera || "Medium",
    angle: primary?.angle || scene.angle || "Eye Level",
    lens: primary?.lens || scene.lens || "50mm",
    movement: primary?.movement || scene.movement || "Static",
  };
}

function mapScene(scene: AgentPlanScene, index: number, continuityStart: string): SeriesScene {
  const camera = cameraParts(scene);
  const extraShots = scene.shots.length > 1
    ? `\nSHOT PLAN:\n${scene.shots.map((shot, shotIndex) => `${shotIndex + 1}. ${[shot.camera, shot.angle, shot.lens, shot.movement, shot.subject, shot.action, shot.dialogue].filter(Boolean).join(" · ")}`).join("\n")}`
    : "";
  return {
    id: scene.sceneId || safeId("ss", index + 1),
    title: scene.title || `Scene ${String(index + 1).padStart(2, "0")}`,
    duration: scene.durationSec,
    action: `${scene.action}${extraShots}`.trim(),
    location: scene.location || "ยังไม่ระบุสถานที่",
    objective: scene.objective || "Reveal Information",
    beat: index === 0 ? "Opening" : "Turn",
    transition: "Hard Cut",
    shot: camera.shot,
    angle: camera.angle,
    lens: camera.lens,
    movement: camera.movement,
    height: "Eye",
    lighting: scene.lighting || "Natural Soft",
    emotion: scene.mood || "Natural",
    dialogue: scene.dialogue || "",
    sound: scene.sound || "Room Tone",
    secondarySound: "Silence",
    sfx: "None",
    sfxTimeline: "",
    music: "None",
    ambienceLevel: 55,
    sfxLevel: 80,
    dialogueLevel: 100,
    musicLevel: 35,
    focus: "Auto Subject",
    dof: "Natural",
    composition: "Rule of Thirds",
    cameraSpeed: "Normal",
    performance: "Natural",
    colorTemp: "Neutral 4500K",
    continuityNote: [continuityStart, scene.negativePrompt && `AVOID: ${scene.negativePrompt}`].filter(Boolean).join("\n"),
  };
}

function mapEpisode(episode: AgentPlanEpisode, numberOverride?: number): EpisodeRecord {
  const now = new Date().toISOString();
  const number = numberOverride || episode.episodeNumber;
  return {
    id: episode.episodeId || safeId("episode", number),
    number,
    title: episode.title,
    duration: episode.durationSec,
    synopsis: episode.synopsis,
    continuityStart: episode.continuityStart,
    endingState: episode.endingState,
    status: "draft",
    scenes: episode.scenes.map((scene, index) => mapScene(scene, index, index === 0 ? episode.continuityStart : "")),
    createdAt: now,
    updatedAt: now,
  };
}

function characterBible(plan: AgentStructuredPlan) {
  const characters = plan.characters.map((character) => [
    `# ${character.name} — ${character.role || "ไม่ระบุบทบาท"}`,
    character.appearance && `Appearance: ${character.appearance}`,
    character.costume && `Costume: ${character.costume}`,
    character.personality && `Personality: ${character.personality}`,
    character.voice && `Voice: ${character.voice}`,
  ].filter(Boolean).join("\n"));
  if (plan.relationships.length) characters.push(`# Relationships\n${plan.relationships.map((item) => `- ${item}`).join("\n")}`);
  return characters.join("\n\n");
}

function canonContext(plan: AgentStructuredPlan) {
  return [
    plan.seriesBible,
    plan.locations.length ? `# Locations\n${plan.locations.map((item) => `- ${item}`).join("\n")}` : "",
    plan.props.length ? `# Props\n${plan.props.map((item) => `- ${item}`).join("\n")}` : "",
    plan.prompt ? `# Master Prompt\n${plan.prompt}` : "",
    plan.negativePrompt ? `# Negative Prompt\n${plan.negativePrompt}` : "",
  ].filter(Boolean).join("\n\n");
}

function readCurrentSeries(): SeriesRecord | null {
  try {
    const raw = window.localStorage.getItem(SERIES_KEY);
    return raw ? JSON.parse(raw) as SeriesRecord : null;
  } catch {
    return null;
  }
}

function safeCurrent(current: SeriesRecord | null): SeriesRecord {
  const now = new Date().toISOString();
  return current || { title: "Untitled Series", premise: "", model: "Seedance 2.5", visualStyle: "Cinematic Anime — อนิเมะภาพยนตร์", aspect: "16:9", canonRules: "", characterBible: "", locks: [], updatedAt: now, episodes: [] };
}

function mergeText(current: string, incoming: string) {
  if (!incoming.trim()) return current;
  if (!current.trim()) return incoming.trim();
  if (current.includes(incoming.trim())) return current;
  return `${current.trim()}\n\n${incoming.trim()}`;
}

function applySeriesPlan(plan: AgentStructuredPlan, mode: ApplyMode) {
  const current = safeCurrent(readCurrentSeries());
  const now = new Date().toISOString();
  const mappedEpisodes = plan.episodes.map((episode) => mapEpisode(episode));
  let next: SeriesRecord;

  if (mode === "replace") {
    next = {
      ...current,
      title: plan.title,
      premise: plan.synopsis,
      // Agent is not allowed to choose/change the video model.
      model: current.model,
      visualStyle: plan.visualStyle || current.visualStyle,
      aspect: plan.aspectRatio || current.aspect,
      canonRules: canonContext(plan),
      characterBible: characterBible(plan),
      locks: [...new Set(plan.continuity.lockedFields)],
      updatedAt: now,
      episodes: mappedEpisodes,
    };
  } else {
    const nextStart = Math.max(0, ...current.episodes.map((episode) => episode.number)) + 1;
    const appended = plan.episodes.map((episode, index) => mapEpisode(episode, nextStart + index));
    next = {
      ...current,
      title: compact(current.title).toLocaleLowerCase() === "untitled series" ? plan.title : current.title,
      premise: mergeText(current.premise, plan.synopsis),
      model: current.model,
      visualStyle: current.visualStyle || plan.visualStyle,
      aspect: current.aspect || plan.aspectRatio,
      canonRules: mergeText(current.canonRules, canonContext(plan)),
      characterBible: mergeText(current.characterBible, characterBible(plan)),
      locks: [...new Set([...current.locks, ...plan.continuity.lockedFields])],
      updatedAt: now,
      episodes: [...current.episodes, ...appended],
    };
  }
  window.localStorage.setItem(SERIES_KEY, JSON.stringify(next));
  return next;
}

export default function AgentPlanSeriesBridge() {
  const [envelope, setEnvelope] = useState<AgentPlanTransferEnvelope | null>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("กำลังตรวจสิทธิ์ของแผน...");
  const [error, setError] = useState("");

  useEffect(() => {
    const pending = readPendingAgentPlan();
    if (!pending || pending.target !== "series" || pending.projectKey !== "series:workspace-v3") return;
    const parsed = agentStructuredPlanSchema.safeParse(pending.plan);
    if (!parsed.success || parsed.data.target !== "series") {
      clearPendingAgentPlan();
      setError("แผน Agent ไม่ผ่าน Schema Validation");
      return;
    }
    const next = { ...pending, plan: parsed.data };
    setEnvelope(next);
    void (async () => {
      try {
        const response = await fetch("/api/agent/plan/transfer/validate", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: next.token, plan: next.plan, target: next.target, projectKey: next.projectKey }),
        });
        if (!response.ok) throw new Error("AGENT_PLAN_TRANSFER_FORBIDDEN");
        setVerified(true);
        setStatus("แผนผ่านการตรวจสิทธิ์แล้ว เลือกวิธีนำไปใช้");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "ตรวจสิทธิ์แผนไม่สำเร็จ");
      }
    })();
  }, []);

  if (!envelope) return null;
  const plan = envelope.plan;

  function apply(mode: ApplyMode) {
    if (!verified || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = applySeriesPlan(plan, mode);
      clearPendingAgentPlan();
      setStatus(`นำแผนเข้า Series Studio แล้ว · ${next.episodes.length} Episodes · ยังไม่ได้เริ่มสร้างวิดีโอ`);
      window.setTimeout(() => window.location.replace("/series#overview"), 700);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "นำแผนเข้า Series Studio ไม่สำเร็จ");
      setBusy(false);
    }
  }

  return <div className={styles.backdrop} role="presentation">
    <section className={styles.modal} role="dialog" aria-modal="true" aria-label="นำแผน Agent ไปใช้ใน Series Studio">
      <div className={styles.head}><span className={styles.eyebrow}>AGENT → SERIES STUDIO · VALIDATED PLAN</span><h2>นำ “{plan.title}” มาใส่ใน Series Studio</h2><p>Series Bible, Character Bible, Episode Synopsis, Continuity Start, Ending State และ Storyboard Scenes จะถูกแปลงเป็นโครงสร้าง Workspace จริง โดยคง Video Model เดิมไว้เสมอ</p></div>
      <div className={styles.body}>
        <div className={styles.summary}><article><small>Episodes</small><b>{plan.episodes.length}</b></article><article><small>ตัวละครประจำ</small><b>{plan.characters.length}</b></article><article><small>Warnings</small><b>{plan.warnings.length}</b></article></div>
        <div className={styles.notice}><strong>“แทนที่”</strong> จะเปลี่ยน Bible/Episodes หลังยืนยัน แต่ไม่เปลี่ยน Model ส่วน <strong>“เพิ่มต่อ”</strong> จะเก็บข้อมูลเดิมและต่อ Episode ใหม่ด้านท้าย</div>
        {plan.warnings.length ? <div className={styles.warningBox}>{plan.warnings.slice(0, 8).map((warning, index) => <div className={styles.warning} key={index}>⚠ {warning}</div>)}</div> : null}
      </div>
      <div className={styles.actions}><span className={`${styles.status} ${error ? styles.error : ""}`}>{error || status}</span><button type="button" onClick={() => { clearPendingAgentPlan(); setEnvelope(null); }} disabled={busy}>ยกเลิก</button><button type="button" onClick={() => apply("merge")} disabled={!verified || busy}>เพิ่มต่อ</button><button type="button" className={styles.primary} onClick={() => apply("replace")} disabled={!verified || busy}>แทนที่</button></div>
    </section>
  </div>;
}
