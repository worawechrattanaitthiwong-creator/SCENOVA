import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { getAgentRunForUser } from "@/lib/agent/store";
import { pauseRunByUser } from "@/lib/agent/control";
import { isolatePausedRunQueue } from "@/lib/agent/run-queue-isolation";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const run = await getAgentRunForUser(id, user.id);
  if (!run) return NextResponse.json({ error: "AGENT_RUN_NOT_FOUND" }, { status: 404 });
  try {
    const updated = await pauseRunByUser(run);
    // A paused card owns its pause state: leave no runnable queue row behind
    // that could later be picked by another worker lane.
    await isolatePausedRunQueue(user.id, updated.id, "USER_PAUSED_QUEUE_ISOLATED");
    return NextResponse.json({ ok: true, runId: updated.id, status: updated.status, stage: updated.stage });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "PAUSE_FAILED" }, { status: 409 });
  }
}
