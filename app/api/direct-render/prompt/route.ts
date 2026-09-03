import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Project } from "@/lib/domain";
import { resolveSession } from "@/lib/auth-core";
import { composeDirectPrompts } from "@/lib/direct-render";
import { getUserVideoProviderById } from "@/lib/providers/provider-registry";

export const runtime = "nodejs";

function validProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<Project>;
  return Boolean(
    typeof project.id === "string"
    && typeof project.title === "string"
    && typeof project.mainModelId === "string"
    && Array.isArray(project.episodes)
    && project.episodes[0]
    && Array.isArray(project.episodes[0].segments),
  );
}

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const body = await request.json().catch(() => null) as {
      project?: unknown;
      providerId?: unknown;
      modelVersionId?: unknown;
    } | null;
    if (!body || !validProject(body.project)) {
      return NextResponse.json({ error: "DIRECT_RENDER_PROJECT_REQUIRED" }, { status: 400 });
    }
    const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
    if (!providerId) return NextResponse.json({ error: "DIRECT_RENDER_PROVIDER_REQUIRED" }, { status: 400 });
    const provider = await getUserVideoProviderById(user.id, providerId);
    if (!provider) return NextResponse.json({ error: `VIDEO_PROVIDER_CONNECTION_REQUIRED:${providerId}` }, { status: 400 });

    const modelVersionId = typeof body.modelVersionId === "string" ? body.modelVersionId : body.project.mainModelVersionId;
    const result = await composeDirectPrompts({
      userId: user.id,
      project: body.project,
      provider,
      modelVersionId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DIRECT_PROMPT_FAILED";
    const status = message.includes("429") || message.includes("RATE_LIMIT") ? 429
      : message.includes("CONNECTION_REQUIRED") || message.includes("API_KEY") ? 400
        : message === "INSUFFICIENT_CREDITS" ? 402
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
