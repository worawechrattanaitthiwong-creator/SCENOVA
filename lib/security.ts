export type SecurityPolicy = {
  maxConcurrentGenerationJobsPerUser: number;
  maxGenerationRequestsPerMinutePerUser: number;
  maxGenerationRequestsPerMinutePerIp: number;
  maxUploadBytes: number;
  allowedImageMimeTypes: string[];
  allowedVideoMimeTypes: string[];
  hourlyProviderSpendCapThb: number;
  dailyProviderSpendCapThb: number;
  signedUrlTtlSeconds: number;
  requireCaptchaAfterSuspiciousAttempts: number;
};

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  maxConcurrentGenerationJobsPerUser: 2,
  maxGenerationRequestsPerMinutePerUser: 6,
  maxGenerationRequestsPerMinutePerIp: 12,
  maxUploadBytes: 250 * 1024 * 1024,
  allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedVideoMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
  hourlyProviderSpendCapThb: 3000,
  dailyProviderSpendCapThb: 20000,
  signedUrlTtlSeconds: 15 * 60,
  requireCaptchaAfterSuspiciousAttempts: 3,
};

export type KillSwitchState = {
  globalGenerationDisabled: boolean;
  disabledProviderIds: string[];
  reason?: string;
};

export function assertGenerationAllowed(input: {
  killSwitch: KillSwitchState;
  providerId: string;
  hourlySpendThb: number;
  dailySpendThb: number;
  policy?: SecurityPolicy;
}) {
  const policy = input.policy ?? DEFAULT_SECURITY_POLICY;
  if (process.env.SCENOVA_EMERGENCY_LOCKDOWN === "true") throw new Error("Generation disabled by environment emergency lockdown");
  if (process.env.SCENOVA_GENERATION_KILL_SWITCH === "true") throw new Error("Generation disabled by environment kill switch");
  if (input.killSwitch.globalGenerationDisabled) throw new Error(input.killSwitch.reason ?? "Generation disabled by kill switch");
  if (input.killSwitch.disabledProviderIds.includes(input.providerId)) throw new Error(`Provider ${input.providerId} is disabled`);
  if (input.hourlySpendThb >= policy.hourlyProviderSpendCapThb) throw new Error("Hourly provider spend cap reached");
  if (input.dailySpendThb >= policy.dailyProviderSpendCapThb) throw new Error("Daily provider spend cap reached");
}

export const SECURITY_CHECKLIST_TH = [
  "API Key (รหัสลับเชื่อมบริการ) เก็บฝั่ง Server/Secret Manager เท่านั้น ห้ามส่งไป Browser",
  "ทุกการ Generate (สร้างงาน) ต้องผ่าน Auth (ยืนยันตัวตน), Rate Limit (จำกัดจำนวนคำขอ), Server-side Pricing (คำนวณราคาฝั่ง Server) และ Credit Reservation (กันเครดิตไว้ก่อน)",
  "ใช้ Idempotency Key (รหัสกันคำสั่งซ้ำ) ป้องกันการสร้างงานหรือตัดเครดิตซ้ำจากการกดหลายครั้งหรือ Refresh",
  "Video/Image Storage (พื้นที่เก็บไฟล์) ต้องเป็น Private และให้เข้าถึงผ่าน Signed URL (ลิงก์ชั่วคราวมีวันหมดอายุ) เท่านั้น",
  "Upload (การอัปโหลด) ต้องจำกัด MIME Type (ชนิดไฟล์), ขนาด, จำนวนไฟล์ และตรวจ Metadata (ข้อมูลกำกับไฟล์) ก่อนใช้งาน",
  "บันทึก Audit Log (ประวัติการทำงานย้อนหลัง): ผู้ใช้, งาน, โมเดล, ระยะเวลา, ค่าใช้จ่ายประมาณการ/จริง, Provider Task ID และเวลา",
  "มี Hourly/Daily Spend Cap (เพดานค่าใช้จ่าย), Provider Isolation (แยกปิดผู้ให้บริการ) และ Emergency Lockdown (ปิดระบบฉุกเฉิน) ที่ตัด Outbound Call (การเรียกบริการออกนอกระบบ) ได้ทันที",
  "Admin ใช้ 2FA (ยืนยันตัวตนสองขั้นตอน) และแยกสิทธิ์ Support / Finance / Developer ตามหน้าที่",
];
