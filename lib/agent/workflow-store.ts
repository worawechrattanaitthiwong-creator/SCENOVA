import { createHash, randomUUID } from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  CORE_AGENT_DEFINITIONS,
  FILM_WORKFLOW_TASKS,
  agentArtifactSchema,
  episodeScopeKey,
  filmWorkflowDefinition,
  handoffEnvelopeSchema,
  workflowTaskSpec,
  type AgentArtifactPayload,
  type AgentArtifactStatus,
  type AgentArtifactType,
  type AgentReviewVerdict,
} from "@/lib/agent/contracts";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function ensureCoreAgentDefinitions() {
  await Promise.all(CORE_AGENT_DEFINITIONS.map((definition) => prisma.agentDefinition.upsert({
    where: { key: definition.key },
    create: {
      key: definition.key,
      nameTh: definition.nameTh,
      nameEn: definition.nameEn,
      description: definition.description,
      modelTier: definition.modelTier,
      instructionVersion: 1,
      inputTypes: json(definition.inputTypes),
      outputType: definition.outputType,
      toolsJson: json(definition.tools),
    },
    update: {
      nameTh: definition.nameTh,
      nameEn: definition.nameEn,
      description: definition.description,
      modelTier: definition.modelTier,
      inputTypes: json(definition.inputTypes),
      outputType: definition.outputType,
      toolsJson: json(definition.tools),
      enabled: true,
    },
  })));
}

export async function ensureAgentWorkflow(runId: string) {
  const existing = await prisma.agentWorkflow.findUnique({ where: { runId } });
  if (existing) return existing;
  await ensureCoreAgentDefinitions();
  return prisma.agentWorkflow.upsert({
    where: { runId },
    create: {
      id: randomUUID(),
      runId,
      workflowKey: "SCENOVA_FILM_PRODUCTION",
      version: 1,
      status: "ACTIVE",
      definitionJson: json(filmWorkflowDefinition()),
    },
    update: { status: "ACTIVE" },
  });
}

export async function ensureEpisodeWorkflow(input: {
  runId: string;
  projectId: string;
  episodeId: string;
  episodeIndex: number;
  maxAttempts?: number;
}) {
  const workflow = await ensureAgentWorkflow(input.runId);
  const scopeKey = episodeScopeKey(input.episodeIndex);
  const rows = FILM_WORKFLOW_TASKS.map((task, index) => ({
    id: randomUUID(),
    workflowId: workflow.id,
    runId: input.runId,
    agentKey: task.agentKey,
    stage: task.stage,
    scopeKey,
    status: index === 0 ? "READY" : "PENDING",
    sequence: index + 1,
    maxAttempts: Math.max(1, input.maxAttempts || 3),
    inputJson: json({
      projectId: input.projectId,
      episodeId: input.episodeId,
      episodeIndex: input.episodeIndex,
      requiredArtifactTypes: CORE_AGENT_DEFINITIONS.find((agent) => agent.key === task.agentKey)?.inputTypes || [],
    }),
    idempotencyKey: `${input.runId}:${scopeKey}:${task.stage}`,
  }));
  await prisma.agentTask.createMany({ data: rows, skipDuplicates: true });
  return prisma.agentTask.findMany({ where: { runId: input.runId, scopeKey }, orderBy: { sequence: "asc" } });
}

