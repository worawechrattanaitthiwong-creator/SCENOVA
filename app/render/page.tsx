import Link from "next/link";

const jobs = [
  { id: "R-001", project: "เด็กหญิงกับสิ่งมีชีวิตลึกลับ", ep: "EP01", model: "Seedance 2.5", duration: "30s", status: "พร้อมสร้าง", progress: 0 },
  { id: "R-002", project: "เมืองอนาคต", ep: "EP02", model: "Veo", duration: "8s", status: "รอคิว", progress: 35 },
];

export default function RenderQueuePage() {
  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: 30, color: "#f5f5ef" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 18, marginBottom: 18 }}>
        <div><span style={{ color: "#f2c94c", fontSize: 10, fontWeight: 900, letterSpacing: ".14em" }}>RENDER QUEUE</span><h1 style={{ fontSize: 28, margin: "7px 0 5px" }}>งานสร้างคลิป</h1><p style={{ color: "#898983", fontSize: 12, lineHeight: 1.65, margin: 0, maxWidth: 760 }}>รวมงานที่รอ กำลังสร้าง สำเร็จ หรือล้มเหลวไว้ที่เดียว เมื่อเชื่อม Provider จริงจะแสดง Progress, Retry, Cancel, เครดิต และไฟล์ผลลัพธ์</p></div>
        <Link href="/libraries?tab=videos" style={{ color: "#0a0a0a", background: "#f2c94c", borderRadius: 9, padding: "9px 12px", textDecoration: "none", fontWeight: 850, fontSize: 10 }}>เปิดคลังวิดีโอ</Link>
      </header>

      <section style={{ display: "grid", gap: 10 }}>
        {jobs.map((job) => <article key={job.id} style={{ border: "1px solid #242424", borderRadius: 14, background: "#0f0f0f", padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "80px minmax(220px,1fr) 90px 150px 90px 120px", gap: 10, alignItems: "center" }}>
            <span style={{ color: "#f2c94c", fontSize: 10, fontWeight: 850 }}>{job.id}</span>
            <div><b style={{ display: "block", fontSize: 12 }}>{job.project}</b><small style={{ color: "#767670", fontSize: 9 }}>{job.ep}</small></div>
            <span style={{ fontSize: 10 }}>{job.duration}</span><span style={{ fontSize: 10 }}>{job.model}</span>
            <span style={{ color: job.status === "รอคิว" ? "#d9c45f" : "#b9b9b2", fontSize: 10 }}>{job.status}</span>
            <button style={{ border: "1px solid #302d20", borderRadius: 8, background: "#151515", color: "#eee", padding: "7px 8px", fontSize: 9, fontWeight: 750 }}>ดูรายละเอียด</button>
          </div>
          <div style={{ height: 5, borderRadius: 999, background: "#1e1e1e", overflow: "hidden", marginTop: 11 }}><div style={{ height: "100%", width: `${job.progress}%`, background: "#f2c94c" }} /></div>
        </article>)}
      </section>
      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #282828", background: "#0b0b0b", color: "#7d7d77", fontSize: 10, lineHeight: 1.6 }}>ตอนนี้เป็น Mock Queue เพื่อทดสอบ UX ก่อนเชื่อม Video Provider จริง Logic ของ Reserve / Charge / Refund และ Provider Adapter ยังคงเดิม</div>
    </main>
  );
}
