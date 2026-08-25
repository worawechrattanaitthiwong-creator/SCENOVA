import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertEmergencyCapability } from "@/lib/emergency-security";

export type CreditBalance = {
  paid: number;
  bonus: number;
  reserved: number;
  available: number;
};

export type CreditPurpose = "prompt" | "prompt-export" | "agent" | "video" | "image-preview" | "video-preview" | "audio";

export type CreditReservation = {
  reservationId: string;
  userId: string;
  credits: number;
  chargedCredits: number;
  purpose: CreditPurpose;
  category: string;
  referenceId: string;
  status: "reserved" | "charged" | "refunded";
  createdAt: string;
};

export interface WalletService {
  getBalance(userId: string): Promise<CreditBalance>;
  reserve(input: {
    userId: string;
    credits: number;
    purpose: CreditPurpose;
    referenceId: string;
    idempotencyKey: string;
    category?: string;
    quoteId?: string | null;
    metadata?: Record<string, unknown>;
    expiresAt?: Date | null;
  }): Promise<CreditReservation>;
  charge(reservationId: string, actualCredits?: number): Promise<CreditReservation>;
  refund(reservationId: string, reason: string): Promise<CreditReservation>;
}

function assertCredits(value: number) {
  const credits = Math.ceil(Number(value));
  if (!Number.isFinite(credits) || credits <= 0) throw new Error("INVALID_CREDIT_AMOUNT");
  return credits;
}