export async function startWorkflowStageTask(runId: string, episodeIndex: number, stage: string) {
  const scopeKey = episodeScopeKey(episodeIndex);
  const task = await prisma.agentTask.findUnique({ where: { runId_stage_scopeKey: { runId, stage, scopeKey } } });
  if (!task) throw new Error(`AGENT_WORKFLOW_TASK_NOT_FOUND:${stage}:${scopeKey}`);
  if (task.status === "COMPLETED") return task;
  if (task.status === "RUNNING") return task;
  if (["FAILED", "CANCELLED"].includes(task.status)) throw new Error(`AGENT_WORKFLOW_TASK_NOT_RUNNABLE:${task.status}`);
  if (task.attempt >= task.maxAttempts) {
    await prisma.agentTask.update({ where: { id: task.id }, data: { status: "FAILED", lastError: "AGENT_WORKFLOW_TASK_MAX_ATTEMPTS" } });
    throw new Error(`AGENT_WORKFLOW_TASK_MAX_ATTEMPTS:${stage}`);
  }

  const incoming = await prisma.agentHandoff.findMany({ where: { toTaskId: task.id, status: "CREATED" }, select: { id: true } });
  await prisma.$transaction([
    ...incoming.map((handoff) => prisma.agentHandoff.update({ where: { id: handoff.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } })),
    prisma.agentTask.update({
      where: { id: task.id },
      data: { status: "RUNNING", attempt: { increment: 1 }, startedAt: task.startedAt || new Date(), lastError: null },
    }),
  ]);
  return prisma.agentTask.findUniqueOrThrow({ where: { id: task.id } });
}

