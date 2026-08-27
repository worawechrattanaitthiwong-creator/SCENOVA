import Link from "next/link";
import Image from "next/image";
import styles from "./portal.module.css";

type IconName = "play" | "spark" | "prompt" | "shield" | "lock" | "board" | "episodes" | "arrow";

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
    {name === "play" ? <><circle cx="12" cy="12" r="9" /><path d="m10 8 6 4-6 4V8Z" /></> : null}
    {name === "spark" ? <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m18.8 15.8.7 2.2 2.2.7-2.2.8-.7 2.2-.8-2.2-2.2-.8 2.2-.7.8-2.2Z" /></> : null}
    {name === "prompt" ? <><path d="m14.7 5.3 4 4L9 19l-5 1 1-5 9.7-9.7Z" /><path d="m12.7 7.3 4 4M4 22h16" /></> : null}
    {name === "lock" ? <><rect x="5" y="10" width="14" height="11" rx="2.5" /><path d="M8.3 10V7.2a3.7 3.7 0 0 1 7.4 0V10M12 14v3" /></> : null}
    {name === "shield" ? <><path d="M12 2.5 20 6v5.6c0 4.9-3.4 8.2-8 9.9-4.6-1.7-8-5-8-9.9V6l8-3.5Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></> : null}
    {name === "board" ? <><rect x="3" y="5" width="18" height="15" rx="2.3" /><path d="m4 9 16-4M7 4l2.2 4M12 3l2.2 4M17 2l2.2 4M7 13h10M7 16h6" /></> : null}
    {name === "episodes" ? <><rect x="5.5" y="5.5" width="13" height="13" rx="2" /><path d="M8.5 2.5h8M8.5 21.5h8M9.5 9l5 3-5 3V9Z" /></> : null}
    {name === "arrow" ? <><path d="M5 12h14M14 7l5 5-5 5" /></> : null}
  </svg>;
}

export default function PortalPage() {
  return <main className={styles.dashboard}>
    <section className={styles.hero} aria-labelledby="portal-title">
      <Image className={styles.heroImage} src="/media/scenova-studio-hero.png" alt="ฉากสตูดิโอภาพยนตร์ที่มีกล้องและเก้าอี้ผู้กำกับ" fill priority quality={88} sizes="(max-width: 820px) 100vw, calc(100vw - 218px)" />
      <div className={styles.heroShade} aria-hidden />
      <div className={styles.heroCopy}>
        <span className={styles.eyebrow}>SCENOVA PRODUCTION STUDIO</span>
        <h1 id="portal-title">Cinematic Studio <span>—</span><br /><em>สตูดิโอสร้างภาพยนตร์ AI</em></h1>
        <p>เส้นทางการสร้างงาน: ตั้งค่างาน → ตัวละคร → กำกับฉากและเสียง<br />ทุกส่วนเชื่อมอยู่ใน Workspace เดียวกัน เพื่อรักษาความต่อเนื่องของโปรเจกต์</p>
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
          <span><b>Multi-Episode</b><small>สร้างซีรีส์ต่อเนื่อง สูงสุด 3 นาที/ตอน</small></span>
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
          <Image src={template.image} alt={"ตัวอย่างสไตล์ " + template.title} fill sizes="(max-width: 820px) 80vw, 20vw" />
          <span className={styles.templateShade} aria-hidden />
          <span className={styles.templateCopy}><b>{template.title}</b><small>{template.detail}</small></span>
          <span className={styles.templateArrow}><Icon name="arrow" /></span>
        </Link>)}
      </div>
    </section>
  </main>;
}
