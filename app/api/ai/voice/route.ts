import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth-core";
import { generateSpeechForUser } from "@/lib/providers/voice-runtime";

export const runtime = "nodejs";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(20_000),
  voice: z.string().trim().min(1).max(256).optional(),
  instructions: z.string().trim().max(2_000).optional(),
  speed: z.number().min(0.25).max(4).optional(),
  billingMode: z.enum(["AUTO", "BYOK", "SYSTEM"]).optional(),
  provider: z.enum(["elevenlabs", "openai-voice"]).optional(),
});

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await generateSpeechForUser({
      userId: user.id,
      text: parsed.data.text,
      voice: parsed.data.voice,
      instructions: parsed.data.instructions,
      speed: parsed.data.speed,
      billingMode: parsed.data.billingMode,
      preferredProvider: parsed.data.provider,
    });

    return new Response(new Uint8Array(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Length": String(result.bytes.length),
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline; filename=\"scenova-speech.mp3\"",
        "X-SCENOVA-Provider": result.provider,
        "X-SCENOVA-Model": result.modelId,
        "X-SCENOVA-Billing": result.billingMode,
        "X-SCENOVA-Voice": result.voiceId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "VOICE_GENERATION_FAILED";
    const status = message.includes("429") || message.includes("RATE_LIMIT") ? 429
      : message.includes("401") || message.includes("403") || message.includes("CONNECTION_REQUIRED") || message.includes("VOICE_ID_REQUIRED") || message.includes("API_KEY") || message.includes("TEXT_TOO_LONG") ? 400
        : message.startsWith("EMERGENCY_") || message.includes("DISABLED") ? 503
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
