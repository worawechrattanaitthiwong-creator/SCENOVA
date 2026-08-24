import type { Project } from "@/lib/domain";
import { planGeneration } from "@/lib/orchestrator";
import { buildPromptBundle } from "@/lib/prompt-engine";
import { planEpisodeRender } from "@/lib/render-planner";
import { MockVideoProvider } from "@/lib/providers/mock-video-provider";
import type { GenerateVideoRequest } from "@/lib/providers/video-provider";
import { getAgentPolicy } from "@/lib/agent/policy";
import { decideAgentRecovery } from "@/lib/agent/recovery";
import { assertAgentToolAllowed } from "@/lib/agent/tools";
import {
  claimNextAgentJob, completeAgentJob, enqueueAgentStep, failOrRequeueAgentJob, getAgentRun, getApprovedAgentBudget,
  getUserAgentSpendWindows, recordAgentDecision, requestAgentApproval, saveAgentRun,
} from "@/lib/agent/store";
import type { AgentRunRecord } from "@/lib/agent/types";

type AgentInput = { project: Project; startEpisodeIndex?: number };
type AgentState = {
  currentEpisodeIndex?: number;
  startEpisodeIndex?: number;
  completedEpisodes?: number[];
  plannedCosts?: Record<string, number>;
  providerSwitches?: number;
  selectedStyle?: string | null;
  outputsByEpisode?: Record<string, unknown[]>;
  simulatedCostThb?: number;
  continuityScore?: number;
};

function stateOf(run: AgentRunRecord): AgentState { return (run.stateJson || {}) as AgentState; }
function inputOf(run: AgentRunRecord): AgentInput { return run.inputJson as AgentInput; }

async function persistAndQueue(run: AgentRunRecord, delayMs = 0) {
  const policy = getAgentPolicy();
  await saveAgentRun(run);
  await enqueueAgentStep(run.id, { stage: run.stage }, delayMs, policy.maxRetriesPerStep + 1);
}

