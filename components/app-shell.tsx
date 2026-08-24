"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./app-shell.module.css";

type Me = { authenticated: boolean; name?: string; email?: string; role?: "ADMIN" | "MEMBER" };
type NavItem = readonly [href: string, icon: string, label: string, short: string];

const WORKSPACE_NAV: NavItem[] = [
  ["/", "✦", "สร้างหนัง", "Creator"],
  ["/series", "EP", "โปรเจกต์ / EP", "ทำต่อทีละตอน"],
  ["/render", "▶", "คิวสร้างคลิป", "Render Queue"],
];

const LIBRARY_NAV: NavItem[] = [
  ["/libraries/images", "▧", "คลังภาพ", "Style & Reference"],
  ["/libraries/voices", "♫", "คลังเสียง", "Voice"],
  ["/libraries/characters", "◎", "คลังตัวละคร", "Characters"],
  ["/libraries/pets", "◇", "คลังสัตว์ / Creature", "Companions"],
  ["/libraries/ambience", "≈", "คลังบรรยากาศ", "Ambience & SFX"],
  ["/libraries/plots", "✦", "คลังพล็อต", "Story Seeds"],
  ["/libraries/videos", "▸", "คลังวิดีโอ", "Generated EP"],
];

const SYSTEM_NAV: NavItem[] = [
  ["/models", "⬡", "โมเดล & ราคา", "Models"],
  ["/wallet", "◉", "เครดิต", "Wallet"],
];

function creatorSubNav() {
  return [
    ["/#setup", "1 ตั้งค่างาน"],
    ["/#characters", "2 ตัวละคร"],
    ["/#scenes", "3 ฉาก & กล้อง"],
    ["/#sound", "4 เสียง / SFX"],
    ["/#review", "5 Prompt & Render"],
    ["/camera", "Camera Lab"],
    ["/dialogue", "Dialogue"],
    ["/reference", "Reference Lab"],
  ] as const;
}

function librarySubNav() {
  return [
    ["/libraries", "ภาพรวมคลัง"],
    ["/libraries/images", "ภาพ"],
    ["/libraries/voices", "เสียง"],
    ["/libraries/characters", "ตัวละคร"],
    ["/libraries/pets", "สัตว์ / Creature"],
    ["/libraries/ambience", "บรรยากาศ / SFX"],
    ["/libraries/plots", "พล็อต"],
    ["/libraries/videos", "วิดีโอ EP"],
  ] as const;
}

function seriesSubNav() {
  return [
    ["/series#history", "ประวัติ EP"],
    ["/series#episode-editor", "ตอนที่กำลังทำ"],
    ["/series#continuity", "ความต่อเนื่อง"],
    ["/libraries/videos", "วิดีโอที่สร้างแล้ว"],
  ] as const;
}

function renderSubNav() {
  return [
    ["/render", "งานที่กำลังสร้าง"],
    ["/libraries/videos", "คลิปที่เสร็จแล้ว"],
    ["/wallet", "เครดิตที่ใช้"],
  ] as const;
}

function modelSubNav() {
  return [
    ["/models", "เปรียบเทียบโมเดล"],
    ["/", "กลับ Creator"],
    ["/wallet", "เครดิต"],
  ] as const;
}

function NavGroup({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <section className={styles.navGroup}>
      <div className={styles.groupLabel}>{title}</div>
      <nav aria-label={title}>
        {items.map(([href, icon, label, short]) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} prefetch className={active ? styles.active : ""}>
              <span className={styles.navIcon}>{icon}</span>
              <span><b>{label}</b><small>{short}</small></span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

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
      .then((data: Me) => {
        setMe(data);
        setChecking(false);
        if (!data.authenticated) router.replace("/login");
      })
      .catch(() => { setChecking(false); router.replace("/login"); });
  }, [pathname, router]);

  const subNav = useMemo(() => {
    if (pathname.startsWith("/libraries")) return librarySubNav();
    if (pathname.startsWith("/series")) return seriesSubNav();
    if (pathname.startsWith("/render")) return renderSubNav();
    if (pathname.startsWith("/models")) return modelSubNav();
    return creatorSubNav();
  }, [pathname]);

  if (pathname === "/login") return <>{children}</>;
  if (checking || !me.authenticated) return <div className={styles.loading}>กำลังตรวจสอบบัญชี SCENOVA...</div>;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand} prefetch>
          <span className={styles.logo}>S</span>
          <span><b>SCENOVA</b><small>AI Movie & Series Studio</small></span>
        </Link>

        <div className={styles.sidebarScroll}>
          <NavGroup title="สร้างงาน" items={WORKSPACE_NAV} pathname={pathname} />
          <NavGroup title="คลัง" items={LIBRARY_NAV} pathname={pathname} />
          <NavGroup title="ระบบ" items={SYSTEM_NAV} pathname={pathname} />
        </div>

        <div className={styles.sidebarBottom}>
          {me.role === "ADMIN" ? (
            <Link href="/admin" prefetch className={pathname.startsWith("/admin") ? styles.active : ""}>
              <span className={styles.navIcon}>⚙</span><span><b>หลังบ้าน Admin</b><small>สมาชิก & Library</small></span>
            </Link>
          ) : null}
          <Link href="/profile" prefetch className={pathname === "/profile" ? styles.active : ""}>
            <span className={styles.profileAvatar}>{me.name?.slice(0, 1).toUpperCase() || "U"}</span>
            <span><b>{me.name}</b><small>{me.role === "ADMIN" ? "Administrator" : me.email}</small></span>
          </Link>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.contextName}>
            <b>{pathname.startsWith("/libraries") ? "คลัง SCENOVA" : pathname.startsWith("/series") ? "EP Workspace" : pathname.startsWith("/render") ? "Render" : pathname.startsWith("/models") ? "Models" : "Creator"}</b>
            <span>เมนูย่อยของหน้าปัจจุบัน</span>
          </div>
          <div className={styles.subSlider} aria-label="เมนูย่อย">
            {subNav.map(([href, label]) => <Link key={href} href={href} prefetch>{label}</Link>)}
          </div>
          <Link className={styles.profileButton} href="/profile" prefetch>
            <span>{me.name}</span><i>{me.role === "ADMIN" ? "ADMIN" : "PROFILE"}</i>
          </Link>
        </header>
        <div className={styles.page}>{children}</div>
      </div>
    </div>
  );
}
