import type { Project } from "@/lib/domain";
import { planGeneration, type PlannedGeneration } from "@/lib/orchestrator";
import { planEpisodeRender } from "@/lib/render-planner";
import type { GenerateVideoRequest } from "@/lib/providers/video-provider";
import { getVideoProviderById, getVideoProviderMap, resolveAlternateProvider, selectVideoProvider } from "@/lib/providers/provider-registry";
import { getAgentPolicy } from "@/lib/agent/policy";
import { decideAgentRecovery } from "@/lib/agent/recovery";
import { chooseAgentAction, type AgentBrainDecision } from "@/lib/agent/brain";
import { assertAgentToolAllowed } from "@/lib/agent/tools";
import {
  claimNextAgentJob, completeAgentJob, enqueueAgentStep, failExpiredAgentJobs, failOrRequeueAgentJob, getAgentRun, getApprovedAgentBudget,
  getUserAgentSpendWindows, heartbeatAgentJob, pauseAgentRun, recordAgentDecision, requestAgentApproval, saveAgentRun,
} from "@/lib/agent/store";
import type { AgentQueueJobRecord, AgentRunRecord } from "@/lib/agent/types";
import { PrismaWalletService } from "@/lib/wallet";
import { createCostQuote, creditsFromThb, settleCostQuote, type CostQuoteItem } from "@/lib/cost-transparency";
import { verifyProductionContinuity } from "@/lib/continuity-verifier";

type AgentInput = { project: Project; startEpisodeIndex?: number };
type GenerationOutput = {
  order: number;
  attempt: number;
  providerId: string;
  providerTaskId?: string;
  status: "submitting" | "queued" | "generating" | "completed" | "failed";
  estimatedCostThb: number;
  reservationId?: string;
  reservedCredits?: number;
  settled?: boolean;
  outputUrl?: string;
  lastFrameUrl?: string;
  error?: string;
};
type AgentState = {
  currentEpisodeIndex?: number;
  startEpisodeIndex?: number;
  completedEpisodes?: number[];
  plannedCosts?: Record<string, number>;
  providerSwitches?: number;
  selectedStyle?: string | null;
  selectedProviderId?: string | null;
  outputsByEpisode?: Record<string, GenerationOutput[]>;
  simulatedCostThb?: number;
  continuityScore?: number;
  continuityReports?: Record<string, unknown>;
  costQuoteIds?: Record<string, string>;
  brainDecisions?: Record<string, AgentBrainDecision>;
  queueSequence?: number;
};

function stateOf(run: AgentRunRecord): AgentState { return (run.stateJson || {}) as AgentState; }
function inputOf(run: AgentRunRecord): AgentInput { return run.inputJson as AgentInput; }
function episodeIndexOf(run: AgentRunRecord, input: AgentInput, state: AgentState) {
  return typeof state.currentEpisodeIndex === "number" ? state.currentEpisodeIndex : Number(input.startEpisodeIndex || 0);
}

async function persistAndQueue(run: AgentRunRecord, episodeIndex: number, delayMs = 0) {
  const policy = getAgentPolicy();
  const state = stateOf(run);
  state.queueSequence = Number(state.queueSequence || 0) + 1;
  run.stateJson = state as Record<string, unknown>;
  await saveAgentRun(run);
  await enqueueAgentStep(
    run.id,
    { stage: run.stage, episodeIndex, sequence: state.queueSequence },
    delayMs,
    policy.maxRetriesPerStep + 1,
    `${run.id}:${episodeIndex}:${run.stage}:${state.queueSequence}`,
  );
}

async function brainDecision(run: AgentRunRecord, project: Project, episodeIndex: number, jobAttempt: number) {
  const state = stateOf(run);
  const episode = project.episodes[episodeIndex];
  const key = `${episodeIndex}:${run.stage}`;
  const cached = state.brainDecisions?.[key];
  if (cached) return cached;
  const decision = await chooseAgentAction({ run, project, episode, state: state as Record<string, unknown>, retryCount: Math.max(0, jobAttempt - 1) });
  state.brainDecisions = { ...(state.brainDecisions || {}), [key]: decision };
  run.stateJson = state as Record<string, unknown>;
  await saveAgentRun(run);
  await recordAgentDecision({
    runId: run.id,
    stage: run.stage,
    action: `BRAIN_${decision.tool.toUpperCase()}`,
    reason: decision.reason,
    metadata: { source: decision.source, modelId: decision.modelId, llmCostThb: decision.costThb, routerReason: decision.routerReason, args: decision.args },
  });
  return decision;
}

