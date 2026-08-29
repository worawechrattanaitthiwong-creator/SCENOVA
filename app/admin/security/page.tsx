import Link from "next/link";
import AdminSecurityConsole from "@/components/admin-security-console";
import styles from "@/components/settings-ui.module.css";

export default function AdminSecurityPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.breadcrumb}><Link href="/profile">การตั้งค่า</Link><span>›</span><strong>Security Center</strong></div>
          <h1>Security Center</h1>
          <p>ควบคุมมาตรการฉุกเฉิน Session, Provider, AI, Queue และระบบการเงินจากศูนย์กลางเดียว ใช้คำสั่ง Lockdown เฉพาะเมื่อจำเป็นและมีเหตุผลที่ตรวจสอบย้อนหลังได้</p>
        </div>
        <div className={styles.headerStatus}><i />Administrator Security</div>
      </header>
      <AdminSecurityConsole />
    </main>
  );
}
