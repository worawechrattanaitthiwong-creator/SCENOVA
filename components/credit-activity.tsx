"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./credit-activity.module.css";

type Balance = { paid: number; bonus: number; reserved: number; available: number };
type Event = { id: string; category: string; label: string; phase: string; credits: number; providerId?: string | null; modelId?: string | null; createdAt: string; referenceType?: string | null };

const LABELS: Record<string,string> = {
  AGENT_PLANNING: "AI Planning",
  AI_SUGGEST: "AI Suggest",
  PROMPT_GENERATION: "Production Prompt",
  PROMPT_REWRITE: "Prompt Rewrite",
  PROMPT_EXPORT: "Prompt Export",
  CONTINUITY_CHECK: "Continuity Check",
  IMAGE_PREVIEW: "Image Preview",
  VIDEO_GENERATION: "Video Generation",
  VIDEO_RETRY: "Video Retry",
  AUDIO_GENERATION: "Audio Generation",
  STORAGE: "Storage",
};

export default function CreditActivity() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cost/activity?limit=200", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "โหลด Credit Activity ไม่สำเร็จ");
      setBalance(data.balance); setEvents(data.events || []);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  const categories = useMemo(() => Array.from(new Set(events.map((event) => event.category))), [events]);
  const visible = filter === "ALL" ? events : events.filter((event) => event.category === filter);
  const charged = events.filter((event) => event.phase === "CHARGE").reduce((sum, event) => sum + Number(event.credits || 0), 0);
  const refunded = events.filter((event) => event.phase === "REFUND").reduce((sum, event) => sum + Number(event.credits || 0), 0);

  return <section className={styles.section} id="activity">
    <header><div><span>CREDIT ACTIVITY</span><h2>ประวัติการใช้เครดิต</h2><p>ทุก Reserve, Charge, Release และ Refund แสดงแยกประเภท เพื่อให้ตรวจสอบย้อนหลังได้</p></div></header>
    {error ? <div className={styles.error}>{error}</div> : null}
    <div className={styles.metrics}><article><small>พร้อมใช้</small><strong>{balance?.available ?? 0}</strong><span>Paid {balance?.paid ?? 0} + Bonus {balance?.bonus ?? 0}</span></article><article><small>พักไว้</small><strong>{balance?.reserved ?? 0}</strong><span>กำลังถูกล็อกไว้สำหรับงาน</span></article><article><small>ใช้แล้ว</small><strong>{charged}</strong><span>จากรายการที่แสดง</span></article><article><small>คืนแล้ว</small><strong>{refunded}</strong><span>เครดิตที่คืนแล้ว</span></article></div>
    <div className={styles.filters}><button className={filter === "ALL" ? styles.active : ""} onClick={() => setFilter("ALL")}>ทั้งหมด</button>{categories.map((category) => <button key={category} className={filter === category ? styles.active : ""} onClick={() => setFilter(category)}>{LABELS[category] || category}</button>)}</div>
    <div className={styles.table}><div className={styles.head}><span>รายการ</span><span>สถานะ</span><span>ระบบ / โมเดล</span><span>เครดิต</span><span>เวลา</span></div>{visible.length ? visible.map((event) => <div className={styles.row} key={event.id}><span><b>{LABELS[event.category] || event.category}</b><small>{event.label}</small></span><span data-phase={event.phase}>{event.phase}</span><span>{event.providerId || event.modelId || "SCENOVA"}</span><strong>{event.credits}</strong><small>{new Date(event.createdAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}</small></div>) : <p className={styles.empty}>ยังไม่มีประวัติการใช้เครดิต</p>}</div>
  </section>;
}
