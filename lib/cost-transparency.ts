import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import type { Project } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { planGeneration } from "@/lib/orchestrator";
import { getVideoProviderMap } from "@/lib/providers/provider-registry";

export type CostCategory =
  | "AGENT_PLANNING"
  | "AI_SUGGEST"
  | "PROMPT_GENERATION"
  | "PROMPT_REWRITE"
  | "PROMPT_EXPORT"
  | "CONTINUITY_CHECK"
  | "IMAGE_PREVIEW"
  | "VIDEO_GENERATION"
  | "VIDEO_RETRY"
  | "AUDIO_GENERATION"
  | "STORAGE";

export type CostQuoteItem = {
  category: CostCategory;
  label: string;
  estimatedCredits: number;
  included?: boolean;
  note?: string;
};

export type CreditQuotePreview = {
  quoteId: string;
  estimatedCredits: number;
  maxCredits: number;
  items: CostQuoteItem[];
  expiresAt: string;
};

function envNumber(name: string, fallback: number, min = 0) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= min ? value : fallback;
}

export function creditsFromThb(amountThb: number) {
  return Math.max(0, Math.ceil(amountThb * envNumber("SCENOVA_CREDITS_PER_THB", 1, 0.01)));
}

export function buildQuote(items: CostQuoteItem[]) {
  const estimatedCredits = items.reduce((sum, item) => sum + Math.max(0, Math.ceil(item.estimatedCredits)), 0);
  const bufferPct = envNumber("SCENOVA_CREDIT_QUOTE_BUFFER_PCT", 10, 0);
  const maxCredits = Math.max(estimatedCredits, Math.ceil(estimatedCredits * (1 + bufferPct / 100)));
  return { estimatedCredits, maxCredits };
}

export async function createCostQuote(input: {
  userId: string;
  referenceType: string;
  referenceId: string;
  items: CostQuoteItem[];
  ttlMinutes?: number;
}): Promise<CreditQuotePreview> {
  const totals = buildQuote(input.items);
  const expiresAt = new Date(Date.now() + Math.max(1, input.ttlMinutes || 30) * 60_000);
  const quote = await prisma.costQuote.create({
    data: {
      id: randomUUID(), userId: input.userId, referenceType: input.referenceType, referenceId: input.referenceId,
      estimatedCredits: totals.estimatedCredits, maxCredits: totals.maxCredits,
      itemsJson: input.items as unknown as Prisma.InputJsonValue, expiresAt,
    },
  });
  return { quoteId: quote.id, estimatedCredits: quote.estimatedCredits, maxCredits: quote.maxCredits, items: input.items, expiresAt: expiresAt.toISOString() };
}

export async function estimateGenerationQuote(input: { userId: string; project: Project; episodeIndex?: number }) {
  const episodeIndex = Math.max(0, Math.floor(input.episodeIndex || 0));
  const episode = input.project.episodes[episodeIndex];
  if (!episode) throw new Error("EPISODE_NOT_FOUND");

  const providers = getVideoProviderMap();
  const plan = await planGeneration(input.project, episodeIndex, { providers });
  const videoCredits = creditsFromThb(plan.estimatedTotalThb);
  const agentFee = Math.ceil(envNumber("SCENOVA_AGENT_CREDIT_FEE", 0, 0));
  const continuityFee = Math.ceil(envNumber("SCENOVA_CONTINUITY_CREDIT_FEE", 0, 0));
  const promptFee = Math.ceil(envNumber("SCENOVA_INTERNAL_PROMPT_CREDIT_FEE", 0, 0));

  const items: CostQuoteItem[] = [
    { category: "AGENT_PLANNING", label: "AI Planning / Agent Director", estimatedCredits: agentFee, included: agentFee === 0, note: agentFee === 0 ? "รวมในค่าการสร้าง" : undefined },
    { category: "PROMPT_GENERATION", label: "Production Prompt", estimatedCredits: promptFee, included: promptFee === 0, note: promptFee === 0 ? "ใช้ภายใน SCENOVA ฟรี" : undefined },
    { category: "CONTINUITY_CHECK", label: "Continuity / Canon Check", estimatedCredits: continuityFee, included: continuityFee === 0, note: continuityFee === 0 ? "รวมในค่าการสร้าง" : undefined },
    { category: "VIDEO_GENERATION", label: `${input.project.mainModelId} Video Generation`, estimatedCredits: videoCredits, note: `${episode.duration}s · ${input.project.resolution}` },
  ];

  const quote = await createCostQuote({ userId: input.userId, referenceType: "episode-generation", referenceId: `${input.project.id}:${episode.id}`, items });
  return { ...quote, estimatedCostThb: plan.estimatedTotalThb, projectId: input.project.id, episodeId: episode.id, renderJobs: plan.jobs.length };
}

