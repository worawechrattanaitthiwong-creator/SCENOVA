"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Readiness = "ready" | "tool" | "setup" | "offline" | "checking";

type PickerOption = {
  value: string;
  label: string;
  readiness: Readiness;
};

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

function readinessFromText(raw: string): Readiness {
  if (raw.includes("🟢")) return "ready";
  if (raw.includes("🟣")) return "tool";
  if (raw.includes("🟠")) return "setup";
  if (raw.includes("🔴")) return "offline";
  return "checking";
}

function cleanLabel(raw: string) {
  return compact(raw)
    .replace(/[⚪🟢🟣🟠🔴⚠️🖼🎞]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readOptions(select: HTMLSelectElement): PickerOption[] {
  return Array.from(select.options).map((option) => ({
    value: option.value,
    label: cleanLabel(option.textContent || option.label || option.value),
    readiness: readinessFromText(option.textContent || option.label || ""),
  }));
}

function brandKey(label: string) {
  const value = label.toLocaleLowerCase();
  if (value.includes("runway")) return "runway";
  if (value.includes("seedance")) return "seedance";
  if (value.includes("gemini")) return "gemini";
  if (value.includes("aleph")) return "aleph";
  if (value.includes("ruby")) return "ruby";
  if (value.includes("kling")) return "kling";
  if (value.includes("veo")) return "veo";
  if (value.includes("wan")) return "wan";
  return "ai";
}

function BrandIcon({ label, large = false }: { label: string; large?: boolean }) {
  const brand = brandKey(label);
  const sizeClass = large ? " is-large" : "";

  if (brand === "runway") {
    return <span className={`sc-brand-icon sc-brand-runway${sizeClass}`} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M7 6h8.2c5 0 8.2 2.5 8.2 6.8 0 3.1-1.7 5.2-4.4 6.2L25 26h-6l-5.1-6.2H12V26H7V6Zm5 4.2v5.5h3.1c2.1 0 3.3-.9 3.3-2.8 0-1.8-1.2-2.7-3.3-2.7H12Z" fill="currentColor"/><path d="M3.5 7.5 8 3l2.4 2.4L5.9 9.9 3.5 7.5Z" fill="currentColor" opacity=".72"/></svg></span>;
  }
  if (brand === "seedance") {
    return <span className={`sc-brand-icon sc-brand-seedance${sizeClass}`} aria-hidden="true"><svg viewBox="0 0 32 32"><defs><linearGradient id="sdg" x1="5" y1="4" x2="28" y2="28"><stop stopColor="#70f0ff"/><stop offset="1" stopColor="#4875ff"/></linearGradient></defs><circle cx="16" cy="16" r="14" fill="url(#sdg)"/><path d="M8.2 12.1 22.6 7l-5.1 6.1h6.3L9.1 25l5-7H8.2l5-5.9h-5Z" fill="white"/></svg></span>;
  }
  if (brand === "gemini") {
    return <span className={`sc-brand-icon sc-brand-gemini${sizeClass}`} aria-hidden="true"><svg viewBox="0 0 32 32"><defs><linearGradient id="gmg" x1="5" y1="27" x2="27" y2="5"><stop stopColor="#4c6fff"/><stop offset=".48" stopColor="#a56cff"/><stop offset="1" stopColor="#55d8ff"/></linearGradient></defs><path d="M16 3c1.7 7.2 5.8 11.3 13 13-7.2 1.7-11.3 5.8-13 13-1.7-7.2-5.8-11.3-13-13C10.2 14.3 14.3 10.2 16 3Z" fill="url(#gmg)"/></svg></span>;
  }
  if (brand === "aleph") {
    return <span className={`sc-brand-icon sc-brand-aleph${sizeClass}`} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m8 25 7.2-18h4.6L27 25h-5.2l-1.4-4H13l-1.5 4H8Zm6.5-8h4.4l-2.2-6.1L14.5 17Z" fill="currentColor"/><path d="M5 8h6v4H5z" fill="currentColor" opacity=".65"/></svg></span>;
  }
  if (brand === "ruby") {
    return <span className={`sc-brand-icon sc-brand-ruby${sizeClass}`} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m16 29-12-14L9 6h14l5 9-12 14Z" fill="#ef476f"/><path d="M4 15h24M9 6l7 23M23 6l-7 23M9 6l7 9 7-9" stroke="#ff9bb1" strokeWidth="1.2" fill="none"/></svg></span>;
  }
  if (brand === "kling") {
    return <span className={`sc-brand-icon sc-brand-kling${sizeClass}`} aria-hidden="true"><svg viewBox="0 0 32 32"><defs><linearGradient id="klg" x1="4" y1="5" x2="29" y2="27"><stop stopColor="#59f3c4"/><stop offset=".5" stopColor="#2d9cff"/><stop offset="1" stopColor="#845bff"/></linearGradient></defs><path d="M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm0 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z" fill="url(#klg)"/><path d="M9 8.5 23.5 23" stroke="#071018" strokeWidth="4.2" strokeLinecap="round"/></svg></span>;
  }
  if (brand === "veo") {
    return <span className={`sc-brand-icon sc-brand-veo${sizeClass}`} aria-hidden="true"><svg viewBox="0 0 32 32"><rect x="5" y="7" width="22" height="18" rx="5" fill="#fff"/><path d="M5 12a5 5 0 0 1 5-5h6v9H5v-4Z" fill="#4285f4"/><path d="M16 7h6a5 5 0 0 1 5 5v4H16V7Z" fill="#34a853"/><path d="M5 16h11v9h-6a5 5 0 0 1-5-5v-4Z" fill="#fbbc05"/><path d="M16 16h11v4a5 5 0 0 1-5 5h-6v-9Z" fill="#ea4335"/><path d="m13.5 12 7 4-7 4v-8Z" fill="white"/></svg></span>;
  }
  if (brand === "wan") {
    return <span className={`sc-brand-icon sc-brand-wan${sizeClass}`} aria-hidden="true"><svg viewBox="0 0 32 32"><defs><linearGradient id="wng" x1="4" y1="4" x2="28" y2="28"><stop stopColor="#c79bff"/><stop offset="1" stopColor="#6e4dff"/></linearGradient></defs><path d="M16 3 22 6l5 5v10l-5 5-6 3-6-3-5-5V11l5-5 6-3Z" fill="url(#wng)"/><path d="m9 11 3.5 11L16 14l3.5 8L23 11" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg></span>;
  }
  return <span className={`sc-brand-icon sc-brand-ai${sizeClass}`} aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 4 27 10v12l-11 6L5 22V10l11-6Z" fill="currentColor" opacity=".22"/><path d="M16 8 23 12v8l-7 4-7-4v-8l7-4Z" stroke="currentColor" strokeWidth="2" fill="none"/></svg></span>;
}

function StatusDot({ readiness }: { readiness: Readiness }) {
  return <span className={`sc-ai-status-dot is-${readiness}`} aria-hidden="true" />;
}

function StatusPill({ readiness, compact: compactMode = false }: { readiness: Readiness; compact?: boolean }) {
  const copy = readiness === "ready" ? "พร้อมใช้งาน" : readiness === "tool" ? "พร้อมใช้งาน" : readiness === "setup" ? "ต้องตั้งค่า" : readiness === "offline" ? "ไม่พร้อม" : "กำลังตรวจ";
  return <span className={`sc-ai-status-pill is-${readiness}${compactMode ? " is-compact" : ""}`}>{readiness === "ready" || readiness === "tool" ? "✓ " : ""}{copy}</span>;
}

function AiSelect({
  select,
  label,
  kind,
  brandLabel,
}: {
  select: HTMLSelectElement;
  label: string;
  kind: "model" | "version";
  brandLabel?: string;
}) {
  const [value, setValue] = useState(select.value);
  const [options, setOptions] = useState<PickerOption[]>(() => readOptions(select));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => {
      setValue(select.value);
      setOptions(readOptions(select));
    };
    sync();
    select.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(select, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => {
      select.removeEventListener("change", sync);
      observer.disconnect();
    };
  }, [select]);

  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open]);

  const selected = options.find((option) => option.value === value) || options[0];
  const iconLabel = kind === "version" ? (brandLabel || selected?.label || "AI") : (selected?.label || "AI");

  return (
    <div className={`sc-ai-select sc-ai-select-${kind}`} ref={rootRef} data-sc-help-ignore>
      <span className="sc-ai-picker-label">{label}</span>
      <button
        type="button"
        className={`sc-ai-select-trigger${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <BrandIcon label={iconLabel} large />
        <StatusDot readiness={selected?.readiness || "checking"} />
        <span className="sc-ai-select-copy">
          <strong>{selected?.label || "เลือกรุ่น"}</strong>
          {kind === "version" ? <small>รุ่น API ที่ใช้สร้างจริง</small> : <small>AI Video Model</small>}
        </span>
        <span className="sc-ai-select-chevron" aria-hidden="true">⌄</span>
      </button>

      {open ? (
        <div className="sc-ai-select-menu" role="listbox" aria-label={label}>
          <div className="sc-ai-menu-head">
            <span>{kind === "model" ? "เลือกโมเดล AI" : "เลือกรุ่น / Version"}</span>
            <small>{options.length} ตัวเลือก</small>
          </div>
          <div className="sc-ai-menu-list">
            {options.map((option) => {
              const active = option.value === value;
              const rowIconLabel = kind === "version" ? (brandLabel || option.label) : option.label;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`sc-ai-select-option${active ? " is-active" : ""}`}
                  key={option.value}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setNativeSelectValue(select, option.value);
                    setOpen(false);
                  }}
                >
                  <StatusDot readiness={option.readiness} />
                  <BrandIcon label={rowIconLabel} />
                  <span className="sc-ai-option-copy">
                    <strong>{option.label}</strong>
                    <small>{kind === "version" ? option.value : brandKey(option.label) === "runway" ? "Runway" : brandKey(option.label) === "veo" ? "Google" : "AI Video"}</small>
                  </span>
                  <StatusPill readiness={option.readiness} compact />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LockedVersion({ modelLabel }: { modelLabel: string }) {
  return (
    <div className="sc-ai-select sc-ai-select-version" data-sc-help-ignore>
      <span className="sc-ai-picker-label">รุ่น / Version</span>
      <div className="sc-ai-select-trigger is-locked">
        <BrandIcon label={modelLabel} large />
        <StatusDot readiness="ready" />
        <span className="sc-ai-select-copy"><strong>{modelLabel}</strong><small>รุ่นถูกกำหนดโดยโมเดลที่เลือก</small></span>
        <span className="sc-ai-lock" aria-hidden="true">●</span>
      </div>
    </div>
  );
}

function ModelPickerPanel({
  modelSelect,
  versionSelect,
}: {
  modelSelect: HTMLSelectElement;
  versionSelect: HTMLSelectElement | null;
}) {
  const [modelLabel, setModelLabel] = useState(() => cleanLabel(modelSelect.selectedOptions[0]?.textContent || "AI"));

  useEffect(() => {
    const sync = () => setModelLabel(cleanLabel(modelSelect.selectedOptions[0]?.textContent || "AI"));
    sync();
    modelSelect.addEventListener("change", sync);
    return () => modelSelect.removeEventListener("change", sync);
  }, [modelSelect]);

  return (
    <div className="sc-ai-model-picker-shell">
      <AiSelect select={modelSelect} label="โมเดล AI" kind="model" />
      {versionSelect ? <AiSelect select={versionSelect} label="รุ่น / Version" kind="version" brandLabel={modelLabel} /> : <LockedVersion modelLabel={modelLabel} />}
    </div>
  );
}

export default function StudioModelPickerPolish() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [modelSelect, setModelSelect] = useState<HTMLSelectElement | null>(null);
  const [versionSelect, setVersionSelect] = useState<HTMLSelectElement | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let fieldObserver: MutationObserver | null = null;
    let hiddenGrid: HTMLElement | null = null;
    let currentHost: HTMLElement | null = null;
    let currentField: HTMLElement | null = null;

    const discover = () => {
      if (stopped) return;
      const setup = document.getElementById("setup");
      if (!setup) {
        timer = window.setTimeout(discover, 80);
        return;
      }

      const field = findFieldByLabels(setup, ["โมเดลวิดีโอ", "Video Model"]);
      const nextModelSelect = field?.querySelector<HTMLSelectElement>('select[aria-label="โมเดลวิดีโอ"]') || null;
      if (!field || !nextModelSelect) {
        timer = window.setTimeout(discover, 80);
        return;
      }

      const sync = () => {
        const nextVersionSelect = field.querySelector<HTMLSelectElement>('select[aria-label="รุ่นโมเดล"]') || null;
        const grid = nextModelSelect.parentElement as HTMLElement | null;
        if (!grid) return;

        if (!currentHost || !currentHost.isConnected) {
          currentHost = document.createElement("div");
          currentHost.className = "sc-ai-model-picker-host";
          grid.parentElement?.insertBefore(currentHost, grid);
        }

        if (hiddenGrid && hiddenGrid !== grid && hiddenGrid.style.display) hiddenGrid.style.display = "";
        hiddenGrid = grid;
        if (hiddenGrid.style.display !== "none") hiddenGrid.style.display = "none";
        if (!field.classList.contains("sc-ai-model-field")) field.classList.add("sc-ai-model-field");

        const capabilityRow = grid.nextElementSibling as HTMLElement | null;
        if (capabilityRow?.tagName === "DIV" && capabilityRow.dataset.scModelCapabilities !== "true") {
          capabilityRow.dataset.scModelCapabilities = "true";
        }

        setHost(currentHost);
        setModelSelect(nextModelSelect);
        setVersionSelect(nextVersionSelect);
      };

      currentField = field;
      sync();
      fieldObserver?.disconnect();
      fieldObserver = new MutationObserver(() => window.requestAnimationFrame(sync));
      fieldObserver.observe(field, { childList: true, subtree: true, attributes: true });
    };

    discover();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      fieldObserver?.disconnect();
      if (hiddenGrid) hiddenGrid.style.display = "";
      if (currentField) {
        currentField.classList.remove("sc-ai-model-field");
        currentField.querySelector<HTMLElement>("[data-sc-model-capabilities]")?.removeAttribute("data-sc-model-capabilities");
      }
      currentHost?.remove();
    };
  }, []);

  const styles = useMemo(() => `
    .sc-ai-model-picker-host{width:100%;position:relative;z-index:45}
    .sc-ai-model-picker-shell{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;width:100%}
    .sc-ai-select{position:relative;min-width:0}
    .sc-ai-picker-label{display:block;margin:0 0 6px;color:var(--text);font-size:11px;font-weight:850;letter-spacing:.01em}
    .sc-ai-select-trigger{width:100%;min-height:58px;display:flex;align-items:center;gap:9px;padding:8px 12px;border:1px solid color-mix(in srgb,var(--accent) 34%,var(--borderStrong));border-radius:13px;background:linear-gradient(145deg,color-mix(in srgb,var(--surface3) 92%,var(--accent) 8%),var(--input));color:var(--text);text-align:left;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 8px 24px rgba(0,0,0,.10);transition:border-color .16s ease,box-shadow .16s ease,transform .16s ease}
    .sc-ai-select-trigger:hover{border-color:color-mix(in srgb,var(--accent) 62%,var(--borderStrong));box-shadow:0 10px 28px color-mix(in srgb,var(--accent) 9%,transparent)}
    .sc-ai-select-trigger.is-open{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent),0 14px 36px rgba(0,0,0,.18)}
    .sc-ai-select-trigger.is-locked{cursor:default;opacity:.88}
    .sc-ai-select-copy{min-width:0;flex:1}.sc-ai-select-copy strong,.sc-ai-select-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sc-ai-select-copy strong{font-size:14px;line-height:1.25}.sc-ai-select-copy small{margin-top:3px;color:var(--muted);font-size:9.5px}
    .sc-ai-select-chevron{color:var(--accent);font-size:23px;line-height:1;transform:translateY(-2px)}
    .sc-ai-lock{width:18px;height:18px;display:grid;place-items:center;color:var(--muted);font-size:7px;border:1px solid var(--border);border-radius:50%}
    .sc-brand-icon{width:29px;height:29px;flex:0 0 29px;display:grid;place-items:center;border-radius:9px;overflow:hidden;background:color-mix(in srgb,var(--surface3) 82%,black 18%);color:#f7f4ff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.07)}
    .sc-brand-icon.is-large{width:34px;height:34px;flex-basis:34px;border-radius:11px}.sc-brand-icon svg{width:100%;height:100%;display:block}
    .sc-brand-runway{background:#101016;color:#fff}.sc-brand-seedance{background:transparent;box-shadow:none}.sc-brand-gemini{background:#101125}.sc-brand-aleph{background:#091a4b;color:#3d79ff}.sc-brand-ruby{background:#241017}.sc-brand-kling{background:#07141a}.sc-brand-veo{background:#111217}.sc-brand-wan{background:#17102e}.sc-brand-ai{color:var(--accent)}
    .sc-ai-status-dot{width:9px;height:9px;flex:0 0 9px;border-radius:50%;box-shadow:0 0 0 4px color-mix(in srgb,currentColor 11%,transparent),0 0 14px currentColor}
    .sc-ai-status-dot.is-ready{color:#66dda0;background:#66dda0}.sc-ai-status-dot.is-tool{color:#9b74ff;background:#9b74ff}.sc-ai-status-dot.is-setup{color:#f6a15b;background:#f6a15b}.sc-ai-status-dot.is-offline{color:#ef6678;background:#ef6678}.sc-ai-status-dot.is-checking{color:#9b94a8;background:#9b94a8}
    .sc-ai-select-menu{position:absolute;z-index:700;top:calc(100% + 7px);left:0;width:max(100%,390px);max-width:min(520px,calc(100vw - 32px));overflow:hidden;border:1px solid color-mix(in srgb,var(--accent) 55%,var(--borderStrong));border-radius:15px;background:color-mix(in srgb,var(--surface) 97%,#100b1e 3%);box-shadow:0 24px 70px rgba(0,0,0,.5),0 0 0 1px color-mix(in srgb,var(--accent) 6%,transparent);backdrop-filter:blur(18px)}
    .sc-ai-select-version .sc-ai-select-menu{right:0;left:auto}
    .sc-ai-menu-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--border);background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 10%,transparent),transparent)}
    .sc-ai-menu-head span{font-size:11px;font-weight:900;color:var(--text)}.sc-ai-menu-head small{font-size:9px;color:var(--muted)}
    .sc-ai-menu-list{max-height:410px;overflow:auto;padding:6px}
    .sc-ai-select-option{width:100%;display:flex;align-items:center;gap:9px;min-height:47px;padding:7px 9px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--text);text-align:left;cursor:pointer;transition:background .14s ease,border-color .14s ease,transform .14s ease}
    .sc-ai-select-option:hover{background:color-mix(in srgb,var(--accent) 8%,var(--surface3));border-color:color-mix(in srgb,var(--accent) 17%,var(--border));transform:translateX(1px)}
    .sc-ai-select-option.is-active{background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 20%,var(--surface3)),color-mix(in srgb,var(--accent) 8%,var(--surface3)));border-color:color-mix(in srgb,var(--accent) 62%,var(--borderStrong));box-shadow:inset 3px 0 0 var(--accent)}
    .sc-ai-option-copy{min-width:0;flex:1}.sc-ai-option-copy strong,.sc-ai-option-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc-ai-option-copy strong{font-size:12.5px}.sc-ai-option-copy small{margin-top:2px;color:var(--muted);font-size:9px}
    .sc-ai-status-pill{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;border-radius:999px;border:1px solid;padding:5px 8px;font-size:9px;font-weight:850;white-space:nowrap}.sc-ai-status-pill.is-compact{padding:4px 7px}
    .sc-ai-status-pill.is-ready{color:#72dba3;border-color:rgba(87,210,145,.28);background:rgba(52,170,111,.10)}.sc-ai-status-pill.is-tool{color:#b491ff;border-color:rgba(167,112,255,.28);background:rgba(133,82,229,.11)}.sc-ai-status-pill.is-setup{color:#ffad6e;border-color:rgba(238,137,65,.28);background:rgba(209,98,36,.10)}.sc-ai-status-pill.is-offline{color:#ff8291;border-color:rgba(238,93,110,.28);background:rgba(197,55,72,.10)}.sc-ai-status-pill.is-checking{color:var(--muted);border-color:var(--border);background:var(--surface3)}
    .sc-ai-model-field [data-sc-model-capabilities]{display:flex!important;flex-wrap:wrap!important;gap:7px!important;margin-top:9px!important}
    .sc-ai-model-field [data-sc-model-capabilities]>span,.sc-ai-model-field [data-sc-model-capabilities]>a{display:inline-flex!important;align-items:center!important;min-height:31px!important;padding:5px 10px!important;border:1px solid color-mix(in srgb,var(--accent) 20%,var(--border))!important;border-radius:999px!important;background:color-mix(in srgb,var(--surface3) 92%,var(--accent) 8%)!important;color:var(--text)!important;font-size:10.5px!important;line-height:1.2!important;text-decoration:none!important}
    .sc-ai-model-field [data-sc-model-capabilities]>span:first-child{border-color:rgba(72,200,135,.26)!important;background:rgba(51,174,111,.08)!important}
    @media(max-width:820px){.sc-ai-model-picker-shell{grid-template-columns:1fr}.sc-ai-select-menu,.sc-ai-select-version .sc-ai-select-menu{left:0;right:auto;width:100%;max-width:100%}}
  `, []);

  return (
    <>
      <style>{styles}</style>
      {host && modelSelect ? createPortal(<ModelPickerPanel modelSelect={modelSelect} versionSelect={versionSelect} />, host) : null}
    </>
  );
}
