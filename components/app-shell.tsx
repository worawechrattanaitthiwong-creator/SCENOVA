"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getWorkspaceContext, getWorkspaceRail, WORKSPACE_NAV, type WorkspaceNavItem } from "@/lib/workspace-navigation";
import styles from "./app-shell.module.css";

type Me = { authenticated: boolean; name?: string; email?: string; role?: "ADMIN" | "MEMBER"; twoFactorEnabled?: boolean };
type Balance = { paid: number; bonus: number; reserved: number; available: number };

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

function targetMatchesCurrent(href: string, pathname: string, search: URLSearchParams, hash: string) {
  const target = new URL(href, "https://scenova.local");
  if (target.pathname !== pathname) return false;

  for (const [key, value] of target.searchParams.entries()) {
    if (search.get(key) !== value) return false;
  }

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
    if (authLoaded.current) {
      setChecking(false);
      return;
    }

    let active = true;
    setChecking(true);
    fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((data: Me) => {
        if (!active) return;
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
        if (!active) return;
        setChecking(false);
        router.replace("/login");
      });
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
    const active = item.href === "/portal" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
    return <Link key={item.href} href={item.href} prefetch={false} className={active ? styles.active : ""} aria-current={active ? "page" : undefined} title={item.description}>
      <span className={styles.navIcon}>{item.icon}</span>
      <span className={styles.navText}><b>{item.label}</b><small>{item.description}</small></span>
    </Link>;
  };

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/portal" className={styles.brand} prefetch={false} aria-label="SCENOVA Studio — หน้าเริ่มต้น">
        <span className={styles.logo}><ScenovaMark /></span>
        <span className={styles.brandName}>SCENOVA</span>
        <small>STUDIO</small>
      </Link>

      <nav className={styles.mainNav} aria-label="เมนูหลัก">
        {WORKSPACE_NAV.map(navLink)}
      </nav>

      <div className={styles.sidebarBottom}>
        <Link href="/wallet" prefetch={false} className={styles.creditShortcut}>
          <small>เครดิตของคุณ</small>
          <strong>{formatCredits(balance?.available)}</strong>
          <span>เครดิต</span>
          <b>เติมเครดิต</b>
        </Link>
        {me.role === "ADMIN" ? <Link href="/admin" prefetch={false} className={`${styles.adminShortcut} ${pathname.startsWith("/admin") ? styles.active : ""}`}><span className={styles.navIcon}>⚙</span><span className={styles.navText}><b>Admin Console</b><small>จัดการระบบ</small></span></Link> : null}
        <Link href="/profile" prefetch={false} className={styles.profileCard}>
          <span className={styles.profileAvatar}>{me.name?.slice(0, 1).toUpperCase() || "U"}</span>
          <span className={styles.profileCopy}><b>{me.name || "SCENOVA"}</b><small>{me.role === "ADMIN" ? "Administrator" : "สมาชิก SCENOVA"}</small></span>
          <span className={styles.profileArrow}>›</span>
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
