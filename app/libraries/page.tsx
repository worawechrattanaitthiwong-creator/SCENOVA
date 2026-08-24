import Link from "next/link";

const libraries = [
  { href: "/libraries/images", icon: "▧", title: "คลังภาพ", desc: "Style Preview, Reference และภาพอ้างอิงพร้อมตัวอย่าง", visual: "linear-gradient(135deg,#4f3471,#a66f9d 50%,#d39772)" },
  { href: "/libraries/voices", icon: "♫", title: "คลังเสียง", desc: "เสียงตัวละครหลายบุคลิก พร้อมปุ่มฟังตัวอย่าง", visual: "linear-gradient(135deg,#251a3b,#63418a 55%,#9d5e96)" },
  { href: "/libraries/characters", icon: "◎", title: "คลังตัวละคร", desc: "ตัวละครและ Reference Pack ที่เลือกกลับไปใช้ซ้ำได้", visual: "linear-gradient(135deg,#26334a,#6f5a7d 55%,#b77b92)" },
  { href: "/libraries/pets", icon: "◇", title: "คลังสัตว์ / Creature", desc: "สัตว์เลี้ยง สิ่งมีชีวิตแฟนตาซี และ Robot companion", visual: "linear-gradient(135deg,#24333c,#586b66 55%,#9d7b6b)" },
  { href: "/libraries/ambience", icon: "≈", title: "คลังบรรยากาศ / SFX", desc: "เสียงรอบข้างและ ambience สำหรับใส่ในแต่ละฉาก", visual: "linear-gradient(135deg,#172333,#3c5367 55%,#7c718c)" },
  { href: "/libraries/plots", icon: "✦", title: "คลังพล็อตเรื่อง", desc: "พล็อตตั้งต้นพร้อมโทนเรื่องสำหรับเริ่มสร้างเร็ว", visual: "linear-gradient(135deg,#321f35,#6d3a55 55%,#b36b55)" },
  { href: "/libraries/videos", icon: "▸", title: "คลังวิดีโอ", desc: "คลิปที่สร้างเสร็จ พร้อมชื่อ EP ชื่อตอน และดาวน์โหลด", visual: "linear-gradient(135deg,#171429,#3c3266 55%,#7550a8)" },
] as const;

export default function LibrariesPage() {
  return (
    <main style={{ maxWidth: 1320, margin: "0 auto", padding: 28, color: "#f7f3ff" }}>
      <header style={{ marginBottom: 18 }}>
        <span style={{ color: "#b994ed", fontSize: 10, fontWeight: 850, letterSpacing: ".12em" }}>SCENOVA LIBRARIES</span>
        <h1 style={{ fontSize: 28, margin: "6px 0" }}>เลือกคลังที่ต้องการ</h1>
        <p style={{ margin: 0, color: "#9c91ad", fontSize: 12, lineHeight: 1.6, maxWidth: 760 }}>แยกแต่ละคลังออกจากกันชัดเจน เพื่อหา Asset ได้เร็วขึ้น ภายในแต่ละคลังจะมีตัวอย่าง ชื่อ และคำอธิบายสั้นก่อนกดใช้งาน</p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        {libraries.map((item) => (
          <Link key={item.href} href={item.href} prefetch style={{ overflow: "hidden", color: "white", textDecoration: "none", border: "1px solid rgba(171,120,255,.15)", borderRadius: 16, background: "#0d0914" }}>
            <div style={{ height: 120, display: "grid", placeItems: "center", fontSize: 26, fontWeight: 900, background: item.visual }}>{item.icon}</div>
            <div style={{ padding: 13 }}><h2 style={{ fontSize: 14, margin: "0 0 5px" }}>{item.title}</h2><p style={{ margin: 0, color: "#958aa6", fontSize: 11, lineHeight: 1.55 }}>{item.desc}</p><span style={{ display: "inline-block", marginTop: 10, color: "#c8a8ff", fontSize: 10, fontWeight: 800 }}>เปิดคลัง →</span></div>
          </Link>
        ))}
      </section>
    </main>
  );
}