export async function getWorkflowInputArtifacts(runId: string, episodeIndex: number, stage: string) {
  const scopeKey = episodeScopeKey(episodeIndex);
  const task = await prisma.agentTask.findUnique({ where: { runId_stage_scopeKey: { runId, stage, scopeKey } } });
  if (!task) return [];
  return prisma.agentArtifact.findMany({
    where: { runId, scopeKey, task: { sequence: { lt: task.sequence } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function completeWorkflowStageTask(input: {
  runId: string;
  episodeIndex: number;
  stage: string;
  artifactType?: AgentArtifactType;
  summary: string;
  content: AgentArtifactPayload | Record<string, unknown>;
  artifactStatus?: AgentArtifactStatus;
  review?: { reviewerAgentKey: string; verdict: AgentReviewVerdict; score?: number; summary: string; issues?: string[] };
}) {
  const scopeKey = episodeScopeKey(input.episodeIndex);
  const task = await prisma.agentTask.findUnique({ where: { runId_stage_scopeKey: { runId: input.runId, stage: input.stage, scopeKey } } });
  if (!task) throw new Error(`AGENT_WORKFLOW_TASK_NOT_FOUND:${input.stage}:${scopeKey}`);
  const spec = workflowTaskSpec(input.stage);
  const artifactType = input.artifactType || spec?.artifactType;
  if (!artifactType) throw new Error(`AGENT_ARTIFACT_TYPE_NOT_FOUND:${input.stage}`);
  const parsed = agentArtifactSchema.safeParse(input.content);
  const content = parsed.success ? parsed.data : {
    summary: input.summary,
    verdict: "PASS" as const,
    confidence: 80,
    decisions: [],
    issues: [],
    payload: input.content,
  };

  if (task.status === "COMPLETED") {
    const existing = await prisma.agentArtifact.findFirst({ where: { taskId: task.id, type: artifactType }, orderBy: { version: "desc" } });
    if (existing) return { task, artifact: existing, handoff: null };
  }

  const [latest, inbound] = await Promise.all([
    prisma.agentArtifact.findFirst({ where: { runId: input.runId, type: artifactType, scopeKey }, orderBy: { version: "desc" }, select: { version: true } }),
    prisma.agentHandoff.findMany({ where: { toTaskId: task.id, status: "ACCEPTED" }, select: { artifactId: true } }),
  ]);
  const version = (latest?.version || 0) + 1;
  const artifactId = randomUUID();
  const nextTask = await prisma.agentTask.findFirst({ where: { runId: input.runId, scopeKey, sequence: { gt: task.sequence } }, orderBy: { sequence: "asc" } });
  const envelope = nextTask ? handoffEnvelopeSchema.parse({
    runId: input.runId,
    workflowId: task.workflowId,
    fromTaskId: task.id,
    toTaskId: nextTask.id,
    artifactId,
    artifactType,
    artifactVersion: version,
    scopeKey,
    constraints: { immutableArtifact: true, producerControlled: true },
    contractVersion: 1,
  }) : null;

  const result = await prisma.$transaction(async (tx) => {
    const artifact = await tx.agentArtifact.create({ data: {
      id: artifactId,
      runId: input.runId,
      taskId: task.id,
      type: artifactType,
      scopeKey,
      version,
      schemaVersion: 1,
      status: input.artifactStatus || (content.verdict === "PASS" ? "APPROVED" : "DRAFT"),
      summary: input.summary,
      contentJson: json(content),
      lineageJson: json(inbound.map((item) => item.artifactId)),
      checksum: checksum(content),
    } });
    await tx.agentTask.update({ where: { id: task.id }, data: {
      status: content.verdict === "PASS" ? "COMPLETED" : content.verdict === "REVISE" ? "RETURNED" : "FAILED",
      outputJson: json({ artifactId: artifact.id, artifactType, version, verdict: content.verdict }),
      completedAt: new Date(),
      lastError: content.verdict === "BLOCKED" ? content.issues.join("; ") : null,
    } });
    if (input.review) {
      await tx.agentReview.create({ data: {
        id: randomUUID(), runId: input.runId, taskId: task.id, artifactId: artifact.id,
        reviewerAgentKey: input.review.reviewerAgentKey, verdict: input.review.verdict,
        score: input.review.score, summary: input.review.summary, issuesJson: json(input.review.issues || []),
      } });
    }
    let handoff = null;
    if (nextTask && envelope && content.verdict === "PASS") {
      handoff = await tx.agentHandoff.create({ data: {
        id: randomUUID(), workflowId: task.workflowId, runId: input.runId, fromTaskId: task.id,
        toTaskId: nextTask.id, artifactId: artifact.id, status: "CREATED", contractVersion: 1, payloadJson: json(envelope),
      } });
      if (!["RUNNING", "COMPLETED"].includes(nextTask.status)) {
        await tx.agentTask.update({ where: { id: nextTask.id }, data: { status: "READY" } });
      }
    }
    return { artifact, handoff };
  });
  return { task: { ...task, status: content.verdict === "PASS" ? "COMPLETED" : content.verdict === "REVISE" ? "RETURNED" : "FAILED" }, ...result };
}

export async function returnWorkflowToStage(input: {
  runId: string;
  episodeIndex: number;
  fromStage: string;
  toStage: string;
  artifactId: string;
  reason: string;
}) {
  const scopeKey = episodeScopeKey(input.episodeIndex);
  const [workflow, fromTask, toTask, artifact] = await Promise.all([
    prisma.agentWorkflow.findUniqueOrThrow({ where: { runId: input.runId } }),
    prisma.agentTask.findUniqueOrThrow({ where: { runId_stage_scopeKey: { runId: input.runId, stage: input.fromStage, scopeKey } } }),
    prisma.agentTask.findUniqueOrThrow({ where: { runId_stage_scopeKey: { runId: input.runId, stage: input.toStage, scopeKey } } }),
    prisma.agentArtifact.findUniqueOrThrow({ where: { id: input.artifactId } }),
  ]);
  const envelope = handoffEnvelopeSchema.parse({
    runId: input.runId, workflowId: workflow.id, fromTaskId: fromTask.id, toTaskId: toTask.id,
    artifactId: artifact.id, artifactType: artifact.type, artifactVersion: artifact.version, scopeKey,
    constraints: { revisionRequired: true, reason: input.reason }, contractVersion: 1,
  });
  await prisma.$transaction([
    prisma.agentTask.update({ where: { id: fromTask.id }, data: { status: "RETURNED", lastError: input.reason } }),
    prisma.agentTask.update({ where: { id: toTask.id }, data: { status: "READY", completedAt: null, lastError: null } }),
    prisma.agentHandoff.upsert({
      where: { fromTaskId_toTaskId_artifactId: { fromTaskId: fromTask.id, toTaskId: toTask.id, artifactId: artifact.id } },
      create: { id: randomUUID(), workflowId: workflow.id, runId: input.runId, fromTaskId: fromTask.id, toTaskId: toTask.id, artifactId: artifact.id, status: "CREATED", payloadJson: json(envelope) },
      update: { status: "CREATED", payloadJson: json(envelope), acceptedAt: null, rejectedAt: null, rejectionReason: null },
    }),
  ]);
}

export async function failWorkflowStageTask(runId: string, episodeIndex: number, stage: string, error: string) {
  const scopeKey = episodeScopeKey(episodeIndex);
  const task = await prisma.agentTask.findUnique({ where: { runId_stage_scopeKey: { runId, stage, scopeKey } } });
  if (!task || task.status === "COMPLETED") return;
  await prisma.agentTask.update({ where: { id: task.id }, data: { status: task.attempt < task.maxAttempts ? "READY" : "FAILED", lastError: error } });
}

export async function requestHumanCheckpoint(input: {
  runId: string;
  episodeIndex: number;
  stage: string;
  kind: string;
  summary: string;
  payload?: Record<string, unknown>;
}) {
  const scopeKey = episodeScopeKey(input.episodeIndex);
  const task = await prisma.agentTask.findUnique({ where: { runId_stage_scopeKey: { runId: input.runId, stage: input.stage, scopeKey } } });
  const existing = await prisma.humanCheckpoint.findFirst({ where: { runId: input.runId, taskId: task?.id, kind: input.kind, status: "PENDING" }, orderBy: { requestedAt: "desc" } });
  if (existing) return existing;
  if (task) await prisma.agentTask.update({ where: { id: task.id }, data: { status: "WAITING_USER" } });
  return prisma.humanCheckpoint.create({ data: {
    id: randomUUID(), runId: input.runId, taskId: task?.id, kind: input.kind, status: "PENDING",
    required: true, summary: input.summary, payloadJson: json({ scopeKey, ...(input.payload || {}) }),
  } });
}

export async function decideLatestHumanCheckpoint(runId: string, userId: string, status: "APPROVED" | "REJECTED") {
  const checkpoint = await prisma.humanCheckpoint.findFirst({ where: { runId, status: "PENDING" }, orderBy: { requestedAt: "desc" } });
  if (!checkpoint) return null;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.humanCheckpoint.update({ where: { id: checkpoint.id }, data: { status, decidedAt: new Date(), decidedByUserId: userId } });
    if (checkpoint.taskId) await tx.agentTask.update({ where: { id: checkpoint.taskId }, data: { status: status === "APPROVED" ? "COMPLETED" : "RETURNED" } });
    return updated;
  });
}

export async function cancelWorkflow(runId: string) {
  await prisma.$transaction([
    prisma.agentWorkflow.updateMany({ where: { runId }, data: { status: "CANCELLED" } }),
    prisma.agentTask.updateMany({ where: { runId, status: { in: ["PENDING", "READY", "RUNNING", "WAITING_REVIEW", "WAITING_USER"] } }, data: { status: "CANCELLED" } }),
  ]);
}

export async function completeWorkflow(runId: string) {
  await prisma.agentWorkflow.updateMany({ where: { runId }, data: { status: "COMPLETED" } });
}

function shotScopeKey(episodeIndex: number, order: number) {
  return `${episodeScopeKey(episodeIndex)}:shot:${Math.max(0, Math.floor(order))}`;
}

export async function ensureRenderShotTasks(input: {
  runId: string;
  episodeIndex: number;
  shots: Array<{ order: number; start: number; end: number; modelId: string; estimatedCostThb?: number }>;
  maxAttempts?: number;
}) {
  const workflow = await prisma.agentWorkflow.findUniqueOrThrow({ where: { runId: input.runId } });
  const tasks = input.shots.map((shot) => ({
    id: randomUUID(), workflowId: workflow.id, runId: input.runId, agentKey: "RENDER_OPERATOR", stage: "GENERATE_SHOT",
    scopeKey: shotScopeKey(input.episodeIndex, shot.order), status: "READY", sequence: 1000 + shot.order,
    maxAttempts: Math.max(1, input.maxAttempts || 3), inputJson: json({ episodeIndex: input.episodeIndex, ...shot }),
    idempotencyKey: `${input.runId}:${shotScopeKey(input.episodeIndex, shot.order)}:GENERATE_SHOT`,
  }));
  await prisma.agentTask.createMany({ data: tasks, skipDuplicates: true });
  return prisma.agentTask.findMany({ where: { runId: input.runId, stage: "GENERATE_SHOT", scopeKey: { startsWith: `${episodeScopeKey(input.episodeIndex)}:shot:` } }, orderBy: { sequence: "asc" } });
}

export async function startRenderShotTask(runId: string, episodeIndex: number, order: number) {
  const task = await prisma.agentTask.findUnique({ where: { runId_stage_scopeKey: { runId, stage: "GENERATE_SHOT", scopeKey: shotScopeKey(episodeIndex, order) } } });
  if (!task || ["RUNNING", "COMPLETED"].includes(task.status)) return task;
  return prisma.agentTask.update({ where: { id: task.id }, data: { status: "RUNNING", attempt: { increment: 1 }, startedAt: task.startedAt || new Date(), lastError: null } });
}

export async function completeRenderShotTask(input: {
  runId: string;
  episodeIndex: number;
  order: number;
  summary: string;
  output: Record<string, unknown>;
}) {
  const scopeKey = shotScopeKey(input.episodeIndex, input.order);
  const task = await prisma.agentTask.findUnique({ where: { runId_stage_scopeKey: { runId: input.runId, stage: "GENERATE_SHOT", scopeKey } } });
  if (!task) return null;
  const existing = await prisma.agentArtifact.findFirst({ where: { taskId: task.id, type: "RENDER_CLIP" }, orderBy: { version: "desc" } });
  if (task.status === "COMPLETED" && existing) return existing;
  const continuityTask = await prisma.agentTask.findUnique({ where: { runId_stage_scopeKey: { runId: input.runId, stage: "VERIFY_CONTINUITY", scopeKey: episodeScopeKey(input.episodeIndex) } } });
  return prisma.$transaction(async (tx) => {
    const artifact = await tx.agentArtifact.create({ data: {
      id: randomUUID(), runId: input.runId, taskId: task.id, type: "RENDER_CLIP", scopeKey, version: (existing?.version || 0) + 1,
      status: "APPROVED", summary: input.summary, contentJson: json(input.output), lineageJson: json([]), checksum: checksum(input.output),
    } });
    await tx.agentTask.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: new Date(), outputJson: json({ artifactId: artifact.id, output: input.output }) } });
    if (continuityTask) {
      const envelope = handoffEnvelopeSchema.parse({ runId: input.runId, workflowId: task.workflowId, fromTaskId: task.id, toTaskId: continuityTask.id, artifactId: artifact.id, artifactType: "RENDER_CLIP", artifactVersion: artifact.version, scopeKey, constraints: { fanIn: true }, contractVersion: 1 });
      await tx.agentHandoff.create({ data: { id: randomUUID(), workflowId: task.workflowId, runId: input.runId, fromTaskId: task.id, toTaskId: continuityTask.id, artifactId: artifact.id, status: "CREATED", payloadJson: json(envelope) } });
    }
    return artifact;
  });
}

