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

function agentError(code: string) {
  const known: Record<string, { status: number; message: string }> = {
    AGENT_USER_CONCURRENCY_LIMIT: {
      status: 409,
      message: "มีงาน AI กำลังทำครบจำนวนแล้ว กรุณารอให้งานเดิมเสร็จหรือยกเลิกงานเดิมก่อน",
    },
    AGENT_EPISODE_NOT_FOUND: {
      status: 400,
      message: "ไม่พบข้อมูลตอนที่จะผลิต กรุณาตรวจ Storyboard แล้วลองใหม่",
    },
    UNAUTHORIZED: {
      status: 401,
      message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วส่งงานอีกครั้ง",
    },
  };
  if (known[code]) return known[code];
  if (code.includes("RATE_LIMIT")) return { status: 429, message: "ส่งงานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" };
  if (code.includes("EMERGENCY") || code.includes("KILL_SWITCH")) return { status: 503, message: "ระบบสร้างงานถูกพักชั่วคราวโดยผู้ดูแล กรุณาตรวจสถานะระบบก่อนลองใหม่" };
  return { status: 400, message: "ส่งงานให้ทีม AI ไม่สำเร็จ กรุณาตรวจข้อมูล เครดิต และ API & Models แล้วลองใหม่" };
}

export async function GET() {
  const user = await currentUser();
  if (!user) {
    const error = agentError("UNAUTHORIZED");
    return NextResponse.json({ error: error.message, code: "UNAUTHORIZED" }, { status: error.status });
  }
  const runs = await listAgentRunsForUser(user.id, 30);
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    const error = agentError("UNAUTHORIZED");
    return NextResponse.json({ error: error.message, code: "UNAUTHORIZED" }, { status: error.status });
  }

  const body = await request.json().catch(() => null) as { project?: Project; episodeIndex?: number; maxEpisodes?: number; budgetThb?: number; mode?: string } | null;
  if (!body?.project) {
    return NextResponse.json({ error: "ข้อมูล Storyboard ไม่ครบ กรุณากรอกเรื่องและตรวจข้อมูลตอนก่อนส่งงาน", code: "PROJECT_REQUIRED" }, { status: 400 });
  }

  try {
    const run = await startAgentRun({
      userId: user.id,
      project: body.project,
      episodeIndex: body.episodeIndex,
      maxEpisodes: body.maxEpisodes,
      budgetThb: body.budgetThb,
      mode: body.mode,
    });
    return NextResponse.json({
      runId: run.id,
      status: run.status,
      stage: run.stage,
      poll: `/api/agent/runs/${run.id}`,
      note: "งานถูกส่งเข้าคิวแล้ว Web request จะไม่รอ Video Generation",
    }, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "AGENT_RUN_CREATE_FAILED";
    const friendly = agentError(code);
    console.error("[agent-runs] failed to create run", { userId: user.id, code });
    return NextResponse.json({ error: friendly.message, code }, { status: friendly.status });
  }
}
