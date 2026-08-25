import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { getLlmCostSummary } from "@/lib/llm/usage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const url = new URL(request.url);
  const days = Math.max(1, Math.min(365, Number(url.searchParams.get("days") || 30)));
  return NextResponse.json({ ok: true, summary: await getLlmCostSummary(days) });
}
