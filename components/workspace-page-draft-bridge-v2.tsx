"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  getWorkspaceDraftScope,
  readWorkspaceDraft,
  saveWorkspaceDraft,
  WORKSPACE_DRAFT_SAVE_REQUEST_EVENT,
  WORKSPACE_DRAFT_SAVED_EVENT,
  WORKSPACE_DRAFT_SCOPE_READY_EVENT,
  type WorkspaceDraftKind,
} from "@/lib/workspace-drafts-client";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type StudioCharacter = { name: string; role: string; voice: string; appearance: string; checks: boolean[] };
type StudioScene = { values: Record<string, string>; checks: Record<string, boolean>; dialogue: Array<{ name: string; text: string }> };
type StudioDraft = { version: 2; setup: Record<string, string>; setupChecks: Record<string, boolean>; characters: StudioCharacter[]; scenes: StudioScene[]; selectedSceneIndex: number };
type AgentDraft = { version: 2; instruction: string; target: "studio" | "series" | "" };
type SeriesDraft = { version: 2; series: unknown };
type DraftData = StudioDraft | AgentDraft | SeriesDraft;

const SERIES_KEY = "scenova-series-workspace-v3";
const SERIES_RESTORE = "scenova-series-draft-restore-v2";
const SERIES_MIGRATED = "scenova-series-draft-migrated-v2";

const compact = (value: string | null | undefined) => (value || "").replace(/\s+/g, " ").trim();
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

function setValue(control: Control, value: string) {
  const proto = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function directLabel(element: Element) {
  return compact(Array.from(element.children).find((child) => child.tagName === "SPAN")?.textContent);
}

function controlLabel(control: Element, index = 0) {
  const label = control.closest("label");
  return (label ? directLabel(label) : directLabel(control.parentElement || control)) || control.getAttribute("aria-label") || `control-${index}`;
}

function blankOption(select: HTMLSelectElement, text = "— เลือก —") {
  if (!Array.from(select.options).some((option) => option.value === "")) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = text;
    select.insertBefore(option, select.firstChild);
  }
}

function blankSelect(select: HTMLSelectElement, text?: string) {
  blankOption(select, text);
  setValue(select, "");
}

function findControl(root: ParentNode, labels: string[]) {
  const needles = labels.map((label) => label.toLocaleLowerCase());
  const field = Array.from(root.querySelectorAll<HTMLElement>("label,div")).find((item) => {
    const label = directLabel(item).toLocaleLowerCase();
    return needles.some((needle) => label === needle || label.startsWith(needle));
  });
  return field?.querySelector<Control>("input,textarea,select") || null;
}

function valuesOf(root: ParentNode) {
  const result: Record<string, string> = {};
  Array.from(root.querySelectorAll<Control>("input,textarea,select")).forEach((control, index) => {
    if (control instanceof HTMLInputElement && ["checkbox", "radio", "file", "button", "submit"].includes(control.type)) return;
    const label = controlLabel(control, index);
    if (!(label in result)) result[label] = control.value;
  });
  return result;
}

function restoreValues(root: ParentNode, values: Record<string, string>) {
  Array.from(root.querySelectorAll<Control>("input,textarea,select")).forEach((control, index) => {
    if (control instanceof HTMLInputElement && ["checkbox", "radio", "file", "button", "submit"].includes(control.type)) return;
    const label = controlLabel(control, index);
    if (!(label in values)) return;
    if (control instanceof HTMLSelectElement) blankOption(control);
    setValue(control, values[label] || "");
  });
}

function checksOf(root: ParentNode) {
  const result: Record<string, boolean> = {};
  Array.from(root.querySelectorAll<HTMLLabelElement>("label")).forEach((label, index) => {
    const input = label.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (input) result[compact(label.textContent) || `check-${index}`] = input.checked;
  });
  return result;
}

function restoreChecks(root: ParentNode, values: Record<string, boolean>) {
  Array.from(root.querySelectorAll<HTMLLabelElement>("label")).forEach((label, index) => {
    const input = label.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!input) return;
    const wanted = values[compact(label.textContent) || `check-${index}`];
    if (typeof wanted === "boolean" && wanted !== input.checked) input.click();
  });
}

