import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeProductionPrompt } from "@/lib/analyzer";
import { resolveSession } from "@/lib/auth-core";

export const runtime = "nodejs";

const requestSchema = z.object({
  prompt: z.string().min(1).max(24_000),
  projectId: z.string().min(1).max(120).nullable().optional(),
}).strict();

const safeErrors = new Set([
  "PROMPT_REQUIRED",
  "PROMPT_TOO_LONG",
  "PROJECT_NOT_FOUND",
  "ANALYZER_NOT_CONFIGURED",
  "ANALYZER_KEY_REJECTED",
  "ANALYZER_RATE_LIMITED",
  "ANALYZER_EMPTY_RESPONSE",
  "SCENOVA_BYOK_MASTER_KEY_REQUIRED",
  "SCENOVA_BYOK_MASTER_KEY_INVALID",
]);

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });

  try {
    const result = await analyzeProductionPrompt({
      userId: user.id,
      prompt: parsed.data.prompt,
      projectId: parsed.data.projectId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ANALYZER_ERROR";
    const safe = safeErrors.has(code) || /^ANALYZER_HTTP_\d{3}$/.test(code) ? code : "ANALYZER_ERROR";
    const status = safe === "PROJECT_NOT_FOUND" ? 404
      : safe === "ANALYZER_NOT_CONFIGURED" ? 503
        : safe === "ANALYZER_KEY_REJECTED" ? 401
          : safe === "ANALYZER_RATE_LIMITED" ? 429
            : 500;
    return NextResponse.json({ error: safe }, { status });
  }
}
