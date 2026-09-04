"use client";

import { useEffect } from "react";

function compact(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function findRefreshButton() {
  const host = document.getElementById("scenova-direct-render-host");
  if (!host) return null;
  return Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const text = compact(button.textContent);
    return text.includes("ซิงก์ข้อมูล Studio") || text.includes("ซิงก์ข้อมูลล่าสุด") || text.includes("กำลังซิงก์");
  }) || null;
}

function hideLegacySyncUi() {
  const host = document.getElementById("scenova-direct-render-host");
  if (!host) return;
  const hasDirectRender = Boolean(host.querySelector("#direct-render"));
  const title = Array.from(host.querySelectorAll<HTMLElement>("strong")).find((element) => compact(element.textContent) === "Direct Render Data Sync");
  const bar = title?.parentElement?.parentElement;
  if (bar) bar.style.display = hasDirectRender ? "none" : "";

  Array.from(host.querySelectorAll<HTMLElement>("div")).forEach((element) => {
    const text = compact(element.textContent);
    if (text.startsWith("Direct Render จะใช้ข้อมูลที่คุณกรอกใน AI Studio เท่านั้น")) element.style.display = hasDirectRender ? "none" : "";
  });
}

export default function StudioDirectRenderInstant() {
  useEffect(() => {
    let stopped = false;
    let timer = 0;

    const refreshNow = () => {
      if (stopped) return;
      hideLegacySyncUi();
      const button = findRefreshButton();
      if (!button || button.disabled || compact(button.textContent).includes("กำลังซิงก์")) return;
      button.click();
    };

    const scheduleRefresh = (delay = 120) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refreshNow, delay);
    };

    const normalize = () => {
      hideLegacySyncUi();
      const host = document.getElementById("scenova-direct-render-host");
      if (host && !host.querySelector("#direct-render")) scheduleRefresh(40);
    };

    const observer = new MutationObserver(normalize);
    observer.observe(document.body, { childList: true, subtree: true });

    const changed = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("#scenova-direct-render-host")) return;
      if (!target.closest('main[class*="single-episode-studio_main"]')) return;
      scheduleRefresh(180);
    };
    document.addEventListener("input", changed, true);
    document.addEventListener("change", changed, true);
    const dataChanged = () => scheduleRefresh(180);
    window.addEventListener("scenova-studio-data-change", dataChanged);

    normalize();
    scheduleRefresh(80);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("input", changed, true);
      document.removeEventListener("change", changed, true);
      window.removeEventListener("scenova-studio-data-change", dataChanged);
    };
  }, []);

  return null;
}