export async function failRenderShotTask(runId: string, episodeIndex: number, order: number, error: string) {
  const task = await prisma.agentTask.findUnique({ where: { runId_stage_scopeKey: { runId, stage: "GENERATE_SHOT", scopeKey: shotScopeKey(episodeIndex, order) } } });
  if (!task) return;
  await prisma.agentTask.update({ where: { id: task.id }, data: { status: task.attempt < task.maxAttempts ? "READY" : "FAILED", lastError: error } });
}

export async function getWorkflowSnapshot(runId: string) {
  return prisma.agentWorkflow.findUnique({
    where: { runId },
    include: {
      tasks: { orderBy: [{ scopeKey: "asc" }, { sequence: "asc" }] },
      handoffs: { orderBy: { createdAt: "asc" } },
    },
  }).then(async (workflow) => {
    if (!workflow) return null;
    const [artifacts, reviews, checkpoints] = await Promise.all([
      prisma.agentArtifact.findMany({ where: { runId }, orderBy: { createdAt: "asc" } }),
      prisma.agentReview.findMany({ where: { runId }, orderBy: { createdAt: "asc" } }),
      prisma.humanCheckpoint.findMany({ where: { runId }, orderBy: { requestedAt: "asc" } }),
    ]);
    return { ...workflow, artifacts, reviews, checkpoints };
  });
}
