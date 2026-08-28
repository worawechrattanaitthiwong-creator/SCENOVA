import Image from "next/image";
import Link from "next/link";
import CarouselRow, { CharacterTemplateRow } from "./carousel-row";
import styles from "./portal.module.css";

const QUICK_ACTIONS = [
  { href: "/agent", icon: "spark", title: "สร้างด้วย AI", detail: "เริ่มโปรเจกต์จากไอเดียเดียว", tone: "violet" },
  { href: "/studio#setup", icon: "script", title: "เขียนบทด้วย AI", detail: "วางพล็อตและบทสนทนา", tone: "gold" },
  { href: "/studio#characters", icon: "character", title: "สร้างตัวละคร", detail: "ล็อกหน้าตา บุคลิก และเสียง", tone: "rose" },
  { href: "/studio#scenes", icon: "scene", title: "ออกแบบฉาก", detail: "กำหนดภาพ แสง และสถานที่", tone: "blue" },
  { href: "/libraries?tab=voices", icon: "sound", title: "เสียงและดนตรี", detail: "เสียงพากย์ ดนตรี และ SFX", tone: "cyan" },
  { href: "/render", icon: "render", title: "สร้างวิดีโอ", detail: "เรนเดอร์และติดตามผลงาน", tone: "amber" },
] as const;

