import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { getAgentRunForUser } from "@/lib/agent/store";
import { resumeRunByUser } from "@/lib/agent/control";
import { isolateOtherPausedRunQueues, isolatePausedRunQueue } from "@/lib/agent/run-queue-isolation";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const run = await getAgentRunForUser(id, user.id);
  if (!run) return NextResponse.json({ error: "AGENT_RUN_NOT_FOUND" }, { status: 404 });
  try {
    // Clean queue residue before starting exactly this card. Other paused runs
    // remain paused and are made ineligible for worker execution.
    await isolateOtherPausedRunQueues(user.id, id);
    await isolatePausedRunQueue(user.id, id, "TARGET_RUN_RESUME_QUEUE_REFRESH");
    const updated = await resumeRunByUser(run);
    return NextResponse.json({ ok: true, runId: updated.id, status: updated.status, stage: updated.stage });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "RESUME_FAILED" }, { status: 409 });
  }
}
