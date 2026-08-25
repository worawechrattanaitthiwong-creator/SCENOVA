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

const CONTROL_ITEMS: Array<{ key: keyof Pick<EmergencyState, "maintenanceMode" | "generationDisabled" | "agentDisabled" | "llmDisabled" | "paymentDisabled" | "newLoginRestricted" | "queuePaused" | "emergencyRateLimitEnabled">; title: string; help: string }> = [
  { key: "maintenanceMode", title: "Maintenance Mode", help: "หยุดงาน Production ฝั่งผู้ใช้ชั่วคราว แต่ Admin ยังเข้าตรวจสอบระบบได้" },
  { key: "generationDisabled", title: "Video Generation", help: "ปิดการส่งงานใหม่และการเรียก Video Provider จริง" },
  { key: "agentDisabled", title: "AI Agent", help: "ห้ามสร้าง Agent Run ใหม่และหยุด Worker รับงาน" },
  { key: "llmDisabled", title: "LLM Calls", help: "ตัด OpenAI/LLM outbound call ทันทีที่ Backend guard" },
  { key: "paymentDisabled", title: "Wallet / Payment", help: "Freeze Reserve, Charge และ Refund ชั่วคราว" },
  { key: "newLoginRestricted", title: "Member Login", help: "ปิด Login สมาชิกใหม่ชั่วคราว โดย Admin ยัง Login เพื่อกู้ระบบได้" },
  { key: "queuePaused", title: "Agent Queue", help: "Worker จะไม่ Claim งานใหม่จนกว่าจะเปิดกลับ" },
  { key: "emergencyRateLimitEnabled", title: "Emergency Rate Profile", help: "สถานะเตือนให้ใช้ Rate Limit ฉุกเฉินร่วมกับการปิด capability สำคัญ" },
];

