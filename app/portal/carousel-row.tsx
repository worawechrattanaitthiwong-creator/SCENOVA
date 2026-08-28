"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import styles from "./portal.module.css";
import refine from "./portal-refine.module.css";

type CharacterTemplate = {
  id: string;
  kind: string;
  title: string;
  description: string;
  assetUrl?: string;
  metadata?: { role?: string; ageRange?: string };
};

const FALLBACK_CHARACTERS: CharacterTemplate[] = [
  { id: "char-starter", kind: "characters", title: "Female Cinematic", description: "ตัวละครหญิงสมจริงสำหรับ Drama / Commercial" },
  { id: "char-male-cinematic", kind: "characters", title: "Male Cinematic", description: "ตัวละครชายสมจริงสำหรับ Drama / Action" },
  { id: "char-anime-heroine", kind: "characters", title: "Anime Heroine", description: "ตัวละครอนิเมะหญิงสำหรับ Fantasy / Romance" },
  { id: "char-anime-hero", kind: "characters", title: "Anime Hero", description: "ตัวละครอนิเมะชายสำหรับ Adventure / Action" },
  { id: "char-child", kind: "characters", title: "Child Character", description: "ตัวละครเด็กสำหรับ Family / Adventure" },
  { id: "char-senior", kind: "characters", title: "Senior Character", description: "ตัวละครสูงวัยสำหรับ Mentor / Historical" },
  { id: "char-scifi", kind: "characters", title: "Sci-Fi Character", description: "ตัวละครสำหรับ Sci-Fi และ Cyberpunk" },
  { id: "char-fantasy", kind: "characters", title: "Fantasy Character", description: "ตัวละครสำหรับ Adventure / Dark Fantasy" },
];

function avatarUrl(item: CharacterTemplate) {
  return item.assetUrl || `/api/character-avatar?name=${encodeURIComponent(item.title)}&seed=${encodeURIComponent(item.id)}`;
}

export default function CarouselRow({ children, label }: { children: ReactNode; label: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  function move(direction: -1 | 1) {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * Math.max(row.clientWidth * 0.78, 300), behavior: "smooth" });
  }

  function stopGlide() {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    animationRef.current = null;
  }

  function startGlide(direction: -1 | 1) {
    stopGlide();
    const glide = () => {
      const row = rowRef.current;
      if (!row) return stopGlide();
      row.scrollLeft += direction * 5;
      animationRef.current = requestAnimationFrame(glide);
    };
    animationRef.current = requestAnimationFrame(glide);
  }

  useEffect(() => stopGlide, []);

  return <div className={styles.carouselShell}>
    <div className={styles.carouselControls} aria-label={`ควบคุมแถว${label}`}>
      <button type="button" data-direction="left" onPointerEnter={() => startGlide(-1)} onPointerLeave={stopGlide} onClick={() => move(-1)} aria-label={`เลื่อน${label}ไปทางซ้าย`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg></button>
      <button type="button" data-direction="right" onPointerEnter={() => startGlide(1)} onPointerLeave={stopGlide} onClick={() => move(1)} aria-label={`เลื่อน${label}ไปทางขวา`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6 6 6-6 6" /></svg></button>
    </div>
    <div className={`${styles.templateTrack} ${refine.templateTrack}`} ref={rowRef} tabIndex={0} aria-label={label}>{children}</div>
  </div>;
}

export function CharacterTemplateRow() {
  const [items, setItems] = useState<CharacterTemplate[]>(FALLBACK_CHARACTERS);

  useEffect(() => {
    let active = true;
    fetch("/api/library", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("library unavailable")))
      .then((data) => {
        if (!active) return;
        const characters = Array.isArray(data.items)
          ? data.items.filter((item: CharacterTemplate) => item.kind === "characters")
          : [];
        if (characters.length) setItems(characters.slice(0, 12));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  return <CarouselRow label="เทมเพลตตัวละคร">
    {items.map((character) => <Link href="/libraries?tab=characters" prefetch={false} key={character.id} className={`${styles.templateCard} ${styles.characterCard} ${refine.templateCard} ${refine.characterCard}`}>
      <img src={avatarUrl(character)} alt={`เทมเพลตตัวละคร ${character.title}`} loading="lazy" decoding="async" />
      <span className={styles.templateShade} aria-hidden="true" />
      <span className={styles.characterTag}>{character.metadata?.role?.split(/[—/]/)[0]?.trim() || "CHARACTER"}</span>
      <span className={`${styles.templateCopy} ${refine.templateCopy}`}><b>{character.title}</b></span>
      <span className={styles.templateArrow} aria-hidden="true">→</span>
    </Link>)}
  </CarouselRow>;
}
