"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  getWorkspaceDraftScope,
  readWorkspaceDraft,
  saveWorkspaceDraft,
  WORKSPACE_DRAFT_SCOPE_READY_EVENT,
  type WorkspaceDraftKind,
} from "@/lib/workspace-drafts-client";

type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type StudioCharacterDraft = { name: string; role: string; voice: string; appearance: string; checks: boolean[] };
type StudioSceneDraft = { values: Record<string, string>; checks: Record<string, boolean>; dialogue: Array<{ name: string; text: string }> };
type StudioDraftData = {
  version: 1;
  setup: Record<string, string>;
  setupChecks: Record<string, boolean>;
  characters: StudioCharacterDraft[];
  scenes: StudioSceneDraft[];
  selectedSceneIndex: number;
};
type AgentDraftData = { version: 1; instruction: string; target: "studio" | "series" | "" };
type SeriesDraftData = { version: 1; series: unknown };

type AnyDraftData = StudioDraftData | AgentDraftData | SeriesDraftData;

const SERIES_KEY = "scenova-series-workspace-v3";
const SERIES_RESTORE_MARKER = "scenova-series-draft-restore-v1";
const SERIES_MIGRATION_MARKER = "scenova-series-draft-migration-v1";

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

function directLabel(element: Element) {
  const direct = Array.from(element.children).find((child) => child.tagName === "SPAN");
  return compact(direct?.textContent);
}

function fieldLabel(control: Element) {
  const label = control.closest("label");
  if (label) return directLabel(label) || compact(label.querySelector(":scope > span")?.textContent);
  const parent = control.parentElement;
  return parent ? directLabel(parent) : "";
}

function findField(root: ParentNode, labels: string[]) {
  const normalized = labels.map((label) => label.toLocaleLowerCase());
  return Array.from(root.querySelectorAll<HTMLElement>("label,div")).find((field) => {
    const current = directLabel(field).toLocaleLowerCase();
    return normalized.some((label) => current === label || current.startsWith(label));
  }) || null;
}

function findControl(root: ParentNode, labels: string[]) {
  return findField(root, labels)?.querySelector<FormControl>("input,textarea,select") || null;
}

function ensureBlankOption(select: HTMLSelectElement, label = "— เลือก —") {
  if (Array.from(select.options).some((option) => option.value === "")) return;
  const option = document.createElement("option");
  option.value = "";
  option.textContent = label;
  select.insertBefore(option, select.firstChild);
}

function blankSelect(select: HTMLSelectElement) {
  ensureBlankOption(select);
  setNativeValue(select, "");
}

function checkboxKey(label: HTMLLabelElement, index: number) {
  return compact(label.textContent) || `checkbox-${index}`;
}

function captureChecks(root: ParentNode) {
  const result: Record<string, boolean> = {};
  Array.from(root.querySelectorAll<HTMLLabelElement>("label")).forEach((label, index) => {
    const input = label.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (input) result[checkboxKey(label, index)] = input.checked;
  });
  return result;
}

function restoreChecks(root: ParentNode, checks: Record<string, boolean>) {
  Array.from(root.querySelectorAll<HTMLLabelElement>("label")).forEach((label, index) => {
    const input = label.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!input) return;
    const desired = checks[checkboxKey(label, index)];
    if (typeof desired === "boolean" && input.checked !== desired) input.click();
  });
}

function captureLabeledValues(root: ParentNode) {
  const values: Record<string, string> = {};
  Array.from(root.querySelectorAll<FormControl>("input,textarea,select")).forEach((control, index) => {
    if (control instanceof HTMLInputElement && ["checkbox", "radio", "file", "button", "submit"].includes(control.type)) return;
    const label = fieldLabel(control) || control.getAttribute("aria-label") || `control-${index}`;
    if (!values[label]) values[label] = control.value;
  });
  return values;
}

function restoreLabeledValues(root: ParentNode, values: Record<string, string>) {
  Array.from(root.querySelectorAll<FormControl>("input,textarea,select")).forEach((control, index) => {
    if (control instanceof HTMLInputElement && ["checkbox", "radio", "file", "button", "submit"].includes(control.type)) return;
    const label = fieldLabel(control) || control.getAttribute("aria-label") || `control-${index}`;
    if (!(label in values)) return;
    if (control instanceof HTMLSelectElement) ensureBlankOption(control);
    setNativeValue(control, values[label] || "");
  });
}

