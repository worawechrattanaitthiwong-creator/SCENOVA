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

const LOCK_HELP: Record<string, { what: string; use: string }> = {
  "Character Lock": {
    what: "ล็อกอัตลักษณ์ตัวละคร เช่น ใบหน้า รูปร่าง เสื้อผ้า และจุดจำสำคัญให้คงเดิม",
    use: "ใช้เมื่อต้องการให้ตัวละครคนเดิมมีหน้าตาและรายละเอียดสม่ำเสมอเมื่อเปลี่ยนฉากหรือ Shot",
  },
  "Voice Lock": {
    what: "ล็อกเสียงและ Voice Profile ของตัวละครให้เป็นเสียงเดิม",
    use: "ใช้เพื่อคงโทนเสียง อายุ น้ำหนักเสียง และบุคลิกการพูดไม่ให้เปลี่ยนระหว่างฉาก",
  },
  "Visual Style Lock": {
    what: "ล็อกภาษาภาพและสไตล์หลักของตอน เช่น ความสมจริง สี texture และบรรยากาศ",
    use: "ใช้เพื่อให้ทุกฉากอยู่ในโลกภาพเดียวกันและไม่เปลี่ยนสไตล์กลางเรื่อง",
  },
  "Camera Language Lock": {
    what: "ล็อกแนวทางการใช้กล้องหลัก เช่น Shot มุมกล้อง และรูปแบบการเคลื่อนกล้อง",
    use: "ใช้เพื่อให้ภาษากล้องต่อเนื่องทั้งตอน โดยยังปรับรายละเอียดรายฉากได้",
  },
  "Lighting Lock": {
    what: "ล็อกทิศทาง คุณภาพ และลักษณะแสงหลักของงาน",
    use: "ใช้เพื่อลดปัญหาแสงกระโดด สีแสงเปลี่ยน หรือทิศทางเงาไม่ต่อเนื่องระหว่างฉาก",
  },
  "Location Lock": {
    what: "ล็อกรูปลักษณ์ของสถานที่เดิม เช่น โครงสร้าง ฉากหลัง และตำแหน่งวัตถุสำคัญ",
    use: "ใช้เมื่อมีการกลับมาใช้สถานที่เดิมหลายครั้งและต้องการให้ฉากยังเป็นสถานที่เดียวกัน",
  },
  "Props Lock": {
    what: "ล็อกพร็อพหรือวัตถุสำคัญ เช่น รูปร่าง สี รายละเอียด และเจ้าของของวัตถุ",
    use: "ใช้เพื่อไม่ให้พร็อพเปลี่ยนรูป หายไป หรือสลับรายละเอียดเองระหว่าง Shot",
  },
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

function closeLockPopover() {
  document.querySelector<HTMLElement>(".sc-lock-popover")?.remove();
  document.querySelector<HTMLElement>(".sc-lock-help.is-help-target")?.classList.remove("is-help-target");
}

function showLockPopover(title: string, anchor: HTMLElement) {
  const copy = LOCK_HELP[title];
  if (!copy) return;

  closeLockPopover();

  const card = anchor.closest<HTMLElement>(".sc-lock-help");
  card?.classList.add("is-help-target");

  const popover = document.createElement("section");
  popover.className = "sc-lock-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", `คำอธิบาย ${title}`);

  const head = document.createElement("div");
  head.className = "sc-lock-popover__head";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "sc-lock-popover__close";
  close.textContent = "×";
  close.setAttribute("aria-label", "ปิดคำอธิบาย");
  close.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeLockPopover();
  });
  head.append(heading, close);

  const what = document.createElement("p");
  const whatLabel = document.createElement("b");
  whatLabel.textContent = "คืออะไร";
  what.append(whatLabel, document.createTextNode(` — ${copy.what}`));

  const use = document.createElement("p");
  use.className = "sc-lock-popover__use";
  const useLabel = document.createElement("b");
  useLabel.textContent = "ใช้ทำอะไร";
  use.append(useLabel, document.createTextNode(` — ${copy.use}`));

  popover.append(head, what, use);
  document.body.appendChild(popover);

  const targetRect = (card || anchor).getBoundingClientRect();
  const width = Math.min(330, Math.max(260, window.innerWidth - 24));
  popover.style.width = `${width}px`;

  const measured = popover.getBoundingClientRect();
  let left = targetRect.left;
  left = Math.max(12, Math.min(left, window.innerWidth - measured.width - 12));

  let top = targetRect.top - measured.height - 12;
  let placement = "top";
  if (top < 12) {
    top = targetRect.bottom + 12;
    placement = "bottom";
  }

  popover.dataset.placement = placement;
  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;

  const dismiss = (event: PointerEvent) => {
    const target = event.target as Node;
    if (popover.contains(target) || anchor.contains(target)) return;
    closeLockPopover();
    document.removeEventListener("pointerdown", dismiss, true);
  };
  requestAnimationFrame(() => document.addEventListener("pointerdown", dismiss, true));
}

