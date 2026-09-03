"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  agentStructuredPlanSchema,
  planFieldMappings,
  type AgentPlanTarget,
  type AgentStructuredPlan,
} from "@/lib/agent/plan-schema";
import { savePendingAgentPlan } from "@/lib/agent/plan-transfer-client";
import styles from "./agent-planner-workspace.module.css";

type RegenerateSection = "all" | "story" | "characters" | "scenes" | "dialogue" | "camera" | "continuity";

type PlanResponse = {
  ok?: boolean;
  error?: string;
  plan?: AgentStructuredPlan;
  meta?: { modelId?: string; plannerOnly?: boolean; videoGeneration?: boolean; walletCharge?: boolean };
};

const PARTIAL_OPTIONS: Array<{ value: RegenerateSection; label: string }> = [
  { value: "story", label: "เรื่อง / Synopsis / Prompt" },
  { value: "characters", label: "ตัวละคร" },
  { value: "scenes", label: "Scene / Shot" },
  { value: "dialogue", label: "Dialogue เท่านั้น" },
  { value: "camera", label: "Camera / Lens เท่านั้น" },
  { value: "continuity", label: "Continuity เท่านั้น" },
];

function targetLabel(target: AgentPlanTarget) {
  return target === "studio" ? "AI Studio" : "Series Studio";
}

function destination(target: AgentPlanTarget) {
  return target === "studio"
    ? { path: "/studio?agentPlan=1", projectKey: "studio:single-episode" }
    : { path: "/series?agentPlan=1", projectKey: "series:workspace-v3" };
}

