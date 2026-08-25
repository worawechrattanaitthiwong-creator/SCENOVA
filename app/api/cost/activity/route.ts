import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { getCreditActivity } from "@/lib/cost-transparency";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(250, Number(url.searchParams.get("limit") || 100)));
  return NextResponse.json({ ok: true, ...(await getCreditActivity(user.id, limit)) });
}
