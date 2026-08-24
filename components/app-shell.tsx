"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./app-shell.module.css";

type Me = { authenticated: boolean; name?: string; email?: string; role?: "ADMIN" | "MEMBER"; twoFactorEnabled?: boolean };
type NavItem = readonly [href: string, icon: string, label: string, short: string];

const MAIN_NAV: NavItem[] = [
  ["/studio", "✦", "Studio", "Production Workspace"],
  ["/series", "EP", "Series", "Episode Continuity"],
  ["/libraries", "▦", "Asset Library", "Media & References"],
  ["/render", "▶", "Render Queue", "Generation Jobs"],
  ["/models", "⬡", "Model Center", "Models & Pricing"],
  ["/wallet", "●", "Credit Wallet", "Balance & Usage"],
];

const studioSubNav = [
  ["/studio#setup", "Production Setup"],
  ["/studio#characters", "Characters"],
  ["/studio#scenes", "Scene Direction"],
  ["/studio#sound", "Dialogue & Sound"],
  ["/studio#review", "Prompt & Render"],
] as const;

const seriesSubNav = [
  ["/series#history", "Series History"],
  ["/series#episode-editor", "Episode Workspace"],
  ["/series#continuity", "Continuity"],
  ["/libraries?tab=videos", "Generated Episodes"],
] as const;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const standalone = pathname === "/login" || pathname === "/portal";
  const [me, setMe] = useState<Me>({ authenticated: false });
  const [checking, setChecking] = useState(!standalone);
  const authLoaded = useRef(false);

  useEffect(() => {
    if (standalone) {
      setChecking(false);
      return;
    }
    if (authLoaded.current) return;

    setChecking(true);
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: Me) => {
        if (!data.authenticated) {
          setChecking(false);
          router.replace("/login");
          return;
        }
        setMe(data);
        authLoaded.current = true;
        setChecking(false);
      })
      .catch(() => {
        setChecking(false);
        router.replace("/login");
      });
  }, [standalone, router]);

  useEffect(() => {
    if (!me.authenticated) return;
    const warm = () => {
      for (const [href] of MAIN_NAV) router.prefetch(href);
      router.prefetch("/profile");
      if (me.role === "ADMIN") router.prefetch("/admin");
    };
    const timer = window.setTimeout(warm, 80);
    return () => window.clearTimeout(timer);
  }, [me.authenticated, me.role, router]);

  const subNav = useMemo(() => {
    if (pathname.startsWith("/series")) return seriesSubNav;
    if (pathname.startsWith("/libraries")) return [["/libraries", "Asset Library"]] as const;
    if (pathname.startsWith("/render")) return [["/render", "Render Queue"], ["/libraries?tab=videos", "Completed Renders"]] as const;
    if (pathname.startsWith("/models")) return [["/models", "Model Comparison"], ["/studio", "Studio"]] as const;
    if (pathname.startsWith("/wallet")) return [["/wallet", "Credit Balance"], ["/render", "Usage Jobs"]] as const;
    if (pathname.startsWith("/admin")) return [["/admin", "Members & Assets"], ["/profile", "Security"], ["/libraries", "Asset Library"]] as const;
    if (pathname.startsWith("/profile")) return [["/profile", "Account & Security"], ["/studio", "Studio"]] as const;
    return studioSubNav;
  }, [pathname]);

  if (standalone) return <>{children}</>;
  if (checking || !me.authenticated) return <div className={styles.loading}>Opening SCENOVA Workspace...</div>;

  const context = pathname.startsWith("/series") ? "Series" : pathname.startsWith("/libraries") ? "Asset Library" : pathname.startsWith("/render") ? "Render Queue" : pathname.startsWith("/models") ? "Model Center" : pathname.startsWith("/wallet") ? "Credit Wallet" : pathname.startsWith("/admin") ? "Admin Console" : pathname.startsWith("/profile") ? "Profile" : "Studio";

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link href="/portal" className={styles.brand} prefetch><span className={styles.logo}>S</span><span><b>SCENOVA</b><small>AI Cinematic Production Studio</small></span></Link>
        <nav className={styles.mainNav} aria-label="Primary navigation">
          {MAIN_NAV.map(([href, icon, label, short]) => {
            const active = pathname.startsWith(href);
            return <Link key={href} href={href} prefetch className={active ? styles.active : ""}><span className={styles.navIcon}>{icon}</span><span className={styles.navText}><b>{label}</b><small>{short}</small></span></Link>;
          })}
        </nav>
        <div className={styles.sidebarBottom}>
          {me.role === "ADMIN" ? <Link href="/admin" prefetch className={pathname.startsWith("/admin") ? styles.active : ""}><span className={styles.navIcon}>⚙</span><span className={styles.navText}><b>Admin Console</b><small>Members & Central Assets</small></span></Link> : null}
          <Link href="/profile" prefetch className={styles.profileCard}><span className={styles.profileAvatar}>{me.name?.slice(0, 1).toUpperCase() || "U"}</span><span><b>{me.name || "Profile"}</b><small>{me.twoFactorEnabled ? "2FA Secured" : me.role === "ADMIN" ? "Security Setup" : me.email}</small></span></Link>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.context}><span>SCENOVA</span><b>{context}</b></div>
          <div className={styles.subNav}>{subNav.map(([href, label]) => <Link key={href} href={href} prefetch>{label}</Link>)}</div>
          <Link className={styles.account} href="/profile" prefetch><span>{me.name || "Profile"}</span><i>{me.role === "ADMIN" ? "ADMIN" : "USER"}</i></Link>
        </header>
        <div className={styles.page}>{children}</div>
      </div>
    </div>
  );
}
