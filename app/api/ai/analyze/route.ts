import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth-core";
import { analyzeProductionPrompt } from "@/lib/analyzer/groq";

export const runtime = "nodejs";

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(50_000),
  context: z.record(z.unknown()).optional(),
  billingMode: z.enum(["AUTO", "BYOK", "SYSTEM"]).optional(),
});

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await analyzeProductionPrompt({
      userId: user.id,
      prompt: parsed.data.prompt,
      context: parsed.data.context,
      billingMode: parsed.data.billingMode,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ANALYZER_FAILED";
    const status = message === "INSUFFICIENT_CREDITS" ? 402
      : message.includes("RATE_LIMIT") ? 429
        : message.includes("API_KEY") || message.includes("CONNECTION_REQUIRED") ? 400
          : message.startsWith("EMERGENCY_") || message.startsWith("LLM_DISABLED") ? 503
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
