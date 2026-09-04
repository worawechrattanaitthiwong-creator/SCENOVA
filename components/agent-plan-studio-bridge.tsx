"use client";

import { useEffect, useState } from "react";
import { agentStructuredPlanSchema, type AgentPlanScene, type AgentStructuredPlan } from "@/lib/agent/plan-schema";
import { clearPendingAgentPlan, readPendingAgentPlan, type AgentPlanTransferEnvelope } from "@/lib/agent/plan-transfer-client";
import styles from "./agent-plan-apply-bridge.module.css";

const MASTER_PROMPT_KEY = "scenova-agent-master-prompt-v1";
const NEGATIVE_PROMPT_KEY = "scenova-agent-negative-prompt-v1";
const SOURCE_INSTRUCTION_KEY = "scenova-agent-source-instruction-v1";

type ApplyMode = "replace" | "merge";

type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function compact(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function setNativeValue(control: FormControl, value: string) {
  const proto = control instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function directLabel(field: Element) {
  const span = Array.from(field.children).find((child) => child.tagName === "SPAN");
  return compact(span?.textContent);
}

function findField(root: ParentNode, labels: string[]) {
  const normalized = labels.map((label) => label.toLocaleLowerCase());
  return Array.from(root.querySelectorAll<HTMLElement>("label")).find((field) => {
    const current = directLabel(field).toLocaleLowerCase();
    return normalized.some((label) => current === label || current.startsWith(label));
  }) || null;
}

function findControl(root: ParentNode, labels: string[]) {
  return findField(root, labels)?.querySelector<FormControl>("input,textarea,select") || null;
}

function isMeaningful(value: string) {
  const normalized = compact(value).toLocaleLowerCase();
  return Boolean(normalized && !["untitled episode", "ตัวละคร 1", "ตัวละคร 2", "ฉาก 1", "ฉาก 2", "ฉาก 3"].includes(normalized));
}

function setTextField(root: ParentNode, labels: string[], value: string, mode: ApplyMode, mergeAsAppend = false) {
  if (!value.trim()) return;
  const control = findControl(root, labels);
  if (!control || control instanceof HTMLSelectElement) return;
  const current = control.value;
  if (mode === "merge" && isMeaningful(current)) {
    if (mergeAsAppend && !current.includes(value)) setNativeValue(control, `${current.trim()}\n\n${value.trim()}`.trim());
    return;
  }
  setNativeValue(control, value);
}

function setSelect(root: ParentNode, labels: string[], desired: string, mode: ApplyMode) {
  if (!desired.trim()) return;
  const select = findControl(root, labels);
  if (!(select instanceof HTMLSelectElement)) return;
  if (mode === "merge" && select.value) return;
  const needle = compact(desired).toLocaleLowerCase();
  const option = Array.from(select.options).find((item) => compact(item.value).toLocaleLowerCase() === needle || compact(item.textContent).toLocaleLowerCase() === needle)
    || Array.from(select.options).find((item) => compact(item.value).toLocaleLowerCase().startsWith(needle) || compact(item.textContent).toLocaleLowerCase().startsWith(needle))
    || Array.from(select.options).find((item) => needle.includes(compact(item.value).toLocaleLowerCase()) || compact(item.textContent).toLocaleLowerCase().includes(needle));
  if (option) setNativeValue(select, option.value);
}

function counterValue(label: string) {
  const counter = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  return Number(compact(counter?.querySelector("strong")?.textContent) || 0);
}

async function setCounter(label: string, desired: number) {
  const counter = document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  if (!counter) return 0;
  let current = counterValue(label);
  let guard = 0;
  while (current !== desired && guard < 60) {
    const buttons = Array.from(counter.querySelectorAll<HTMLButtonElement>("button"));
    const button = current < desired ? buttons[buttons.length - 1] : buttons[0];
    if (!button || button.disabled) break;
    button.click();
    await nextFrame();
    current = counterValue(label);
    guard += 1;
  }
  return current;
}

function characterCards() {
  const root = document.getElementById("characters");
  return root ? Array.from(root.querySelectorAll<HTMLElement>("article")) : [];
}

function sceneButtons() {
  const root = document.getElementById("scenes");
  const list = root?.querySelector<HTMLElement>("[class*='sceneList']");
  return list ? Array.from(list.querySelectorAll<HTMLButtonElement>(":scope > button")) : [];
}

function selectedSceneEditor() {
  const root = document.getElementById("scenes");
  return root?.querySelector<HTMLElement>("[class*='sceneEditor']") || null;
}

function parseDialogue(dialogue: string) {
  const map = new Map<string, string>();
  for (const raw of dialogue.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^([^:：]{1,120})[:：]\s*(.+)$/);
    if (match) map.set(compact(match[1]).toLocaleLowerCase(), match[2].trim());
  }
  return map;
}

function shotPlanText(scene: AgentPlanScene) {
  if (scene.shots.length <= 1) return "";
  return scene.shots.map((shot, index) => {
    const range = typeof shot.startSec === "number" && typeof shot.endSec === "number" ? `${shot.startSec}-${shot.endSec}s` : `Shot ${index + 1}`;
    return `${range}: ${[shot.camera, shot.angle, shot.lens, shot.movement, shot.subject, shot.action, shot.dialogue].filter(Boolean).join(" · ")}`;
  }).join("\n");
}

function lockMatches(text: string, lockedFields: string[]) {
  const hay = text.toLocaleLowerCase();
  return lockedFields.some((field) => {
    const value = field.toLocaleLowerCase();
    if (hay.includes("ตัวละคร") || hay.includes("character")) return value.includes("character") || value.includes("ตัวละคร");
    if (hay.includes("เสียง") || hay.includes("voice")) return value.includes("voice") || value.includes("เสียง");
    if (hay.includes("สไตล์") || hay.includes("visual")) return value.includes("style") || value.includes("visual") || value.includes("สไตล์");
    if (hay.includes("กล้อง") || hay.includes("camera")) return value.includes("camera") || value.includes("กล้อง");
    if (hay.includes("แสง") || hay.includes("lighting")) return value.includes("lighting") || value.includes("แสง");
    if (hay.includes("สถานที่") || hay.includes("location")) return value.includes("location") || value.includes("สถานที่");
    if (hay.includes("พร็อพ") || hay.includes("prop")) return value.includes("prop") || value.includes("พร็อพ");
    return false;
  });
}

async function applyLocks(plan: AgentStructuredPlan, mode: ApplyMode) {
  const setup = document.getElementById("setup");
  if (!setup) return;
  const lockLabels = Array.from(setup.querySelectorAll<HTMLLabelElement>("label")).filter((label) => label.querySelector('input[type="checkbox"]'));
  for (const label of lockLabels) {
    const checkbox = label.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!checkbox) continue;
    const desired = lockMatches(compact(label.textContent), plan.continuity.lockedFields);
    if (mode === "merge") {
      if (desired && !checkbox.checked) checkbox.click();
    } else if (checkbox.checked !== desired) {
      checkbox.click();
    }
  }
  await nextFrame();
}