async function honorPauseDecision(run: AgentRunRecord, decision: AgentBrainDecision) {
  if (decision.tool !== "pause_run") return false;
  assertAgentToolAllowed({ run, tool: "pause_run" });
  await pauseAgentRun(run, decision.reason || "Agent Planner ขอหยุดเพื่อให้ผู้ใช้ตรวจสอบ");
  return true;
}

function quoteItems(plan: PlannedGeneration): CostQuoteItem[] {
  const videoCredits = creditsFromThb(plan.estimatedTotalThb);
  const agentFee = Math.max(0, Math.ceil(Number(process.env.SCENOVA_AGENT_CREDIT_FEE || 0)));
  const continuityFee = Math.max(0, Math.ceil(Number(process.env.SCENOVA_CONTINUITY_CREDIT_FEE || 0)));
  const promptFee = Math.max(0, Math.ceil(Number(process.env.SCENOVA_INTERNAL_PROMPT_CREDIT_FEE || 0)));
  return [
    { category: "AGENT_PLANNING", label: "AI Planning / Agent Director", estimatedCredits: agentFee, included: agentFee === 0 },
    { category: "PROMPT_GENERATION", label: "Production Prompt", estimatedCredits: promptFee, included: promptFee === 0 },
    { category: "CONTINUITY_CHECK", label: "Continuity / Canon Check", estimatedCredits: continuityFee, included: continuityFee === 0 },
    { category: "VIDEO_GENERATION", label: "Video Generation", estimatedCredits: videoCredits },
  ];
}

