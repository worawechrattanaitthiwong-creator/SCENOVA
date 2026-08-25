"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SECURITY_POLICY, SECURITY_CHECKLIST_TH } from "@/lib/security";

type EmergencyState = {
  lockdownEnabled: boolean;
  maintenanceMode: boolean;
  generationDisabled: boolean;
  agentDisabled: boolean;
  llmDisabled: boolean;
  paymentDisabled: boolean;
  newLoginRestricted: boolean;
  queuePaused: boolean;
  emergencyRateLimitEnabled: boolean;
  disabledProviderIds: string[];
  sessionInvalidBefore: string | null;
  reason: string | null;
  updatedAt: string;
  environmentHardLock: boolean;
};

type AuditEvent = { id: string; action: string; createdAt: string; metadata?: unknown };

const EMPTY: EmergencyState = {
  lockdownEnabled: false,
  maintenanceMode: false,
  generationDisabled: false,
  agentDisabled: false,
  llmDisabled: false,
  paymentDisabled: false,
  newLoginRestricted: false,
  queuePaused: false,
  emergencyRateLimitEnabled: false,
  disabledProviderIds: [],
  sessionInvalidBefore: null,
  reason: null,
  updatedAt: "",
  environmentHardLock: false,
};

const CONTROL_ITEMS: Array<{
  key: keyof Pick<EmergencyState, "maintenanceMode" | "generationDisabled" | "agentDisabled" | "llmDisabled" | "paymentDisabled" | "newLoginRestricted" | "queuePaused" | "emergencyRateLimitEnabled">;
  title: string;
  help: string;
}> = [
  { key: "maintenanceMode", title: "Maintenance Mode — โหมดปิดปรับปรุง", help: "หยุดฟังก์ชันงาน Production ของสมาชิกชั่วคราว แต่ Admin ยังเข้าตรวจสอบและกู้ระบบได้" },
  { key: "generationDisabled", title: "Video Generation — การสร้างวิดีโอ", help: "ปิดการส่งงานสร้างวิดีโอใหม่ และหยุดการเรียกบริการสร้างวิดีโอภายนอก (Video Provider)" },
  { key: "agentDisabled", title: "AI Agent — ผู้ช่วยอัตโนมัติ", help: "ห้ามเริ่ม Agent Run ใหม่ และสั่ง Worker ไม่ให้รับขั้นตอนงาน Agent เพิ่ม" },
  { key: "llmDisabled", title: "LLM Calls — การเรียกโมเดลภาษา AI", help: "หยุดการเรียก OpenAI/LLM ออกจาก Server ทันที เพื่อตัดค่าใช้จ่ายหรือป้องกัน Key ที่สงสัยว่ารั่ว" },
  { key: "paymentDisabled", title: "Wallet / Payment — เครดิตและการชำระเงิน", help: "หยุด Reserve (กันเครดิต), Charge (ตัดเครดิต) และ Refund (คืนเครดิต) ชั่วคราว" },
  { key: "newLoginRestricted", title: "Member Login — การเข้าสู่ระบบสมาชิก", help: "ปิดการ Login ของสมาชิกชั่วคราว แต่ Admin ยัง Login เพื่อกู้ระบบได้" },
  { key: "queuePaused", title: "Agent Queue — คิวงาน AI Agent", help: "พักคิวงาน Agent; Worker จะไม่ Claim หรือหยิบงานใหม่ไปประมวลผลจนกว่าจะเปิดกลับ" },
  { key: "emergencyRateLimitEnabled", title: "Emergency Rate Limit — จำกัดคำขอฉุกเฉิน", help: "เปิดโปรไฟล์จำกัดจำนวน Request ให้เข้มขึ้น เพื่อลดการยิง API รัวจาก Bot หรือการโจมตี" },
];