const TEMPLATES = [
  { title: "Neo Noir", detail: "อาชญากรรม · ดราม่า · ลึกลับ", image: "/library/styles/dark-thriller.png" },
  { title: "Cyberpunk City", detail: "ไซไฟ · เทคโนโลยี · อนาคต", image: "/library/styles/sci-fi-neon.png" },
  { title: "Epic Fantasy", detail: "แฟนตาซี · ผจญภัย · มหากาพย์", image: "/library/styles/fantasy-storybook.png" },
  { title: "Action Blockbuster", detail: "แอ็กชัน · ผจญภัย · ระทึกขวัญ", image: "/library/styles/action-blockbuster.png" },
  { title: "Romantic Drama", detail: "โรแมนติก · ดราม่า · ความสัมพันธ์", image: "/library/styles/cinematic-romance.png" },
  { title: "Horror Mystery", detail: "สยองขวัญ · ลึกลับ · ระทึกใจ", image: "/library/styles/gothic-horror.png" },
  { title: "Cinematic Anime", detail: "แอนิเมชัน · สดใส · เหนือจินตนาการ", image: "/library/styles/cinematic-anime.png" },
  { title: "Period Drama", detail: "ย้อนยุค · ละเมียดละไม · ดราม่า", image: "/library/styles/period-drama.png" },
  { title: "Golden Hour", detail: "อบอุ่น · เป็นธรรมชาติ · อารมณ์ดี", image: "/library/styles/warm-golden-hour.png" },
  { title: "Photorealistic Film", detail: "สมจริง · ภาพยนตร์ · รายละเอียดสูง", image: "/library/styles/photorealistic-film.png" },
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

function SectionHeading({ eyebrow, title, detail, id, href }: {
  eyebrow: string;
  title: string;
  detail: string;
  id: string;
  href?: string;
}) {
  return <div className={styles.sectionHead}>
    <div className={styles.sectionTitle}>
      <span className={styles.sectionEyebrow}>{eyebrow}</span>
      <h2 id={id}>{title}</h2>
      <p>{detail}</p>
    </div>
    {href ? <Link href={href} prefetch={false} className={styles.viewAll}>ดูทั้งหมด <Arrow /></Link> : null}
  </div>;
}

export default function PortalPage() {
  return <main className={styles.dashboard}>
    <header className={styles.utilityBar}>
      <div className={styles.portalIdentity}>
        <span className={styles.identityMark} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5 14.1 9l6.4 2.1-6.4 2.1L12 19.5l-2.1-6.3-6.4-2.1L9.9 9 12 2.5Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="11" r="2.2" fill="currentColor"/></svg></span>
        <div className={styles.welcome}>
          <small data-keep-small="true">SCENOVA CREATIVE COMMAND</small>
          <strong>สตูดิโอภาพยนตร์ของคุณ</strong>
        </div>
        <span className={styles.liveBadge}><i /> พร้อมสร้าง</span>
      </div>
      <form className={styles.search} action="/libraries" method="get">
        <input type="hidden" name="tab" value="images" />
        <span aria-hidden><svg viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.7"/><path d="m15 15 4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg></span>
        <input name="q" type="search" placeholder="ค้นหาโปรเจกต์ เทมเพลต เครื่องมือ..." aria-label="ค้นหาใน SCENOVA" />
        <kbd>CTRL K</kbd>
      </form>
      <div className={styles.utilityActions}>
        <Link href="/guide" aria-label="เปิดคู่มือ"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5"/><path d="M9.8 9a2.3 2.3 0 0 1 4.5.7c0 1.8-2.3 2-2.3 3.7M12 17.2h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg></Link>
        <Link href="/profile" className={styles.accountButton} aria-label="เปิดโปรไฟล์"><span>SC</span><i aria-hidden="true" /></Link>
      </div>
    </header>

    <section className={styles.hero} aria-label="SCENOVA Neo Noir Studio — สร้างภาพยนตร์ด้วยพลังของ AI">
      <img
        className={styles.heroImage}
        src="/media/scenova-portal-hero.png"
        alt=""
        fetchPriority="high"
        decoding="sync"
      />
      <span className={styles.heroScrim} aria-hidden="true" />
      <span className={styles.heroClouds} aria-hidden="true" />
      <span className={styles.heroLights} aria-hidden="true" />
      <div className={styles.heroContent}>
        <span className={styles.heroEyebrow}>SCENOVA · AI FILM SUITE</span>
        <h1>สร้างโลกของคุณ<br/><em>ให้กลายเป็นภาพยนตร์</em></h1>
        <p>รวมบท ตัวละคร ฉาก เสียง และการตัดต่อไว้ในเวิร์กโฟลว์เดียว</p>
        <div className={styles.heroActions}>
          <Link href="/studio" className={styles.heroPrimary}>เริ่มสร้างภาพยนตร์ <Arrow /></Link>
          <Link href="/guide" className={styles.heroSecondary}><span aria-hidden="true">▶</span> ชมวิธีใช้งาน</Link>
        </div>
      </div>
      <div className={styles.heroMeta} aria-hidden="true"><span>01</span><i /><b>NEO NOIR WORKSPACE</b></div>
    </section>

    <section className={styles.quickSection} aria-labelledby="quick-title">
      <SectionHeading
        id="quick-title"
        eyebrow="QUICK START"
        title="เริ่มต้นสร้างในแบบของคุณ"
        detail="เลือกขั้นตอนที่ต้องการ แล้วให้ SCENOVA ช่วยเปลี่ยนไอเดียให้กลายเป็นงานภาพยนตร์"
      />
      <div className={styles.quickGrid}>
        {QUICK_ACTIONS.map((item, index) => <Link
          href={item.href}
          prefetch={false}
          key={item.title}
          className={styles.quickCard}
          data-tone={item.tone}
        >
          <span className={styles.quickNumber}>{String(index + 1).padStart(2, "0")}</span>
          <span className={styles.quickIcon}><QuickIcon name={item.icon} /></span>
          <span className={styles.quickCopy}><b>{item.title}</b><small data-keep-small="true">{item.detail}</small></span>
          <span className={styles.quickArrow}><Arrow /></span>
        </Link>)}
      </div>
    </section>

    <section className={styles.templates} aria-labelledby="template-heading">
      <SectionHeading
        id="template-heading"
        eyebrow="STORY WORLDS"
        title="เทมเพลตและแนวภาพยนตร์"
        detail="เลือกโลกของเรื่อง สี แสง และอารมณ์ภาพที่พร้อมนำไปต่อยอดได้ทันที"
        href="/libraries?tab=images"
      />
      <CarouselRow label="เทมเพลตและแนวภาพยนตร์">
        {TEMPLATES.map((template) => <Link href="/libraries?tab=images" prefetch={false} key={template.title} className={styles.templateCard}>
          <Image src={template.image} alt={`ตัวอย่างสไตล์ ${template.title}`} fill sizes="(max-width: 700px) 82vw, 320px" />
          <span className={styles.templateShade} aria-hidden="true" />
          <span className={styles.templateCopy}><b>{template.title}</b><small data-keep-small="true">{template.detail}</small></span>
          <span className={styles.templateArrow}><Arrow /></span>
        </Link>)}
      </CarouselRow>
    </section>

    <section className={`${styles.templates} ${styles.characterSection}`} aria-labelledby="character-heading">
      <SectionHeading
        id="character-heading"
        eyebrow="CHARACTER ARCHETYPES"
        title="เทมเพลตตัวละครพร้อมสร้างเรื่อง"
        detail="เริ่มจากคาแรกเตอร์ต้นแบบ แล้วปรับบุคลิก รูปลักษณ์ และเสียงให้เป็นตัวละครของคุณ"
        href="/studio#characters"
      />
      <CharacterTemplateRow />
    </section>

    <footer className={styles.tipBar}>
      <span className={styles.tipMark} aria-hidden="true">✦</span>
      <p><b>เคล็ดลับสำหรับงานที่ต่อเนื่อง</b> เริ่มจากเทมเพลต แล้วใช้ Character, Voice และ Style Lock ร่วมกันในทุกฉาก</p>
      <Link href="/guide">เปิดคู่มือ <Arrow /></Link>
    </footer>
  </main>;
}
