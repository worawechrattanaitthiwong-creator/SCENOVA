import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import type { Project, PromptBundle, RenderSegment } from "@/lib/domain";
import { resolveSession } from "@/lib/auth-core";
import { creditsFromThb } from "@/lib/cost-transparency";
import {
  collectDirectImageReferences,
  composeDirectPrompts,
  directMaxSecondsForProvider,
  directProgress,
  planDirectRenderWindows,
  type DirectPromptSegment,
} from "@/lib/direct-render";
import { prisma } from "@/lib/db";
import { getUserVideoProviderById } from "@/lib/providers/provider-registry";
import type { GenerateVideoRequest, GenerateVideoResult } from "@/lib/providers/video-provider";
import { PrismaWalletService } from "@/lib/wallet";

export const runtime = "nodejs";

const wallet = new PrismaWalletService();
const ACTIVE = new Set(["SUBMITTING", "QUEUED", "GENERATING"]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function validProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<Project>;
  return Boolean(
    typeof project.id === "string"
    && typeof project.title === "string"
    && typeof project.mainModelId === "string"
    && Array.isArray(project.episodes)
    && project.episodes[0]
    && Array.isArray(project.episodes[0].segments),
  );
}

function validPromptBundle(value: unknown): value is PromptBundle {
  const record = asRecord(value);
  return typeof record.master === "string"
    && typeof record.episode === "string"
    && Array.isArray(record.shots)
    && record.shots.every((item) => typeof item === "string")
    && typeof record.negative === "string"
    && typeof record.thaiSummary === "string";
}

function normalizePromptSegments(value: unknown, planned: ReturnType<typeof planDirectRenderWindows>): DirectPromptSegment[] | null {
  if (!Array.isArray(value) || value.length !== planned.length) return null;
  const result: DirectPromptSegment[] = [];
  for (let index = 0; index < planned.length; index += 1) {
    const record = asRecord(value[index]);
    const window = planned[index];
    const prompt = record.prompt;
    const order = Number(record.order);
    const start = Number(record.start);
    const end = Number(record.end);
    const duration = Number(record.duration);
    if (
      order !== window.order
      || Math.abs(start - window.start) > 0.01
      || Math.abs(end - window.end) > 0.01
      || Math.abs(duration - window.duration) > 0.01
      || !validPromptBundle(prompt)
    ) return null;
    result.push({
      order: window.order,
      start: window.start,
      end: window.end,
      duration: window.duration,
      sourceSceneIds: window.sourceSceneIds,
      renderSegment: window.renderSegment,
      prompt,
      copyText: typeof record.copyText === "string" ? record.copyText.slice(0, 100_000) : "",
    });
  }
  return result;
}

function providerStatus(value: GenerateVideoResult["status"]) {
  if (value === "completed") return "COMPLETED";
  if (value === "failed") return "FAILED";
  if (value === "generating") return "GENERATING";
  return "QUEUED";
}

function reservationId(job: { continuityState: Prisma.JsonValue | null }) {
  const state = asRecord(job.continuityState);
  return typeof state.reservationId === "string" ? state.reservationId : "";
}

async function settleReservation(job: { continuityState: Prisma.JsonValue | null }, mode: "charge" | "refund", reason?: string) {
  const id = reservationId(job);
  if (!id) return;
  if (mode === "charge") await wallet.charge(id).catch(() => undefined);
  else await wallet.refund(id, reason || "Direct render failed").catch(() => undefined);
}

function requestFromJob(input: {
  job: {
    id: string;
    projectId: string;
    episodeId: string;
    startSec: number;
    endSec: number;
    modelId: string;
    resolution: string;
    idempotencyKey: string;
    promptSnapshot: Prisma.JsonValue;
    referenceSnapshot: Prisma.JsonValue | null;
  };
  previousLastFrame?: string | null;
}): GenerateVideoRequest {
  const promptRecord = asRecord(input.job.promptSnapshot);
  const refs = asRecord(input.job.referenceSnapshot);
  const prompt = promptRecord.prompt;
  if (!validPromptBundle(prompt)) throw new Error("DIRECT_RENDER_PROMPT_SNAPSHOT_INVALID");
  const modelVersionId = typeof promptRecord.modelVersionId === "string" ? promptRecord.modelVersionId : undefined;
  const aspectRatio = typeof promptRecord.aspectRatio === "string" ? promptRecord.aspectRatio : undefined;
  const sourceSceneIds = asStringArray(promptRecord.sourceSceneIds);
  const storedImages = asStringArray(refs.imageReferences);
  const imageReferences = input.previousLastFrame
    ? [input.previousLastFrame, ...storedImages.filter((value) => value !== input.previousLastFrame)]
    : storedImages;
  const renderSegment: RenderSegment = {
    id: input.job.id,
    episodeId: input.job.episodeId,
    order: Math.max(1, Number(promptRecord.order || 1)),
    start: input.job.startSec,
    end: input.job.endSec,
    duration: Math.max(0.01, input.job.endSec - input.job.startSec),
    modelId: input.job.modelId,
    sourceSegmentIds: sourceSceneIds,
    continuityFromPrevious: Boolean(promptRecord.continuityFromPrevious),
  };
  return {
    projectId: input.job.projectId,
    episodeId: input.job.episodeId,
    modelVersionId,
    renderSegment,
    prompt,
    resolution: input.job.resolution as GenerateVideoRequest["resolution"],
    aspectRatio,
    imageReferences,
    videoReferences: asStringArray(refs.videoReferences),
    audioReferences: asStringArray(refs.audioReferences),
    idempotencyKey: input.job.idempotencyKey,
  };
}

