"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./app-shell.module.css";

type Me = { authenticated: boolean; name?: string; email?: string; role?: "ADMIN" | "MEMBER"; twoFactorEnabled?: boolean };
type NavItem = readonly [href: string, icon: string, label: string, short: string];

const MAIN_NAV: NavItem[] = [
  ["/portal", "✦", "เริ่มต้น", "ภาพรวมสตูดิโอ"],
  ["/series", "EP", "โปรเจกต์", "หนังและซีรีส์ของคุณ"],
  ["/studio", "AI", "AI Studio", "สร้างหนังและวิดีโอ"],
  ["/director", "▤", "สตอรี่บอร์ด", "ฉาก กล้อง และการกำกับ"],
  ["/libraries", "▦", "คลังทรัพยากร", "ตัวละคร เสียง และสไตล์"],
  ["/agent", "✧", "AI Agent", "อัตโนมัติและอนุมัติงาน"],
  ["/models", "⬡", "Model Center", "โมเดล ราคา และความสามารถ"],
  ["/render", "▶", "คิวสร้าง", "งานที่กำลังสร้าง"],
  ["/wallet", "●", "เครดิต", "ยอดเครดิตและค่าใช้จ่าย"],
];

const studioSubNav = [
  ["/studio#setup", "ตั้งค่างาน"],
  ["/studio#characters", "ตัวละครและเสียง"],
  ["/studio#scenes", "กำกับฉาก"],
  ["/libraries?tab=characters", "คลังตัวละคร"],
  ["/libraries?tab=voices", "คลังเสียง"],
  ["/studio#review", "Prompt & Render"],
] as const;

const seriesSubNav = [
  ["/series#history", "ลำดับตอน"],
  ["/series#episode-editor", "พื้นที่ทำตอน"],
  ["/series#continuity", "ความต่อเนื่อง"],
  ["/libraries?tab=characters", "ตัวละคร"],
  ["/libraries?tab=videos", "ตอนที่สร้างแล้ว"],
] as const;

