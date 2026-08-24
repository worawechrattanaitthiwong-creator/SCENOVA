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
  if (input.killSwitch.globalGenerationDisabled) throw new Error(input.killSwitch.reason ?? "Generation disabled by kill switch");
  if (input.killSwitch.disabledProviderIds.includes(input.providerId)) throw new Error(`Provider ${input.providerId} is disabled`);
  if (input.hourlySpendThb >= policy.hourlyProviderSpendCapThb) throw new Error("Hourly provider spend cap reached");
  if (input.dailySpendThb >= policy.dailyProviderSpendCapThb) throw new Error("Daily provider spend cap reached");
}

export const SECURITY_CHECKLIST_TH = [
  "API Key เก็บฝั่ง Server/Secret Manager เท่านั้น ห้ามส่งไป Browser",
  "ทุก Generate ต้องผ่าน Auth, Rate Limit, Server-side Pricing และ Credit Reservation",
  "ใช้ Idempotency Key ป้องกันคำสั่งซ้ำจากการกดหลายครั้งหรือ Refresh",
  "Video/Image Storage เป็น Private และแจกเฉพาะ Signed URL อายุสั้น",
  "Upload ต้องจำกัด MIME, ขนาด, จำนวนไฟล์ และสแกน metadata ก่อนใช้งาน",
  "บันทึก Audit Log: user, job, model, duration, estimated cost, actual cost, provider task id, timestamp",
  "มี Hourly/Daily Spend Cap และ Kill Switch ปิด Provider ได้ทันที",
  "Admin ใช้ 2FA และแยกสิทธิ์ Support/Finance/Developer",
];
