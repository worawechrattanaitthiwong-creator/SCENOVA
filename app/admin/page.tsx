"use client";

import Link from "next/link";
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
    if (memberRes.status === 403 || libraryRes.status === 403) { setMessage("หน้านี้สำหรับ Admin เท่านั้น"); return; }
    const memberData = await memberRes.json(); const libraryData = await libraryRes.json();
    setMembers(memberData.members || []); setItems(libraryData.items || []);
  }
  useEffect(() => { load(); }, []);

  async function createMember(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/admin/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(memberForm) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "สร้างสมาชิกไม่สำเร็จ");
    setMessage("สร้างสมาชิกเรียบร้อยแล้ว"); setMemberForm({ name: "", email: "", password: "" }); await load();
  }

  async function uploadLibrary(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const form = new FormData(); form.set("kind", libraryForm.kind); form.set("title", libraryForm.title); form.set("description", libraryForm.description); if (file) form.set("file", file);
    const response = await fetch("/api/admin/library", { method: "POST", body: form }); const data = await response.json();
    if (!response.ok) return setMessage(data.error || "เพิ่ม Library ไม่สำเร็จ");
    setMessage("เพิ่มรายการเข้า Library แล้ว"); setLibraryForm({ kind: "images", title: "", description: "" }); setFile(null); await load();
  }

  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: 30, color: "#f5f5ef" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "end", marginBottom: 18 }}>
        <div><span style={eyebrow}>ADMIN CONTROL</span><h1 style={{ fontSize: 28, margin: "7px 0 5px" }}>หลังบ้าน SCENOVA</h1><p style={muted}>จัดการสมาชิกและ Asset กลางจากจุดเดียว สมาชิกไม่สามารถสมัครเองได้</p></div>
        <Link href="/libraries" style={{ color: "#0a0a0a", background: "#f2c94c", borderRadius: 9, padding: "9px 12px", textDecoration: "none", fontWeight: 850, fontSize: 10 }}>เปิดคลัง</Link>
      </header>
      {message ? <div style={{ ...notice, marginBottom: 14 }}>{message}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,.8fr) minmax(480px,1.2fr)", gap: 14 }}>
        <section style={card}>
          <div style={sectionHead}><div><span style={eyebrow}>MEMBERS</span><h2 style={heading}>สร้างสมาชิกใหม่</h2></div><small style={count}>{members.length} คน</small></div>
          <p style={muted}>Admin สร้างบัญชีแล้วส่งอีเมลและรหัสผ่านให้ผู้ใช้ ไม่มี Public Sign-up</p>
          <form onSubmit={createMember}>
            <Field label="ชื่อสมาชิก"><input style={input} value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} required /></Field>
            <Field label="อีเมล"><input style={input} type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} required /></Field>
            <Field label="รหัสผ่านเริ่มต้น"><input style={input} type="password" minLength={8} value={memberForm.password} onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })} required /></Field>
            <button style={primary}>＋ สร้างสมาชิก</button>
          </form>
          <div style={{ marginTop: 18 }}>{members.length === 0 ? <p style={muted}>ยังไม่มีสมาชิกที่ Admin สร้าง</p> : members.map((member) => <div key={member.id} style={listRow}><span><b style={{ display: "block", fontSize: 11 }}>{member.name}</b><small style={{ color: "#777771" }}>{member.email}</small></span><span style={{ color: "#d9c45f", fontSize: 9, fontWeight: 850 }}>ACTIVE</span></div>)}</div>
        </section>

        <section style={card}>
          <div style={sectionHead}><div><span style={eyebrow}>LIBRARY</span><h2 style={heading}>เพิ่ม Asset เข้าคลังกลาง</h2></div><small style={count}>{items.length} รายการ</small></div>
          <p style={muted}>เลือกประเภท ตั้งชื่อ อธิบายสั้น ๆ และอัปโหลดไฟล์ จากนั้นผู้ใช้จะเห็นใน Library Hub เดียวกัน</p>
          <form onSubmit={uploadLibrary}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="ประเภท"><select style={input} value={libraryForm.kind} onChange={(e) => setLibraryForm({ ...libraryForm, kind: e.target.value })}><option value="images">ภาพ & สไตล์</option><option value="voices">เสียง</option><option value="characters">ตัวละคร</option><option value="pets">สัตว์ / Creature</option><option value="ambience">บรรยากาศ / SFX</option><option value="plots">พล็อตเรื่อง</option></select></Field>
              <Field label="ชื่อ"><input style={input} value={libraryForm.title} onChange={(e) => setLibraryForm({ ...libraryForm, title: e.target.value })} required /></Field>
            </div>
            <Field label="คำอธิบาย"><textarea style={{ ...input, minHeight: 78 }} value={libraryForm.description} onChange={(e) => setLibraryForm({ ...libraryForm, description: e.target.value })} /></Field>
            <Field label="ไฟล์ (ไม่เกิน 10MB)"><input style={input} type="file" accept="image/*,audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
            <button style={primary}>↑ เพิ่มเข้า Library</button>
          </form>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>{items.slice(0, 10).map((item) => <div key={item.id} style={assetCard}>{item.assetUrl ? <img src={item.assetUrl} alt="" style={{ width: "100%", height: 86, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} /> : <div style={{ height: 52, borderRadius: 8, background: "#17160f", display: "grid", placeItems: "center", color: "#f2c94c", marginBottom: 8 }}>▦</div>}<b style={{ display: "block", fontSize: 10 }}>{item.title}</b><small style={{ color: "#777771" }}>{item.kind}</small></div>)}</div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: "block", fontSize: 10, fontWeight: 800, marginBottom: 10 }}>{label}<div style={{ marginTop: 5 }}>{children}</div></label>; }
const card: React.CSSProperties = { border: "1px solid #242424", borderRadius: 16, background: "#0f0f0f", padding: 17 };
const input: React.CSSProperties = { width: "100%", borderRadius: 10, border: "1px solid #292929", background: "#090909", color: "#f5f5ef", padding: "9px 10px", fontSize: 11, outline: "none" };
const primary: React.CSSProperties = { border: "1px solid #f2c94c", borderRadius: 10, padding: "10px 13px", background: "#f2c94c", color: "#0a0a0a", fontWeight: 900, fontSize: 10, cursor: "pointer" };
const heading: React.CSSProperties = { fontSize: 17, margin: "4px 0 0" };
const muted: React.CSSProperties = { color: "#898983", fontSize: 10, lineHeight: 1.6, margin: "0 0 14px" };
const eyebrow: React.CSSProperties = { color: "#f2c94c", fontSize: 9, fontWeight: 900, letterSpacing: ".12em" };
const listRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid #202020" };
const assetCard: React.CSSProperties = { padding: 9, borderRadius: 11, border: "1px solid #242424", background: "#090909" };
const notice: React.CSSProperties = { border: "1px solid #3b351e", borderRadius: 11, background: "#17160f", color: "#d9c45f", padding: "10px 12px", fontSize: 10 };
const sectionHead: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10, marginBottom: 6 };
const count: React.CSSProperties = { color: "#777771", fontSize: 9 };
