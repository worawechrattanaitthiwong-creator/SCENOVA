import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { prisma } from "@/lib/db";
import { ensureCoreAgentDefinitions } from "@/lib/agent/workflow-store";

export const runtime = "nodejs";

export async function GET() {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  await ensureCoreAgentDefinitions();
  const agents = await prisma.agentDefinition.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ agents });
}