const SECURITY_TERMS = [
  ["API Key", "รหัสลับที่อนุญาตให้ SCENOVA เรียกบริการภายนอก เช่น AI หรือ Video Provider"],
  ["Provider", "ผู้ให้บริการภายนอกที่ SCENOVA เชื่อมต่อ เช่น ผู้ให้บริการโมเดลวิดีโอหรือ AI"],
  ["Session", "สถานะการ Login ของผู้ใช้ ถ้ายกเลิก Session ผู้ใช้ต้อง Login ใหม่"],
  ["Rate Limit", "การจำกัดจำนวนคำขอที่ส่งเข้า Server ภายในช่วงเวลา เพื่อกัน Bot/การยิงรัว"],
  ["Kill Switch / Lockdown", "สวิตช์ฉุกเฉินสำหรับหยุดระบบสำคัญทันทีเมื่อพบความเสี่ยง"],
  ["Audit Log", "ประวัติว่าใครทำอะไร เมื่อไร และกับระบบส่วนใด เพื่อใช้ตรวจสอบเหตุการณ์ย้อนหลัง"],
  ["Idempotency Key", "รหัสกันคำสั่งซ้ำ ช่วยป้องกันการตัดเงินหรือสร้างงานซ้ำจากการกดซ้ำ/รีเฟรช"],
  ["Signed URL", "ลิงก์ไฟล์ชั่วคราวที่มีวันหมดอายุ ใช้เปิดไฟล์ Private โดยไม่ทำให้ไฟล์เป็นสาธารณะ"],
] as const;

