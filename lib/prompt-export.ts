import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { PrismaWalletService } from "@/lib/wallet";

export type PromptExportScope = "production" | "pro-multimodel";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonical(row[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function promptFingerprint(prompt: unknown) {
  return createHash("sha256").update(canonical(prompt)).digest("hex");
}

export function promptExportPrice(scope: PromptExportScope) {
  const envName = scope === "pro-multimodel" ? "PROMPT_EXPORT_PRO_CREDITS" : "PROMPT_EXPORT_CREDITS";
  const fallback = scope === "pro-multimodel" ? 5 : 3;
  const value = Number(process.env[envName]);
  return Math.max(0, Math.ceil(Number.isFinite(value) ? value : fallback));
}

export async function getPromptExportStatus(input: { userId: string; prompt: unknown; version?: number; scope?: PromptExportScope }) {
  const fingerprint = promptFingerprint(input.prompt);
  const version = Math.max(1, Math.floor(input.version || 1));
  const scope = input.scope || "production";
  const unlock = await prisma.promptExportUnlock.findUnique({
    where: { userId_promptFingerprint_version_scope: { userId: input.userId, promptFingerprint: fingerprint, version, scope } },
  });
  return { fingerprint, version, scope, unlocked: Boolean(unlock), priceCredits: unlock ? 0 : promptExportPrice(scope), unlock };
}

export async function unlockPromptExport(input: { userId: string; prompt: unknown; version?: number; scope?: PromptExportScope }) {
  const status = await getPromptExportStatus(input);
  if (status.unlock) return { unlocked: true, alreadyUnlocked: true, chargedCredits: 0, ...status };
  const price = promptExportPrice(status.scope);
  if (price > 0) {
    const wallet = new PrismaWalletService();
    const reservation = await wallet.reserve({
      userId: input.userId,
      credits: price,
      purpose: "prompt-export",
      category: "PROMPT_EXPORT",
      referenceId: `${status.fingerprint}:v${status.version}:${status.scope}`,
      idempotencyKey: `prompt-export:${input.userId}:${status.fingerprint}:${status.version}:${status.scope}`,
      metadata: { promptFingerprint: status.fingerprint, version: status.version, scope: status.scope },
    });
    await wallet.charge(reservation.reservationId, price);
  }
  const unlock = await prisma.promptExportUnlock.upsert({
    where: { userId_promptFingerprint_version_scope: { userId: input.userId, promptFingerprint: status.fingerprint, version: status.version, scope: status.scope } },
    update: {},
    create: { id: randomUUID(), userId: input.userId, promptFingerprint: status.fingerprint, version: status.version, scope: status.scope, creditsCharged: price },
  });
  return { unlocked: true, alreadyUnlocked: false, chargedCredits: price, ...status, unlock };
}
