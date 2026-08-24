"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./app-shell.module.css";

type Me = { authenticated: boolean; name?: string; email?: string; role?: "ADMIN" | "MEMBER" };

const MAIN_NAV = [
  ["/", "✦", "สร้างหนัง", "Creator"],
  ["/series", "EP", "โปรเจกต์ / EP", "Projects"],
  ["/models", "⬡", "โมเดล & ราคา", "Models"],
  ["/libraries", "▦", "คลังทั้งหมด", "Assets"],
  ["/render", "▶", "Render Queue", "Jobs"],
  ["/wallet", "◉", "เครดิต", "Wallet"],
] as const;

const SUB_NAV = [
  ["/#setup", "ตั้งค่างาน"],
  ["/#characters", "ตัวละคร"],
  ["/#scenes", "ฉาก & กล้อง"],
  ["/#sound", "เสียง / SFX"],
  ["/#review", "Prompt & Render"],
  ["/camera", "Camera Lab"],
  ["/dialogue", "Dialogue"],
  ["/reference", "Reference Lab"],
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
      .then((data: Me) => {
        setMe(data);
        setChecking(false);
        if (!data.authenticated) router.replace("/login");
      })
      .catch(() => { setChecking(false); router.replace("/login"); });
  }, [pathname, router]);

  if (pathname === "/login") return <>{children}</>;
  if (checking || !me.authenticated) return <div className={styles.loading}>กำลังตรวจสอบบัญชี SCENOVA...</div>;

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
          <Link href="/profile" prefetch className={pathname === "/profile" ? styles.active : ""}>
            <span className={styles.profileAvatar}>{me.name?.slice(0, 1).toUpperCase() || "U"}</span>
            <span><b>{me.name}</b><small>{me.role === "ADMIN" ? "Administrator" : me.email}</small></span>
          </Link>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.subSlider} aria-label="เมนูย่อย">
            {SUB_NAV.map(([href, label]) => <Link key={href} href={href} prefetch>{label}</Link>)}
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
