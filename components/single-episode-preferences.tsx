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

const LOCK_HELP: Record<string, string> = {
  "Character Lock": "คืออะไร: ล็อกอัตลักษณ์ตัวละคร เช่น ใบหน้า รูปร่าง เสื้อผ้า และจุดจำสำคัญ • ใช้ทำอะไร: ช่วยให้ตัวละครเดิมคงรูปลักษณ์สม่ำเสมอเมื่อเปลี่ยนฉากหรือ Shot",
  "Voice Lock": "คืออะไร: ล็อกเสียงและ Voice Profile ของตัวละคร • ใช้ทำอะไร: ช่วยให้โทนเสียง อายุ น้ำหนักเสียง และบุคลิกการพูดไม่เปลี่ยนระหว่างฉาก",
  "Visual Style Lock": "คืออะไร: ล็อกภาษาภาพและสไตล์หลักของตอน • ใช้ทำอะไร: ช่วยให้สี ความสมจริง texture และบรรยากาศภาพไปในทิศทางเดียวกันทุกฉาก",
  "Camera Language Lock": "คืออะไร: ล็อกแนวทางการใช้กล้องหลักของตอน • ใช้ทำอะไร: ช่วยให้ Shot, มุมกล้อง และการเคลื่อนกล้องมีภาษาภาพต่อเนื่อง โดยยังปรับรายละเอียดรายฉากได้",
  "Lighting Lock": "คืออะไร: ล็อกทิศทางและคุณภาพแสงหลัก • ใช้ทำอะไร: ช่วยลดปัญหาแสงกระโดด สีแสงเปลี่ยน หรือทิศทางเงาไม่ต่อเนื่องระหว่างฉาก",
  "Location Lock": "คืออะไร: ล็อกรูปลักษณ์ของสถานที่เดิม • ใช้ทำอะไร: ช่วยรักษาโครงสร้าง ฉากหลัง วัตถุ และตำแหน่งสำคัญเมื่อกลับมาใช้สถานที่เดิมอีกครั้ง",
  "Props Lock": "คืออะไร: ล็อกพร็อพหรือวัตถุสำคัญของเรื่อง • ใช้ทำอะไร: ช่วยรักษารูปร่าง สี ตำแหน่ง และเจ้าของของวัตถุไม่ให้เปลี่ยนเองระหว่าง Shot",
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

function enhanceLockCards(main: HTMLElement) {
  const lockGrid = main.querySelector<HTMLElement>('[class*="single-episode-studio_lockGrid"]');
  if (!lockGrid) return;

  Array.from(lockGrid.querySelectorAll<HTMLLabelElement>(":scope > label")).forEach((card, index) => {
    const title = card.querySelector<HTMLElement>("b")?.textContent?.trim();
    const detail = card.querySelector<HTMLElement>("small");
    if (!title || !detail) return;

    card.classList.add("sc-lock-help");
    const copy = LOCK_HELP[title];
    if (copy && detail.textContent !== copy) detail.textContent = copy;
    detail.setAttribute("role", "note");
    if (!detail.id) detail.id = `sc-lock-help-${index}`;

    let button = card.querySelector<HTMLButtonElement>(":scope > .sc-lock-help__toggle");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "sc-lock-help__toggle";
      button.textContent = "?";
      button.title = `คำอธิบาย ${title}`;
      button.setAttribute("aria-label", `ดูคำอธิบาย ${title}`);
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", detail.id);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const isOpen = card.classList.toggle("is-help-open");
        button?.setAttribute("aria-expanded", String(isOpen));
        if (button) button.textContent = isOpen ? "×" : "?";
      });
      card.appendChild(button);
    }
  });
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
      enhanceLockCards(main);

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

  return <>
    <style>{`
      .sc-lock-help {
        position: relative !important;
        align-items: flex-start !important;
        min-height: 54px !important;
        padding-right: 46px !important;
        transition: border-color .18s ease, background .18s ease, box-shadow .18s ease;
      }
      .sc-lock-help > span { min-width: 0; }
      .sc-lock-help > span > b { display: block; line-height: 1.25; }
      .sc-lock-help > span > small {
        display: none !important;
        margin-top: 7px !important;
        padding-top: 7px !important;
        border-top: 1px solid rgba(171, 109, 230, .18);
        font-size: 11px !important;
        font-weight: 500 !important;
        line-height: 1.55 !important;
        opacity: .8 !important;
      }
      .sc-lock-help.is-help-open {
        min-height: 92px !important;
        border-color: rgba(154, 87, 226, .48) !important;
        background: rgba(144, 77, 211, .1) !important;
      }
      .sc-lock-help.is-help-open > span > small { display: block !important; }
      .sc-lock-help__toggle {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 28px;
        height: 28px;
        display: inline-grid;
        place-items: center;
        padding: 0;
        border: 1px solid rgba(171, 109, 230, .28);
        border-radius: 9px;
        background: rgba(145, 79, 207, .1);
        color: #bd78ff;
        font: 800 13px/1 system-ui, sans-serif;
        cursor: pointer;
      }
      .sc-lock-help__toggle:hover,
      .sc-lock-help__toggle:focus-visible {
        border-color: rgba(183, 112, 246, .7);
        background: rgba(151, 82, 218, .2);
        outline: none;
        box-shadow: 0 0 0 3px rgba(151, 82, 218, .12);
      }
      html[data-theme="light"] .sc-lock-help.is-help-open {
        border-color: #cda9ef !important;
        background: linear-gradient(180deg, #fbf7ff, #f5edfc) !important;
        box-shadow: 0 7px 20px rgba(105, 61, 139, .07);
      }
      html[data-theme="light"] .sc-lock-help > span > small {
        border-top-color: #e4d6f0;
        color: #62566a;
        opacity: 1 !important;
      }
      html[data-theme="light"] .sc-lock-help__toggle {
        border-color: #d8c1ec;
        background: #f4eafb;
        color: #7334ad;
      }
      @media (max-width: 720px) {
        .sc-lock-help { min-height: 50px !important; }
        .sc-lock-help.is-help-open { min-height: 100px !important; }
      }
    `}</style>
    {portals}
  </>;
}