async function applyCharacters(plan: AgentStructuredPlan, mode: ApplyMode) {
  const existing = characterCards();
  const existingNames = existing.map((card) => compact(findControl(card, ["ชื่อ"])?.value).toLocaleLowerCase());
  const newCharacters = mode === "merge" ? plan.characters.filter((character) => !existingNames.includes(character.name.trim().toLocaleLowerCase())) : plan.characters;
  const desiredCount = mode === "merge" ? Math.min(8, existing.length + newCharacters.length) : Math.max(1, Math.min(8, plan.characters.length || 1));
  await setCounter("จำนวนตัวละคร", desiredCount);
  await nextFrame();
  const cards = characterCards();

  for (let index = 0; index < plan.characters.length; index += 1) {
    const character = plan.characters[index];
    let card: HTMLElement | undefined;
    if (mode === "merge") {
      card = cards.find((item) => compact(findControl(item, ["ชื่อ"])?.value).toLocaleLowerCase() === character.name.trim().toLocaleLowerCase());
      if (!card) {
        const priorNew = newCharacters.findIndex((item) => item.name === character.name);
        if (priorNew >= 0) card = cards[existing.length + priorNew];
      }
    } else {
      card = cards[index];
    }
    if (!card) continue;
    setTextField(card, ["ชื่อ"], character.name, mode);
    setSelect(card, ["บทบาท"], character.role, mode);
    setSelect(card, ["โปรไฟล์เสียง"], character.voice, mode);
    const appearance = [character.appearance, character.costume && `Costume: ${character.costume}`, character.personality && `Personality: ${character.personality}`].filter(Boolean).join("\n");
    setTextField(card, ["รูปลักษณ์ / เสื้อผ้า / บุคลิก / จุดจำ"], appearance, mode, true);
  }
  await nextFrame();
}