async function submitJob(userId: string, jobId: string) {
  const job = await prisma.generationJob.findFirst({ where: { id: jobId, userId } });
  if (!job || job.status !== "READY") return job;
  const provider = await getUserVideoProviderById(userId, job.provider);
  if (!provider) {
    await prisma.generationJob.update({ where: { id: job.id }, data: { status: "FAILED", errorCode: "VIDEO_PROVIDER_CONNECTION_REQUIRED", errorMessage: `Provider ${job.provider} is not available` } });
    await settleReservation(job, "refund", "Provider unavailable");
    return null;
  }
  const previous = await prisma.generationJob.findFirst({
    where: { userId, projectId: job.projectId, startSec: { lt: job.startSec }, status: "COMPLETED" },
    orderBy: { startSec: "desc" },
  });
  const generateRequest = requestFromJob({ job, previousLastFrame: previous?.lastFrameAssetKey });
  await prisma.generationJob.update({ where: { id: job.id }, data: { status: "SUBMITTING", errorCode: null, errorMessage: null } });
  try {
    const result = await provider.generate(generateRequest);
    const status = providerStatus(result.status);
    const updated = await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status,
        providerTaskId: result.providerTaskId || null,
        outputAssetKey: result.outputUrl || null,
        lastFrameAssetKey: result.lastFrameUrl || null,
        errorCode: result.status === "failed" ? "PROVIDER_GENERATION_FAILED" : null,
        errorMessage: result.error || null,
      },
    });
    if (status === "COMPLETED") await settleReservation(updated, "charge");
    if (status === "FAILED") await settleReservation(updated, "refund", result.error || "Provider generation failed");
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "DIRECT_RENDER_PROVIDER_FAILED";
    const updated = await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorCode: message.split(":", 1)[0].slice(0, 120), errorMessage: message.slice(0, 4000) },
    });
    await settleReservation(updated, "refund", message);
    return updated;
  }
}

async function pollActiveJob(userId: string, projectId: string) {
  const active = await prisma.generationJob.findFirst({
    where: { userId, projectId, status: { in: ["QUEUED", "GENERATING"] } },
    orderBy: { startSec: "asc" },
  });
  if (!active || !active.providerTaskId) return active;
  const provider = await getUserVideoProviderById(userId, active.provider);
  if (!provider) return active;
  try {
    const result = await provider.getStatus(active.providerTaskId);
    const status = providerStatus(result.status);
    const updated = await prisma.generationJob.update({
      where: { id: active.id },
      data: {
        status,
        outputAssetKey: result.outputUrl || active.outputAssetKey,
        lastFrameAssetKey: result.lastFrameUrl || active.lastFrameAssetKey,
        errorCode: result.status === "failed" ? "PROVIDER_GENERATION_FAILED" : null,
        errorMessage: result.error || null,
      },
    });
    if (status === "COMPLETED") await settleReservation(updated, "charge");
    if (status === "FAILED") await settleReservation(updated, "refund", result.error || "Provider generation failed");
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "DIRECT_RENDER_POLL_FAILED";
    await prisma.generationJob.update({ where: { id: active.id }, data: { errorMessage: message.slice(0, 4000) } });
    return active;
  }
}

