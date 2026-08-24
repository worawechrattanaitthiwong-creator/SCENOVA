"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./app-shell.module.css";

type Me = { authenticated: boolean; name?: string; email?: string; role?: "ADMIN" | "MEMBER" };

const MAIN_NAV = [
  ["/", "✦", "สร้างหนัง", "Studio"],
  ["/series", "EP", "โปรเจกต์ / EP", "Series"],
  ["/models", "⬡", "โมเดล & ราคา", "Models"],
  ["/libraries", "▦", "คลังทั้งหมด", "Libraries"],
  ["/director", "◆", "Director Console", "Director"],
  ["/reference", "◫", "Reference Lab", "Reference"],
  ["/wallet", "◉", "เครดิต", "Wallet"],
] as const;

const SUB_NAV = [
  ["/libraries#images", "คลังภาพ"],
  ["/libraries#voices", "คลังเสียง"],
  ["/libraries#characters", "คลังตัวละคร"],
  ["/libraries#pets", "คลังสัตว์เลี้ยง"],
  ["/libraries#ambience", "คลังบรรยากาศ"],
  ["/libraries#plots", "คลังพล็อต"],
  ["/camera", "Camera Lab"],
  ["/dialogue", "Dialogue"],
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me>({ authenticated: false });

  useEffect(() => {
    if (pathname === "/login") return;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setMe(data))
      .catch(() => setMe({ authenticated: false }));
  }, [pathname]);

  if (pathname === "/login") return <>{children}</>;

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.brand} prefetch>
          <span className={styles.logo}>S</span>
          <span><b>SCENOVA</b><small>AI Movie & Series Studio</small></span>
        </Link>

        <nav className={styles.mainNav} aria-label="เมนูหลัก">
          {MAIN_NAV.map(([href, icon, label, short]) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} prefetch className={active ? styles.active : ""}>
                <span className={styles.navIcon}>{icon}</span>
                <span><b>{label}</b><small>{short}</small></span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          {me.role === "ADMIN" ? (
            <Link href="/admin" prefetch className={pathname.startsWith("/admin") ? styles.active : ""}>
              <span className={styles.navIcon}>⚙</span><span><b>หลังบ้าน Admin</b><small>สมาชิก & Library</small></span>
            </Link>
          ) : null}
          <Link href={me.authenticated ? "/profile" : "/login"} prefetch className={pathname === "/profile" ? styles.active : ""}>
            <span className={styles.profileAvatar}>{me.name?.slice(0, 1).toUpperCase() || "U"}</span>
            <span><b>{me.name || "เข้าสู่ระบบ"}</b><small>{me.role === "ADMIN" ? "Administrator" : me.email || "Profile"}</small></span>
          </Link>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.subSlider}>
            {SUB_NAV.map(([href, label]) => <Link key={href} href={href} prefetch>{label}</Link>)}
          </div>
          <Link className={styles.profileButton} href={me.authenticated ? "/profile" : "/login"} prefetch>
            <span>{me.name || "Login"}</span><i>{me.role === "ADMIN" ? "ADMIN" : "PROFILE"}</i>
          </Link>
        </header>
        <div className={styles.page}>{children}</div>
      </div>
    </div>
  );
}
