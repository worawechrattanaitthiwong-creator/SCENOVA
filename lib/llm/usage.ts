import { randomUUID } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { calculateLlmCostThb } from "@/lib/llm/pricing";

function num(value: unknown) {
  if (typeof value === "number") return value;
  return Number(value && typeof value === "object" && "toString" in value ? String(value) : value || 0);
}

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function getLlmSpendWindows(userId?: string) {
  const rows = userId
    ? await prisma.$queryRaw<Array<{ today: unknown; month: unknown }>>`
        SELECT
          COALESCE(SUM(CASE WHEN "createdAt" >= date_trunc('day', NOW()) THEN "costThb" ELSE 0 END),0) AS today,
          COALESCE(SUM(CASE WHEN "createdAt" >= date_trunc('month', NOW()) THEN "costThb" ELSE 0 END),0) AS month
        FROM "LlmUsageEvent" WHERE "userId"=${userId}`
    : await prisma.$queryRaw<Array<{ today: unknown; month: unknown }>>`
        SELECT
          COALESCE(SUM(CASE WHEN "createdAt" >= date_trunc('day', NOW()) THEN "costThb" ELSE 0 END),0) AS today,
          COALESCE(SUM(CASE WHEN "createdAt" >= date_trunc('month', NOW()) THEN "costThb" ELSE 0 END),0) AS month
        FROM "LlmUsageEvent"`;
  return { todayThb: num(rows[0]?.today), monthThb: num(rows[0]?.month) };
}

export async function assertLlmBudget(input: { userId: string; estimatedCostThb: number }) {
  const [global, user] = await Promise.all([getLlmSpendWindows(), getLlmSpendWindows(input.userId)]);
  const globalDaily = envNumber("LLM_DAILY_BUDGET_THB", 1000);
  const globalMonthly = envNumber("LLM_MONTHLY_BUDGET_THB", 20000);
  const userDaily = envNumber("LLM_USER_DAILY_BUDGET_THB", 100);
  const userMonthly = envNumber("LLM_USER_MONTHLY_BUDGET_THB", 2000);
  const requested = Math.max(0, input.estimatedCostThb);

  if (global.todayThb + requested > globalDaily) throw new Error("LLM_GLOBAL_DAILY_BUDGET_EXCEEDED");
  if (global.monthThb + requested > globalMonthly) throw new Error("LLM_GLOBAL_MONTHLY_BUDGET_EXCEEDED");
  if (user.todayThb + requested > userDaily) throw new Error("LLM_USER_DAILY_BUDGET_EXCEEDED");
  if (user.monthThb + requested > userMonthly) throw new Error("LLM_USER_MONTHLY_BUDGET_EXCEEDED");
}

export async function countLlmCalls(input: { runId?: string | null; userId?: string; referenceType?: string; referenceId?: string }) {
  return prisma.llmUsageEvent.count({
    where: {
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.referenceType ? { referenceType: input.referenceType } : {}),
      ...(input.referenceId ? { referenceId: input.referenceId } : {}),
    },
  });
}

export async function recordLlmUsage(input: {
  userId: string;
  runId?: string | null;
  provider: string;
  modelId: string;
  category: string;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
  referenceType?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const costThb = calculateLlmCostThb({
    modelId: input.modelId,
    inputTokens: Math.max(0, Math.floor(input.inputTokens)),
    cachedInputTokens: Math.max(0, Math.floor(input.cachedInputTokens || 0)),
    outputTokens: Math.max(0, Math.floor(input.outputTokens)),
  });
  return prisma.llmUsageEvent.create({
    data: {
      id: randomUUID(), userId: input.userId, runId: input.runId || null, provider: input.provider, modelId: input.modelId,
      category: input.category, inputTokens: Math.max(0, Math.floor(input.inputTokens)), cachedInputTokens: Math.max(0, Math.floor(input.cachedInputTokens || 0)),
      outputTokens: Math.max(0, Math.floor(input.outputTokens)), costThb,
      referenceType: input.referenceType || null, referenceId: input.referenceId || null,
      metadata: (input.metadata || {}) as Prisma.InputJsonObject,
    },
  });
}

export async function getLlmCostSummary(days = 30) {
  const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
  const totals = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT
      COUNT(*)::int AS calls,
      COALESCE(SUM("inputTokens"),0)::bigint AS "inputTokens",
      COALESCE(SUM("outputTokens"),0)::bigint AS "outputTokens",
      COALESCE(SUM("costThb"),0) AS "costThb",
      COALESCE(AVG("costThb"),0) AS "avgCostThb"
    FROM "LlmUsageEvent"
    WHERE "createdAt" >= NOW() - INTERVAL '${safeDays} days'`);
  const byModel = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT "modelId", COUNT(*)::int AS calls, COALESCE(SUM("costThb"),0) AS "costThb"
    FROM "LlmUsageEvent" WHERE "createdAt" >= NOW() - INTERVAL '${safeDays} days'
    GROUP BY "modelId" ORDER BY "costThb" DESC`);
  const byCategory = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT "category", COUNT(*)::int AS calls, COALESCE(SUM("costThb"),0) AS "costThb"
    FROM "LlmUsageEvent" WHERE "createdAt" >= NOW() - INTERVAL '${safeDays} days'
    GROUP BY "category" ORDER BY "costThb" DESC`);
  const topUsers = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT u."id" AS "userId", u."email", COALESCE(u."displayName",u."email") AS name, COUNT(l.*)::int AS calls, COALESCE(SUM(l."costThb"),0) AS "costThb"
    FROM "LlmUsageEvent" l JOIN "User" u ON u."id"=l."userId"
    WHERE l."createdAt" >= NOW() - INTERVAL '${safeDays} days'
    GROUP BY u."id",u."email",u."displayName" ORDER BY "costThb" DESC LIMIT 20`);
  const callsPerClip = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT COALESCE(AVG(calls),0) AS average FROM (
      SELECT "referenceId", COUNT(*)::numeric AS calls FROM "LlmUsageEvent"
      WHERE "createdAt" >= NOW() - INTERVAL '${safeDays} days' AND "referenceType"='episode'
      GROUP BY "referenceId"
    ) s`);

  const clean = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? Number(value) : num(value) || value]));
  return {
    days: safeDays,
    totals: clean(totals[0] || {}),
    byModel: byModel.map(clean),
    byCategory: byCategory.map(clean),
    topUsers: topUsers.map(clean),
    averageCallsPerClip: num(callsPerClip[0]?.average),
    budgets: {
      dailyThb: envNumber("LLM_DAILY_BUDGET_THB", 1000),
      monthlyThb: envNumber("LLM_MONTHLY_BUDGET_THB", 20000),
      perUserDailyThb: envNumber("LLM_USER_DAILY_BUDGET_THB", 100),
      perUserMonthlyThb: envNumber("LLM_USER_MONTHLY_BUDGET_THB", 2000),
    },
  };
}
