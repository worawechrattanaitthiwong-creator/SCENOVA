"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Me = { authenticated: boolean; id?: string; name?: string; email?: string; role?: string };

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me>({ authenticated: false });
  useEffect(() => { fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).then(setMe); }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login"); router.refresh();
  }

  return (
    <main style={{ maxWidth: 1050, margin: "0 auto", padding: "28px", color: "#f7f3ff" }}>
      <div style={{ marginBottom: 18 }}><span style={{ color: "#b994ed", fontSize: 11, fontWeight: 850, letterSpacing: ".1em" }}>PROFILE</span><h1 style={{ margin: "6px 0", fontSize: 26 }}>โปรไฟล์ผู้ใช้</h1><p style={{ color: "#9c91ad", fontSize: 12, lineHeight: 1.6, margin: 0 }}>บัญชี SCENOVA ถูกสร้างและควบคุมโดย Admin ไม่มีหน้าสมัครสมาชิกสาธารณะ</p></div>
      {!me.authenticated ? (
        <div style={card}><p style={{ color: "#a59ab7", fontSize: 12 }}>ยังไม่ได้เข้าสู่ระบบ</p><button onClick={() => router.push("/login")} style={primary}>เข้าสู่ระบบ</button></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14 }}>
          <div style={card}><div style={{ width: 76, height: 76, borderRadius: 22, display: "grid", placeItems: "center", background: "linear-gradient(135deg,#7135f2,#b85cff)", fontSize: 27, fontWeight: 900 }}>{me.name?.slice(0,1).toUpperCase()}</div><h2 style={{ fontSize: 16, margin: "12px 0 2px" }}>{me.name}</h2><span style={{ color: "#b994ed", fontSize: 10 }}>{me.role}</span></div>
          <div style={card}><div style={row}><b>ชื่อ</b><span>{me.name}</span></div><div style={row}><b>อีเมล</b><span>{me.email}</span></div><div style={row}><b>สิทธิ์</b><span>{me.role === "ADMIN" ? "Administrator — จัดการสมาชิกและคลัง" : "Member — ใช้งาน Studio"}</span></div><button onClick={logout} style={{ ...primary, marginTop: 16, background: "#1a1228", border: "1px solid rgba(255,123,156,.24)", color: "#ffc1d0" }}>ออกจากระบบ</button></div>
        </div>
      )}
    </main>
  );
}

const card: React.CSSProperties = { border: "1px solid rgba(171,120,255,.16)", borderRadius: 17, padding: 18, background: "linear-gradient(180deg,#151021,#0d0914)" };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, padding: "11px 0", borderBottom: "1px solid rgba(171,120,255,.1)", fontSize: 12 };
const primary: React.CSSProperties = { border: 0, borderRadius: 10, padding: "10px 13px", background: "linear-gradient(135deg,#7135f2,#b85cff)", color: "white", fontWeight: 800, cursor: "pointer" };
