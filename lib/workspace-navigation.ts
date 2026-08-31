export type WorkspaceNavChild = {
  href: string;
  label: string;
  adminOnly?: boolean;
};

export type WorkspaceNavItem = {
  href: string;
  icon: "home" | "project" | "ai" | "board" | "library" | "settings" | "help";
  label: string;
  description: string;
  badge?: string;
  activePaths?: readonly string[];
  children?: readonly WorkspaceNavChild[];
};

export type WorkspaceRailItem = {
  href: string;
  icon: string;
  label: string;
  description: string;
  adminOnly?: boolean;
};

export const WORKSPACE_NAV: readonly WorkspaceNavItem[] = [
  { href: "/portal", icon: "home", label: "เริ่มต้น", description: "ภาพรวมสตูดิโอ" },
  { href: "/studio", icon: "ai", label: "AI Studio", description: "สร้างและกำกับงาน", badge: "AI" },
  { href: "/models", icon: "board", label: "โมเดล & เรทราคา", description: "เปรียบเทียบโมเดล ความสามารถ และราคา" },
  { href: "/agent", icon: "ai", label: "AI Agent", description: "งานอัตโนมัติ การอนุมัติ ค่าใช้จ่าย และคิวสร้าง", badge: "AG" },
  { href: "/series", icon: "project", label: "Series Studio", description: "ซีรีส์ ตอน และ Storyboard", badge: "EP", activePaths: ["/series", "/director", "/camera", "/dialogue", "/reference"] },
  { href: "/libraries", icon: "library", label: "คลังทรัพยากร", description: "ตัวละคร เสียง และสไตล์" },
  {
    href: "/profile",
    icon: "settings",
    label: "การตั้งค่า",
    description: "บัญชี API 2FA ความปลอดภัย และระบบ",
    activePaths: ["/profile", "/admin/security", "/admin/ai-costs", "/guide"],
    children: [
      { href: "/profile/account", label: "บัญชี" },
      { href: "/profile/api", label: "API & Models" },
      { href: "/profile/2fa", label: "2FA" },
      { href: "/admin/security", label: "Security Center", adminOnly: true },
      { href: "/admin/ai-costs", label: "AI & Cost", adminOnly: true },
      { href: "/guide", label: "คู่มือการใช้งาน" },
    ],
  },
  { href: "/portal#guide", icon: "help", label: "ช่วยเหลือ", description: "เมนูผู้ดูแลระบบ", activePaths: [] },
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
  { href: "/series#overview", icon: "◇", label: "ภาพรวมซีรีส์", description: "Series Bible และ Canon" },
  { href: "/series#episodes", icon: "EP", label: "ตอนและความต่อเนื่อง", description: "จัดการ Episode และ Ending State" },
  { href: "/series#storyboard", icon: "▤", label: "Storyboard", description: "ฉาก กล้อง เสียง และไทม์ไลน์" },
  { href: "/series#production", icon: "▶", label: "ส่งผลิต", description: "AI Agent และประวัติวิดีโอ" },
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

const settingsRail: readonly WorkspaceRailItem[] = [
  { href: "/profile", icon: "◉", label: "บัญชี", description: "ข้อมูลผู้ใช้และการเข้าสู่ระบบ" },
  { href: "/profile/api", icon: "↔", label: "API & Models", description: "เชื่อม API, BYOK, Provider และสายงาน A–D" },
  { href: "/profile#security", icon: "◇", label: "2FA", description: "Authenticator และ Recovery Code" },
  { href: "/admin/security", icon: "⬡", label: "Security Center", description: "Emergency Control และมาตรการความปลอดภัย", adminOnly: true },
  { href: "/admin/ai-costs", icon: "●", label: "AI & Cost", description: "ต้นทุน AI และการควบคุมงบระบบ", adminOnly: true },
  { href: "/guide", icon: "?", label: "คู่มือ", description: "คู่มือระบบตามสิทธิ์บัญชี" },
] as const;

const userAdminRail: readonly WorkspaceRailItem[] = [
  { href: "/admin/users", icon: "◎", label: "จัดการผู้ใช้", description: "ค้นหา บัญชี รหัสผ่าน เครดิต การระงับ และ Log" },
] as const;

const adminAssetRail: readonly WorkspaceRailItem[] = [
  { href: "/admin", icon: "▦", label: "Asset Admin", description: "จัดการ Asset กลางของระบบ" },
  { href: "/libraries", icon: "◇", label: "เปิดคลัง", description: "ตรวจสิ่งที่ User มองเห็นในคลัง" },
] as const;

const guideRail: readonly WorkspaceRailItem[] = [
  { href: "/guide", icon: "?", label: "คู่มือระบบ", description: "ฟังก์ชันทั้งหมดตามสิทธิ์บัญชี" },
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
  if (pathname.startsWith("/guide")) return guideRail;
  if (pathname.startsWith("/admin/users")) return userAdminRail;
  if (pathname.startsWith("/admin/security") || pathname.startsWith("/admin/ai-costs")) return settingsRail;
  if (pathname === "/admin") return adminAssetRail;
  if (pathname.startsWith("/profile")) return settingsRail;
  return studioRail;
}

export function getWorkspaceContext(pathname: string): string {
  if (pathname === "/portal") return "Production Command Center";
  if (pathname.startsWith("/series")) return "Series";
  if (pathname.startsWith("/studio")) return "AI Studio";
  if (pathname.startsWith("/director") || pathname.startsWith("/camera") || pathname.startsWith("/dialogue") || pathname.startsWith("/reference")) return "Cinematic Direction";
  if (pathname.startsWith("/libraries")) return "คลังทรัพยากร";
  if (pathname.startsWith("/agent")) return "AI Agent";
  if (pathname.startsWith("/models")) return "Model Center";
  if (pathname.startsWith("/render")) return "คิวสร้างวิดีโอ";
  if (pathname.startsWith("/wallet")) return "เครดิตและค่าใช้จ่าย";
  if (pathname.startsWith("/guide")) return "คู่มือระบบ";
  if (pathname.startsWith("/admin/users")) return "User Control Center";
  if (pathname.startsWith("/admin/security")) return "การตั้งค่า / Security Center";
  if (pathname.startsWith("/admin/ai-costs")) return "การตั้งค่า / AI & Cost";
  if (pathname === "/admin") return "Asset Administration";
  if (pathname.startsWith("/profile/api")) return "การตั้งค่า / API & Models";
  if (pathname.startsWith("/profile")) return "การตั้งค่า";
  return "SCENOVA Studio";
}
