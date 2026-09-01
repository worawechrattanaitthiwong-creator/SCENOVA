import type { Project } from "@/lib/domain";
import { planGeneration, type PlannedGeneration } from "@/lib/orchestrator";
import { planEpisodeRender } from "@/lib/render-planner";
import type { GenerateVideoRequest, ProviderBillingMode } from "@/lib/providers/video-provider";
import { getUserVideoProviderById, getUserVideoProviderMap, resolveUserAlternateProvider, selectUserVideoProvider } from "@/lib/providers/provider-registry";
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
import { executeRoleAgent } from "@/lib/agent/role-runtime";
import type { AgentRoleKey } from "@/lib/agent/contracts";
import {
  completeWorkflow,
  completeWorkflowStageTask,
  ensureEpisodeWorkflow,
  ensureRenderShotTasks,
  startRenderShotTask,
  completeRenderShotTask,
  failRenderShotTask,
  failWorkflowStageTask,
  requestHumanCheckpoint,
  returnWorkflowToStage,
  startWorkflowStageTask,
} from "@/lib/agent/workflow-store";

type AgentInput = { project: Project; startEpisodeIndex?: number };
type GenerationOutput = {
  order: number;
  attempt: number;
  providerId: string;
  billingMode?: ProviderBillingMode;
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
  scriptRevisionCounts?: Record<string, number>;
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

const specialistTools = {
  PLAN_STORY: "plan_episode",
  STORY_ARCHITECT: "architect_story",
  SCRIPT_WRITE: "write_script",
  SCRIPT_EDIT: "edit_script",
  DIRECT_SCENES: "direct_scenes",
  PLAN_CINEMATOGRAPHY: "plan_cinematography",
  STORYBOARD: "create_storyboard",
  POST_PRODUCTION: "plan_post_production",
  FINAL_QUALITY: "quality_check",
} as const;

async function runSpecialistStage(input: {
  run: AgentRunRecord;
  project: Project;
  episodeIndex: number;
  role: AgentRoleKey;
  nextStage: AgentRunRecord["stage"];
  queueNext?: boolean;
}) {
  const episode = input.project.episodes[input.episodeIndex];
  const stage = input.run.stage;
  const tool = specialistTools[stage as keyof typeof specialistTools];
  if (tool) assertAgentToolAllowed({ run: input.run, tool });
  await startWorkflowStageTask(input.run.id, input.episodeIndex, stage);
  const result = await executeRoleAgent({ role: input.role, run: input.run, project: input.project, episode, episodeIndex: input.episodeIndex, stage });
  const completed = await completeWorkflowStageTask({
    runId: input.run.id,
    episodeIndex: input.episodeIndex,
    stage,
    summary: result.artifact.summary,
    content: result.artifact,
    review: input.role === "SCRIPT_EDITOR" ? {
      reviewerAgentKey: input.role,
      verdict: result.artifact.verdict,
      score: result.artifact.confidence,
      summary: result.artifact.summary,
      issues: result.artifact.issues,
    } : undefined,
  });
  await recordAgentDecision({
    runId: input.run.id,
    stage,
    action: `${input.role}_COMPLETED`,
    reason: result.artifact.summary,
    metadata: { role: input.role, source: result.source, modelId: result.modelId, llmCostThb: result.costThb, artifactId: completed.artifact.id, artifactVersion: completed.artifact.version, verdict: result.artifact.verdict },
  });
  if (result.artifact.verdict === "BLOCKED") {
    await pauseAgentRun(input.run, result.artifact.issues.join("; ") || `${input.role} พบ Blocker ที่ต้องตรวจสอบ`);
    return { result, completed, continued: false };
  }
  if (result.artifact.verdict === "REVISE") {
    await pauseAgentRun(input.run, result.artifact.issues.join("; ") || `${input.role} ขอให้ตรวจและแก้งานต้นทางก่อนส่งต่อ`);
    return { result, completed, continued: false };
  }
  input.run.stage = input.nextStage;
  if (input.queueNext === false) await saveAgentRun(input.run);
  else await persistAndQueue(input.run, input.episodeIndex);
  return { result, completed, continued: true };
}

function imageReferencesForRenderSegment(project: Project, episode: Project["episodes"][number], renderSegment: GenerateVideoRequest["renderSegment"]) {
  const sourceIds = new Set(renderSegment.sourceSegmentIds || []);
  const relevantSegments = sourceIds.size
    ? episode.segments.filter((segment) => sourceIds.has(segment.id))
    : episode.segments.filter((segment) => segment.start < renderSegment.end && segment.end > renderSegment.start);
  const characterIds = new Set(relevantSegments.flatMap((segment) => segment.characterIds));
  const urls = project.characters
    .filter((character) => characterIds.has(character.id))
    .flatMap((character) => character.references || [])
    .map((reference) => reference.url)
    .filter((url): url is string => Boolean(url));
  return [...new Set(urls)].slice(0, 8);
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
    { category: "VIDEO_GENERATION", label: "Video Generation", estimatedCredits: videoCredits, included: videoCredits === 0 },
  ];
}