export async function recordCostUsage(input: {
  userId: string;
  quoteId?: string | null;
  category: CostCategory;
  label: string;
  phase: "ESTIMATE" | "RESERVE" | "CHARGE" | "RELEASE" | "REFUND" | "USAGE";
  credits?: number;
  costThb?: number;
  providerId?: string | null;
  modelId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  projectId?: string | null;
  episodeId?: string | null;
  sceneId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.costUsageEvent.create({
    data: {
      id: randomUUID(), userId: input.userId, quoteId: input.quoteId || null, category: input.category, label: input.label,
      phase: input.phase, credits: Math.max(0, Math.ceil(input.credits || 0)), costThb: input.costThb ?? null,
      providerId: input.providerId || null, modelId: input.modelId || null,
      referenceType: input.referenceType || null, referenceId: input.referenceId || null,
      projectId: input.projectId || null, episodeId: input.episodeId || null, sceneId: input.sceneId || null,
      metadata: (input.metadata || {}) as Prisma.InputJsonObject,
    },
  });
}

export async function settleCostQuote(quoteId: string, userId: string) {
  const quote = await prisma.costQuote.findFirst({ where: { id: quoteId, userId } });
  if (!quote) throw new Error("COST_QUOTE_NOT_FOUND");
  const charged = await prisma.costUsageEvent.aggregate({ where: { quoteId, userId, phase: "CHARGE" }, _sum: { credits: true } });
  const actualCredits = charged._sum.credits || 0;
  return prisma.costQuote.update({ where: { id: quoteId }, data: { status: "SETTLED", actualCredits } });
}

export async function getCostReceipt(quoteId: string, userId: string) {
  const quote = await prisma.costQuote.findFirst({ where: { id: quoteId, userId } });
  if (!quote) return null;
  const events = await prisma.costUsageEvent.findMany({ where: { quoteId, userId }, orderBy: { createdAt: "asc" } });
  const charged = events.filter((event) => event.phase === "CHARGE").reduce((sum, event) => sum + event.credits, 0);
  const refunded = events.filter((event) => event.phase === "REFUND").reduce((sum, event) => sum + event.credits, 0);
  return {
    quote,
    events,
    summary: {
      estimatedCredits: quote.estimatedCredits,
      maximumApprovedCredits: quote.maxCredits,
      chargedCredits: charged,
      refundedCredits: refunded,
      netCredits: Math.max(0, charged - refunded),
      unusedReservedCredits: Math.max(0, quote.maxCredits - charged),
    },
  };
}

export async function getCreditActivity(userId: string, limit = 100) {
  const take = Math.max(1, Math.min(250, Math.floor(limit)));
  const [events, wallet] = await Promise.all([
    prisma.costUsageEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take }),
    prisma.wallet.findUnique({ where: { userId } }),
  ]);
  const paid = wallet?.paidBalance || 0;
  const bonus = wallet?.bonusBalance || 0;
  const reserved = wallet?.reserved || 0;
  return { balance: { paid, bonus, reserved, available: Math.max(0, paid + bonus - reserved) }, events };
}
