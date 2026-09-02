import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-core";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function mediaUrl(providerId: string, raw: string) {
  if (raw.startsWith("/")) return raw;
  // Veo media URLs require the server-side credential. Keep that credential
  // out of the browser and let the existing authenticated media proxy stream it.
  if (providerId.toLowerCase() === "veo") {
    return `/api/provider-media?provider=veo&url=${encodeURIComponent(raw)}`;
  }
  return raw;
}

function runTitle(inputJson: unknown) {
  if (!inputJson || typeof inputJson !== "object" || Array.isArray(inputJson)) return "งาน AI";
  const project = (inputJson as { project?: { title?: unknown } }).project;
  return typeof project?.title === "string" && project.title.trim() ? project.title : "งาน AI";
}

function episodeTitle(inputJson: unknown, episodeRef: string) {
  if (inputJson && typeof inputJson === "object" && !Array.isArray(inputJson)) {
    const episodes = (inputJson as { project?: { episodes?: Array<{ id?: unknown; title?: unknown }> } }).project?.episodes;
    const episode = episodes?.find((item) => item.id === episodeRef);
    if (episode && typeof episode.title === "string" && episode.title.trim()) return episode.title;
  }
  return episodeRef || "Episode";
}

export async function GET() {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return noStore(NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }));

  const rows = await prisma.videoGeneration.findMany({
    where: { userId: user.id, status: "SETTLED", outputUrl: { not: null } },
    orderBy: [{ createdAt: "desc" }, { shotOrder: "asc" }],
    include: { run: { select: { id: true, inputJson: true } } },
  });

  const clips = rows.map((row) => {
    const snapshot = row.inputSnapshot && typeof row.inputSnapshot === "object" && !Array.isArray(row.inputSnapshot)
      ? row.inputSnapshot as { renderSegment?: { duration?: unknown } }
      : {};
    const duration = Number(snapshot.renderSegment?.duration || 0);
    return {
      id: `generation:${row.id}`,
      runId: row.runId,
      episodeRef: row.episodeRef,
      ep: row.shotOrder + 1,
      epTitle: episodeTitle(row.run.inputJson, row.episodeRef),
      projectTitle: runTitle(row.run.inputJson),
      duration: Number.isFinite(duration) ? duration : 0,
      createdAt: row.createdAt.toISOString(),
      url: mediaUrl(row.providerId, row.outputUrl as string),
      providerId: row.providerId,
      shotOrder: row.shotOrder,
      status: "completed" as const,
      kind: "clip" as const,
    };
  });

  const combined = new Map<string, typeof clips>();
  for (const clip of clips) {
    const key = `${clip.runId}:${clip.episodeRef}`;
    const existing = combined.get(key) || [];
    existing.push(clip);
    combined.set(key, existing);
  }
  const episodes = Array.from(combined.entries()).filter(([, episodeClips]) => episodeClips.length > 1).map(([key, episodeClips]) => {
    const first = episodeClips[0];
    const ordered = [...episodeClips].sort((a, b) => a.shotOrder - b.shotOrder);
    return {
      id: `episode:${key}`,
      runId: first.runId,
      episodeRef: first.episodeRef,
      ep: first.ep,
      epTitle: first.epTitle,
      projectTitle: first.projectTitle,
      duration: ordered.reduce((sum, item) => sum + item.duration, 0),
      createdAt: first.createdAt,
      status: "completed" as const,
      kind: "combined" as const,
      clips: ordered.map(({ id, url, shotOrder, providerId, duration }) => ({ id, url, shotOrder, providerId, duration })),
    };
  });

  return noStore(NextResponse.json({ videos: [...episodes, ...clips] }));
}
