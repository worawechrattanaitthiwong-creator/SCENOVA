"use client";

import { useState } from "react";
import { DEFAULT_SECURITY_POLICY, SECURITY_CHECKLIST_TH } from "@/lib/security";

export default function AdminSecurityConsole() {
  const [generationDisabled, setGenerationDisabled] = useState(false);
  const [hourlyCap, setHourlyCap] = useState(DEFAULT_SECURITY_POLICY.hourlyProviderSpendCapThb);
  const [dailyCap, setDailyCap] = useState(DEFAULT_SECURITY_POLICY.dailyProviderSpendCapThb);

  return (
    <div className="content" style={{ maxWidth: 1150 }}>
      <div className="page-head">
        <h1>Admin Security & Cost Control</h1>
        <p>หน้าสำหรับผู้ดูแลระบบเท่านั้น ใน Production ต้องบังคับ Auth + Admin Role + 2FA และทุกการเปลี่ยนค่าในหน้านี้ต้องลง Audit Log</p>
      </div>

      <div className="grid-3">
        <div className="card"><div className="muted">Hourly Provider Spend Cap</div><input className="input" type="number" value={hourlyCap} onChange={(e) => setHourlyCap(Number(e.target.value))} /><div className="help">ⓘ ถ้าค่าใช้ API รวมต่อชั่วโมงถึงเพดาน Worker ต้องหยุดรับงานใหม่ทันที</div></div>
        <div className="card"><div className="muted">Daily Provider Spend Cap</div><input className="input" type="number" value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} /><div className="help">ⓘ ป้องกัน API Key หลุดหรือบั๊ก Queue ทำให้ค่าใช้จ่ายพุ่งทั้งวัน</div></div>
        <div className="card"><div className="muted">Global Kill Switch</div><button className={`btn btn-lg ${generationDisabled ? "btn-danger" : "btn-primary"}`} onClick={() => setGenerationDisabled((value) => !value)}>{generationDisabled ? "⛔ Generation ปิดอยู่" : "✓ Generation เปิดอยู่"}</button><div className="help">ⓘ ใช้หยุดการเรียก Video Provider ทั้งระบบในเหตุฉุกเฉิน</div></div>
      </div>

      <div className="card">
        <div className="card-title"><div><h2>Security Checklist</h2><p>ข้อกำหนดที่ต้องผ่านก่อนเปิดระบบเงินจริงและ Video API Production</p></div></div>
        <div className="stack">{SECURITY_CHECKLIST_TH.map((item) => <div className="notice success" key={item}>✓ {item}</div>)}</div>
      </div>

      <div className="card">
        <div className="card-title"><div><h2>Rate Limit Defaults</h2><p>ค่าตั้งต้นเพื่อจำกัดการยิง Generate รัว ทั้งตาม User และ IP สามารถปรับตามแพ็ก Traffic จริงภายหลัง</p></div></div>
        <div className="grid-3">
          <div className="notice">Concurrent jobs/user: <b>{DEFAULT_SECURITY_POLICY.maxConcurrentGenerationJobsPerUser}</b></div>
          <div className="notice">Generate req/min/user: <b>{DEFAULT_SECURITY_POLICY.maxGenerationRequestsPerMinutePerUser}</b></div>
          <div className="notice">Generate req/min/IP: <b>{DEFAULT_SECURITY_POLICY.maxGenerationRequestsPerMinutePerIp}</b></div>
        </div>
      </div>
    </div>
  );
}
