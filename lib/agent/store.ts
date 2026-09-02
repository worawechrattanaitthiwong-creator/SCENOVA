import { randomUUID } from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { AgentQueueJobRecord, AgentRunRecord, AgentRunStatus, AgentStage } from "@/lib/agent/types";

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toString" in value) return Number(String(value));
  return Number(value || 0);
}

function normalizeRun(row: Record<string, unknown>): AgentRunRecord {
  return {
    id: String(row.id), userId: String(row.userId), mode: String(row.mode), status: row.status as AgentRunStatus, stage: row.stage as AgentStage,
    inputJson: row.inputJson, planJson: row.planJson ?? null, stateJson: (row.stateJson as Record<string, unknown>) || {},
    budgetThb: numberValue(row.budgetThb), estimatedSpendThb: numberValue(row.estimatedSpendThb), actualSpendThb: numberValue(row.actualSpendThb),
    approvalThresholdThb: numberValue(row.approvalThresholdThb), maxEpisodes: Number(row.maxEpisodes || 1), stopReason: row.stopReason ? String(row.stopReason) : null,
    startedAt: row.startedAt ? new Date(String(row.startedAt)) : null, finishedAt: row.finishedAt ? new Date(String(row.finishedAt)) : null,
    createdAt: new Date(String(row.createdAt)), updatedAt: new Date(String(row.updatedAt)),
  };
}

function normalizeJob(row: Record<string, unknown>): AgentQueueJobRecord {
  return {
    id: String(row.id), runId: String(row.runId), kind: String(row.kind), status: row.status as AgentQueueJobRecord["status"],
    payloadJson: (row.payloadJson as Record<string, unknown>) || {}, attempts: Number(row.attempts || 0), maxAttempts: Number(row.maxAttempts || 3),
    availableAt: new Date(String(row.availableAt)), lockedAt: row.lockedAt ? new Date(String(row.lockedAt)) : null,
    lockedBy: row.lockedBy ? String(row.lockedBy) : null, heartbeatAt: row.heartbeatAt ? new Date(String(row.heartbeatAt)) : null,
    leaseExpiresAt: row.leaseExpiresAt ? new Date(String(row.leaseExpiresAt)) : null, idempotencyKey: String(row.idempotencyKey || row.id),
    lastError: row.lastError ? String(row.lastError) : null, createdAt: new Date(String(row.createdAt)), updatedAt: new Date(String(row.updatedAt)),
  };
}

export async function createAgentRun(input: { userId: string; mode: string; inputJson: unknown; budgetThb: number; approvalThresholdThb: number; maxEpisodes: number }) {
  const id = randomUUID();
  const inputJson = JSON.stringify(input.inputJson);
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    INSERT INTO "AgentRun" ("id","userId","mode","status","stage","inputJson","stateJson","budgetThb","approvalThresholdThb","maxEpisodes","createdAt","updatedAt")
    VALUES (${id},${input.userId},${input.mode},'QUEUED','PLAN_STORY',${inputJson}::jsonb,'{}'::jsonb,${input.budgetThb},${input.approvalThresholdThb},${input.maxEpisodes},NOW(),NOW())
    RETURNING *`;
  return normalizeRun(rows[0]);
}

export async function getAgentRun(runId: string) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "AgentRun" WHERE "id"=${runId} LIMIT 1`;
  return rows[0] ? normalizeRun(rows[0]) : null;
}

export async function getAgentRunForUser(runId: string, userId: string) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "AgentRun" WHERE "id"=${runId} AND "userId"=${userId} LIMIT 1`;
  return rows[0] ? normalizeRun(rows[0]) : null;
}

export async function listAgentRunsForUser(userId: string, limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "AgentRun" WHERE "userId"=${userId} ORDER BY "createdAt" DESC LIMIT ${safeLimit}`;
  return rows.map(normalizeRun);
}

export async function countActiveAgentRunsForUser(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "AgentRun" WHERE "userId"=${userId} AND "status" IN ('QUEUED','RUNNING','WAITING_APPROVAL','PAUSED')`;
  return Number(rows[0]?.count || 0);
}

export async function saveAgentRun(run: AgentRunRecord) {
  const planJson = run.planJson === null ? null : JSON.stringify(run.planJson);
  const stateJson = JSON.stringify(run.stateJson || {});
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    UPDATE "AgentRun" SET
      "status"=${run.status}, "stage"=${run.stage}, "planJson"=${planJson}::jsonb, "stateJson"=${stateJson}::jsonb,
      "estimatedSpendThb"=${run.estimatedSpendThb}, "actualSpendThb"=${run.actualSpendThb}, "stopReason"=${run.stopReason},
      "startedAt"=${run.startedAt}, "finishedAt"=${run.finishedAt}, "updatedAt"=NOW()
    WHERE "id"=${run.id} RETURNING *`;
  return normalizeRun(rows[0]);
}

