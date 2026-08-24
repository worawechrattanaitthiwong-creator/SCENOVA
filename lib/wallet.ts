export type CreditBalance = {
  paid: number;
  bonus: number;
  reserved: number;
  available: number;
};

export type CreditReservation = {
  reservationId: string;
  userId: string;
  credits: number;
  purpose: "prompt" | "video" | "image-preview" | "video-preview";
  referenceId: string;
  status: "reserved" | "charged" | "refunded";
  createdAt: string;
};

export interface WalletService {
  getBalance(userId: string): Promise<CreditBalance>;
  reserve(input: { userId: string; credits: number; purpose: CreditReservation["purpose"]; referenceId: string; idempotencyKey: string }): Promise<CreditReservation>;
  charge(reservationId: string, actualCredits?: number): Promise<CreditReservation>;
  refund(reservationId: string, reason: string): Promise<CreditReservation>;
}

/**
 * Production rule:
 * 1) Server คำนวณราคาเอง ห้ามเชื่อราคาจาก Browser
 * 2) Reserve ก่อนเรียก Provider
 * 3) Provider สำเร็จ -> Charge
 * 4) Provider ล้มเหลวและไม่ถูกคิดเงิน -> Refund
 * 5) ใช้ idempotency key ป้องกันกด Generate ซ้ำ
 *
 * ยังไม่ผูกเงินจริงในเฟสนี้ ตามแผนที่จะเชื่อม Credit/Payment หลัง Video API เสถียรแล้ว
 */
export const CREDIT_FLOW = ["SERVER_PRICE", "RESERVE", "QUEUE", "GENERATE", "SETTLE_OR_REFUND"] as const;
