import Link from "next/link";
import { VIDEO_MODELS } from "@/lib/catalogs";
import { getVideoModelVersions } from "@/lib/video-model-versions";
import styles from "./models.module.css";

const priceLabel = (level: number) => level === 1 ? "ประหยัด" : level === 2 ? "ปานกลาง" : "พรีเมียม";

export default function ModelsPage() {
  return (
    <main className={styles.page} data-sc-help-ignore>
      <header className={styles.hero}>
        <div><span className={styles.eyebrow}>MODEL CENTER</span><h1>โมเดล & เรทราคา</h1><p>เปรียบเทียบโมเดลก่อนใช้งาน ดูความยาวสูงสุด ความละเอียด Audio, Reference และระดับราคา แล้วกลับไปเลือกใน Studio</p></div>
        <Link href="/studio#setup" className={styles.primaryLink}>กลับ Studio</Link>
      </header>
      <div className={styles.grid}>
        {VIDEO_MODELS.map((model) => <article key={model.id} className={styles.card} data-sc-help-ignore>
          <div className={styles.cardTop}><div><b>{model.name}</b><span className={styles.provider}>{model.provider}</span></div><span className={styles.price}>{priceLabel(model.priceLevel)}</span></div>
          <p className={styles.description}>{model.descriptionTh}</p>
          <div className={styles.tags}>{getVideoModelVersions(model.name).map((version) => <span key={version.apiModelId}>{version.label}{version.recommended ? " · แนะนำ" : ""}</span>)}</div>
          <div className={styles.specs}>
            {[[`${model.maxSecondsPerGeneration} วิ`,"สูงสุด / generation"],[model.resolutions.join(" / "),"Resolution"],[model.supportsAudio?"รองรับ":"ไม่รองรับ","Audio"],[model.supportsVideoReference?"รองรับ":"ไม่รองรับ","Video Reference"]].map(([value,label]) => <div key={label} className={styles.spec}><b>{value}</b><span>{label}</span></div>)}
          </div>
          <div className={styles.tags}>{model.bestFor.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <Link prefetch href="/studio#setup" className={styles.choose}>เลือกใน Studio →</Link>
        </article>)}
      </div>
    </main>
  );
}