function counterRoot(label: string) {
  return document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
}

function counterValue(label: string) {
  return Number(compact(counterRoot(label)?.querySelector("strong")?.textContent) || 0);
}

async function setCounter(label: string, desired: number) {
  const root = counterRoot(label);
  if (!root || !Number.isFinite(desired) || desired < 1) return;
  let current = counterValue(label);
  let guard = 0;
  while (current !== desired && guard < 30) {
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
    const button = current < desired ? buttons[buttons.length - 1] : buttons[0];
    if (!button || button.disabled) break;
    button.click();
    await nextFrame();
    current = counterValue(label);
    guard += 1;
  }
}

function studioSceneButtons() {
  const root = document.getElementById("scenes");
  const list = root?.querySelector<HTMLElement>("[class*='sceneList']");
  return list ? Array.from(list.querySelectorAll<HTMLButtonElement>(":scope > button")) : [];
}

function studioSceneEditor() {
  return document.getElementById("scenes")?.querySelector<HTMLElement>("[class*='sceneEditor']") || null;
}

function studioCharacterCards() {
  const root = document.getElementById("characters");
  return root ? Array.from(root.querySelectorAll<HTMLElement>("article")) : [];
}

async function captureStudioDraft(): Promise<StudioDraftData | null> {
  const setup = document.getElementById("setup");
  if (!setup) return null;
  const setupValues = captureLabeledValues(setup);
  const characters = studioCharacterCards().map((card) => ({
    name: findControl(card, ["ชื่อ"])?.value || "",
    role: findControl(card, ["บทบาท"])?.value || "",
    voice: findControl(card, ["โปรไฟล์เสียง"])?.value || "",
    appearance: findControl(card, ["รูปลักษณ์ / เสื้อผ้า / บุคลิก / จุดจำ"])?.value || "",
    checks: Array.from(card.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).map((input) => input.checked),
  }));
  const buttons = studioSceneButtons();
  const originalIndex = Math.max(0, buttons.findIndex((button) => String(button.className).toLocaleLowerCase().includes("active")));
  const scenes: StudioSceneDraft[] = [];
  for (let index = 0; index < buttons.length; index += 1) {
    studioSceneButtons()[index]?.click();
    await nextFrame();
    const editor = studioSceneEditor();
    if (!editor) continue;
    const dialogue = Array.from(editor.querySelectorAll<HTMLElement>("[class*='dialogueCard']")).map((card) => ({
      name: compact(card.querySelector("b")?.textContent),
      text: card.querySelector<HTMLTextAreaElement>("textarea")?.value || "",
    }));
    scenes.push({ values: captureLabeledValues(editor), checks: captureChecks(editor), dialogue });
  }
  studioSceneButtons()[originalIndex]?.click();
  await nextFrame();
  return { version: 1, setup: setupValues, setupChecks: captureChecks(setup), characters, scenes, selectedSceneIndex: originalIndex };
}

