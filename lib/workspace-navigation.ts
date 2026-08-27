export type WorkspaceNavItem = {
  href: string;
  icon: "home" | "project" | "ai" | "board" | "library" | "settings" | "help";
  label: string;
  description: string;
  badge?: string;
  activePaths?: readonly string[];
};

export type WorkspaceRailItem = {
  href: string;
  icon: string;
  label: string;
  description: string;
};

// Sidebar master: keep this identical to the original Start/Portal navigation.
// Every authenticated route renders this same list through AppShell.
export const WORKSPACE_NAV: readonly WorkspaceNavItem[] = [
  { href: "/portal", icon: "home", label: "เริ่มต้น", description: "ภาพรวมสตูดิโอ" },
  { href: "/series", icon: "project", label: "โปรเจกต์", description: "หนังและซีรีส์ของคุณ", badge: "EP" },
  { href: "/studio", icon: "ai", label: "AI Studio", description: "สร้างและกำกับงาน", badge: "AI" },
  { href: "/director", icon: "board", label: "สตอรี่บอร์ด", description: "ฉาก กล้อง และไทม์ไลน์", activePaths: ["/director", "/camera", "/dialogue", "/reference"] },
  { href: "/libraries", icon: "library", label: "คลังทรัพยากร", description: "ตัวละคร เสียง และสไตล์" },
  { href: "/profile", icon: "settings", label: "การตั้งค่า", description: "บัญชี ความปลอดภัย และผู้ดูแล", activePaths: ["/profile", "/admin"] },
  { href: "/portal#guide", icon: "help", label: "ช่วยเหลือ", description: "คู่มือการใช้งาน", activePaths: [] },
] as const;

const portalRail: readonly WorkspaceRailItem[] = [
  { href: "/studio#setup", icon: "▣", label: "ตั้งค่างาน", description: "เริ่มต้นโปรเจกต์" },
  { href: "/studio#characters", icon: "◎", label: "ตัวละครและเสียง", description: "ล็อกตัวละครและเสียง" },
  { href: "/studio#scenes", icon: "△", label: "กำกับฉาก", description: "ภาพ แสง การเคลื่อนไหว" },
  { href: "/libraries?tab=characters", icon: "▦", label: "คลังตัวละคร", description: "จัดการ Character Reference" },
] as const;

const studioRail: readonly WorkspaceRailItem[] = [
  { href: "/studio#setup", icon: "▣", label: "ตั้งค่างาน", description: "เรื่อง โมเดล เวลา และสไตล์" },
  { href: "/studio#characters", icon: "◎", label: "ตัวละครและเสียง", description: "Character / Voice Lock" },
  { href: "/studio#scenes", icon: "△", label: "กำกับฉาก", description: "Scene กล้อง แสง และเสียง" },
  { href: "/studio#review", icon: "✎", label: "Prompt & Render", description: "ตรวจ Prompt และเตรียมสร้าง" },
] as const;

const seriesRail: readonly WorkspaceRailItem[] = [
  { href: "/series#history", icon: "EP", label: "ลำดับตอน", description: "จัดการ Episode ทั้งหมด" },
  { href: "/series#episode-editor", icon: "▣", label: "พื้นที่ทำตอน", description: "แก้เนื้อหาและ Scene" },
  { href: "/series#continuity", icon: "◇", label: "ความต่อเนื่อง", description: "Canon และ Continuity Lock" },
  { href: "/libraries?tab=videos", icon: "▶", label: "ตอนที่สร้างแล้ว", description: "เปิดคลังวิดีโอ" },
] as const;

const directorRail: readonly WorkspaceRailItem[] = [
  { href: "/director", icon: "▤", label: "สตอรี่บอร์ด", description: "Timeline และ Shot" },
  { href: "/camera", icon: "◉", label: "กล้องและเลนส์", description: "มุม เลนส์ และการเคลื่อน" },
  { href: "/dialogue", icon: "♫", label: "บทและเสียงพูด", description: "Dialogue และ Voice" },
  { href: "/reference", icon: "▧", label: "ภาพอ้างอิง", description: "Reference สำหรับการกำกับ" },
] as const;

const libraryRail: readonly WorkspaceRailItem[] = [
  { href: "/libraries?tab=images", icon: "▧", label: "ภาพ & สไตล์", description: "Visual Style / Reference" },
  { href: "/libraries?tab=characters", icon: "◎", label: "ตัวละคร", description: "Character Reference Pack" },
  { href: "/libraries?tab=voices", icon: "♫", label: "เสียง", description: "Voice Preset" },
  { href: "/libraries?tab=ambience", icon: "≈", label: "บรรยากาศ / SFX", description: "Soundscape และเอฟเฟกต์" },
  { href: "/libraries?tab=videos", icon: "▶", label: "วิดีโอ", description: "ผลงานที่สร้างแล้ว" },
] as const;

