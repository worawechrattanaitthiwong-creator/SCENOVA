import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { ensureAgentRunHasQueueJob, getAgentRuntimeHealth } from "@/lib/agent/runtime-health";
import { readAgentWorkerHeartbeat } from "@/lib/agent/worker-heartbeat";
import { runAgentWorkerOnce } from "@/lib/agent/worker-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let fallbackBusy = false;
let lastFallbackKickAt = 0;

async function currentUser() {
  const store = await cookies();
  return resolveSession(store.get("scenova_session")?.value);
}

function requestedRunId(request: Request) {
  const url = new URL(request.url);
  const value = url.searchParams.get("run");
  return value?.trim() || null;
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const [health, worker] = await Promise.all([
    getAgentRuntimeHealth(user.id, requestedRunId(request)),
    readAgentWorkerHeartbeat(),
  ]);
  return NextResponse.json({ ...health, worker, viewerRole: user.role }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { runId?: string };
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  if (!runId) return NextResponse.json({ error: "RUN_ID_REQUIRED" }, { status: 400 });

  const before = await getAgentRuntimeHealth(user.id, runId);
  if (!before.run) return NextResponse.json({ error: "AGENT_RUN_NOT_FOUND" }, { status: 404 });
  if (before.security.blocked) {
    return NextResponse.json({
      error: before.message,
      code: before.security.environmentHardLock ? "AGENT_ENVIRONMENT_LOCKED" : "AGENT_SECURITY_BLOCKED",
      health: before,
      worker: await readAgentWorkerHeartbeat(),
    }, { status: 423 });
  }

  if (["waiting_approval", "paused", "completed", "failed", "cancelled"].includes(before.runtimeState)) {
    return NextResponse.json({ ok: true, kicked: false, repair: null, health: before, worker: await readAgentWorkerHeartbeat() });
  }

  const repair = await ensureAgentRunHasQueueJob(runId);
  let kicked = false;
  let kickError: string | null = null;
  const now = Date.now();
  const shouldKick = ["stalled", "orphaned", "starting"].includes(before.runtimeState);

  if (shouldKick && !fallbackBusy && now - lastFallbackKickAt >= 4_000) {
    fallbackBusy = true;
    lastFallbackKickAt = now;
    try {
      kicked = await runAgentWorkerOnce(`web-fallback-${process.pid}`);
    } catch (error) {
      kickError = error instanceof Error ? error.message : String(error);
      console.error("[agent-runtime] web fallback worker failed", { runId, userId: user.id, error: kickError });
    } finally {
      fallbackBusy = false;
    }
  }

  const [health, worker] = await Promise.all([
    getAgentRuntimeHealth(user.id, runId),
    readAgentWorkerHeartbeat(),
  ]);
  return NextResponse.json({ ok: !kickError, kicked, kickError, repair, health, worker });
}
