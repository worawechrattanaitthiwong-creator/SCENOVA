"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Member = { id: string; name: string; email: string; role: string; active: boolean; createdAt: string; twoFactorEnabled?: boolean };
type LibraryMetadata = { visualLanguage?: string; lighting?: string; colorMood?: string; bestFor?: string; promptHint?: string; referenceUsage?: string; compatibility?: string; lockNote?: string };
type LibraryItem = { id: string; kind: string; title: string; description: string; assetUrl?: string; source?: "SYSTEM" | "ADMIN"; metadata?: LibraryMetadata; createdAt?: string };

const KIND_LABEL: Record<string, string> = {
  images: "ภาพ & สไตล์",
  voices: "เสียง",
  characters: "ตัวละคร",
  pets: "สัตว์ / Creature",
  ambience: "บรรยากาศ / SFX",
  plots: "พล็อตเรื่อง",
};

const emptyLibraryForm = {
  kind: "images",
  title: "",
  description: "",
  visualLanguage: "",
  lighting: "",
  colorMood: "",
  bestFor: "",
  promptHint: "",
  referenceUsage: "",
  compatibility: "",
  lockNote: "",
};

export default function AdminPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [memberForm, setMemberForm] = useState({ name: "", email: "", password: "" });
  const [libraryForm, setLibraryForm] = useState(emptyLibraryForm);
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    const [memberRes, libraryRes] = await Promise.all([fetch("/api/admin/members", { cache: "no-store" }), fetch("/api/admin/library", { cache: "no-store" })]);
    if (memberRes.status === 403 || libraryRes.status === 403) { setMessage("หน้านี้สำหรับ Admin เท่านั้น"); return; }
    const memberData = await memberRes.json();
    const libraryData = await libraryRes.json();
    setMembers(memberData.members || []);
    setItems(libraryData.items || []);
    if (!libraryRes.ok) setMessage(libraryData.error || "โหลดคลังไม่สำเร็จ");
  }
  useEffect(() => { load(); }, []);

  const currentItems = useMemo(() => items.filter((item) => item.kind === libraryForm.kind), [items, libraryForm.kind]);
  const systemCount = currentItems.filter((item) => item.source === "SYSTEM").length;
  const adminCount = currentItems.filter((item) => item.source !== "SYSTEM").length;

  async function createMember(event: React.FormEvent) {
    event.preventDefault(); setMessage("");
    const response = await fetch("/api/admin/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(memberForm) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || "สร้างสมาชิกไม่สำเร็จ");
    setMessage("สร้างสมาชิกเรียบร้อยแล้ว"); setMemberForm({ name: "", email: "", password: "" }); await load();
  }

  async function uploadLibrary(event: React.FormEvent) {
    event.preventDefault(); setMessage(""); setBusy(true);
    const form = new FormData();
    Object.entries(libraryForm).forEach(([key, value]) => form.set(key, value));
    if (file) form.set("file", file);
    try {
      const response = await fetch("/api/admin/library", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error || "เพิ่ม Library ไม่สำเร็จ");
      setMessage(`เพิ่ม ${libraryForm.title} เข้า Library แล้ว`);
      setLibraryForm({ ...emptyLibraryForm, kind: libraryForm.kind });
      setFile(null);
      await load();
    } finally { setBusy(false); }
  }

  async function deleteAsset(item: LibraryItem) {
    const confirmed = window.confirm(`ลบ “${item.title}” ออกจาก Library ใช่หรือไม่?\n\nรายการนี้จะหายจากคลังผู้ใช้ทันที แต่ไฟล์ระบบต้นฉบับจะไม่ถูกลบถ้าเป็น SCENOVA System Asset`);
    if (!confirmed) return;
    setMessage(""); setBusy(true);
    try {
      const response = await fetch("/api/admin/library", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, assetUrl: item.assetUrl }) });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error || "ลบ Asset ไม่สำเร็จ");
      setMessage(`ลบ ${item.title} ออกจาก Library แล้ว`);
      await load();
    } finally { setBusy(false); }
  }

  return (
    <main style={{ maxWidth: 1420, margin: "0 auto", padding: 30, color: "#f5f5ef" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "end", marginBottom: 18 }}>
        <div><span style={eyebrow}>ADMIN CONTROL</span><h1 style={{ fontSize: 28, margin: "7px 0 5px" }}>หลังบ้าน SCENOVA</h1><p style={muted}>จัดการสมาชิกและ Asset กลางจากจุดเดียว รายการที่เห็นด้านล่างคือคลังจริงที่ผู้ใช้เห็นใน Asset Library</p></div>
        <div style={{ display: "flex", gap: 8 }}><Link href="/profile" style={secondaryLink}>ความปลอดภัย / 2FA</Link><Link href="/libraries" style={primaryLink}>เปิดคลังจริง →</Link></div>
      </header>
      {message ? <div style={{ ...notice, marginBottom: 14 }}>{message}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,.72fr) minmax(620px,1.48fr)", gap: 14 }}>
        <section style={card}>
          <div style={sectionHead}><div><span style={eyebrow}>MEMBERS</span><h2 style={heading}>สร้างสมาชิกใหม่</h2></div><small style={count}>{members.length} คน</small></div>
          <p style={muted}>Admin สร้างบัญชีแล้วส่งอีเมลและรหัสผ่านให้ผู้ใช้ ไม่มี Public Sign-up สมาชิกเปิด Authenticator เพิ่มได้จาก Profile</p>
          <form onSubmit={createMember}>
            <Field label="ชื่อสมาชิก"><input style={input} value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} required /></Field>
            <Field label="อีเมล"><input style={input} type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} required /></Field>
            <Field label="รหัสผ่านเริ่มต้น"><input style={input} type="password" minLength={8} value={memberForm.password} onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })} required /></Field>
            <button style={primary}>＋ สร้างสมาชิก</button>
          </form>
          <div style={{ marginTop: 18 }}>{members.length === 0 ? <p style={muted}>ยังไม่มีสมาชิกที่ Admin สร้าง</p> : members.map((member) => <div key={member.id} style={listRow}><span><b style={{ display: "block", fontSize: 11 }}>{member.name}</b><small style={{ color: "#777771" }}>{member.email}</small></span><span style={{ display: "flex", gap: 6, alignItems: "center" }}><i style={{ ...statusPill, ...(member.twoFactorEnabled ? statusSecure : {}) }}>{member.twoFactorEnabled ? "2FA" : "PASSWORD"}</i><i style={statusPill}>ACTIVE</i></span></div>)}</div>
        </section>

        <section style={card}>
          <div style={sectionHead}><div><span style={eyebrow}>LIVE LIBRARY</span><h2 style={heading}>จัดการ Asset ในคลังจริง</h2></div><small style={count}>{items.length} รายการทั้งหมด</small></div>
          <p style={muted}>Asset ทุกชิ้นใช้ชื่อ SCENOVA System เหมือนกัน โดยใช้สีแยกแหล่งที่มาเท่านั้น: สีทองคือรายการ Built-in ของระบบ และสีเขียวคือรายการที่ Admin Upload เอง</p>

          <div style={summaryBar}>
            <span><b>{KIND_LABEL[libraryForm.kind]}</b><small>{currentItems.length} รายการในหมวดนี้</small></span>
            <span><b style={{ color: "#e1c95e" }}>{systemCount}</b><small>สีทอง • Built-in</small></span>
            <span><b style={{ color: "#8bcf98" }}>{adminCount}</b><small>สีเขียว • Admin Upload</small></span>
          </div>

          <form onSubmit={uploadLibrary} style={{ marginTop: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="ประเภท Asset — เลือกหมวดที่จะเพิ่ม"><select style={input} value={libraryForm.kind} onChange={(e) => setLibraryForm({ ...libraryForm, kind: e.target.value })}><option value="images">ภาพ & สไตล์</option><option value="voices">เสียง</option><option value="characters">ตัวละคร</option><option value="pets">สัตว์ / Creature</option><option value="ambience">บรรยากาศ / SFX</option><option value="plots">พล็อตเรื่อง</option></select></Field>
              <Field label="ชื่อ Asset"><input style={input} value={libraryForm.title} onChange={(e) => setLibraryForm({ ...libraryForm, title: e.target.value })} placeholder="เช่น Cinematic Noir" required /></Field>
            </div>
            <Field label="คำอธิบายสั้น — ข้อความที่โชว์บนการ์ด Library"><textarea style={{ ...input, minHeight: 72 }} value={libraryForm.description} onChange={(e) => setLibraryForm({ ...libraryForm, description: e.target.value })} placeholder="บอกให้ผู้ใช้เข้าใจใน 1–2 ประโยคว่าสไตล์นี้ให้ภาพแบบไหน และเหมาะกับงานอะไร" /></Field>

            {libraryForm.kind === "images" ? <div style={detailPanel}>
              <div style={{ marginBottom: 10 }}><span style={eyebrow}>STYLE DETAIL</span><h3 style={{ margin: "4px 0", fontSize: 14 }}>รายละเอียดสำหรับปุ่ม “ดูรายละเอียด”</h3><p style={muted}>กรอกให้ครบเพื่อให้ผู้ใช้รู้ว่าสไตล์นี้ควบคุมภาพ แสง สี Prompt และการใช้ Reference อย่างไร</p></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Visual Language — ภาษาภาพ / ลักษณะหลัก"><textarea style={smallArea} value={libraryForm.visualLanguage} onChange={(e) => setLibraryForm({ ...libraryForm, visualLanguage: e.target.value })} placeholder="เช่น ภาพสมจริงแบบภาพยนตร์ เน้นวัสดุและมิติของฉาก" /></Field>
                <Field label="Lighting — แนวทางแสง"><textarea style={smallArea} value={libraryForm.lighting} onChange={(e) => setLibraryForm({ ...libraryForm, lighting: e.target.value })} placeholder="เช่น Low-key, Golden Hour, Neon, Soft Backlight" /></Field>
                <Field label="Color & Mood — สีและอารมณ์"><textarea style={smallArea} value={libraryForm.colorMood} onChange={(e) => setLibraryForm({ ...libraryForm, colorMood: e.target.value })} placeholder="เช่น ทองอุ่น ส้ม น้ำตาล Skin Tone นุ่ม" /></Field>
                <Field label="Best For — เหมาะกับงาน"><textarea style={smallArea} value={libraryForm.bestFor} onChange={(e) => setLibraryForm({ ...libraryForm, bestFor: e.target.value })} placeholder="เช่น Romance, Drama, Thriller" /></Field>
              </div>
              <Field label="Prompt Guidance — แนวทางเขียน Prompt"><textarea style={{ ...input, minHeight: 72 }} value={libraryForm.promptHint} onChange={(e) => setLibraryForm({ ...libraryForm, promptHint: e.target.value })} placeholder="คำหลักหรือแนวทางที่ระบบควรนำไปประกอบ Production Prompt" /></Field>
              <Field label="Reference Usage — วิธีใช้เป็น Reference"><textarea style={{ ...input, minHeight: 64 }} value={libraryForm.referenceUsage} onChange={(e) => setLibraryForm({ ...libraryForm, referenceUsage: e.target.value })} placeholder="อธิบายว่าใช้คุมทั้ง Production หรือเฉพาะ Scene ได้อย่างไร" /></Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Model / Provider — การรองรับโมเดล"><textarea style={smallArea} value={libraryForm.compatibility} onChange={(e) => setLibraryForm({ ...libraryForm, compatibility: e.target.value })} placeholder="เว้นว่างได้ ระบบจะใช้ข้อความมาตรฐาน" /></Field>
                <Field label="Lock & Continuity — การล็อกความต่อเนื่อง"><textarea style={smallArea} value={libraryForm.lockNote} onChange={(e) => setLibraryForm({ ...libraryForm, lockNote: e.target.value })} placeholder="เว้นว่างได้ ระบบจะใช้ข้อความมาตรฐาน" /></Field>
              </div>
            </div> : null}

            <Field label="ไฟล์ Asset (ไม่เกิน 10MB) — ภาพรองรับ PNG/JPG/WebP"><input style={input} type="file" accept="image/*,audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></Field>
            <button style={{ ...primary, opacity: busy ? .65 : 1 }} disabled={busy}>{busy ? "กำลังบันทึก..." : "↑ เพิ่มเข้า Library"}</button>
          </form>

          <div style={{ marginTop: 22, borderTop: "1px solid #222", paddingTop: 16 }}>
            <div style={sectionHead}><div><span style={eyebrow}>CURRENT ASSETS</span><h3 style={{ ...heading, fontSize: 15 }}>รายการจริงในหมวด {KIND_LABEL[libraryForm.kind]}</h3></div><small style={count}>ล่าสุดตามระบบ</small></div>
            {currentItems.length === 0 ? <div style={emptyState}>หมวดนี้ยังไม่มี Asset</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 9 }}>
              {currentItems.map((item) => <div key={item.id} style={assetCard}>
                {item.assetUrl ? <img src={item.assetUrl} alt={item.title} style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 9, marginBottom: 9, background: "#151515" }} /> : <div style={{ height: 96, borderRadius: 9, background: "#17160f", display: "grid", placeItems: "center", color: "#f2c94c", marginBottom: 9 }}>▦</div>}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}><div><b style={{ display: "block", fontSize: 11 }}>{item.title}</b><small style={{ color: item.source === "SYSTEM" ? "#e1c95e" : "#8bcf98", fontWeight: 850 }}>SCENOVA SYSTEM</small></div><button type="button" style={deleteButton} onClick={() => deleteAsset(item)} disabled={busy}>ลบ</button></div>
                <p style={{ color: "#85857f", fontSize: 9, lineHeight: 1.55, minHeight: 30, margin: "8px 0" }}>{item.description || "ยังไม่มีคำอธิบาย"}</p>
                {item.kind === "images" && item.metadata ? <div style={metaMini}>{item.metadata.bestFor ? <span><b>เหมาะกับ:</b> {item.metadata.bestFor}</span> : null}{item.metadata.colorMood ? <span><b>โทน:</b> {item.metadata.colorMood}</span> : null}</div> : null}
              </div>)}
            </div>}
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: "block", fontSize: 10, fontWeight: 800, marginBottom: 10 }}>{label}<div style={{ marginTop: 5 }}>{children}</div></label>; }
const card: React.CSSProperties = { border: "1px solid #242424", borderRadius: 16, background: "#0f0f0f", padding: 17 };
const input: React.CSSProperties = { width: "100%", borderRadius: 10, border: "1px solid #292929", background: "#090909", color: "#f5f5ef", padding: "9px 10px", fontSize: 11, outline: "none" };
const smallArea: React.CSSProperties = { ...input, minHeight: 66, resize: "vertical" };
const primary: React.CSSProperties = { border: "1px solid #f2c94c", borderRadius: 10, padding: "10px 13px", background: "#f2c94c", color: "#0a0a0a", fontWeight: 900, fontSize: 10, cursor: "pointer" };
const heading: React.CSSProperties = { fontSize: 17, margin: "4px 0 0" };
const muted: React.CSSProperties = { color: "#898983", fontSize: 10, lineHeight: 1.6, margin: "0 0 14px" };
const eyebrow: React.CSSProperties = { color: "#f2c94c", fontSize: 9, fontWeight: 900, letterSpacing: ".12em" };
const listRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid #202020" };
const assetCard: React.CSSProperties = { padding: 10, borderRadius: 12, border: "1px solid #242424", background: "#090909" };
const notice: React.CSSProperties = { border: "1px solid #3b351e", borderRadius: 11, background: "#17160f", color: "#d9c45f", padding: "10px 12px", fontSize: 10 };
const sectionHead: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10, marginBottom: 6 };
const count: React.CSSProperties = { color: "#777771", fontSize: 9 };
const primaryLink: React.CSSProperties = { color: "#0a0a0a", background: "#f2c94c", borderRadius: 9, padding: "9px 12px", textDecoration: "none", fontWeight: 850, fontSize: 10 };
const secondaryLink: React.CSSProperties = { color: "#d8d8d2", background: "#141414", border: "1px solid #2f2f2f", borderRadius: 9, padding: "9px 12px", textDecoration: "none", fontWeight: 850, fontSize: 10 };
const statusPill: React.CSSProperties = { fontStyle: "normal", color: "#d9c45f", border: "1px solid #39331b", background: "#17160f", borderRadius: 999, padding: "4px 6px", fontSize: 8, fontWeight: 850 };
const statusSecure: React.CSSProperties = { color: "#8bcf98", borderColor: "#28432e", background: "#101b12" };
const detailPanel: React.CSSProperties = { border: "1px solid #302b1b", background: "#12110c", borderRadius: 13, padding: 13, marginBottom: 12 };
const summaryBar: React.CSSProperties = { display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 8, padding: 10, border: "1px solid #28251a", borderRadius: 12, background: "#12110c" };
const deleteButton: React.CSSProperties = { border: "1px solid #633434", borderRadius: 8, background: "#211010", color: "#ef9a9a", padding: "5px 8px", fontSize: 9, fontWeight: 850, cursor: "pointer" };
const emptyState: React.CSSProperties = { border: "1px dashed #2c2c2c", borderRadius: 10, padding: 20, color: "#777", textAlign: "center", fontSize: 10 };
const metaMini: React.CSSProperties = { display: "grid", gap: 4, color: "#8b8b84", fontSize: 8, lineHeight: 1.45 };