export default function AdminSecurityConsole() {
  const [state, setState] = useState<EmergencyState>(EMPTY);
  const [draft, setDraft] = useState<EmergencyState>(EMPTY);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [reason, setReason] = useState("");
  const [providerInput, setProviderInput] = useState("byteplus-seedance-2.5");
  const [message, setMessage] = useState("กำลังโหลดสถานะความปลอดภัย...");
  const [busy, setBusy] = useState(false);

  const hasChanges = useMemo(
    () => CONTROL_ITEMS.some(({ key }) => draft[key] !== state[key]) || JSON.stringify(draft.disabledProviderIds) !== JSON.stringify(state.disabledProviderIds),
    [draft, state],
  );

  async function load() {
    const response = await fetch("/api/admin/security/emergency", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(response.status === 403 ? "หน้านี้สำหรับ Admin เท่านั้น หรือ Session ถูกยกเลิกแล้ว" : data.error || "โหลดสถานะไม่สำเร็จ");
      return;
    }
    setState(data.state || EMPTY);
    setDraft(data.state || EMPTY);
    setEvents(data.events || []);
    setMessage("ศูนย์ความปลอดภัยฉุกเฉินพร้อมใช้งาน");
  }

  useEffect(() => { void load(); }, []);

  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("กำลังอัปเดตการควบคุมความปลอดภัย...");
    try {
      const response = await fetch("/api/admin/security/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(data.error || "อัปเดตไม่สำเร็จ");
      if (data.state) { setState(data.state); setDraft(data.state); }
      if (data.sessionRevoked) {
        setMessage("คำสั่งฉุกเฉินสำเร็จ — Session เดิมถูกยกเลิก กรุณา Login + 2FA ใหม่เมื่อต้องการเข้าระบบต่อ");
      } else {
        setMessage("บันทึกการควบคุมความปลอดภัยแล้ว");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function lockdown() {
    if (!window.confirm("ยืนยัน EMERGENCY LOCKDOWN (ปิดระบบฉุกเฉิน)? ระบบจะปิดการสร้างวิดีโอ, AI Agent, LLM, Wallet/Payment, Queue และยกเลิก Session เดิมทั้งหมดทันที")) return;
    await action({ action: "LOCKDOWN", reason: reason || "Emergency lockdown from Admin Security Center" });
  }

  async function restore() {
    const confirmation = window.prompt("พิมพ์ RESTORE SCENOVA เพื่อเปิดระบบกลับ หลังตรวจสอบและ Rotate Key (ออก Key ใหม่แทน Key ที่สงสัยว่ารั่ว) แล้ว");
    if (confirmation !== "RESTORE SCENOVA") return setMessage("ยกเลิกการเปิดระบบกลับ: ข้อความยืนยันไม่ตรง");
    await action({ action: "RESTORE", confirmation, reason: reason || "Admin verified incident and restored system" });
  }

  async function revokeSessions() {
    const confirmation = window.prompt("พิมพ์ REVOKE SESSIONS เพื่อบังคับ Logout ทุก Session เดิม");
    if (confirmation !== "REVOKE SESSIONS") return setMessage("ยกเลิกการบังคับ Logout ทุก Session");
    await action({ action: "REVOKE_SESSIONS", confirmation, reason: reason || "Emergency session revocation" });
  }

  async function saveControls() {
    await action({
      action: "UPDATE",
      reason,
      maintenanceMode: draft.maintenanceMode,
      generationDisabled: draft.generationDisabled,
      agentDisabled: draft.agentDisabled,
      llmDisabled: draft.llmDisabled,
      paymentDisabled: draft.paymentDisabled,
      newLoginRestricted: draft.newLoginRestricted,
      queuePaused: draft.queuePaused,
      emergencyRateLimitEnabled: draft.emergencyRateLimitEnabled,
      disabledProviderIds: draft.disabledProviderIds,
    });
  }

  function toggleProvider() {
    const id = providerInput.trim();
    if (!id) return;
    setDraft((current) => ({
      ...current,
      disabledProviderIds: current.disabledProviderIds.includes(id)
        ? current.disabledProviderIds.filter((item) => item !== id)
        : [...current.disabledProviderIds, id],
    }));
  }

  return (
    <main style={{ maxWidth: 1220, margin: "0 auto", padding: 28, color: "#f4f2e8" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 18, marginBottom: 18 }}>
        <div>
          <span style={eyebrow}>SCENOVA SECURITY — ความปลอดภัยระบบ</span>
          <h1 style={{ margin: "6px 0", fontSize: 28 }}>Emergency Security Center — ศูนย์ควบคุมฉุกเฉิน</h1>
          <p style={muted}>ใช้เมื่อสงสัยว่า API Key (รหัสเชื่อมบริการ), Session (สถานะ Login), หน้าเว็บ หรือ Provider (ผู้ให้บริการภายนอก) ถูกโจมตี</p>
        </div>
        <div style={{ ...pill, ...(state.lockdownEnabled ? dangerPill : goodPill) }}>{state.lockdownEnabled ? "🚨 LOCKDOWN ACTIVE — ปิดระบบฉุกเฉินอยู่" : "● SYSTEM NORMAL — ระบบปกติ"}</div>
      </header>

      <div style={{ ...notice, borderColor: state.environmentHardLock ? "#813434" : "#403a24" }}>
        <b>{message}</b>
        {state.reason ? <span style={{ display: "block", marginTop: 4 }}>เหตุผลล่าสุด: {state.reason}</span> : null}
        {state.environmentHardLock ? <span style={{ display: "block", marginTop: 5, color: "#ff9b9b" }}>Environment Hard Lock — ล็อกฉุกเฉินระดับ Server เปิดอยู่ ต้องแก้ Environment Variable (ค่าตั้งค่าฝั่ง Server) ก่อนจึงจะเปิดระบบกลับจากหน้าเว็บได้</span> : null}
      </div>

      <section style={{ ...card, borderColor: state.lockdownEnabled ? "#7c2b2b" : "#292929", marginTop: 14 }}>
        <div style={sectionHead}><div><span style={eyebrow}>ONE-TAP RESPONSE — ตัดระบบในคลิกเดียว</span><h2 style={heading}>Emergency Lockdown — ปิดระบบฉุกเฉิน</h2><p style={muted}>กดครั้งเดียวเพื่อหยุดระบบเสี่ยงทั้งหมด และบังคับยกเลิก Session เดิม</p></div></div>
        <textarea style={{ ...input, minHeight: 74 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ระบุเหตุผล เช่น พบการเรียก API ผิดปกติ / สงสัยว่า Key รั่ว / หน้าเว็บถูกโจมตี" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 10 }}>
          <button disabled={busy || state.lockdownEnabled} onClick={lockdown} style={{ ...button, ...dangerButton }}>🚨 EMERGENCY LOCKDOWN — ปิดระบบทันที</button>
          <button disabled={busy} onClick={revokeSessions} style={button}>Revoke All Sessions — บังคับ Logout ทุกคน</button>
          <button disabled={busy || !state.lockdownEnabled || state.environmentHardLock} onClick={restore} style={{ ...button, ...restoreButton }}>Restore After Verification — เปิดกลับหลังตรวจสอบ</button>
        </div>
        <p style={{ ...muted, marginTop: 10 }}>หลัง Lockdown ให้ Revoke Key (ยกเลิก Key เดิม) และ Rotate Key (ออก Key ใหม่) ที่ Provider โดยตรงก่อนเปิดระบบกลับ</p>
      </section>

      <section style={{ ...card, marginTop: 14 }}>
        <div style={sectionHead}>
          <div><span style={eyebrow}>CAPABILITY ISOLATION — แยกปิดความสามารถ</span><h2 style={heading}>แยกปิดระบบเป็นส่วน ๆ</h2><p style={muted}>ใช้เมื่อปัญหาเกิดเฉพาะบางส่วน ไม่จำเป็นต้องปิด SCENOVA ทั้งระบบ</p></div>
          <button disabled={busy || !hasChanges || state.lockdownEnabled} onClick={saveControls} style={{ ...button, ...primaryButton }}>Save Controls — บันทึกการตั้งค่า</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 9 }}>
          {CONTROL_ITEMS.map((item) => <label key={item.key} style={controlCard}><span><b style={{ display: "block", fontSize: 11 }}>{item.title}</b><small style={{ color: "#8b8b84", lineHeight: 1.45 }}>{item.help}</small></span><input type="checkbox" checked={draft[item.key]} disabled={state.lockdownEnabled} onChange={(e) => setDraft((current) => ({ ...current, [item.key]: e.target.checked }))} /></label>)}
        </div>
      </section>

      <section style={{ ...card, marginTop: 14 }}>
        <div style={sectionHead}><div><span style={eyebrow}>PROVIDER ISOLATION — แยกปิดผู้ให้บริการ</span><h2 style={heading}>ปิด Provider เฉพาะตัว</h2><p style={muted}>Provider คือบริการภายนอกที่ SCENOVA เรียกใช้งาน เช่น โมเดลสร้างวิดีโอ ตัวอย่าง: byteplus-seedance-2.5</p></div></div>
        <div style={{ display: "flex", gap: 8 }}><input style={input} value={providerInput} onChange={(e) => setProviderInput(e.target.value)} /><button disabled={state.lockdownEnabled} onClick={toggleProvider} style={button}>{draft.disabledProviderIds.includes(providerInput.trim()) ? "Enable Provider — เปิดใช้งาน" : "Disable Provider — ปิดใช้งาน"}</button></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>{draft.disabledProviderIds.length ? draft.disabledProviderIds.map((id) => <span key={id} style={dangerPill}>⛔ {id}</span>) : <span style={goodPill}>✓ ไม่มี Provider ที่ถูกแยกปิด</span>}</div>
      </section>

      <section style={{ ...card, marginTop: 14 }}>
        <div style={sectionHead}><div><span style={eyebrow}>INCIDENT TRAIL — ประวัติเหตุการณ์</span><h2 style={heading}>Emergency Audit Log — บันทึกการกระทำฉุกเฉิน</h2><p style={muted}>Audit Log คือประวัติว่าใครสั่ง Lockdown, Restore, Revoke Session หรือแก้ Control เมื่อไร</p></div></div>
        <div>{events.length === 0 ? <p style={muted}>ยังไม่มีเหตุการณ์ฉุกเฉิน</p> : events.map((event) => <div key={event.id} style={logRow}><b>{event.action}</b><span>{new Date(event.createdAt).toLocaleString("th-TH")}</span></div>)}</div>
      </section>

      <section style={{ ...card, marginTop: 14 }}>
        <div style={sectionHead}><div><span style={eyebrow}>BASELINE — ค่าความปลอดภัยพื้นฐาน</span><h2 style={heading}>Security Defaults — ค่าป้องกันมาตรฐาน</h2><p style={muted}>ค่าที่ Server ใช้เป็นเพดานป้องกันการยิงงานหรือค่าใช้จ่ายสูงผิดปกติ</p></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8, marginBottom: 10 }}>
          <div style={metric}><span>Concurrent jobs/user — งานพร้อมกันต่อผู้ใช้</span><b>{DEFAULT_SECURITY_POLICY.maxConcurrentGenerationJobsPerUser}</b></div>
          <div style={metric}><span>Generate req/min/user — คำขอสร้างต่อนาที/ผู้ใช้</span><b>{DEFAULT_SECURITY_POLICY.maxGenerationRequestsPerMinutePerUser}</b></div>
          <div style={metric}><span>Hourly spend cap — เพดานค่าใช้จ่ายต่อชั่วโมง</span><b>{DEFAULT_SECURITY_POLICY.hourlyProviderSpendCapThb.toLocaleString()} THB</b></div>
          <div style={metric}><span>Daily spend cap — เพดานค่าใช้จ่ายต่อวัน</span><b>{DEFAULT_SECURITY_POLICY.dailyProviderSpendCapThb.toLocaleString()} THB</b></div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>{SECURITY_CHECKLIST_TH.map((item) => <div key={item} style={check}>✓ {item}</div>)}</div>
      </section>

      <section style={{ ...card, marginTop: 14 }}>
        <div style={sectionHead}><div><span style={eyebrow}>SECURITY GLOSSARY — คำศัพท์ความปลอดภัย</span><h2 style={heading}>ศัพท์เฉพาะในหน้านี้หมายถึงอะไร</h2><p style={muted}>เก็บคำอังกฤษไว้เพื่อให้ตรงกับมาตรฐานงานระบบ และอธิบายภาษาไทยกำกับทุกคำสำคัญ</p></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 8 }}>{SECURITY_TERMS.map(([term, meaning]) => <div key={term} style={termCard}><b>{term}</b><span>{meaning}</span></div>)}</div>
      </section>
    </main>
  );
}

