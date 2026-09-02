import type { AgentRunRecord, AgentStage } from "@/lib/agent/types";
import { getVideoProviderById } from "@/lib/providers/provider-registry";
import { PrismaWalletService } from "@/lib/wallet";
import { prisma } from "@/lib/db";
import {
  cancelAgentRun,
  enqueueAgentStep,
  pauseAgentRun,
  recordAgentDecision,
  rejectAgentApproval,
  resumeAgentRun,
  saveAgentRun,
} from "@/lib/agent/store";
import { getAgentPolicy } from "@/lib/agent/policy";
import { cancelWorkflow } from "@/lib/agent/workflow-store";
import { episodeScopeKey } from "@/lib/agent/contracts";

type PersistedOutput = {
  order?: number;
  providerId?: string;
  providerTaskId?: string;
  reservationId?: string;
  billingMode?: string;
  settled?: boolean;
  status?: string;
};

type ControlState = {
  currentEpisodeIndex?: number;
  startEpisodeIndex?: number;
  outputsByEpisode?: Record<string, PersistedOutput[]>;
  resumeStage?: AgentStage;
  providerSwitches?: number;
  queueSequence?: number;
};

export async function pauseRunByUser(run: AgentRunRecord) {
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(run.status)) throw new Error("AGENT_RUN_NOT_ACTIVE");
  if (run.status === "PAUSED") return run;
  const updated = await pauseAgentRun(run, "ผู้ใช้ Pause Agent Run");
  await recordAgentDecision({ runId: run.id, stage: run.stage, action: "USER_PAUSED", reason: "ผู้ใช้สั่ง Pause งานจาก Agent Control Center" });
  return updated;
}

export async function resumeRunByUser(run: AgentRunRecord) {
  const updated = await resumeAgentRun(run);
  const state = (updated.stateJson || {}) as ControlState;
  const episodeIndex = typeof state.currentEpisodeIndex === "number" ? state.currentEpisodeIndex : Number(state.startEpisodeIndex || 0);
  const policy = getAgentPolicy();
  await recordAgentDecision({ runId: run.id, stage: updated.stage, action: "USER_RESUMED", reason: "ผู้ใช้สั่ง Resume งาน จึงนำ Stage ล่าสุดกลับเข้า Queue" });
  await enqueueAgentStep(updated.id, { reason: "user-resume", stage: updated.stage, episodeIndex }, 0, policy.maxRetriesPerStep + 1, `${updated.id}:${episodeIndex}:${updated.stage}:user-resume:${Date.now()}`);
  return updated;
}

