import Image from "next/image";
import Link from "next/link";
import CarouselRow, { CharacterTemplateRow } from "./carousel-row";
import styles from "./portal.module.css";
import refine from "./portal-refine.module.css";

const QUICK_ACTIONS = [
  { href: "/agent", icon: "spark", title: "สร้างด้วย AI", tone: "violet" },
  { href: "/studio#setup", icon: "script", title: "เขียนบทด้วย AI", tone: "gold" },
  { href: "/studio#characters", icon: "character", title: "สร้างตัวละคร", tone: "rose" },
  { href: "/studio#scenes", icon: "scene", title: "ออกแบบฉาก", tone: "blue" },
  { href: "/libraries?tab=voices", icon: "sound", title: "เสียงและดนตรี", tone: "cyan" },
  { href: "/render", icon: "render", title: "สร้างวิดีโอ", tone: "amber" },
] as const;

const TEMPLATES = [
  { title: "Neo Noir", image: "/library/styles/dark-thriller.png" },
  { title: "Cyberpunk City", image: "/library/styles/sci-fi-neon.png" },
  { title: "Epic Fantasy", image: "/library/styles/fantasy-storybook.png" },
  { title: "Action Blockbuster", image: "/library/styles/action-blockbuster.png" },
  { title: "Romantic Drama", image: "/library/styles/cinematic-romance.png" },
  { title: "Horror Mystery", image: "/library/styles/gothic-horror.png" },
  { title: "Cinematic Anime", image: "/library/styles/cinematic-anime.png" },
  { title: "Period Drama", image: "/library/styles/period-drama.png" },
  { title: "Golden Hour", image: "/library/styles/warm-golden-hour.png" },
  { title: "Photorealistic Film", image: "/library/styles/photorealistic-film.png" },
] as const;

function Arrow() {
  return <span aria-hidden="true">→</span>;
}

function QuickIcon({ name }: { name: (typeof QUICK_ACTIONS)[number]["icon"] }) {
  const common = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "spark") return <svg {...common} aria-hidden="true"><path d="M12 2.8 13.8 8l5.2 1.8-5.2 1.8L12 17l-1.8-5.4L5 9.8 10.2 8 12 2.8Z"/><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></svg>;
  if (name === "script") return <svg {...common} aria-hidden="true"><path d="M6.5 3.5h8.8l2.2 2.3v14.7h-11Z"/><path d="M15 3.7V6h2.2M9.3 10h5.4M9.3 13.5h5.4M9.3 17h3.2"/></svg>;
  if (name === "character") return <svg {...common} aria-hidden="true"><circle cx="12" cy="8" r="3.2"/><path d="M5.8 20c.7-4 3-6 6.2-6s5.5 2 6.2 6"/><path d="M4 6.5v-2h2M20 6.5v-2h-2M4 17.5v2h2M20 17.5v2h-2"/></svg>;
  if (name === "scene") return <svg {...common} aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="m6.5 16 4-4 2.8 2.8 2.2-2.2 2.5 3.4M16.5 8.3h.01"/></svg>;
  if (name === "sound") return <svg {...common} aria-hidden="true"><path d="M5 14V9.5l10-2V12M5 14a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm10-2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM15 7.5V4"/></svg>;
  return <svg {...common} aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m10 9 5 3-5 3V9ZM7 2.8v2.1M17 2.8v2.1"/></svg>;
}

function SectionHeading({ title, id, href }: { title: string; id: string; href?: string }) {
  return <div className={`${styles.sectionHead} ${refine.sectionHead}`}>
    <div className={`${styles.sectionTitle} ${refine.sectionTitle}`}><h2 id={id}>{title}</h2></div>
    {href ? <Link href={href} prefetch={false} className={`${styles.viewAll} ${refine.viewAll}`}>ดูทั้งหมด <Arrow /></Link> : null}
  </div>;
}