const agentRail: readonly WorkspaceRailItem[] = [
  { href: "/agent#runs", icon: "✧", label: "งาน AI", description: "งานที่กำลังทำและประวัติ" },
  { href: "/agent#approvals", icon: "✓", label: "รออนุมัติ", description: "ตรวจจุดก่อนใช้ทรัพยากร" },
  { href: "/wallet#activity", icon: "●", label: "เครดิตที่ใช้", description: "ค่าใช้จ่ายของงาน" },
  { href: "/render", icon: "▶", label: "คิวสร้าง", description: "ติดตาม Video Generation" },
] as const;

const modelsRail: readonly WorkspaceRailItem[] = [
  { href: "/models", icon: "⬡", label: "เปรียบเทียบโมเดล", description: "ความสามารถและข้อจำกัด" },
  { href: "/wallet", icon: "●", label: "เครดิตและงบ", description: "ยอดพร้อมใช้และค่าใช้จ่าย" },
  { href: "/studio#setup", icon: "AI", label: "ใช้ใน Studio", description: "กลับไปเลือกโมเดลในงาน" },
] as const;

const renderRail: readonly WorkspaceRailItem[] = [
  { href: "/render", icon: "▶", label: "คิวสร้างวิดีโอ", description: "สถานะงาน Generation" },
  { href: "/wallet#activity", icon: "●", label: "ค่าใช้เครดิต", description: "ตรวจค่าใช้จ่ายจริง" },
  { href: "/libraries?tab=videos", icon: "▦", label: "งานที่สร้างแล้ว", description: "เปิดผลลัพธ์ใน Library" },
] as const;

const walletRail: readonly WorkspaceRailItem[] = [
  { href: "/wallet", icon: "●", label: "ยอดเครดิต", description: "เครดิตพร้อมใช้และสำรอง" },
  { href: "/wallet#activity", icon: "≡", label: "ประวัติการใช้", description: "รายการหักและคืนเครดิต" },
  { href: "/models", icon: "⬡", label: "ราคาโมเดล", description: "เปรียบเทียบก่อนสร้าง" },
] as const;

const profileRail: readonly WorkspaceRailItem[] = [
  { href: "/profile", icon: "◉", label: "บัญชี", description: "ข้อมูลผู้ใช้" },
  { href: "/profile#security", icon: "◇", label: "ความปลอดภัย", description: "2FA และการเข้าสู่ระบบ" },
  { href: "/portal#guide", icon: "?", label: "คู่มือ", description: "กลับไปดูแนวทางใช้งาน" },
] as const;

const adminRail: readonly WorkspaceRailItem[] = [
  { href: "/admin", icon: "⚙", label: "สมาชิกและคลัง", description: "จัดการระบบหลัก" },
  { href: "/admin/security", icon: "◇", label: "ความปลอดภัย", description: "มาตรการและ Emergency Control" },
  { href: "/admin/ai-costs", icon: "●", label: "ค่าใช้จ่าย AI", description: "ต้นทุนและการใช้งาน" },
] as const;

export function isWorkspaceNavActive(item: WorkspaceNavItem, pathname: string) {
  const paths = item.activePaths ?? [new URL(item.href, "https://scenova.local").pathname];
  return paths.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

export function getWorkspaceRail(pathname: string): readonly WorkspaceRailItem[] {
  if (pathname === "/portal") return portalRail;
  if (pathname.startsWith("/series")) return seriesRail;
  if (pathname.startsWith("/studio")) return studioRail;
  if (pathname.startsWith("/director") || pathname.startsWith("/camera") || pathname.startsWith("/dialogue") || pathname.startsWith("/reference")) return directorRail;
  if (pathname.startsWith("/libraries")) return libraryRail;
  if (pathname.startsWith("/agent")) return agentRail;
  if (pathname.startsWith("/models")) return modelsRail;
  if (pathname.startsWith("/render")) return renderRail;
  if (pathname.startsWith("/wallet")) return walletRail;
  if (pathname.startsWith("/admin")) return adminRail;
  if (pathname.startsWith("/profile")) return profileRail;
  return studioRail;
}

export function getWorkspaceContext(pathname: string): string {
  if (pathname === "/portal") return "Production Command Center";
  if (pathname.startsWith("/series")) return "โปรเจกต์และซีรีส์";
  if (pathname.startsWith("/studio")) return "AI Studio";
  if (pathname.startsWith("/director") || pathname.startsWith("/camera") || pathname.startsWith("/dialogue") || pathname.startsWith("/reference")) return "Cinematic Direction";
  if (pathname.startsWith("/libraries")) return "คลังทรัพยากร";
  if (pathname.startsWith("/agent")) return "AI Agent";
  if (pathname.startsWith("/models")) return "Model Center";
  if (pathname.startsWith("/render")) return "คิวสร้างวิดีโอ";
  if (pathname.startsWith("/wallet")) return "เครดิตและค่าใช้จ่าย";
  if (pathname.startsWith("/admin")) return "Admin Console";
  if (pathname.startsWith("/profile")) return "บัญชีและความปลอดภัย";
  return "SCENOVA Studio";
}
