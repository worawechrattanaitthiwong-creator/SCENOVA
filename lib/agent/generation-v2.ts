import { randomUUID } from "node:crypto";
import { Prisma, type VideoGeneration } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { GenerateVideoRequest, GenerateVideoResult, ProviderBillingMode, VideoProvider } from "@/lib/providers/video-provider";
import { PrismaWalletService } from "@/lib/wallet";

export const TERMINAL_GENERATION_STATUSES = ["SETTLED", "REFUNDED", "STOPPED"] as const;
export const ACTIVE_GENERATION_STATUSES = ["READY", "SUBMITTING", "ACCEPTED", "GENERATING", "POLL_RETRY", "OUTPUT_STORED"] as const;

export type SubmissionFailureKind = "REJECTED" | "AMBIGUOUS";

type CreateGenerationInput = {
  runId: string;
  userId: string;
  projectRef: string;
  episodeRef: string;
  shotOrder: number;
  provider: VideoProvider;
  request: GenerateVideoRequest;
  estimatedProviderCost: number;
  reservedCredits: number;
  reservationId?: string | null;
};

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function statusFromProvider(result: GenerateVideoResult) {
  if (result.status === "completed") return result.outputUrl ? "OUTPUT_STORED" : "RECOVERY_REQUIRED";
  if (result.status === "failed") return "PROVIDER_REJECTED";
  if (result.status === "generating") return "GENERATING";
  return "ACCEPTED";
}

function generationIdempotencyKey(input: Pick<CreateGenerationInput, "runId" | "episodeRef" | "shotOrder">) {
  return `video-generation-v2:${input.runId}:${input.episodeRef}:${input.shotOrder}`;
}

export function classifySubmissionFailure(error: unknown): SubmissionFailureKind {
  const message = error instanceof Error ? error.message : String(error);
  // A provider HTTP response means the request was explicitly rejected. A
  // timeout/network failure is ambiguous: the provider may have accepted it,
  // so automatic resubmission is forbidden.
  if (/_HTTP_[45]\d\d(?:\b|:)/i.test(message) || /PROVIDER_(?:UNAVAILABLE|REJECTED)/i.test(message)) return "REJECTED";
  return "AMBIGUOUS";
}

export function precheckVideoRequest(provider: VideoProvider, request: GenerateVideoRequest) {
  const errors: string[] = [];
  const model = provider.getModelDefinition();
  const compiledPrompt = [request.prompt.master, request.prompt.episode, ...request.prompt.shots].join("\n").trim();
  if (!model.enabled) errors.push("PROVIDER_NOT_CONFIGURED");
  if (!compiledPrompt) errors.push("PROMPT_REQUIRED");
  if (!Number.isFinite(request.renderSegment.duration) || request.renderSegment.duration <= 0) errors.push("INVALID_DURATION");
  if (request.renderSegment.duration > model.maxSecondsPerGeneration) errors.push("DURATION_EXCEEDS_MODEL_LIMIT");
  if (!model.resolutions.includes(request.resolution)) errors.push("RESOLUTION_NOT_SUPPORTED");
  if (!request.aspectRatio || !["9:16", "16:9", "1:1", "4:5"].includes(request.aspectRatio)) errors.push("ASPECT_RATIO_NOT_SUPPORTED");
  if (request.imageReferences.length && !model.supportsImageReference) errors.push("IMAGE_REFERENCE_NOT_SUPPORTED");
  if (request.videoReferences.length && !model.supportsVideoReference) errors.push("VIDEO_REFERENCE_NOT_SUPPORTED");
  return errors;
}

export async function recordGenerationEvent(generationId: string, type: string, metadata?: Record<string, unknown>) {
  return prisma.videoGenerationEvent.create({
    data: { id: randomUUID(), generationId, type, metadata: metadata ? json(metadata) : undefined },
  });
}

