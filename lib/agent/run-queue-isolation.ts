import { prisma } from "@/lib/db";

const RUNNABLE_JOB_STATUSES = ["QUEUED", "RUNNING"] as const;

async function failRunnableJobs(runIds: string[], reason: string) {
  if (!runIds.length) return 0;
  const result = await prisma.agentQueueJob.updateMany({
    where: {
      runId: { in: runIds },
      status: { in: [...RUNNABLE_JOB_STATUSES] },
    },
    data: {
      status: "FAILED",
      lastError: reason,
      lockedAt: null,
      lockedBy: null,
      heartbeatAt: null,
      leaseExpiresAt: null,
    },
  });
  return result.count;
}

/**
 * A paused run must not retain a runnable queue job. Keeping those jobs around
 * makes multiple cards appear to resume together when the worker has more than
 * one lane. This cleanup changes queue rows only; it never changes another
 * run's status, stage, artifacts, provider outputs, or billing state.
 */
export async function isolatePausedRunQueue(userId: string, runId: string, reason = "PAUSED_RUN_QUEUE_ISOLATED") {
  const run = await prisma.agentRun.findFirst({
    where: { id: runId, userId, status: "PAUSED" },
    select: { id: true },
  });
  if (!run) return 0;
  return failRunnableJobs([run.id], reason);
}

/**
 * Before one run is resumed/retried, remove runnable queue residue from every
 * other run that is still PAUSED. This guarantees that the button on one card
 * cannot make a paused sibling eligible for worker execution.
 */
export async function isolateOtherPausedRunQueues(userId: string, targetRunId: string) {
  const paused = await prisma.agentRun.findMany({
    where: {
      userId,
      status: "PAUSED",
      id: { not: targetRunId },
    },
    select: { id: true },
  });
  return failRunnableJobs(paused.map((run) => run.id), "PAUSED_SIBLING_QUEUE_ISOLATED");
}
