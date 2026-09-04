"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getVideoUiCapability } from "@/lib/providers/video-ui-capabilities";

type RatioPreview = {
  value: string;
  orientation: string;
  iconWidth: number;
  iconHeight: number;
};

type SubmissionNotice = {
  tone: "info" | "success" | "error";
  text: string;
};

const RATIOS: RatioPreview[] = [
  { value: "16:9 — Widescreen", orientation: "แนวนอน • Widescreen", iconWidth: 32, iconHeight: 18 },
  { value: "9:16 — Vertical", orientation: "แนวตั้ง • Vertical", iconWidth: 18, iconHeight: 32 },
  { value: "1:1 — Square", orientation: "จัตุรัส • Square", iconWidth: 25, iconHeight: 25 },
  { value: "4:5 — Portrait", orientation: "แนวตั้ง • Portrait", iconWidth: 22, iconHeight: 28 },
];

function compact(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function findFieldByLabels(root: HTMLElement, labels: string[]) {
  return Array.from(root.querySelectorAll<HTMLElement>("label, div")).find((field) => {
    const directLabel = Array.from(field.children).find((child) => child.tagName === "SPAN");
    const current = compact(directLabel?.textContent).toLocaleLowerCase();
    return labels.some((label) => current === label.toLocaleLowerCase() || current.startsWith(`${label.toLocaleLowerCase()} /`));
  }) || null;
}

function setNativeSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function isStudioSubmitButton(button: HTMLButtonElement) {
  const text = compact(button.textContent);
  return text.includes("ส่งให้ทีม AI ผลิต") || text.includes("ส่ง Storyboard ให้ทีม AI");
}

function findStudioSubmitButton() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(isStudioSubmitButton) || null;
}

function readStudioSubmissionStatus() {
  const button = findStudioSubmitButton();
  if (!button) return "";
  const siblingStatus = button.parentElement?.querySelector<HTMLElement>("span");
  return compact(siblingStatus?.textContent);
}

function submissionTone(text: string): SubmissionNotice["tone"] {
  const normalized = text.toLocaleLowerCase();
  if (normalized.includes("ส่งงานให้ทีม ai แล้ว") || normalized.includes("สำเร็จ") || normalized.includes("เข้าคิวแล้ว")) return "success";
  if (normalized.includes("กำลัง") || normalized.includes("ตรวจสอบ")) return "info";
  return "error";
}

function RatioFrame({ ratio }: { ratio: RatioPreview }) {
  return (
    <span className="sc-ratio-frame-shell" aria-hidden="true">
      <span
        className="sc-ratio-frame-shape"
        style={{ width: ratio.iconWidth, height: ratio.iconHeight }}
      />
    </span>
  );
}

