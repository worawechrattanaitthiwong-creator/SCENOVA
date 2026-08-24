import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { getAgentRunDetails } from "@/lib/agent/store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const details = await getAgentRunDetails(id, user.id);
  if (!details) return NextResponse.json({ error: "AGENT_RUN_NOT_FOUND" }, { status: 404 });
  return NextResponse.json(details);
}
