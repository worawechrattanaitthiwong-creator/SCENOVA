export type SessionUser = {
  id: string;
  email: string;
  displayName?: string;
  role: "user" | "support" | "finance" | "admin";
};

export interface AuthService {
  getSession(request: Request): Promise<SessionUser | null>;
  requireUser(request: Request): Promise<SessionUser>;
}

export function assertProjectOwner(user: SessionUser, projectUserId: string) {
  if (user.id !== projectUserId && user.role !== "admin") throw new Error("คุณไม่มีสิทธิ์เข้าถึงโปรเจกต์นี้");
}

export const ROLE_HELP_TH = {
  user: "ผู้ใช้งานทั่วไป เข้าถึงเฉพาะโปรเจกต์และเครดิตของตัวเอง",
  support: "ฝ่ายช่วยเหลือ ดูสถานะงานตามสิทธิ์แต่ไม่สามารถเห็น API Secret หรือแก้ยอดเงินโดยตรง",
  finance: "ดูรายการเติมเงินและ Ledger ตามสิทธิ์ ไม่สามารถเข้าถึง Secret ของ Video Provider",
  admin: "ผู้ดูแลระบบ ใช้เฉพาะบัญชีที่เปิด 2FA และมี Audit Log ทุกการเปลี่ยนแปลงสำคัญ",
} as const;