export async function recordAgentDecision(input: { runId: string; stage: string; action: string; reason: string; providerId?: string | null; metadata?: unknown }) {
  const id = randomUUID();
  const metadata = input.metadata === undefined ? null : JSON.stringify(input.metadata);
  await prisma.$executeRaw`INSERT INTO "AgentDecisionLog" ("id","runId","stage","action","reason","providerId","metadata","createdAt") VALUES (${id},${input.runId},${input.stage},${input.action},${input.reason},${input.providerId || null},${metadata}::jsonb,NOW())`;
  return id;
}

export async function requestAgentApproval(input: { runId: string; estimatedCostThb: number; summary: string }) {
  const pending = await prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "AgentApproval" WHERE "runId"=${input.runId} AND "status"='PENDING' ORDER BY "requestedAt" DESC LIMIT 1`;
  if (pending[0] && numberValue(pending[0].estimatedCostThb) >= input.estimatedCostThb) return String(pending[0].id);
  const id = randomUUID();
  await prisma.$executeRaw`INSERT INTO "AgentApproval" ("id","runId","kind","status","estimatedCostThb","summary","requestedAt") VALUES (${id},${input.runId},'BUDGET_PLAN','PENDING',${input.estimatedCostThb},${input.summary},NOW())`;
  return id;
}

export async function approveAgentRun(runId: string, userId: string) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    UPDATE "AgentApproval" SET "status"='APPROVED',"decidedAt"=NOW(),"decidedByUserId"=${userId}
    WHERE "id"=(SELECT "id" FROM "AgentApproval" WHERE "runId"=${runId} AND "status"='PENDING' ORDER BY "requestedAt" DESC LIMIT 1)
    RETURNING *`;
  return rows[0] || null;
}

