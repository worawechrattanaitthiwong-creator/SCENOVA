"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SECURITY_POLICY, SECURITY_CHECKLIST_TH } from "@/lib/security";
import styles from "./admin-security-console.module.css";

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
  { key: "maintenanceMode", title: "Maintenance Mode — โหมดปิดปรับปรุง", help: "หยุดงาน Production ของสมาชิกชั่วคราว แต่ Admin ยังเข้าตรวจสอบและกู้ระบบได้" },
  { key: "generationDisabled", title: "Video Generation — การสร้างวิดีโอ", help: "หยุดการส่งงานสร้างวิดีโอใหม่และการเรียก Video Provider ภายนอก" },
  { key: "agentDisabled", title: "AI Agent — ผู้ช่วยอัตโนมัติ", help: "ห้ามเริ่ม Agent Run ใหม่ และไม่ให้ Worker รับขั้นตอน Agent เพิ่ม" },
  { key: "llmDisabled", title: "LLM Calls — การเรียกโมเดลภาษา", help: "หยุดการเรียก LLM จาก Server เพื่อตัดค่าใช้จ่ายหรือจำกัดเหตุผิดปกติ" },
  { key: "paymentDisabled", title: "Wallet / Payment — เครดิตและการชำระเงิน", help: "หยุด Reserve, Charge และ Refund ชั่วคราว" },
  { key: "newLoginRestricted", title: "Member Login — การเข้าสู่ระบบสมาชิก", help: "ปิด Login ของสมาชิกชั่วคราว แต่ Admin ยังเข้ากู้ระบบได้" },
  { key: "queuePaused", title: "Agent Queue — คิวงาน AI Agent", help: "พักคิวงาน Agent เพื่อไม่ให้ Worker หยิบงานใหม่ไปประมวลผล" },
  { key: "emergencyRateLimitEnabled", title: "Emergency Rate Limit — จำกัดคำขอฉุกเฉิน", help: "ใช้ Rate Limit ที่เข้มขึ้นเพื่อลด Bot หรือคำขอที่ยิงรัวผิดปกติ" },
];

const SECURITY_TERMS = [
  ["API Key", "รหัสลับที่อนุญาตให้ SCENOVA เรียกบริการภายนอก เช่น AI หรือ Video Provider"],
  ["Provider", "ผู้ให้บริการภายนอกที่ SCENOVA เชื่อมต่อ เช่น โมเดลวิดีโอ ภาพ หรือเสียง"],
  ["Session", "สถานะการเข้าสู่ระบบของผู้ใช้ เมื่อยกเลิก Session ผู้ใช้ต้อง Login ใหม่"],
  ["Rate Limit", "การจำกัดจำนวน Request ภายในช่วงเวลา เพื่อกัน Bot และการยิงคำขอรัว"],
  ["Kill Switch / Lockdown", "สวิตช์ฉุกเฉินสำหรับหยุดระบบสำคัญทันทีเมื่อพบความเสี่ยง"],
  ["Audit Log", "ประวัติว่าใครทำอะไร เมื่อไร และกับระบบส่วนใด เพื่อใช้ตรวจสอบย้อนหลัง"],
  ["Idempotency Key", "รหัสกันคำสั่งซ้ำ ช่วยป้องกันการตัดเครดิตหรือสร้างงานซ้ำ"],
  ["Signed URL", "ลิงก์ไฟล์ชั่วคราวที่มีวันหมดอายุ สำหรับเปิดไฟล์ Private โดยไม่ทำให้ไฟล์เป็นสาธารณะ"],
] as const;