export default function AgentPlannerWorkspace() {
  const router = useRouter();
  const [target, setTarget] = useState<AgentPlanTarget>("studio");
  const [instruction, setInstruction] = useState("");
  const [plan, setPlan] = useState<AgentStructuredPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [status, setStatus] = useState("พร้อมรับคำสั่ง — Agent จะสร้างแผนเท่านั้นและไม่เริ่มสร้างวิดีโอ");
  const [error, setError] = useState("");
  const [partialSection, setPartialSection] = useState<RegenerateSection>("scenes");
  const [showJson, setShowJson] = useState(false);

  const scenes = useMemo(() => {
    if (!plan) return [];
    return plan.target === "studio" ? plan.scenes : plan.episodes.flatMap((episode) => episode.scenes);
  }, [plan]);
  const mappings = useMemo(() => plan ? planFieldMappings(plan) : [], [plan]);

  function changeTarget(next: AgentPlanTarget) {
    if (busy || applyBusy) return;
    setTarget(next);
    if (plan?.target !== next) {
      setPlan(null);
      setStatus(`เปลี่ยนเป้าหมายเป็น ${targetLabel(next)} แล้ว กรุณาสร้างแผนใหม่`);
    }
  }

  async function createPlan(section: RegenerateSection = "all") {
    if (busy) return;
    if (instruction.trim().length < 3) {
      setError("กรุณาพิมพ์คำสั่งหรือเรื่องที่ต้องการให้ Agent วิเคราะห์ก่อน");
      return;
    }
    if (section !== "all" && !plan) {
      setError("ต้องมีแผนเดิมก่อนจึงจะสร้างใหม่เฉพาะส่วนได้");
      return;
    }

    setBusy(true);
    setError("");
    setStatus(section === "all" ? "กำลังวิเคราะห์เรื่องและสร้าง Structured Plan..." : `กำลังสร้างใหม่เฉพาะ ${PARTIAL_OPTIONS.find((item) => item.value === section)?.label || section}...`);
    const requestId = crypto.randomUUID();
    try {
      const response = await fetch("/api/agent/plan", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction,
          target,
          requestId,
          regenerateSection: section,
          existingPlan: section === "all" ? undefined : plan,
        }),
      });
      const data = await response.json() as PlanResponse;
      if (!response.ok || !data.plan) throw new Error(data.error || "AGENT_PLAN_FAILED");
      const validated = agentStructuredPlanSchema.parse(data.plan);
      setPlan(validated);
      setStatus(`สร้างแผนสำหรับ ${targetLabel(validated.target)} แล้ว · ${validated.characters.length} ตัวละคร · ${validated.target === "series" ? validated.episodes.length + " Episodes" : validated.scenes.length + " Scenes"} · กรุณาตรวจสอบก่อนนำไปใช้`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "สร้างแผนไม่สำเร็จ");
      setStatus("ยังไม่มีการเปลี่ยนข้อมูลใน Studio/Series");
    } finally {
      setBusy(false);
    }
  }

  async function applyTo(nextTarget: AgentPlanTarget) {
    if (!plan || applyBusy) return;
    if (plan.target !== nextTarget) {
      setError(`แผนนี้สร้างสำหรับ ${targetLabel(plan.target)} กรุณาเปลี่ยน Target แล้วสร้างแผนใหม่ก่อน`);
      return;
    }
    setApplyBusy(true);
    setError("");
    setStatus(`กำลังตรวจสิทธิ์และเตรียมนำแผนไป ${targetLabel(nextTarget)}...`);
    try {
      const dest = destination(nextTarget);
      const response = await fetch("/api/agent/plan/transfer", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, target: nextTarget, projectKey: dest.projectKey }),
      });
      const data = await response.json() as { ok?: boolean; token?: string; error?: string };
      if (!response.ok || !data.token) throw new Error(data.error || "AGENT_PLAN_TRANSFER_FAILED");
      savePendingAgentPlan({ plan, token: data.token, target: nextTarget, projectKey: dest.projectKey, createdAt: new Date().toISOString() });
      setStatus(`เปิด ${targetLabel(nextTarget)} เพื่อให้คุณเลือก “เพิ่มต่อ” หรือ “แทนที่” — ยังไม่เริ่มสร้างวิดีโอ`);
      router.push(dest.path);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "นำแผนไปใช้ไม่สำเร็จ");
      setApplyBusy(false);
    }
  }

  return <main className={styles.workspace}>
    <section className={styles.hero}>
      <div>
        <span className={styles.eyebrow}>SCENOVA AI PLANNING AGENT</span>
        <h1>เขียนบท วิเคราะห์ และจัดแผนก่อนเข้า Studio</h1>
        <p>Agent ทำหน้าที่เป็นผู้ช่วยวางเรื่อง ตัวละคร Scene / Shot กล้อง แสง เสียง Dialogue และ Continuity เท่านั้น แผนทุกชุดต้องให้คุณตรวจและกดนำไปใช้เองก่อน ระบบนี้ไม่เรียก Video API ไม่เลือก Provider และไม่เริ่ม Render อัตโนมัติ</p>
      </div>
      <span className={styles.plannerOnly}>PLANNER ONLY · NO VIDEO API</span>
    </section>

    <section className={styles.card}>
      <div className={styles.sectionHead}>
        <div><span className={styles.eyebrow}>1 · TARGET & INSTRUCTION</span><h2>บอก Agent ว่าต้องการสร้างอะไร</h2></div>
        <div className={styles.targetTabs}>
          <button type="button" data-active={target === "studio"} onClick={() => changeTarget("studio")}>AI Studio</button>
          <button type="button" data-active={target === "series"} onClick={() => changeTarget("series")}>Series Studio</button>
        </div>
      </div>
      <textarea className={styles.instruction} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder={target === "studio" ? "ตัวอย่าง: สร้างหนังสั้น 30 วินาที ตัวละครสองคนเผชิญหน้ากันในสถานีรถไฟร้าง ให้เริ่มจาก close-up คนแรกพูด... แล้วตัดไป reaction ของอีกคน..." : "ตัวอย่าง: วางซีรีส์ 4 Episode เกี่ยวกับ... ระบุตัวละครประจำ ความสัมพันธ์ Ending State ของแต่ละตอน และให้ตอนถัดไปต่อจากสถานะเดิม..."} />
      <div className={styles.actions}>
        <button type="button" className={styles.buttonGhost} onClick={() => void createPlan("all")} disabled={busy}>{busy ? "กำลังส่งคำสั่ง..." : "ส่งคำสั่ง"}</button>
        <button type="button" className={styles.buttonPrimary} onClick={() => void createPlan("all")} disabled={busy}>{busy ? "กำลังสร้างแผน..." : "✦ สร้างแผน"}</button>
        <button type="button" className={styles.button} onClick={() => setShowJson(true)} disabled={!plan}>ดู JSON</button>
        <div className={styles.partial}>
          <select value={partialSection} onChange={(event) => setPartialSection(event.target.value as RegenerateSection)} aria-label="ส่วนที่จะสร้างใหม่">
            {PARTIAL_OPTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
          </select>
          <button type="button" className={styles.button} onClick={() => void createPlan(partialSection)} disabled={busy || !plan}>สร้างใหม่เฉพาะส่วนนี้</button>
        </div>
      </div>
      <div className={`${styles.status} ${error ? styles.error : ""}`}>{error || status}</div>
    </section>

    {plan ? <>
      <section className={styles.card}>
        <div className={styles.sectionHead}><div><span className={styles.eyebrow}>2 · STRUCTURED PLAN</span><h3>ตัวอย่างข้อมูลที่ Agent จะนำไปกรอก</h3></div><p>Schema v{plan.schemaVersion} · Target: {targetLabel(plan.target)} · ข้อมูลทั้งหมดเป็น Draft และแก้ไขต่อใน Studio ได้</p></div>
        <div className={styles.summaryGrid}>
          <article><small>ชื่อ</small><b>{plan.title}</b></article>
          <article><small>ความยาว</small><b>{plan.durationSec} วินาที</b></article>
          <article><small>ตัวละคร</small><b>{plan.characters.length}</b></article>
          <article><small>{plan.target === "series" ? "Episodes / Scenes" : "Scenes / Shots"}</small><b className={styles.accent}>{plan.target === "series" ? `${plan.episodes.length} / ${scenes.length}` : `${plan.scenes.length} / ${plan.scenes.reduce((sum, scene) => sum + scene.shots.length, 0)}`}</b></article>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.previewGrid}>
          <div className={styles.panelBox}>
            <h4>Scene / Episode Preview</h4>
            <div className={styles.sceneList}>
              {plan.target === "series" ? plan.episodes.map((episode) => <div className={styles.scene} key={episode.episodeId}><strong>EP {String(episode.episodeNumber).padStart(2, "0")} · {episode.title}</strong><span>{episode.durationSec}s · {episode.scenes.length} Scenes · Start: {episode.continuityStart || "ยังไม่ระบุ"} · End: {episode.endingState || "ยังไม่ระบุ"}</span></div>) : plan.scenes.map((scene) => <div className={styles.scene} key={scene.sceneId}><strong>{scene.sceneId} · {scene.title || scene.location || "Untitled Scene"}</strong><span>{scene.durationSec}s · {scene.camera || "Camera ยังไม่ระบุ"} · {scene.lens || "Lens ยังไม่ระบุ"} · {scene.movement || "Movement ยังไม่ระบุ"}</span></div>)}
            </div>
          </div>
          <div className={styles.panelBox}>
            <h4>Character Plan</h4>
            <div className={styles.characterList}>{plan.characters.length ? plan.characters.map((character) => <div className={styles.character} key={character.name}><strong>{character.name} · {character.role || "ไม่ระบุบทบาท"}</strong><span>{character.appearance || "Appearance ยังไม่ระบุ"}{character.costume ? ` · Costume: ${character.costume}` : ""}</span></div>) : <div className={styles.empty}>ยังไม่มีตัวละครในแผน</div>}</div>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.previewGrid}>
          <div className={styles.panelBox}>
            <h4>⚠ Warning — ต้องตรวจสอบ</h4>
            <div className={styles.noteList}>{plan.warnings.length ? plan.warnings.map((warning, index) => <div key={index} className={`${styles.note} ${styles.warning}`}>{warning}</div>) : <div className={styles.empty}>ไม่พบ Warning เชิงโครงสร้าง แต่ผู้ใช้ยังควรตรวจเนื้อหาก่อนนำไปใช้</div>}</div>
          </div>
          <div className={styles.panelBox}>
            <h4>✦ Suggestions</h4>
            <div className={styles.noteList}>{plan.suggestions.length ? plan.suggestions.map((suggestion, index) => <div key={index} className={`${styles.note} ${styles.suggestion}`}>{suggestion}</div>) : <div className={styles.empty}>ไม่มีคำแนะนำเพิ่มเติม</div>}</div>
          </div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHead}><div><span className={styles.eyebrow}>3 · FIELD MAPPING</span><h3>รายการช่องที่จะถูกกรอก</h3></div><p>ปลายทางจะกรอกเฉพาะช่องที่มีอยู่จริง และจะให้เลือก “เพิ่มต่อ” หรือ “แทนที่” ก่อนเปลี่ยนข้อมูลเดิม</p></div>
        <div className={styles.mappingList}>{mappings.map((mapping) => <div className={styles.mapping} key={mapping}>{mapping}</div>)}</div>
      </section>

      <section className={styles.review}>
        <div><strong>ตรวจสอบก่อนนำไปใช้</strong><p>การกดปุ่มด้านขวาจะเพียงส่ง Typed Plan ไปยัง Studio ที่เลือก จากนั้น Studio จะถามอีกครั้งว่าจะ “เพิ่มต่อ” หรือ “แทนที่” ข้อมูลเดิม การนำไปใช้จะไม่สร้างวิดีโอและไม่เรียก Video Provider</p></div>
        <div className={styles.applyActions}>
          <button type="button" className={styles.buttonPrimary} disabled={applyBusy || plan.target !== "studio"} onClick={() => void applyTo("studio")}>นำไปใช้ใน AI Studio</button>
          <button type="button" className={styles.buttonPrimary} disabled={applyBusy || plan.target !== "series"} onClick={() => void applyTo("series")}>นำไปใช้ใน Series Studio</button>
        </div>
      </section>
    </> : null}

    {showJson && plan ? <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowJson(false); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Structured JSON">
        <div className={styles.modalHead}><h3>Structured JSON · Schema v{plan.schemaVersion}</h3><button type="button" className={styles.buttonGhost} onClick={() => setShowJson(false)}>ปิด</button></div>
        <pre className={styles.json}>{JSON.stringify(plan, null, 2)}</pre>
      </section>
    </div> : null}
  </main>;
}
