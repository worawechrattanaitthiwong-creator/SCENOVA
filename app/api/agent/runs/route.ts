import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { listAgentRunsForUser } from "@/lib/agent/store";

export const runtime = "nodejs";

async function currentUser() {
  const store = await cookies();
  return resolveSession(store.get("scenova_session")?.value);
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", code: "UNAUTHORIZED" }, { status: 401 });
  const runs = await listAgentRunsForUser(user.id, 30);
  return NextResponse.json({ runs, legacyHistoryOnly: true });
}

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", code: "UNAUTHORIZED" }, { status: 401 });

  // Production Agent runs are intentionally retired. The Agent now stops at a
  // validated structured plan. Studio/Series owns every explicit video action.
  return NextResponse.json({
    error: "AI Agent เป็นโหมดวางแผนเท่านั้น กรุณาสร้างแผนที่ /api/agent/plan แล้วนำไปตรวจใน AI Studio หรือ Series Studio",
    code: "AGENT_PRODUCTION_RUN_DISABLED",
    plannerEndpoint: "/api/agent/plan",
  }, { status: 410 });
}
