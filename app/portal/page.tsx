import Link from "next/link";
import Image from "next/image";
import styles from "./portal.module.css";

const QUICK_ACTIONS = [
  { href: "/agent", icon: "AI", title: "สร้างด้วย AI", detail: "สร้างภาพยนตร์จากไอเดียในไม่กี่คลิก" },
  { href: "/studio#setup", icon: "✎", title: "เขียนบทด้วย AI", detail: "สร้างโครงเรื่องและวางแกนเรื่องหลัก" },
  { href: "/studio#characters", icon: "◎", title: "สร้างตัวละคร", detail: "กำหนดตัวละครและเสียงแบบต่อเนื่อง" },
  { href: "/studio#scenes", icon: "▧", title: "สร้างฉาก", detail: "กำกับภาพ แสง สถานที่ และบรรยากาศ" },
  { href: "/libraries?tab=voices", icon: "♫", title: "เสียง & ดนตรี", detail: "จัดการเสียงพากย์ ดนตรี และ SFX" },
  { href: "/render", icon: "✂", title: "คิวสร้างวิดีโอ", detail: "ติดตามงานสร้างและผลลัพธ์ล่าสุด" },
] as const;

const TEMPLATES = [
  { title: "Neo Noir", detail: "อาชญากรรม ดราม่า ลึกลับ", image: "/library/styles/dark-thriller.png" },
  { title: "Cyberpunk City", detail: "ไซไฟ เทคโนโลยี อนาคต", image: "/library/styles/sci-fi-neon.png" },
  { title: "Epic Fantasy", detail: "แฟนตาซี ผจญภัย มหากาพย์", image: "/library/styles/fantasy-storybook.png" },
  { title: "Action Blockbuster", detail: "แอ็กชัน ผจญภัย ระทึกขวัญ", image: "/library/styles/action-blockbuster.png" },
  { title: "Romantic Drama", detail: "โรแมนติก ดราม่า ความรัก", image: "/library/styles/cinematic-romance.png" },
  { title: "Horror Mystery", detail: "สยองขวัญ ลึกลับ ระทึกขวัญ", image: "/library/styles/gothic-horror.png" },
] as const;

function Arrow() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M14 7l5 5-5 5" /></svg>;
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

    <section className={styles.hero} aria-labelledby="portal-title">
      <Image className={styles.heroImage} src="/library/styles/dark-thriller.png" alt="เมืองกลางคืนโทน Neo Noir สำหรับ SCENOVA" fill priority quality={90} sizes="(max-width: 820px) 100vw, calc(100vw - 218px)" />
      <div className={styles.heroShade} aria-hidden />
      <div className={styles.heroGlow} aria-hidden />
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}>SCENOVA CINEMATIC STUDIO</span>
        <h1 id="portal-title">สร้างภาพยนตร์<br />ด้วยพลังของ <em>AI</em></h1>
        <p>ตั้งแต่แนวคิด บทภาพยนตร์ ตัวละคร ฉาก เสียง ไปจนถึงการสร้างวิดีโอ<br />ทุกส่วนทำงานต่อเนื่องใน SCENOVA Workspace เดียว</p>
        <div className={styles.ctaRow}>
          <Link href="/studio" className={styles.primaryCta}>เริ่มสร้างภาพยนตร์ <Arrow /></Link>
          <Link href="/guide" className={styles.secondaryCta}><span>▶</span> ดูวิธีใช้งาน</Link>
        </div>
      </div>
      <div className={styles.heroBrand} aria-hidden="true">
        <span className={styles.heroMark} />
        <span className={styles.heroWordmark} />
      </div>
    </section>

    <section className={styles.quickSection} aria-labelledby="quick-title">
      <div className={styles.sectionHead}><h2 id="quick-title">เริ่มต้นใช้งานด่วน</h2></div>
      <div className={styles.quickGrid}>
        {QUICK_ACTIONS.map((item) => <Link href={item.href} prefetch={false} key={item.title} className={styles.quickCard}>
          <span className={styles.quickIcon}>{item.icon}</span>
          <span className={styles.quickCopy}><b>{item.title}</b><small data-keep-small="true">{item.detail}</small></span>
          <span className={styles.quickArrow}><Arrow /></span>
        </Link>)}
      </div>
    </section>

    <section className={styles.templates} aria-labelledby="template-heading">
      <div className={styles.sectionHead}>
        <h2 id="template-heading">เทมเพลต & แนวภาพยนตร์</h2>
        <Link href="/libraries?tab=images" prefetch={false}>ดูทั้งหมด <span>→</span></Link>
      </div>
      <div className={styles.templateGrid}>
        {TEMPLATES.map((template) => <Link href="/libraries?tab=images" prefetch={false} key={template.title} className={styles.templateCard}>
          <Image src={template.image} alt={"ตัวอย่างสไตล์ " + template.title} fill sizes="(max-width: 820px) 80vw, 16vw" />
          <span className={styles.templateShade} aria-hidden />
          <span className={styles.templateCopy}><b>{template.title}</b><small data-keep-small="true">{template.detail}</small></span>
          <span className={styles.templateArrow}><Arrow /></span>
        </Link>)}
      </div>
    </section>

    <footer className={styles.tipBar}>
      <span>◉</span>
      <p>เคล็ดลับ: เริ่มจากเทมเพลตหรือ AI Studio แล้วใช้ Character / Voice / Style Lock เพื่อรักษาความต่อเนื่องของงาน</p>
      <Link href="/guide">คู่มือการใช้งาน <Arrow /></Link>
    </footer>
  </main>;
}