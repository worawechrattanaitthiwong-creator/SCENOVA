import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Project } from "@/lib/domain";
import { resolveSession } from "@/lib/auth-core";
import { createCinematicCoveragePlan } from "@/lib/cinematic-coverage";
import { composeDirectPrompts, directMaxSecondsForProvider } from "@/lib/direct-render";
import { systemAiErrorMessage } from "@/lib/llm/system-ai";
import { getUserVideoProviderById, getVideoProviderById } from "@/lib/providers/provider-registry";

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
      coveragePresetId?: unknown;
      coverageInstruction?: unknown;
    } | null;
    if (!body || !validProject(body.project)) {
      return NextResponse.json({ error: "DIRECT_RENDER_PROJECT_REQUIRED" }, { status: 400 });
    }
    const providerId = typeof body.providerId === "string" ? body.providerId.trim() : "";
    if (!providerId) return NextResponse.json({ error: "DIRECT_RENDER_PROVIDER_REQUIRED" }, { status: 400 });

    // Prompt composition does not require a usable video credential. Prefer the
    // user's exact provider runtime so duration/model metadata stays identical to
    // generation, but fall back to the credential-free adapter for preview/copy.
    const userProvider = await getUserVideoProviderById(user.id, providerId);
    const provider = userProvider || getVideoProviderById(providerId);
    if (!provider) return NextResponse.json({ error: `VIDEO_PROVIDER_ADAPTER_NOT_FOUND:${providerId}` }, { status: 400 });

    const modelVersionId = typeof body.modelVersionId === "string" ? body.modelVersionId : body.project.mainModelVersionId;
    const definition = provider.getModelDefinition();
    const maxSecondsPerGeneration = directMaxSecondsForProvider(provider, modelVersionId);
    const coverage = await createCinematicCoveragePlan({
      userId: user.id,
      project: body.project,
      presetId: typeof body.coveragePresetId === "string" ? body.coveragePresetId : "creature-encounter",
      customInstruction: typeof body.coverageInstruction === "string" ? body.coverageInstruction : "",
      providerId,
      providerSupportsMultiShot: definition.supportsMultiShot,
      maxSecondsPerGeneration,
    });
    const result = await composeDirectPrompts({
      userId: user.id,
      project: coverage.project,
      provider,
      modelVersionId,
    });
    return NextResponse.json({
      ok: true,
      videoConnectionRequired: !userProvider,
      renderProject: coverage.project,
      coverage: coverage.plan,
      coverageMeta: coverage.meta,
      ...result,
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "DIRECT_PROMPT_FAILED";
    const code = rawMessage.split(":")[0];
    const systemAiFailure = code.startsWith("SYSTEM_AI_") || code.startsWith("LLM_");
    const message = systemAiFailure ? systemAiErrorMessage(code) : rawMessage;
    const status = systemAiFailure ? 503
      : rawMessage.includes("429") || rawMessage.includes("RATE_LIMIT") ? 429
        : rawMessage.includes("ADAPTER_NOT_FOUND") ? 400
          : rawMessage === "INSUFFICIENT_CREDITS" ? 402
            : 500;
    return NextResponse.json({ error: message, code }, { status });
  }
}
