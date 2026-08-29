"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/settings-ui.module.css";

type Me = {
  authenticated: boolean;
  name?: string;
  email?: string;
  role?: string;
  twoFactorEnabled?: boolean;
};

export default function AccountSettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me>({ authenticated: false });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => { if (active) setMe(data); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.breadcrumb}><Link href="/profile">การตั้งค่า</Link><span>›</span><strong>บัญชี</strong></div>
          <h1>บัญชีของคุณ</h1>
          <p>ตรวจสอบข้อมูลบัญชี สิทธิ์การใช้งาน และสถานะความปลอดภัยของบัญชีที่กำลังเข้าสู่ระบบอยู่</p>
        </div>
        <div className={styles.headerStatus}><i />{loaded && me.authenticated ? "บัญชีพร้อมใช้งาน" : loaded ? "ยังไม่ได้เข้าสู่ระบบ" : "กำลังโหลดข้อมูล"}</div>
      </header>

      {!loaded ? <div className={styles.notice}>กำลังโหลดข้อมูลบัญชี...</div> : !me.authenticated ? (
        <section className={styles.panel}>
          <div className={styles.panelBody}>
            <p className={styles.help}>Session ปัจจุบันไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่</p>
            <div className={styles.actions}><button className={styles.primary} onClick={() => router.push("/login")}>เข้าสู่ระบบ</button></div>
          </div>
        </section>
      ) : (
        <div className={styles.summaryGrid}>
          <aside className={styles.identity}>
            <div className={`${styles.avatar} ${me.role === "ADMIN" ? "scenova-admin-avatar" : ""}`}>{me.role === "ADMIN" ? "" : (me.name?.slice(0, 1).toUpperCase() || "U")}</div>
            <h2>{me.name || "SCENOVA User"}</h2>
            <small>{me.role === "ADMIN" ? "Administrator" : "Member"}</small>
            <div className={`${styles.badge} ${me.twoFactorEnabled ? styles.badgeGood : ""}`}>{me.twoFactorEnabled ? "✓ 2FA เปิดใช้งาน" : "2FA ยังไม่เปิด"}</div>
          </aside>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><span className={styles.kicker}>ACCOUNT DETAILS</span><h2>ข้อมูลบัญชี</h2><p>ข้อมูลนี้ใช้ระบุตัวตนและสิทธิ์ใน SCENOVA ไม่เกี่ยวข้องกับ API Key หรือ Credential ของ Provider</p></div>
            </div>
            <div className={styles.dataRows}>
              <div className={styles.dataRow}><b>ชื่อ</b><span>{me.name || "—"}</span></div>
              <div className={styles.dataRow}><b>อีเมล</b><span>{me.email || "—"}</span></div>
              <div className={styles.dataRow}><b>สิทธิ์</b><span>{me.role === "ADMIN" ? "Administrator" : "Member"}</span></div>
              <div className={styles.dataRow}><b>2FA</b><span>{me.twoFactorEnabled ? "เปิดใช้งาน Authenticator แล้ว" : "ยังไม่ได้เปิด Authenticator"}</span></div>
              <div className={styles.actions}><Link className={styles.secondary} href="/profile/2fa">จัดการ 2FA</Link><button className={styles.danger} onClick={logout}>ออกจากระบบ</button></div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
