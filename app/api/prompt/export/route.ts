import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { getPromptExportStatus, unlockPromptExport, type PromptExportScope } from "@/lib/prompt-export";

export const runtime = "nodejs";

function scopeOf(value: unknown): PromptExportScope {
  return value === "pro-multimodel" ? "pro-multimodel" : "production";
}

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body.prompt === undefined || body.prompt === null) return NextResponse.json({ error: "PROMPT_REQUIRED" }, { status: 400 });
  const input = { userId: user.id, prompt: body.prompt, version: Number(body.version || 1), scope: scopeOf(body.scope) };
  try {
    if (body.preview === true) return NextResponse.json({ ok: true, ...(await getPromptExportStatus(input)) });
    const result = await unlockPromptExport(input);
    return NextResponse.json({ ok: true, ...result, prompt: body.prompt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROMPT_EXPORT_FAILED";
    return NextResponse.json({ error: message }, { status: message === "INSUFFICIENT_CREDITS" ? 402 : 400 });
  }
}
