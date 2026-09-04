"use client";

import { useEffect, useRef, useState } from "react";
import ModelBrandIcon from "@/components/model-brand-icon";
import styles from "./studio-model-select.module.css";

export type StudioModelSelectOption = {
  value: string;
  label: string;
  status: "ready" | "setup" | "offline" | "checking";
  statusLabel: string;
  image: "ready" | "adapter" | "no";
  mode: "generate" | "video-edit" | "hdr";
  nativeAudio?: boolean;
};

export default function StudioModelSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: StudioModelSelectOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((item) => item.value === value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return <div className={styles.root} ref={rootRef}>
    <button type="button" className={styles.trigger} data-open={open ? "true" : "false"} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <ModelBrandIcon label={selected?.label || "AI"} size={28} />
      <span className={styles.triggerCopy}>
        <strong>{selected?.label || "เลือกโมเดล AI"}</strong>
        <small>{selected?.statusLabel || "เลือกโมเดลก่อนเริ่มสร้าง"}</small>
      </span>
      <span className={styles.chevron}>⌄</span>
    </button>

    {open ? <div className={styles.menu} role="listbox" aria-label="เลือกโมเดล AI">
      {options.map((item) => <button
        type="button"
        key={item.value}
        role="option"
        aria-selected={item.value === value}
        data-active={item.value === value ? "true" : "false"}
        className={styles.option}
        onClick={() => {
          onChange(item.value);
          setOpen(false);
        }}
      >
        <ModelBrandIcon label={item.label} size={30} />
        <span className={styles.optionCopy}>
          <strong>{item.label}</strong>
          <span className={styles.capabilities}>
            <span>{item.image === "ready" ? "รูปอ้างอิงพร้อม" : item.image === "adapter" ? "รูปผ่าน Adapter" : "ไม่รับรูป"}</span>
            {item.nativeAudio ? <span>Native Audio</span> : null}
            {item.mode === "video-edit" ? <span>Video Edit</span> : item.mode === "hdr" ? <span>HDR</span> : <span>Generate</span>}
          </span>
        </span>
        <span className={styles.status} data-status={item.status}><i className={styles.statusDot} />{item.statusLabel}</span>
      </button>)}
    </div> : null}
  </div>;
}
