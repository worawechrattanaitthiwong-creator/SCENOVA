"use client";

import { useEffect } from "react";

function compact(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function coverageRoot() {
  return document.getElementById("direct-render");
}

function presetButtons(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>('[class*="presetGrid"]');
  return grid ? Array.from(grid.querySelectorAll<HTMLButtonElement>(":scope > button")) : [];
}

function markUnselected(root: HTMLElement) {
  root.dataset.scCoverageChosen = "false";
  const selected = root.querySelector<HTMLElement>('[class*="selectedCoverage"]');
  if (selected) selected.dataset.scCoverageWaiting = "true";
}

function markSelected(root: HTMLElement) {
  root.dataset.scCoverageChosen = "true";
  const selected = root.querySelector<HTMLElement>('[class*="selectedCoverage"]');
  if (selected) selected.dataset.scCoverageWaiting = "false";
}

export default function StudioCoverageEmptyDefault() {
  useEffect(() => {
    let stopped = false;
    const normalize = () => {
      if (stopped) return;
      const root = coverageRoot();
      if (!root || root.dataset.scCoverageInitialized === "true") return;
      root.dataset.scCoverageInitialized = "true";
      markUnselected(root);
    };

    const observer = new MutationObserver(normalize);
    observer.observe(document.body, { childList: true, subtree: true });
    normalize();

    const click = (event: MouseEvent) => {
      const root = coverageRoot();
      if (!root) return;
      const button = event.target instanceof Element ? event.target.closest("button") as HTMLButtonElement | null : null;
      if (!button || !root.contains(button)) return;
      if (presetButtons(root).includes(button)) {
        markSelected(root);
        return;
      }
      const text = compact(button.textContent);
      if ((text.includes("วิเคราะห์ Coverage") || text.includes("สร้าง Prompt")) && root.dataset.scCoverageChosen !== "true") {
        event.preventDefault();
        event.stopPropagation();
        window.alert("กรุณาเลือก Cinematic Coverage จากรายการก่อนสร้าง Prompt เพื่อให้ระบบไม่เลือกมุมกล้องแทนคุณโดยอัตโนมัติ");
      }
    };
    document.addEventListener("click", click, true);

    return () => {
      stopped = true;
      observer.disconnect();
      document.removeEventListener("click", click, true);
    };
  }, []);

  return <style>{`
    #direct-render[data-sc-coverage-chosen="false"] [class*="presetActive"] {
      border-color: rgba(181,107,255,.18) !important;
      background: rgba(255,255,255,.025) !important;
      box-shadow: none !important;
    }
    #direct-render [data-sc-coverage-waiting="true"] > div:first-child > strong,
    #direct-render [data-sc-coverage-waiting="true"] > div:first-child > span {
      visibility: hidden !important;
    }
    #direct-render [data-sc-coverage-waiting="true"] > div:first-child::after {
      content: "ยังไม่ได้เลือก Coverage — เลือก 1 แบบจากรายการ 30 แบบ";
      display: block;
      color: #bca8ca;
      font-size: 11px;
      font-weight: 800;
      margin-top: 4px;
    }
  `}</style>;
}
