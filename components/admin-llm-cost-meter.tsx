"use client";

import { useEffect, useState } from "react";
import styles from "./admin-llm-cost-meter.module.css";

type Row = Record<string, string | number>;
type Summary = {
  days: number;
  totals: Row;
  byModel: Row[];
  byCategory: Row[];
  topUsers: Row[];
  averageCallsPerClip: number;
  budgets: { dailyThb: number; monthlyThb: number; perUserDailyThb: number; perUserMonthlyThb: number };
};

function n(value: unknown, digits = 2) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString("th-TH", { maximumFractionDigits: digits }) : "0";
}

export default function AdminLlmCostMeter() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setError("");
    setSummary(null);
    fetch(`/api/admin/llm-costs?days=${days}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลดข้อมูลต้นทุน AI ไม่สำเร็จ");
        if (active) setSummary(data.summary);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => { active = false; };
  }, [days]);

  return <div className={styles.page}>
    <div className={styles.toolbar}>
      <div><b>ช่วงเวลาที่ใช้วิเคราะห์</b><span>ตัวเลขด้านล่างคำนวณจาก LLM Usage ที่บันทึกจริงในช่วงเวลาที่เลือก</span></div>
      <select value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="ช่วงเวลาต้นทุน AI"><option value={7}>7 วัน</option><option value={30}>30 วัน</option><option value={90}>90 วัน</option></select>
    </div>

    {error ? <div className={styles.error}>{error}</div> : null}
    {!summary ? <div className={styles.loading}>กำลังโหลดข้อมูลต้นทุน AI...</div> : <>
      <section className={styles.metrics}>
        <article><small>ต้นทุน LLM · {summary.days} วัน</small><strong>฿{n(summary.totals.costThb, 4)}</strong><span>{n(summary.totals.calls, 0)} ครั้ง</span></article>
        <article><small>ต้นทุนเฉลี่ย / CALL</small><strong>฿{n(summary.totals.avgCostThb, 6)}</strong><span>ต้นทุนจริงเฉลี่ยต่อการเรียก</span></article>
        <article><small>CALLS / CLIP</small><strong>{n(summary.averageCallsPerClip, 2)}</strong><span>จำนวนครั้งเฉลี่ยต่อ Episode / Clip</span></article>
        <article><small>เพดานงบ / เดือน</small><strong>฿{n(summary.budgets.monthlyThb)}</strong><span>รายวัน ฿{n(summary.budgets.dailyThb)}</span></article>
      </section>

      <section className={styles.grid}>
        <div className={styles.panel}><h2>ต้นทุนแยกตาม Model</h2>{summary.byModel.length ? summary.byModel.map((row) => <div className={styles.row} key={String(row.modelId)}><span><b>{row.modelId}</b><small>{n(row.calls, 0)} calls</small></span><strong>฿{n(row.costThb, 4)}</strong></div>) : <p>ยังไม่มี LLM Usage ในช่วงเวลานี้</p>}</div>
        <div className={styles.panel}><h2>ต้นทุนแยกตามประเภทงาน</h2>{summary.byCategory.length ? summary.byCategory.map((row) => <div className={styles.row} key={String(row.category)}><span><b>{row.category}</b><small>{n(row.calls, 0)} calls</small></span><strong>฿{n(row.costThb, 4)}</strong></div>) : <p>ยังไม่มี LLM Usage ในช่วงเวลานี้</p>}</div>
      </section>

      <section className={styles.panel}><div className={styles.panelTitle}><h2>บัญชีที่ใช้ AI สูงสุด</h2><span>ใช้ตรวจความผิดปกติของ Usage</span></div>{summary.topUsers.length ? summary.topUsers.map((row) => <div className={styles.row} key={String(row.userId)}><span><b>{row.name || row.email}</b><small>{row.email} · {n(row.calls, 0)} calls</small></span><strong>฿{n(row.costThb, 4)}</strong></div>) : <p>ยังไม่มีข้อมูล User Usage</p>}</section>

      <section className={styles.guardrails}><b>Budget Guardrails</b><span>ทั้งระบบ: ฿{n(summary.budgets.dailyThb)}/วัน · ฿{n(summary.budgets.monthlyThb)}/เดือน</span><span>ต่อผู้ใช้: ฿{n(summary.budgets.perUserDailyThb)}/วัน · ฿{n(summary.budgets.perUserMonthlyThb)}/เดือน</span></section>
    </>}
  </div>;
}
