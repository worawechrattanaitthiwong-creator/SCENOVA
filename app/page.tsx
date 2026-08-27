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
