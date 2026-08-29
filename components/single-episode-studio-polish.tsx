"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getVideoUiCapability } from "@/lib/providers/video-ui-capabilities";

type RatioPreview = {
  value: string;
  short: string;
  orientation: string;
  iconWidth: number;
  iconHeight: number;
};

const RATIOS: RatioPreview[] = [
  { value: "16:9 — Widescreen", short: "16:9", orientation: "แนวนอน • Widescreen", iconWidth: 32, iconHeight: 18 },
  { value: "9:16 — Vertical", short: "9:16", orientation: "แนวตั้ง • Vertical", iconWidth: 18, iconHeight: 32 },
  { value: "1:1 — Square", short: "1:1", orientation: "จัตุรัส • Square", iconWidth: 25, iconHeight: 25 },
  { value: "4:5 — Portrait", short: "4:5", orientation: "แนวตั้ง • Portrait", iconWidth: 22, iconHeight: 28 },
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

function setNativeSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function nextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function timelineButtons(root: HTMLElement) {
  const timeline = root.querySelector<HTMLElement>("[class*='single-episode-studio_timeline']");
  return timeline ? Array.from(timeline.querySelectorAll<HTMLButtonElement>("button")) : [];
}

function timelineDurations(root: HTMLElement) {
  return timelineButtons(root).map((button) => {
    const raw = compact(button.querySelector("span")?.textContent);
    const match = raw.match(/(\d+)\s*s/i);
    return match ? Number(match[1]) : 0;
  }).filter((value) => value > 0);
}

function RatioFrame({ ratio }: { ratio: RatioPreview }) {
  return <span className="sc-ratio-frame-shell" aria-hidden="true">
    <span
      className="sc-ratio-frame-shape"
      style={{ width: ratio.iconWidth, height: ratio.iconHeight }}
    />
  </span>;
}

function AspectPicker({ select, modelSelect }: { select: HTMLSelectElement; modelSelect: HTMLSelectElement }) {
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
    const timer = window.setInterval(sync, 700);
    return () => {
      select.removeEventListener("change", sync);
      modelSelect.removeEventListener("change", sync);
      window.clearInterval(timer);
    };
  }, [select, modelSelect]);

  const capability = getVideoUiCapability(model);
  const selected = RATIOS.find((item) => item.value === value) || RATIOS[0];

  useEffect(() => {
    if (capability.ratioValues.includes(select.value)) return;
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

  return <div className="sc-ratio-picker" ref={rootRef} data-sc-help-ignore>
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
      <RatioFrame ratio={selected} />
      <span className="sc-ratio-trigger-copy">
        <strong>{selected.value}</strong>
        <small>{selected.orientation}</small>
      </span>
      <span className="sc-ratio-chevron" aria-hidden="true">⌄</span>
    </button>

    {open ? <div className="sc-ratio-menu" role="listbox" aria-label="Aspect Ratio">
      {RATIOS.map((ratio) => {
        const supported = capability.ratioValues.includes(ratio.value);
        const active = ratio.value === value;
        return <button
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
        </button>;
      })}
      <div className="sc-ratio-menu-note">ตัวเลือกถูกกรองตาม Adapter ของ {model}</div>
    </div> : null}
  </div>;
}

function DurationSetup({ source, modelSelect, scenesRoot }: { source: HTMLInputElement; modelSelect: HTMLSelectElement; scenesRoot: HTMLElement }) {
  const [model, setModel] = useState(modelSelect.value);
  const [totalDuration, setTotalDuration] = useState(Number(source.value || 30));
  const [sceneCount, setSceneCount] = useState(Math.max(1, timelineButtons(scenesRoot).length));
  const [sceneDurations, setSceneDurations] = useState<number[]>(timelineDurations(scenesRoot));
  const [selectedSeconds, setSelectedSeconds] = useState(10);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");

  const capability = getVideoUiCapability(model);
  const durationOptions = useMemo(
    () => capability.durationSeconds.filter((seconds) => {
      const total = seconds * Math.max(1, sceneCount);
      return total >= 10 && total <= 180;
    }),
    [capability, sceneCount],
  );

  useEffect(() => {
    const sync = () => {
      setModel(modelSelect.value);
      setTotalDuration(Number(source.value || 30));
      const durations = timelineDurations(scenesRoot);
      setSceneDurations(durations);
      setSceneCount(Math.max(1, durations.length || timelineButtons(scenesRoot).length));
    };
    sync();
    source.addEventListener("input", sync);
    source.addEventListener("change", sync);
    modelSelect.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(scenesRoot, { childList: true, subtree: true, characterData: true });
    const timer = window.setInterval(sync, 800);
    return () => {
      source.removeEventListener("input", sync);
      source.removeEventListener("change", sync);
      modelSelect.removeEventListener("change", sync);
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [source, modelSelect, scenesRoot]);

  useEffect(() => {
    const uniform = sceneDurations.length > 0 && sceneDurations.every((value) => value === sceneDurations[0]);
    const current = uniform ? sceneDurations[0] : 0;
    const preferred = durationOptions.includes(current)
      ? current
      : durationOptions.includes(capability.defaultDurationSeconds)
        ? capability.defaultDurationSeconds
        : durationOptions[0] || capability.defaultDurationSeconds;
    setSelectedSeconds(preferred);
  }, [model, sceneCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const apiCompatible = sceneDurations.length === sceneCount
    && sceneDurations.every((seconds) => capability.durationSeconds.includes(seconds));

  const applyUniformDuration = useCallback(async (seconds: number) => {
    const buttons = timelineButtons(scenesRoot);
    const count = buttons.length;
    if (!count) return;
    const nextTotal = seconds * count;
    if (nextTotal < 10 || nextTotal > 180) {
      setMessage(`ค่านี้ทำให้ตอนรวม ${nextTotal}s ซึ่งอยู่นอกช่วง 10–180s`);
      return;
    }

    setApplying(true);
    setMessage("");
    try {
      const activeIndex = Math.max(0, buttons.findIndex((button) => button.className.includes("timelineActive")));
      const currentTotal = Number(source.value || 30);

      if (nextTotal > currentTotal) {
        setNativeRangeValue(source, String(nextTotal));
        await nextPaint();
      }

      for (const button of buttons) {
        button.click();
        await nextPaint();
        const sceneRange = scenesRoot.querySelector<HTMLInputElement>("[class*='single-episode-studio_sceneDuration'] input[type='range']");
        if (sceneRange) {
          setNativeRangeValue(sceneRange, String(seconds));
          await nextPaint();
        }
      }

      setNativeRangeValue(source, String(nextTotal));
      await nextPaint();
      timelineButtons(scenesRoot)[activeIndex]?.click();
      await nextPaint();
      setTotalDuration(nextTotal);
      setSceneDurations(timelineDurations(scenesRoot));
      setMessage(`ตั้ง ${count} ฉาก × ${seconds}s = ${nextTotal}s แล้ว`);
    } finally {
      setApplying(false);
    }
  }, [source, scenesRoot]);

  return <div className="sc-episode-duration-setup" data-sc-help-ignore>
    <div className="sc-episode-duration-setup__head">
      <div>
        <strong>เวลาเริ่มต้นต่อฉาก</strong>
        <span>{model} รองรับ {capability.durationLabel} • เลือกจาก API โดยตรง ไม่ต้องพิมพ์เลขเอง</span>
      </div>
      <div className="sc-duration-total">
        <small>ความยาวรวมของตอน</small>
        <b>{totalDuration} วินาที</b>
      </div>
    </div>

    {durationOptions.length ? <div className="sc-duration-controls">
      <label>
        <span>เวลาต่อฉาก</span>
        <select
          value={selectedSeconds}
          disabled={applying}
          onChange={(event) => {
            const seconds = Number(event.target.value);
            setSelectedSeconds(seconds);
            void applyUniformDuration(seconds);
          }}
        >
          {durationOptions.map((seconds) => <option key={seconds} value={seconds}>{seconds} วินาที</option>)}
        </select>
      </label>
      <div className="sc-duration-equation">
        <strong>{sceneCount} ฉาก × {selectedSeconds}s</strong>
        <span>= {sceneCount * selectedSeconds} วินาที</span>
      </div>
      <button type="button" disabled={applying} onClick={() => void applyUniformDuration(selectedSeconds)}>
        {applying ? "กำลังจัดเวลา…" : "ใช้เวลานี้กับทุกฉาก"}
      </button>
    </div> : <div className="sc-duration-warning">{model} ไม่มีค่าความยาวที่พอดีกับ {sceneCount} ฉาก ภายใต้ Episode 10–180 วินาที กรุณาเพิ่มจำนวนฉาก</div>}

    <div className={`sc-duration-status ${apiCompatible ? "is-ok" : "is-warn"}`}>
      <span>{apiCompatible ? "✓ เวลาของทุกฉากตรงกับ API" : "! มีฉากที่เวลาไม่ตรงกับ API ของโมเดลนี้"}</span>
      <small>{sceneDurations.length ? `เวลาปัจจุบัน: ${sceneDurations.join("s • ")}s` : "กำลังอ่าน Timeline"}</small>
    </div>
    {message ? <div className="sc-duration-message">{message}</div> : null}
  </div>;
}

export default function SingleEpisodeStudioPolish() {
  const [setupGrid, setSetupGrid] = useState<HTMLElement | null>(null);
  const [aspectField, setAspectField] = useState<HTMLLabelElement | null>(null);
  const [aspectSelect, setAspectSelect] = useState<HTMLSelectElement | null>(null);
  const [modelSelect, setModelSelect] = useState<HTMLSelectElement | null>(null);
  const [durationSource, setDurationSource] = useState<HTMLInputElement | null>(null);
  const [scenesRoot, setScenesRoot] = useState<HTMLElement | null>(null);

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
      const model = findFieldByLabel(setup, "Video Model");
      const ratioSelect = aspect?.querySelector<HTMLSelectElement>("select") || null;
      const videoModelSelect = model?.querySelector<HTMLSelectElement>("select") || null;
      const totalRange = Array.from(scenes.querySelectorAll<HTMLInputElement>("input[type='range']")).find((input) =>
        compact(input.parentElement?.textContent).includes("เวลารวมของตอน"),
      ) || null;

      setSetupGrid(grid || null);
      setAspectField(aspect);
      setAspectSelect(ratioSelect);
      setModelSelect(videoModelSelect);
      setDurationSource(totalRange);
      setScenesRoot(scenes);

      if (totalRange?.parentElement) totalRange.parentElement.dataset.scDurationSource = "true";
      if (ratioSelect) ratioSelect.dataset.scAspectSource = "true";
      if (aspect) aspect.dataset.scHelpIgnore = "true";

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
      document.querySelectorAll<HTMLElement>("[data-sc-aspect-source='true']").forEach((node) => node.removeAttribute("data-sc-aspect-source"));
    };
  }, []);

  return <>
    <style>{`
      [data-sc-duration-source="true"]{display:none!important}
      [data-sc-aspect-source="true"]{display:none!important}

      .sc-episode-duration-setup{
        grid-column:1/-1;display:grid;gap:10px;margin-top:2px;padding:13px 14px;
        border:1px solid var(--border);border-radius:11px;background:var(--surface2);
      }
      .sc-episode-duration-setup__head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .sc-episode-duration-setup__head strong,.sc-episode-duration-setup__head span{display:block}
      .sc-episode-duration-setup__head>div:first-child strong{font-size:12px;color:var(--text)}
      .sc-episode-duration-setup__head>div:first-child span{margin-top:2px;color:var(--muted);font-size:10px;line-height:1.45}
      .sc-duration-total{text-align:right;white-space:nowrap}
      .sc-duration-total small,.sc-duration-total b{display:block}
      .sc-duration-total small{color:var(--muted);font-size:9px}
      .sc-duration-total b{margin-top:1px;color:var(--accent);font-size:15px}
      .sc-duration-controls{display:grid;grid-template-columns:minmax(150px,220px) minmax(140px,1fr) auto;gap:9px;align-items:end}
      .sc-duration-controls label>span{display:block;margin-bottom:5px;color:var(--text);font-size:10px;font-weight:850}
      .sc-duration-controls select{width:100%;min-height:39px;border:1px solid var(--border);border-radius:9px;background:var(--input);color:var(--text);padding:8px 10px}
      .sc-duration-equation{min-height:39px;display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:9px;background:var(--surface3);padding:8px 11px}
      .sc-duration-equation strong{font-size:11px;color:var(--text)}
      .sc-duration-equation span{color:var(--accent);font-size:11px;font-weight:900}
      .sc-duration-controls>button{min-height:39px;border:1px solid var(--borderStrong);border-radius:9px;background:var(--accentSoft);color:var(--accent);padding:8px 12px;font-size:10px;font-weight:900;cursor:pointer}
      .sc-duration-controls>button:disabled{opacity:.5;cursor:wait}
      .sc-duration-status{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--border);padding-top:8px}
      .sc-duration-status span{font-size:10px;font-weight:850}.sc-duration-status small{color:var(--muted);font-size:9px}
      .sc-duration-status.is-ok span{color:#63c98a}.sc-duration-status.is-warn span{color:#e5a45d}
      .sc-duration-message{color:var(--accent);font-size:9px;font-weight:800}
      .sc-duration-warning{border:1px solid color-mix(in srgb,#e5a45d 38%,var(--border));border-radius:9px;background:color-mix(in srgb,#e5a45d 8%,var(--surface));color:#e5a45d;padding:10px;font-size:10px}

      .sc-ratio-picker{position:relative;margin-top:0}
      .sc-ratio-trigger{width:100%;min-height:43px;display:flex;align-items:center;gap:9px;border:1px solid var(--border);border-radius:9px;background:var(--input);color:var(--text);padding:6px 9px;text-align:left;cursor:pointer}
      .sc-ratio-trigger:hover,.sc-ratio-trigger[aria-expanded="true"]{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}
      .sc-ratio-trigger-copy{min-width:0;flex:1}.sc-ratio-trigger-copy strong,.sc-ratio-trigger-copy small{display:block}.sc-ratio-trigger-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.sc-ratio-trigger-copy small{margin-top:1px;color:var(--muted);font-size:8px}
      .sc-ratio-chevron{color:var(--muted);font-size:17px;line-height:1}
      .sc-ratio-frame-shell{width:42px;height:32px;flex:0 0 42px;display:grid;place-items:center;border:1px dashed var(--borderStrong);border-radius:6px;background:var(--surface3)}
      .sc-ratio-frame-shape{display:block;border:2px solid var(--accent);border-radius:3px;background:color-mix(in srgb,var(--accent) 10%,var(--surface))}
      .sc-ratio-menu{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:80;display:grid;gap:4px;padding:6px;border:1px solid var(--borderStrong);border-radius:11px;background:var(--surface);box-shadow:0 18px 45px rgba(0,0,0,.28)}
      .sc-ratio-option{width:100%;min-height:49px;display:grid;grid-template-columns:42px minmax(0,1fr) 20px;align-items:center;gap:8px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--text);padding:6px;text-align:left;cursor:pointer}
      .sc-ratio-option:hover:not(:disabled),.sc-ratio-option.is-active{border-color:var(--borderStrong);background:var(--accentSoft)}
      .sc-ratio-option:disabled{opacity:.38;cursor:not-allowed}.sc-ratio-option>span:nth-child(2){min-width:0}.sc-ratio-option strong,.sc-ratio-option small{display:block}.sc-ratio-option strong{font-size:10px}.sc-ratio-option small{margin-top:1px;color:var(--muted);font-size:8px;line-height:1.35}.sc-ratio-option>b{color:var(--accent);font-size:12px;text-align:center}
      .sc-ratio-menu-note{margin-top:2px;border-top:1px solid var(--border);padding:6px 5px 1px;color:var(--muted);font-size:8px}

      @media(max-width:900px){
        .sc-duration-controls{grid-template-columns:1fr}.sc-duration-status{align-items:flex-start;flex-direction:column}.sc-duration-total{text-align:left}
        .sc-ratio-menu{min-width:260px;right:auto}
      }
    `}</style>
    {setupGrid && durationSource && modelSelect && scenesRoot
      ? createPortal(<DurationSetup source={durationSource} modelSelect={modelSelect} scenesRoot={scenesRoot} />, setupGrid)
      : null}
    {aspectField && aspectSelect && modelSelect
      ? createPortal(<AspectPicker select={aspectSelect} modelSelect={modelSelect} />, aspectField)
      : null}
  </>;
}
