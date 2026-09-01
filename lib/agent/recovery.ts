export type RecoveryAction = "RETRY" | "SWITCH_PROVIDER" | "ASK_USER" | "STOP";

export function decideAgentRecovery(input: { error: unknown; attempt: number; maxRetries: number; providerSwitches: number; maxProviderSwitches: number }): { action: RecoveryAction; delayMs: number; reason: string } {
  const message = input.error instanceof Error ? input.error.message : String(input.error || "UNKNOWN_ERROR");
  const normalized = message.toLowerCase();

  if (normalized.includes("budget") || normalized.includes("spend cap") || normalized.includes("kill switch")) {
    return { action: "STOP", delayMs: 0, reason: "Guardrail ด้านงบประมาณหรือ Kill Switch ปฏิเสธงาน" };
  }
  if (normalized.includes("content policy") || normalized.includes("policy reject") || normalized.includes("moderation")) {
    return { action: "ASK_USER", delayMs: 0, reason: "Provider ปฏิเสธเนื้อหา ต้องให้ผู้ใช้แก้ Prompt หรือ Scene ก่อน" };
  }

  const quotaExhausted =
    normalized.includes("exceeded your current quota") ||
    normalized.includes("check your plan and billing") ||
    normalized.includes("billing details") ||
    (normalized.includes("resource_exhausted") && normalized.includes("quota"));
  if (quotaExhausted) {
    return {
      action: "ASK_USER",
      delayMs: 0,
      reason: "Provider ตอบ HTTP 429 / RESOURCE_EXHAUSTED ซึ่งอาจเกิดจาก Rate Limit, Model Quota หรือ Spend Limit แม้บัญชียังมียอดเงินคงเหลือ ระบบจะหยุด Retry อัตโนมัติเพื่อป้องกันงานซ้ำ กรุณาตรวจ Rate Limit แล้วเลือกงานนี้ในรายการงาน AI เพื่อกด “บังคับเริ่มงานนี้” อีกครั้ง",
    };
  }

  if (
    normalized.includes("video_provider_connection_required") ||
    normalized.includes("provider_connection_required") ||
    normalized.includes("video_provider_not_found") ||
    normalized.includes("invalid_api_key") ||
    normalized.includes("credential_required")
  ) {
    return { action: "ASK_USER", delayMs: 0, reason: "ยังไม่พบ Video Provider/Credential ที่พร้อมใช้งานสำหรับโมเดลนี้ กรุณาตรวจการเชื่อมต่อ Provider แล้วเริ่มงานอีกครั้ง" };
  }
  if ((normalized.includes("unavailable") || normalized.includes("provider disabled")) && input.providerSwitches < input.maxProviderSwitches) {
    return { action: "SWITCH_PROVIDER", delayMs: 0, reason: "Provider ใช้งานไม่ได้และยังอยู่ในสิทธิ์สลับ Provider" };
  }
  if (input.attempt <= input.maxRetries) {
    return { action: "RETRY", delayMs: Math.min(60_000, 2 ** Math.max(0, input.attempt - 1) * 5_000), reason: "Transient failure — retry ด้วย exponential backoff" };
  }
  return { action: "STOP", delayMs: 0, reason: "เกินจำนวน Retry ที่กำหนด" };
}
