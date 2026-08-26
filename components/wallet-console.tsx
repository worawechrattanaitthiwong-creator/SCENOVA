"use client";

import { useState } from "react";
import Link from "next/link";

const topups = [100, 300, 500, 1000, 3000, 5000, 10000];

export default function WalletConsole() {
  const [selected, setSelected] = useState(500);
  const [message, setMessage] = useState("Payment Gateway ยังไม่เชื่อม ตามแผนจะต่อเป็นขั้นสุดท้าย");

  return (
    <div className="content" style={{ maxWidth: 1150 }}>
      <div className="page-head">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><span style={{ color: "#f2c94c", fontSize: 12, fontWeight: 900, letterSpacing: ".14em" }}>CREDIT WALLET</span><h1 style={{ marginTop: 7 }}>เครดิตแบบ Prepaid</h1><p>ไม่มีแพ็กเกจสมาชิกแบบรายเดือน ผู้ใช้แต่ละบัญชีเติมเครดิตเมื่ออยากใช้ แล้วระบบหักตาม Prompt / Preview / Video / Regenerate ที่เกิดขึ้นจริง โดยราคาถูกคำนวณจาก Server</p></div>
          <Link href="/render" className="btn">ดูงานที่ใช้เครดิต →</Link>
        </div>
      </div>

      <div className="grid-3">
        <div className="card"><div className="muted">Paid Credits</div><div style={{ fontSize: 34, fontWeight: 900, marginTop: 6, color: "#f2c94c" }}>—</div><div className="help">เครดิตจากเงินจริง ใช้กับการ Generate ทุกประเภท</div></div>
        <div className="card"><div className="muted">Bonus Credits</div><div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>—</div><div className="help">เครดิตโปรโมชั่น แยกจากเงินจริงและกำหนดเงื่อนไขได้</div></div>
        <div className="card"><div className="muted">Reserved Credits</div><div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>—</div><div className="help">พักเครดิตก่อน Generate จากนั้น Charge หรือ Refund ตามผลจริง</div></div>
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-title"><div><h2>เติมเครดิต</h2><p>เลือกยอด แล้วระบบจริงจะสร้าง PromptPay QR หรือ Checkout Session จาก Backend</p></div></div>
          <div className="grid-3">{topups.map((amount) => <button className={`model-card ${selected === amount ? "selected" : ""}`} key={amount} onClick={() => setSelected(amount)}><h3>฿{amount.toLocaleString()}</h3><p>{amount.toLocaleString()} Credits ก่อนโปรโมชั่น</p></button>)}</div>
          <div style={{ height: 14 }} />
          <div className="row"><button className="btn btn-lg" type="button" disabled title="จะเปิดใช้งานหลังเชื่อม Payment Gateway และ Webhook จริง">PromptPay — กำลังเชื่อมระบบ</button><span className="badge warn">โหมดแสดงผลเท่านั้น • ไม่มีการชำระเงินจริง</span></div>
          <div className="help">เครดิตจะเพิ่มหลัง Backend ตรวจ webhook signature และยอดชำระสำเร็จเท่านั้น</div>
        </div>

        <div className="card">
          <div className="card-title"><div><h2>ลำดับการคิดเครดิต</h2><p>ราคาแปรตาม Model, Duration, Resolution, Reference และ Audio</p></div></div>
          <div className="stack">
            <div className="notice">1. Server คำนวณราคาและส่ง Quote</div>
            <div className="notice">2. ผู้ใช้ยืนยัน → Reserve Credits</div>
            <div className="notice">3. ส่ง Job เข้า Render Queue</div>
            <div className="notice success">4. สำเร็จ → Charge</div>
            <div className="notice">5. Provider fail และไม่คิดเงิน → Refund</div>
          </div>
        </div>
      </div>

      <div className="card"><div className="card-title"><div><h2>สถานะระบบ</h2><p>Wallet Data Model และ Flow พร้อมแล้ว ส่วนเงินจริงเชื่อมหลัง Video API และ Cost Tracking เสถียร</p></div></div><div className="notice">{message}</div></div>
    </div>
  );
}
