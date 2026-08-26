"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const topups = [100, 300, 500, 1000, 3000, 5000, 10000];
type Balance = { paid: number; bonus: number; reserved: number; available: number };
type CostEvent = { phase: string; credits: number };

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

  return (
    <div className="content" style={{ maxWidth: 1180 }}>
      <div className="page-head" id="balance">
        <div className="row" style={{ justifyContent: "space-between", gap: 18, alignItems: "flex-end" }}>
          <div><span style={{ color: "#f2c94c", fontSize: 12, fontWeight: 900, letterSpacing: ".14em" }}>CREDIT WALLET</span><h1 style={{ marginTop: 7 }}>เครดิตและค่าใช้จ่าย</h1><p>ดูยอดพร้อมใช้ เครดิตที่ถูกพักไว้ และรายการใช้เครดิตจริงจากงาน AI / Preview / Video ได้จากหน้าเดียว ไม่มีแพ็กเกจรายเดือน</p></div>
          <div className="row"><Link href="/models" className="btn">ดูราคาโมเดล</Link><Link href="/render" className="btn">ดูคิวสร้างวิดีโอ →</Link></div>
        </div>
      </div>

      <div className="grid-3">
        <div className="card" style={{ borderColor: "#4a4120", background: "linear-gradient(145deg,#15140d,#0f0f0f)" }}><div className="muted">พร้อมใช้</div><div style={{ fontSize: 34, fontWeight: 900, marginTop: 6, color: "#f2c94c" }}>{loading ? "…" : credits(balance?.available)}</div><div className="help">ยอดที่ใช้เริ่มงานใหม่ได้ ณ ตอนนี้</div></div>
        <div className="card"><div className="muted">เครดิตจากการเติม</div><div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{loading ? "…" : credits(balance?.paid)}</div><div className="help">เครดิตจากเงินจริงที่บันทึกใน Wallet</div></div>
        <div className="card"><div className="muted">โบนัส</div><div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{loading ? "…" : credits(balance?.bonus)}</div><div className="help">เครดิตโปรโมชั่นหรือเครดิตที่ระบบมอบให้</div></div>
        <div className="card"><div className="muted">พักไว้สำหรับงาน</div><div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{loading ? "…" : credits(balance?.reserved)}</div><div className="help">เครดิตที่ Reserve ไว้ก่อนงานเสร็จ แล้วจึง Charge / Release / Refund ตามผลจริง</div></div>
        <div className="card"><div className="muted">ใช้ไปในรายการที่โหลด</div><div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{loading ? "…" : credits(charged)}</div><div className="help">ผลรวมรายการ CHARGE จากประวัติที่แสดงในหน้านี้</div></div>
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-title"><div><h2>เติมเครดิต</h2><p>เลือกยอดไว้ล่วงหน้าได้ เมื่อ Payment Gateway พร้อม ปุ่มชำระเงินจะใช้ยอดนี้สร้าง PromptPay / Checkout จาก Backend</p></div></div>
          <div className="grid-3">{topups.map((amount) => <button className={`model-card ${selected === amount ? "selected" : ""}`} key={amount} onClick={() => setSelected(amount)}><h3>฿{amount.toLocaleString()}</h3><p>{amount.toLocaleString()} Credits ก่อนโปรโมชั่น</p></button>)}</div>
          <div style={{ height: 14 }} />
          <div className="row"><button className="btn btn-lg" type="button" disabled title="ยังไม่เปิด Payment Gateway จริง">PromptPay — ยังไม่เปิดชำระเงินจริง</button><span className="badge warn">ยอดที่เลือก ฿{selected.toLocaleString()}</span></div>
          <div className="help">SCENOVA จะเพิ่มเครดิตต่อเมื่อ Backend ตรวจการชำระเงินจริงและ webhook ถูกต้องเท่านั้น จึงไม่สร้างยอดปลอมในระหว่างพัฒนา</div>
        </div>

        <div className="card">
          <div className="card-title"><div><h2>ระบบใช้เครดิตอย่างไร</h2><p>ก่อนสร้างงาน ระบบคำนวณราคาและพักเครดิตไว้ เพื่อลดความเสี่ยงจากการคิดเงินซ้ำ</p></div></div>
          <div className="stack">
            <div className="notice">1. คำนวณราคาและแสดง Estimate</div>
            <div className="notice">2. ยืนยันงาน → Reserve Credits</div>
            <div className="notice">3. ส่งงานไป Render Queue / AI Agent</div>
            <div className="notice success">4. สำเร็จ → Charge ตามผลจริง</div>
            <div className="notice">5. งานล้มเหลวและไม่ถูกคิดเงิน → Release / Refund</div>
          </div>
          <div className="row" style={{ marginTop: 12 }}><Link href="/agent" className="btn">ดู AI Agent</Link><Link href="/models" className="btn">เทียบราคาโมเดล</Link></div>
        </div>
      </div>

      <div className="card"><div className="card-title"><div><h2>สถานะระบบเครดิต</h2><p>ยอด Balance และ Credit Activity ใช้ข้อมูลจากระบบจริงแล้ว ส่วนการเติมเงินจริงจะเปิดเมื่อ Payment Gateway และ webhook พร้อมใช้งาน</p></div></div><div className="notice">{message}</div></div>
    </div>
  );
}
