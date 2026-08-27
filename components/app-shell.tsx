"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getWorkspaceContext, getWorkspaceRail, isWorkspaceNavActive, WORKSPACE_NAV, type WorkspaceNavItem } from "@/lib/workspace-navigation";
import styles from "./app-shell.module.css";

type Me = { authenticated: boolean; name?: string; email?: string; role?: "ADMIN" | "MEMBER"; twoFactorEnabled?: boolean };
type Balance = { paid: number; bonus: number; reserved: number; available: number };
type SearchState = { get(name: string): string | null; toString(): string };
type IconName = WorkspaceNavItem["icon"] | "profile" | "arrow";

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>
    {name === "home" ? <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></> : null}
    {name === "project" ? <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M7 2.8v3.5M17 2.8v3.5M3.5 9h17M7.2 13h4.2M7.2 16h7.6" /></> : null}
    {name === "ai" ? <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m18.8 15.8.7 2.2 2.2.7-2.2.8-.7 2.2-.8-2.2-2.2-.8 2.2-.7.8-2.2Z" /></> : null}
    {name === "board" ? <><rect x="3" y="5" width="18" height="15" rx="2.3" /><path d="m4 9 16-4M7 4l2.2 4M12 3l2.2 4M17 2l2.2 4M7 13h10M7 16h6" /></> : null}
    {name === "library" ? <><path d="M3.5 7.5h6l1.6 2H20a1.5 1.5 0 0 1 1.5 1.5v7A2.5 2.5 0 0 1 19 20.5H5A2.5 2.5 0 0 1 2.5 18V9a1.5 1.5 0 0 1 1-1.5Z" /><path d="M4 7.5V5.8A2.3 2.3 0 0 1 6.3 3.5h3.8l1.7 2H18A2 2 0 0 1 20 7v2.5" /></> : null}
    {name === "settings" ? <><circle cx="12" cy="12" r="3.2" /><path d="M19 13.5v-3l-2-.7a7.7 7.7 0 0 0-.7-1.6l.9-1.9-2.1-2.1-1.9.9a7.7 7.7 0 0 0-1.7-.7l-.7-2h-3l-.7 2a7.7 7.7 0 0 0-1.6.7l-1.9-.9-2.1 2.1.9 1.9a7.7 7.7 0 0 0-.7 1.6l-2 .7v3l2 .7c.2.6.4 1.1.7 1.7l-.9 1.9 2.1 2.1 1.9-.9c.5.3 1 .5 1.6.7l.7 2h3l.7-2c.6-.2 1.2-.4 1.7-.7l1.9.9 2.1-2.1-.9-1.9c.3-.5.5-1.1.7-1.7l2-.7Z" /></> : null}
    {name === "help" ? <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.4 2.4 0 1 1 3.1 2.3c-.8.3-.8 1-.8 1.7M12 17h.01" /></> : null}
    {name === "profile" ? <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></> : null}
    {name === "arrow" ? <><path d="M5 12h14M14 7l5 5-5 5" /></> : null}
  </svg>;
}

function ScenovaMark() {
  return <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="workspace-logo-gold" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fff0a8" />
        <stop offset=".45" stopColor="#e8b83d" />
        <stop offset="1" stopColor="#80601e" />
      </linearGradient>
    </defs>
    <path d="M32 7c9.5 0 17.7 5.7 21.2 13.8l-13.5 1.8a11.5 11.5 0 0 0-18.8 2.3L13 14.1A23.5 23.5 0 0 1 32 7Z" fill="none" stroke="url(#workspace-logo-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#workspace-logo-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(120 32 32)" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#workspace-logo-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(240 32 32)" />
    <path d="M32 23.8 34.7 29l5.5 3-5.5 2.8L32 40l-2.7-5.2-5.5-2.8 5.5-3 2.7-5.2Z" fill="url(#workspace-logo-gold)" />
  </svg>;
}

function LoadingWorkspace() {
  return <div className={styles.loading}><span className={styles.loadingMark}><ScenovaMark /></span><b>SCENOVA STUDIO</b><small>กำลังเปิดพื้นที่ทำงาน…</small></div>;
}

function formatCredits(value: number | undefined) {
  if (value === undefined) return "—";
  return Number(value).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

function targetMatchesCurrent(href: string, pathname: string, search: SearchState, hash: string) {
  const target = new URL(href, "https://scenova.local");
  if (target.pathname !== pathname) return false;
  for (const [key, value] of target.searchParams.entries()) if (search.get(key) !== value) return false;
  if (target.hash && target.hash !== hash) return false;
  if (!target.hash && hash && target.pathname === pathname) return false;
  if (!target.search && target.pathname === pathname && search.toString()) return false;
  return true;
}

function WorkspaceShell({ children, pathname }: { children: React.ReactNode; pathname: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [me, setMe] = useState<Me>({ authenticated: false });
  const [balance, setBalance] = useState<Balance | null>(null);
  const [checking, setChecking] = useState(true);
  const [hash, setHash] = useState("");
  const authLoaded = useRef(false);

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash || "");
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (authLoaded.current) { setChecking(false); return; }
    let active = true;
    setChecking(true);
    fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((data: Me) => {
        if (!active) return;
        if (!data.authenticated) { setChecking(false); router.replace("/login"); return; }
        setMe(data); authLoaded.current = true; setChecking(false);
      })
      .catch(() => { if (active) { setChecking(false); router.replace("/login"); } });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (!me.authenticated) return;
    let active = true;
    fetch("/api/cost/activity?limit=1", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => { if (active && data?.balance) setBalance(data.balance); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [me.authenticated]);

  const rail = useMemo(() => getWorkspaceRail(pathname), [pathname]);
  const context = useMemo(() => getWorkspaceContext(pathname), [pathname]);
  const activeRailIndex = useMemo(() => {
    const exact = rail.findIndex((item) => targetMatchesCurrent(item.href, pathname, searchParams, hash));
    if (exact >= 0) return exact;
    if (pathname === "/portal") return 0;
    return Math.max(0, rail.findIndex((item) => new URL(item.href, "https://scenova.local").pathname === pathname));
  }, [rail, pathname, searchParams, hash]);

  if (checking || !me.authenticated) return <LoadingWorkspace />;

  const navLink = (item: WorkspaceNavItem) => {
    const isGuide = item.href === "/portal#guide";
    const active = isGuide
      ? pathname === "/portal" && hash === "#guide"
      : item.href === "/portal"
        ? pathname === "/portal" && hash !== "#guide"
        : isWorkspaceNavActive(item, pathname);
    return <Link key={item.href} href={item.href} prefetch={false} className={active ? styles.active : ""} aria-current={active ? "page" : undefined} title={item.description}>
      <span className={styles.navIcon}><Icon name={item.icon} />{item.badge ? <b>{item.badge}</b> : null}</span>
      <span className={styles.navText}>{item.label}</span>
    </Link>;
  };

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/portal" className={styles.brand} prefetch={false} aria-label="SCENOVA Studio — หน้าเริ่มต้น">
        <span className={styles.logo}><ScenovaMark /></span>
        <span className={styles.brandName}>SCENOVA</span>
        <small>STUDIO</small>
      </Link>

      <nav className={styles.mainNav} aria-label="เมนูหลัก">{WORKSPACE_NAV.map(navLink)}</nav>

      <div className={styles.sidebarBottom}>
        <Link href="/wallet" prefetch={false} className={styles.creditShortcut}>
          <small>เครดิตของคุณ</small>
          <strong>{formatCredits(balance?.available)}</strong>
          <span>เครดิต</span>
          <b>เติมเครดิต</b>
        </Link>
        <Link href="/profile" prefetch={false} className={styles.profileCard}>
          <span className={styles.profileAvatar}><Icon name="profile" /></span>
          <span className={styles.profileCopy}><b>{me.name || "SCENOVA"}</b><small>{me.role === "ADMIN" ? "Administrator" : "สมาชิก SCENOVA"}</small></span>
          <span className={styles.profileArrow}><Icon name="arrow" /></span>
        </Link>
      </div>
    </aside>

    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <nav className={styles.subNav} aria-label={`ขั้นตอน ${context}`}>
          {rail.map((item, index) => <Link key={item.href} href={item.href} prefetch={false} className={index === activeRailIndex ? styles.subActive : ""} aria-current={index === activeRailIndex ? "step" : undefined}>
            <span className={styles.railIcon}>{item.icon}</span>
            <span className={styles.railCopy}><b>{item.label}</b><small>{item.description}</small></span>
          </Link>)}
        </nav>
        <Link className={styles.helpLink} href="/portal#guide" prefetch={false}><span>?</span><b>คู่มือการใช้งาน</b></Link>
      </header>
      <div className={styles.page} data-workspace={context}>{children}</div>
    </div>
  </div>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login") return <>{children}</>;
  return <Suspense fallback={<LoadingWorkspace />}><WorkspaceShell pathname={pathname}>{children}</WorkspaceShell></Suspense>;
}