async function processAgentStage(run: AgentRunRecord) {
  const input = inputOf(run);
  const project = input.project;
  const state = stateOf(run);
  const episodeIndex = Number.isFinite(state.currentEpisodeIndex) ? Number(state.currentEpisodeIndex) : Number(input.startEpisodeIndex || 0);
  const episode = project?.episodes?.[episodeIndex];
  if (!project || !episode) throw new Error("AGENT_EPISODE_NOT_FOUND");

  run.status = "RUNNING";
  run.startedAt ||= new Date();

  if (run.stage === "PLAN_STORY") {
    assertAgentToolAllowed({ run, tool: "plan_episode" });
    await recordAgentDecision({ runId: run.id, stage: run.stage, action: "PLAN_EPISODE", reason: `วางลำดับงาน Episode ${episodeIndex + 1} ก่อนสร้างจริง`, metadata: { episodeId: episode.id, segments: episode.segments.length } });
    run.stage = "SELECT_STYLE";
    await persistAndQueue(run);
    return;
  }

  if (run.stage === "SELECT_STYLE") {
    assertAgentToolAllowed({ run, tool: "select_style" });
    state.selectedStyle = project.stylePresetId || "AUTO_FROM_PROJECT";
    run.stateJson = state as Record<string, unknown>;
    await recordAgentDecision({ runId: run.id, stage: run.stage, action: "STYLE_SELECTED", reason: project.stylePresetId ? "ใช้ Style Lock ที่ผู้ใช้กำหนดไว้" : "ไม่มี Style Lock จึงคงโหมด Auto จาก Project Bible", metadata: { style: state.selectedStyle } });
    run.stage = "BUILD_PROMPTS";
    await persistAndQueue(run);
    return;
  }

  if (run.stage === "BUILD_PROMPTS") {
    assertAgentToolAllowed({ run, tool: "improve_prompt" });
    const planned = await planGeneration(project, episodeIndex);
    const plannedCosts = { ...(state.plannedCosts || {}), [String(episodeIndex)]: planned.estimatedTotalThb };
    state.plannedCosts = plannedCosts;
    run.planJson = planned;
    run.estimatedSpendThb = Object.values(plannedCosts).reduce((sum, amount) => sum + Number(amount || 0), 0);
    run.stateJson = state as Record<string, unknown>;

    if (run.estimatedSpendThb > run.budgetThb) {
      run.status = "FAILED"; run.stage = "FAILED"; run.stopReason = `แผนประมาณ ${run.estimatedSpendThb.toFixed(2)} THB เกิน hard budget ${run.budgetThb.toFixed(2)} THB`; run.finishedAt = new Date();
      await saveAgentRun(run);
      await recordAgentDecision({ runId: run.id, stage: "BUILD_PROMPTS", action: "BUDGET_BLOCK", reason: run.stopReason, metadata: { estimatedSpendThb: run.estimatedSpendThb, budgetThb: run.budgetThb } });
      return;
    }

    const approvedBudget = await getApprovedAgentBudget(run.id);
    if (run.estimatedSpendThb > run.approvalThresholdThb && approvedBudget < run.estimatedSpendThb) {
      assertAgentToolAllowed({ run, tool: "request_approval" });
      await requestAgentApproval({ runId: run.id, estimatedCostThb: run.estimatedSpendThb, summary: `Agent ขออนุมัติแผนสูงสุด ${run.maxEpisodes} Episode มูลค่าประมาณ ${run.estimatedSpendThb.toFixed(2)} THB` });
      run.status = "WAITING_APPROVAL"; run.stage = "AWAIT_APPROVAL"; run.stopReason = "รอผู้ใช้อนุมัติงบประมาณก่อน Generate";
      await saveAgentRun(run);
      await recordAgentDecision({ runId: run.id, stage: "AWAIT_APPROVAL", action: "HUMAN_CHECKPOINT", reason: run.stopReason, metadata: { estimatedSpendThb: run.estimatedSpendThb } });
      return;
    }

    await recordAgentDecision({ runId: run.id, stage: run.stage, action: "PROMPT_PLAN_READY", reason: "Prompt และ Render Plan ผ่าน hard budget guardrail แล้ว", metadata: { estimatedSpendThb: run.estimatedSpendThb } });
    run.stage = "GENERATE";
    await persistAndQueue(run);
    return;
  }

  if (run.stage === "AWAIT_APPROVAL") {
    run.status = "WAITING_APPROVAL";
    await saveAgentRun(run);
    return;
  }

  if (run.stage === "GENERATE") {
    const provider = new MockVideoProvider();
    const renderPlan = planEpisodeRender(project, episode);
    const prompt = buildPromptBundle(project, episode);
    const approvedBudget = await getApprovedAgentBudget(run.id);
    const spendWindows = await getUserAgentSpendWindows(run.userId);
    const tasks: unknown[] = [];
    let simulatedCost = Number(state.simulatedCostThb || 0);

    for (const renderSegment of renderPlan) {
      const request: GenerateVideoRequest = {
        projectId: project.id, episodeId: episode.id, renderSegment, prompt, resolution: project.resolution,
        imageReferences: [], videoReferences: [], audioReferences: [], idempotencyKey: `agent:${run.id}:${episode.id}:${renderSegment.order}`,
      };
      const estimate = await provider.estimateCost(request);
      assertAgentToolAllowed({
        run: { ...run, actualSpendThb: run.actualSpendThb + simulatedCost }, tool: "generate_video", requestedSpendThb: estimate.estimatedAmount,
        providerId: provider.id, hourlySpendThb: spendWindows.hourlySpendThb, dailySpendThb: spendWindows.dailySpendThb,
        approvedBudgetThb: approvedBudget, creditReservationId: `mock-reservation:${run.id}:${renderSegment.order}`, creditReservationMode: "mock",
      });
      const task = await provider.generate(request);
      simulatedCost += estimate.estimatedAmount;
      tasks.push({ ...task, estimatedCostThb: estimate.estimatedAmount, order: renderSegment.order });
      await recordAgentDecision({ runId: run.id, stage: run.stage, action: "GENERATE_SEGMENT", reason: "Mock Provider ผ่าน Tool Guardrail; production provider จะต้องมี Wallet Reservation จริง", providerId: provider.id, metadata: { order: renderSegment.order, estimatedCostThb: estimate.estimatedAmount } });
    }

    state.simulatedCostThb = simulatedCost;
    state.outputsByEpisode = { ...(state.outputsByEpisode || {}), [String(episodeIndex)]: tasks };
    run.stateJson = state as Record<string, unknown>;
    run.stage = "VERIFY_CONTINUITY";
    await persistAndQueue(run);
    return;
  }

  if (run.stage === "VERIFY_CONTINUITY") {
    assertAgentToolAllowed({ run, tool: "verify_continuity" });
    const outputs = state.outputsByEpisode?.[String(episodeIndex)] || [];
    const expected = planEpisodeRender(project, episode).length;
    const score = expected > 0 ? Math.round(Math.min(1, outputs.length / expected) * 100) : 100;
    state.continuityScore = score;
    run.stateJson = state as Record<string, unknown>;
    await recordAgentDecision({ runId: run.id, stage: run.stage, action: "CONTINUITY_CHECK", reason: score === 100 ? "จำนวนผลลัพธ์ครบตาม Render Plan พร้อมส่งต่อ Episode ถัดไป" : "ผลลัพธ์ยังไม่ครบ ต้องหยุดตรวจสอบก่อนส่งต่อ", metadata: { score, expected, actual: outputs.length } });
    if (score < 100) { run.status = "PAUSED"; run.stopReason = "Continuity verification ไม่ผ่าน"; await saveAgentRun(run); return; }
    run.stage = "NEXT_EPISODE";
    await persistAndQueue(run);
    return;
  }

  if (run.stage === "NEXT_EPISODE") {
    const completed = Array.from(new Set([...(state.completedEpisodes || []), episodeIndex]));
    state.completedEpisodes = completed;
    const startIndex = Number(state.startEpisodeIndex || 0);
    const processedCount = episodeIndex - startIndex + 1;
    const nextIndex = episodeIndex + 1;
    if (processedCount < run.maxEpisodes && project.episodes[nextIndex]) {
      state.currentEpisodeIndex = nextIndex;
      run.stateJson = state as Record<string, unknown>;
      run.planJson = null;
      run.stage = "PLAN_STORY";
      await recordAgentDecision({ runId: run.id, stage: "NEXT_EPISODE", action: "CONTINUE_SERIES", reason: `Episode ${episodeIndex + 1} ผ่าน Continuity แล้ว เดินหน้าตอนถัดไป`, metadata: { nextEpisodeIndex: nextIndex } });
      await persistAndQueue(run);
      return;
    }
    run.status = "COMPLETED"; run.stage = "COMPLETED"; run.finishedAt = new Date(); run.stopReason = null; run.stateJson = state as Record<string, unknown>;
    await saveAgentRun(run);
    await recordAgentDecision({ runId: run.id, stage: "COMPLETED", action: "RUN_COMPLETED", reason: `Agent ทำงานครบ ${completed.length} Episode ตามขอบเขตที่อนุญาต`, metadata: { completedEpisodes: completed, simulatedCostThb: state.simulatedCostThb || 0 } });
    return;
  }
}