function ScenovaMark() {
  return <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="scenova-core" x1="9" y1="8" x2="39" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fff4b0" />
        <stop offset=".46" stopColor="#f2c94c" />
        <stop offset="1" stopColor="#9d7421" />
      </linearGradient>
      <radialGradient id="scenova-glow" cx="0" cy="0" r="1" gradientTransform="translate(24 24) rotate(90) scale(18)">
        <stop stopColor="#f2c94c" stopOpacity=".18" />
        <stop offset="1" stopColor="#f2c94c" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="4.5" y="4.5" width="39" height="39" rx="13" fill="#0a0a09" stroke="#51441f" />
    <circle cx="24" cy="24" r="16" fill="url(#scenova-glow)" />
    <path d="M24 10.5c5.8 0 10.8 3.5 12.9 8.5l-8.8 1.1a7.2 7.2 0 0 0-6.2-3.5c-3.1 0-5.8 2-6.8 4.8l-4.7-7.5A16.8 16.8 0 0 1 24 10.5Z" fill="none" stroke="url(#scenova-core)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M37.5 24c0 5.8-3.5 10.8-8.5 12.9l-1.1-8.8a7.2 7.2 0 0 0 3.5-6.2c0-3.1-2-5.8-4.8-6.8l7.5-4.7A16.8 16.8 0 0 1 37.5 24Z" fill="none" stroke="url(#scenova-core)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" transform="rotate(120 24 24)" />
    <path d="M37.5 24c0 5.8-3.5 10.8-8.5 12.9l-1.1-8.8a7.2 7.2 0 0 0 3.5-6.2c0-3.1-2-5.8-4.8-6.8l7.5-4.7A16.8 16.8 0 0 1 37.5 24Z" fill="none" stroke="url(#scenova-core)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" transform="rotate(240 24 24)" />
    <path d="M24 18.6l1.55 3.85L29.4 24l-3.85 1.55L24 29.4l-1.55-3.85L18.6 24l3.85-1.55L24 18.6Z" fill="url(#scenova-core)" />
    <circle cx="38" cy="10" r="1.45" fill="#fff1a0" />
  </svg>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const standalone = pathname === "/login" || pathname === "/portal";
  const [me, setMe] = useState<Me>({ authenticated: false });
  const [checking, setChecking] = useState(!standalone);
  const authLoaded = useRef(false);

  useEffect(() => {
    if (standalone) { setChecking(false); return; }
    if (authLoaded.current) return;
    setChecking(true);
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: Me) => {
        if (!data.authenticated) { setChecking(false); router.replace("/login"); return; }
        setMe(data); authLoaded.current = true; setChecking(false);
      })
      .catch(() => { setChecking(false); router.replace("/login"); });
  }, [standalone, router]);

  const subNav = useMemo(() => {
    if (pathname.startsWith("/series")) return seriesSubNav;
    if (pathname.startsWith("/director") || pathname.startsWith("/camera") || pathname.startsWith("/dialogue") || pathname.startsWith("/reference")) return [["/director", "สตอรี่บอร์ด"], ["/camera", "กล้องและเลนส์"], ["/dialogue", "บทและเสียงพูด"], ["/reference", "ภาพอ้างอิง"], ["/studio#scenes", "กลับไปกำกับฉาก"]] as const;
    if (pathname.startsWith("/agent")) return [["/agent#runs", "งาน AI"], ["/agent#approvals", "รออนุมัติ"], ["/studio", "เริ่มจาก Studio"], ["/wallet#activity", "เครดิตที่ใช้"], ["/render", "คิวสร้างวิดีโอ"]] as const;
    if (pathname.startsWith("/libraries")) return [["/libraries?tab=images", "ภาพ & สไตล์"], ["/libraries?tab=characters", "ตัวละคร"], ["/libraries?tab=voices", "เสียง"], ["/libraries?tab=ambience", "บรรยากาศ / SFX"], ["/libraries?tab=videos", "วิดีโอ"]] as const;
    if (pathname.startsWith("/render")) return [["/render", "คิวสร้างวิดีโอ"], ["/wallet#activity", "ค่าใช้เครดิต"], ["/libraries?tab=videos", "งานที่สร้างแล้ว"]] as const;
    if (pathname.startsWith("/models")) return [["/models", "เปรียบเทียบโมเดล"], ["/wallet", "เครดิตและงบ"], ["/studio", "ใช้ใน Studio"]] as const;
    if (pathname.startsWith("/wallet")) return [["/wallet", "ยอดเครดิต"], ["/wallet#activity", "ประวัติการใช้"], ["/models", "ราคาโมเดล"], ["/render", "งานที่ใช้เครดิต"]] as const;
    if (pathname.startsWith("/admin")) return [["/admin", "สมาชิกและคลัง"], ["/admin/security", "ความปลอดภัย"], ["/admin/ai-costs", "ค่าใช้จ่าย AI"], ["/profile", "บัญชี"]] as const;
    if (pathname.startsWith("/profile")) return [["/profile", "บัญชีและความปลอดภัย"], ["/studio", "กลับ Studio"]] as const;
    return studioSubNav;
  }, [pathname]);

  if (standalone) return <>{children}</>;
  if (checking || !me.authenticated) return <div className={styles.loading}>กำลังเปิด SCENOVA...</div>;

  const context = pathname.startsWith("/series") ? "Projects" : pathname.startsWith("/director") || pathname.startsWith("/camera") || pathname.startsWith("/dialogue") || pathname.startsWith("/reference") ? "Cinematic Direction" : pathname.startsWith("/agent") ? "AI Agent" : pathname.startsWith("/libraries") ? "Asset Library" : pathname.startsWith("/render") ? "Render Queue" : pathname.startsWith("/models") ? "Model Center" : pathname.startsWith("/wallet") ? "Credit Wallet" : pathname.startsWith("/admin") ? "Admin Console" : pathname.startsWith("/profile") ? "Profile" : "AI Studio";

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/portal" className={styles.brand} prefetch={false}><span className={styles.logo}><ScenovaMark /></span><span><b>SCENOVA</b><small>PRODUCTION STUDIO</small></span></Link>
      <nav className={styles.mainNav} aria-label="Primary navigation">{MAIN_NAV.map(([href, icon, label, short]) => {
        const active = pathname.startsWith(href);
        return <Link key={href} href={href} prefetch={false} className={active ? styles.active : ""}><span className={styles.navIcon}>{icon}</span><span className={styles.navText}><b>{label}</b><small>{short}</small></span></Link>;
      })}
        {me.role === "ADMIN" ? <Link href="/admin" prefetch={false} className={`${styles.mobileOnly} ${pathname.startsWith("/admin") ? styles.active : ""}`}><span className={styles.navIcon}>⚙</span><span className={styles.navText}><b>Admin</b><small>จัดการระบบ</small></span></Link> : null}
        <Link href="/profile" prefetch={false} className={`${styles.mobileOnly} ${pathname.startsWith("/profile") ? styles.active : ""}`}><span className={styles.navIcon}>◉</span><span className={styles.navText}><b>Profile</b><small>บัญชี</small></span></Link>
      </nav>
      <div className={styles.sidebarBottom}>
        <Link href="/wallet" prefetch={false} className={styles.creditShortcut}><span><small>เครดิตและค่าใช้จ่าย</small><b>Credit Wallet</b></span><i>เติมเครดิต</i></Link>
        {me.role === "ADMIN" ? <Link href="/admin" prefetch={false} className={pathname.startsWith("/admin") ? styles.active : ""}><span className={styles.navIcon}>⚙</span><span className={styles.navText}><b>Admin Console</b><small>ความปลอดภัย สมาชิก และค่าใช้จ่าย</small></span></Link> : null}
        <Link href="/profile" prefetch={false} className={styles.profileCard}><span className={styles.profileAvatar}>{me.name?.slice(0, 1).toUpperCase() || "U"}</span><span><b>{me.name || "Profile"}</b><small>{me.twoFactorEnabled ? "2FA เปิดใช้งาน" : me.role === "ADMIN" ? "ตั้งค่าความปลอดภัย" : me.email}</small></span></Link>
      </div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><div className={styles.context}><span>SCENOVA WORKSPACE</span><b>{context}</b></div><div className={styles.subNav}>{subNav.map(([href, label], index) => <Link key={href} href={href} prefetch={false} className={index === 0 ? styles.subActive : ""}><i>{String(index + 1).padStart(2, "0")}</i><span>{label}</span></Link>)}</div><Link className={styles.helpLink} href="/portal#guide" prefetch={false}><span>?</span><b>คู่มือ</b></Link><Link className={styles.account} href="/profile" prefetch={false}><span>{me.name || "Profile"}</span><i>{me.role === "ADMIN" ? "ADMIN" : "USER"}</i></Link></header>
      <div className={styles.page}>{children}</div>
    </div>
  </div>;
}