export default function AdminSecurityConsole() {
  const [state, setState] = useState<EmergencyState>(EMPTY);
  const [draft, setDraft] = useState<EmergencyState>(EMPTY);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [reason, setReason] = useState("");
  const [providerInput, setProviderInput] = useState("seedance");
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
      setMessage(response.status === 403 ? "หน้านี้สำหรับ Administrator เท่านั้น หรือ Session ถูกยกเลิกแล้ว" : data.error || "โหลดสถานะไม่สำเร็จ");
      return;
    }
    setState(data.state || EMPTY);
    setDraft(data.state || EMPTY);
    setEvents(data.events || []);
    setMessage("Security Center พร้อมใช้งาน");
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
        setMessage("คำสั่งสำเร็จ — Session เดิมถูกยกเลิก กรุณา Login และยืนยัน 2FA ใหม่เมื่อต้องการเข้าระบบต่อ");
      } else {
        setMessage("บันทึกการควบคุมความปลอดภัยแล้ว");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function lockdown() {
    if (!window.confirm("ยืนยัน Emergency Lockdown? ระบบจะหยุด Video Generation, AI Agent, LLM, Wallet/Payment, Queue และยกเลิก Session เดิมทันที")) return;
    await action({ action: "LOCKDOWN", reason: reason || "Emergency lockdown from Admin Security Center" });
  }

  async function restore() {
    const confirmation = window.prompt("พิมพ์ RESTORE SCENOVA เพื่อเปิดระบบกลับ หลังตรวจสอบเหตุการณ์และ Rotate Key ที่เกี่ยวข้องแล้ว");
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
    <div className={styles.console}>
      <div className={styles.statusBar}>
        <div><b>{message}</b>{state.reason ? <span>เหตุผลล่าสุด: {state.reason}</span> : null}{state.environmentHardLock ? <span>Environment Hard Lock เปิดอยู่ ต้องแก้ค่าระดับ Server ก่อนเปิดระบบกลับ</span> : null}</div>
        <span className={state.lockdownEnabled ? styles.dangerPill : styles.goodPill}>{state.lockdownEnabled ? "LOCKDOWN ACTIVE" : "SYSTEM NORMAL"}</span>
      </div>

      <section className={`${styles.card} ${state.lockdownEnabled ? styles.dangerCard : ""}`}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>ONE-TAP RESPONSE</span><h2>Emergency Lockdown</h2><p>ใช้เมื่อพบความเสี่ยงร้ายแรงและต้องหยุดระบบสำคัญพร้อมยกเลิก Session เดิมทันที</p></div></div>
        <textarea className={styles.input} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="ระบุเหตุผล เช่น พบการเรียก API ผิดปกติ / สงสัยว่า Key รั่ว / หน้าเว็บถูกโจมตี" />
        <div className={styles.actions}>
          <button disabled={busy || state.lockdownEnabled} onClick={lockdown} className={styles.danger}>Emergency Lockdown</button>
          <button disabled={busy} onClick={revokeSessions} className={styles.button}>Revoke All Sessions</button>
          <button disabled={busy || !state.lockdownEnabled || state.environmentHardLock} onClick={restore} className={styles.restore}>Restore After Verification</button>
        </div>
        <p className={styles.help}>หลัง Lockdown ควรยกเลิก Key เดิมและออก Key ใหม่ที่ Provider ที่เกี่ยวข้องก่อนเปิดระบบกลับ</p>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>CAPABILITY ISOLATION</span><h2>แยกปิดความสามารถของระบบ</h2><p>ปิดเฉพาะส่วนที่มีปัญหาได้ โดยไม่จำเป็นต้อง Lockdown ทั้งระบบ</p></div><button disabled={busy || !hasChanges || state.lockdownEnabled} onClick={saveControls} className={styles.primary}>บันทึกการควบคุม</button></div>
        <div className={styles.controlGrid}>{CONTROL_ITEMS.map((item) => <label className={styles.controlCard} key={item.key}><span><b>{item.title}</b><small>{item.help}</small></span><input type="checkbox" checked={draft[item.key]} disabled={state.lockdownEnabled} onChange={(event) => setDraft((current) => ({ ...current, [item.key]: event.target.checked }))} /></label>)}</div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>PROVIDER ISOLATION</span><h2>ปิด Provider เฉพาะตัว</h2><p>ใส่ Provider ID ที่ต้องการหยุดชั่วคราว เช่น seedance, kling, veo, runway หรือ wan</p></div></div>
        <div className={styles.providerRow}><input className={styles.input} value={providerInput} onChange={(event) => setProviderInput(event.target.value)} /><button disabled={state.lockdownEnabled} onClick={toggleProvider} className={styles.button}>{draft.disabledProviderIds.includes(providerInput.trim()) ? "เปิด Provider" : "ปิด Provider"}</button></div>
        <div className={styles.pills}>{draft.disabledProviderIds.length ? draft.disabledProviderIds.map((id) => <span className={styles.dangerPill} key={id}>⛔ {id}</span>) : <span className={styles.goodPill}>✓ ไม่มี Provider ที่ถูกแยกปิด</span>}</div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>INCIDENT TRAIL</span><h2>Emergency Audit Log</h2><p>ตรวจประวัติ Lockdown, Restore, Revoke Session และการเปลี่ยน Control ย้อนหลัง</p></div></div>
        {events.length ? events.map((event) => <div className={styles.logRow} key={event.id}><b>{event.action}</b><span>{new Date(event.createdAt).toLocaleString("th-TH")}</span></div>) : <p className={styles.help}>ยังไม่มีเหตุการณ์ฉุกเฉิน</p>}
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>SECURITY BASELINE</span><h2>ค่าป้องกันมาตรฐาน</h2><p>เพดานที่ Server ใช้ป้องกันการยิงงานหรือค่าใช้จ่ายสูงผิดปกติ</p></div></div>
        <div className={styles.metricGrid}>
          <div className={styles.metric}><span>งานพร้อมกันต่อผู้ใช้</span><b>{DEFAULT_SECURITY_POLICY.maxConcurrentGenerationJobsPerUser}</b></div>
          <div className={styles.metric}><span>คำขอ Generate/นาที/ผู้ใช้</span><b>{DEFAULT_SECURITY_POLICY.maxGenerationRequestsPerMinutePerUser}</b></div>
          <div className={styles.metric}><span>เพดานค่าใช้จ่าย/ชั่วโมง</span><b>{DEFAULT_SECURITY_POLICY.hourlyProviderSpendCapThb.toLocaleString()} THB</b></div>
          <div className={styles.metric}><span>เพดานค่าใช้จ่าย/วัน</span><b>{DEFAULT_SECURITY_POLICY.dailyProviderSpendCapThb.toLocaleString()} THB</b></div>
        </div>
        <div className={styles.checkList}>{SECURITY_CHECKLIST_TH.map((item) => <div className={styles.check} key={item}>✓ {item}</div>)}</div>
      </section>

      <section className={styles.card}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>SECURITY GLOSSARY</span><h2>คำศัพท์ที่ใช้ในหน้านี้</h2><p>อธิบายคำสำคัญของระบบให้เข้าใจตรงกันก่อนใช้คำสั่งฉุกเฉิน</p></div></div>
        <div className={styles.termGrid}>{SECURITY_TERMS.map(([term, meaning]) => <div className={styles.term} key={term}><b>{term}</b><span>{meaning}</span></div>)}</div>
      </section>
    </div>
  );
}
