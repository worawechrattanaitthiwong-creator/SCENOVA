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
    fetch(`/api/admin/llm-costs?days=${days}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลด LLM Cost Meter ไม่สำเร็จ");
        if (active) setSummary(data.summary);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => { active = false; };
  }, [days]);

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span>ADMIN · COST OBSERVABILITY</span><h1>LLM Cost Meter</h1><p>ดูต้นทุน LLM จริงแยกตาม Model, งาน, User และจำนวน Call ต่อคลิป เพื่อควบคุมค่า API ก่อนเปิด Scale</p></div>
      <select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 วัน</option><option value={30}>30 วัน</option><option value={90}>90 วัน</option></select>
    </header>

    {error ? <div className={styles.error}>{error}</div> : null}
    {!summary ? <div className={styles.loading}>กำลังโหลด Cost Meter...</div> : <>
      <section className={styles.metrics}>
        <article><small>LLM COST · {summary.days} DAYS</small><strong>฿{n(summary.totals.costThb, 4)}</strong><span>{n(summary.totals.calls, 0)} calls</span></article>
        <article><small>AVG COST / CALL</small><strong>฿{n(summary.totals.avgCostThb, 6)}</strong><span>ต้นทุนจริงเฉลี่ย</span></article>
        <article><small>CALLS / CLIP</small><strong>{n(summary.averageCallsPerClip, 2)}</strong><span>ค่าเฉลี่ยต่อ Episode/Clip</span></article>
        <article><small>MONTHLY GUARDRAIL</small><strong>฿{n(summary.budgets.monthlyThb)}</strong><span>Daily ฿{n(summary.budgets.dailyThb)}</span></article>
      </section>

      <section className={styles.grid}>
        <div className={styles.panel}><h2>Cost by Model</h2>{summary.byModel.length ? summary.byModel.map((row) => <div className={styles.row} key={String(row.modelId)}><span><b>{row.modelId}</b><small>{n(row.calls, 0)} calls</small></span><strong>฿{n(row.costThb, 4)}</strong></div>) : <p>ยังไม่มี LLM Usage</p>}</div>
        <div className={styles.panel}><h2>Cost by Work Type</h2>{summary.byCategory.length ? summary.byCategory.map((row) => <div className={styles.row} key={String(row.category)}><span><b>{row.category}</b><small>{n(row.calls, 0)} calls</small></span><strong>฿{n(row.costThb, 4)}</strong></div>) : <p>ยังไม่มี LLM Usage</p>}</div>
      </section>

      <section className={styles.panel}><div className={styles.panelTitle}><h2>Highest LLM Usage</h2><span>ตรวจ User ที่ใช้ AI ผิดปกติ</span></div>{summary.topUsers.length ? summary.topUsers.map((row) => <div className={styles.row} key={String(row.userId)}><span><b>{row.name || row.email}</b><small>{row.email} · {n(row.calls, 0)} calls</small></span><strong>฿{n(row.costThb, 4)}</strong></div>) : <p>ยังไม่มีข้อมูล User Usage</p>}</section>

      <section className={styles.guardrails}><b>Server Guardrails</b><span>Global: ฿{n(summary.budgets.dailyThb)}/วัน · ฿{n(summary.budgets.monthlyThb)}/เดือน</span><span>ต่อ User: ฿{n(summary.budgets.perUserDailyThb)}/วัน · ฿{n(summary.budgets.perUserMonthlyThb)}/เดือน</span></section>
    </>}
  </main>;
}
