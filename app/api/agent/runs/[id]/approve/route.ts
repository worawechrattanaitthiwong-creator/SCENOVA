import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { approveAgentRun, enqueueAgentStep, getAgentRunForUser, recordAgentDecision, saveAgentRun } from "@/lib/agent/store";
import { getAgentPolicy } from "@/lib/agent/policy";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const run = await getAgentRunForUser(id, user.id);
  if (!run) return NextResponse.json({ error: "AGENT_RUN_NOT_FOUND" }, { status: 404 });
  if (run.status !== "WAITING_APPROVAL" || run.stage !== "AWAIT_APPROVAL") return NextResponse.json({ error: "AGENT_RUN_NOT_WAITING_APPROVAL" }, { status: 409 });

  const approval = await approveAgentRun(run.id, user.id);
  if (!approval) return NextResponse.json({ error: "PENDING_APPROVAL_NOT_FOUND" }, { status: 409 });
  run.status = "QUEUED";
  run.stage = "GENERATE";
  run.stopReason = null;
  await saveAgentRun(run);
  await recordAgentDecision({ runId: run.id, stage: "AWAIT_APPROVAL", action: "USER_APPROVED", reason: "ผู้ใช้อนุมัติแผนและงบประมาณแล้ว จึงอนุญาตให้ Agent ไปขั้น Generate" });
  await enqueueAgentStep(run.id, { reason: "human-approved" }, 0, getAgentPolicy().maxRetriesPerStep + 1);
  return NextResponse.json({ ok: true, runId: run.id, status: run.status, stage: run.stage });
}
