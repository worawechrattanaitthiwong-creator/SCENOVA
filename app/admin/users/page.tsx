"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./users.module.css";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "MEMBER";
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  twoFactorEnabled: boolean;
  balance: { paid: number; bonus: number; reserved: number; available: number };
  suspendedUntil: string | null;
  suspensionReason: string | null;
  restriction: string | null;
};

type ActivityItem = { id: string; kind: string; title: string; detail: string; createdAt: string };

function when(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminUsersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [logs, setLogs] = useState<ActivityItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "" });
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "", creditDelta: "", suspendMinutes: "", reason: "" });

  const selected = useMemo(() => members.find((member) => member.id === selectedId) || null, [members, selectedId]);

  async function loadMembers(preferredId?: string) {
    const response = await fetch("/api/admin/members", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      setMessage(response.status === 403 ? "หน้านี้สำหรับ Administrator เท่านั้น" : data.error || "โหลดสมาชิกไม่สำเร็จ");
      return;
    }
    const nextMembers: Member[] = data.members || [];
    setMembers(nextMembers);
    const nextId = preferredId || selectedId || nextMembers[0]?.id || "";
    setSelectedId(nextId);
  }

  async function loadLogs(userId: string) {
    if (!userId) { setLogs([]); return; }
    const response = await fetch(`/api/admin/members/logs?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
    const data = await response.json();
    setLogs(response.ok ? data.items || [] : []);
  }

  useEffect(() => { loadMembers(); }, []);
  useEffect(() => {
    if (!selected) return;
    setEditForm({ name: selected.name, email: selected.email, password: "", creditDelta: "", suspendMinutes: "", reason: selected.suspensionReason || "" });
    loadLogs(selected.id);
  }, [selected?.id]);

  async function mutate(body: Record<string, unknown>, success: string) {
    if (!selected) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/members", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, ...body }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || "ดำเนินการไม่สำเร็จ"); return; }
      setMessage(success);
      await loadMembers(selected.id);
      await loadLogs(selected.id);
    } finally { setBusy(false); }
  }

  async function createMember(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(createForm) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || "สร้างสมาชิกไม่สำเร็จ"); return; }
      setCreateForm({ name: "", email: "", password: "" });
      setMessage("สร้างบัญชีสมาชิกเรียบร้อยแล้ว");
      await loadMembers(data.member?.id);
    } finally { setBusy(false); }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    await mutate({ name: editForm.name, email: editForm.email, password: editForm.password || undefined }, "บันทึกข้อมูลบัญชีแล้ว");
    setEditForm((value) => ({ ...value, password: "" }));
  }

  async function adjustCredits() {
    const delta = Math.trunc(Number(editForm.creditDelta));
    if (!delta) return setMessage("ใส่จำนวนเครดิตที่ต้องการปรับ เช่น 500 หรือ -100");
    await mutate({ creditDelta: delta }, `ปรับเครดิต ${delta > 0 ? "+" : ""}${delta} เรียบร้อยแล้ว`);
    setEditForm((value) => ({ ...value, creditDelta: "" }));
  }

  async function suspend(minutes: number) {
    if (!selected) return;
    const label = minutes < 60 ? `${minutes} นาที` : minutes < 1440 ? `${minutes / 60} ชั่วโมง` : `${minutes / 1440} วัน`;
    if (!window.confirm(`ระงับ ${selected.email} เป็นเวลา ${label} ใช่หรือไม่?`)) return;
    await mutate({ suspendMinutes: minutes, suspensionReason: editForm.reason || "Admin suspension" }, `ระงับการใช้งาน ${label} แล้ว`);
  }

  async function suspendCustom() {
    const minutes = Math.max(1, Math.trunc(Number(editForm.suspendMinutes)));
    if (!Number.isFinite(minutes)) return setMessage("กรุณาระบุจำนวนนาทีที่ถูกต้อง");
    await suspend(minutes);
  }

  async function blockForever() {
    if (!selected || !window.confirm(`บล็อกบัญชี ${selected.email} จนกว่า Admin จะปลดเองใช่หรือไม่?`)) return;
    await mutate({ active: false, suspensionReason: editForm.reason || "Admin block" }, "บล็อกบัญชีแล้ว");
  }

  async function unblock() {
    if (!selected) return;
    await mutate({ active: true }, "ปลดบล็อกและเปิดใช้งานบัญชีแล้ว");
  }

  async function deleteMember() {
    if (!selected) return;
    const typed = window.prompt(`การลบจะลบข้อมูล Project/Job/Wallet ที่ผูกกับบัญชีตาม Database relation\nพิมพ์ DELETE เพื่อยืนยันการลบ ${selected.email}`);
    if (typed !== "DELETE") return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/members", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || "ลบบัญชีไม่สำเร็จ"); return; }
      setMessage(`ลบบัญชี ${selected.email} แล้ว`);
      setSelectedId(""); setLogs([]); await loadMembers();
    } finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}>USER CONTROL CENTER</span><h1>จัดการผู้ใช้และสิทธิ์การใช้งาน</h1><p>สร้าง แก้ไข รีเซ็ตรหัสผ่าน ปรับเครดิต ระงับเป็นนาที/ชั่วโมง/วัน บล็อกถาวร ปลดบล็อก ลบบัญชี และตรวจ Activity Log รายคนจากจุดเดียว</p></div>
      <div className={styles.heroActions}><Link href="/guide" className={styles.ghost}>คู่มือ Admin</Link><Link href="/admin" className={styles.ghost}>Admin Console</Link></div>
    </header>
    {message ? <div className={styles.notice}>{message}</div> : null}

    <div className={styles.layout}>
      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span className={styles.eyebrow}>MEMBERS</span><h2>บัญชีผู้ใช้</h2></div><span className={styles.count}>{members.length} คน</span></div>
        <form className={styles.create} onSubmit={createMember}>
          <div className={styles.grid2}><label className={styles.field}><span>ชื่อ</span><input className={styles.input} value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required /></label><label className={styles.field}><span>อีเมล</span><input className={styles.input} type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required /></label></div>
          <label className={styles.field}><span>รหัสผ่านเริ่มต้น</span><input className={styles.input} type="password" minLength={8} value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required /></label>
          <button className={styles.button} disabled={busy}>＋ เพิ่มผู้ใช้</button>
        </form>
        <div className={styles.memberList}>{members.length ? members.map((member) => <button key={member.id} className={`${styles.member} ${selectedId === member.id ? styles.selected : ""}`} onClick={() => setSelectedId(member.id)}>
          <span><b>{member.name}</b><small>{member.email}</small></span><span className={styles.pills}><i className={`${styles.pill} ${member.active ? styles.active : styles.blocked}`}>{member.active ? "ACTIVE" : "BLOCKED"}</i>{member.twoFactorEnabled ? <i className={styles.pill}>2FA</i> : null}</span>
        </button>) : <div className={styles.empty}>ยังไม่มีสมาชิก</div>}</div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span className={styles.eyebrow}>ACCOUNT</span><h2>{selected ? selected.name : "เลือกผู้ใช้"}</h2></div>{selected ? <span className={`${styles.count}`}>{selected.active ? "ใช้งานได้" : "ถูกระงับ"}</span> : null}</div>
        {selected ? <div className={styles.editor}>
          <div className={styles.summary}>
            <div className={styles.metric}><small>เครดิตพร้อมใช้</small><b><strong>{selected.balance.available.toLocaleString("th-TH")}</strong></b></div>
            <div className={styles.metric}><small>เครดิตสำรอง</small><b>{selected.balance.reserved.toLocaleString("th-TH")}</b></div>
            <div className={styles.metric}><small>เข้าสู่ระบบล่าสุด</small><b>{when(selected.lastLoginAt)}</b></div>
            <div className={styles.metric}><small>ระงับถึง</small><b>{when(selected.suspendedUntil)}</b></div>
          </div>

          <form onSubmit={saveProfile}>
            <div className={styles.grid2}><label className={styles.field}><span>ชื่อผู้ใช้</span><input className={styles.input} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></label><label className={styles.field}><span>อีเมล</span><input className={styles.input} type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></label></div>
            <label className={styles.field}><span>ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</span><input className={styles.input} type="password" minLength={8} value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="อย่างน้อย 8 ตัวอักษร" /></label>
            <button className={styles.button} disabled={busy}>บันทึกข้อมูล / รีเซ็ตรหัสผ่าน</button>
          </form>

          <div className={styles.section}><h3>เครดิต</h3><div className={styles.creditRow}><input className={styles.input} inputMode="numeric" value={editForm.creditDelta} onChange={(e) => setEditForm({ ...editForm, creditDelta: e.target.value })} placeholder="+500 เพิ่ม / -100 หัก" /><button className={styles.button} type="button" onClick={adjustCredits} disabled={busy}>ปรับเครดิต</button></div></div>

          <div className={styles.section}><h3>ระงับ / บล็อกการใช้งาน</h3><label className={styles.field}><span>เหตุผล (บันทึกลง Log)</span><input className={styles.input} value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} placeholder="เช่น ตรวจสอบการใช้งานผิดปกติ" /></label><div className={styles.quickBlock}><button onClick={() => suspend(15)}>15 นาที</button><button onClick={() => suspend(60)}>1 ชั่วโมง</button><button onClick={() => suspend(1440)}>1 วัน</button><button onClick={() => suspend(10080)}>7 วัน</button><button onClick={blockForever}>บล็อกจนกว่าจะปลด</button></div><div className={styles.creditRow} style={{ marginTop: 8 }}><input className={styles.input} inputMode="numeric" value={editForm.suspendMinutes} onChange={(e) => setEditForm({ ...editForm, suspendMinutes: e.target.value })} placeholder="ระบุจำนวนนาทีเอง" /><button className={styles.ghost} onClick={suspendCustom} type="button">ระงับตามนาที</button></div>{!selected.active ? <div className={styles.actions} style={{ marginTop: 8 }}><button className={styles.button} onClick={unblock} type="button">ปลดบล็อกทันที</button></div> : null}</div>

          <div className={`${styles.section} ${styles.dangerZone}`}><h3>Danger Zone</h3><p style={{ color: "#9c8e9f", fontSize: 12 }}>การลบบัญชีเป็นการลบจริงและอาจ cascade ไปยังข้อมูลที่ผูกกับ User ตาม schema ระบบจะขอให้พิมพ์ DELETE ยืนยันก่อนทุกครั้ง</p><button className={styles.danger} onClick={deleteMember} type="button" disabled={busy}>ลบบัญชีผู้ใช้นี้</button></div>
        </div> : <div className={styles.empty}>เลือกบัญชีจากรายการด้านซ้ายเพื่อจัดการ</div>}
      </section>
    </div>

    <section className={`${styles.panel} ${styles.logPanel}`}>
      <div className={styles.panelHead}><div><span className={styles.eyebrow}>ACTIVITY LOG</span><h2>Log การใช้งานของผู้ใช้</h2></div><span className={styles.count}>{logs.length} รายการล่าสุด</span></div>
      <div className={styles.logs}>{selected ? logs.length ? logs.map((log) => <article className={styles.log} key={log.id}><time>{when(log.createdAt)}</time><span className={styles.logKind}>{log.kind}</span><div><b>{log.title}</b>{log.detail ? <p>{log.detail}</p> : null}</div></article>) : <div className={styles.empty}>ยังไม่มี Activity Log สำหรับบัญชีนี้</div> : <div className={styles.empty}>เลือกผู้ใช้เพื่อดู Log</div>}</div>
    </section>
  </main>;
}