function counter(label: string) { return document.querySelector<HTMLElement>(`[aria-label="${label}"]`); }
function counterValue(label: string) { return Number(compact(counter(label)?.querySelector("strong")?.textContent) || 0); }
async function setCounter(label: string, wanted: number) {
  const root = counter(label);
  if (!root || wanted < 1) return;
  let current = counterValue(label);
  for (let guard = 0; guard < 30 && current !== wanted; guard += 1) {
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
    const button = current < wanted ? buttons.at(-1) : buttons[0];
    if (!button || button.disabled) break;
    button.click();
    await nextFrame();
    current = counterValue(label);
  }
}

function studioSceneButtons() {
  const list = document.getElementById("scenes")?.querySelector<HTMLElement>("[class*='sceneList']");
  return list ? Array.from(list.querySelectorAll<HTMLButtonElement>(":scope > button")) : [];
}
function studioEditor() { return document.getElementById("scenes")?.querySelector<HTMLElement>("[class*='sceneEditor']") || null; }
function studioCharacters() { return document.getElementById("characters") ? Array.from(document.getElementById("characters")!.querySelectorAll<HTMLElement>("article")) : []; }

async function captureStudio(): Promise<StudioDraft | null> {
  const setup = document.getElementById("setup");
  if (!setup) return null;
  const characters = studioCharacters().map((card) => ({
    name: findControl(card, ["ชื่อ"])?.value || "",
    role: findControl(card, ["บทบาท"])?.value || "",
    voice: findControl(card, ["โปรไฟล์เสียง"])?.value || "",
    appearance: findControl(card, ["รูปลักษณ์ / เสื้อผ้า / บุคลิก / จุดจำ"])?.value || "",
    checks: Array.from(card.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).map((input) => input.checked),
  }));
  const buttons = studioSceneButtons();
  const selected = Math.max(0, buttons.findIndex((button) => String(button.className).toLocaleLowerCase().includes("active")));
  const scenes: StudioScene[] = [];
  for (let index = 0; index < buttons.length; index += 1) {
    studioSceneButtons()[index]?.click();
    await nextFrame();
    const editor = studioEditor();
    if (!editor) continue;
    scenes.push({
      values: valuesOf(editor),
      checks: checksOf(editor),
      dialogue: Array.from(editor.querySelectorAll<HTMLElement>("[class*='dialogueCard']")).map((card) => ({ name: compact(card.querySelector("b")?.textContent), text: card.querySelector<HTMLTextAreaElement>("textarea")?.value || "" })),
    });
  }
  studioSceneButtons()[selected]?.click();
  await nextFrame();
  return { version: 2, setup: valuesOf(setup), setupChecks: checksOf(setup), characters, scenes, selectedSceneIndex: selected };
}

