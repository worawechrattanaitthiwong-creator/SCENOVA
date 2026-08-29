"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type RatioPreview = {
  value: string;
  short: string;
  orientation: string;
  width: number;
  height: number;
};

const RATIOS: RatioPreview[] = [
  { value: "16:9 — Widescreen", short: "16:9", orientation: "แนวนอน • Widescreen", width: 112, height: 63 },
  { value: "9:16 — Vertical", short: "9:16", orientation: "แนวตั้ง • Vertical", width: 48, height: 85 },
  { value: "1:1 — Square", short: "1:1", orientation: "จัตุรัส • Square", width: 78, height: 78 },
  { value: "4:5 — Portrait", short: "4:5", orientation: "แนวตั้ง • Portrait", width: 64, height: 80 },
];

function compact(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function findFieldByLabel(root: HTMLElement, label: string) {
  return Array.from(root.querySelectorAll<HTMLLabelElement>("label")).find((field) => {
    const directLabel = Array.from(field.children).find((child) => child.tagName === "SPAN");
    return compact(directLabel?.textContent) === label;
  }) || null;
}

function setNativeRangeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function AspectPreview({ select }: { select: HTMLSelectElement }) {
  const [value, setValue] = useState(select.value);

  useEffect(() => {
    const sync = () => setValue(select.value);
    sync();
    select.addEventListener("change", sync);
    const timer = window.setInterval(sync, 700);
    return () => {
      select.removeEventListener("change", sync);
      window.clearInterval(timer);
    };
  }, [select]);

  const selected = RATIOS.find((item) => item.value === value) || RATIOS[0];

  return <div className="sc-aspect-preview" data-sc-help-ignore>
    <div className="sc-aspect-preview__stage" aria-hidden="true">
      <div
        className="sc-aspect-preview__frame"
        style={{ width: selected.width, height: selected.height }}
      >
        <span>{selected.short}</span>
      </div>
    </div>
    <div className="sc-aspect-preview__copy">
      <strong>{selected.orientation}</strong>
      <span>กรอบตัวอย่างสัดส่วนภาพของวิดีโอทั้งตอน</span>
    </div>
  </div>;
}

function DurationSetup({ source }: { source: HTMLInputElement }) {
  const [duration, setDuration] = useState(Number(source.value || 30));
  const [summary, setSummary] = useState("");

  useEffect(() => {
    const panel = source.parentElement;
    const sync = () => {
      setDuration(Number(source.value || 30));
      const helper = panel?.querySelector("small");
      setSummary(compact(helper?.textContent));
    };
    sync();
    source.addEventListener("input", sync);
    source.addEventListener("change", sync);
    const observer = panel ? new MutationObserver(sync) : null;
    observer?.observe(panel!, { childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(sync, 700);
    return () => {
      source.removeEventListener("input", sync);
      source.removeEventListener("change", sync);
      observer?.disconnect();
      window.clearInterval(timer);
    };
  }, [source]);

  return <div className="sc-episode-duration-setup" data-sc-help-ignore>
    <div className="sc-episode-duration-setup__head">
      <div>
        <strong>ความยาวรวมของตอน</strong>
        <span>กำหนดเวลาหลักก่อนแบ่งเป็นฉาก ระบบจะไม่ให้เวลารวมของทุกฉากเกินค่านี้</span>
      </div>
      <b>{duration} วินาที</b>
    </div>
    <input
      type="range"
      min={10}
      max={180}
      step={5}
      value={duration}
      aria-label="ความยาวรวมของตอน"
      onChange={(event) => setNativeRangeValue(source, event.target.value)}
    />
    <div className="sc-episode-duration-setup__scale"><span>10s</span><span>180s</span></div>
    {summary ? <small>{summary}</small> : null}
  </div>;
}

export default function SingleEpisodeStudioPolish() {
  const [setupGrid, setSetupGrid] = useState<HTMLElement | null>(null);
  const [aspectField, setAspectField] = useState<HTMLLabelElement | null>(null);
  const [aspectSelect, setAspectSelect] = useState<HTMLSelectElement | null>(null);
  const [durationSource, setDurationSource] = useState<HTMLInputElement | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer = 0;

    const discover = () => {
      if (stopped) return;
      const setup = document.getElementById("setup");
      const scenes = document.getElementById("scenes");
      if (!setup || !scenes) {
        timer = window.setTimeout(discover, 80);
        return;
      }

      const grid = setup.querySelector<HTMLElement>("[class*='single-episode-studio_setupGrid']");
      const aspect = findFieldByLabel(setup, "Aspect Ratio");
      const select = aspect?.querySelector<HTMLSelectElement>("select") || null;
      const totalRange = Array.from(scenes.querySelectorAll<HTMLInputElement>("input[type='range']")).find((input) =>
        compact(input.parentElement?.textContent).includes("เวลารวมของตอน"),
      ) || null;

      setSetupGrid(grid || null);
      setAspectField(aspect);
      setAspectSelect(select);
      setDurationSource(totalRange);

      if (totalRange?.parentElement) totalRange.parentElement.dataset.scDurationSource = "true";

      const suppressFixedSceneHelp = () => {
        const selectors = [
          "[class*='single-episode-studio_sceneList']",
          "[class*='single-episode-studio_timeline']",
          "[class*='single-episode-studio_sceneEditorHead']",
          "[class*='single-episode-studio_sceneDuration']",
        ].join(",");
        scenes.querySelectorAll<HTMLElement>(selectors).forEach((scope) => {
          scope.dataset.scHelpIgnore = "true";
          scope.querySelectorAll(".sc-system-info-trigger").forEach((node) => node.remove());
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
      const scenes = document.getElementById("scenes") as (HTMLElement & { __scPolishObserver?: MutationObserver }) | null;
      scenes?.__scPolishObserver?.disconnect();
      scenes?.querySelectorAll<HTMLElement>("[data-sc-help-ignore='true']").forEach((node) => node.removeAttribute("data-sc-help-ignore"));
      document.querySelectorAll<HTMLElement>("[data-sc-duration-source='true']").forEach((node) => node.removeAttribute("data-sc-duration-source"));
    };
  }, []);

  return <>
    <style>{`
      [data-sc-duration-source="true"] { display:none !important; }
      .sc-episode-duration-setup{
        grid-column:1/-1;display:grid;gap:8px;margin-top:2px;padding:13px 14px;
        border:1px solid var(--border);border-radius:11px;background:var(--surface2);
      }
      .sc-episode-duration-setup__head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .sc-episode-duration-setup__head strong,.sc-episode-duration-setup__head span{display:block}
      .sc-episode-duration-setup__head strong{font-size:12px;color:var(--text)}
      .sc-episode-duration-setup__head span{margin-top:2px;color:var(--muted);font-size:10px;line-height:1.45}
      .sc-episode-duration-setup__head b{white-space:nowrap;color:var(--accent);font-size:13px}
      .sc-episode-duration-setup input{width:100%;accent-color:var(--accent)}
      .sc-episode-duration-setup__scale{display:flex;justify-content:space-between;color:var(--muted2);font-size:9px}
      .sc-episode-duration-setup>small{color:var(--muted);font-size:10px}
      .sc-aspect-preview{display:flex;align-items:center;gap:10px;margin-top:7px;padding:8px 9px;border:1px solid var(--border);border-radius:9px;background:var(--surface2)}
      .sc-aspect-preview__stage{width:124px;height:88px;flex:0 0 124px;display:grid;place-items:center;border:1px dashed var(--borderStrong);border-radius:8px;background:var(--surface3)}
      .sc-aspect-preview__frame{display:grid;place-items:center;border:2px solid var(--accent);border-radius:5px;background:color-mix(in srgb,var(--accent) 10%,var(--surface));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 12%,transparent)}
      .sc-aspect-preview__frame span{color:var(--accent);font-size:9px;font-weight:900}
      .sc-aspect-preview__copy{min-width:0}
      .sc-aspect-preview__copy strong,.sc-aspect-preview__copy span{display:block}
      .sc-aspect-preview__copy strong{font-size:10px;color:var(--text)}
      .sc-aspect-preview__copy span{margin-top:2px;color:var(--muted);font-size:9px;line-height:1.4}
      @media (max-width:900px){.sc-aspect-preview{align-items:flex-start;flex-direction:column}.sc-aspect-preview__stage{width:100%}}
    `}</style>
    {setupGrid && durationSource ? createPortal(<DurationSetup source={durationSource} />, setupGrid) : null}
    {aspectField && aspectSelect ? createPortal(<AspectPreview select={aspectSelect} />, aspectField) : null}
  </>;
}