export async function retryFailedRunByUser(run: AgentRunRecord) {
  if (!["FAILED", "PAUSED"].includes(run.status)) throw new Error("AGENT_RUN_NOT_RETRYABLE");

  const state = { ...((run.stateJson || {}) as ControlState) };
  const episodeIndex = typeof state.currentEpisodeIndex === "number" ? state.currentEpisodeIndex : Number(state.startEpisodeIndex || 0);
  const scopeKey = episodeScopeKey(episodeIndex);

  const failedTask = await prisma.agentTask.findFirst({
    where: {
      runId: run.id,
      scopeKey,
      status: { in: ["FAILED", "READY", "RETURNED"] },
      lastError: { not: null },
    },
    orderBy: { updatedAt: "desc" },
  });

  // A PAUSED run can be manually resumed when it is healthy. Force retry is only
  // valid for PAUSED runs that actually contain a failed/error task, such as a
  // provider 429 that deliberately paused automatic retries.
  const nextTask = failedTask || (run.status === "FAILED" ? await prisma.agentTask.findFirst({
    where: {
      runId: run.id,
      scopeKey,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    orderBy: { sequence: "asc" },
  }) : null);

  if (!nextTask) throw new Error(run.status === "PAUSED" ? "AGENT_PAUSED_RUN_HAS_NO_FAILED_TASK" : "AGENT_RETRY_STAGE_NOT_FOUND");
  const retryStage = nextTask.stage as AgentStage;
  if (["COMPLETED", "FAILED"].includes(retryStage)) throw new Error("AGENT_RETRY_STAGE_INVALID");

  await prisma.$transaction([
    prisma.agentTask.update({
      where: { id: nextTask.id },
      data: {
        status: "READY",
        attempt: 0,
        lastError: null,
        startedAt: null,
        completedAt: null,
      },
    }),
    prisma.agentWorkflow.updateMany({ where: { runId: run.id }, data: { status: "ACTIVE" } }),
    prisma.agentQueueJob.updateMany({
      where: { runId: run.id, status: { in: ["QUEUED", "RUNNING"] } },
      data: {
        status: "FAILED",
        lastError: "SUPERSEDED_BY_USER_RETRY",
        lockedAt: null,
        lockedBy: null,
        heartbeatAt: null,
        leaseExpiresAt: null,
      },
    }),
  ]);

  state.providerSwitches = 0;
  state.queueSequence = Number(state.queueSequence || 0) + 1;
  delete state.resumeStage;
  run.stage = retryStage;
  run.status = "QUEUED";
  run.stopReason = null;
  run.finishedAt = null;
  run.stateJson = state;
  const updated = await saveAgentRun(run);

  const policy = getAgentPolicy();
  await enqueueAgentStep(
    updated.id,
    { reason: "user-force-retry", stage: retryStage, episodeIndex, sequence: state.queueSequence },
    0,
    policy.maxRetriesPerStep + 1,
    `${updated.id}:${episodeIndex}:${retryStage}:user-force-retry:${Date.now()}`,
  );
  await recordAgentDecision({
    runId: updated.id,
    stage: retryStage,
    action: "USER_FORCE_RETRY",
    reason: `ผู้ใช้สั่งบังคับเริ่มใหม่จากขั้น ${retryStage} โดยเก็บ Artifact ที่ทำสำเร็จแล้วไว้`,
    metadata: { episodeIndex, taskId: nextTask.id, previousError: nextTask.lastError },
  });
  return updated;
}

export async function restoreCancelledRunByUser(run: AgentRunRecord) {
  if (run.status !== "CANCELLED") throw new Error("AGENT_RUN_NOT_CANCELLED");

  const state = { ...((run.stateJson || {}) as ControlState) };
  const episodeIndex = typeof state.currentEpisodeIndex === "number" ? state.currentEpisodeIndex : Number(state.startEpisodeIndex || 0);
  const scopeKey = episodeScopeKey(episodeIndex);

  // If cancellation happened while waiting for an approval, restore the same
  // checkpoint instead of jumping ahead and spending without approval.
  if (run.stage === "AWAIT_APPROVAL") {
    const pendingApproval = await prisma.agentApproval.findFirst({
      where: { runId: run.id, status: "PENDING" },
      orderBy: { requestedAt: "desc" },
    });
    if (pendingApproval) {
      await prisma.agentWorkflow.updateMany({ where: { runId: run.id }, data: { status: "ACTIVE" } });
      delete state.resumeStage;
      run.status = "WAITING_APPROVAL";
      run.stopReason = "คืนงานกลับมาที่จุดรออนุมัติเดิม";
      run.finishedAt = null;
      run.stateJson = state;
      const updated = await saveAgentRun(run);
      await recordAgentDecision({
        runId: updated.id,
        stage: updated.stage,
        action: "USER_RESTORED_CANCELLED",
        reason: "ผู้ใช้เรียกคืนงานที่ยกเลิกกลับมาที่ Human Approval เดิม โดยไม่สร้างงานใหม่",
        metadata: { episodeIndex, pendingApprovalId: pendingApproval.id },
      });
      return updated;
    }
  }

  const primaryTasks = await prisma.agentTask.findMany({
    where: { runId: run.id, scopeKey, stage: { not: "GENERATE_SHOT" } },
    orderBy: { sequence: "asc" },
  });
  const resumeTask = primaryTasks.find((task) => task.stage === run.stage && task.status !== "COMPLETED")
    || primaryTasks.find((task) => task.status !== "COMPLETED");
  if (!resumeTask) throw new Error("AGENT_CANCELLED_RESUME_STAGE_NOT_FOUND");

  const resumeStage = resumeTask.stage as AgentStage;
  if (["COMPLETED", "FAILED"].includes(resumeStage)) throw new Error("AGENT_CANCELLED_RESUME_STAGE_INVALID");

  // Provider work that was queued/generating was cancelled/refunded when the
  // user cancelled the run. Keep only reusable completed outputs so the worker
  // never polls a cancelled providerTaskId. Missing shots receive a new attempt.
  const previousOutputs = state.outputsByEpisode?.[String(episodeIndex)] || [];
  const reusableOutputs = previousOutputs.filter((output) =>
    output.status === "completed"
    && (output.settled || output.billingMode === "BYOK" || output.billingMode === "MOCK" || output.providerId === "mock-seedance"),
  );
  state.outputsByEpisode = { ...(state.outputsByEpisode || {}), [String(episodeIndex)]: reusableOutputs };
  state.providerSwitches = 0;
  state.queueSequence = Number(state.queueSequence || 0) + 1;
  delete state.resumeStage;

  await prisma.$transaction([
    prisma.agentWorkflow.updateMany({ where: { runId: run.id }, data: { status: "ACTIVE" } }),
    // Completed tasks and their immutable Artifacts stay untouched. Everything
    // unfinished returns to PENDING, then the exact resume task becomes READY.
    prisma.agentTask.updateMany({
      where: { runId: run.id, scopeKey, status: { not: "COMPLETED" } },
      data: { status: "PENDING", attempt: 0, lastError: null, startedAt: null, completedAt: null },
    }),
    prisma.agentTask.update({
      where: { id: resumeTask.id },
      data: { status: "READY", attempt: 0, lastError: null, startedAt: null, completedAt: null },
    }),
    prisma.agentQueueJob.updateMany({
      where: { runId: run.id, status: { in: ["QUEUED", "RUNNING"] } },
      data: {
        status: "FAILED",
        lastError: "SUPERSEDED_BY_CANCELLED_RUN_RESTORE",
        lockedAt: null,
        lockedBy: null,
        heartbeatAt: null,
        leaseExpiresAt: null,
      },
    }),
  ]);

  run.stage = resumeStage;
  run.status = "QUEUED";
  run.stopReason = null;
  run.finishedAt = null;
  run.stateJson = state;
  const updated = await saveAgentRun(run);

  const policy = getAgentPolicy();
  await enqueueAgentStep(
    updated.id,
    { reason: "user-restore-cancelled", stage: resumeStage, episodeIndex, sequence: state.queueSequence },
    0,
    policy.maxRetriesPerStep + 1,
    `${updated.id}:${episodeIndex}:${resumeStage}:user-restore-cancelled:${Date.now()}`,
  );
  await recordAgentDecision({
    runId: updated.id,
    stage: resumeStage,
    action: "USER_RESTORED_CANCELLED",
    reason: `ผู้ใช้เรียกคืนงานที่ยกเลิกและเริ่มต่อจากขั้น ${resumeStage} โดยเก็บงานและ Artifact ที่สำเร็จแล้วไว้`,
    metadata: {
      episodeIndex,
      taskId: resumeTask.id,
      preservedCompletedOutputs: reusableOutputs.map((output) => output.order),
      discardedIncompleteProviderAttempts: Math.max(0, previousOutputs.length - reusableOutputs.length),
    },
  });
  return updated;
}

export async function deleteCancelledRunByUser(run: AgentRunRecord) {
  if (run.status !== "CANCELLED") throw new Error("AGENT_RUN_DELETE_REQUIRES_CANCELLED");
  const id = run.id;
  await prisma.agentRun.delete({ where: { id } });
  return { id };
}

export async function rejectPendingRunApproval(run: AgentRunRecord, userId: string) {
  if (run.status !== "WAITING_APPROVAL" || run.stage !== "AWAIT_APPROVAL") throw new Error("AGENT_RUN_NOT_WAITING_APPROVAL");
  const approval = await rejectAgentApproval(run.id, userId);
  if (!approval) throw new Error("PENDING_APPROVAL_NOT_FOUND");
  run.status = "CANCELLED";
  run.stopReason = "ผู้ใช้ไม่อนุมัติงบประมาณของ Agent Run";
  run.finishedAt = new Date();
  const updated = await cancelAgentRun(run, run.stopReason);
  await cancelWorkflow(run.id);
  await recordAgentDecision({ runId: run.id, stage: "AWAIT_APPROVAL", action: "USER_REJECTED", reason: run.stopReason });
  return updated;
}

export async function cancelRunByUser(run: AgentRunRecord) {
  if (["COMPLETED", "FAILED", "CANCELLED"].includes(run.status)) return run;
  const state = (run.stateJson || {}) as ControlState;
  const wallet = new PrismaWalletService();
  const outputs = Object.values(state.outputsByEpisode || {}).flat();
  const cancellations: Array<{ providerTaskId?: string; providerId?: string; cancelled?: boolean; refunded?: boolean }> = [];

  for (const output of outputs) {
    let cancelled = false;
    let refunded = false;
    if (output.providerTaskId && output.providerId && !["completed", "failed"].includes(String(output.status || ""))) {
      const provider = getVideoProviderById(output.providerId);
      if (provider) cancelled = await provider.cancel(output.providerTaskId).catch(() => false);
    }
    if (output.reservationId && output.providerId !== "mock-seedance" && !output.settled) {
      refunded = await wallet.refund(output.reservationId, "Agent Run cancelled by user").then(() => true).catch(() => false);
    }
    cancellations.push({ providerTaskId: output.providerTaskId, providerId: output.providerId, cancelled, refunded });
  }

  const updated = await cancelAgentRun(run, "ผู้ใช้ยกเลิก Agent Run");
  await cancelWorkflow(run.id);
  await recordAgentDecision({ runId: run.id, stage: run.stage, action: "USER_CANCELLED", reason: "ผู้ใช้ยกเลิกงาน ระบบพยายาม Cancel Provider Task และคืน Reservation ที่ยังไม่ settle", metadata: { cancellations } });
  return updated;
}
