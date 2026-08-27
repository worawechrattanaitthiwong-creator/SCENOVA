import Link from "next/link";
import styles from "./page.module.css";

function ScenovaMark() {
  return <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="opening-mark" x1="8" y1="7" x2="56" y2="57" gradientUnits="userSpaceOnUse">
        <stop stopColor="#fff2b6" />
        <stop offset=".46" stopColor="#e4b94c" />
        <stop offset="1" stopColor="#815f1d" />
      </linearGradient>
    </defs>
    <path d="M32 7c9.5 0 17.7 5.7 21.2 13.8l-13.5 1.8a11.5 11.5 0 0 0-18.8 2.3L13 14.1A23.5 23.5 0 0 1 32 7Z" fill="none" stroke="url(#opening-mark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#opening-mark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(120 32 32)" />
    <path d="M53.5 27c1.9 9.3-2 18.6-9.1 23.7l-5.3-12.5a11.5 11.5 0 0 0-1.5-18.8l9-8.5A23.5 23.5 0 0 1 53.5 27Z" fill="none" stroke="url(#opening-mark)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform="rotate(240 32 32)" />
    <path d="M32 23.8 34.7 29l5.5 3-5.5 2.8L32 40l-2.7-5.2-5.5-2.8 5.5-3 2.7-5.2Z" fill="url(#opening-mark)" />
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
