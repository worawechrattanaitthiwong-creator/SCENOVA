import Link from "next/link";
import styles from "./page.module.css";

function ScenovaMark() {
  return <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="opening-mark" x1="8" y1="7" x2="56" y2="57" gradientUnits="userSpaceOnUse">
        <stop stopColor="#d99cff" />
        <stop offset=".28" stopColor="#a25cff" />
        <stop offset=".58" stopColor="#f4d56d" />
        <stop offset="1" stopColor="#9b6d23" />
      </linearGradient>
      <radialGradient id="opening-core" cx="0" cy="0" r="1" gradientTransform="translate(29 27) rotate(45) scale(20)">
        <stop stopColor="#f9dc7b" />
        <stop offset=".5" stopColor="#bd6dff" />
        <stop offset="1" stopColor="#743cff" />
      </radialGradient>
    </defs>
    <path d="M32 7c9.5 0 17.7 5.7 21.2 13.8l-13.5 1.8a11.5 11.5 0 0 0-18.8 2.3L13 14.1A23.5 23.5 0 0 1 32 7Z" fill="none" stroke="url(#opening-mark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#opening-mark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(120 32 32)" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#opening-mark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(240 32 32)" />
    <path d="M32 23.8 34.7 29l5.5 3-5.5 2.8L32 40l-2.7-5.2-5.5-2.8 5.5-3 2.7-5.2Z" fill="url(#opening-core)" />
  </svg>;
}

export default function HomePage() {
  return <main className={styles.opening}>
    <div className={styles.ambient} aria-hidden />
    <div className={styles.grain} aria-hidden />

    <section className={styles.center} aria-labelledby="scenova-opening-title">
      <div className={styles.mark}><ScenovaMark /></div>
      <span className={styles.kicker}>AI CINEMATIC STUDIO</span>
      <h1 id="scenova-opening-title">SCENOVA</h1>
      <p>MAKE IT CINEMATIC.</p>
      <Link href="/portal" className={styles.enter}>ENTER STUDIO <span aria-hidden>→</span></Link>
    </section>

    <span className={styles.signature}>SCENOVA · CINEMATIC CREATION SYSTEM</span>
  </main>;
}
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  return <main className={styles.opening}>
    <div className={styles.ambient} aria-hidden="true" />
    <div className={styles.lightSweep} aria-hidden="true" />
    <div className={styles.frame} aria-hidden="true" />

    <section className={styles.center} aria-labelledby="scenova-opening-title">
      <div className={styles.mark}>
        <span className={styles.markHalo} aria-hidden="true" />
        <Image
          src="/brand/scenova-mark.png"
          alt=""
          width={180}
          height={180}
          priority
          sizes="(max-width: 680px) 112px, 148px"
        />
      </div>

      <span className={styles.kicker}>AI CINEMATIC STUDIO</span>

      <div className={styles.brandLockup}>
        <h1 id="scenova-opening-title">SCENOVA</h1>
        <div className={styles.studioLine} aria-label="Studio">
          <i aria-hidden="true" />
          <span>STUDIO</span>
          <i aria-hidden="true" />
        </div>
      </div>

      <p className={styles.tagline}>MAKE IT CINEMATIC.</p>
      <p className={styles.intro}>เปลี่ยนทุกไอเดียให้กลายเป็นภาพยนตร์ ด้วยพื้นที่สร้างสรรค์ที่ขับเคลื่อนด้วย AI</p>

      <Link href="/portal" className={styles.enter}>
        <span>ENTER STUDIO</span>
        <b aria-hidden="true">→</b>
      </Link>
    </section>

    <span className={styles.signature}>SCENOVA · CINEMATIC CREATION SYSTEM</span>
  </main>;
}
