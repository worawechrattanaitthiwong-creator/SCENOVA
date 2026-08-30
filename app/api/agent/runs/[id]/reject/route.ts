import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { getAgentRunForUser } from "@/lib/agent/store";
import { rejectPendingRunApproval } from "@/lib/agent/control";
import { decideLatestHumanCheckpoint } from "@/lib/agent/workflow-store";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const run = await getAgentRunForUser(id, user.id);
  if (!run) return NextResponse.json({ error: "AGENT_RUN_NOT_FOUND" }, { status: 404 });
  try {
    const updated = await rejectPendingRunApproval(run, user.id);
    await decideLatestHumanCheckpoint(run.id, user.id, "REJECTED");
    return NextResponse.json({ ok: true, runId: updated.id, status: updated.status, stage: updated.stage });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "REJECT_FAILED" }, { status: 409 });
  }
}