async function applyScene(scene: AgentPlanScene, index: number, plan: AgentStructuredPlan, mode: ApplyMode) {
  const buttons = sceneButtons();
  const button = buttons[index];
  if (!button) return false;
  button.click();
  await nextFrame();
  const editor = selectedSceneEditor();
  if (!editor) return false;

  setTextField(editor, ["ชื่อฉาก"], scene.title || scene.sceneId, mode);
  setTextField(editor, ["สถานที่"], scene.location, mode);
  setSelect(editor, ["เป้าหมายฉาก"], scene.objective, mode);

  const actionWithShots = [scene.action, shotPlanText(scene) && `SHOT PLAN FROM AGENT:\n${shotPlanText(scene)}`].filter(Boolean).join("\n\n");
  setTextField(editor, ["Action รวมของฉาก"], actionWithShots, mode, true);

  const primaryShot = scene.shots[0];
  setSelect(editor, ["ระยะภาพ"], primaryShot?.camera || scene.camera, mode);
  setSelect(editor, ["มุมกล้อง"], primaryShot?.angle || scene.angle, mode);
  setSelect(editor, ["เลนส์"], primaryShot?.lens || scene.lens, mode);
  setSelect(editor, ["การเคลื่อนกล้อง"], primaryShot?.movement || scene.movement, mode);
  setSelect(editor, ["รูปแบบแสง"], scene.lighting, mode);
  setSelect(editor, ["อารมณ์หลัก"], scene.mood, mode);
  setSelect(editor, ["เสียงบรรยากาศหลัก"], scene.sound, mode);

  const durationInput = editor.querySelector<HTMLInputElement>("[class*='sceneDuration'] input[type='range']");
  if (durationInput && mode === "replace") setNativeValue(durationInput, String(scene.durationSec));

  const continuity = [index === 0 && plan.continuity.continuityStart ? `Continuity Start: ${plan.continuity.continuityStart}` : "", index === plan.scenes.length - 1 && plan.continuity.endingState ? `Ending State: ${plan.continuity.endingState}` : ""].filter(Boolean).join("\n");
  if (continuity) setTextField(editor, ["Continuity Note"], continuity, mode, true);
  const negative = [plan.negativePrompt, scene.negativePrompt].filter(Boolean).join(", ");
  if (negative) setTextField(editor, ["Scene Negative Prompt"], negative, mode, true);

  const presenceContainer = Array.from(editor.querySelectorAll<HTMLElement>("section,div")).find((item) => directLabel(item).startsWith("ตัวละครในฉาก"))
    || editor.querySelector<HTMLElement>("[class*='presenceChips']")?.parentElement || null;
  const desiredNames = new Set(scene.characters.map((name) => compact(name).toLocaleLowerCase()));
  if (presenceContainer && desiredNames.size) {
    const labels = Array.from(presenceContainer.querySelectorAll<HTMLLabelElement>("label"));
    for (const label of labels) {
      const checkbox = label.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (!checkbox) continue;
      const name = compact(label.textContent).toLocaleLowerCase();
      const desired = desiredNames.has(name);
      if (mode === "merge") {
        if (desired && !checkbox.checked) checkbox.click();
      } else if (checkbox.checked !== desired) checkbox.click();
    }
    await nextFrame();
  }

  const dialogueMap = parseDialogue(scene.dialogue);
  const dialogueCards = Array.from(editor.querySelectorAll<HTMLElement>("[class*='dialogueCard']"));
  dialogueCards.forEach((card, cardIndex) => {
    const name = compact(card.querySelector("b")?.textContent);
    const textarea = card.querySelector<HTMLTextAreaElement>("textarea");
    if (!textarea) return;
    const dialogue = dialogueMap.get(name.toLocaleLowerCase()) || (dialogueCards.length === 1 ? scene.dialogue.trim() : cardIndex === 0 && dialogueMap.size === 0 ? scene.dialogue.trim() : "");
    if (!dialogue) return;
    if (mode === "merge" && isMeaningful(textarea.value)) return;
    setNativeValue(textarea, dialogue);
  });
  await nextFrame();
  return true;
}

async function applyPlanToStudio(plan: AgentStructuredPlan, mode: ApplyMode) {
  const setup = document.getElementById("setup");
  if (!setup) throw new Error("AI_STUDIO_NOT_READY");

  const title = findControl(setup, ["ชื่อตอน"]);
  if (title && !(title instanceof HTMLSelectElement) && (mode === "replace" || !isMeaningful(title.value))) setNativeValue(title, plan.title);
  setTextField(setup, ["เรื่อง / เหตุการณ์ของตอน"], plan.synopsis, mode, true);
  if (mode === "replace") {
    const duration = findControl(setup, ["ความยาวรวมของตอน"]);
    if (duration && !(duration instanceof HTMLSelectElement)) setNativeValue(duration, String(plan.durationSec));
  } else {
    const duration = findControl(setup, ["ความยาวรวมของตอน"]);
    if (duration && !(duration instanceof HTMLSelectElement)) {
      const current = Math.max(1, Number(duration.value) || 0);
      setNativeValue(duration, String(Math.min(180, current + plan.durationSec)));
    }
  }
  await nextFrame();
  setSelect(setup, ["อัตราส่วนภาพ"], plan.aspectRatio, mode);
  setSelect(setup, ["สไตล์ภาพ"], plan.visualStyle, mode);
  await applyLocks(plan, mode);
  await applyCharacters(plan, mode);

  const originalSceneCount = sceneButtons().length;
  const wantedSceneCount = mode === "merge" ? Math.min(180, originalSceneCount + plan.scenes.length) : Math.max(1, plan.scenes.length);
  const actualSceneCount = await setCounter("จำนวนฉาก", wantedSceneCount);
  await nextFrame();
  const startIndex = mode === "merge" ? originalSceneCount : 0;
  let appliedScenes = 0;
  for (let index = 0; index < plan.scenes.length; index += 1) {
    if (await applyScene(plan.scenes[index], startIndex + index, plan, mode)) appliedScenes += 1;
  }

  window.sessionStorage.setItem(MASTER_PROMPT_KEY, plan.prompt || "");
  window.sessionStorage.setItem(NEGATIVE_PROMPT_KEY, plan.negativePrompt || "");
  window.sessionStorage.setItem(SOURCE_INSTRUCTION_KEY, plan.sourceInstruction || "");
  return { appliedScenes, wantedSceneCount, actualSceneCount };
}

