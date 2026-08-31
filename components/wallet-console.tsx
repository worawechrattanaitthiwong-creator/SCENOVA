"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./wallet-console.module.css";

const topups = [100, 300, 500, 1000, 3000, 5000, 10000];
type Balance = { paid: number; bonus: number; reserved: number; available: number };
type CostEvent = { phase: string; credits: number };
type Metric = { label: string; value: number | undefined; help: string; featured?: boolean };

function credits(value: number | undefined) {
  return Number(value || 0).toLocaleString("th-TH", { maximumFractionDigits: 4 });
}

export default function WalletConsole() {
  const [selected, setSelected] = useState(500);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [events, setEvents] = useState<CostEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("ระบบเติมเงินจริงยังไม่เปิดใช้งาน แต่ยอดเครดิตและประวัติการใช้ด้านล่างอ่านจากระบบจริงแล้ว");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/cost/activity?limit=200", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "โหลดเครดิตไม่สำเร็จ");
        if (!active) return;
        setBalance(data.balance || { paid: 0, bonus: 0, reserved: 0, available: 0 });
        setEvents(Array.isArray(data.events) ? data.events : []);
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const charged = useMemo(() => events.filter((event) => event.phase === "CHARGE").reduce((sum, event) => sum + Number(event.credits || 0), 0), [events]);

  const metrics: Metric[] = [
    { label: "พร้อมใช้", value: balance?.available, help: "ยอดที่ใช้เริ่มงานใหม่ได้ ณ ตอนนี้", featured: true },
    { label: "เครดิตจากการเติม", value: balance?.paid, help: "เครดิตจากเงินจริงที่บันทึกใน Wallet" },
    { label: "โบนัส", value: balance?.bonus, help: "เครดิตโปรโมชั่นหรือเครดิตที่ระบบมอบให้" },
    { label: "พักไว้สำหรับงาน", value: balance?.reserved, help: "เครดิตที่ Reserve ไว้ก่อนงานเสร็จ แล้วจึง Charge / Release / Refund ตามผลจริง" },
    { label: "ใช้ไปในรายการที่โหลด", value: charged, help: "ผลรวมรายการ CHARGE จากประวัติที่แสดงในหน้านี้" },
  ];

  return <main className={styles.page}>
    <header className={styles.hero} id="balance">
      <div>
        <span className={styles.eyebrow}>CREDIT WALLET</span>
        <h1>เครดิตและค่าใช้จ่าย</h1>
        <p>ดูยอดพร้อมใช้ เครดิตที่ถูกพักไว้ และรายการใช้เครดิตจริงจากงาน AI / Preview / Video ได้จากหน้าเดียว ไม่มีแพ็กเกจรายเดือน</p>
      </div>
      <div className={styles.heroActions}><Link href="/models">ดูราคาโมเดล</Link></div>
    </header>

    <section className={styles.metrics} aria-label="สรุปเครดิต">
      {metrics.map((metric) => <article key={metric.label} className={`${styles.metric} ${metric.featured ? styles.featuredMetric : ""}`}>
        <span>{metric.label}</span>
        <strong>{loading ? "…" : credits(metric.value)}</strong>
        <small>{metric.help}</small>
      </article>)}
    </section>

    <div className={styles.grid}>
      <section className={styles.card}>
        <div className={styles.cardHead}><h2>เติมเครดิต</h2><p>เลือกยอดไว้ล่วงหน้าได้ เมื่อ Payment Gateway พร้อม ปุ่มชำระเงินจะใช้ยอดนี้สร้าง PromptPay / Checkout จาก Backend</p></div>
        <div className={styles.topups}>{topups.map((amount) => <button className={`${styles.topup} ${selected === amount ? styles.selected : ""}`} key={amount} onClick={() => setSelected(amount)}><strong>฿{amount.toLocaleString()}</strong><span>{amount.toLocaleString()} Credits ก่อนโปรโมชั่น</span></button>)}</div>
        <div className={styles.paymentRow}><button className={styles.paymentDisabled} type="button" disabled title="ยังไม่เปิด Payment Gateway จริง">PromptPay — ยังไม่เปิดชำระเงินจริง</button><span className={styles.selectedAmount}>ยอดที่เลือก ฿{selected.toLocaleString()}</span></div>
        <p className={styles.help}>SCENOVA จะเพิ่มเครดิตต่อเมื่อ Backend ตรวจการชำระเงินจริงและ webhook ถูกต้องเท่านั้น จึงไม่สร้างยอดปลอมในระหว่างพัฒนา</p>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}><h2>ระบบใช้เครดิตอย่างไร</h2><p>ก่อนสร้างงาน ระบบคำนวณราคาและพักเครดิตไว้ เพื่อลดความเสี่ยงจากการคิดเงินซ้ำ</p></div>
        <div className={styles.flow}><div>1. คำนวณราคาและแสดง Estimate</div><div>2. ยืนยันงาน → Reserve Credits</div><div>3. ส่งงานไป Render Queue / AI Agent</div><div className={styles.success}>4. สำเร็จ → Charge ตามผลจริง</div><div>5. งานล้มเหลวและไม่ถูกคิดเงิน → Release / Refund</div></div>
        <div className={styles.links}><Link href="/agent">ดู AI Agent</Link><Link href="/models">เทียบราคาโมเดล</Link></div>
      </section>
    </div>

    <section className={styles.statusCard}>
      <div className={styles.cardHead}><h2>สถานะระบบเครดิต</h2><p>ยอด Balance และ Credit Activity ใช้ข้อมูลจากระบบจริงแล้ว ส่วนการเติมเงินจริงจะเปิดเมื่อ Payment Gateway และ webhook พร้อมใช้งาน</p></div>
      <div className={styles.notice}>{message}</div>
    </section>
  </main>;
}
