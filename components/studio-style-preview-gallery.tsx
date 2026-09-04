"use client";

import Link from "next/link";
import styles from "./studio-style-preview-gallery.module.css";

type StylePreview = {
  value: string;
  title: string;
  subtitle: string;
  image: string;
};

const STYLE_PREVIEWS: StylePreview[] = [
  { value: "Cinematic Anime — อนิเมะภาพยนตร์", title: "Cinematic Anime", subtitle: "อนิเมะภาพยนตร์", image: "/library/styles/cinematic-anime.png" },
  { value: "Photorealistic Film — สมจริงแบบภาพยนตร์", title: "Photorealistic Film", subtitle: "สมจริงแบบภาพยนตร์", image: "/library/styles/photorealistic-film.png" },
  { value: "Warm Golden Hour — อบอุ่นแสงทอง", title: "Warm Golden Hour", subtitle: "อบอุ่นแสงทอง", image: "/library/styles/warm-golden-hour.png" },
  { value: "Action Blockbuster — แอ็กชันบล็อกบัสเตอร์", title: "Action Blockbuster", subtitle: "แอ็กชันบล็อกบัสเตอร์", image: "/library/styles/action-blockbuster.png" },
  { value: "Sci-Fi Neon — ไซไฟนีออน", title: "Sci-Fi Neon", subtitle: "ไซไฟนีออน", image: "/library/styles/sci-fi-neon.png" },
  { value: "Fantasy Storybook — แฟนตาซีภาพเล่าเรื่อง", title: "Fantasy Storybook", subtitle: "แฟนตาซีภาพเล่าเรื่อง", image: "/library/styles/fantasy-storybook.png" },
  { value: "Dark Thriller — ทริลเลอร์โทนมืด", title: "Dark Thriller", subtitle: "ทริลเลอร์โทนมืด", image: "/library/styles/dark-thriller.png" },
  { value: "Gothic Horror — สยองขวัญโกธิก", title: "Gothic Horror", subtitle: "สยองขวัญโกธิก", image: "/library/styles/gothic-horror.png" },
  { value: "Cinematic Romance — โรแมนติกภาพยนตร์", title: "Cinematic Romance", subtitle: "โรแมนติกภาพยนตร์", image: "/library/styles/cinematic-romance.png" },
  { value: "Period Drama — ดราม่าย้อนยุค", title: "Period Drama", subtitle: "ดราม่าย้อนยุค", image: "/library/styles/period-drama.png" },
];

export default function StudioStylePreviewGallery({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = STYLE_PREVIEWS.find((item) => item.value === value) || STYLE_PREVIEWS[0];
  const hasSelection = Boolean(value);

  return (
    <section className={styles.root} aria-label="ภาพตัวอย่างสไตล์ภาพ" data-sc-style-preview>
      <div className={styles.head}>
        <div>
          <span>ภาพตัวอย่างสไตล์</span>
          <strong>เลือกภาพเพื่อกำหนด Master Style</strong>
          <small>ตัวอย่างจาก SCENOVA Style Library · ดูได้ก่อนสร้างวิดีโอและไม่ใช้เครดิต</small>
        </div>
        <Link href="/libraries?tab=images" prefetch={false}>เปิดคลังภาพ &amp; สไตล์ →</Link>
      </div>

      <div className={styles.body}>
        <button
          type="button"
          className={`${styles.featured}${hasSelection ? ` ${styles.selected}` : ""}`}
          onClick={() => onChange(selected.value)}
          aria-label={`เลือก ${selected.title}`}
        >
          <img src={selected.image} alt={`ตัวอย่าง ${selected.title}`} loading="eager" />
          <span className={styles.featuredShade} />
          <span className={styles.featuredCopy}>
            <small>{hasSelection ? "สไตล์ที่เลือก" : "ตัวอย่างก่อนเลือก"}</small>
            <b>{selected.title}</b>
            <em>{selected.subtitle}</em>
          </span>
          {hasSelection ? <span className={styles.check}>✓</span> : null}
        </button>

        <div className={styles.rail} role="listbox" aria-label="เลือกสไตล์จากภาพตัวอย่าง">
          {STYLE_PREVIEWS.map((item) => {
            const active = item.value === value;
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={active}
                className={`${styles.card}${active ? ` ${styles.active}` : ""}`}
                onClick={() => onChange(item.value)}
              >
                <span className={styles.thumb}>
                  <img src={item.image} alt="" loading="lazy" />
                  {active ? <span className={styles.cardCheck}>✓</span> : null}
                </span>
                <span className={styles.cardCopy}>
                  <b>{item.title}</b>
                  <small>{item.subtitle}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