async function processAgentStage(run: AgentRunRecord, job: AgentQueueJobRecord) {
  const input = inputOf(run);
  const project = input.project;
  const state = stateOf(run);
  const episodeIndex = episodeIndexOf(run, input, state);
  const episode = project?.episodes?.[episodeIndex];
  if (!project || !episode) throw new Error("AGENT_EPISODE_NOT_FOUND");
  await ensureEpisodeWorkflow({ runId: run.id, projectId: project.id, episodeId: episode.id, episodeIndex, maxAttempts: getAgentPolicy().maxRetriesPerStep + 1 });

  run.status = "RUNNING";
  run.startedAt ||= new Date();

  if (run.stage === "PLAN_STORY") {
    await runSpecialistStage({ run, project, episodeIndex, role: "AI_PRODUCER", nextStage: "STORY_ARCHITECT" });
    return;
  }

  if (run.stage === "STORY_ARCHITECT") {
    await runSpecialistStage({ run, project, episodeIndex, role: "STORY_ARCHITECT", nextStage: "SCRIPT_WRITE" });
    return;
  }

  if (run.stage === "SCRIPT_WRITE") {
    await runSpecialistStage({ run, project, episodeIndex, role: "SCRIPT_WRITER", nextStage: "SCRIPT_EDIT" });
    return;
  }

  if (run.stage === "SCRIPT_EDIT") {
    const stage = run.stage;
    assertAgentToolAllowed({ run, tool: "edit_script" });
    await startWorkflowStageTask(run.id, episodeIndex, stage);
    const result = await executeRoleAgent({ role: "SCRIPT_EDITOR", run, project, episode, episodeIndex, stage });
    const completed = await completeWorkflowStageTask({
      runId: run.id, episodeIndex, stage, summary: result.artifact.summary, content: result.artifact,
      review: { reviewerAgentKey: "SCRIPT_EDITOR", verdict: result.artifact.verdict, score: result.artifact.confidence, summary: result.artifact.summary, issues: result.artifact.issues },
    });
    await recordAgentDecision({ runId: run.id, stage, action: "SCRIPT_REVIEW_COMPLETED", reason: result.artifact.summary, metadata: { source: result.source, modelId: result.modelId, artifactId: completed.artifact.id, verdict: result.artifact.verdict, issues: result.artifact.issues } });
    if (result.artifact.verdict === "BLOCKED") {
      await pauseAgentRun(run, result.artifact.issues.join("; ") || "Script Editor พบ Blocker ที่ต้องให้ผู้ใช้ตัดสินใจ");
      return;
    }
    if (result.artifact.verdict === "REVISE") {
      const revisionKey = String(episodeIndex);
      const revisions = Number(state.scriptRevisionCounts?.[revisionKey] || 0) + 1;
      state.scriptRevisionCounts = { ...(state.scriptRevisionCounts || {}), [revisionKey]: revisions };
      run.stateJson = state as Record<string, unknown>;
      if (revisions > 2) {
        await pauseAgentRun(run, "บทถูกส่งกลับเกิน 2 รอบ จึงหยุดให้ผู้ใช้ตรวจเพื่อป้องกัน Agent Loop");
        return;
      }
      await returnWorkflowToStage({ runId: run.id, episodeIndex, fromStage: stage, toStage: "SCRIPT_WRITE", artifactId: completed.artifact.id, reason: result.artifact.issues.join("; ") || "Script Editor ขอแก้บท" });
      run.stage = "SCRIPT_WRITE";
      await persistAndQueue(run, episodeIndex);
      return;
    }
    run.stage = "DIRECT_SCENES";
    await persistAndQueue(run, episodeIndex);
    return;
  }

  if (run.stage === "DIRECT_SCENES") {
    await runSpecialistStage({ run, project, episodeIndex, role: "AI_DIRECTOR", nextStage: "PLAN_CINEMATOGRAPHY" });
    return;
  }

  if (run.stage === "PLAN_CINEMATOGRAPHY") {
    await runSpecialistStage({ run, project, episodeIndex, role: "CINEMATOGRAPHER", nextStage: "SELECT_STYLE" });
    return;
  }

  if (run.stage === "SELECT_STYLE") {
    await startWorkflowStageTask(run.id, episodeIndex, run.stage);
    assertAgentToolAllowed({ run, tool: "select_style" });
    state.selectedStyle = project.styleId || "AUTO_FROM_PROJECT";
    run.stateJson = state as Record<string, unknown>;
    const styleReason = project.styleId ? "ใช้ Style Lock ที่ผู้ใช้กำหนดไว้" : "ไม่มี Style Lock จึงคงโหมด Auto จาก Project Bible";
    await completeWorkflowStageTask({ runId: run.id, episodeIndex, stage: run.stage, summary: styleReason, content: { summary: styleReason, verdict: "PASS", confidence: 100, decisions: [styleReason], issues: [], payload: { style: state.selectedStyle, locked: Boolean(project.styleId) } } });
    await recordAgentDecision({ runId: run.id, stage: run.stage, action: "STYLE_SELECTED", reason: styleReason, metadata: { style: state.selectedStyle } });
    run.stage = "BUILD_PROMPTS";
    await persistAndQueue(run, episodeIndex);
    return;
  }

  if (run.stage === "BUILD_PROMPTS") {
    await startWorkflowStageTask(run.id, episodeIndex, run.stage);
    assertAgentToolAllowed({ run, tool: "improve_prompt" });
    const userProviders = await getUserVideoProviderMap(run.userId);
    const planned = await planGeneration(project, episodeIndex, { promptContext: { userId: run.userId, runId: run.id }, providers: userProviders });
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
      await failWorkflowStageTask(run.id, episodeIndex, "BUILD_PROMPTS", run.stopReason);
      return;
    }

    const promptSummary = `Prompt Composer เตรียม ${planned.jobs.length} Render Jobs มูลค่าประมาณ ${run.estimatedSpendThb.toFixed(2)} THB`;
    await completeWorkflowStageTask({
      runId: run.id,
      episodeIndex,
      stage: run.stage,
      summary: promptSummary,
      content: { summary: promptSummary, verdict: "PASS", confidence: 95, decisions: ["ใช้ Prompt Bundle ที่ผ่าน User Lock และ Provider Planning"], issues: [], payload: { promptBundle: planned.promptBundle, renderJobs: planned.jobs, estimatedTotalThb: planned.estimatedTotalThb, quoteId: state.costQuoteIds?.[String(episodeIndex)] } },
    });
    await recordAgentDecision({ runId: run.id, stage: run.stage, action: "PROMPT_PLAN_READY", reason: promptSummary, metadata: { estimatedSpendThb: run.estimatedSpendThb, quoteId: state.costQuoteIds?.[String(episodeIndex)] } });
    run.stage = "STORYBOARD";
    await persistAndQueue(run, episodeIndex);
    return;
  }

  if (run.stage === "STORYBOARD") {
    const stage = run.stage;
    const specialist = await runSpecialistStage({ run, project, episodeIndex, role: "STORYBOARD_ARTIST", nextStage: "AWAIT_APPROVAL", queueNext: false });
    if (!specialist.continued) return;
    const requireApproval = process.env.SCENOVA_REQUIRE_RENDER_APPROVAL !== "false" || run.estimatedSpendThb > run.approvalThresholdThb;
    if (!requireApproval) {
      run.stage = "GENERATE";
      await persistAndQueue(run, episodeIndex);
      return;
    }
    assertAgentToolAllowed({ run: { ...run, stage }, tool: "request_approval" });
    const summary = `ตรวจ Storyboard และอนุมัติงบประมาณประมาณ ${run.estimatedSpendThb.toFixed(2)} THB ก่อนเริ่ม Render`;
    await requestAgentApproval({ runId: run.id, estimatedCostThb: run.estimatedSpendThb, summary });
    await requestHumanCheckpoint({ runId: run.id, episodeIndex, stage, kind: "VISUAL_AND_RENDER_APPROVAL", summary, payload: { estimatedSpendThb: run.estimatedSpendThb, quoteId: state.costQuoteIds?.[String(episodeIndex)], storyboardArtifactId: specialist.completed.artifact.id } });
    run.status = "WAITING_APPROVAL";
    run.stage = "AWAIT_APPROVAL";
    run.stopReason = "รอผู้ใช้อนุมัติ Storyboard และงบประมาณก่อน Generate";
    await saveAgentRun(run);
    await recordAgentDecision({ runId: run.id, stage: "AWAIT_APPROVAL", action: "HUMAN_CHECKPOINT", reason: run.stopReason, metadata: { estimatedSpendThb: run.estimatedSpendThb, quoteId: state.costQuoteIds?.[String(episodeIndex)] } });
    return;
  }

  if (run.stage === "AWAIT_APPROVAL") {
    run.status = "WAITING_APPROVAL";
    await saveAgentRun(run);
    return;
  }

  if (run.stage === "GENERATE") {
    await startWorkflowStageTask(run.id, episodeIndex, run.stage);
    const decision = await brainDecision(run, project, episodeIndex, job.attempts);
    if (await honorPauseDecision(run, decision)) return;

    if (decision.tool === "switch_provider") {
      assertAgentToolAllowed({ run, tool: "switch_provider" });
      const currentSelection = await selectUserVideoProvider(run.userId, project.mainModelId, state.selectedProviderId || null);
      const current = state.selectedProviderId || currentSelection.provider.id;
      const alternate = await resolveUserAlternateProvider(run.userId, current, project.mainModelId);
      if (!alternate) {
        await pauseAgentRun(run, "Agent ขอเปลี่ยน Provider แต่ยังไม่มี Alternate Provider ที่เชื่อมต่อพร้อมใช้งาน");
        return;
      }
      state.selectedProviderId = alternate.provider.id;
      state.providerSwitches = Number(state.providerSwitches || 0) + 1;
      run.stateJson = state as Record<string, unknown>;
      await recordAgentDecision({ runId: run.id, stage: run.stage, action: "PROVIDER_SWITCH", reason: alternate.reason, providerId: alternate.provider.id });
    }

    const selection = await selectUserVideoProvider(run.userId, project.mainModelId, state.selectedProviderId || null);
    const provider = selection.provider;
    state.selectedProviderId = provider.id;
    const renderPlan = planEpisodeRender(project, episode);
    await ensureRenderShotTasks({
      runId: run.id,
      episodeIndex,
      shots: renderPlan.map((segment) => ({ order: segment.order, start: segment.start, end: segment.end, modelId: segment.modelId })),
      maxAttempts: getAgentPolicy().maxRetriesPerStep + 1,
    });
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
      await startRenderShotTask(run.id, episodeIndex, renderSegment.order);
      const existingIndex = outputs.findIndex((output) => output.order === renderSegment.order && output.status !== "failed");
      let output = existingIndex >= 0 ? outputs[existingIndex] : undefined;
      const requestBase: Omit<GenerateVideoRequest, "idempotencyKey"> = {
        projectId: project.id,
        episodeId: episode.id,
        modelVersionId: project.mainModelVersionId,
        renderSegment,
        prompt,
        resolution: project.resolution,
        aspectRatio: project.aspectRatio,
        imageReferences: provider.getModelDefinition().supportsImageReference
          ? imageReferencesForRenderSegment(project, episode, renderSegment)
          : [],
        videoReferences: [],
        audioReferences: [],
      };

      if (output?.providerTaskId && ["queued", "generating"].includes(output.status)) {
        const currentProvider = await getUserVideoProviderById(run.userId, output.providerId);
        if (!currentProvider) throw new Error(`PROVIDER_CONNECTION_REQUIRED:${output.providerId}`);
        const status = await currentProvider.getStatus(output.providerTaskId);
        output = {
          ...output,
          billingMode: output.billingMode || currentProvider.billingMode,
          status: status.status,
          outputUrl: status.outputUrl,
          lastFrameUrl: status.lastFrameUrl,
          error: status.error,
        };
        outputs[existingIndex] = output;
        const outputUsesWallet = output.billingMode === "SYSTEM" && output.providerId !== "mock-seedance";
        if (output.status === "failed") {
          if (output.reservationId && outputUsesWallet) await wallet.refund(output.reservationId, output.error || "Provider failed");
          await failRenderShotTask(run.id, episodeIndex, renderSegment.order, output.error || "Provider failed");
          throw new Error(`PROVIDER_FAILED:${output.providerId}:${output.error || "unknown"}`);
        }
        if (output.status === "completed" && !output.settled) {
          if (output.reservationId && outputUsesWallet) {
            await wallet.charge(output.reservationId, output.reservedCredits);
            run.actualSpendThb += output.estimatedCostThb;
          }
          output.settled = true;
          outputs[existingIndex] = output;
          await completeRenderShotTask({ runId: run.id, episodeIndex, order: renderSegment.order, summary: `Render Shot ${renderSegment.order} สำเร็จ`, output: { ...output } });
          await recordAgentDecision({ runId: run.id, stage: run.stage, action: "PROVIDER_COMPLETED", reason: `Provider ส่งผลลัพธ์ Render Segment ${renderSegment.order} สำเร็จ`, providerId: output.providerId, metadata: { order: renderSegment.order, billingMode: output.billingMode, estimatedCostThb: output.estimatedCostThb, credits: output.reservedCredits || 0 } });
        } else if (output.status !== "completed") {
          pending = true;
        }
        continue;
      }
      if (output?.status === "completed") {
        await completeRenderShotTask({ runId: run.id, episodeIndex, order: renderSegment.order, summary: `Render Shot ${renderSegment.order} สำเร็จ`, output: { ...output } });
        continue;
      }

      const estimate = await provider.estimateCost({ ...requestBase, idempotencyKey: `estimate:${run.id}:${episode.id}:${renderSegment.order}` });
      const isMock = provider.id === "mock-seedance";
      const billingMode: ProviderBillingMode = isMock ? "MOCK" : provider.billingMode || "SYSTEM";
      const usesWallet = billingMode === "SYSTEM" && !isMock;
      const attempt = outputs.filter((item) => item.order === renderSegment.order).reduce((max, item) => Math.max(max, item.attempt), 0) + 1;
      const reservedCredits = usesWallet ? Math.max(1, creditsFromThb(estimate.estimatedAmount)) : 0;
      let reservationId = `${billingMode.toLowerCase()}-reservation:${run.id}:${episode.id}:${renderSegment.order}:attempt:${attempt}`;
      if (usesWallet) {
        const reservation = await wallet.reserve({
          userId: run.userId,
          credits: reservedCredits,
          purpose: "video",
          category: attempt > 1 ? "VIDEO_RETRY" : "VIDEO_GENERATION",
          quoteId,
          referenceId: `${run.id}:${episode.id}:${renderSegment.order}:attempt:${attempt}`,
          idempotencyKey: `video:${run.id}:${episode.id}:${renderSegment.order}:${provider.id}:attempt:${attempt}`,
          metadata: { runId: run.id, projectId: project.id, episodeId: episode.id, order: renderSegment.order, attempt, providerId: provider.id, billingMode },
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
        creditReservationMode: isMock ? "mock" : billingMode === "BYOK" ? "byok" : "wallet",
      });

      const idempotencyKey = `agent:${run.id}:${episode.id}:${renderSegment.order}:attempt:${attempt}`;
      const placeholder: GenerationOutput = { order: renderSegment.order, attempt, providerId: provider.id, billingMode, status: "submitting", estimatedCostThb: estimate.estimatedAmount, reservationId, reservedCredits };
      outputs.push(placeholder);
      state.outputsByEpisode = { ...(state.outputsByEpisode || {}), [String(episodeIndex)]: outputs };
      run.stateJson = state as Record<string, unknown>;
      await saveAgentRun(run);

      try {
        const task = await provider.generate({ ...requestBase, idempotencyKey });
        const index = outputs.indexOf(placeholder);
        outputs[index] = { ...placeholder, providerTaskId: task.providerTaskId, status: task.status, outputUrl: task.outputUrl, lastFrameUrl: task.lastFrameUrl, error: task.error };
        if (isMock) simulatedCost += estimate.estimatedAmount;
        const reservationLabel = billingMode === "BYOK" ? "BYOK โดยไม่หักค่า Provider จาก SCENOVA Wallet" : usesWallet ? "Wallet Reservation จริง" : "Mock Reservation";
        await recordAgentDecision({ runId: run.id, stage: run.stage, action: attempt > 1 ? "RETRY_SEGMENT" : "GENERATE_SEGMENT", reason: `${selection.reason}; ผ่าน Tool Guardrail และ ${reservationLabel}`, providerId: provider.id, metadata: { order: renderSegment.order, attempt, billingMode, estimatedCostThb: estimate.estimatedAmount, reservedCredits, quoteId } });
        if (task.status === "completed") {
          if (usesWallet) {
            await wallet.charge(reservationId, reservedCredits);
            run.actualSpendThb += estimate.estimatedAmount;
          }
          outputs[index].settled = true;
          await completeRenderShotTask({ runId: run.id, episodeIndex, order: renderSegment.order, summary: `Render Shot ${renderSegment.order} สำเร็จ`, output: { ...outputs[index] } });
        } else if (task.status === "failed") {
          if (usesWallet) await wallet.refund(reservationId, task.error || "Provider rejected generation");
          await failRenderShotTask(run.id, episodeIndex, renderSegment.order, task.error || "Provider rejected generation");
          throw new Error(`PROVIDER_FAILED:${provider.id}:${task.error || "unknown"}`);
        } else {
          pending = true;
        }
      } catch (error) {
        if (usesWallet) await wallet.refund(reservationId, error instanceof Error ? error.message : String(error)).catch(() => undefined);
        placeholder.status = "failed";
        placeholder.error = error instanceof Error ? error.message : String(error);
        await failRenderShotTask(run.id, episodeIndex, renderSegment.order, placeholder.error);
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
    const renderSummary = `Render Operator ส่งมอบ ${outputs.filter((output) => output.status === "completed").length}/${renderPlan.length} คลิป`;
    await completeWorkflowStageTask({
      runId: run.id, episodeIndex, stage: run.stage, summary: renderSummary,
      content: { summary: renderSummary, verdict: outputs.every((output) => output.status === "completed") ? "PASS" : "BLOCKED", confidence: 100, decisions: ["คิดค่าใช้จ่ายและปิด Reservation ตามผล Provider จริง"], issues: outputs.filter((output) => output.status !== "completed").map((output) => `Shot ${output.order}: ${output.error || output.status}`), payload: { providerId: state.selectedProviderId, outputs, simulatedCostThb: simulatedCost, actualSpendThb: run.actualSpendThb } },
    });
    run.stage = "VERIFY_CONTINUITY";
    await persistAndQueue(run, episodeIndex);
    return;
  }

  if (run.stage === "VERIFY_CONTINUITY") {
    await startWorkflowStageTask(run.id, episodeIndex, run.stage);
    const decision = await brainDecision(run, project, episodeIndex, job.attempts);
    if (await honorPauseDecision(run, decision)) return;
    assertAgentToolAllowed({ run, tool: "verify_continuity" });
    const outputs = state.outputsByEpisode?.[String(episodeIndex)] || [];
    const report = verifyProductionContinuity({ project, episode, outputs: outputs.map((output) => ({ ...output })) });
    state.continuityScore = report.score;
    state.continuityReports = { ...(state.continuityReports || {}), [String(episodeIndex)]: report };
    run.stateJson = state as Record<string, unknown>;
    const continuitySummary = report.passed ? `Continuity ผ่านด้วยคะแนน ${report.score}/100` : `Continuity พบประเด็นที่ต้องตรวจสอบ คะแนน ${report.score}/100`;
    const continuityArtifact = await completeWorkflowStageTask({
      runId: run.id, episodeIndex, stage: run.stage, summary: continuitySummary,
      content: { summary: continuitySummary, verdict: report.passed ? "PASS" : "REVISE", confidence: report.score, decisions: ["ตรวจ Character, Canon, Location, Camera, Lighting และ Timeline"], issues: report.issues.map((issue) => `${issue.category}: ${issue.message}`), payload: report },
      review: { reviewerAgentKey: "CONTINUITY_SUPERVISOR", verdict: report.passed ? "PASS" : "REVISE", score: report.score, summary: continuitySummary, issues: report.issues.map((issue) => issue.message) },
    });
    await recordAgentDecision({ runId: run.id, stage: run.stage, action: "CONTINUITY_CHECK", reason: continuitySummary, metadata: { ...report, artifactId: continuityArtifact.artifact.id } });
    if (!report.passed) {
      await pauseAgentRun(run, "Continuity verification ไม่ผ่าน — ต้องตรวจ Character/Canon/Location/Camera หรือผลลัพธ์ที่ขาดก่อน Resume");
      return;
    }
    const quoteId = state.costQuoteIds?.[String(episodeIndex)];
    if (quoteId) await settleCostQuote(quoteId, run.userId);
    run.stage = "POST_PRODUCTION";
    await persistAndQueue(run, episodeIndex);
    return;
  }

  if (run.stage === "POST_PRODUCTION") {
    await runSpecialistStage({ run, project, episodeIndex, role: "POST_PRODUCTION_SUPERVISOR", nextStage: "FINAL_QUALITY" });
    return;
  }

  if (run.stage === "FINAL_QUALITY") {
    await runSpecialistStage({ run, project, episodeIndex, role: "QUALITY_CONTROLLER", nextStage: "NEXT_EPISODE" });
    return;
  }

  if (run.stage === "NEXT_EPISODE") {
    await startWorkflowStageTask(run.id, episodeIndex, run.stage);
    const decision = await brainDecision(run, project, episodeIndex, job.attempts);
    if (await honorPauseDecision(run, decision)) return;
    const completed = Array.from(new Set([...(state.completedEpisodes || []), episodeIndex]));
    state.completedEpisodes = completed;
    const startIndex = Number(state.startEpisodeIndex || 0);
    const processedCount = episodeIndex - startIndex + 1;
    const nextIndex = episodeIndex + 1;
    const handoffSummary = `AI Producer รับรองการส่งมอบ Episode ${episodeIndex + 1}`;
    await completeWorkflowStageTask({ runId: run.id, episodeIndex, stage: run.stage, summary: handoffSummary, content: { summary: handoffSummary, verdict: "PASS", confidence: 100, decisions: ["บันทึก Episode เป็นงานที่ผ่าน Workflow ครบทุกฝ่าย"], issues: [], payload: { episodeId: episode.id, completedEpisodes: completed, continuityScore: state.continuityScore, actualSpendThb: run.actualSpendThb } } });
    if (processedCount < run.maxEpisodes && project.episodes[nextIndex]) {
      state.currentEpisodeIndex = nextIndex;
      run.stateJson = state as Record<string, unknown>;
      run.planJson = null;
      run.stage = "PLAN_STORY";
      await ensureEpisodeWorkflow({ runId: run.id, projectId: project.id, episodeId: project.episodes[nextIndex].id, episodeIndex: nextIndex, maxAttempts: getAgentPolicy().maxRetriesPerStep + 1 });
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
    await completeWorkflow(run.id);
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
      const failedEpisodeIndex = episodeIndexOf(run, inputOf(run), state);
      await failWorkflowStageTask(run.id, failedEpisodeIndex, run.stage, message).catch(() => undefined);
      await recordAgentDecision({ runId: run.id, stage: run.stage, action: `RECOVERY_${recovery.action}`, reason: recovery.reason, metadata: { error: message, attempt: job.attempts } });
      if (recovery.action === "ASK_USER") { await pauseAgentRun(run, recovery.reason); await completeAgentJob(job.id); return true; }
      if (recovery.action === "SWITCH_PROVIDER") {
        const project = inputOf(run).project;
        const currentSelection = await selectUserVideoProvider(run.userId, project.mainModelId, state.selectedProviderId || null).catch(() => null);
        const current = state.selectedProviderId || currentSelection?.provider.id || "";
        const alternate = await resolveUserAlternateProvider(run.userId, current, project.mainModelId);
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
        await pauseAgentRun(run, "Provider ใช้งานไม่ได้และไม่มี Alternate Provider ที่เชื่อมต่อพร้อมใช้งาน");
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
