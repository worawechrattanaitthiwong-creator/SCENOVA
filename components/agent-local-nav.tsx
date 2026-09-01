import Link from "next/link";

const ITEMS = [
  { href: "/studio#setup", label: "← กลับไปแก้ไขโมเดล", description: "กลับไปหน้า Studio เพื่อเปลี่ยนโมเดลวิดีโอและการตั้งค่างาน" },
  { href: "/agent#runs", label: "งาน AI", description: "งานที่กำลังทำและประวัติ" },
  { href: "/agent#approvals", label: "รออนุมัติ", description: "จุดที่ต้องยืนยันก่อนใช้ทรัพยากร" },
  { href: "/wallet#activity", label: "เครดิตและค่าใช้จ่าย", description: "ยอดใช้จริง การสำรอง และการคืนเครดิต" },
  { href: "/render", label: "คิวสร้างวิดีโอ", description: "สถานะงาน Generation และผลลัพธ์" },
] as const;

export default function AgentLocalNav() {
  return (
    <nav className="sc-agent-local-nav" aria-label="เมนู AI Agent">
      {ITEMS.map((item) => (
        <Link key={item.href} href={item.href} prefetch={false} title={item.description}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
