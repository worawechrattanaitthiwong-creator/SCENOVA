import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-core";
import { prisma } from "@/lib/db";
import { ensureDirectFinalVideo } from "@/lib/direct-render-final";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fileName(value: string) {
  const safe = value.replace(/[^a-zA-Z0-9ก-๙._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
  return `${safe || "SCENOVA-Final-Video"}.mp4`;
}

function parseRange(value: string | null, size: number) {
  if (!value?.startsWith("bytes=")) return null;
  const [startText, endText] = value.slice(6).split("-", 2);
  const start = Number(startText);
  const end = endText ? Number(endText) : size - 1;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const query = new URL(request.url).searchParams;
  const runId = query.get("runId") || "";
  if (!runId) return NextResponse.json({ error: "DIRECT_RENDER_RUN_REQUIRED" }, { status: 400 });

  const project = await prisma.project.findFirst({ where: { id: runId, userId: user.id }, select: { id: true, title: true } });
  if (!project) return NextResponse.json({ error: "DIRECT_RENDER_RUN_NOT_FOUND" }, { status: 404 });

  const jobs = await prisma.generationJob.findMany({
    where: { userId: user.id, projectId: runId },
    orderBy: { startSec: "asc" },
    select: { status: true, startSec: true, endSec: true, outputAssetKey: true },
  });
  if (!jobs.length) return NextResponse.json({ error: "DIRECT_RENDER_RUN_NOT_FOUND" }, { status: 404 });
  if (jobs.some((job) => job.status !== "COMPLETED" || !job.outputAssetKey)) {
    return NextResponse.json({ error: "FINAL_VIDEO_SEGMENTS_NOT_READY" }, { status: 409 });
  }

  try {
    const origin = new URL(request.url).origin;
    const cookieHeader = request.headers.get("cookie") || "";
    const outputPath = await ensureDirectFinalVideo({
      runId,
      origin,
      cookieHeader,
      sources: jobs.map((job, index) => ({
        order: index + 1,
        duration: Math.max(0.01, job.endSec - job.startSec),
        outputUrl: job.outputAssetKey!,
      })),
    });
    const info = await stat(outputPath);
    const range = parseRange(request.headers.get("range"), info.size);
    const headers = new Headers({
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `${query.get("download") === "1" ? "attachment" : "inline"}; filename="${fileName(project.title)}"`,
    });

    if (range) {
      const length = range.end - range.start + 1;
      headers.set("Content-Length", String(length));
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${info.size}`);
      const stream = Readable.toWeb(createReadStream(outputPath, { start: range.start, end: range.end })) as ReadableStream<Uint8Array>;
      return new Response(stream, { status: 206, headers });
    }

    headers.set("Content-Length", String(info.size));
    const stream = Readable.toWeb(createReadStream(outputPath)) as ReadableStream<Uint8Array>;
    return new Response(stream, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "FINAL_VIDEO_ASSEMBLY_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