export async function getOrCreateVideoGeneration(input: CreateGenerationInput) {
  const idempotencyKey = generationIdempotencyKey(input);
  const existing = await prisma.videoGeneration.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;

  try {
    const created = await prisma.videoGeneration.create({
      data: {
        id: randomUUID(), runId: input.runId, userId: input.userId,
        projectRef: input.projectRef, episodeRef: input.episodeRef,
        segmentId: input.request.renderSegment.id, shotOrder: input.shotOrder,
        providerId: input.provider.id, modelId: input.provider.getModelDefinition().id,
        modelVersionId: input.request.modelVersionId || null,
        billingMode: input.provider.billingMode || "SYSTEM", status: "READY",
        promptSnapshot: json(input.request.prompt), inputSnapshot: json(input.request),
        idempotencyKey, estimatedProviderCost: input.estimatedProviderCost,
        reservedCredits: input.reservedCredits, reservationId: input.reservationId || null,
      },
    });
    await recordGenerationEvent(created.id, "GENERATION_READY", {
      providerId: created.providerId, billingMode: created.billingMode,
      reservedCredits: created.reservedCredits, estimatedProviderCost: input.estimatedProviderCost,
    });
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.videoGeneration.findUnique({ where: { idempotencyKey } });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function listEpisodeVideoGenerations(runId: string, episodeRef: string) {
  return prisma.videoGeneration.findMany({ where: { runId, episodeRef }, orderBy: { shotOrder: "asc" } });
}

export async function settledSystemProviderCost(runId: string) {
  const aggregate = await prisma.videoGeneration.aggregate({
    where: { runId, status: "SETTLED", billingMode: "SYSTEM" },
    _sum: { estimatedProviderCost: true },
  });
  return Number(aggregate._sum.estimatedProviderCost || 0);
}

export async function refundRejectedGeneration(generation: VideoGeneration, reason?: string) {
  if (generation.billingMode === "SYSTEM" && generation.reservationId) {
    await new PrismaWalletService().refund(generation.reservationId, reason || generation.errorMessage || "Provider rejected generation");
  }
  const updated = await prisma.videoGeneration.update({ where: { id: generation.id }, data: { status: "REFUNDED" } });
  await recordGenerationEvent(generation.id, "GENERATION_REFUNDED", { reason: reason || generation.errorMessage || null });
  return updated;
}

export async function stopGenerationAtPrecheck(generation: VideoGeneration, errors: string[]) {
  const message = errors.join(", ");
  const updated = await prisma.videoGeneration.update({
    where: { id: generation.id },
    data: { status: "STOPPED", errorCode: errors[0] || "PRECHECK_FAILED", errorMessage: message, failedAt: new Date() },
  });
  if (generation.reservationId && generation.billingMode === "SYSTEM") {
    await new PrismaWalletService().refund(generation.reservationId, message);
  }
  await recordGenerationEvent(generation.id, "PRECHECK_STOPPED", { errors });
  return updated;
}

export async function claimProviderSubmission(generationId: string) {
  const claimed = await prisma.videoGeneration.updateMany({
    where: { id: generationId, status: "READY", providerSubmissionCount: 0, providerTaskId: null },
    data: { status: "SUBMITTING", providerSubmissionCount: { increment: 1 }, submittedAt: new Date(), errorCode: null, errorMessage: null },
  });
  if (claimed.count !== 1) return null;
  const generation = await prisma.videoGeneration.findUniqueOrThrow({ where: { id: generationId } });
  await recordGenerationEvent(generationId, "PROVIDER_SUBMIT_CLAIMED", { idempotencyKey: generation.idempotencyKey });
  return generation;
}

export async function persistProviderResult(generationId: string, result: GenerateVideoResult, eventType = "PROVIDER_STATUS") {
  const status = statusFromProvider(result);
  const now = new Date();
  const updated = await prisma.videoGeneration.update({
    where: { id: generationId },
    data: {
      providerTaskId: result.providerTaskId || undefined,
      status,
      providerAcceptedAt: result.providerTaskId ? now : undefined,
      outputUrl: result.outputUrl || undefined,
      storagePath: result.outputUrl ? `provider-task:${result.providerTaskId}` : undefined,
      lastFrameUrl: result.lastFrameUrl || undefined,
      errorCode: status === "PROVIDER_REJECTED" ? "PROVIDER_REJECTED" : status === "RECOVERY_REQUIRED" ? "OUTPUT_URL_MISSING" : null,
      errorMessage: result.error || (status === "RECOVERY_REQUIRED" ? "Provider completed without a recoverable output URL" : null),
      completedAt: status === "OUTPUT_STORED" ? now : undefined,
      failedAt: status === "PROVIDER_REJECTED" ? now : undefined,
    },
  });
  await recordGenerationEvent(generationId, eventType, { providerTaskId: result.providerTaskId, providerStatus: result.status, status, hasOutput: Boolean(result.outputUrl), error: result.error || null });
  return updated;
}

/**
 * Reconcile/download recovery always uses the original provider task.  It is
 * deliberately separate from submission so a missing output URL or a failed
 * fetch can never create a second paid generation.
 */
export async function recoverGenerationOutput(generation: VideoGeneration, provider: VideoProvider) {
  if (!generation.providerTaskId) throw new Error("GENERATION_PROVIDER_TASK_REQUIRED");
  const result = await provider.getStatus(generation.providerTaskId);
  return persistProviderResult(generation.id, result, "DOWNLOAD_RECOVERY");
}

export async function markPollRetry(generationId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const updated = await prisma.videoGeneration.update({ where: { id: generationId }, data: { status: "POLL_RETRY", errorCode: "POLL_TRANSIENT", errorMessage: message } });
  await recordGenerationEvent(generationId, "POLL_RETRY", { error: message });
  return updated;
}

export async function markSubmissionFailure(generation: VideoGeneration, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const kind = classifySubmissionFailure(error);
  const status = kind === "REJECTED" ? "PROVIDER_REJECTED" : "RECOVERY_REQUIRED";
  const updated = await prisma.videoGeneration.update({
    where: { id: generation.id },
    data: { status, errorCode: kind === "REJECTED" ? "PROVIDER_REJECTED" : "SUBMISSION_RESULT_UNKNOWN", errorMessage: message, failedAt: kind === "REJECTED" ? new Date() : undefined },
  });
  if (kind === "REJECTED" && generation.reservationId && generation.billingMode === "SYSTEM") {
    await new PrismaWalletService().refund(generation.reservationId, message);
  }
  await recordGenerationEvent(generation.id, kind === "REJECTED" ? "PROVIDER_REJECTED" : "MANUAL_RECONCILIATION_REQUIRED", { error: message });
  return updated;
}

export async function settleStoredGeneration(generation: VideoGeneration) {
  if (generation.status === "SETTLED") return generation;
  if (generation.status !== "OUTPUT_STORED" || !generation.outputUrl || !generation.storagePath) throw new Error("GENERATION_OUTPUT_NOT_DURABLY_RECORDED");
  if (generation.billingMode === "SYSTEM") {
    if (!generation.reservationId) throw new Error("GENERATION_RESERVATION_REQUIRED");
    await new PrismaWalletService().charge(generation.reservationId, generation.reservedCredits);
  }
  const updated = await prisma.videoGeneration.update({ where: { id: generation.id }, data: { status: "SETTLED", errorCode: null, errorMessage: null } });
  await recordGenerationEvent(generation.id, "GENERATION_SETTLED", { billingMode: generation.billingMode, chargedCredits: generation.billingMode === "SYSTEM" ? generation.reservedCredits : 0 });
  return updated;
}

export function generationOutput(generation: VideoGeneration) {
  const status = generation.status === "SETTLED" ? "completed"
    : ["ACCEPTED", "SUBMITTING", "READY"].includes(generation.status) ? "queued"
      : ["GENERATING", "POLL_RETRY", "OUTPUT_STORED"].includes(generation.status) ? "generating"
        : "failed";
  return {
    generationId: generation.id,
    order: generation.shotOrder,
    attempt: Math.min(1, generation.providerSubmissionCount),
    providerId: generation.providerId,
    billingMode: generation.billingMode as ProviderBillingMode,
    providerTaskId: generation.providerTaskId || undefined,
    status: status as "queued" | "generating" | "completed" | "failed",
    estimatedCostThb: Number(generation.estimatedProviderCost || 0),
    reservationId: generation.reservationId || undefined,
    reservedCredits: generation.reservedCredits,
    settled: generation.status === "SETTLED",
    outputUrl: generation.outputUrl || undefined,
    lastFrameUrl: generation.lastFrameUrl || undefined,
    error: generation.errorMessage || undefined,
  };
}

function providerGateConfig(providerId: string) {
  const prefix = `SCENOVA_${providerId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const veo = providerId.toLowerCase() === "veo";
  const minIntervalMs = Math.max(1_000, Number(process.env[`${prefix}_MIN_REQUEST_INTERVAL_MS`] || (veo ? 35_000 : 2_000)));
  const requestsPerDay = Math.max(1, Number(process.env[`${prefix}_REQUESTS_PER_DAY`] || (veo ? 9 : 1_000)));
  return { minIntervalMs, requestsPerDay };
}

export async function acquireProviderRateSlot(input: { providerId: string; billingMode: ProviderBillingMode; userId: string }) {
  const scopeMode = String(process.env.SCENOVA_PROVIDER_RATE_SCOPE || "provider").toLowerCase();
  const scopeKey = scopeMode === "user" ? `${input.providerId}:user:${input.userId}` : `${input.providerId}:global`;
  const config = providerGateConfig(input.providerId);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "ProviderRateGate" ("id","providerId","scopeKey","nextAvailableAt","minuteWindowStart","minuteCount","dayWindowStart","dayCount","updatedAt")
      VALUES (${randomUUID()},${input.providerId},${scopeKey},NOW(),NOW(),0,NOW(),0,NOW())
      ON CONFLICT ("scopeKey") DO NOTHING`;
    const rows = await tx.$queryRaw<Array<{ id: string; nextAvailableAt: Date; dayWindowStart: Date; dayCount: number }>>`
      SELECT "id","nextAvailableAt","dayWindowStart","dayCount" FROM "ProviderRateGate" WHERE "scopeKey"=${scopeKey} FOR UPDATE`;
    const gate = rows[0];
    if (!gate) throw new Error("PROVIDER_RATE_GATE_NOT_FOUND");
    const dayElapsed = now.getTime() - new Date(gate.dayWindowStart).getTime() >= 24 * 60 * 60 * 1000;
    const dayCount = dayElapsed ? 0 : gate.dayCount;
    if (dayCount >= config.requestsPerDay) {
      const waitUntil = new Date(new Date(gate.dayWindowStart).getTime() + 24 * 60 * 60 * 1000);
      return { allowed: false as const, waitUntil, reason: "PROVIDER_DAILY_SAFETY_LIMIT" };
    }
    const nextAvailableAt = new Date(gate.nextAvailableAt);
    if (nextAvailableAt.getTime() > now.getTime()) return { allowed: false as const, waitUntil: nextAvailableAt, reason: "PROVIDER_MIN_INTERVAL" };
    const waitUntil = new Date(now.getTime() + config.minIntervalMs);
    await tx.providerRateGate.update({
      where: { id: gate.id },
      data: { nextAvailableAt: waitUntil, minuteWindowStart: now, minuteCount: 1, dayWindowStart: dayElapsed ? now : undefined, dayCount: dayCount + 1 },
    });
    return { allowed: true as const, waitUntil, reason: "PROVIDER_SLOT_ACQUIRED" };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