export default function AdminSecurityConsole() {
  const [state, setState] = useState<EmergencyState>(EMPTY);
  const [draft, setDraft] = useState<EmergencyState>(EMPTY);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [reason, setReason] = useState("");
  const [providerInput, setProviderInput] = useState("byteplus-seedance-2.5");
  const [message, setMessage] = useState("กำลังโหลดสถานะความปลอดภัย...");
  const [busy, setBusy] = useState(false);

  const hasChanges = useMemo(() => CONTROL_ITEMS.some(({ key }) => draft[key] !== state[key]) || JSON.stringify(draft.disabledProviderIds) !== JSON.stringify(state.disabledProviderIds), [draft, state]);

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
    setMessage("Emergency Security Center พร้อมใช้งาน");
  }

  useEffect(() => { void load(); }, []);

  async function action(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("กำลังอัปเดต Security Control...");
    try {
      const response = await fetch("/api/admin/security/emergency", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(data.error || "อัปเดตไม่สำเร็จ");
      if (data.state) { setState(data.state); setDraft(data.state); }
      if (data.sessionRevoked) {
        setMessage("Emergency action สำเร็จ — Session เดิมถูกยกเลิก กรุณา Login + 2FA ใหม่เมื่อต้องการเข้าระบบต่อ");
      } else {
        setMessage("บันทึก Security Control แล้ว");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function lockdown() {
    if (!window.confirm("ยืนยัน EMERGENCY LOCKDOWN? ระบบจะปิด Generation, Agent, LLM, Wallet/Payment, Queue และยกเลิก Session เดิมทั้งหมดทันที")) return;
    await action({ action: "LOCKDOWN", reason: reason || "Emergency lockdown from Admin Security Center" });
  }

  async function restore() {
    const confirmation = window.prompt("พิมพ์ RESTORE SCENOVA เพื่อเปิดระบบกลับ หลังตรวจสอบและ Rotate Key ที่สงสัยว่ารั่วแล้ว");
    if (confirmation !== "RESTORE SCENOVA") return setMessage("ยกเลิก Restore: ข้อความยืนยันไม่ตรง");
    await action({ action: "RESTORE", confirmation, reason: reason || "Admin verified incident and restored system" });
  }

  async function revokeSessions() {
    const confirmation = window.prompt("พิมพ์ REVOKE SESSIONS เพื่อบังคับ Logout ทุก Session เดิม");
    if (confirmation !== "REVOKE SESSIONS") return setMessage("ยกเลิกการ Revoke Session");
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
      disabledProviderIds: current.disabledProviderIds.includes(id) ? current.disabledProviderIds.filter((item) => item !== id) : [...current.disabledProviderIds, id],
    }));
  }

  return (
    <main style={{ maxWidth: 1220, margin: "0 auto", padding: 28, color: "#f4f2e8" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 18, marginBottom: 18 }}>
        <div><span style={eyebrow}>SCENOVA SECURITY</span><h1 style={{ margin: "6px 0", fontSize: 28 }}>Emergency Security Center</h1><p style={muted}>ศูนย์ตัดระบบฉุกเฉินฝั่ง Server — ใช้เมื่อสงสัยว่า API Key, Session, หน้าเว็บ หรือ Provider ถูกโจมตี</p></div>
        <div style={{ ...pill, ...(state.lockdownEnabled ? dangerPill : goodPill) }}>{state.lockdownEnabled ? "🚨 LOCKDOWN ACTIVE" : "● SYSTEM NORMAL"}</div>
      </header>

      <div style={{ ...notice, borderColor: state.environmentHardLock ? "#813434" : "#403a24" }}><b>{message}</b>{state.reason ? <span style={{ display: "block", marginTop: 4 }}>เหตุผลล่าสุด: {state.reason}</span> : null}{state.environmentHardLock ? <span style={{ display: "block", marginTop: 5, color: "#ff9b9b" }}>Environment Hard Lock เปิดอยู่ — ต้องแก้ Environment Variable ที่ Server ก่อน UI จึงจะเปิด capability กลับได้</span> : null}</div>

      <section style={{ ...card, borderColor: state.lockdownEnabled ? "#7c2b2b" : "#292929", marginTop: 14 }}>
        <div style={sectionHead}><div><span style={eyebrow}>ONE-TAP RESPONSE</span><h2 style={heading}>Emergency Lockdown</h2><p style={muted}>กดครั้งเดียวเพื่อปิด Generation + Agent + LLM + Wallet/Payment + Queue + Member Login และ Revoke Session เดิม</p></div></div>
        <textarea style={{ ...input, minHeight: 74 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ระบุเหตุผล เช่น พบ API traffic ผิดปกติ / สงสัยว่า Key รั่ว / หน้าเว็บถูกโจมตี" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 10 }}>
          <button disabled={busy || state.lockdownEnabled} onClick={lockdown} style={{ ...button, ...dangerButton }}>🚨 EMERGENCY LOCKDOWN</button>
          <button disabled={busy} onClick={revokeSessions} style={button}>Revoke All Sessions</button>
          <button disabled={busy || !state.lockdownEnabled || state.environmentHardLock} onClick={restore} style={{ ...button, ...restoreButton }}>Restore After Verification</button>
        </div>
        <p style={{ ...muted, marginTop: 10 }}>หลัง Lockdown ให้ Revoke/Rotate API Key ที่ Provider โดยตรงก่อน Restore เพราะ SCENOVA สามารถหยุดการใช้ Key ของเราได้ทันที แต่ไม่สามารถยกเลิก Key ที่ Provider แทนบัญชีเจ้าของโดยอัตโนมัติได้</p>
      </section>

      <section style={{ ...card, marginTop: 14 }}>
        <div style={sectionHead}><div><span style={eyebrow}>CAPABILITY ISOLATION</span><h2 style={heading}>แยกปิดระบบเป็นส่วน ๆ</h2><p style={muted}>ใช้เมื่อปัญหาเกิดเฉพาะบางระบบ เช่น ปิด LLM แต่ยังให้ผู้ใช้แก้ Project ต่อได้</p></div><button disabled={busy || !hasChanges || state.lockdownEnabled} onClick={saveControls} style={{ ...button, ...primaryButton }}>Save Controls</button></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 9 }}>
          {CONTROL_ITEMS.map((item) => <label key={item.key} style={controlCard}><span><b style={{ display: "block", fontSize: 11 }}>{item.title}</b><small style={{ color: "#8b8b84", lineHeight: 1.45 }}>{item.help}</small></span><input type="checkbox" checked={draft[item.key]} disabled={state.lockdownEnabled} onChange={(e) => setDraft((current) => ({ ...current, [item.key]: e.target.checked }))} /></label>)}
        </div>
      </section>

      <section style={{ ...card, marginTop: 14 }}>
        <div style={sectionHead}><div><span style={eyebrow}>PROVIDER ISOLATION</span><h2 style={heading}>ปิด Provider เฉพาะตัว</h2><p style={muted}>ตัวอย่าง Production Provider ปัจจุบัน: byteplus-seedance-2.5</p></div></div>
        <div style={{ display: "flex", gap: 8 }}><input style={input} value={providerInput} onChange={(e) => setProviderInput(e.target.value)} /><button disabled={state.lockdownEnabled} onClick={toggleProvider} style={button}>{draft.disabledProviderIds.includes(providerInput.trim()) ? "Enable Provider" : "Disable Provider"}</button></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>{draft.disabledProviderIds.length ? draft.disabledProviderIds.map((id) => <span key={id} style={dangerPill}>⛔ {id}</span>) : <span style={goodPill}>✓ ไม่มี Provider ที่ถูก isolate</span>}</div>
      </section>

      <section style={{ ...card, marginTop: 14 }}>
        <div style={sectionHead}><div><span style={eyebrow}>INCIDENT TRAIL</span><h2 style={heading}>Emergency Audit Log</h2><p style={muted}>ทุก Lockdown, Restore, Revoke Session และการปรับ Control ถูกบันทึกแยกใน Audit Log</p></div></div>
        <div>{events.length === 0 ? <p style={muted}>ยังไม่มี Emergency Event</p> : events.map((event) => <div key={event.id} style={logRow}><b>{event.action}</b><span>{new Date(event.createdAt).toLocaleString("th-TH")}</span></div>)}</div>
      </section>

      <section style={{ ...card, marginTop: 14 }}>
        <div style={sectionHead}><div><span style={eyebrow}>BASELINE</span><h2 style={heading}>Security Defaults</h2></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8, marginBottom: 10 }}>
          <div style={metric}><span>Concurrent jobs/user</span><b>{DEFAULT_SECURITY_POLICY.maxConcurrentGenerationJobsPerUser}</b></div>
          <div style={metric}><span>Generate req/min/user</span><b>{DEFAULT_SECURITY_POLICY.maxGenerationRequestsPerMinutePerUser}</b></div>
          <div style={metric}><span>Hourly spend cap</span><b>{DEFAULT_SECURITY_POLICY.hourlyProviderSpendCapThb.toLocaleString()} THB</b></div>
          <div style={metric}><span>Daily spend cap</span><b>{DEFAULT_SECURITY_POLICY.dailyProviderSpendCapThb.toLocaleString()} THB</b></div>
        </div>
        <div style={{ display: "grid", gap: 6 }}>{SECURITY_CHECKLIST_TH.map((item) => <div key={item} style={check}>✓ {item}</div>)}</div>
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
