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
  description: string;
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
      description: "ดูชื่อ อีเมล สิทธิ์บัญชี และจัดการการออกจากระบบของบัญชีที่กำลังใช้งาน",
      status: me.role === "ADMIN" ? "Administrator" : me.role === "MEMBER" ? "Member" : undefined,
    },
    {
      href: "/profile/api",
      icon: "↔",
      title: "API & Models",
      description: "เชื่อม API Key / BYOK เลือก Provider และกำหนดสาย A วิเคราะห์ · B ภาพ · C วิดีโอ · D เสียง",
      status: "Connection Center",
    },
    {
      href: "/profile/2fa",
      icon: "◇",
      title: "การยืนยันตัวตน 2 ชั้น (2FA)",
      description: "ตั้งค่า Authenticator, รหัส 6 หลัก และ Recovery Codes เพื่อเพิ่มความปลอดภัยในการเข้าสู่ระบบ",
      status: me.twoFactorEnabled ? "เปิดใช้งาน" : me.twoFactorRequired ? "จำเป็นต้องเปิด" : "ยังไม่เปิด",
      good: Boolean(me.twoFactorEnabled),
    },
    {
      href: "/admin/security",
      icon: "⬡",
      title: "Security Center",
      description: "ควบคุม Emergency Lockdown, Session, Provider และมาตรการป้องกันระบบจากศูนย์กลางเดียว",
      status: "Admin",
      adminOnly: true,
    },
    {
      href: "/admin/ai-costs",
      icon: "●",
      title: "AI & Cost Control",
      description: "ติดตามต้นทุน AI จริงตาม Model และงาน พร้อมตรวจ Usage และเพดานงบประมาณของระบบ",
      status: "Admin",
      adminOnly: true,
    },
    {
      href: "/guide",
      icon: "?",
      title: "คู่มือการใช้งาน",
      description: "ดูคำอธิบายฟังก์ชัน ขั้นตอนใช้งาน และคำศัพท์ของ SCENOVA ตามสิทธิ์ของบัญชี",
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
          <p>จัดการบัญชี การเชื่อมต่อ AI ความปลอดภัย ต้นทุน และคู่มือจากศูนย์กลางเดียว เลือกหัวข้อด้านล่างเพื่อเปิดหน้าตั้งค่าของส่วนนั้นโดยตรง</p>
        </div>
        <div className={styles.headerStatus}><i />{loaded && me.authenticated ? `บัญชี ${me.name || me.email || "พร้อมใช้งาน"}` : loaded ? "ยังไม่ได้เข้าสู่ระบบ" : "กำลังตรวจสอบบัญชี"}</div>
      </header>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span className={styles.kicker}>SETTINGS CENTER</span>
            <h2>เลือกเมนูการตั้งค่า</h2>
            <p>แต่ละเมนูแยกเป็นหน้าของตัวเอง เพื่อลดความซ้ำซ้อนและทำให้สถานะ คำอธิบาย และสิทธิ์ใช้งานอ่านได้ชัดเจน</p>
          </div>
        </div>
        <div className={styles.menuList}>
          {visibleItems.map((item) => (
            <Link className={styles.menuRow} href={item.href} key={item.href} prefetch={false}>
              <span className={styles.menuIcon}>{item.icon}</span>
              <span className={styles.menuCopy}><strong>{item.title}</strong><span>{item.description}</span></span>
              {item.status ? <span className={`${styles.menuStatus} ${item.good ? styles.menuStatusGood : ""}`}>{item.status}</span> : null}
              <span className={styles.arrow} aria-hidden>›</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
