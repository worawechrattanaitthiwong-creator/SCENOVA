import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import type { Project } from "@/lib/domain";
import { startAgentRun } from "@/lib/agent/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const body = (await request.json()) as { project?: Project; episodeIndex?: number; maxEpisodes?: number; budgetThb?: number };
    if (!body.project?.episodes?.[body.episodeIndex ?? 0]) return NextResponse.json({ error: "Project/Episode ไม่ถูกต้อง" }, { status: 400 });

    const run = await startAgentRun({
      userId: user.id,
      project: body.project,
      episodeIndex: body.episodeIndex,
      maxEpisodes: body.maxEpisodes || 1,
      budgetThb: body.budgetThb,
      mode: "MOCK_AGENT_GENERATION",
    });

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      stage: run.stage,
      poll: `/api/agent/runs/${run.id}`,
      note: "Mock generation ถูกย้ายออกจาก HTTP request แล้ว ต้องรัน npm run agent:worker เพื่อประมวลผลคิว",
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mock generation enqueue failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
