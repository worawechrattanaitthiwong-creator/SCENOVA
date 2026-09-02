import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { resolveSession } from "@/lib/auth-core";
import { getAgentRunForUser, recordAgentDecision } from "@/lib/agent/store";
import { listUserApiConnections } from "@/lib/api-connections/store";
import { getPublicProviderCatalog } from "@/lib/api-connections/providers";
import { VIDEO_MODELS } from "@/lib/catalogs";
import type { Project } from "@/lib/domain";
import { getVideoModelVersions } from "@/lib/video-model-versions";
import { prisma } from "@/lib/db";
import { planEpisodeRender } from "@/lib/render-planner";
import { episodeScopeKey } from "@/lib/agent/contracts";
import type { AgentStage } from "@/lib/agent/types";
import { compatibleRenderOrders, safeVideoModelRestartStage } from "@/lib/agent/model-switch";
import { getUserVideoProviderById } from "@/lib/providers/provider-registry";
import { PrismaWalletService } from "@/lib/wallet";

export const runtime = "nodejs";

type PersistedOutput = {
  order: number;
  attempt?: number;
  providerId?: string;
  providerTaskId?: string;
  reservationId?: string;
  reservedCredits?: number;
  billingMode?: string;
  settled?: boolean;
  status?: string;
  estimatedCostThb?: number;
  outputUrl?: string;
  lastFrameUrl?: string;
  error?: string;
};

type ModelSwitchState = {
  currentEpisodeIndex?: number;
  startEpisodeIndex?: number;
  selectedProviderId?: string | null;
  providerSwitches?: number;
  resumeStage?: AgentStage;
  outputsByEpisode?: Record<string, PersistedOutput[]>;
  plannedCosts?: Record<string, number>;
  costQuoteIds?: Record<string, string>;
  continuityReports?: Record<string, unknown>;
  continuityScore?: number;
  brainDecisions?: Record<string, unknown>;
  [key: string]: unknown;
};

