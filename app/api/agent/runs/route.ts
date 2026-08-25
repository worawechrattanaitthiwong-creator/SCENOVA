import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import type { Project } from "@/lib/domain";
import { startAgentRun } from "@/lib/agent/service";
import { listAgentRunsForUser } from "@/lib/agent/store";

export const runtime = "nodejs";

async function currentUser() {
  const store = await cookies();
  return resolveSession(store.get("scenova_session")?.value);
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const runs = await listAgentRunsForUser(user.id, 30);
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const body = (await request.json()) as { project?: Project; episodeIndex?: number; maxEpisodes?: number; budgetThb?: number; mode?: string };
    if (!body.project) return NextResponse.json({ error: "project is required" }, { status: 400 });
    const run = await startAgentRun({ userId: user.id, project: body.project, episodeIndex: body.episodeIndex, maxEpisodes: body.maxEpisodes, budgetThb: body.budgetThb, mode: body.mode });
    return NextResponse.json({ runId: run.id, status: run.status, stage: run.stage, poll: `/api/agent/runs/${run.id}`, note: "งานถูกส่งเข้าคิวแล้ว Web request จะไม่รอ Video Generation" }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AGENT_RUN_CREATE_FAILED";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
