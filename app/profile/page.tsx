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
    <main style={{ maxWidth: 1050, margin: "0 auto", padding: 30, color: "#f5f5ef" }}>
      <header style={{ marginBottom: 18 }}><span style={{ color: "#f2c94c", fontSize: 10, fontWeight: 900, letterSpacing: ".14em" }}>PROFILE</span><h1 style={{ margin: "7px 0 5px", fontSize: 28 }}>โปรไฟล์ผู้ใช้</h1><p style={{ color: "#898983", fontSize: 11, lineHeight: 1.6, margin: 0 }}>บัญชี SCENOVA ถูกสร้างและควบคุมโดย Admin ไม่มีการสมัครสมาชิกสาธารณะ</p></header>
      {!me.authenticated ? (
        <div style={card}><p style={{ color: "#898983", fontSize: 11 }}>ยังไม่ได้เข้าสู่ระบบ</p><button onClick={() => router.push("/login")} style={primary}>เข้าสู่ระบบ</button></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14 }}>
          <div style={card}><div style={{ width: 76, height: 76, borderRadius: 20, display: "grid", placeItems: "center", background: "#f2c94c", color: "#0a0a0a", fontSize: 27, fontWeight: 950 }}>{me.name?.slice(0,1).toUpperCase()}</div><h2 style={{ fontSize: 16, margin: "12px 0 2px" }}>{me.name}</h2><span style={{ color: "#f2c94c", fontSize: 9, fontWeight: 850 }}>{me.role}</span></div>
          <div style={card}><div style={row}><b>ชื่อ</b><span>{me.name}</span></div><div style={row}><b>อีเมล</b><span>{me.email}</span></div><div style={row}><b>สิทธิ์</b><span>{me.role === "ADMIN" ? "Administrator — จัดการสมาชิกและคลัง" : "Member — ใช้งาน Studio"}</span></div><button onClick={logout} style={logoutButton}>ออกจากระบบ</button></div>
        </div>
      )}
    </main>
  );
}

const card: React.CSSProperties = { border: "1px solid #242424", borderRadius: 16, padding: 18, background: "#0f0f0f" };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, padding: "11px 0", borderBottom: "1px solid #202020", fontSize: 11 };
const primary: React.CSSProperties = { border: "1px solid #f2c94c", borderRadius: 10, padding: "10px 13px", background: "#f2c94c", color: "#0a0a0a", fontWeight: 900, cursor: "pointer" };
const logoutButton: React.CSSProperties = { marginTop: 16, border: "1px solid #4b2929", borderRadius: 10, padding: "9px 12px", background: "#1b1111", color: "#e8a0a0", fontWeight: 800, cursor: "pointer" };
