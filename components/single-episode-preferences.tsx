"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type OptionKey = "advancedSetup" | "blocking" | "camera" | "look" | "sound" | "continuity" | "review";
type Options = Record<OptionKey, boolean>;
type Hosts = Partial<Record<OptionKey, HTMLElement>>;

const STORAGE_KEY = "scenova-single-episode-options-v1";
const DEFAULTS: Options = {
  advancedSetup: false,
  blocking: false,
  camera: false,
  look: false,
  sound: false,
  continuity: false,
  review: false,
};

const META: Record<OptionKey, { stage: string; label: string }> = {
  advancedSetup: { stage: "ตั้งค่าตอน", label: "ใช้ Locks / Negative Prompt" },
  blocking: { stage: "ตัวละครในฉาก", label: "กำหนด Blocking รายคน" },
  camera: { stage: "กำกับภาพ", label: "ใช้กล้องและเลนส์ขั้นสูง" },
  look: { stage: "ภาพและการแสดง", label: "กำหนดแสง สี และ Performance" },
  sound: { stage: "เสียง", label: "ใช้ Ambience / SFX / Music" },
  continuity: { stage: "ความต่อเนื่อง", label: "ใช้ Continuity / ข้อห้ามเฉพาะฉาก" },
  review: { stage: "ก่อน Render", label: "เปิดตรวจความพร้อมก่อนสร้าง" },
};

function readOptions(): Options {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Options>) };
  } catch {
    return DEFAULTS;
  }
}

function findMain() {
  return document.querySelector<HTMLElement>('main[class*="single-episode-studio_main"]');
}

function applyOptions(main: HTMLElement, options: Options) {
  main.dataset.seAdvancedSetup = String(options.advancedSetup);
  main.dataset.seBlocking = String(options.blocking);
  main.dataset.seCamera = String(options.camera);
  main.dataset.seLook = String(options.look);
  main.dataset.seSound = String(options.sound);
  main.dataset.seContinuity = String(options.continuity);
  main.dataset.seReview = String(options.review);
}

function ensureHostBefore(anchor: HTMLElement | null, key: OptionKey): HTMLElement | null {
  const parent = anchor?.parentElement;
  if (!anchor || !parent) return null;

  let host = parent.querySelector<HTMLElement>(`:scope > [data-se-option-host="${key}"]`);
  if (!host) {
    host = document.createElement("div");
    host.dataset.seOptionHost = key;
    host.style.margin = "6px 0";
    parent.insertBefore(host, anchor);
  }
  return host;
}

function sameHosts(a: Hosts, b: Hosts) {
  const keys = Object.keys(META) as OptionKey[];
  return keys.every((key) => a[key] === b[key]);
}

function InlineToggle({ optionKey, checked, onChange }: { optionKey: OptionKey; checked: boolean; onChange: (checked: boolean) => void }) {
  const meta = META[optionKey];
  return (
    <div
      className="sc-se-options"
      aria-label={`${meta.stage}: ${meta.label}`}
      style={{ minHeight: 36, padding: "5px 8px", margin: 0, gap: 8, borderRadius: 9 }}
    >
      <div className="sc-se-options__title" style={{ minWidth: 106, paddingRight: 8 }}>
        <strong style={{ fontSize: 11 }}>{meta.stage}</strong>
        <span style={{ fontSize: 9 }}>ส่วนเสริม</span>
      </div>
      <div className="sc-se-options__items" style={{ flex: 1 }}>
        <label className={checked ? "is-on" : ""} style={{ minHeight: 27, padding: "4px 8px", fontSize: 10 }}>
          <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
          <span>{meta.label}</span>
        </label>
        <span style={{ fontSize: 9, opacity: 0.58, whiteSpace: "nowrap" }}>{checked ? "เปิดใช้งาน" : "ไม่ใช้ — ซ่อนส่วนนี้"}</span>
      </div>
    </div>
  );
}

export default function SingleEpisodePreferences() {
  const [options, setOptions] = useState<Options>(DEFAULTS);
  const [hosts, setHosts] = useState<Hosts>({});

  useEffect(() => {
    setOptions(readOptions());

    const locate = () => {
      const main = findMain();
      if (!main) {
        setHosts((current) => Object.keys(current).length ? {} : current);
        return;
      }

      // Remove the old all-in-one options bar from the previous layout, if it still exists in the DOM.
      main.querySelectorAll<HTMLElement>(":scope > [data-single-episode-options-host]").forEach((node) => node.remove());

      const next: Hosts = {};
      const setup = main.querySelector<HTMLElement>("#setup");
      const lockGrid = setup?.querySelector<HTMLElement>('[class*="single-episode-studio_lockGrid"]') || null;
      next.advancedSetup = ensureHostBefore(lockGrid, "advancedSetup") || undefined;

      const sceneEditor = main.querySelector<HTMLElement>('[class*="single-episode-studio_sceneEditor"]');
      const blocks = sceneEditor
        ? Array.from(sceneEditor.querySelectorAll<HTMLElement>('section[class*="single-episode-studio_directorBlock"]'))
        : [];
      next.blocking = ensureHostBefore(blocks[0] || null, "blocking") || undefined;
      next.camera = ensureHostBefore(blocks[2] || null, "camera") || undefined;
      next.look = ensureHostBefore(blocks[3] || null, "look") || undefined;
      next.sound = ensureHostBefore(blocks[4] || null, "sound") || undefined;
      next.continuity = ensureHostBefore(blocks[5] || null, "continuity") || undefined;

      const review = main.querySelector<HTMLElement>('[class*="single-episode-studio_reviewPanel"]');
      next.review = ensureHostBefore(review, "review") || undefined;

      setHosts((current) => sameHosts(current, next) ? current : next);
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", locate);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", locate);
    };
  }, []);

  useEffect(() => {
    const main = findMain();
    if (!main) return;
    applyOptions(main, options);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  }, [options, hosts]);

  const portals = (Object.keys(META) as OptionKey[])
    .map((key) => {
      const host = hosts[key];
      if (!host) return null;
      return createPortal(
        <InlineToggle
          optionKey={key}
          checked={options[key]}
          onChange={(checked) => setOptions((current) => ({ ...current, [key]: checked }))}
        />,
        host,
        key,
      );
    })
    .filter(Boolean);

  return <>{portals}</>;
}
