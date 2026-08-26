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
  ["/agent", "AI", "AI Agent", "Orchestration & Approval"],
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

function ScenovaMark() {
  return <svg viewBox="0 0 40 40" width="30" height="30" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="scenova-mark-gold" x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fff0a3" />
        <stop offset="0.45" stopColor="#f2c94c" />
        <stop offset="1" stopColor="#9d7620" />
      </linearGradient>
    </defs>
    <rect x="5.5" y="5.5" width="29" height="29" rx="8" fill="#0b0b09" stroke="url(#scenova-mark-gold)" strokeWidth="1.2" />
    <path d="M27.8 13.1c-2.05-1.9-4.55-2.85-7.45-2.85-4.35 0-7.2 2.05-7.2 5.05 0 3.15 2.5 4.2 7.45 5.25 4.1.85 5.65 1.55 5.65 3.55 0 2.25-2.15 3.65-5.7 3.65-3.25 0-6.05-1.05-8.35-3.2" fill="none" stroke="url(#scenova-mark-gold)" strokeWidth="2.05" strokeLinecap="round" />
    <path d="M9.5 8.5h4M26.5 31.5h4" stroke="#f7df7a" strokeWidth="1.1" strokeLinecap="round" opacity=".9" />
    <circle cx="30.6" cy="9.4" r="1.15" fill="#fff0a3" />
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
    if (pathname.startsWith("/agent")) return [["/agent", "Agent Runs"], ["/wallet", "Credit Activity"], ["/render", "Render Queue"]] as const;
    if (pathname.startsWith("/libraries")) return [["/libraries", "Asset Library"]] as const;
    if (pathname.startsWith("/render")) return [["/render", "Render Queue"], ["/libraries?tab=videos", "Completed Renders"]] as const;
    if (pathname.startsWith("/models")) return [["/models", "Model Comparison"], ["/studio", "Studio"]] as const;
    if (pathname.startsWith("/wallet")) return [["/wallet", "Credit Balance & Activity"], ["/agent", "Agent Usage"], ["/render", "Usage Jobs"]] as const;
    if (pathname.startsWith("/admin")) return [["/admin", "Members & Assets"], ["/admin/security", "Emergency Security"], ["/admin/ai-costs", "LLM Cost Meter"], ["/profile", "Account Security"]] as const;
    if (pathname.startsWith("/profile")) return [["/profile", "Account & Security"], ["/studio", "Studio"]] as const;
    return studioSubNav;
  }, [pathname]);

  if (standalone) return <>{children}</>;
  if (checking || !me.authenticated) return <div className={styles.loading}>Opening SCENOVA Workspace...</div>;

  const context = pathname.startsWith("/series") ? "Series" : pathname.startsWith("/agent") ? "AI Agent" : pathname.startsWith("/libraries") ? "Asset Library" : pathname.startsWith("/render") ? "Render Queue" : pathname.startsWith("/models") ? "Model Center" : pathname.startsWith("/wallet") ? "Credit Wallet" : pathname.startsWith("/admin") ? "Admin Console" : pathname.startsWith("/profile") ? "Profile" : "Studio";

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/portal" className={styles.brand} prefetch={false}><span className={styles.logo} style={{ background: "linear-gradient(145deg,#17130a 0%,#0a0a09 68%)", border: "1px solid #6d5820", color: "#f2c94c", boxShadow: "inset 0 0 0 1px rgba(255,232,135,.08),0 10px 28px rgba(170,128,24,.14)" }}><ScenovaMark /></span><span><b>SCENOVA</b><small>AI Cinematic Production Studio</small></span></Link>
      <nav className={styles.mainNav} aria-label="Primary navigation">{MAIN_NAV.map(([href, icon, label, short]) => {
        const active = pathname.startsWith(href);
        return <Link key={href} href={href} prefetch={false} className={active ? styles.active : ""}><span className={styles.navIcon}>{icon}</span><span className={styles.navText}><b>{label}</b><small>{short}</small></span></Link>;
      })}
        {me.role === "ADMIN" ? <Link href="/admin" prefetch={false} className={`${styles.mobileOnly} ${pathname.startsWith("/admin") ? styles.active : ""}`}><span className={styles.navIcon}>⚙</span><span className={styles.navText}><b>Admin</b><small>Console</small></span></Link> : null}
        <Link href="/profile" prefetch={false} className={`${styles.mobileOnly} ${pathname.startsWith("/profile") ? styles.active : ""}`}><span className={styles.navIcon}>◉</span><span className={styles.navText}><b>Profile</b><small>Account</small></span></Link>
      </nav>
      <div className={styles.sidebarBottom}>
        {me.role === "ADMIN" ? <Link href="/admin" prefetch={false} className={pathname.startsWith("/admin") ? styles.active : ""}><span className={styles.navIcon}>⚙</span><span className={styles.navText}><b>Admin Console</b><small>Security, Members & Cost</small></span></Link> : null}
        <Link href="/profile" prefetch={false} className={styles.profileCard}><span className={styles.profileAvatar}>{me.name?.slice(0, 1).toUpperCase() || "U"}</span><span><b>{me.name || "Profile"}</b><small>{me.twoFactorEnabled ? "2FA Secured" : me.role === "ADMIN" ? "Security Setup" : me.email}</small></span></Link>
      </div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><div className={styles.context}><span>SCENOVA</span><b>{context}</b></div><div className={styles.subNav}>{subNav.map(([href, label]) => <Link key={href} href={href} prefetch={false}>{label}</Link>)}</div><Link className={styles.account} href="/profile" prefetch={false}><span>{me.name || "Profile"}</span><i>{me.role === "ADMIN" ? "ADMIN" : "USER"}</i></Link></header>
      <div className={styles.page}>{children}</div>
    </div>
  </div>;
}
