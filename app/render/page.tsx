const jobs = [
  { id: "R-001", project: "เด็กหญิงกับสิ่งมีชีวิตลึกลับ", ep: "EP01", model: "Seedance 2.5", duration: "30s", status: "พร้อมสร้าง" },
  { id: "R-002", project: "เมืองอนาคต", ep: "EP02", model: "Veo", duration: "8s", status: "รอคิว" },
];

export default function RenderQueuePage() {
  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: 28, color: "#f7f3ff", fontSize: 14 }}>
      <header style={{ marginBottom: 18 }}>
        <span style={{ color: "#b994ed", fontSize: 11, fontWeight: 850, letterSpacing: ".1em" }}>RENDER QUEUE</span>
        <h1 style={{ fontSize: 28, margin: "6px 0" }}>คิวสร้างคลิป</h1>
        <p style={{ color: "#9c91ad", fontSize: 13, lineHeight: 1.6, margin: 0, maxWidth: 760 }}>รวมงานที่กำลังรอ สร้าง ประมวลผล สำเร็จ หรือล้มเหลวไว้ในที่เดียว เมื่อเชื่อม Video API จริง หน้านี้จะติดตาม Provider Task, เครดิตที่ Reserve และผลลัพธ์ของแต่ละ Scene/EP</p>
      </header>

      <section style={{ border: "1px solid rgba(171,120,255,.16)", borderRadius: 16, background: "linear-gradient(180deg,#151021,#0d0914)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "90px minmax(220px,1.5fr) 90px 150px 90px 120px", gap: 10, padding: 12, color: "#93889f", fontSize: 11, borderBottom: "1px solid rgba(171,120,255,.12)" }}><b>Job</b><b>โปรเจกต์</b><b>ตอน</b><b>โมเดล</b><b>เวลา</b><b>สถานะ</b></div>
        {jobs.map((job) => <div key={job.id} style={{ display: "grid", gridTemplateColumns: "90px minmax(220px,1.5fr) 90px 150px 90px 120px", gap: 10, alignItems: "center", padding: 12, borderBottom: "1px solid rgba(171,120,255,.08)", fontSize: 12 }}><span style={{ color: "#bca7dd" }}>{job.id}</span><b>{job.project}</b><span>{job.ep}</span><span>{job.model}</span><span>{job.duration}</span><span style={{ color: job.status === "รอคิว" ? "#e8c779" : "#9be8ca" }}>{job.status}</span></div>)}
      </section>

      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(171,120,255,.13)", background: "#0b0811", color: "#9c91ad", fontSize: 12, lineHeight: 1.6 }}>ตอนนี้เป็น Mock Queue เพื่อทดสอบ UX ก่อนเชื่อม Video Provider จริง งานจริงจะมี Progress, Cancel, Retry, Regenerate Scene, ค่าใช้จ่าย และลิงก์ผลลัพธ์</div>
    </main>
  );
}