const card: React.CSSProperties = { border: "1px solid #292929", borderRadius: 16, background: "#0e0e0e", padding: 17 };
const sectionHead: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, marginBottom: 10 };
const heading: React.CSSProperties = { fontSize: 18, margin: "4px 0 4px" };
const muted: React.CSSProperties = { color: "#92928b", fontSize: 10, lineHeight: 1.55, margin: 0 };
const eyebrow: React.CSSProperties = { color: "#f2c94c", fontSize: 9, fontWeight: 900, letterSpacing: ".13em" };
const input: React.CSSProperties = { width: "100%", border: "1px solid #303030", borderRadius: 10, background: "#080808", color: "#f4f2e8", padding: "10px 11px", fontSize: 11, outline: "none" };
const button: React.CSSProperties = { border: "1px solid #3b3b3b", borderRadius: 10, background: "#171717", color: "#eee", padding: "10px 13px", fontWeight: 850, fontSize: 10, cursor: "pointer" };
const primaryButton: React.CSSProperties = { background: "#f2c94c", borderColor: "#f2c94c", color: "#090909" };
const dangerButton: React.CSSProperties = { background: "#8f2525", borderColor: "#c94a4a", color: "#fff", fontSize: 11 };
const restoreButton: React.CSSProperties = { borderColor: "#315d3a", color: "#a6e5ae", background: "#112016" };
const notice: React.CSSProperties = { border: "1px solid #403a24", borderRadius: 12, background: "#17160f", padding: "11px 13px", color: "#dccc7a", fontSize: 10 };
const pill: React.CSSProperties = { borderRadius: 999, padding: "7px 10px", fontSize: 9, fontWeight: 900, whiteSpace: "nowrap" };
const goodPill: React.CSSProperties = { border: "1px solid #2d5736", background: "#102016", color: "#9dddab", borderRadius: 999, padding: "5px 8px", fontSize: 9, fontWeight: 800 };
const dangerPill: React.CSSProperties = { border: "1px solid #733535", background: "#251111", color: "#ff9c9c", borderRadius: 999, padding: "5px 8px", fontSize: 9, fontWeight: 800 };
const controlCard: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: "1px solid #252525", borderRadius: 11, background: "#090909", padding: 11 };
const logRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #222", padding: "8px 0", fontSize: 10, color: "#aaa" };
const metric: React.CSSProperties = { border: "1px solid #282828", borderRadius: 10, padding: 10, background: "#090909", display: "flex", justifyContent: "space-between", gap: 8, fontSize: 10 };
const check: React.CSSProperties = { border: "1px solid #233b28", background: "#101912", color: "#a6d8ad", borderRadius: 9, padding: "8px 10px", fontSize: 10 };
const termCard: React.CSSProperties = { border: "1px solid #2b2b2b", borderRadius: 10, background: "#090909", padding: 10, display: "grid", gap: 5 };