async function restoreStudioDraft(data: StudioDraftData) {
  const setup = document.getElementById("setup");
  if (!setup) return;
  const modelSelect = setup.querySelector<HTMLSelectElement>('select[aria-label="โมเดลวิดีโอ"]');
  if (modelSelect && "โมเดลวิดีโอ" in data.setup) {
    ensureBlankOption(modelSelect, "— เลือกโมเดล AI —");
    setNativeValue(modelSelect, data.setup["โมเดลวิดีโอ"] || "");
    await nextFrame();
  }
  const duration = data.setup["ความยาวรวมของตอน"] || data.setup["ความยาวรวมของตอน วินาที"];
  if (duration) {
    const control = findControl(setup, ["ความยาวรวมของตอน"]);
    if (control) setNativeValue(control, duration);
    await nextFrame();
  }
  await setCounter("จำนวนตัวละคร", Math.max(1, data.characters.length));
  await setCounter("จำนวนฉาก", Math.max(1, data.scenes.length));
  restoreLabeledValues(setup, data.setup);
  restoreChecks(setup, data.setupChecks);
  await nextFrame();

  studioCharacterCards().forEach((card, index) => {
    const source = data.characters[index];
    if (!source) return;
    const name = findControl(card, ["ชื่อ"]); if (name) setNativeValue(name, source.name);
    const role = findControl(card, ["บทบาท"]); if (role) { if (role instanceof HTMLSelectElement) ensureBlankOption(role); setNativeValue(role, source.role); }
    const voice = findControl(card, ["โปรไฟล์เสียง"]); if (voice) { if (voice instanceof HTMLSelectElement) ensureBlankOption(voice); setNativeValue(voice, source.voice); }
    const appearance = findControl(card, ["รูปลักษณ์ / เสื้อผ้า / บุคลิก / จุดจำ"]); if (appearance) setNativeValue(appearance, source.appearance);
    Array.from(card.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).forEach((input, checkIndex) => {
      if (typeof source.checks[checkIndex] === "boolean" && input.checked !== source.checks[checkIndex]) input.click();
    });
  });

  for (let index = 0; index < data.scenes.length; index += 1) {
    studioSceneButtons()[index]?.click();
    await nextFrame();
    const editor = studioSceneEditor();
    if (!editor) continue;
    restoreLabeledValues(editor, data.scenes[index].values);
    restoreChecks(editor, data.scenes[index].checks);
    const dialogueCards = Array.from(editor.querySelectorAll<HTMLElement>("[class*='dialogueCard']"));
    data.scenes[index].dialogue.forEach((line, lineIndex) => {
      const card = dialogueCards.find((item) => compact(item.querySelector("b")?.textContent) === line.name) || dialogueCards[lineIndex];
      const textarea = card?.querySelector<HTMLTextAreaElement>("textarea");
      if (textarea) setNativeValue(textarea, line.text);
    });
  }
  studioSceneButtons()[Math.min(data.selectedSceneIndex, Math.max(0, studioSceneButtons().length - 1))]?.click();
  await nextFrame();
}

async function blankStudioDefaults() {
  const setup = document.getElementById("setup");
  if (!setup) return;
  Array.from(setup.querySelectorAll<HTMLSelectElement>("select")).forEach((select) => blankSelect(select));
  studioCharacterCards().forEach((card) => Array.from(card.querySelectorAll<HTMLSelectElement>("select")).forEach((select) => blankSelect(select)));
  const buttons = studioSceneButtons();
  const originalIndex = Math.max(0, buttons.findIndex((button) => String(button.className).toLocaleLowerCase().includes("active")));
  for (let index = 0; index < buttons.length; index += 1) {
    studioSceneButtons()[index]?.click();
    await nextFrame();
    const editor = studioSceneEditor();
    if (editor) Array.from(editor.querySelectorAll<HTMLSelectElement>("select")).forEach((select) => blankSelect(select));
  }
  studioSceneButtons()[originalIndex]?.click();
}

function agentTarget() {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
  const studio = buttons.find((button) => compact(button.textContent) === "AI Studio");
  const series = buttons.find((button) => compact(button.textContent) === "Series Studio");
  if (studio?.dataset.active === "true" || studio?.getAttribute("data-active") === "true") return "studio" as const;
  if (series?.dataset.active === "true" || series?.getAttribute("data-active") === "true") return "series" as const;
  return "" as const;
}

function agentInstruction() {
  return document.querySelector<HTMLTextAreaElement>('main textarea[class*="instruction"], main textarea')?.value || "";
}

function captureAgentDraft(): AgentDraftData {
  return { version: 1, instruction: agentInstruction(), target: agentTarget() };
}

async function restoreAgentDraft(data: AgentDraftData) {
  const textarea = document.querySelector<HTMLTextAreaElement>('main textarea[class*="instruction"], main textarea');
  if (textarea) setNativeValue(textarea, data.instruction || "");
  if (data.target) {
    const wanted = data.target === "studio" ? "AI Studio" : "Series Studio";
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => compact(button.textContent) === wanted)?.click();
  }
  await nextFrame();
}

function blankAgentDefaults() {
  Array.from(document.querySelectorAll<HTMLButtonElement>("button")).forEach((button) => {
    const text = compact(button.textContent);
    if (text === "AI Studio" || text === "Series Studio") button.setAttribute("data-active", "false");
  });
  const partial = document.querySelector<HTMLSelectElement>('select[aria-label="ส่วนที่จะสร้างใหม่"]');
  if (partial) blankSelect(partial);
  document.documentElement.dataset.scPlannerTargetChosen = "false";
}