export async function rejectAgentApproval(runId: string, userId: string) {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    UPDATE "AgentApproval" SET "status"='REJECTED',"decidedAt"=NOW(),"decidedByUserId"=${userId}
    WHERE "id"=(SELECT "id" FROM "AgentApproval" WHERE "runId"=${runId} AND "status"='PENDING' ORDER BY "requestedAt" DESC LIMIT 1)
    RETURNING *`;
  return rows[0] || null;
}

export async function getApprovedAgentBudget(runId: string) {
  const rows = await prisma.$queryRaw<Array<{ amount: unknown }>>`SELECT COALESCE(MAX("estimatedCostThb"),0) AS amount FROM "AgentApproval" WHERE "runId"=${runId} AND "status"='APPROVED'`;
  return numberValue(rows[0]?.amount);
}

export async function enqueueAgentStep(
  runId: string,
  payload: Record<string, unknown> = {},
  delayMs = 0,
  maxAttempts = 3,
  idempotencyKey?: string,
) {
  const id = randomUUID();
  const key = idempotencyKey || `agent-step:${runId}:${id}`;
  const payloadJson = JSON.stringify(payload);
  const availableAt = new Date(Date.now() + Math.max(0, delayMs));
  const inserted = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "AgentQueueJob" ("id","runId","kind","status","payloadJson","attempts","maxAttempts","availableAt","idempotencyKey","createdAt","updatedAt")
    VALUES (${id},${runId},'AGENT_STEP','QUEUED',${payloadJson}::jsonb,0,${maxAttempts},${availableAt},${key},NOW(),NOW())
    ON CONFLICT ("idempotencyKey") DO NOTHING RETURNING "id"`;
  if (inserted[0]) return inserted[0].id;
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "AgentQueueJob" WHERE "idempotencyKey"=${key} LIMIT 1`;
  return existing[0]?.id || id;
}

export async function claimNextAgentJob(workerId: string, leaseSeconds = 120) {
  const leaseExpiresAt = new Date(Date.now() + Math.max(15, leaseSeconds) * 1000);
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const picked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "AgentQueueJob"
      WHERE "attempts" < "maxAttempts" AND (
        ("status"='QUEUED' AND "availableAt"<=NOW()) OR
        ("status"='RUNNING' AND "leaseExpiresAt" IS NOT NULL AND "leaseExpiresAt"<NOW())
      )
      ORDER BY CASE WHEN "status"='RUNNING' THEN 0 ELSE 1 END, "createdAt" ASC
      FOR UPDATE SKIP LOCKED LIMIT 1`;
    if (!picked[0]) return null;
    await tx.$executeRaw`
      UPDATE "AgentQueueJob" SET "status"='RUNNING',"lockedAt"=NOW(),"lockedBy"=${workerId},"heartbeatAt"=NOW(),
        "leaseExpiresAt"=${leaseExpiresAt},"attempts"="attempts"+1,"updatedAt"=NOW()
      WHERE "id"=${picked[0].id}`;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "AgentQueueJob" WHERE "id"=${picked[0].id}`;
    return normalizeJob(rows[0]);
  });
}

export async function heartbeatAgentJob(jobId: string, workerId: string, leaseSeconds = 120) {
  const leaseExpiresAt = new Date(Date.now() + Math.max(15, leaseSeconds) * 1000);
  const changed = await prisma.$executeRaw`
    UPDATE "AgentQueueJob" SET "heartbeatAt"=NOW(),"leaseExpiresAt"=${leaseExpiresAt},"updatedAt"=NOW()
    WHERE "id"=${jobId} AND "status"='RUNNING' AND "lockedBy"=${workerId}`;
  return changed > 0;
}

export async function failExpiredAgentJobs() {
  return prisma.$executeRaw`
    UPDATE "AgentQueueJob" SET "status"='FAILED',"lastError"='WORKER_LEASE_EXPIRED_MAX_ATTEMPTS',"lockedAt"=NULL,"lockedBy"=NULL,"heartbeatAt"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=NOW()
    WHERE "status"='RUNNING' AND "leaseExpiresAt"<NOW() AND "attempts">="maxAttempts"`;
}

export async function completeAgentJob(jobId: string) {
  await prisma.$executeRaw`UPDATE "AgentQueueJob" SET "status"='COMPLETED',"lockedAt"=NULL,"lockedBy"=NULL,"heartbeatAt"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=NOW() WHERE "id"=${jobId}`;
}

export async function failOrRequeueAgentJob(job: AgentQueueJobRecord, error: string, delayMs?: number) {
  if (job.attempts < job.maxAttempts) {
    const availableAt = new Date(Date.now() + Math.max(0, delayMs || 0));
    await prisma.$executeRaw`UPDATE "AgentQueueJob" SET "status"='QUEUED',"availableAt"=${availableAt},"lockedAt"=NULL,"lockedBy"=NULL,"heartbeatAt"=NULL,"leaseExpiresAt"=NULL,"lastError"=${error},"updatedAt"=NOW() WHERE "id"=${job.id}`;
  } else {
    await prisma.$executeRaw`UPDATE "AgentQueueJob" SET "status"='FAILED',"lockedAt"=NULL,"lockedBy"=NULL,"heartbeatAt"=NULL,"leaseExpiresAt"=NULL,"lastError"=${error},"updatedAt"=NOW() WHERE "id"=${job.id}`;
  }
}

export async function pauseAgentRun(run: AgentRunRecord, reason: string) {
  const state = { ...(run.stateJson || {}), resumeStage: run.stage };
  run.status = "PAUSED";
  run.stopReason = reason;
  run.stateJson = state;
  return saveAgentRun(run);
}

export async function resumeAgentRun(run: AgentRunRecord) {
  if (run.status !== "PAUSED") throw new Error("AGENT_RUN_NOT_PAUSED");
  const state = { ...(run.stateJson || {}) };
  const resumeStage = typeof state.resumeStage === "string" ? state.resumeStage as AgentStage : run.stage;
  delete state.resumeStage;
  run.stage = resumeStage;
  run.status = "QUEUED";
  run.stopReason = null;
  run.stateJson = state;
  return saveAgentRun(run);
}

export async function cancelAgentRun(run: AgentRunRecord, reason: string) {
  run.status = "CANCELLED";
  run.stopReason = reason;
  run.finishedAt = new Date();
  await prisma.$executeRaw`UPDATE "AgentQueueJob" SET "status"='FAILED',"lastError"='RUN_CANCELLED',"lockedAt"=NULL,"lockedBy"=NULL,"heartbeatAt"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=NOW() WHERE "runId"=${run.id} AND "status" IN ('QUEUED','RUNNING')`;
  return saveAgentRun(run);
}

export async function getUserAgentSpendWindows(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ hourly: unknown; daily: unknown }>>`
    SELECT
      COALESCE(SUM(CASE WHEN "updatedAt">NOW()-INTERVAL '1 hour' THEN "actualSpendThb" ELSE 0 END),0) AS hourly,
      COALESCE(SUM(CASE WHEN "updatedAt">NOW()-INTERVAL '24 hours' THEN "actualSpendThb" ELSE 0 END),0) AS daily
    FROM "AgentRun" WHERE "userId"=${userId}`;
  return { hourlySpendThb: numberValue(rows[0]?.hourly), dailySpendThb: numberValue(rows[0]?.daily) };
}

export async function getAgentRunDetails(runId: string, userId: string) {
  const run = await getAgentRunForUser(runId, userId);
  if (!run) return null;
  const [decisions, approvals, jobs, llmUsage, videoGenerations] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "AgentDecisionLog" WHERE "runId"=${runId} ORDER BY "createdAt" ASC`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "AgentApproval" WHERE "runId"=${runId} ORDER BY "requestedAt" DESC`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "AgentQueueJob" WHERE "runId"=${runId} ORDER BY "createdAt" DESC LIMIT 100`,
    prisma.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM "LlmUsageEvent" WHERE "runId"=${runId} ORDER BY "createdAt" ASC`,
    prisma.videoGeneration.findMany({ where: { runId }, orderBy: [{ episodeRef: "asc" }, { shotOrder: "asc" }] }),
  ]);
  return {
    run, decisions, approvals, jobs, llmUsage,
    videoGenerations: videoGenerations.map((generation) => ({ ...generation, estimatedProviderCost: Number(generation.estimatedProviderCost || 0) })),
  };
}
