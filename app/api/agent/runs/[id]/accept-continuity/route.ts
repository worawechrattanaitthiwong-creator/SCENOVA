import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-core";
import { getAgentRunForUser } from "@/lib/agent/store";
import { acceptContinuityByUser } from "@/lib/agent/control";
import { isolateOtherPausedRunQueues, isolatePausedRunQueue } from "@/lib/agent/run-queue-isolation";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await cookies();
  const user = await resolveSession(session.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const run = await getAgentRunForUser(id, user.id);
  if (!run) return NextResponse.json({ error: "AGENT_RUN_NOT_FOUND" }, { status: 404 });
  try {
    await isolateOtherPausedRunQueues(user.id, id);
    await isolatePausedRunQueue(user.id, id, "TARGET_RUN_CONTINUITY_ACCEPT_QUEUE_REFRESH");
    const updated = await acceptContinuityByUser(run, user.id);
    return NextResponse.json({ ok: true, runId: updated.id, status: updated.status, stage: updated.stage });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "CONTINUITY_ACCEPT_FAILED" }, { status: 409 });
  }
}
