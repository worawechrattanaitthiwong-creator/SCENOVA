"use client";

import { useState } from "react";

const topups = [100, 300, 500, 1000, 3000, 5000, 10000];

export default function WalletConsole() {
  const [selected, setSelected] = useState(500);
  const [message, setMessage] = useState("Payment Gateway ยังไม่เชื่อม ตามแผนจะต่อเป็นขั้นสุดท้าย");

  return (
    <div className="content" style={{ maxWidth: 1150 }}>
      <div className="page-head">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><h1>Credit Wallet — ระบบเติมเครดิตแบบ Prepaid</h1><p>SCENOVA ไม่มีระบบสมาชิก ผู้ใช้เติมเครดิตเมื่ออยากใช้ แล้วหักตาม Prompt / Preview / Video / Regenerate ที่ใช้งานจริง โดยราคา Generate จะคำนวณฝั่ง Server เท่านั้น</p></div>
          <a href="/" className="btn">← กลับ Studio</a>
        </div>
      </div>

      <div className="grid-3">
        <div className="card"><div className="muted">เครดิตชำระเงินจริง (Paid)</div><div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>—</div><div className="help">ใช้กับการ Generate ทุกประเภท และแยกบัญชีจาก Bonus Credit</div></div>
        <div className="card"><div className="muted">โบนัสเครดิต (Bonus)</div><div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>—</div><div className="help">ใช้สำหรับโปรโมชั่น แต่ไม่ถือเป็นเงินสดและกำหนดเงื่อนไขแยกได้</div></div>
        <div className="card"><div className="muted">เครดิตที่ถูกพักไว้ (Reserved)</div><div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>—</div><div className="help">เมื่อกด Generate ระบบ Reserve ก่อน ถ้าสำเร็จ Charge ถ้า Provider fail และไม่คิดเงินจึง Refund</div></div>
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-title"><div><h2>เติมเครดิต</h2><p>เลือกยอดแล้วระบบจริงจะสร้าง PromptPay QR หรือ Checkout Session จาก Backend</p></div></div>
          <div className="grid-3">{topups.map((amount) => <button className={`model-card ${selected === amount ? "selected" : ""}`} key={amount} onClick={() => setSelected(amount)}><h3>฿{amount.toLocaleString()}</h3><p>{amount.toLocaleString()} Credits ก่อนโปรโมชั่น</p></button>)}</div>
          <div style={{ height: 14 }} />
          <div className="row"><button className="btn btn-primary btn-lg" onClick={() => setMessage(`เลือกเติม ฿${selected.toLocaleString()} แล้ว — รอเชื่อม PromptPay/Payment Gateway จริง`)}>สร้าง QR PromptPay</button><span className="badge warn">ยังไม่เชื่อมเงินจริง</span></div>
          <div className="help">ⓘ เมื่อเชื่อมจริง เครดิตจะเพิ่มเฉพาะหลัง Backend ตรวจ webhook signature และยอดชำระสำเร็จเท่านั้น ไม่เชื่อข้อมูลจากหน้า Browser</div>
        </div>

        <div className="card">
          <div className="card-title"><div><h2>ระบบคิดเครดิต Generate</h2><p>ราคาไม่ตายตัว เพราะขึ้นกับ Model, Duration, Resolution, Reference, Audio และ Retry</p></div></div>
          <div className="stack">
            <div className="notice">1. Backend คำนวณราคาและส่ง Quote</div>
            <div className="notice">2. ผู้ใช้กดยืนยัน → Reserve Credits</div>
            <div className="notice">3. ส่ง Job เข้า Queue → เรียก Video Provider</div>
            <div className="notice success">4. สำเร็จ → Charge จริง</div>
            <div className="notice">5. Provider fail และไม่ถูกคิดเงิน → Refund</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><div><h2>สถานะระบบ</h2><p>UI และ Data Model เตรียมไว้ แต่เงินจริงจะเชื่อมหลัง Video API/Cost Tracking เสถียรแล้ว</p></div></div>
        <div className="notice">{message}</div>
      </div>
    </div>
  );
}
