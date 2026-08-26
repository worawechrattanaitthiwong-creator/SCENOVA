import Link from "next/link";
import styles from "./render.module.css";

const jobs = [
  { id: "R-001", project: "เด็กหญิงกับสิ่งมีชีวิตลึกลับ", ep: "EP01", model: "Seedance 2.5", duration: "30s", status: "พร้อมสร้าง", progress: 0 },
  { id: "R-002", project: "เมืองอนาคต", ep: "EP02", model: "Veo", duration: "8s", status: "รอคิว", progress: 35 },
];

export default function RenderQueuePage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div><span className={styles.eyebrow}>RENDER QUEUE</span><h1>งานสร้างคลิป</h1><p>ศูนย์รวมงานที่รอ กำลังสร้าง สำเร็จ หรือล้มเหลว เมื่อเชื่อม Provider จริงหน้านี้จะแสดง Progress, Retry, Cancel, เครดิต และไฟล์ผลลัพธ์จากข้อมูลจริง</p></div>
        <Link href="/libraries?tab=videos" className={styles.primaryLink}>เปิดคลังวิดีโอ</Link>
      </header>
      <div className={styles.demoNotice}><b>สถานะ: UX DEMO</b> — รายการด้านล่างเป็นข้อมูลตัวอย่างเพื่อทดสอบหน้าจอเท่านั้น ยังไม่ใช่งานที่ถูกส่งไปยัง Video Provider และไม่มีการหักเครดิตจากรายการตัวอย่างนี้</div>
      <section className={styles.list} aria-label="ตัวอย่าง Render Queue">
        {jobs.map((job) => <article key={job.id} className={styles.job}>
          <div className={styles.row}>
            <span className={styles.id}>{job.id}</span>
            <div className={styles.project}><b>{job.project}</b><small>{job.ep}</small></div>
            <span className={styles.value}>{job.duration}</span><span className={styles.value}>{job.model}</span>
            <span className={styles.status}>{job.status}</span><span className={styles.sample}>ตัวอย่าง</span>
          </div>
          <div className={styles.track} aria-label={`ความคืบหน้าตัวอย่าง ${job.progress}%`}><div className={styles.bar} style={{ width: `${job.progress}%` }} /></div>
        </article>)}
      </section>
      <p className={styles.emptyHint}>เมื่อ Render orchestration เชื่อมกับ Provider Queue แล้ว จะเปลี่ยนรายการตัวอย่างนี้เป็นข้อมูลจากฐานจริงโดยไม่เปลี่ยนโครง UX หลัก</p>
    </main>
  );
}