function seriesSceneButtons() {
  const root = document.getElementById("scene-direction");
  const aside = root?.querySelector("aside");
  return aside ? Array.from(aside.querySelectorAll<HTMLButtonElement>(":scope > button")) : [];
}

async function blankSeriesDefaults() {
  const main = document.querySelector("main");
  if (!main) return;
  Array.from(main.querySelectorAll<HTMLSelectElement>("select")).forEach((select) => {
    const label = fieldLabel(select).toLocaleLowerCase();
    if (label.includes("target duration") || label.includes("เวลารวมเป้าหมาย")) return;
    blankSelect(select);
  });
  const buttons = seriesSceneButtons();
  const originalIndex = Math.max(0, buttons.findIndex((button) => String(button.className).toLocaleLowerCase().includes("active")));
  for (let index = 0; index < buttons.length; index += 1) {
    seriesSceneButtons()[index]?.click();
    await nextFrame();
    const editor = document.getElementById("scene-direction")?.querySelector<HTMLElement>("[class*='sceneEditor']");
    if (editor) Array.from(editor.querySelectorAll<HTMLSelectElement>("select")).forEach((select) => blankSelect(select));
  }
  seriesSceneButtons()[originalIndex]?.click();
}

function safeSeriesRaw() {
  try {
    const raw = localStorage.getItem(SERIES_KEY);
    return raw ? JSON.parse(raw) as unknown : null;
  } catch {
    return null;
  }
}

function pageWorkspace(pathname: string): WorkspaceDraftKind | null {
  if (pathname === "/studio") return "studio";
  if (pathname === "/agent") return "agent";
  if (pathname === "/series") return "series";
  return null;
}

function draftTitle(workspace: WorkspaceDraftKind, data: AnyDraftData) {
  if (workspace === "studio" && "setup" in data) return data.setup["ชื่อตอน"] || "ร่าง AI Studio";
  if (workspace === "agent" && "instruction" in data) return data.instruction.trim().slice(0, 64) || "ร่าง AI Planner";
  if (workspace === "series" && "series" in data && data.series && typeof data.series === "object") {
    const title = (data.series as { title?: unknown }).title;
    return typeof title === "string" && title.trim() ? title : "ร่าง Series Studio";
  }
  return "งานร่าง";
}

