"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "@/components/settings-ui.module.css";

type Me = {
  authenticated: boolean;
  name?: string;
  email?: string;
  role?: string;
  twoFactorEnabled?: boolean;
  twoFactorRequired?: boolean;
};

type SettingItem = {
  href: string;
  icon: string;
  title: string;
  status?: string;
  good?: boolean;
  adminOnly?: boolean;
};

export default function SettingsHomePage() {
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

  const items: SettingItem[] = [
    {
      href: "/profile/account",
      icon: "◉",
      title: "บัญชี",
      status: me.role === "ADMIN" ? "Administrator" : me.role === "MEMBER" ? "Member" : undefined,
    },
    {
      href: "/profile/api",
      icon: "↔",
      title: "API & Models",
      status: "Connection Center",
    },
    {
      href: "/profile/2fa",
      icon: "◇",
      title: "การยืนยันตัวตน 2 ชั้น (2FA)",
      status: me.twoFactorEnabled ? "เปิดใช้งาน" : me.twoFactorRequired ? "จำเป็นต้องเปิด" : "ยังไม่เปิด",
      good: Boolean(me.twoFactorEnabled),
    },
    {
      href: "/admin/security",
      icon: "⬡",
      title: "Security Center",
      status: "Admin",
      adminOnly: true,
    },
    {
      href: "/admin/ai-costs",
      icon: "●",
      title: "AI & Cost Control",
      status: "Admin",
      adminOnly: true,
    },
    {
      href: "/guide",
      icon: "?",
      title: "คู่มือการใช้งาน",
      status: "Help Center",
    },
  ];

  const visibleItems = items.filter((item) => !item.adminOnly || me.role === "ADMIN");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.breadcrumb}><strong>การตั้งค่า</strong></div>
          <h1>การตั้งค่า</h1>
        </div>
        <div className={styles.headerStatus}><i />{loaded && me.authenticated ? `บัญชี ${me.name || me.email || "พร้อมใช้งาน"}` : loaded ? "ยังไม่ได้เข้าสู่ระบบ" : "กำลังตรวจสอบบัญชี"}</div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.kicker}>SETTINGS CENTER</span>
            <h2>เลือกเมนูการตั้งค่า</h2>
          </div>
        </div>
        <div className={styles.menuList}>
          {visibleItems.map((item) => (
            <Link className={styles.menuRow} href={item.href} key={item.href} prefetch={false}>
              <span className={styles.menuIcon}>{item.icon}</span>
              <span className={styles.menuCopy}><strong>{item.title}</strong></span>
              {item.status ? <span className={`${styles.menuStatus} ${item.good ? styles.menuStatusGood : ""}`}>{item.status}</span> : null}
              <span className={styles.arrow} aria-hidden>›</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
