"use client";

import styles from "./single-episode-ai-director-panel.module.css";
import type { AiDirectorMeta, AiDirectorMode, AiDirectorNovelty, AiDirectorScope } from "@/lib/ai-director";
import { AI_MODE_OPTIONS, AI_NOVELTY_OPTIONS, AI_SCOPE_OPTIONS } from "@/lib/ai-director-client";

type Props = {
  busy: boolean;
  summary: string;
  meta: AiDirectorMeta | null;
  mode: AiDirectorMode | "";
  novelty: AiDirectorNovelty | "";
  canUndo: boolean;
  invalidMode?: boolean;
  invalidNovelty?: boolean;
  validationMessage?: string;
  onModeChange: (value: AiDirectorMode | "") => void;
  onNoveltyChange: (value: AiDirectorNovelty | "") => void;
  onGenerate: (scope: AiDirectorScope) => void;
  onUndo: () => void;
};

const SCORE_ITEMS: Array<{ key: keyof AiDirectorMeta["scores"]; label: string }> = [
  { key: "storyFit", label: "Story Fit" },
  { key: "coherence", label: "ภาพสัมพันธ์" },
  { key: "continuity", label: "Continuity" },
  { key: "novelty", label: "ความแตกต่าง" },
  { key: "modelSupport", label: "Model Support" },
];

function percent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function capabilityCopy(meta: AiDirectorMeta) {
  const capability = meta.capability;
  if (capability.trimSec > 0) {
    return `${capability.model}: Timeline ${capability.timelineDurationSec}s → Generate ${capability.renderDurationSec}s → Trim ${capability.trimSec}s`;
  }
  return `${capability.model}: ${capability.timelineDurationSec}s ใช้ Generation ${capability.renderDurationSec}s`;
}

export default function SingleEpisodeAiDirectorPanel({
  busy,
  summary,
  meta,
  mode,
  novelty,
  canUndo,
  invalidMode = false,
  invalidNovelty = false,
  validationMessage = "",
  onModeChange,
  onNoveltyChange,
  onGenerate,
  onUndo,
}: Props) {
  return <section className={styles.aiDirectorPanel} aria-label="AI Director Production Controls">
    <div className={styles.aiDirectorToolbar}>
      <div className={styles.aiDirectorSelects}>
        <label className={invalidMode ? styles.aiRequiredField : ""}>
          <span>โหมดผู้กำกับ AI</span>
          <select data-ai-required-error={invalidMode ? "true" : undefined} value={mode} onChange={(event) => onModeChange(event.target.value as AiDirectorMode | "")} disabled={busy}>
            <option value=""> </option>
            {AI_MODE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className={invalidNovelty ? styles.aiRequiredField : ""}>
          <span>ความแตกต่างจากครั้งก่อน</span>
          <select data-ai-required-error={invalidNovelty ? "true" : undefined} value={novelty} onChange={(event) => onNoveltyChange(event.target.value as AiDirectorNovelty | "")} disabled={busy}>
            <option value=""> </option>
            {AI_NOVELTY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.aiDirectorScopeButtons}>
        {AI_SCOPE_OPTIONS.map((item) => <button key={item.value} type="button" disabled={busy} onClick={() => onGenerate(item.value)}>✦ คิด{item.label}ใหม่</button>)}
        <button type="button" className={styles.aiUndoButton} disabled={busy || !canUndo} onClick={onUndo}>↶ Undo AI</button>
      </div>
    </div>

    {validationMessage ? <div className={styles.aiRequiredMessage} role="alert">⚠ {validationMessage}</div> : null}

    {!meta ? <div className={styles.aiDirectorHint} aria-live="polite">
      {busy ? "AI Director กำลังไล่ตรวจทุกช่องว่าง วิเคราะห์ตัวละครจากเรื่อง และเติม Story → Blocking → Camera → Look → Sound → Continuity โดยรักษาค่าที่คุณใส่ไว้…" : "AI ช่วยคิดทั้งฉากจะเติมทุกช่องที่ยังว่างและวิเคราะห์ตัวละครจากเรื่อง/Action ให้ด้วย ค่าที่คุณกรอกหรือเลือกไว้แล้วจะไม่ถูกทับ; แม้ section จะเป็น Manual ช่องที่มีค่าเดิมจะถูกล็อกไว้ แต่ช่องที่ยังว่างยังให้ AI เติมได้"}
      {summary ? <span> · {summary}</span> : null}
    </div> : <div className={styles.aiDirectorResults} aria-live="polite">
      <div className={styles.aiScoreGrid}>
        {SCORE_ITEMS.map((item) => {
          const value = percent(meta.scores[item.key]);
          return <div key={item.key} className={styles.aiScore} title={`${item.label} ${value}%`}>
            <span>{item.label}</span><b>{value}%</b><i aria-hidden="true"><em style={{ width: `${value}%` }} /></i>
          </div>;
        })}
      </div>

      <div className={styles.aiProbabilityRow}>
        <span>Candidate Probability</span>
        {meta.alternatives.slice(0, 4).map((item) => <b key={`${item.profile}-${item.probability}`}>{item.labelTh}<em>{percent(item.probability)}%</em></b>)}
      </div>

      <div className={styles.aiProductionFacts}>
        <span><b>เลือก:</b> {meta.profileLabelTh}</span>
        <span><b>เหตุผล:</b> {summary || meta.rationaleTh}</span>
        <span><b>ค่าจริงของโมเดล:</b> {capabilityCopy(meta)}</span>
        <span><b>Control Layer:</b> Camera / Lighting / Audio = Prompt-level · Continuity = SCENOVA</span>
        <span><b>เปลี่ยน:</b> {meta.changedFields.length ? meta.changedFields.join(", ") : "ไม่มีค่าที่อนุญาตให้เปลี่ยน"}</span>
        <span><b>คงไว้:</b> {meta.frozenSections.length ? meta.frozenSections.join(", ") : "ไม่มี Manual/Lock เพิ่มเติม"}</span>
      </div>

      <div className={`${styles.aiValidation} ${meta.validation.ok ? styles.aiValidationOk : styles.aiValidationWarn}`}>
        <b>{meta.validation.ok ? "✓ Production Validation ผ่าน" : "⚠ Production Validation"}</b>
        <span>{meta.validation.warnings.length ? meta.validation.warnings.join(" • ") : "ค่าที่เลือกสัมพันธ์กัน อยู่ใน Production Catalog และไม่ขัดข้อจำกัดหลักของโมเดล"}</span>
      </div>
    </div>}
  </section>;
}