async function advanceRun(userId: string, projectId: string) {
  await pollActiveJob(userId, projectId);
  const jobs = await prisma.generationJob.findMany({ where: { userId, projectId }, orderBy: { startSec: "asc" } });
  if (jobs.some((job) => ACTIVE.has(job.status))) return jobs;
  if (jobs.some((job) => job.status === "FAILED" || job.status === "CANCELLED")) return jobs;
  const next = jobs.find((job) => job.status === "READY");
  if (next) {
    await submitJob(userId, next.id);
    return prisma.generationJob.findMany({ where: { userId, projectId }, orderBy: { startSec: "asc" } });
  }
  return jobs;
}

function responseForRun(projectId: string, jobs: Awaited<ReturnType<typeof advanceRun>>) {
  const progress = directProgress(jobs);
  return {
    ok: true,
    runId: projectId,
    status: progress.status,
    percent: progress.percent,
    segments: jobs.map((job, index) => ({
      id: job.id,
      order: index + 1,
      start: job.startSec,
      end: job.endSec,
      duration: job.endSec - job.startSec,
      status: job.status,
      provider: job.provider,
      modelId: job.modelId,
      outputUrl: job.outputAssetKey,
      lastFrameUrl: job.lastFrameAssetKey,
      estimatedCostThb: job.estimatedCostThb ? Number(job.estimatedCostThb) : 0,
      error: job.errorMessage,
    })),
  };
}

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let createdProjectId = "";
  const reservations: string[] = [];
  try {
    const body = await request.json().catch(() => null) as {
      project?: unknown;
      providerId?: unknown;
      modelVersionId?: unknown;
      promptSegments?: unknown;
    } | null;
    if (!body || !validProject(body.project)) return NextResponse.json({ error: "DIRECT_RENDER_PROJECT_REQUIRED" }, { status: 400 });
    const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
    if (!providerId) return NextResponse.json({ error: "DIRECT_RENDER_PROVIDER_REQUIRED" }, { status: 400 });
    const provider = await getUserVideoProviderById(user.id, providerId);
    if (!provider) return NextResponse.json({ error: `VIDEO_PROVIDER_CONNECTION_REQUIRED:${providerId}` }, { status: 400 });

    const project = body.project;
    const sourceEpisode = project.episodes[0];
    const modelVersionId = typeof body.modelVersionId === "string" ? body.modelVersionId : project.mainModelVersionId;
    const maxSeconds = directMaxSecondsForProvider(provider, modelVersionId);
    const planned = planDirectRenderWindows(project, maxSeconds);
    if (!planned.length) return NextResponse.json({ error: "DIRECT_RENDER_NO_SEGMENTS" }, { status: 400 });
    const supplied = normalizePromptSegments(body.promptSegments, planned);
    const composed = supplied ? { segments: supplied } : await composeDirectPrompts({ userId: user.id, project, provider, modelVersionId });

    const dbProjectId = `direct_${randomUUID()}`;
    const dbEpisodeId = `direct_ep_${randomUUID()}`;
    createdProjectId = dbProjectId;
    await prisma.project.create({
      data: {
        id: dbProjectId,
        userId: user.id,
        title: project.title || "Direct Render",
        story: project.story || "",
        genre: project.genre || "Cinematic",
        mood: project.mood || "",
        aspectRatio: project.aspectRatio || "16:9",
        episodeCount: 1,
        openEnded: false,
        mainModelId: project.mainModelId,
        modelMode: project.modelMode || "single",
        promptMode: project.promptMode || "assisted",
        resolution: project.resolution || "720p",
        stylePresetId: project.styleId || null,
        projectBible: project.projectBible || "",
        locksJson: project.locks as unknown as Prisma.InputJsonValue,
        episodes: {
          create: {
            id: dbEpisodeId,
            number: 1,
            title: sourceEpisode.title || project.title || "Direct Render",
            durationSec: Number(sourceEpisode.duration) || 1,
            synopsis: sourceEpisode.synopsis || project.story || "",
            status: "generating",
          },
        },
      },
    });

    for (const segment of composed.segments) {
      const imageReferences = collectDirectImageReferences(project, segment.sourceSceneIds);
      const renderSegment: RenderSegment = {
        ...segment.renderSegment,
        id: `direct_render_${dbProjectId}_${segment.order}`,
        episodeId: dbEpisodeId,
        modelId: project.mainModelId,
      };
      const idempotencyKey = `direct:${dbProjectId}:${segment.order}`;
      const generateRequest: GenerateVideoRequest = {
        projectId: dbProjectId,
        episodeId: dbEpisodeId,
        modelVersionId,
        renderSegment,
        prompt: segment.prompt,
        resolution: project.resolution,
        aspectRatio: project.aspectRatio,
        imageReferences,
        videoReferences: [],
        audioReferences: [],
        idempotencyKey,
      };
      const estimate = await provider.estimateCost(generateRequest);
      const estimatedCostThb = Number(estimate.estimatedAmount || 0);
      let reservationId = "";
      let reservedCredits = 0;
      if (provider.billingMode !== "BYOK" && estimatedCostThb > 0) {
        reservedCredits = creditsFromThb(estimatedCostThb);
        if (reservedCredits > 0) {
          const reservation = await wallet.reserve({
            userId: user.id,
            credits: reservedCredits,
            purpose: "video",
            category: "VIDEO_GENERATION",
            referenceId: `${dbProjectId}:${segment.order}`,
            idempotencyKey: `${idempotencyKey}:reserve`,
            metadata: { directRender: true, providerId, modelVersionId: modelVersionId || null, segmentOrder: segment.order },
          });
          reservationId = reservation.reservationId;
          reservations.push(reservationId);
        }
      }
      await prisma.generationJob.create({
        data: {
          userId: user.id,
          projectId: dbProjectId,
          episodeId: dbEpisodeId,
          provider: providerId,
          modelId: project.mainModelId,
          idempotencyKey,
          startSec: segment.start,
          endSec: segment.end,
          resolution: project.resolution,
          status: "READY",
          estimatedCostThb,
          promptSnapshot: {
            order: segment.order,
            modelVersionId: modelVersionId || null,
            aspectRatio: project.aspectRatio,
            prompt: segment.prompt,
            copyText: segment.copyText,
            sourceSceneIds: segment.sourceSceneIds,
            continuityFromPrevious: segment.order > 1,
          } as unknown as Prisma.InputJsonValue,
          referenceSnapshot: { imageReferences, videoReferences: [], audioReferences: [] } as unknown as Prisma.InputJsonValue,
          continuityState: { reservationId: reservationId || null, reservedCredits } as unknown as Prisma.InputJsonValue,
        },
      });
    }

    const jobs = await advanceRun(user.id, dbProjectId);
    return NextResponse.json(responseForRun(dbProjectId, jobs));
  } catch (error) {
    for (const id of reservations) await wallet.refund(id, "Direct render setup failed").catch(() => undefined);
    if (createdProjectId) await prisma.project.delete({ where: { id: createdProjectId } }).catch(() => undefined);
    const message = error instanceof Error ? error.message : "DIRECT_RENDER_FAILED";
    const status = message === "INSUFFICIENT_CREDITS" ? 402
      : message.includes("429") || message.includes("RATE_LIMIT") ? 429
        : message.includes("CONNECTION_REQUIRED") || message.includes("API_KEY") ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId") || "";
  if (!runId) return NextResponse.json({ error: "DIRECT_RENDER_RUN_REQUIRED" }, { status: 400 });
  const project = await prisma.project.findFirst({ where: { id: runId, userId: user.id } });
  if (!project) return NextResponse.json({ error: "DIRECT_RENDER_RUN_NOT_FOUND" }, { status: 404 });
  const jobs = await advanceRun(user.id, runId);
  const status = directProgress(jobs).status;
  if (status === "COMPLETED" || status === "FAILED") {
    await prisma.episode.updateMany({ where: { projectId: runId }, data: { status: status.toLowerCase() } });
  }
  return NextResponse.json(responseForRun(runId, jobs));
}

export async function DELETE(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId") || "";
  if (!runId) return NextResponse.json({ error: "DIRECT_RENDER_RUN_REQUIRED" }, { status: 400 });
  const jobs = await prisma.generationJob.findMany({ where: { userId: user.id, projectId: runId }, orderBy: { startSec: "asc" } });
  if (!jobs.length) return NextResponse.json({ error: "DIRECT_RENDER_RUN_NOT_FOUND" }, { status: 404 });
  for (const job of jobs) {
    if (ACTIVE.has(job.status) && job.providerTaskId) {
      const provider = await getUserVideoProviderById(user.id, job.provider);
      if (provider) await provider.cancel(job.providerTaskId).catch(() => false);
    }
    if (job.status !== "COMPLETED") await settleReservation(job, "refund", "Direct render cancelled");
  }
  await prisma.generationJob.updateMany({ where: { userId: user.id, projectId: runId, status: { not: "COMPLETED" } }, data: { status: "CANCELLED" } });
  await prisma.episode.updateMany({ where: { projectId: runId }, data: { status: "cancelled" } });
  const latest = await prisma.generationJob.findMany({ where: { userId: user.id, projectId: runId }, orderBy: { startSec: "asc" } });
  return NextResponse.json(responseForRun(runId, latest));
}
