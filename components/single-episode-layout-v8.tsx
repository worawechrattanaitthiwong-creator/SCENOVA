"use client";

import { useEffect } from "react";

export default function SingleEpisodeLayoutV8() {
  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let observer: MutationObserver | null = null;

    const apply = () => {
      if (stopped) return;
      const main = document.querySelector<HTMLElement>('main[class*="single-episode-studio_main"]');
      if (!main) {
        timer = window.setTimeout(apply, 100);
        return;
      }

      const castUtilities = main.querySelector<HTMLElement>('[class*="single-episode-studio_castUtilities"]');
      if (castUtilities) castUtilities.style.display = "none";

      main.querySelectorAll<HTMLElement>('[class*="single-episode-studio_miniLocks"]').forEach((row) => {
        if (row.querySelector('[data-sc-voice-library-inline="true"]')) return;
        const link = document.createElement("a");
        link.href = "/libraries?tab=voices";
        link.textContent = "เปิดคลังเสียง";
        link.dataset.scVoiceLibraryInline = "true";
        link.className = "sc-voice-library-inline";
        row.appendChild(link);
      });
    };

    apply();
    observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);

  return null;
}
