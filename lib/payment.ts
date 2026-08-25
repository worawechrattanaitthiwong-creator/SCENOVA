export type TopUpRequest = {
  userId: string;
  amountThb: number;
  credits: number;
  method: "promptpay" | "card" | "bank";
  idempotencyKey: string;
};

export type PaymentSession = {
  paymentId: string;
  status: "pending" | "paid" | "failed" | "expired";
  amountThb: number;
  qrCodeUrl?: string;
  checkoutUrl?: string;
  expiresAt?: string;
};

export type VerifiedPaymentEvent = {
  eventId: string;
  paymentId: string;
  status: "paid" | "failed" | "refunded";
  amountThb: number;
  signatureVerified: boolean;
  rawMetadata?: Record<string, unknown>;
};

export interface PaymentGateway {
  id: string;
  createTopUp(request: TopUpRequest): Promise<PaymentSession>;
  verifyWebhook(input: { rawBody: string; signature: string }): Promise<VerifiedPaymentEvent>;
}

/**
 * Production rules:
 * - เติมเครดิตเฉพาะหลัง verify webhook signature สำเร็จ
 * - ห้ามเชื่อผลการจ่ายจาก redirect/query string ฝั่ง Browser
 * - paymentId และ eventId ต้อง idempotent ป้องกันเติมเครดิตซ้ำ
 * - แยก Paid Credits และ Bonus Credits เพื่อทำบัญชี/โปรโมชั่นได้ถูกต้อง
 * - Gateway เป็นปลั๊กอิน ปัจจุบันยังไม่เชื่อม Opn/Stripe ตามแผน
 */
export const PAYMENT_RULES_TH = [
  "สร้างรายการเติมเงินจาก Backend เท่านั้น",
  "ตรวจ webhook signature ก่อนเพิ่มเครดิต",
  "ตรวจยอดเงินจริงตรงกับรายการที่สร้างไว้",
  "event เดิมประมวลผลได้ครั้งเดียว",
  "เก็บ Payment Transaction และ Wallet Ledger แยกกัน",
  "ห้ามเก็บข้อมูลบัตรดิบใน SCENOVA",
] as const;
