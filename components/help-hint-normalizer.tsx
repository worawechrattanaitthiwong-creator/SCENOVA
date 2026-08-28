"use client";

import { useEffect } from "react";

const SKIP_SELECTOR = [
  "[data-keep-small]",
  "[class*='brand']",
  "[class*='member']",
  "[class*='metric']",
  "[class*='log']",
  "[class*='profileCopy']",
  "[class*='creditShortcut']",
  "[class*='setupBox']",
  "[class*='recovery']",
  "[class*='story-mode_']",
  "[class*='single-episode-studio_']",
  "code",
].join(",");

function normalizeSmall(element: HTMLUnknownElement) {
  if (!(element instanceof HTMLElement)) return;
  if (element.dataset.scHelpReady === "1") return;
  if (element.matches(SKIP_SELECTOR) || element.closest(SKIP_SELECTOR)) return;
  const text = (element.textContent || "").replace(/\s+/g, " ").trim();
  if (!text || text.length < 4) return;

  element.dataset.scHelpReady = "1";
  element.dataset.scHelp = text;
  element.classList.add("sc-help-hint");
  element.setAttribute("role", "button");
  element.setAttribute("tabindex", "0");
  element.setAttribute("aria-label", text);
  element.setAttribute("title", text);
}

function scan(root: ParentNode) {
  root.querySelectorAll("small").forEach((element) => normalizeSmall(element));
}

export default function HelpHintNormalizer() {
  useEffect(() => {
    scan(document);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.tagName === "SMALL") normalizeSmall(node);
          scan(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
