import Image from "next/image";
import Link from "next/link";
import CarouselRow from "./carousel-row";
import styles from "./portal.module.css";

const QUICK_ACTIONS = [
  { href: "/agent", icon: "✦", title: "สร้างด้วย AI", detail: "เปลี่ยนไอเดียให้เป็นภาพยนตร์ พร้อมเริ่มโปรเจกต์ใหม่ทันที", tone: "violet" },
  { href: "/studio#setup", icon: "⌁", title: "เขียนบทด้วย AI", detail: "วางพล็อต แกนเรื่อง และบทสนทนาอย่างเป็นระบบ", tone: "gold" },
  { href: "/studio#characters", icon: "◉", title: "สร้างตัวละคร", detail: "กำหนดบุคลิก รูปลักษณ์ และเสียงให้ต่อเนื่องทุกฉาก", tone: "rose" },
  { href: "/studio#scenes", icon: "▣", title: "ออกแบบฉาก", detail: "ควบคุมภาพ แสง สถานที่ และบรรยากาศของเรื่อง", tone: "blue" },
  { href: "/libraries?tab=voices", icon: "♪", title: "เสียงและดนตรี", detail: "เลือกเสียงพากย์ ดนตรีประกอบ และเอฟเฟกต์เสียง", tone: "cyan" },
  { href: "/render", icon: "◫", title: "สร้างวิดีโอ", detail: "จัดคิวเรนเดอร์ ติดตามสถานะ และรับผลงานล่าสุด", tone: "amber" },
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

const CHARACTER_TEMPLATES = [
  { title: "นักสืบเงามืด", detail: "สุขุม · ช่างสังเกต · มีอดีตซ่อนเร้น", image: "/library/styles/dark-thriller.png", tag: "DETECTIVE" },
  { title: "แฮกเกอร์เมืองนีออน", detail: "เฉียบคม · กล้าท้าทาย · ล้ำอนาคต", image: "/library/styles/sci-fi-neon.png", tag: "HACKER" },
  { title: "ผู้พิทักษ์อาณาจักร", detail: "กล้าหาญ · ซื่อสัตย์ · ผู้นำโดยธรรมชาติ", image: "/library/styles/fantasy-storybook.png", tag: "GUARDIAN" },
  { title: "สายลับภาคสนาม", detail: "ว่องไว · เด็ดขาด · เชี่ยวชาญการต่อสู้", image: "/library/styles/action-blockbuster.png", tag: "AGENT" },
  { title: "ศิลปินผู้เปราะบาง", detail: "อ่อนไหว · มีเสน่ห์ · เต็มไปด้วยความฝัน", image: "/library/styles/cinematic-romance.png", tag: "ARTIST" },
  { title: "ทายาทคฤหาสน์", detail: "สง่างาม · ลึกลับ · เก็บงำความจริง", image: "/library/styles/gothic-horror.png", tag: "HEIRESS" },
  { title: "ฮีโร่ต่างโลก", detail: "มุ่งมั่น · สดใส · พร้อมเติบโต", image: "/library/styles/cinematic-anime.png", tag: "HERO" },
  { title: "ขุนนางนักเจรจา", detail: "สุขุม · ฉลาดหลักแหลม · มีอำนาจ", image: "/library/styles/period-drama.png", tag: "NOBLE" },
] as const;

function Arrow() {
  return <span aria-hidden="true">→</span>;
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
      <div className={styles.welcome}>
        <small data-keep-small="true">ยินดีต้อนรับกลับ</small>
        <strong>SCENOVA Studio</strong>
      </div>
      <form className={styles.search} action="/libraries" method="get">
        <input type="hidden" name="tab" value="images" />
        <span aria-hidden>⌕</span>
        <input name="q" type="search" placeholder="ค้นหาโปรเจกต์ เทมเพลต เครื่องมือ..." aria-label="ค้นหาใน SCENOVA" />
        <kbd>⌘K</kbd>
      </form>
      <div className={styles.utilityActions}>
        <Link href="/guide" aria-label="เปิดคู่มือ">?</Link>
        <Link href="/profile" className={styles.accountButton}>SC</Link>
      </div>
    </header>

    <section className={styles.hero} aria-label="SCENOVA Neo Noir Studio — สร้างภาพยนตร์ด้วยพลังของ AI">
      <img
        className={styles.heroImage}
        src="/media/scenova-portal-hero.png"
        alt="SCENOVA Neo Noir Studio — สร้างภาพยนตร์ด้วยพลังของ AI"
        fetchPriority="high"
        decoding="sync"
      />
      <span className={styles.heroClouds} aria-hidden="true" />
      <span className={styles.heroLights} aria-hidden="true" />
      <Link href="/studio" className={`${styles.heroHotspot} ${styles.heroStart}`} aria-label="เริ่มสร้างภาพยนตร์" />
      <Link href="/guide" className={`${styles.heroHotspot} ${styles.heroPreview}`} aria-label="ชมตัวอย่างและคู่มือการใช้งาน" />
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
          <span className={styles.quickIcon} aria-hidden="true">{item.icon}</span>
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
      <CarouselRow label="เทมเพลตตัวละคร">
        {CHARACTER_TEMPLATES.map((character) => <Link href="/studio#characters" prefetch={false} key={character.title} className={`${styles.templateCard} ${styles.characterCard}`}>
          <Image src={character.image} alt={`เทมเพลตตัวละคร ${character.title}`} fill sizes="(max-width: 700px) 82vw, 320px" />
          <span className={styles.templateShade} aria-hidden="true" />
          <span className={styles.characterTag}>{character.tag}</span>
          <span className={styles.templateCopy}><b>{character.title}</b><small data-keep-small="true">{character.detail}</small></span>
          <span className={styles.templateArrow}><Arrow /></span>
        </Link>)}
      </CarouselRow>
    </section>

    <footer className={styles.tipBar}>
      <span className={styles.tipMark} aria-hidden="true">✦</span>
      <p><b>เคล็ดลับสำหรับงานที่ต่อเนื่อง</b> เริ่มจากเทมเพลต แล้วใช้ Character, Voice และ Style Lock ร่วมกันในทุกฉาก</p>
      <Link href="/guide">เปิดคู่มือ <Arrow /></Link>
    </footer>
  </main>;
}
