"use client";

// Portal-only presentation layer. Authentication, session verification and backend flows stay unchanged.
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./portal.module.css";

type Me = { authenticated: boolean; name?: string; email?: string; role?: "ADMIN" | "MEMBER"; twoFactorEnabled?: boolean };
type Balance = { paid: number; bonus: number; reserved: number; available: number };
type IconName =
  | "home" | "project" | "ai" | "board" | "library" | "settings" | "help"
  | "setup" | "people" | "camera" | "play" | "spark" | "prompt" | "lock"
  | "shield" | "episodes" | "profile" | "arrow";

const SIDE_NAV: ReadonlyArray<{ href: string; icon: IconName; label: string; badge?: string }> = [
  { href: "/portal", icon: "home", label: "เริ่มต้น" },
  { href: "/series", icon: "project", label: "โปรเจกต์", badge: "EP" },
  { href: "/studio", icon: "ai", label: "AI Studio", badge: "AI" },
  { href: "/director", icon: "board", label: "สตอรี่บอร์ด" },
  { href: "/libraries", icon: "library", label: "คลังทรัพยากร" },
  { href: "/profile", icon: "settings", label: "การตั้งค่า" },
  { href: "/portal#guide", icon: "help", label: "ช่วยเหลือ" },
];

const WORKFLOW: ReadonlyArray<{ href: string; icon: IconName; title: string; detail: string }> = [
  { href: "/studio#setup", icon: "setup", title: "ตั้งค่างาน", detail: "เริ่มต้นโปรเจกต์" },
  { href: "/studio#characters", icon: "people", title: "ตัวละครและเสียง", detail: "ล็อกตัวละครและเสียง" },
  { href: "/studio#scenes", icon: "camera", title: "กำกับฉาก", detail: "ภาพ แสง การเคลื่อนไหว" },
  { href: "/libraries?tab=characters", icon: "library", title: "คลังตัวละคร", detail: "จัดการตัวละคร" },
];

