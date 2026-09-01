import { prisma } from "@/lib/db";
import { getEmergencySecurityState } from "@/lib/emergency-security";
import { getAgentPolicy } from "@/lib/agent/policy";
import { enqueueAgentStep } from "@/lib/agent/store";

const ACTIVE_RUN_STATUSES = ["QUEUED", "RUNNING"];
const ACTIVE_JOB_STATUSES = ["QUEUED", "RUNNING"];
const STALL_AFTER_MS = 12_000;

type RuntimeState =
  | "idle"
  | "blocked"
  | "starting"
  | "working"
  | "waiting"
  | "stalled"
  | "orphaned"
  | "waiting_approval"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function securityBlockMessage(state: Awaited<ReturnType<typeof getEmergencySecurityState>>) {
  if (state.lockdownEnabled) return `Emergency Lockdown เปิดอยู่${state.reason ? ` · ${state.reason}` : ""}`;
  if (state.agentDisabled) return `AI Agent ถูกปิดโดย Security Control${state.reason ? ` · ${state.reason}` : ""}`;
  if (state.queuePaused) return `Agent Queue ถูกพักโดย Security Control${state.reason ? ` · ${state.reason}` : ""}`;
  return null;
}

export async function ensureAgentRunHasQueueJob(runId: string) {
  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  if (!run || !ACTIVE_RUN_STATUSES.includes(run.status)) return { repaired: false, reason: "RUN_NOT_ACTIVE" };

  const activeJob = await prisma.agentQueueJob.findFirst({
    where: { runId, status: { in: ACTIVE_JOB_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
  if (activeJob) return { repaired: false, reason: "ACTIVE_JOB_EXISTS", jobId: activeJob.id };

  const newestJob = await prisma.agentQueueJob.findFirst({ where: { runId }, orderBy: { createdAt: "desc" } });
  if (newestJob?.status === "FAILED") {
    return { repaired: false, reason: "LATEST_JOB_FAILED", jobId: newestJob.id, error: newestJob.lastError };
  }

  const policy = getAgentPolicy();
  const state = run.stateJson && typeof run.stateJson === "object" && !Array.isArray(run.stateJson)
    ? run.stateJson as Record<string, unknown>
    : {};
  const episodeIndex = typeof state.currentEpisodeIndex === "number"
    ? state.currentEpisodeIndex
    : typeof state.startEpisodeIndex === "number"
      ? state.startEpisodeIndex
      : 0;
  const repairKey = `runtime-repair:${run.id}:${run.stage}:${run.updatedAt.getTime()}`;
  const jobId = await enqueueAgentStep(
    run.id,
    { reason: "runtime-repair", stage: run.stage, episodeIndex },
    0,
    policy.maxRetriesPerStep + 1,
    repairKey,
  );
  if (run.status !== "QUEUED") {
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: "QUEUED", stopReason: null } });
  }
  return { repaired: true, reason: "QUEUE_JOB_RECREATED", jobId };
}

export async function repairOrphanedAgentRuns(limit = 25) {
  const runs = await prisma.agentRun.findMany({
    where: { status: { in: ACTIVE_RUN_STATUSES } },
    orderBy: { updatedAt: "asc" },
    take: Math.max(1, Math.min(100, Math.floor(limit))),
    select: { id: true },
  });
  let repaired = 0;
  for (const run of runs) {
    const result = await ensureAgentRunHasQueueJob(run.id);
    if (result.repaired) repaired += 1;
  }
  return repaired;
}

export async function getAgentRuntimeHealth(userId: string, requestedRunId?: string | null) {
  const security = await getEmergencySecurityState();
  const run = requestedRunId
    ? await prisma.agentRun.findFirst({ where: { id: requestedRunId, userId } })
    : await prisma.agentRun.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });

  const blockedMessage = securityBlockMessage(security);
  if (!run) {
    return {
      runtimeState: blockedMessage ? "blocked" as RuntimeState : "idle" as RuntimeState,
      message: blockedMessage || "ยังไม่มีงาน AI ในคิว",
      security: {
        blocked: Boolean(blockedMessage),
        lockdownEnabled: security.lockdownEnabled,
        agentDisabled: security.agentDisabled,
        queuePaused: security.queuePaused,
        environmentHardLock: security.environmentHardLock,
        reason: security.reason,
      },
      run: null,
      queue: null,
      task: null,
      checkedAt: new Date().toISOString(),
    };
  }

  const [jobs, currentTask] = await Promise.all([
    prisma.agentQueueJob.findMany({ where: { runId: run.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.agentTask.findFirst({
      where: { runId: run.id, stage: run.stage },
      orderBy: [{ status: "asc" }, { sequence: "asc" }],
      select: { id: true, agentKey: true, stage: true, status: true, attempt: true, maxAttempts: true, lastError: true, startedAt: true, updatedAt: true },
    }),
  ]);
  const latestJob = jobs[0] || null;
  const now = Date.now();
  const availableAtMs = latestJob?.availableAt?.getTime() ?? now;
  const queueAgeMs = latestJob ? Math.max(0, now - latestJob.updatedAt.getTime()) : 0;
  const heartbeatAgeMs = latestJob?.heartbeatAt ? Math.max(0, now - latestJob.heartbeatAt.getTime()) : null;
  const leaseExpired = latestJob?.status === "RUNNING" && latestJob.leaseExpiresAt ? latestJob.leaseExpiresAt.getTime() <= now : false;

  let runtimeState: RuntimeState = "idle";
  let message = "พร้อมทำงาน";

  if (blockedMessage) {
    runtimeState = "blocked";
    message = blockedMessage;
  } else if (run.status === "WAITING_APPROVAL") {
    runtimeState = "waiting_approval";
    message = run.stopReason || "รอผู้ใช้อนุมัติก่อนทำงานต่อ";
  } else if (run.status === "PAUSED") {
    runtimeState = "paused";
    message = run.stopReason || "งานถูกพักไว้";
  } else if (run.status === "COMPLETED") {
    runtimeState = "completed";
    message = "งาน AI เสร็จสมบูรณ์แล้ว";
  } else if (run.status === "FAILED") {
    runtimeState = "failed";
    message = run.stopReason || latestJob?.lastError || "งาน AI หยุดเพราะเกิดข้อผิดพลาด";
  } else if (run.status === "CANCELLED") {
    runtimeState = "cancelled";
    message = run.stopReason || "งานถูกยกเลิกแล้ว";
  } else if (!latestJob || !ACTIVE_JOB_STATUSES.includes(latestJob.status)) {
    runtimeState = latestJob?.status === "FAILED" ? "failed" : "orphaned";
    message = latestJob?.status === "FAILED"
      ? latestJob.lastError || "Queue Job ล้มเหลว"
      : "Run ยังทำงานอยู่แต่ไม่พบ Queue Job ที่พร้อมทำงาน ระบบควรซ่อมคิวให้อัตโนมัติ";
  } else if (latestJob.status === "RUNNING" && !leaseExpired) {
    runtimeState = "working";
    message = currentTask?.agentKey
      ? `${currentTask.agentKey} กำลังทำงานในขั้น ${run.stage}`
      : `Worker กำลังประมวลผลขั้น ${run.stage}`;
  } else if (latestJob.status === "RUNNING" && leaseExpired) {
    runtimeState = "stalled";
    message = "Worker heartbeat ขาดหายและ lease หมดอายุ ระบบจะพยายามรับงานกลับเข้าคิวใหม่";
  } else if (latestJob.status === "QUEUED" && availableAtMs > now) {
    runtimeState = "waiting";
    message = `กำลังรอรอบตรวจ Provider/Queue ถัดไปในประมาณ ${Math.max(1, Math.ceil((availableAtMs - now) / 1000))} วินาที`;
  } else if (latestJob.status === "QUEUED" && queueAgeMs >= STALL_AFTER_MS) {
    runtimeState = "stalled";
    message = "งานอยู่ในคิวนานเกินกำหนดแต่ยังไม่มี Worker รับ ระบบจะช่วยปลุก Worker อัตโนมัติ";
  } else {
    runtimeState = "starting";
    message = "งานเข้าคิวแล้ว กำลังรอ Worker รับงาน";
  }

  return {
    runtimeState,
    message,
    security: {
      blocked: Boolean(blockedMessage),
      lockdownEnabled: security.lockdownEnabled,
      agentDisabled: security.agentDisabled,
      queuePaused: security.queuePaused,
      environmentHardLock: security.environmentHardLock,
      reason: security.reason,
    },
    run: {
      id: run.id,
      status: run.status,
      stage: run.stage,
      stopReason: run.stopReason,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    },
    queue: latestJob ? {
      id: latestJob.id,
      status: latestJob.status,
      attempts: latestJob.attempts,
      maxAttempts: latestJob.maxAttempts,
      lockedBy: latestJob.lockedBy,
      lastError: latestJob.lastError,
      availableAt: iso(latestJob.availableAt),
      heartbeatAt: iso(latestJob.heartbeatAt),
      leaseExpiresAt: iso(latestJob.leaseExpiresAt),
      updatedAt: latestJob.updatedAt.toISOString(),
      queueAgeMs,
      heartbeatAgeMs,
    } : null,
    task: currentTask ? {
      id: currentTask.id,
      agentKey: currentTask.agentKey,
      stage: currentTask.stage,
      status: currentTask.status,
      attempt: currentTask.attempt,
      maxAttempts: currentTask.maxAttempts,
      lastError: currentTask.lastError,
      startedAt: iso(currentTask.startedAt),
      updatedAt: currentTask.updatedAt.toISOString(),
    } : null,
    checkedAt: new Date().toISOString(),
  };
}
