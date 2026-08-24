"use client";

import { useEffect, useState } from "react";

type Member = { id: string; name: string; email: string; role: string; active: boolean; createdAt: string };
type LibraryItem = { id: string; kind: string; title: string; description: string; assetUrl?: string };

export default function AdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [message, setMessage] = useState("");
  const [memberForm, setMemberForm] = useState({ name: "", email: "", password: "" });
  const [libraryForm, setLibraryForm] = useState({ kind: "images", title: "", description: "" });
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    const [memberRes, libraryRes] = await Promise.all([fetch("/api/admin/members", { cache: "no-store" }), fetch("/api/admin/library", { cache: "no-store" })]);
    if (memberRes.status === 403 || libraryRes.status === 403) { setMessage("หน้านี้สำหรับ Admin เท่านั้น กรุณาเข้าสู่ระบบด้วยบัญชี Admin"); return; }
    const memberData = await memberRes.json(); const libraryData = await libraryRes.json();
    setMembers(memberData.members || []); setItems(libraryData.items || []);
  }
  useEffect(() => { load(); }, []);

  async function createMember(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/admin/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(memberForm) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "สร้างสมาชิกไม่สำเร็จ");
    setMessage("สร้างสมาชิกแล้ว สมาชิกใช้บัญชีนี้เข้าสู่ระบบได้ทันทีใน Preview Server นี้");
    setMemberForm({ name: "", email: "", password: "" }); await load();
  }

  async function uploadLibrary(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const form = new FormData(); form.set("kind", libraryForm.kind); form.set("title", libraryForm.title); form.set("description", libraryForm.description); if (file) form.set("file", file);
    const response = await fetch("/api/admin/library", { method: "POST", body: form }); const data = await response.json();
    if (!response.ok) return setMessage(data.error || "เพิ่ม Library ไม่สำเร็จ");
    setMessage("เพิ่มรายการเข้า Library แล้ว"); setLibraryForm({ kind: "images", title: "", description: "" }); setFile(null); await load();
  }

  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: 28, color: "#f7f3ff", fontSize: 14 }}>
      <header style={{ marginBottom: 18 }}><span style={eyebrow}>ADMIN</span><h1 style={{ fontSize: 26, margin: "6px 0" }}>หลังบ้าน SCENOVA</h1><p style={muted}>Admin เป็นผู้สร้างสมาชิกทั้งหมด และเป็นผู้เพิ่มภาพ ตัวละคร สัตว์ เสียง บรรยากาศ และพล็อตเข้า Library กลาง</p></header>
      {message ? <div style={{ ...card, color: "#d8c6ff", marginBottom: 14 }}>{message}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,.8fr) minmax(480px,1.2fr)", gap: 14 }}>
        <section style={card}>
          <h2 style={heading}>สร้างสมาชิกใหม่</h2><p style={muted}>ไม่มีปุ่มสมัครสมาชิกหน้าเว็บ Admin สร้างบัญชีแล้วส่งอีเมล/รหัสผ่านให้ผู้ใช้เอง</p>
          <form onSubmit={createMember}>
            <Field label="ชื่อสมาชิก"><input style={input} value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} required /></Field>
            <Field label="อีเมล"><input style={input} type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} required /></Field>
            <Field label="รหัสผ่านเริ่มต้น"><input style={input} type="password" minLength={8} value={memberForm.password} onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })} required /></Field>
            <button style={primary}>＋ สร้างสมาชิก</button>
          </form>
          <div style={{ marginTop: 18 }}><b style={{ fontSize: 12 }}>สมาชิกใน Preview Server</b>{members.length === 0 ? <p style={muted}>ยังไม่มีสมาชิกที่ Admin สร้าง</p> : members.map((member) => <div key={member.id} style={listRow}><span><b style={{ display: "block", fontSize: 11 }}>{member.name}</b><small style={{ color: "#8f849f" }}>{member.email}</small></span><span style={{ color: "#9be8ca", fontSize: 10 }}>ACTIVE</span></div>)}</div>
        </section>

        <section style={card}>
          <h2 style={heading}>เพิ่มของเข้า Library</h2><p style={muted}>อัปโหลด Asset ต้นฉบับหรือสร้างรายการ Metadata ก่อนก็ได้ ไฟล์ใน Preview จะเก็บใน local server; Production จะเปลี่ยนไปใช้ Private Object Storage</p>
          <form onSubmit={uploadLibrary}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="ประเภท"><select style={input} value={libraryForm.kind} onChange={(e) => setLibraryForm({ ...libraryForm, kind: e.target.value })}><option value="images">คลังภาพ</option><option value="voices">คลังเสียง</option><option value="characters">คลังตัวละคร</option><option value="pets">คลังสัตว์เลี้ยง / Creature</option><option value="ambience">คลังบรรยากาศ</option><option value="plots">คลังพล็อตเรื่อง</option></select></Field>
              <Field label="ชื่อ"><input style={input} value={libraryForm.title} onChange={(e) => setLibraryForm({ ...libraryForm, title: e.target.value })} required /></Field>
            </div>
            <Field label="คำอธิบาย"><textarea style={{ ...input, minHeight: 78 }} value={libraryForm.description} onChange={(e) => setLibraryForm({ ...libraryForm, description: e.target.value })} /></Field>
            <Field label="ไฟล์ (ไม่เกิน 10MB)"><input style={input} type="file" accept="image/*,audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
            <button style={primary}>↑ เพิ่มเข้า Library</button>
          </form>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8 }}>{items.slice(0, 12).map((item) => <div key={item.id} style={{ padding: 10, borderRadius: 11, border: "1px solid rgba(171,120,255,.12)", background: "#09060e" }}>{item.assetUrl ? <img src={item.assetUrl} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} /> : null}<b style={{ display: "block", fontSize: 11 }}>{item.title}</b><small style={{ color: "#8f849f" }}>{item.kind}</small></div>)}</div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: "block", fontSize: 11, fontWeight: 750, marginBottom: 10 }}>{label}<div style={{ marginTop: 5 }}>{children}</div></label>; }
const card: React.CSSProperties = { border: "1px solid rgba(171,120,255,.16)", borderRadius: 17, background: "linear-gradient(180deg,#151021,#0d0914)", padding: 17 };
const input: React.CSSProperties = { width: "100%", borderRadius: 10, border: "1px solid rgba(171,120,255,.18)", background: "#09060e", color: "#f7f3ff", padding: "9px 10px", fontSize: 12, outline: "none" };
const primary: React.CSSProperties = { border: 0, borderRadius: 10, padding: "10px 13px", background: "linear-gradient(135deg,#7135f2,#b85cff)", color: "white", fontWeight: 800, fontSize: 11, cursor: "pointer" };
const heading: React.CSSProperties = { fontSize: 17, margin: "0 0 5px" };
const muted: React.CSSProperties = { color: "#9c91ad", fontSize: 11, lineHeight: 1.6, margin: "0 0 14px" };
const eyebrow: React.CSSProperties = { color: "#b994ed", fontSize: 10, fontWeight: 850, letterSpacing: ".12em" };
const listRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(171,120,255,.1)" };