function providerIdForModel(modelId: string) {
  if (modelId === "seedance-2-5") return "seedance";
  return modelId;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function modelEnabledOnConnection(enabledModelIds: string[], defaultModelId: string | null, modelId: string) {
  if (!enabledModelIds.length) return !defaultModelId || defaultModelId === modelId;
  return enabledModelIds.includes(modelId);
}

function episodeIndexOf(state: ModelSwitchState) {
  return typeof state.currentEpisodeIndex === "number" ? state.currentEpisodeIndex : Number(state.startEpisodeIndex || 0);
}

function withoutEpisodeKey<T>(source: Record<string, T> | undefined, episodeIndex: number) {
  const next = { ...(source || {}) };
  delete next[String(episodeIndex)];
  return next;
}

function withoutEpisodeBrainDecisions(source: Record<string, unknown> | undefined, episodeIndex: number) {
  const next = { ...(source || {}) };
  for (const key of Object.keys(next)) {
    if (key.startsWith(`${episodeIndex}:`)) delete next[key];
  }
  return next;
}

function outputIsActive(output: PersistedOutput) {
  return ["submitting", "queued", "generating"].includes(String(output.status || ""));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await context.params;
  const run = await getAgentRunForUser(id, user.id);
  if (!run) return NextResponse.json({ error: "AGENT_RUN_NOT_FOUND" }, { status: 404 });
  if (run.status === "COMPLETED" || run.stage === "COMPLETED") {
    return NextResponse.json({
      error: "งานนี้เสร็จสมบูรณ์แล้ว หากต้องการใช้โมเดลอื่นให้เริ่มงานรอบใหม่",
      code: "AGENT_RUN_ALREADY_COMPLETED",
    }, { status: 409 });
  }
  if (!["PAUSED", "FAILED", "CANCELLED"].includes(run.status)) {
    return NextResponse.json({
      error: "กรุณาพักหรือยกเลิกงานก่อนเปลี่ยนโมเดล เพื่อไม่ให้ Worker และ Provider เดิมทำงานทับกัน",
      code: "AGENT_RUN_MUST_BE_STOPPED",
    }, { status: 409 });
  }

  const body = await request.json().catch(() => ({})) as { modelId?: string; modelVersionId?: string };
  const modelId = String(body.modelId || "").trim();
  const model = VIDEO_MODELS.find((item) => item.id === modelId && item.enabled);
  if (!model) return NextResponse.json({ error: "ไม่พบโมเดลวิดีโอที่เลือก", code: "VIDEO_MODEL_INVALID" }, { status: 400 });

  const versions = getVideoModelVersions(model.name);
  const requestedVersion = String(body.modelVersionId || "").trim();
  const version = versions.find((item) => item.apiModelId === requestedVersion || item.id === requestedVersion)
    || versions.find((item) => item.recommended)
    || versions[0];
  if (!version) return NextResponse.json({ error: "โมเดลนี้ยังไม่มีรุ่นที่พร้อมใช้งาน", code: "VIDEO_MODEL_VERSION_INVALID" }, { status: 400 });

  const providerId = providerIdForModel(model.id);
  const [connections, catalog] = await Promise.all([
    listUserApiConnections(user.id),
    Promise.resolve(getPublicProviderCatalog()),
  ]);
  const provider = catalog.find((item) => item.kind === "VIDEO" && item.id === providerId);
  const providerConnections = connections.filter((item) => item.kind === "VIDEO" && item.provider === providerId && item.enabled && item.status === "CONNECTED");
  const connected = providerConnections.some((item) => modelEnabledOnConnection(item.enabledModelIds, item.modelId, version.apiModelId));
  const ready = Boolean(provider?.ready && (connected || provider.systemConfigured));
  if (!ready) {
    return NextResponse.json({
      error: providerConnections.length
        ? `${model.name} เชื่อมต่อแล้ว แต่รุ่น ${version.label} ยังไม่ได้เปิดใช้ใน API & Models`
        : `${model.name} ยังไม่พร้อมใช้งาน กรุณาเชื่อมต่อและทดสอบ Provider ใน API & Models ก่อน`,
      code: providerConnections.length ? "VIDEO_MODEL_VERSION_NOT_ENABLED" : "VIDEO_MODEL_NOT_READY",
      providerId,
      modelVersionId: version.apiModelId,
    }, { status: 409 });
  }

  const input = run.inputJson && typeof run.inputJson === "object" && !Array.isArray(run.inputJson)
    ? run.inputJson as { project?: Project; [key: string]: unknown }
    : {};
  if (!input.project) return NextResponse.json({ error: "ไม่พบรายละเอียดโปรเจกต์เดิมของงานนี้", code: "AGENT_PROJECT_NOT_FOUND" }, { status: 409 });

  const state = { ...((run.stateJson || {}) as ModelSwitchState) };
  const episodeIndex = episodeIndexOf(state);
  const episode = input.project.episodes?.[episodeIndex];
  if (!episode) return NextResponse.json({ error: "ไม่พบ Episode ปัจจุบันของงานนี้", code: "AGENT_EPISODE_NOT_FOUND" }, { status: 409 });
  const scopeKey = episodeScopeKey(episodeIndex);

  const primaryTasks = await prisma.agentTask.findMany({
    where: { runId: run.id, scopeKey, stage: { not: "GENERATE_SHOT" } },
    orderBy: { sequence: "asc" },
  });
  const failedTaskStage = run.stage === "FAILED"
    ? primaryTasks.find((task) => task.status !== "COMPLETED")?.stage as AgentStage | undefined
    : undefined;
  const restartStage = safeVideoModelRestartStage(run.stage, failedTaskStage);
  const mustRebuildGenerationPlan = restartStage === "BUILD_PROMPTS";

  const previousModelId = input.project.mainModelId;
  const previousVersionId = input.project.mainModelVersionId || null;
  const nextProject: Project = {
    ...input.project,
    mainModelId: model.id,
    mainModelVersionId: version.apiModelId,
  };
  const nextInput = { ...input, project: nextProject };

  const previousOutputs = state.outputsByEpisode?.[String(episodeIndex)] || [];
  let retainedOutputs = previousOutputs;
  let compatibleOrders = new Set<number>();
  const cancelledOldProviderOrders: number[] = [];
  const drainingOldProviderOrders: number[] = [];
  const supersededOutputOrders: number[] = [];
  const previousRenderPlan = planEpisodeRender(input.project, episode);
  const nextRenderPlan = planEpisodeRender(nextProject, episode);

  if (mustRebuildGenerationPlan) {
    compatibleOrders = compatibleRenderOrders(previousRenderPlan, nextRenderPlan);

    const unknownSubmitting = previousOutputs.find((output) => outputIsActive(output) && !output.providerTaskId);
    if (unknownSubmitting) {
      return NextResponse.json({
        error: `Shot ${unknownSubmitting.order} ยังอยู่ระหว่างส่งไป Provider และยังไม่มี Task ID ยืนยัน กรุณารอสถานะให้ชัดเจนก่อนเปลี่ยนโมเดลเพื่อป้องกันการคิดเงินซ้ำ`,
        code: "MODEL_SWITCH_PROVIDER_SUBMISSION_UNCONFIRMED",
        order: unknownSubmitting.order,
      }, { status: 409 });
    }

    const wallet = new PrismaWalletService();
    const nextOutputs: PersistedOutput[] = [];
    for (const output of previousOutputs) {
      const compatible = compatibleOrders.has(output.order);
      if (output.status === "completed") {
        if (compatible) nextOutputs.push(output);
        else supersededOutputOrders.push(output.order);
        continue;
      }

      if (outputIsActive(output) && output.providerTaskId && output.providerId) {
        const oldProvider = await getUserVideoProviderById(run.userId, output.providerId);
        if (!oldProvider) {
          return NextResponse.json({
            error: `Shot ${output.order} ยังทำงานอยู่กับ ${output.providerId} แต่ Connection เดิมไม่พร้อม จึงยังเปลี่ยนโมเดลอย่างปลอดภัยไม่ได้`,
            code: "MODEL_SWITCH_ACTIVE_PROVIDER_UNAVAILABLE",
            order: output.order,
            providerId: output.providerId,
          }, { status: 409 });
        }
        const cancelled = await oldProvider.cancel(output.providerTaskId).catch(() => false);
        if (cancelled) {
          if (output.billingMode === "SYSTEM" && output.reservationId && !output.settled) {
            await wallet.refund(output.reservationId, "Video model changed before provider completion");
          }
          cancelledOldProviderOrders.push(output.order);
          supersededOutputOrders.push(output.order);
          continue;
        }
        if (!compatible) {
          return NextResponse.json({
            error: `Shot ${output.order} ยังทำงานกับ Provider เดิมและยกเลิกไม่ได้ อีกทั้งช่วงเวลาของ Shot เปลี่ยนเมื่อใช้โมเดลใหม่ จึงหยุดการสลับเพื่อป้องกันการเสียเงินซ้ำ`,
            code: "MODEL_SWITCH_ACTIVE_PROVIDER_CANNOT_CANCEL",
            order: output.order,
            providerId: output.providerId,
          }, { status: 409 });
        }
        nextOutputs.push(output);
        drainingOldProviderOrders.push(output.order);
        continue;
      }

      supersededOutputOrders.push(output.order);
    }
    retainedOutputs = nextOutputs;
  }

  const nextState: ModelSwitchState = {
    ...state,
    selectedProviderId: null,
    providerSwitches: 0,
  };
  let nextEstimatedSpendThb = run.estimatedSpendThb;
  if (mustRebuildGenerationPlan) {
    nextState.outputsByEpisode = { ...(state.outputsByEpisode || {}), [String(episodeIndex)]: retainedOutputs };
    nextState.plannedCosts = withoutEpisodeKey(state.plannedCosts, episodeIndex);
    nextState.costQuoteIds = withoutEpisodeKey(state.costQuoteIds, episodeIndex);
    nextState.continuityReports = withoutEpisodeKey(state.continuityReports, episodeIndex);
    delete nextState.continuityScore;
    nextState.brainDecisions = withoutEpisodeBrainDecisions(state.brainDecisions, episodeIndex);
    nextEstimatedSpendThb = Object.values(nextState.plannedCosts || {}).reduce((sum, amount) => sum + Number(amount || 0), 0);
  }

  const nextStatus = run.status === "CANCELLED"
    ? "CANCELLED"
    : run.status === "FAILED" && !mustRebuildGenerationPlan
      ? "FAILED"
      : "PAUSED";
  if (nextStatus === "PAUSED") nextState.resumeStage = restartStage;
  else delete nextState.resumeStage;
  const nextStopReason = nextStatus === "CANCELLED"
    ? "เปลี่ยนโมเดลแล้ว งานยังคงอยู่ในสถานะยกเลิกจนกว่าจะเรียกกลับมา"
    : nextStatus === "FAILED"
      ? run.stopReason
      : `เปลี่ยนโมเดลเป็น ${model.name} · ${version.label} แล้ว พร้อมทำต่อจากขั้น ${restartStage}`;

  const restartTask = primaryTasks.find((task) => task.stage === restartStage) || null;
  const resetPrimaryTasks = mustRebuildGenerationPlan && restartTask
    ? primaryTasks.filter((task) => task.sequence >= restartTask.sequence)
    : [];
  const shotTasks = mustRebuildGenerationPlan
    ? await prisma.agentTask.findMany({
        where: { runId: run.id, stage: "GENERATE_SHOT", scopeKey: { startsWith: `${scopeKey}:shot:` } },
        orderBy: { sequence: "asc" },
      })
    : [];
  const retainedOrders = new Set(retainedOutputs.map((output) => output.order));
  const nextPlanByOrder = new Map(nextRenderPlan.map((segment) => [segment.order, segment]));
  const shotTaskOrder = (task: (typeof shotTasks)[number]) => {
    const inputJson = task.inputJson && typeof task.inputJson === "object" && !Array.isArray(task.inputJson)
      ? task.inputJson as Record<string, unknown>
      : {};
    const order = Number(inputJson.order || task.sequence - 1000);
    return Number.isFinite(order) ? order : task.sequence - 1000;
  };
  const supersededPrimaryTaskIds = resetPrimaryTasks.map((task) => task.id);
  const supersededShotTaskIds = shotTasks
    .filter((task) => !retainedOrders.has(shotTaskOrder(task)))
    .map((task) => task.id);
  const supersededTaskIds = [...supersededPrimaryTaskIds, ...supersededShotTaskIds];

  const inputJson = JSON.stringify(nextInput);
  const stateJson = JSON.stringify(nextState);
  const planJson = mustRebuildGenerationPlan ? null : run.planJson === null ? null : JSON.stringify(run.planJson);
  const nextFinishedAt = nextStatus === "CANCELLED" ? run.finishedAt : nextStatus === "FAILED" ? run.finishedAt : null;

  await prisma.$transaction(async (tx) => {
    if (mustRebuildGenerationPlan) {
      await tx.agentQueueJob.updateMany({
        where: { runId: run.id, status: { in: ["QUEUED", "RUNNING"] } },
        data: {
          status: "FAILED",
          lastError: "SUPERSEDED_BY_VIDEO_MODEL_CHANGE",
          lockedAt: null,
          lockedBy: null,
          heartbeatAt: null,
          leaseExpiresAt: null,
        },
      });
      if (run.status !== "CANCELLED") {
        await tx.agentWorkflow.updateMany({ where: { runId: run.id }, data: { status: "ACTIVE" } });
      }
      if (restartTask) {
        await tx.agentTask.updateMany({
          where: { id: { in: resetPrimaryTasks.map((task) => task.id) } },
          data: { status: "PENDING", attempt: 0, outputJson: Prisma.DbNull, lastError: null, startedAt: null, completedAt: null },
        });
        await tx.agentTask.update({
          where: { id: restartTask.id },
          data: { status: "READY", attempt: 0, outputJson: Prisma.DbNull, lastError: null, startedAt: null, completedAt: null },
        });
      }

      for (const task of shotTasks) {
        const order = shotTaskOrder(task);
        if (retainedOrders.has(order)) continue;
        const segment = nextPlanByOrder.get(order);
        if (!segment) {
          await tx.agentTask.update({
            where: { id: task.id },
            data: { status: "CANCELLED", lastError: "SUPERSEDED_BY_VIDEO_MODEL_CHANGE", startedAt: null, completedAt: null },
          });
          continue;
        }
        await tx.agentTask.update({
          where: { id: task.id },
          data: {
            status: "PENDING",
            attempt: 0,
            inputJson: json({ episodeIndex, order: segment.order, start: segment.start, end: segment.end, modelId: segment.modelId }),
            outputJson: Prisma.DbNull,
            lastError: null,
            startedAt: null,
            completedAt: null,
          },
        });
      }

      if (supersededTaskIds.length) {
        await tx.agentArtifact.updateMany({
          where: { runId: run.id, taskId: { in: supersededTaskIds }, status: { not: "SUPERSEDED" } },
          data: { status: "SUPERSEDED" },
        });
        await tx.agentHandoff.updateMany({
          where: { runId: run.id, fromTaskId: { in: supersededTaskIds }, status: { in: ["CREATED", "ACCEPTED"] } },
          data: { status: "REJECTED", rejectedAt: new Date(), rejectionReason: "SUPERSEDED_BY_VIDEO_MODEL_CHANGE" },
        });
      }

      await tx.agentApproval.updateMany({
        where: { runId: run.id, status: "PENDING" },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
      await tx.humanCheckpoint.updateMany({
        where: { runId: run.id, status: "PENDING" },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
    }

    await tx.$executeRaw`
      UPDATE "AgentRun"
      SET "inputJson"=${inputJson}::jsonb,
          "stateJson"=${stateJson}::jsonb,
          "planJson"=${planJson}::jsonb,
          "status"=${nextStatus},
          "stage"=${restartStage},
          "estimatedSpendThb"=${nextEstimatedSpendThb},
          "stopReason"=${nextStopReason},
          "finishedAt"=${nextFinishedAt},
          "updatedAt"=NOW()
      WHERE "id"=${run.id} AND "userId"=${user.id}
    `;
  });

  await recordAgentDecision({
    runId: run.id,
    stage: restartStage,
    action: mustRebuildGenerationPlan ? "USER_CHANGED_VIDEO_MODEL_SAFE_REPLAN" : "USER_CHANGED_VIDEO_MODEL",
    reason: mustRebuildGenerationPlan
      ? `ผู้ใช้เปลี่ยนโมเดลวิดีโอเป็น ${model.name} · ${version.label}; ระบบล้างแผน Provider เดิมและย้อนกลับไปสร้าง Prompt/Render Plan ใหม่ โดยเก็บเฉพาะ Shot ที่ช่วงเวลาเดิมยังตรงกัน`
      : `ผู้ใช้เปลี่ยนโมเดลวิดีโอเป็น ${model.name} · ${version.label} โดยยังไม่ถึงขั้นที่ต้องสร้าง Render Plan ใหม่`,
    providerId,
    metadata: {
      previousModelId,
      previousVersionId,
      modelId: model.id,
      modelVersionId: version.apiModelId,
      previousStage: run.stage,
      restartStage,
      episodeIndex,
      preservedOutputOrders: retainedOutputs.map((output) => output.order),
      supersededOutputOrders,
      cancelledOldProviderOrders,
      drainingOldProviderOrders,
    },
  });

  return NextResponse.json({
    ok: true,
    runId: run.id,
    status: nextStatus,
    stage: restartStage,
    model: { id: model.id, name: model.name, versionId: version.apiModelId, versionLabel: version.label, providerId },
    preservedOutputOrders: retainedOutputs.map((output) => output.order),
    drainingOldProviderOrders,
    message: nextStatus === "CANCELLED"
      ? "บันทึกโมเดลและรุ่นใหม่แล้ว งานยังยกเลิกอยู่ เมื่อเรียกกลับมาระบบจะทำต่อจากจุดที่ปลอดภัย"
      : nextStatus === "FAILED"
        ? "บันทึกโมเดลและรุ่นใหม่แล้ว แต่ความล้มเหลวอยู่ก่อนขั้นสร้างวิดีโอ จึงไม่ได้เปลี่ยน Logic การ Retry ของขั้นเดิม"
        : mustRebuildGenerationPlan
          ? `บันทึกโมเดลและรุ่นใหม่แล้ว ระบบเตรียมทำต่อจาก ${restartStage} และเก็บ Shot ที่ใช้ต่อได้ไว้แล้ว`
          : "บันทึกโมเดลและรุ่นใหม่แล้ว งานยังพักอยู่และทำต่อจากขั้นเดิมได้",
  });
}