function AspectPicker({
  select,
  modelSelect,
}: {
  select: HTMLSelectElement;
  modelSelect: HTMLSelectElement;
}) {
  const [value, setValue] = useState(select.value);
  const [model, setModel] = useState(modelSelect.value);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => {
      setValue(select.value);
      setModel(modelSelect.value);
    };
    sync();
    select.addEventListener("change", sync);
    modelSelect.addEventListener("change", sync);
    return () => {
      select.removeEventListener("change", sync);
      modelSelect.removeEventListener("change", sync);
    };
  }, [select, modelSelect]);

  const capability = getVideoUiCapability(model);
  const selected = RATIOS.find((item) => item.value === value) || null;

  useEffect(() => {
    // Empty is intentional until the user makes a choice. Only normalize a
    // previously selected ratio when the chosen model truly does not support it.
    if (!select.value || capability.ratioValues.includes(select.value)) return;
    const fallback = capability.ratioValues[0];
    if (fallback) setNativeSelectValue(select, fallback);
  }, [capability, select]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", keydown);
    };
  }, [open]);

  return (
    <div className="sc-ratio-picker" ref={rootRef} data-sc-help-ignore>
      <button
        type="button"
        className="sc-ratio-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        {selected ? <RatioFrame ratio={selected} /> : <span className="sc-ratio-frame-shell" aria-hidden="true">&nbsp;</span>}
        <span className="sc-ratio-trigger-copy">
          <strong>{selected ? selected.value : "\u00A0"}</strong>
          <small>{selected ? selected.orientation : "\u00A0"}</small>
        </span>
        <span className="sc-ratio-chevron" aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div className="sc-ratio-menu" role="listbox" aria-label="อัตราส่วนภาพ">
          {RATIOS.map((ratio) => {
            const supported = capability.ratioValues.includes(ratio.value);
            const active = ratio.value === value;
            return (
              <button
                key={ratio.value}
                type="button"
                role="option"
                aria-selected={active}
                disabled={!supported}
                className={`sc-ratio-option${active ? " is-active" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!supported) return;
                  setNativeSelectValue(select, ratio.value);
                  setOpen(false);
                }}
              >
                <RatioFrame ratio={ratio} />
                <span>
                  <strong>{ratio.value}</strong>
                  <small>{supported ? ratio.orientation : `${ratio.orientation} • API รุ่นนี้ไม่รองรับตรง`}</small>
                </span>
                {active ? <b aria-hidden="true">✓</b> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function SingleEpisodeStudioPolish() {
  const [aspectField, setAspectField] = useState<HTMLElement | null>(null);
  const [aspectSelect, setAspectSelect] = useState<HTMLSelectElement | null>(null);
  const [modelSelect, setModelSelect] = useState<HTMLSelectElement | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<SubmissionNotice | null>(null);

  useEffect(() => {
    let lastStatus = "";
    let clearTimer = 0;
    let probeTimer = 0;

    const armAutoHide = () => {
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => setSubmissionNotice(null), 6000);
    };

    const publish = (text: string) => {
      const value = compact(text);
      if (!value || value === "พร้อมสร้างตอนเดียว") return;
      lastStatus = value;
      const tone = submissionTone(value);
      setSubmissionNotice({ tone, text: value });
      armAutoHide();
    };

    const syncStatus = () => publish(readStudioSubmissionStatus());

    const clickHandler = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLButtonElement>("button");
      if (!button || !isStudioSubmitButton(button) || button.disabled) return;

      lastStatus = "";
      setSubmissionNotice({ tone: "info", text: "กำลังตรวจสอบข้อมูลก่อนส่งงานให้ทีม AI..." });
      armAutoHide();
      window.clearTimeout(probeTimer);
      probeTimer = window.setTimeout(() => {
        const status = readStudioSubmissionStatus();
        if (status && status !== "พร้อมสร้างตอนเดียว") publish(status);
      }, 1200);
      window.setTimeout(syncStatus, 0);
      window.setTimeout(syncStatus, 150);
    };

    const observer = new MutationObserver(syncStatus);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", clickHandler, true);
    syncStatus();

    return () => {
      observer.disconnect();
      document.removeEventListener("click", clickHandler, true);
      window.clearTimeout(clearTimer);
      window.clearTimeout(probeTimer);
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let discoveredAspectSelect: HTMLSelectElement | null = null;

    const discover = () => {
      if (stopped) return;
      const setup = document.getElementById("setup");
      const scenes = document.getElementById("scenes");
      if (!setup || !scenes) {
        timer = window.setTimeout(discover, 80);
        return;
      }

      const aspect = findFieldByLabels(setup, ["อัตราส่วนภาพ", "Aspect Ratio"]);
      const model = findFieldByLabels(setup, ["โมเดลวิดีโอ", "Video Model"]);
      const nextAspectSelect = aspect?.querySelector<HTMLSelectElement>("select") || null;
      const nextModelSelect = model?.querySelector<HTMLSelectElement>("select") || null;

      discoveredAspectSelect = nextAspectSelect;
      if (nextAspectSelect && nextModelSelect) nextAspectSelect.style.display = "none";
      setAspectField(aspect);
      setAspectSelect(nextAspectSelect);
      setModelSelect(nextModelSelect);

      const suppressFixedSceneHelp = () => {
        const selectors = [
          "[class*='single-episode-studio_sceneList']",
          "[class*='single-episode-studio_timeline']",
          "[class*='single-episode-studio_sceneEditorHead']",
          "[class*='single-episode-studio_sceneDuration']",
        ];
        selectors.forEach((selector) => {
          scenes.querySelectorAll<HTMLElement>(selector).forEach((scope) => {
            scope.dataset.scHelpIgnore = "true";
            scope.querySelectorAll(".sc-system-info-trigger").forEach((node) => node.remove());
          });
        });
      };

      suppressFixedSceneHelp();
      const observer = new MutationObserver(suppressFixedSceneHelp);
      observer.observe(scenes, { childList: true, subtree: true });
      (scenes as HTMLElement & { __scPolishObserver?: MutationObserver }).__scPolishObserver = observer;
    };

    discover();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      if (discoveredAspectSelect) discoveredAspectSelect.style.display = "";
      const scenes = document.getElementById("scenes") as (HTMLElement & { __scPolishObserver?: MutationObserver }) | null;
      scenes?.__scPolishObserver?.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        .sc-ratio-picker{position:relative;margin-top:0}
        .sc-ratio-trigger{width:100%;min-height:43px;display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:9px;background:var(--input);color:var(--text);padding:7px 10px;text-align:left;cursor:pointer}
        .sc-ratio-trigger:focus-visible{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 14%,transparent)}
        .sc-ratio-frame-shell{width:42px;height:34px;flex:0 0 42px;display:grid;place-items:center;border:1px solid var(--border);border-radius:7px;background:var(--surface3)}
        .sc-ratio-frame-shape{display:block;border:2px solid var(--accent);border-radius:3px;background:color-mix(in srgb,var(--accent) 9%,transparent)}
        .sc-ratio-trigger-copy{min-width:0;flex:1}.sc-ratio-trigger-copy strong,.sc-ratio-trigger-copy small{display:block}
        .sc-ratio-trigger-copy strong{font-size:11px}.sc-ratio-trigger-copy small{margin:1px 0 0;color:var(--muted);font-size:9px}
        .sc-ratio-chevron{color:var(--muted);font-size:16px}
        .sc-ratio-menu{position:absolute;z-index:80;top:calc(100% + 5px);left:0;right:0;display:grid;gap:4px;padding:6px;border:1px solid var(--borderStrong);border-radius:10px;background:var(--surface);box-shadow:0 18px 45px rgba(0,0,0,.3)}
        .sc-ratio-option{width:100%;display:flex;align-items:center;gap:10px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--text);padding:7px;text-align:left;cursor:pointer}
        .sc-ratio-option:hover:not(:disabled),.sc-ratio-option.is-active{border-color:var(--borderStrong);background:var(--accentSoft)}
        .sc-ratio-option:disabled{opacity:.38;cursor:not-allowed}.sc-ratio-option>span:nth-child(2){min-width:0;flex:1}
        .sc-ratio-option strong,.sc-ratio-option small{display:block}.sc-ratio-option strong{font-size:11px}.sc-ratio-option small{margin-top:1px;color:var(--muted);font-size:9px}.sc-ratio-option>b{color:var(--accent)}
        .sc-submit-feedback{position:fixed;z-index:9999;top:18px;right:18px;width:min(430px,calc(100vw - 36px));display:flex;align-items:flex-start;gap:11px;padding:13px 14px;border:1px solid var(--borderStrong);border-radius:12px;background:color-mix(in srgb,var(--surface) 94%,transparent);box-shadow:0 18px 50px rgba(0,0,0,.42);backdrop-filter:blur(14px);color:var(--text)}
        .sc-submit-feedback[data-tone='info']{border-color:color-mix(in srgb,var(--accent) 55%,var(--borderStrong))}
        .sc-submit-feedback[data-tone='success']{border-color:rgba(70,190,130,.58)}
        .sc-submit-feedback[data-tone='error']{border-color:rgba(245,100,120,.68)}
        .sc-submit-feedback-icon{width:28px;height:28px;flex:0 0 28px;display:grid;place-items:center;border-radius:8px;background:var(--accentSoft);color:var(--accent);font-weight:900}
        .sc-submit-feedback[data-tone='success'] .sc-submit-feedback-icon{color:#72d9a3;background:rgba(70,190,130,.12)}
        .sc-submit-feedback[data-tone='error'] .sc-submit-feedback-icon{color:#ff8da0;background:rgba(245,100,120,.12)}
        .sc-submit-feedback-copy{min-width:0;flex:1}.sc-submit-feedback-copy strong{display:block;font-size:12px;margin-bottom:3px}.sc-submit-feedback-copy p{margin:0;color:var(--muted);font-size:11px;line-height:1.5;overflow-wrap:anywhere}
        .sc-submit-feedback-close{border:0;background:transparent;color:var(--muted);font-size:18px;line-height:1;cursor:pointer;padding:2px 3px}.sc-submit-feedback-close:hover{color:var(--text)}
        @media (max-width:720px){.sc-submit-feedback{top:10px;right:10px;width:calc(100vw - 20px)}}
      `}</style>
      {aspectField && aspectSelect && modelSelect
        ? createPortal(<AspectPicker select={aspectSelect} modelSelect={modelSelect} />, aspectField)
        : null}
      {submissionNotice ? (
        <div className="sc-submit-feedback" data-tone={submissionNotice.tone} role={submissionNotice.tone === "error" ? "alert" : "status"} aria-live="polite">
          <span className="sc-submit-feedback-icon" aria-hidden="true">
            {submissionNotice.tone === "success" ? "✓" : submissionNotice.tone === "error" ? "!" : "…"}
          </span>
          <span className="sc-submit-feedback-copy">
            <strong>{submissionNotice.tone === "success" ? "ส่งงานแล้ว" : submissionNotice.tone === "error" ? "ส่งงานไม่ได้" : "กำลังดำเนินการ"}</strong>
            <p>{submissionNotice.text}</p>
          </span>
          <button type="button" className="sc-submit-feedback-close" onClick={() => setSubmissionNotice(null)} aria-label="ปิดข้อความ">×</button>
        </div>
      ) : null}
    </>
  );
}