function enhanceLockCards(main: HTMLElement) {
  const lockGrid = main.querySelector<HTMLElement>('[class*="single-episode-studio_lockGrid"]');
  if (!lockGrid) return;

  Array.from(lockGrid.querySelectorAll<HTMLLabelElement>(":scope > label")).forEach((card, index) => {
    const title = card.querySelector<HTMLElement>("b")?.textContent?.trim();
    const detail = card.querySelector<HTMLElement>("small");
    if (!title || !detail) return;

    card.classList.add("sc-lock-help");
    detail.setAttribute("aria-hidden", "true");
    if (!detail.id) detail.id = `sc-lock-help-${index}`;

    let button = card.querySelector<HTMLButtonElement>(":scope > .sc-lock-help__toggle");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "sc-lock-help__toggle";
      button.textContent = "?";
      button.title = `คำอธิบาย ${title}`;
      button.setAttribute("aria-label", `ดูคำอธิบาย ${title}`);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        showLockPopover(title, button as HTMLButtonElement);
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
        closeLockPopover();
        return;
      }

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
    window.addEventListener("resize", closeLockPopover);
    window.addEventListener("scroll", closeLockPopover, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", locate);
      window.removeEventListener("resize", closeLockPopover);
      window.removeEventListener("scroll", closeLockPopover, true);
      closeLockPopover();
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
        min-height: 54px !important;
        padding-right: 46px !important;
        transition: border-color .18s ease, background .18s ease, box-shadow .18s ease;
      }
      .sc-lock-help > span { min-width: 0; }
      .sc-lock-help > span > b { display: block; line-height: 1.25; }
      .sc-lock-help > span > small { display: none !important; }
      .sc-lock-help.is-help-target {
        border-color: rgba(160, 91, 225, .62) !important;
        box-shadow: 0 0 0 2px rgba(151, 82, 218, .08) !important;
      }
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
      .sc-lock-popover {
        position: fixed;
        z-index: 10000;
        padding: 14px;
        border: 1px solid rgba(176, 108, 236, .36);
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(30, 20, 40, .98), rgba(17, 12, 24, .98));
        color: #f7f1fb;
        box-shadow: 0 18px 48px rgba(0, 0, 0, .32), 0 0 0 1px rgba(191, 125, 247, .06) inset;
        backdrop-filter: blur(18px);
        animation: scLockPopoverIn .14s ease-out;
      }
      .sc-lock-popover::after {
        content: "";
        position: absolute;
        left: 28px;
        width: 12px;
        height: 12px;
        background: inherit;
        border: inherit;
        transform: rotate(45deg);
      }
      .sc-lock-popover[data-placement="top"]::after {
        bottom: -7px;
        border-left: 0;
        border-top: 0;
      }
      .sc-lock-popover[data-placement="bottom"]::after {
        top: -7px;
        border-right: 0;
        border-bottom: 0;
      }
      .sc-lock-popover__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 9px;
      }
      .sc-lock-popover__head > strong { font-size: 14px; line-height: 1.25; }
      .sc-lock-popover__close {
        width: 26px;
        height: 26px;
        flex: 0 0 26px;
        display: grid;
        place-items: center;
        border: 0;
        border-radius: 8px;
        background: rgba(255, 255, 255, .07);
        color: inherit;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }
      .sc-lock-popover p {
        margin: 0;
        font-size: 12px;
        line-height: 1.58;
        color: rgba(247, 241, 251, .82);
      }
      .sc-lock-popover p b { color: #d4a0ff; }
      .sc-lock-popover__use {
        margin-top: 9px !important;
        padding-top: 9px;
        border-top: 1px solid rgba(195, 132, 245, .16);
      }
      html[data-theme="light"] .sc-lock-help.is-help-target {
        border-color: #c89ce9 !important;
        background: #faf6fe !important;
        box-shadow: 0 0 0 2px rgba(126, 65, 171, .07) !important;
      }
      html[data-theme="light"] .sc-lock-help__toggle {
        border-color: #d8c1ec;
        background: #f4eafb;
        color: #7334ad;
      }
      html[data-theme="light"] .sc-lock-popover {
        border-color: #d3b5eb;
        background: linear-gradient(180deg, rgba(255,255,255,.99), rgba(249,244,253,.99));
        color: #261b2e;
        box-shadow: 0 18px 44px rgba(78, 45, 102, .18), 0 0 0 1px rgba(123, 72, 161, .04) inset;
      }
      html[data-theme="light"] .sc-lock-popover__close { background: #f1e7f8; color: #634174; }
      html[data-theme="light"] .sc-lock-popover p { color: #66576e; }
      html[data-theme="light"] .sc-lock-popover p b { color: #723a9d; }
      html[data-theme="light"] .sc-lock-popover__use { border-top-color: #e8daf1; }
      @keyframes scLockPopoverIn {
        from { opacity: 0; transform: translateY(4px) scale(.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @media (max-width: 720px) {
        .sc-lock-help { min-height: 50px !important; }
        .sc-lock-popover { max-width: calc(100vw - 24px); }
      }
    `}</style>
    {portals}
  </>;
}