async function restoreStudio(data: StudioDraft) {
  const setup = document.getElementById("setup");
  if (!setup) return;
  const model = setup.querySelector<HTMLSelectElement>('select[aria-label="โมเดลวิดีโอ"]');
  if (model) {
    blankOption(model, "— เลือกโมเดล AI —");
    const storedModel = data.setup["โมเดลวิดีโอ"] ?? data.setup["Model"] ?? "";
    setValue(model, storedModel);
    await nextFrame();
  }
  const duration = findControl(setup, ["ความยาวรวมของตอน"]);
  const durationValue = data.setup["ความยาวรวมของตอน"];
  if (duration && durationValue) { setValue(duration, durationValue); await nextFrame(); }
  await setCounter("จำนวนตัวละคร", Math.max(1, data.characters.length));
  await setCounter("จำนวนฉาก", Math.max(1, data.scenes.length));
  restoreValues(setup, data.setup);
  restoreChecks(setup, data.setupChecks);
  await nextFrame();

  studioCharacters().forEach((card, index) => {
    const source = data.characters[index];
    if (!source) return;
    const fields: Array<[string[], string]> = [
      [["ชื่อ"], source.name], [["บทบาท"], source.role], [["โปรไฟล์เสียง"], source.voice], [["รูปลักษณ์ / เสื้อผ้า / บุคลิก / จุดจำ"], source.appearance],
    ];
    fields.forEach(([labels, value]) => { const control = findControl(card, labels); if (control) { if (control instanceof HTMLSelectElement) blankOption(control); setValue(control, value); } });
    Array.from(card.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).forEach((input, checkIndex) => { if (typeof source.checks[checkIndex] === "boolean" && input.checked !== source.checks[checkIndex]) input.click(); });
  });

  for (let index = 0; index < data.scenes.length; index += 1) {
    studioSceneButtons()[index]?.click();
    await nextFrame();
    const editor = studioEditor();
    if (!editor) continue;
    restoreValues(editor, data.scenes[index].values);
    restoreChecks(editor, data.scenes[index].checks);
    const cards = Array.from(editor.querySelectorAll<HTMLElement>("[class*='dialogueCard']"));
    data.scenes[index].dialogue.forEach((line, lineIndex) => {
      const card = cards.find((item) => compact(item.querySelector("b")?.textContent) === line.name) || cards[lineIndex];
      const textarea = card?.querySelector<HTMLTextAreaElement>("textarea");
      if (textarea) setValue(textarea, line.text);
    });
  }
  studioSceneButtons()[Math.min(data.selectedSceneIndex, Math.max(0, studioSceneButtons().length - 1))]?.click();
}

async function blankStudio() {
  const setup = document.getElementById("setup");
  if (!setup) return;
  Array.from(setup.querySelectorAll<HTMLSelectElement>("select")).forEach((select) => blankSelect(select, select.getAttribute("aria-label") === "โมเดลวิดีโอ" ? "— เลือกโมเดล AI —" : undefined));
  studioCharacters().forEach((card) => Array.from(card.querySelectorAll<HTMLSelectElement>("select")).forEach((select) => blankSelect(select)));
  const buttons = studioSceneButtons();
  const selected = Math.max(0, buttons.findIndex((button) => String(button.className).toLocaleLowerCase().includes("active")));
  for (let index = 0; index < buttons.length; index += 1) {
    studioSceneButtons()[index]?.click();
    await nextFrame();
    const editor = studioEditor();
    if (editor) Array.from(editor.querySelectorAll<HTMLSelectElement>("select")).forEach((select) => blankSelect(select));
  }
  studioSceneButtons()[selected]?.click();
}

function plannerButtons() { return Array.from(document.querySelectorAll<HTMLButtonElement>("button")); }
function plannerTarget() {
  const studio = plannerButtons().find((button) => compact(button.textContent) === "AI Studio");
  const series = plannerButtons().find((button) => compact(button.textContent) === "Series Studio");
  if (studio?.getAttribute("data-active") === "true") return "studio" as const;
  if (series?.getAttribute("data-active") === "true") return "series" as const;
  return "" as const;
}
function plannerInstruction() { return document.querySelector<HTMLTextAreaElement>('main textarea[class*="instruction"], main textarea')?.value || ""; }
function captureAgent(): AgentDraft { return { version: 2, instruction: plannerInstruction(), target: plannerTarget() }; }
async function restoreAgent(data: AgentDraft) {
  const textarea = document.querySelector<HTMLTextAreaElement>('main textarea[class*="instruction"], main textarea');
  if (textarea) setValue(textarea, data.instruction || "");
  if (data.target) plannerButtons().find((button) => compact(button.textContent) === (data.target === "studio" ? "AI Studio" : "Series Studio"))?.click();
  else plannerButtons().filter((button) => ["AI Studio", "Series Studio"].includes(compact(button.textContent))).forEach((button) => button.setAttribute("data-active", "false"));
}
function blankAgent() {
  plannerButtons().filter((button) => ["AI Studio", "Series Studio"].includes(compact(button.textContent))).forEach((button) => button.setAttribute("data-active", "false"));
  const partial = document.querySelector<HTMLSelectElement>('select[aria-label="ส่วนที่จะสร้างใหม่"]');
  if (partial) blankSelect(partial);
  document.documentElement.dataset.scPlannerTargetChosen = "false";
}

