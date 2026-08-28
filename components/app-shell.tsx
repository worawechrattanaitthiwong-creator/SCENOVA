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
type ThemeMode = "dark" | "light";

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
    {name === "help" ? <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></> : null}
    {name === "profile" ? <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></> : null}
    {name === "arrow" ? <><path d="M5 12h14M14 7l5 5-5 5" /></> : null}
  </svg>;
}

function ScenovaMark() {
  return <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="workspace-logo-brand" x1="8" y1="7" x2="56" y2="57" gradientUnits="userSpaceOnUse">
        <stop stopColor="#d99cff" />
        <stop offset=".28" stopColor="#a25cff" />
        <stop offset=".58" stopColor="#f4d56d" />
        <stop offset="1" stopColor="#9b6d23" />
      </linearGradient>
      <radialGradient id="workspace-logo-core" cx="0" cy="0" r="1" gradientTransform="translate(29 27) rotate(45) scale(20)">
        <stop stopColor="#f9dc7b" />
        <stop offset=".5" stopColor="#bd6dff" />
        <stop offset="1" stopColor="#743cff" />
      </radialGradient>
    </defs>
    <path d="M32 7c9.5 0 17.7 5.7 21.2 13.8l-13.5 1.8a11.5 11.5 0 0 0-18.8 2.3L13 14.1A23.5 23.5 0 0 1 32 7Z" fill="none" stroke="url(#workspace-logo-brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#workspace-logo-brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(120 32 32)" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#workspace-logo-brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(240 32 32)" />
    <path d="M32 23.8 34.7 29l5.5 3-5.5 2.8L32 40l-2.7-5.2-5.5-2.8 5.5-3 2.7-5.2Z" fill="url(#workspace-logo-core)" />
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
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const authLoaded = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("scenova-theme");
    const next: ThemeMode = saved === "light" || saved === "dark" ? saved : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

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

  function applyTheme(next: ThemeMode) {
    setTheme(next);
    localStorage.setItem("scenova-theme", next);
    document.documentElement.dataset.theme = next;
  }

  const rawRail = useMemo(() => getWorkspaceRail(pathname), [pathname]);
  const rail = useMemo(() => rawRail.filter((item) => !item.adminOnly || me.role === "ADMIN"), [rawRail, me.role]);
  const context = useMemo(() => getWorkspaceContext(pathname), [pathname]);
  const hideTopbar = pathname === "/studio";
  const activeRailIndex = useMemo(() => {
    const exact = rail.findIndex((item) => targetMatchesCurrent(item.href, pathname, searchParams, hash));
    if (exact >= 0) return exact;
    if (pathname === "/portal") return 0;
    return Math.max(0, rail.findIndex((item) => new URL(item.href, "https://scenova.local").pathname === pathname));
  }, [rail, pathname, searchParams, hash]);

  if (!checking && !me.authenticated) return null;

  const navLink = (item: WorkspaceNavItem) => {
    const isAdminUsers = item.href === "/portal#guide";
    if (isAdminUsers && me.role !== "ADMIN") return null;
    const effectiveHref = isAdminUsers ? "/admin/users" : item.href;
    const effectiveLabel = isAdminUsers ? "จัดการผู้ใช้" : item.label;
    const effectiveDescription = isAdminUsers ? "ค้นหา บัญชี รหัสผ่าน เครดิต การบล็อก และ Log" : item.description;
    let active = isAdminUsers ? pathname.startsWith("/admin/users") : isWorkspaceNavActive(item, pathname);
    if (item.href === "/profile" && pathname.startsWith("/admin/users")) active = false;
    return <Link key={item.href} href={effectiveHref} prefetch={false} className={active ? styles.active : ""} aria-current={active ? "page" : undefined} title={effectiveDescription}>
      <span className={styles.navIcon}>{item.badge ? <b>{item.badge}</b> : <Icon name={isAdminUsers ? "profile" : item.icon} />}</span>
      <span className={styles.navText}>{effectiveLabel}</span>
    </Link>;
  };

  return <div className={styles.shell} data-sc-shell>
    <aside className={styles.sidebar} data-sc-sidebar>
      <Link href="/portal" className={styles.brand} prefetch={false} aria-label="SCENOVA Studio — หน้าเริ่มต้น">
        <span className={styles.logo}><ScenovaMark /></span>
        <span className={styles.brandName}>SCENOVA</span>
        <small data-keep-small>STUDIO</small>
      </Link>

      <nav className={styles.mainNav} data-sc-main-nav aria-label="เมนูหลัก">{WORKSPACE_NAV.map(navLink)}</nav>

      <div className={styles.sidebarBottom}>
        <div className="sc-theme-switch" role="group" aria-label="ธีมหน้าจอ">
          <button type="button" data-active={theme === "light"} aria-pressed={theme === "light"} onClick={() => applyTheme("light")}>☀ ขาว</button>
          <button type="button" data-active={theme === "dark"} aria-pressed={theme === "dark"} onClick={() => applyTheme("dark")}>☾ มืด</button>
        </div>
        <Link href="/wallet" prefetch={false} className={styles.creditShortcut} data-sc-credit>
          <small>เครดิตของคุณ</small>
          <strong>{formatCredits(balance?.available)}</strong>
          <span>เครดิต</span>
          <b>เติมเครดิต</b>
        </Link>
        <Link href="/profile" prefetch={false} className={styles.profileCard} data-sc-profile>
          <span className={styles.profileAvatar}><Icon name="profile" /></span>
          <span className={styles.profileCopy}><b>{me.name || "SCENOVA"}</b><small>{me.role === "ADMIN" ? "Administrator" : "สมาชิก SCENOVA"}</small></span>
          <span className={styles.profileArrow}><Icon name="arrow" /></span>
        </Link>
      </div>
    </aside>

    <div className={styles.workspace} data-sc-workspace style={hideTopbar ? { gridTemplateRows: "minmax(0, 1fr)" } : undefined}>
      {!hideTopbar ? <header className={styles.topbar} data-sc-topbar>
        <nav className={styles.subNav} data-sc-sub-nav aria-label={`ขั้นตอน ${context}`}>
          {rail.map((item, index) => {
            const effectiveHref = item.href === "/portal#guide" ? "/guide" : item.href;
            return <Link key={item.href} href={effectiveHref} prefetch={false} className={index === activeRailIndex ? styles.subActive : ""} aria-current={index === activeRailIndex ? "step" : undefined}>
              <span className={styles.railIcon}>{item.icon}</span>
              <span className={styles.railCopy}><b>{item.label}</b><small>{item.description}</small></span>
            </Link>;
          })}
        </nav>
        <Link className={styles.helpLink} href="/guide" prefetch={false}><span>?</span><b>คู่มือการใช้งาน</b></Link>
      </header> : null}
      <div className={styles.page} data-sc-page data-workspace={context}>{children}</div>
    </div>
  </div>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login") return <>{children}</>;
  return <Suspense fallback={null}><WorkspaceShell pathname={pathname}>{children}</WorkspaceShell></Suspense>;
}