import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { estimateGenerationQuote } from "@/lib/cost-transparency";
import type { Project } from "@/lib/domain";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.project || typeof body.project !== "object") return NextResponse.json({ error: "PROJECT_REQUIRED" }, { status: 400 });
  try {
    const quote = await estimateGenerationQuote({ userId: user.id, project: body.project as Project, episodeIndex: Number(body.episodeIndex || 0) });
    return NextResponse.json({ ok: true, quote });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "ESTIMATE_FAILED" }, { status: 400 });
  }
}
