import Link from "next/link";
import AdminLlmCostMeter from "@/components/admin-llm-cost-meter";
import styles from "@/components/settings-ui.module.css";

export default function AdminAiCostsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.breadcrumb}><Link href="/profile">การตั้งค่า</Link><span>›</span><strong>AI & Cost</strong></div>
          <h1>AI & Cost Control</h1>
          <p>ติดตามต้นทุน LLM จริงแยกตาม Model ประเภทงาน และผู้ใช้ พร้อมตรวจจำนวน Call ต่อคลิปและเพดานงบประมาณก่อนขยายการใช้งาน</p>
        </div>
        <div className={styles.headerStatus}><i />Cost Observability</div>
      </header>
      <AdminLlmCostMeter />
    </main>
  );
}