export default function WorkspacePageDraftBridge() {
  const pathname = usePathname();
  const workspace = pageWorkspace(pathname);
  const initializedRef = useRef(false);
  const draftIdRef = useRef("");
  const suppressRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const captureBusyRef = useRef(false);

  useEffect(() => {
    if (!workspace) return;
    let active = true;

    const scheduleSave = () => {
      if (!active || suppressRef.current || !getWorkspaceDraftScope()) return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(async () => {
        if (!active || suppressRef.current || captureBusyRef.current) return;
        captureBusyRef.current = true;
        try {
          let data: AnyDraftData | null = null;
          if (workspace === "studio") data = await captureStudioDraft();
          if (workspace === "agent") data = captureAgentDraft();
          if (workspace === "series") {
            await new Promise((resolve) => window.setTimeout(resolve, 70));
            const series = safeSeriesRaw();
            if (series) data = { version: 1, series };
          }
          if (!data) return;
          const meaningful = workspace === "studio"
            ? Object.values((data as StudioDraftData).setup).some((value) => compact(value) && !compact(value).toLocaleLowerCase().startsWith("untitled"))
            : workspace === "agent"
              ? Boolean((data as AgentDraftData).instruction.trim())
              : true;
          if (!meaningful) return;
          const saved = saveWorkspaceDraft({ id: draftIdRef.current || undefined, workspace, title: draftTitle(workspace, data), data });
          if (!saved) return;
          draftIdRef.current = saved.id;
          const url = new URL(window.location.href);
          if (url.searchParams.get("draft") !== saved.id) {
            url.searchParams.set("draft", saved.id);
            window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
          }
          if (workspace === "series") localStorage.removeItem(SERIES_KEY);
        } finally {
          captureBusyRef.current = false;
        }
      }, 1100);
    };

    const initialize = async () => {
      if (!active || initializedRef.current || !getWorkspaceDraftScope()) return;
      const params = new URLSearchParams(window.location.search);
      const requestedId = params.get("draft") || "";

      if (workspace === "series" && !requestedId) {
        const oldRaw = localStorage.getItem(SERIES_KEY);
        if (oldRaw && sessionStorage.getItem(SERIES_MIGRATION_MARKER) !== "done") {
          try {
            const oldSeries = JSON.parse(oldRaw) as { updatedAt?: string; title?: string };
            const fresh = oldSeries.updatedAt && Date.now() - Date.parse(oldSeries.updatedAt) < 24 * 60 * 60 * 1000;
            if (fresh) saveWorkspaceDraft({ workspace: "series", title: oldSeries.title || "ร่าง Series Studio เดิม", data: { version: 1, series: oldSeries } satisfies SeriesDraftData });
          } catch {
            // Invalid legacy workspace is simply discarded.
          }
          localStorage.removeItem(SERIES_KEY);
          sessionStorage.setItem(SERIES_MIGRATION_MARKER, "done");
          window.location.reload();
          return;
        }
      }

      if (requestedId) {
        const draft = readWorkspaceDraft<AnyDraftData>(requestedId);
        if (draft?.workspace === workspace) {
          draftIdRef.current = draft.id;
          suppressRef.current = true;
          if (workspace === "series" && "series" in draft.data) {
            const marker = sessionStorage.getItem(SERIES_RESTORE_MARKER);
            if (marker !== draft.id) {
              localStorage.setItem(SERIES_KEY, JSON.stringify(draft.data.series));
              sessionStorage.setItem(SERIES_RESTORE_MARKER, draft.id);
              window.location.reload();
              return;
            }
            window.setTimeout(() => localStorage.removeItem(SERIES_KEY), 700);
          } else if (workspace === "studio" && "setup" in draft.data) {
            await restoreStudioDraft(draft.data as StudioDraftData);
          } else if (workspace === "agent" && "instruction" in draft.data) {
            await restoreAgentDraft(draft.data as AgentDraftData);
          }
          window.setTimeout(() => { suppressRef.current = false; }, 500);
        }
      } else {
        suppressRef.current = true;
        if (workspace === "studio") await blankStudioDefaults();
        if (workspace === "agent") blankAgentDefaults();
        if (workspace === "series") await blankSeriesDefaults();
        window.setTimeout(() => { suppressRef.current = false; }, 500);
      }
      initializedRef.current = true;
    };

    const targetClickGuard = (event: MouseEvent) => {
      if (workspace !== "agent") return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
      if (!button) return;
      const text = compact(button.textContent);
      if (text === "AI Studio" || text === "Series Studio") {
        document.documentElement.dataset.scPlannerTargetChosen = "true";
        return;
      }
      if ((text.includes("สร้างแผน") || text === "ส่งคำสั่ง") && document.documentElement.dataset.scPlannerTargetChosen !== "true") {
        event.preventDefault();
        event.stopPropagation();
        window.alert("กรุณาเลือก AI Studio หรือ Series Studio ก่อนสร้างแผน");
      }
      if (text.includes("สร้างใหม่เฉพาะส่วนนี้")) {
        const partial = document.querySelector<HTMLSelectElement>('select[aria-label="ส่วนที่จะสร้างใหม่"]');
        if (partial && !partial.value) {
          event.preventDefault();
          event.stopPropagation();
          window.alert("กรุณาเลือกส่วนที่ต้องการสร้างใหม่ก่อน");
        }
      }
    };

    const changed = () => scheduleSave();
    initialize();
    window.addEventListener(WORKSPACE_DRAFT_SCOPE_READY_EVENT, initialize);
    document.addEventListener("input", changed, true);
    document.addEventListener("change", changed, true);
    document.addEventListener("click", changed, true);
    document.addEventListener("click", targetClickGuard, true);

    return () => {
      active = false;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      window.removeEventListener(WORKSPACE_DRAFT_SCOPE_READY_EVENT, initialize);
      document.removeEventListener("input", changed, true);
      document.removeEventListener("change", changed, true);
      document.removeEventListener("click", changed, true);
      document.removeEventListener("click", targetClickGuard, true);
      delete document.documentElement.dataset.scPlannerTargetChosen;
      initializedRef.current = false;
    };
  }, [pathname, workspace]);

  return null;
}