export async function runAgentWorkerOnce(workerId: string) {
  const job = await claimNextAgentJob(workerId);
  if (!job) return false;
  const policy = getAgentPolicy();
  try {
    const run = await getAgentRun(job.runId);
    if (!run || ["COMPLETED", "FAILED", "CANCELLED"].includes(run.status)) { await completeAgentJob(job.id); return true; }
    await processAgentStage(run);
    await completeAgentJob(job.id);
    return true;
  } catch (error) {
    const run = await getAgentRun(job.runId);
    const state = run ? stateOf(run) : {};
    const recovery = decideAgentRecovery({ error, attempt: job.attempts, maxRetries: policy.maxRetriesPerStep, providerSwitches: Number(state.providerSwitches || 0), maxProviderSwitches: policy.maxProviderSwitches });
    const message = error instanceof Error ? error.message : String(error);
    if (run) {
      await recordAgentDecision({ runId: run.id, stage: run.stage, action: `RECOVERY_${recovery.action}`, reason: recovery.reason, metadata: { error: message, attempt: job.attempts } });
      if (recovery.action === "ASK_USER") { run.status = "PAUSED"; run.stopReason = recovery.reason; await saveAgentRun(run); await completeAgentJob(job.id); return true; }
      if (recovery.action === "SWITCH_PROVIDER") { state.providerSwitches = Number(state.providerSwitches || 0) + 1; run.stateJson = state as Record<string, unknown>; run.status = "PAUSED"; run.stopReason = "ต้องกำหนด Alternate Provider ก่อน Resume"; await saveAgentRun(run); await completeAgentJob(job.id); return true; }
      if (recovery.action === "STOP") { run.status = "FAILED"; run.stage = "FAILED"; run.stopReason = recovery.reason; run.finishedAt = new Date(); await saveAgentRun(run); await completeAgentJob(job.id); return true; }
      run.status = "QUEUED"; await saveAgentRun(run);
    }
    await failOrRequeueAgentJob(job, message, recovery.delayMs);
    return true;
  }
}
