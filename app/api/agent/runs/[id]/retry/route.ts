import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { getAgentRunForUser } from "@/lib/agent/store";
import { retryFailedRunByUser } from "@/lib/agent/control";
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
    // Retry is scoped to this run only. Remove stale runnable queue rows from
    // this paused run and every paused sibling before creating the fresh retry.
    await isolateOtherPausedRunQueues(user.id, id);
    await isolatePausedRunQueue(user.id, id, "TARGET_RUN_RETRY_QUEUE_REFRESH");
    const updated = await retryFailedRunByUser(run);
    return NextResponse.json({
      ok: true,
      runId: updated.id,
      status: updated.status,
      stage: updated.stage,
      message: "นำเฉพาะงานที่เลือกกลับเข้าคิวจากขั้นที่ล้มเหลวแล้ว",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AGENT_RETRY_FAILED" }, { status: 409 });
  }
}