function mapReservation(row: {
  id: string;
  userId: string;
  credits: number;
  chargedCredits: number;
  purpose: string;
  category: string;
  referenceId: string;
  status: string;
  createdAt: Date;
}): CreditReservation {
  return {
    reservationId: row.id,
    userId: row.userId,
    credits: row.credits,
    chargedCredits: row.chargedCredits,
    purpose: row.purpose as CreditPurpose,
    category: row.category,
    referenceId: row.referenceId,
    status: row.status as CreditReservation["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

function jsonObject(value?: Record<string, unknown>): Prisma.InputJsonObject {
  return (value || {}) as Prisma.InputJsonObject;
}

function metadataRecord(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * Production wallet adapter.
 * - Server is the only source of truth for price.
 * - Reserve does not deduct spendable balances; it locks availability in Wallet.reserved.
 * - Charge atomically releases the reservation and deducts actual usage.
 * - Refund releases a reservation, or restores a previously charged amount.
 * - Every mutation is idempotent and leaves a WalletLedger + CostUsageEvent trail.
 * - Emergency Security Center can freeze every wallet mutation immediately.
 */
export class PrismaWalletService implements WalletService {
  async getBalance(userId: string): Promise<CreditBalance> {
    const wallet = await prisma.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
    const total = wallet.paidBalance + wallet.bonusBalance;
    return { paid: wallet.paidBalance, bonus: wallet.bonusBalance, reserved: wallet.reserved, available: Math.max(0, total - wallet.reserved) };
  }

  async reserve(input: {
    userId: string;
    credits: number;
    purpose: CreditPurpose;
    referenceId: string;
    idempotencyKey: string;
    category?: string;
    quoteId?: string | null;
    metadata?: Record<string, unknown>;
    expiresAt?: Date | null;
  }): Promise<CreditReservation> {
    await assertEmergencyCapability("payment");
    const credits = assertCredits(input.credits);
    const category = input.category || input.purpose.toUpperCase().replaceAll("-", "_");
    const metadata = { quoteId: input.quoteId || null, ...input.metadata };

    return prisma.$transaction(async (tx) => {
      const existing = await tx.creditReservation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return mapReservation(existing);

      const wallet = await tx.wallet.upsert({ where: { userId: input.userId }, update: {}, create: { userId: input.userId } });
      const available = wallet.paidBalance + wallet.bonusBalance - wallet.reserved;
      if (available < credits) throw new Error("INSUFFICIENT_CREDITS");

      const id = randomUUID();
      const reservation = await tx.creditReservation.create({
        data: {
          id, walletId: wallet.id, userId: input.userId, credits, purpose: input.purpose, category, referenceId: input.referenceId,
          idempotencyKey: input.idempotencyKey, metadata: jsonObject(metadata), expiresAt: input.expiresAt ?? null,
        },
      });
      await tx.wallet.update({ where: { id: wallet.id }, data: { reserved: { increment: credits } } });
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id, type: "RESERVE", credits: 0, balanceAfter: wallet.paidBalance + wallet.bonusBalance,
          referenceType: "credit-reservation", referenceId: id, idempotencyKey: `${input.idempotencyKey}:reserve`,
          metadata: jsonObject({ reservedCredits: credits, purpose: input.purpose, category, ...metadata }),
        },
      });
      await tx.costUsageEvent.create({
        data: {
          id: randomUUID(), userId: input.userId, quoteId: input.quoteId || null, category, label: `Reserve ${input.purpose}`, phase: "RESERVE", credits,
          referenceType: "credit-reservation", referenceId: id, metadata: jsonObject(metadata),
        },
      });
      return mapReservation(reservation);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async charge(reservationId: string, actualCredits?: number): Promise<CreditReservation> {
    await assertEmergencyCapability("payment");
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.creditReservation.findUnique({ where: { id: reservationId } });
      if (!reservation) throw new Error("CREDIT_RESERVATION_NOT_FOUND");
      if (reservation.status === "charged") return mapReservation(reservation);
      if (reservation.status === "refunded") throw new Error("CREDIT_RESERVATION_ALREADY_REFUNDED");

      const actual = actualCredits === undefined ? reservation.credits : assertCredits(actualCredits);
      if (actual > reservation.credits) throw new Error("CHARGE_EXCEEDS_RESERVATION");
      const wallet = await tx.wallet.findUnique({ where: { id: reservation.walletId } });
      if (!wallet) throw new Error("WALLET_NOT_FOUND");

      const paidCharge = Math.min(wallet.paidBalance, actual);
      const bonusCharge = actual - paidCharge;
      if (bonusCharge > wallet.bonusBalance) throw new Error("INSUFFICIENT_CREDITS_AT_SETTLEMENT");
      const paidAfter = wallet.paidBalance - paidCharge;
      const bonusAfter = wallet.bonusBalance - bonusCharge;
      const oldMetadata = metadataRecord(reservation.metadata);
      const quoteId = typeof oldMetadata.quoteId === "string" ? oldMetadata.quoteId : null;

      await tx.wallet.update({ where: { id: wallet.id }, data: { paidBalance: paidAfter, bonusBalance: bonusAfter, reserved: { decrement: reservation.credits } } });
      const updated = await tx.creditReservation.update({
        where: { id: reservation.id },
        data: {
          status: "charged", chargedCredits: actual,
          metadata: jsonObject({ ...oldMetadata, chargedPaid: paidCharge, chargedBonus: bonusCharge, releasedUnusedReservation: reservation.credits - actual }),
        },
      });
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id, type: "CHARGE", credits: -actual, balanceAfter: paidAfter + bonusAfter,
          referenceType: "credit-reservation", referenceId: reservation.id, idempotencyKey: `${reservation.idempotencyKey}:charge`,
          metadata: jsonObject({ category: reservation.category, purpose: reservation.purpose, reservedCredits: reservation.credits, actualCredits: actual, quoteId }),
        },
      });
      await tx.costUsageEvent.create({
        data: {
          id: randomUUID(), userId: reservation.userId, quoteId, category: reservation.category, label: `Charge ${reservation.purpose}`,
          phase: "CHARGE", credits: actual, referenceType: "credit-reservation", referenceId: reservation.id,
        },
      });
      if (actual < reservation.credits) {
        await tx.costUsageEvent.create({
          data: {
            id: randomUUID(), userId: reservation.userId, quoteId, category: reservation.category, label: "Unused reservation released",
            phase: "RELEASE", credits: reservation.credits - actual, referenceType: "credit-reservation", referenceId: reservation.id,
          },
        });
      }
      return mapReservation(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async refund(reservationId: string, reason: string): Promise<CreditReservation> {
    await assertEmergencyCapability("payment");
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.creditReservation.findUnique({ where: { id: reservationId } });
      if (!reservation) throw new Error("CREDIT_RESERVATION_NOT_FOUND");
      if (reservation.status === "refunded") return mapReservation(reservation);
      const wallet = await tx.wallet.findUnique({ where: { id: reservation.walletId } });
      if (!wallet) throw new Error("WALLET_NOT_FOUND");
      const oldMetadata = metadataRecord(reservation.metadata);
      const quoteId = typeof oldMetadata.quoteId === "string" ? oldMetadata.quoteId : null;

      let paidAfter = wallet.paidBalance;
      let bonusAfter = wallet.bonusBalance;
      let reservedAfter = wallet.reserved;
      let restored = 0;
      if (reservation.status === "reserved") {
        reservedAfter = Math.max(0, wallet.reserved - reservation.credits);
      } else if (reservation.status === "charged") {
        const paidRestore = Math.max(0, Number(oldMetadata.chargedPaid || reservation.chargedCredits));
        const bonusRestore = Math.max(0, Number(oldMetadata.chargedBonus || 0));
        paidAfter += paidRestore;
        bonusAfter += bonusRestore;
        restored = paidRestore + bonusRestore;
      }

      await tx.wallet.update({ where: { id: wallet.id }, data: { paidBalance: paidAfter, bonusBalance: bonusAfter, reserved: reservedAfter } });
      const updated = await tx.creditReservation.update({ where: { id: reservation.id }, data: { status: "refunded" } });
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id, type: "REFUND", credits: restored, balanceAfter: paidAfter + bonusAfter,
          referenceType: "credit-reservation", referenceId: reservation.id, idempotencyKey: `${reservation.idempotencyKey}:refund`,
          metadata: jsonObject({ reason, restoredCredits: restored, quoteId }),
        },
      });
      await tx.costUsageEvent.create({
        data: {
          id: randomUUID(), userId: reservation.userId, quoteId, category: reservation.category, label: "Refund / release reservation",
          phase: "REFUND", credits: reservation.status === "reserved" ? reservation.credits : restored,
          referenceType: "credit-reservation", referenceId: reservation.id, metadata: jsonObject({ reason }),
        },
      });
      return mapReservation(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}

export const CREDIT_FLOW = ["SERVER_PRICE", "RESERVE", "QUEUE", "GENERATE", "SETTLE_OR_REFUND"] as const;
