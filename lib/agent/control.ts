import type { AgentRunRecord, AgentStage } from "@/lib/agent/types";
import { getVideoProviderById } from "@/lib/providers/provider-registry";
import { PrismaWalletService } from "@/lib/wallet";
import {
  cancelAgentRun,
  enqueueAgentStep,
  pauseAgentRun,
  recordAgentDecision,
  rejectAgentApproval,
  resumeAgentRun,
} from "@/lib/agent/store";
import { getAgentPolicy } from "@/lib/agent/policy";
import { cancelWorkflow } from "@/lib/agent/workflow-store";

type PersistedOutput = {
  providerId?: string;
  providerTaskId?: string;
  reservationId?: string;
  settled?: boolean;
  status?: string;
};

type ControlState = {
  currentEpisodeIndex?: number;
  startEpisodeIndex?: number;
  outputsByEpisode?: Record<string, PersistedOutput[]>;
  resumeStage?: AgentStage;
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