async function processAgentStage(run: AgentRunRecord, job: AgentQueueJobRecord) {
  const input = inputOf(run);
  const project = input.project;
  const state = stateOf(run);
  const episodeIndex = episodeIndexOf(run, input, state);
  const episode = project?.episodes?.[episodeIndex];
  if (!project || !episode) throw new Error("AGENT_EPISODE_NOT_FOUND");

  run.status = "RUNNING";
  run.startedAt ||= new Date();

  if (run.stage === "PLAN_STORY") {
    const decision = await brainDecision(run, project, episodeIndex, job.attempts);
    if (await honorPauseDecision(run, decision)) return;
    assertAgentToolAllowed({ run, tool: "plan_episode" });
    await recordAgentDecision({ runId: run.id, stage: run.stage, action: "PLAN_EPISODE", reason: decision.reason || `วางลำดับงาน Episode ${episodeIndex + 1} ก่อนสร้างจริง`, metadata: { episodeId: episode.id, segments: episode.segments.length } });
    run.stage = "SELECT_STYLE";
    await persistAndQueue(run, episodeIndex);
    return;
  }

  if (run.stage === "SELECT_STYLE") {
    const decision = await brainDecision(run, project, episodeIndex, job.attempts);
    if (await honorPauseDecision(run, decision)) return;
    assertAgentToolAllowed({ run, tool: "select_style" });
    state.selectedStyle = project.styleId || "AUTO_FROM_PROJECT";
    run.stateJson = state as Record<string, unknown>;
    await recordAgentDecision({ runId: run.id, stage: run.stage, action: "STYLE_SELECTED", reason: project.styleId ? "ใช้ Style Lock ที่ผู้ใช้กำหนดไว้" : decision.reason || "ไม่มี Style Lock จึงคงโหมด Auto จาก Project Bible", metadata: { style: state.selectedStyle } });
    run.stage = "BUILD_PROMPTS";
    await persistAndQueue(run, episodeIndex);
    return;
  }

  if (run.stage === "BUILD_PROMPTS") {
    const decision = await brainDecision(run, project, episodeIndex, job.attempts);
    if (await honorPauseDecision(run, decision)) return;
    assertAgentToolAllowed({ run, tool: "improve_prompt" });
    const planned = await planGeneration(project, episodeIndex, { promptContext: { userId: run.userId, runId: run.id }, providers: getVideoProviderMap() });
    const plannedCosts = { ...(state.plannedCosts || {}), [String(episodeIndex)]: planned.estimatedTotalThb };
    state.plannedCosts = plannedCosts;
    run.planJson = planned;
    run.estimatedSpendThb = Object.values(plannedCosts).reduce((sum, amount) => sum + Number(amount || 0), 0);

    if (!state.costQuoteIds?.[String(episodeIndex)]) {
      const quote = await createCostQuote({ userId: run.userId, referenceType: "episode-generation", referenceId: `${project.id}:${episode.id}`, items: quoteItems(planned) });
      state.costQuoteIds = { ...(state.costQuoteIds || {}), [String(episodeIndex)]: quote.quoteId };
    }
    run.stateJson = state as Record<string, unknown>;

    if (run.estimatedSpendThb > run.budgetThb) {
      run.status = "FAILED";
      run.stage = "FAILED";
      run.stopReason = `แผนประมาณ ${run.estimatedSpendThb.toFixed(2)} THB เกิน hard budget ${run.budgetThb.toFixed(2)} THB`;
      run.finishedAt = new Date();
      await saveAgentRun(run);
      await recordAgentDecision({ runId: run.id, stage: "BUILD_PROMPTS", action: "BUDGET_BLOCK", reason: run.stopReason, metadata: { estimatedSpendThb: run.estimatedSpendThb, budgetThb: run.budgetThb } });
      return;
    }

    const approvedBudget = await getApprovedAgentBudget(run.id);
    if (run.estimatedSpendThb > run.approvalThresholdThb && approvedBudget < run.estimatedSpendThb) {
      assertAgentToolAllowed({ run, tool: "request_approval" });
      await requestAgentApproval({ runId: run.id, estimatedCostThb: run.estimatedSpendThb, summary: `Agent ขออนุมัติแผนสูงสุด ${run.maxEpisodes} Episode มูลค่าประมาณ ${run.estimatedSpendThb.toFixed(2)} THB` });
      run.status = "WAITING_APPROVAL";
      run.stage = "AWAIT_APPROVAL";
      run.stopReason = "รอผู้ใช้อนุมัติงบประมาณก่อน Generate";
      await saveAgentRun(run);
      await recordAgentDecision({ runId: run.id, stage: "AWAIT_APPROVAL", action: "HUMAN_CHECKPOINT", reason: run.stopReason, metadata: { estimatedSpendThb: run.estimatedSpendThb, quoteId: state.costQuoteIds?.[String(episodeIndex)] } });
      return;
    }

    await recordAgentDecision({ runId: run.id, stage: run.stage, action: "PROMPT_PLAN_READY", reason: decision.reason || "Prompt และ Render Plan ผ่าน hard budget guardrail แล้ว", metadata: { estimatedSpendThb: run.estimatedSpendThb, quoteId: state.costQuoteIds?.[String(episodeIndex)] } });
    run.stage = "GENERATE";
    await persistAndQueue(run, episodeIndex);
    return;
  }

  if (run.stage === "AWAIT_APPROVAL") {
    run.status = "WAITING_APPROVAL";
    await saveAgentRun(run);
    return;
  }

  if (run.stage === "GENERATE") {
    const decision = await brainDecision(run, project, episodeIndex, job.attempts);
    if (await honorPauseDecision(run, decision)) return;

    if (decision.tool === "switch_provider") {
      assertAgentToolAllowed({ run, tool: "switch_provider" });
      const current = state.selectedProviderId || selectVideoProvider(project.mainModelId).provider.id;
      const alternate = resolveAlternateProvider(current, project.mainModelId);
      if (!alternate) {
        await pauseAgentRun(run, "Agent ขอเปลี่ยน Provider แต่ยังไม่มี Alternate Provider ที่เปิดใช้งาน");
        return;
      }
      state.selectedProviderId = alternate.provider.id;
      state.providerSwitches = Number(state.providerSwitches || 0) + 1;
      run.stateJson = state as Record<string, unknown>;
      await recordAgentDecision({ runId: run.id, stage: run.stage, action: "PROVIDER_SWITCH", reason: alternate.reason, providerId: alternate.provider.id });
    }

    const selection = selectVideoProvider(project.mainModelId, state.selectedProviderId || null);
    const provider = selection.provider;
    state.selectedProviderId = provider.id;
    const renderPlan = planEpisodeRender(project, episode);
    const planned = run.planJson as PlannedGeneration | null;
    const prompt = planned?.promptBundle;
    if (!prompt) throw new Error("AGENT_PROMPT_BUNDLE_NOT_FOUND");
    const approvedBudget = await getApprovedAgentBudget(run.id);
    const spendWindows = await getUserAgentSpendWindows(run.userId);
    const wallet = new PrismaWalletService();
    const outputs = [...(state.outputsByEpisode?.[String(episodeIndex)] || [])];
    const quoteId = state.costQuoteIds?.[String(episodeIndex)] || null;
    let simulatedCost = Number(state.simulatedCostThb || 0);
    let pending = false;

    for (const renderSegment of renderPlan) {
      const existingIndex = outputs.findIndex((output) => output.order === renderSegment.order && output.status !== "failed");
      let output = existingIndex >= 0 ? outputs[existingIndex] : undefined;
      const requestBase: Omit<GenerateVideoRequest, "idempotencyKey"> = {
        projectId: project.id,
        episodeId: episode.id,
        renderSegment,
        prompt,
        resolution: project.resolution,
        aspectRatio: project.aspectRatio,
        imageReferences: [],
        videoReferences: [],
        audioReferences: [],
      };

      if (output?.providerTaskId && ["queued", "generating"].includes(output.status)) {
        const currentProvider = getVideoProviderById(output.providerId);
        if (!currentProvider) throw new Error(`PROVIDER_UNAVAILABLE:${output.providerId}`);
        const status = await currentProvider.getStatus(output.providerTaskId);
        output = {
          ...output,
          status: status.status,
          outputUrl: status.outputUrl,
          lastFrameUrl: status.lastFrameUrl,
          error: status.error,
        };
        outputs[existingIndex] = output;
        if (output.status === "failed") {
          if (output.reservationId && output.providerId !== "mock-seedance") await wallet.refund(output.reservationId, output.error || "Provider failed");
          throw new Error(`PROVIDER_FAILED:${output.providerId}:${output.error || "unknown"}`);
        }
        if (output.status === "completed" && !output.settled) {
          if (output.reservationId && output.providerId !== "mock-seedance") {
            await wallet.charge(output.reservationId, output.reservedCredits);
            run.actualSpendThb += output.estimatedCostThb;
          }
          output.settled = true;
          outputs[existingIndex] = output;
          await recordAgentDecision({ runId: run.id, stage: run.stage, action: "PROVIDER_COMPLETED", reason: `Provider ส่งผลลัพธ์ Render Segment ${renderSegment.order} สำเร็จ`, providerId: output.providerId, metadata: { order: renderSegment.order, estimatedCostThb: output.estimatedCostThb, credits: output.reservedCredits || 0 } });
        } else if (output.status !== "completed") {
          pending = true;
        }
        continue;
      }
      if (output?.status === "completed") continue;

      const estimate = await provider.estimateCost({ ...requestBase, idempotencyKey: `estimate:${run.id}:${episode.id}:${renderSegment.order}` });
      const isReal = provider.id !== "mock-seedance";
      const attempt = outputs.filter((item) => item.order === renderSegment.order).reduce((max, item) => Math.max(max, item.attempt), 0) + 1;
      const reservedCredits = isReal ? Math.max(1, creditsFromThb(estimate.estimatedAmount)) : 0;
      let reservationId = `mock-reservation:${run.id}:${episode.id}:${renderSegment.order}:attempt:${attempt}`;
      if (isReal) {
        const reservation = await wallet.reserve({
          userId: run.userId,
          credits: reservedCredits,
          purpose: "video",
          category: attempt > 1 ? "VIDEO_RETRY" : "VIDEO_GENERATION",
          quoteId,
          referenceId: `${run.id}:${episode.id}:${renderSegment.order}:attempt:${attempt}`,
          idempotencyKey: `video:${run.id}:${episode.id}:${renderSegment.order}:${provider.id}:attempt:${attempt}`,
          metadata: { runId: run.id, projectId: project.id, episodeId: episode.id, order: renderSegment.order, attempt, providerId: provider.id },
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        });
        reservationId = reservation.reservationId;
      }

      assertAgentToolAllowed({
        run: { ...run, actualSpendThb: run.actualSpendThb + simulatedCost },
        tool: "generate_video",
        requestedSpendThb: estimate.estimatedAmount,
        providerId: provider.id,
        hourlySpendThb: spendWindows.hourlySpendThb,
        dailySpendThb: spendWindows.dailySpendThb,
        approvedBudgetThb: approvedBudget,
        creditReservationId: reservationId,
        creditReservationMode: isReal ? "wallet" : "mock",
      });

      const idempotencyKey = `agent:${run.id}:${episode.id}:${renderSegment.order}:attempt:${attempt}`;
      const placeholder: GenerationOutput = { order: renderSegment.order, attempt, providerId: provider.id, status: "submitting", estimatedCostThb: estimate.estimatedAmount, reservationId, reservedCredits };
      outputs.push(placeholder);
      state.outputsByEpisode = { ...(state.outputsByEpisode || {}), [String(episodeIndex)]: outputs };
      run.stateJson = state as Record<string, unknown>;
      await saveAgentRun(run);

      try {
        const task = await provider.generate({ ...requestBase, idempotencyKey });
        const index = outputs.indexOf(placeholder);
        outputs[index] = { ...placeholder, providerTaskId: task.providerTaskId, status: task.status, outputUrl: task.outputUrl, lastFrameUrl: task.lastFrameUrl, error: task.error };
        if (!isReal) simulatedCost += estimate.estimatedAmount;
        await recordAgentDecision({ runId: run.id, stage: run.stage, action: attempt > 1 ? "RETRY_SEGMENT" : "GENERATE_SEGMENT", reason: `${selection.reason}; ผ่าน Tool Guardrail และ ${isReal ? "Wallet Reservation จริง" : "Mock Reservation"}`, providerId: provider.id, metadata: { order: renderSegment.order, attempt, estimatedCostThb: estimate.estimatedAmount, reservedCredits, quoteId } });
        if (task.status === "completed") {
          if (isReal) {
            await wallet.charge(reservationId, reservedCredits);
            run.actualSpendThb += estimate.estimatedAmount;
          }
          outputs[index].settled = true;
        } else if (task.status === "failed") {
          if (isReal) await wallet.refund(reservationId, task.error || "Provider rejected generation");
          throw new Error(`PROVIDER_FAILED:${provider.id}:${task.error || "unknown"}`);
        } else {
          pending = true;
        }
      } catch (error) {
        if (isReal) await wallet.refund(reservationId, error instanceof Error ? error.message : String(error)).catch(() => undefined);
        placeholder.status = "failed";
        placeholder.error = error instanceof Error ? error.message : String(error);
        throw error;
      }
    }

    state.simulatedCostThb = simulatedCost;
    state.outputsByEpisode = { ...(state.outputsByEpisode || {}), [String(episodeIndex)]: outputs };
    run.stateJson = state as Record<string, unknown>;
    if (pending || outputs.some((output) => output.status === "queued" || output.status === "generating" || output.status === "submitting")) {
      run.status = "QUEUED";
      await persistAndQueue(run, episodeIndex, Math.max(500, Number(process.env.AGENT_PROVIDER_POLL_MS || 5000)));
      return;
    }
    run.stage = "VERIFY_CONTINUITY";
    await persistAndQueue(run, episodeIndex);
    return;
  }

  if (run.stage === "VERIFY_CONTINUITY") {
    const decision = await brainDecision(run, project, episodeIndex, job.attempts);
    if (await honorPauseDecision(run, decision)) return;
    assertAgentToolAllowed({ run, tool: "verify_continuity" });
    const outputs = state.outputsByEpisode?.[String(episodeIndex)] || [];
    const report = verifyProductionContinuity({ project, episode, outputs: outputs.map((output) => ({ ...output })) });
    state.continuityScore = report.score;
    state.continuityReports = { ...(state.continuityReports || {}), [String(episodeIndex)]: report };
    run.stateJson = state as Record<string, unknown>;
    await recordAgentDecision({ runId: run.id, stage: run.stage, action: "CONTINUITY_CHECK", reason: report.passed ? `Continuity ผ่านด้วยคะแนน ${report.score}/100` : `Continuity พบประเด็นที่ต้องตรวจสอบ คะแนน ${report.score}/100`, metadata: report });
    if (!report.passed) {
      await pauseAgentRun(run, "Continuity verification ไม่ผ่าน — ต้องตรวจ Character/Canon/Location/Camera หรือผลลัพธ์ที่ขาดก่อน Resume");
      return;
    }
    const quoteId = state.costQuoteIds?.[String(episodeIndex)];
    if (quoteId) await settleCostQuote(quoteId, run.userId);
    run.stage = "NEXT_EPISODE";
    await persistAndQueue(run, episodeIndex);
    return;
  }

  if (run.stage === "NEXT_EPISODE") {
    const decision = await brainDecision(run, project, episodeIndex, job.attempts);
    if (await honorPauseDecision(run, decision)) return;
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
      await recordAgentDecision({ runId: run.id, stage: "NEXT_EPISODE", action: "CONTINUE_SERIES", reason: decision.reason || `Episode ${episodeIndex + 1} ผ่าน Continuity แล้ว เดินหน้าตอนถัดไป`, metadata: { nextEpisodeIndex: nextIndex } });
      await persistAndQueue(run, nextIndex);
      return;
    }
    run.status = "COMPLETED";
    run.stage = "COMPLETED";
    run.finishedAt = new Date();
    run.stopReason = null;
    run.stateJson = state as Record<string, unknown>;
    await saveAgentRun(run);
    await recordAgentDecision({ runId: run.id, stage: "COMPLETED", action: "RUN_COMPLETED", reason: `Agent ทำงานครบ ${completed.length} Episode ตามขอบเขตที่อนุญาต`, metadata: { completedEpisodes: completed, simulatedCostThb: state.simulatedCostThb || 0, actualSpendThb: run.actualSpendThb } });
  }
}

