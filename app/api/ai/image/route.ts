import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth-core";
import { generateImageForUser } from "@/lib/providers/image-runtime";

export const runtime = "nodejs";

const referenceSchema = z.object({
  data: z.string().min(16).max(25_000_000),
  mimeType: z.string().regex(/^image\/[a-z0-9.+-]+$/i),
});

const requestSchema = z.object({
  prompt: z.string().trim().min(1).max(30_000),
  aspectRatio: z.string().trim().max(16).optional(),
  quality: z.enum(["low", "medium", "high"]).optional(),
  references: z.array(referenceSchema).max(16).optional(),
  billingMode: z.enum(["AUTO", "BYOK", "SYSTEM"]).optional(),
  provider: z.enum(["openai-image", "gemini-image", "runway-image"]).optional(),
});

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await generateImageForUser({
      userId: user.id,
      prompt: parsed.data.prompt,
      aspectRatio: parsed.data.aspectRatio,
      quality: parsed.data.quality,
      references: parsed.data.references,
      billingMode: parsed.data.billingMode,
      preferredProvider: parsed.data.provider,
    });
    return NextResponse.json({
      ok: true,
      provider: result.provider,
      modelId: result.modelId,
      billingMode: result.billingMode,
      image: { mimeType: result.mimeType, base64: result.base64 },
      revisedPrompt: result.revisedPrompt || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "IMAGE_GENERATION_FAILED";
    const status = message.includes("429") || message.includes("RATE_LIMIT") ? 429
      : message.includes("401") || message.includes("403") || message.includes("CONNECTION_REQUIRED") || message.includes("API_KEY") ? 400
        : message.startsWith("EMERGENCY_") || message.includes("DISABLED") ? 503
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