export default function PortalPage() {
  return <main className={`${styles.dashboard} ${refine.dashboard}`}>
    <section className={`${styles.hero} ${refine.hero}`} aria-label="SCENOVA AI Film Studio">
      <div className={refine.heroVisual} aria-hidden="true">
        <img className={`${styles.heroImage} ${refine.heroImage}`} src="/media/scenova-portal-hero.png" alt="" fetchPriority="high" decoding="sync" />
        <span className={refine.heroVisualShade} />
        <span className={refine.heroVisualLabel}>SCENOVA ORIGINAL</span>
      </div>
      <span className={`${styles.heroScrim} ${refine.heroScrim}`} aria-hidden="true" />
      <span className={styles.heroClouds} aria-hidden="true" />
      <span className={styles.heroLights} aria-hidden="true" />
      <div className={`${styles.heroContent} ${refine.heroContent}`}>
        <span className={refine.heroKicker}>SCENOVA AI FILM STUDIO</span>
        <h1>เปลี่ยนทุกไอเดีย<br/><em>ให้เป็นภาพยนตร์ของคุณ</em></h1>
        <p className={refine.heroLead}>วางโครงเรื่อง ออกแบบตัวละคร สร้างฉาก เสียง และวิดีโอในเวิร์กโฟลว์เดียว พร้อมควบคุมทิศทางงานได้ทุกขั้นตอน</p>
        <div className={`${styles.heroActions} ${refine.heroActions}`}>
          <Link href="/studio" className={styles.heroPrimary}>เริ่มโปรเจกต์ใหม่ <Arrow /></Link>
          <Link href="/guide" className={styles.heroSecondary}><span aria-hidden="true">▶</span> ดูขั้นตอนการทำงาน</Link>
        </div>
        <div className={refine.heroCapabilities} aria-label="ความสามารถหลัก">
          <span>เขียนบท</span><i aria-hidden="true" /><span>สร้างภาพ</span><i aria-hidden="true" /><span>สร้างวิดีโอ</span>
        </div>
      </div>
    </section>

    <section className={`${styles.quickSection} ${refine.section} ${refine.quickSection}`} aria-labelledby="quick-title">
      <SectionHeading id="quick-title" title="เริ่มสร้างได้ทันที" />
      <div className={`${styles.quickGrid} ${refine.quickGrid}`}>
        {QUICK_ACTIONS.map((item, index) => <Link href={item.href} prefetch={false} key={item.title} className={`${styles.quickCard} ${refine.quickCard}`} data-tone={item.tone}>
          <span className={`${styles.quickNumber} ${refine.quickNumber}`}>{String(index + 1).padStart(2, "0")}</span>
          <span className={`${styles.quickIcon} ${refine.quickIcon}`}><QuickIcon name={item.icon} /></span>
          <span className={styles.quickCopy}><b>{item.title}</b></span>
          <span className={`${styles.quickArrow} ${refine.quickArrow}`}><Arrow /></span>
        </Link>)}
      </div>
    </section>

    <section className={`${styles.templates} ${refine.section} ${refine.templateSection}`} aria-labelledby="template-heading">
      <SectionHeading id="template-heading" title="เลือกแนวภาพยนตร์" href="/libraries?tab=images" />
      <CarouselRow label="เทมเพลตและแนวภาพยนตร์">
        {TEMPLATES.map((template) => <Link href="/libraries?tab=images" prefetch={false} key={template.title} className={`${styles.templateCard} ${refine.templateCard}`}>
          <Image src={template.image} alt={`ตัวอย่างสไตล์ ${template.title}`} fill sizes="(max-width: 700px) 86vw, 340px" />
          <span className={`${styles.templateShade} ${refine.templateShade}`} aria-hidden="true" />
          <span className={`${styles.templateCopy} ${refine.templateCopy}`}><b>{template.title}</b></span>
          <span className={`${styles.templateArrow} ${refine.templateArrow}`}><Arrow /></span>
        </Link>)}
      </CarouselRow>
    </section>

    <section className={`${styles.templates} ${styles.characterSection} ${refine.section} ${refine.characterSection}`} aria-labelledby="character-heading">
      <SectionHeading id="character-heading" title="เลือกตัวละครเริ่มต้น" href="/studio#characters" />
      <CharacterTemplateRow />
    </section>
  </main>;
}