export async function runAgentWorkerOnce(workerId: string) {
  const policy = getAgentPolicy();
  await failExpiredAgentJobs();
  const job = await claimNextAgentJob(workerId, policy.queueLeaseSeconds);
  if (!job) return false;

  const heartbeatEveryMs = Math.max(5_000, Math.floor((policy.queueLeaseSeconds * 1000) / 3));
  const heartbeat = setInterval(() => {
    void heartbeatAgentJob(job.id, workerId, policy.queueLeaseSeconds).catch((error) => console.error("[SCENOVA] Agent heartbeat failed", error));
  }, heartbeatEveryMs);
  heartbeat.unref?.();

  try {
    const run = await getAgentRun(job.runId);
    if (!run || ["COMPLETED", "FAILED", "CANCELLED"].includes(run.status)) { await completeAgentJob(job.id); return true; }
    if (run.status === "PAUSED" || run.status === "WAITING_APPROVAL") { await completeAgentJob(job.id); return true; }
    await processAgentStage(run, job);
    await completeAgentJob(job.id);
    return true;
  } catch (error) {
    const run = await getAgentRun(job.runId);
    const state = run ? stateOf(run) : {};
    const recovery = decideAgentRecovery({ error, attempt: job.attempts, maxRetries: policy.maxRetriesPerStep, providerSwitches: Number(state.providerSwitches || 0), maxProviderSwitches: policy.maxProviderSwitches });
    const message = error instanceof Error ? error.message : String(error);
    if (run) {
      await recordAgentDecision({ runId: run.id, stage: run.stage, action: `RECOVERY_${recovery.action}`, reason: recovery.reason, metadata: { error: message, attempt: job.attempts } });
      if (recovery.action === "ASK_USER") { await pauseAgentRun(run, recovery.reason); await completeAgentJob(job.id); return true; }
      if (recovery.action === "SWITCH_PROVIDER") {
        const project = inputOf(run).project;
        const current = state.selectedProviderId || selectVideoProvider(project.mainModelId).provider.id;
        const alternate = resolveAlternateProvider(current, project.mainModelId);
        if (alternate) {
          state.providerSwitches = Number(state.providerSwitches || 0) + 1;
          state.selectedProviderId = alternate.provider.id;
          run.stateJson = state as Record<string, unknown>;
          run.status = "QUEUED";
          run.stopReason = null;
          await saveAgentRun(run);
          await recordAgentDecision({ runId: run.id, stage: run.stage, action: "PROVIDER_SWITCH", reason: alternate.reason, providerId: alternate.provider.id });
          const episodeIndex = episodeIndexOf(run, inputOf(run), state);
          await enqueueAgentStep(run.id, { reason: "provider-switched", stage: run.stage, episodeIndex }, 0, policy.maxRetriesPerStep + 1, `${run.id}:${episodeIndex}:${run.stage}:provider-switch:${state.providerSwitches}`);
          await completeAgentJob(job.id);
          return true;
        }
        await pauseAgentRun(run, "Provider ใช้งานไม่ได้และไม่มี Alternate Provider ที่เปิดใช้งาน");
        await completeAgentJob(job.id);
        return true;
      }
      if (recovery.action === "STOP") {
        run.status = "FAILED";
        run.stage = "FAILED";
        run.stopReason = recovery.reason;
        run.finishedAt = new Date();
        await saveAgentRun(run);
        await completeAgentJob(job.id);
        return true;
      }
      run.status = "QUEUED";
      await saveAgentRun(run);
    }
    await failOrRequeueAgentJob(job, message, recovery.delayMs);
    return true;
  } finally {
    clearInterval(heartbeat);
  }
}