export default function AgentPlanStudioBridge() {
  const [envelope, setEnvelope] = useState<AgentPlanTransferEnvelope | null>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("กำลังตรวจสิทธิ์ของแผน...");
  const [error, setError] = useState("");

  useEffect(() => {
    const pending = readPendingAgentPlan();
    if (!pending || pending.target !== "studio" || pending.projectKey !== "studio:single-episode") return;
    const parsed = agentStructuredPlanSchema.safeParse(pending.plan);
    if (!parsed.success || parsed.data.target !== "studio") {
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

  async function apply(mode: ApplyMode) {
    if (!verified || busy) return;
    setBusy(true);
    setError("");
    setStatus(mode === "replace" ? "กำลังแทนที่ข้อมูลที่ยืนยันแล้ว..." : "กำลังเพิ่มแผนต่อจากข้อมูลเดิม...");
    try {
      const result = await applyPlanToStudio(plan, mode);
      clearPendingAgentPlan();
      setStatus(`นำแผนเข้า AI Studio แล้ว ${result.appliedScenes}/${plan.scenes.length} Scenes · ยังไม่ได้เริ่มสร้างวิดีโอ`);
      if (result.actualSceneCount !== result.wantedSceneCount) {
        setError(`Studio รักษาจำนวน Scene ขั้นต่ำ/สูงสุดของ workspace ไว้ (${result.actualSceneCount} ช่อง) กรุณาตรวจ Timeline ก่อนสร้างวิดีโอ`);
        setBusy(false);
        window.setTimeout(() => setEnvelope(null), 2600);
        return;
      }
      window.setTimeout(() => setEnvelope(null), 1500);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "นำแผนเข้า Studio ไม่สำเร็จ");
      setBusy(false);
    }
  }

  return <div className={styles.backdrop} role="presentation">
    <section className={styles.modal} role="dialog" aria-modal="true" aria-label="นำแผน Agent ไปใช้ใน AI Studio">
      <div className={styles.head}><span className={styles.eyebrow}>AGENT → AI STUDIO · VALIDATED PLAN</span><h2>นำ “{plan.title}” มาใส่ใน AI Studio</h2><p>ระบบจะกรอก Typed Plan ลงเฉพาะช่องที่มีอยู่จริง คุณยังแก้ไขได้ทั้งหมด และ Direct Render จะไม่เริ่มจนกว่าคุณจะกดสร้างวิดีโอเอง</p></div>
      <div className={styles.body}>
        <div className={styles.summary}><article><small>ความยาว</small><b>{plan.durationSec}s</b></article><article><small>ตัวละคร</small><b>{plan.characters.length}</b></article><article><small>Scenes</small><b>{plan.scenes.length}</b></article></div>
        <div className={styles.notice}><strong>เลือกวิธีนำไปใช้:</strong> “แทนที่” จะเปลี่ยนช่องที่ Agent มีข้อมูลหลังจากคุณยืนยัน ส่วน “เพิ่มต่อ” จะรักษาข้อมูลเดิมและเพิ่ม Story/Characters/Scenes ต่อท้ายเท่าที่ Studio รองรับ</div>
        {plan.warnings.length ? <div className={styles.warningBox}>{plan.warnings.slice(0, 8).map((warning, index) => <div className={styles.warning} key={index}>⚠ {warning}</div>)}</div> : null}
      </div>
      <div className={styles.actions}><span className={`${styles.status} ${error ? styles.error : ""}`}>{error || status}</span><button type="button" onClick={() => { clearPendingAgentPlan(); setEnvelope(null); }} disabled={busy}>ยกเลิก</button><button type="button" onClick={() => void apply("merge")} disabled={!verified || busy}>เพิ่มต่อ</button><button type="button" className={styles.primary} onClick={() => void apply("replace")} disabled={!verified || busy}>แทนที่</button></div>
    </section>
  </div>;
}
