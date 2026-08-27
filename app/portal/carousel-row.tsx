"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import styles from "./portal.module.css";

export default function CarouselRow({ children, label }: { children: ReactNode; label: string }) {
  const rowRef = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * Math.max(row.clientWidth * 0.78, 300), behavior: "smooth" });
  }

  return <div className={styles.carouselShell}>
    <div className={styles.carouselControls} aria-label={`ควบคุมแถว${label}`}>
      <button type="button" onClick={() => move(-1)} aria-label={`เลื่อน${label}ไปทางซ้าย`}>←</button>
      <button type="button" onClick={() => move(1)} aria-label={`เลื่อน${label}ไปทางขวา`}>→</button>
    </div>
    <div className={styles.templateTrack} ref={rowRef} tabIndex={0} aria-label={label}>
      {children}
    </div>
  </div>;
}
