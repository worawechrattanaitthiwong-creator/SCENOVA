import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { resolveSession } from "@/lib/auth-core";
import { agentStructuredPlanSchema } from "@/lib/agent/plan-schema";
import { verifyAgentPlanTransfer } from "@/lib/agent/plan-transfer-server";

export const runtime = "nodejs";

const requestSchema = z.object({
  token: z.string().min(1).max(4000),
  plan: z.unknown(),
  target: z.enum(["studio", "series"]),
  projectKey: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "INVALID_TRANSFER_REQUEST" }, { status: 400 });
  const parsedPlan = agentStructuredPlanSchema.safeParse(body.data.plan);
  if (!parsedPlan.success || parsedPlan.data.target !== body.data.target) {
    return NextResponse.json({ error: "INVALID_AGENT_PLAN" }, { status: 400 });
  }

  const valid = verifyAgentPlanTransfer({
    token: body.data.token,
    userId: user.id,
    target: body.data.target,
    projectKey: body.data.projectKey,
    plan: parsedPlan.data,
  });
  if (!valid) return NextResponse.json({ error: "AGENT_PLAN_TRANSFER_FORBIDDEN" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