function seriesSceneButtons() {
  const aside = document.getElementById("scene-direction")?.querySelector("aside");
  return aside ? Array.from(aside.querySelectorAll<HTMLButtonElement>(":scope > button")) : [];
}
async function blankSeries() {
  const main = document.querySelector("main");
  if (!main) return;
  Array.from(main.querySelectorAll<HTMLSelectElement>("select")).forEach((select) => {
    const label = controlLabel(select).toLocaleLowerCase();
    if (!label.includes("target duration") && !label.includes("เวลารวมเป้าหมาย")) blankSelect(select);
  });
  const buttons = seriesSceneButtons();
  const selected = Math.max(0, buttons.findIndex((button) => String(button.className).toLocaleLowerCase().includes("active")));
  for (let index = 0; index < buttons.length; index += 1) {
    seriesSceneButtons()[index]?.click();
    await nextFrame();
    const editor = document.getElementById("scene-direction")?.querySelector<HTMLElement>("[class*='sceneEditor']");
    if (editor) Array.from(editor.querySelectorAll<HTMLSelectElement>("select")).forEach((select) => blankSelect(select));
  }
  seriesSceneButtons()[selected]?.click();
  window.setTimeout(() => localStorage.removeItem(SERIES_KEY), 500);
  Array.from(document.querySelectorAll<HTMLElement>("small")).filter((item) => compact(item.textContent) === "บันทึกอัตโนมัติบนอุปกรณ์นี้").forEach((item) => { item.textContent = "ร่างอัตโนมัติ · เก็บ 24 ชั่วโมง"; });
}
function seriesRaw() { try { const raw = localStorage.getItem(SERIES_KEY); return raw ? JSON.parse(raw) as unknown : null; } catch { return null; } }

function workspaceFor(pathname: string): WorkspaceDraftKind | null { return pathname === "/studio" ? "studio" : pathname === "/agent" ? "agent" : pathname === "/series" ? "series" : null; }
function titleFor(workspace: WorkspaceDraftKind, data: DraftData) {
  if (workspace === "studio" && "setup" in data) return data.setup["ชื่อตอน"] || "ร่าง AI Studio";
  if (workspace === "agent" && "instruction" in data) return data.instruction.trim().slice(0, 64) || "ร่าง AI Planner";
  if (workspace === "series" && "series" in data && data.series && typeof data.series === "object") {
    const title = (data.series as { title?: unknown }).title;
    if (typeof title === "string" && title.trim()) return title;
  }
  return workspace === "series" ? "ร่าง Series Studio" : "งานร่าง";
}

