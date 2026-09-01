"use client";

import { useEffect } from "react";

const OPTION_COPY = {
  advancedSetup: "ปรับ Locks / Negative Prompt เอง",
  blocking: "ปรับ Blocking รายคนเอง",
  camera: "ปรับกล้องและเลนส์เอง",
  look: "ปรับแสง สี และ Performance เอง",
  sound: "ปรับ Ambience / SFX / Music เอง",
  continuity: "ปรับ Continuity / ข้อห้ามเอง",
  review: "เปิดหน้าตรวจความพร้อมเอง",
} as const;

type OptionKey = keyof typeof OPTION_COPY;

function setText(element: Element | null, value: string) {
  if (element && element.textContent !== value) element.textContent = value;
}

function normalizeStudioAutoUi() {
  const main = document.querySelector<HTMLElement>('main[class*="single-episode-studio_main"]');
  if (!main) return;

  // This page uses its own compact controls; do not add generic info/help icons on top of them.
  main.dataset.scHelpIgnore = "true";

  (Object.keys(OPTION_COPY) as OptionKey[]).forEach((key) => {
    const host = main.querySelector<HTMLElement>(`[data-se-option-host="${key}"]`);
    if (!host) return;

    const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const label = host.querySelector<HTMLElement>(".sc-se-options__items label > span");
    const subtitle = host.querySelector<HTMLElement>(".sc-se-options__title > span");
    const status = host.querySelector<HTMLElement>(".sc-se-options__items > span:last-child");
    const manual = Boolean(checkbox?.checked);

    setText(label, OPTION_COPY[key]);
    setText(subtitle, "ไม่ติ๊ก = AI Auto");
    setText(status, manual ? "กำหนดเอง" : "AI จัดให้อัตโนมัติตามเนื้อเรื่อง");

    host.dataset.aiAuto = String(!manual);
    if (status) status.dataset.aiAutoStatus = "true";
  });
}

export default function SingleEpisodeAiAuto() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(normalizeStudioAutoUi);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("change", schedule, true);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("change", schedule, true);
    };
  }, []);

  return <style>{`
    [class*="single-episode-studio_main"] .sc-system-info-trigger,
    [class*="single-episode-studio_main"] .sc-lock-help__toggle {
      display: none !important;
    }
    [class*="single-episode-studio_main"] .sc-lock-help {
      padding-right: 10px !important;
    }
    [class*="single-episode-studio_main"] .sc-se-options__title > span {
      color: var(--muted, #a99db8);
      opacity: .9 !important;
    }
    [class*="single-episode-studio_main"] [data-ai-auto-status="true"] {
      color: var(--muted, #a99db8);
      opacity: .86 !important;
      white-space: normal !important;
      line-height: 1.35;
    }
    [class*="single-episode-studio_main"] [data-ai-auto="true"] [data-ai-auto-status="true"] {
      color: #b993e5;
    }
    html[data-theme="light"] [class*="single-episode-studio_main"] [data-ai-auto="true"] [data-ai-auto-status="true"] {
      color: #75469c;
    }
  `}</style>;
}