const TEMPLATES = [
  { title: "Sci-Fi Future", detail: "โลกอนาคต ไซไฟ", image: "/library/styles/sci-fi-neon.png" },
  { title: "Fantasy Epic", detail: "แฟนตาซี ผจญภัย", image: "/library/styles/fantasy-storybook.png" },
  { title: "Action Thriller", detail: "แอ็กชัน ระทึกขวัญ", image: "/library/styles/action-blockbuster.png" },
  { title: "Romance Drama", detail: "ดราม่า โรแมนติก", image: "/library/styles/cinematic-romance.png" },
  { title: "Horror Mystery", detail: "สยองขวัญ ลึกลับ", image: "/library/styles/gothic-horror.png" },
] as const;

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
    {name === "ai" || name === "spark" ? <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m18.8 15.8.7 2.2 2.2.7-2.2.8-.7 2.2-.8-2.2-2.2-.8 2.2-.7.8-2.2Z" /></> : null}
    {name === "board" || name === "setup" ? <><rect x="3" y="5" width="18" height="15" rx="2.3" /><path d="m4 9 16-4M7 4l2.2 4M12 3l2.2 4M17 2l2.2 4M7 13h10M7 16h6" /></> : null}
    {name === "library" ? <><path d="M3.5 7.5h6l1.6 2H20a1.5 1.5 0 0 1 1.5 1.5v7A2.5 2.5 0 0 1 19 20.5H5A2.5 2.5 0 0 1 2.5 18V9a1.5 1.5 0 0 1 1-1.5Z" /><path d="M4 7.5V5.8A2.3 2.3 0 0 1 6.3 3.5h3.8l1.7 2H18A2 2 0 0 1 20 7v2.5" /></> : null}
    {name === "settings" ? <><circle cx="12" cy="12" r="3.2" /><path d="M19 13.5v-3l-2-.7a7.7 7.7 0 0 0-.7-1.6l.9-1.9-2.1-2.1-1.9.9a7.7 7.7 0 0 0-1.7-.7l-.7-2h-3l-.7 2a7.7 7.7 0 0 0-1.6.7l-1.9-.9-2.1 2.1.9 1.9a7.7 7.7 0 0 0-.7 1.6l-2 .7v3l2 .7c.2.6.4 1.1.7 1.7l-.9 1.9 2.1 2.1 1.9-.9c.5.3 1 .5 1.6.7l.7 2h3l.7-2c.6-.2 1.2-.4 1.7-.7l1.9.9 2.1-2.1-.9-1.9c.3-.5.5-1.1.7-1.7l2-.7Z" /></> : null}
    {name === "help" ? <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.4 2.4 0 1 1 3.1 2.3c-.8.3-.8 1-.8 1.7M12 17h.01" /></> : null}
    {name === "people" ? <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19M15.5 5.3a3 3 0 0 1 0 5.4M17 13.2a4.4 4.4 0 0 1 3.5 4.3V19" /></> : null}
    {name === "camera" ? <><path d="M4 19 7 8l4 4 4-7 5 14H4Z" /><path d="m8 15 2 2 3-4 3 3" /></> : null}
    {name === "play" ? <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></> : null}
    {name === "prompt" ? <><path d="m14.7 5.3 4 4L9 19l-5 1 1-5 9.7-9.7Z" /><path d="m12.7 7.3 4 4M4 22h16" /></> : null}
    {name === "lock" ? <><rect x="5" y="10" width="14" height="11" rx="2.5" /><path d="M8.3 10V7.2a3.7 3.7 0 0 1 7.4 0V10M12 14v3" /></> : null}
    {name === "shield" ? <><path d="M12 2.5 20 6v5.6c0 4.9-3.4 8.2-8 9.9-4.6-1.7-8-5-8-9.9V6l8-3.5Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></> : null}
    {name === "episodes" ? <><rect x="5.5" y="5.5" width="13" height="13" rx="2" /><path d="M8.5 2.5h8M8.5 21.5h8M9.5 9l5 3-5 3V9Z" /></> : null}
    {name === "profile" ? <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></> : null}
    {name === "arrow" ? <><path d="M5 12h14M14 7l5 5-5 5" /></> : null}
  </svg>;
}

function ScenovaMark() {
  return <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="portal-logo-gold" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fff0a8" />
        <stop offset=".45" stopColor="#e8b83d" />
        <stop offset="1" stopColor="#80601e" />
      </linearGradient>
    </defs>
    <path d="M32 7c9.5 0 17.7 5.7 21.2 13.8l-13.5 1.8a11.5 11.5 0 0 0-18.8 2.3L13 14.1A23.5 23.5 0 0 1 32 7Z" fill="none" stroke="url(#portal-logo-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#portal-logo-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(120 32 32)" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#portal-logo-gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(240 32 32)" />
    <path d="M32 23.8 34.7 29l5.5 3-5.5 2.8L32 40l-2.7-5.2-5.5-2.8 5.5-3 2.7-5.2Z" fill="url(#portal-logo-gold)" />
  </svg>;
}

function formatCredits(value: number | undefined) {
  if (value === undefined) return "—";
  return Number(value).toLocaleString("th-TH", { maximumFractionDigits: 2 });
}

export default function PortalPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me>({ authenticated: false });
  const [ready, setReady] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me?t=" + Date.now(), {
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache" },
    })
      .then((response) => response.json())
      .then((data: Me) => {
        if (!alive) return;
        if (!data.authenticated) return router.replace("/login");
        setMe(data);
        setReady(true);
        ["/studio", "/series", "/director", "/libraries", "/models", "/wallet", "/profile"].forEach((route) => router.prefetch(route));
      })
      .catch(() => router.replace("/login"));
    return () => { alive = false; };
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    fetch("/api/cost/activity?limit=1", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => { if (alive && data?.balance) setBalance(data.balance); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [ready]);

  if (!ready) {
    return <main className={styles.loading} aria-live="polite">
      <div className={styles.loadingMark}><ScenovaMark /></div>
      <span>SCENOVA STUDIO</span>
      <small>กำลังตรวจสอบ Session และเปิดพื้นที่ทำงาน…</small>
    </main>;
  }

  return <main className={styles.portal}>
    <aside className={styles.sidebar}>
      <Link href="/portal" className={styles.brand} aria-label="SCENOVA Studio — หน้าเริ่มต้น">
        <span className={styles.brandMark}><ScenovaMark /></span>
        <span className={styles.brandName}>SCENOVA</span>
        <small>STUDIO</small>
      </Link>

      <nav className={styles.sideNav} aria-label="เมนูหลัก">
        {SIDE_NAV.map((item, index) => <Link
          key={item.href + item.label}
          href={item.href}
          prefetch={false}
          className={index === 0 ? styles.sideActive : ""}
          aria-current={index === 0 ? "page" : undefined}
        >
          <span className={styles.sideIcon}>{item.badge ? <b>{item.badge}</b> : <Icon name={item.icon} />}</span>
          <span>{item.label}</span>
        </Link>)}
      </nav>

      <div className={styles.sidebarBottom}>
        <Link href="/wallet" className={styles.creditCard} prefetch={false}>
          <small>เครดิตของคุณ</small>
          <strong>{formatCredits(balance?.available)}</strong>
          <span>เครดิต</span>
          <b>เติมเครดิต</b>
        </Link>
        <Link href="/profile" className={styles.profileCard} prefetch={false}>
          <span className={styles.avatar}><Icon name="profile" /></span>
          <span className={styles.profileCopy}><b>{me.name || "SCENOVA"}</b><small>{me.role === "ADMIN" ? "Administrator" : "สมาชิกระดับ Pro"}</small></span>
          <span className={styles.profileArrow}>›</span>
        </Link>
      </div>
    </aside>

    <section className={styles.workspace}>
      <header className={styles.workflowBar}>
        <nav className={styles.workflow} aria-label="ขั้นตอนสร้างงาน">
          {WORKFLOW.map((item, index) => <Link key={item.href} href={item.href} prefetch={false} className={index === 0 ? styles.workflowActive : ""}>
            <span className={styles.workflowIcon}><Icon name={item.icon} /></span>
            <span><b>{item.title}</b><small>{item.detail}</small></span>
          </Link>)}
        </nav>
        <Link href="/portal#guide" className={styles.guideButton}><Icon name="help" /><span>คู่มือการใช้งาน</span></Link>
      </header>

      <div className={styles.content}>
        <section className={styles.hero} aria-labelledby="portal-title">
          <Image className={styles.heroImage} src="/media/scenova-studio-hero.png" alt="ฉากสตูดิโอภาพยนตร์ที่มีกล้องและเก้าอี้ผู้กำกับ" fill priority quality={88} sizes="(max-width: 900px) 100vw, (max-width: 1220px) calc(100vw - 86px), calc(100vw - 218px)" />
          <div className={styles.heroShade} aria-hidden />
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>SCENOVA PRODUCTION STUDIO</span>
            <h1 id="portal-title">Cinematic Studio <span>—</span><br /><em>สตูดิโอสร้างภาพยนตร์ AI</em></h1>
            <p>เส้นทางการสร้างงาน: ตั้งค่างาน → ตัวละคร → กำกับฉากและเสียง<br />ละเอียดขึ้นตามโหมดที่เลือก เพื่อผลงานระดับภาพยนตร์</p>
          </div>

          <div className={styles.heroActions}>
            <Link href="/studio" prefetch={false} className={styles.actionCard}>
              <span className={styles.actionIcon}><Icon name="play" /></span>
              <span><b>Studio พร้อมใช้งาน</b><small>เริ่มโปรเจกต์ใหม่</small></span>
              <Icon name="arrow" />
            </Link>
            <Link href="/agent" prefetch={false} className={[styles.actionCard, styles.actionPrimary].join(" ")}>
              <span className={styles.actionIcon}><Icon name="spark" /></span>
              <span><b>AI ช่วยสร้างทั้งงาน</b><small>สร้างงานอัตโนมัติด้วย AI</small></span>
              <Icon name="arrow" />
            </Link>
            <Link href="/studio#review" prefetch={false} className={[styles.actionCard, styles.actionGold].join(" ")}>
              <span className={styles.actionIcon}><Icon name="prompt" /></span>
              <span><b>Prompt Generator</b><small>สร้าง Prompt ขั้นสูง</small></span>
              <Icon name="arrow" />
            </Link>
          </div>

          <div className={styles.featureRail} id="guide">
            <Link href="/models" prefetch={false}>
              <span className={styles.featureIcon}><Icon name="shield" /></span>
              <span><b>Model Lock</b><small>ล็อกโมเดลที่เลือก ใช้งานต่อเนื่องทั้งโปรเจกต์</small></span>
            </Link>
            <Link href="/series#continuity" prefetch={false}>
              <span className={styles.featureIcon}><Icon name="lock" /></span>
              <span><b>Consistency Lock</b><small>ล็อกตัวละคร สไตล์ เสียง และองค์ประกอบ</small></span>
            </Link>
            <Link href="/director" prefetch={false}>
              <span className={styles.featureIcon}><Icon name="board" /></span>
              <span><b>Cinematic Control</b><small>ควบคุมกล้อง แสง มุมภาพ เลนส์ และอารมณ์</small></span>
            </Link>
            <Link href="/series" prefetch={false}>
              <span className={styles.featureIcon}><Icon name="episodes" /></span>
              <span><b>Multi-Episode</b><small>สร้างซีรีส์ยาวต่อเนื่อง สูงสุด 3 นาที/ตอน</small></span>
            </Link>
          </div>
        </section>

        <section className={styles.templates} aria-labelledby="template-heading">
          <div className={styles.sectionHead}>
            <div><span>START WITH A LOOK</span><h2 id="template-heading">เริ่มสร้างจากเทมเพลต</h2></div>
            <Link href="/libraries?tab=images" prefetch={false}>ดูทั้งหมด <span>›</span></Link>
          </div>
          <div className={styles.templateGrid}>
            {TEMPLATES.map((template) => <Link href="/libraries?tab=images" prefetch={false} key={template.title} className={styles.templateCard}>
              <Image src={template.image} alt={"ตัวอย่างสไตล์ " + template.title} fill sizes="(max-width: 900px) 215px, 20vw" />
              <span className={styles.templateShade} aria-hidden />
              <span className={styles.templateCopy}><b>{template.title}</b><small>{template.detail}</small></span>
              <span className={styles.templateArrow}><Icon name="arrow" /></span>
            </Link>)}
          </div>
        </section>
      </div>
    </section>
  </main>;
}