export default function WorkspacePageDraftBridgeV2() {
  const pathname = usePathname();
  const workspace = workspaceFor(pathname);
  const initialized = useRef(false);
  const draftId = useRef("");
  const suppress = useRef(false);
  const captureBusy = useRef(false);

  useEffect(() => {
    if (!workspace) return;
    let active = true;

    const initialize = async () => {
      if (!active || initialized.current || !getWorkspaceDraftScope()) return;
      const requested = new URLSearchParams(window.location.search).get("draft") || "";

      suppress.current = true;
      if (requested) {
        const saved = readWorkspaceDraft<DraftData>(requested);
        if (saved?.workspace === workspace) {
          draftId.current = saved.id;
          if (workspace === "series" && "series" in saved.data) {
            if (sessionStorage.getItem(SERIES_RESTORE) !== saved.id) {
              localStorage.setItem(SERIES_KEY, JSON.stringify(saved.data.series));
              sessionStorage.setItem(SERIES_RESTORE, saved.id);
              window.location.reload();
              return;
            }
            window.setTimeout(() => localStorage.removeItem(SERIES_KEY), 700);
          } else if (workspace === "studio" && "setup" in saved.data) await restoreStudio(saved.data as StudioDraft);
          else if (workspace === "agent" && "instruction" in saved.data) await restoreAgent(saved.data as AgentDraft);
        }
      } else {
        // AI Studio now owns its true empty defaults in React state. Do not
        // mutate controlled selects through the DOM on first load.
        if (workspace === "agent") blankAgent();
        else if (workspace === "series") await blankSeries();
      }
      initialized.current = true;
      window.setTimeout(() => { suppress.current = false; }, 450);
    };

    const publishSaveResult = (ok: boolean, message: string) => {
      window.dispatchEvent(new CustomEvent(WORKSPACE_DRAFT_SAVED_EVENT, { detail: { ok, message } }));
    };

    const saveCurrent = async () => {
      if (!active || captureBusy.current || suppress.current) {
        publishSaveResult(false, "ระบบกำลังเตรียม Workspace กรุณาลองอีกครั้ง");
        return;
      }
      if (!getWorkspaceDraftScope()) {
        publishSaveResult(false, "ยังไม่พร้อมบันทึกร่าง กรุณารอให้ระบบยืนยันบัญชีก่อน");
        return;
      }

      captureBusy.current = true;
      suppress.current = true;
      try {
        let data: DraftData | null = null;
        if (workspace === "studio") data = await captureStudio();
        else if (workspace === "agent") data = captureAgent();
        else {
          await new Promise((resolve) => window.setTimeout(resolve, 80));
          const series = seriesRaw();
          if (series) data = { version: 2, series };
        }
        if (!data) {
          publishSaveResult(false, "ไม่พบข้อมูล Workspace ที่จะบันทึก");
          return;
        }

        const saved = saveWorkspaceDraft({
          id: draftId.current || undefined,
          workspace,
          title: titleFor(workspace, data),
          data,
        });
        if (!saved) {
          publishSaveResult(false, "บันทึกร่างไม่สำเร็จ");
          return;
        }

        draftId.current = saved.id;
        const url = new URL(window.location.href);
        if (url.searchParams.get("draft") !== saved.id) {
          url.searchParams.set("draft", saved.id);
          window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
        }
        if (workspace === "series") localStorage.removeItem(SERIES_KEY);
        publishSaveResult(true, "บันทึกร่างแล้ว");
      } finally {
        captureBusy.current = false;
        window.setTimeout(() => { suppress.current = false; }, 100);
      }
    };

    const saveRequested = () => { void saveCurrent(); };
    const clickGuard = (event: MouseEvent) => {
      if (workspace !== "agent") return;
      const button = event.target instanceof Element ? event.target.closest("button") as HTMLButtonElement | null : null;
      if (!button) return;
      const text = compact(button.textContent);
      if (text === "AI Studio" || text === "Series Studio") {
        document.documentElement.dataset.scPlannerTargetChosen = "true";
        plannerButtons().filter((item) => ["AI Studio", "Series Studio"].includes(compact(item.textContent))).forEach((item) => item.setAttribute("data-active", item === button ? "true" : "false"));
        return;
      }
      if ((text === "ส่งคำสั่ง" || text.includes("สร้างแผน")) && document.documentElement.dataset.scPlannerTargetChosen !== "true") {
        event.preventDefault(); event.stopPropagation(); window.alert("กรุณาเลือก AI Studio หรือ Series Studio ก่อนสร้างแผน");
      }
      if (text.includes("สร้างใหม่เฉพาะส่วนนี้")) {
        const partial = document.querySelector<HTMLSelectElement>('select[aria-label="ส่วนที่จะสร้างใหม่"]');
        if (partial && !partial.value) { event.preventDefault(); event.stopPropagation(); window.alert("กรุณาเลือกส่วนที่ต้องการสร้างใหม่ก่อน"); }
      }
    };

    initialize();
    window.addEventListener(WORKSPACE_DRAFT_SCOPE_READY_EVENT, initialize);
    window.addEventListener(WORKSPACE_DRAFT_SAVE_REQUEST_EVENT, saveRequested);
    document.addEventListener("click", clickGuard, true);
    return () => {
      active = false;
      window.removeEventListener(WORKSPACE_DRAFT_SCOPE_READY_EVENT, initialize);
      window.removeEventListener(WORKSPACE_DRAFT_SAVE_REQUEST_EVENT, saveRequested);
      document.removeEventListener("click", clickGuard, true);
      delete document.documentElement.dataset.scPlannerTargetChosen;
      initialized.current = false;
    };
  }, [pathname, workspace]);

  return null;
}
