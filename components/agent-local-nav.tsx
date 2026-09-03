import Link from "next/link";

const ITEMS = [
  { href: "/agent", label: "AI Planner", description: "เขียนบท วิเคราะห์ และสร้าง Structured Plan" },
  { href: "/studio", label: "AI Studio", description: "ตรวจและแก้แผนสำหรับตอนเดียวก่อนสร้างวิดีโอ" },
  { href: "/series", label: "Series Studio", description: "ตรวจ Series Bible, Episodes และ Continuity ก่อนสร้างวิดีโอ" },
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
