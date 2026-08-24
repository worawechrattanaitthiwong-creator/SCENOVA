"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./app-shell.module.css";

type Me = { authenticated: boolean; name?: string; email?: string; role?: "ADMIN" | "MEMBER" };
type NavItem = readonly [href: string, icon: string, label: string, short: string];

const MAIN_NAV: NavItem[] = [
  ["/", "✦", "สร้างหนัง", "Creator"],
  ["/series", "EP", "โปรเจกต์ / EP", "ทำต่อทีละตอน"],
  ["/libraries", "▦", "คลัง", "Asset ทั้งหมด"],
  ["/render", "▶", "งานสร้าง", "Render Queue"],
  ["/models", "⬡", "โมเดล & ราคา", "Models"],
  ["/wallet", "●", "เครดิต", "Wallet"],
];

const creatorSubNav = [
  ["/#setup", "ตั้งค่างาน"],
  ["/#characters", "ตัวละคร"],
  ["/#scenes", "ฉาก & กล้อง"],
  ["/#sound", "เสียง"],
  ["/#review", "ตรวจและสร้าง"],
] as const;

const seriesSubNav = [
  ["/series#history", "ประวัติ EP"],
  ["/series#episode-editor", "ตอนที่กำลังทำ"],
  ["/series#continuity", "ความต่อเนื่อง"],
  ["/libraries?tab=videos", "คลิป EP"],
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me>({ authenticated: false });
  const [checking, setChecking] = useState(pathname !== "/login");

  useEffect(() => {
    if (pathname === "/login") { setChecking(false); return; }
    setChecking(true);
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: Me) => { setMe(data); setChecking(false); if (!data.authenticated) router.replace("/login"); })
      .catch(() => { setChecking(false); router.replace("/login"); });
  }, [pathname, router]);

  const subNav = useMemo(() => {
    if (pathname.startsWith("/series")) return seriesSubNav;
    if (pathname.startsWith("/libraries")) return [["/libraries", "คลังทั้งหมด"]] as const;
    if (pathname.startsWith("/render")) return [["/render", "คิวงาน"], ["/libraries?tab=videos", "คลิปที่เสร็จแล้ว"]] as const;
    if (pathname.startsWith("/models")) return [["/models", "เปรียบเทียบโมเดล"], ["/", "กลับ Creator"]] as const;
    if (pathname.startsWith("/wallet")) return [["/wallet", "ยอดเครดิต"], ["/render", "งานที่ใช้เครดิต"]] as const;
    if (pathname.startsWith("/admin")) return [["/admin", "สมาชิก & Asset"], ["/libraries", "ดูคลัง"]] as const;
    if (pathname.startsWith("/profile")) return [["/profile", "บัญชีของฉัน"], ["/", "กลับ Creator"]] as const;
    return creatorSubNav;
  }, [pathname]);

  if (pathname === "/login") return <>{children}</>;
  if (checking || !me.authenticated) return <div className={styles.loading}>กำลังเปิด SCENOVA...</div>;

  const context = pathname.startsWith("/series") ? "EP Workspace" : pathname.startsWith("/libraries") ? "Library" : pathname.startsWith("/render") ? "Render" : pathname.startsWith("/models") ? "Models" : pathname.startsWith("/wallet") ? "Wallet" : pathname.startsWith("/admin") ? "Admin" : pathname.startsWith("/profile") ? "Profile" : "Creator";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand} prefetch><span className={styles.logo}>S</span><span><b>SCENOVA</b><small>AI Movie & Series Studio</small></span></Link>
        <nav className={styles.mainNav} aria-label="เมนูหลัก">
          {MAIN_NAV.map(([href, icon, label, short]) => { const active = href === "/" ? pathname === "/" : pathname.startsWith(href); return <Link key={href} href={href} prefetch className={active ? styles.active : ""}><span className={styles.navIcon}>{icon}</span><span className={styles.navText}><b>{label}</b><small>{short}</small></span></Link>; })}
        </nav>
        <div className={styles.sidebarBottom}>
          {me.role === "ADMIN" ? <Link href="/admin" prefetch className={pathname.startsWith("/admin") ? styles.active : ""}><span className={styles.navIcon}>⚙</span><span className={styles.navText}><b>Admin</b><small>สมาชิก & คลังกลาง</small></span></Link> : null}
          <Link href="/profile" prefetch className={styles.profileCard}><span className={styles.profileAvatar}>{me.name?.slice(0, 1).toUpperCase() || "U"}</span><span><b>{me.name || "Profile"}</b><small>{me.role === "ADMIN" ? "Administrator" : me.email}</small></span></Link>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.context}><span>{context}</span><b>{pathname === "/" ? "สร้างงานใหม่" : context}</b></div>
          <div className={styles.subNav}>{subNav.map(([href, label]) => <Link key={href} href={href} prefetch>{label}</Link>)}</div>
          <Link className={styles.account} href="/profile" prefetch><span>{me.name || "Profile"}</span><i>{me.role === "ADMIN" ? "ADMIN" : "USER"}</i></Link>
        </header>
        <div className={styles.page}>{children}</div>
      </div>
    </div>
  );
}
