import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { suggestProductionChoices } from "@/lib/ai-suggest";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const field = typeof body.field === "string" ? body.field.trim() : "";
  if (!field) return NextResponse.json({ error: "FIELD_REQUIRED" }, { status: 400 });
  const context = body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context as Record<string, unknown> : {};
  const result = await suggestProductionChoices({
    userId: user.id,
    field,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    sceneId: typeof body.sceneId === "string" ? body.sceneId : undefined,
    context,
  });
  return NextResponse.json({ ok: true, ...result });
}
