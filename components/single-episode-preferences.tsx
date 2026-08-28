"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type OptionKey = "advancedSetup" | "blocking" | "camera" | "look" | "sound" | "continuity" | "review";
type Options = Record<OptionKey, boolean>;

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

const ITEMS: Array<{ key: OptionKey; label: string }> = [
  { key: "advancedSetup", label: "Locks / Negative" },
  { key: "blocking", label: "Blocking รายคน" },
  { key: "camera", label: "กล้องขั้นสูง" },
  { key: "look", label: "แสง / การแสดง" },
  { key: "sound", label: "เสียง / SFX" },
  { key: "continuity", label: "Continuity" },
  { key: "review", label: "ตรวจความพร้อม" },
];

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

export default function SingleEpisodePreferences() {
  const [options, setOptions] = useState<Options>(DEFAULTS);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setOptions(readOptions());

    const locate = () => {
      const main = findMain();
      if (!main) {
        setHost(null);
        return;
      }

      let nextHost = main.querySelector<HTMLElement>(":scope > [data-single-episode-options-host]");
      if (!nextHost) {
        nextHost = document.createElement("div");
        nextHost.dataset.singleEpisodeOptionsHost = "1";
        const hero = main.querySelector<HTMLElement>('[class*="single-episode-studio_hero"]');
        if (hero?.nextSibling) main.insertBefore(nextHost, hero.nextSibling);
        else main.prepend(nextHost);
      }
      setHost((current) => current === nextHost ? current : nextHost);
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
    const main = host?.closest<HTMLElement>('main[class*="single-episode-studio_main"]');
    if (!main) return;
    applyOptions(main, options);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  }, [host, options]);

  if (!host) return null;

  return createPortal(
    <div className="sc-se-options" aria-label="ส่วนเสริม Single Episode">
      <div className="sc-se-options__title">
        <strong>ส่วนเสริม</strong>
        <span>ติ๊กเฉพาะสิ่งที่ต้องใช้</span>
      </div>
      <div className="sc-se-options__items">
        {ITEMS.map((item) => (
          <label key={item.key} className={options[item.key] ? "is-on" : ""}>
            <input
              type="checkbox"
              checked={options[item.key]}
              onChange={(event) => setOptions((current) => ({ ...current, [item.key]: event.target.checked }))}
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>,
    host,
  );
}
