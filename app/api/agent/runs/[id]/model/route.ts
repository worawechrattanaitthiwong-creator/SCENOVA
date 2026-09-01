import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { getAgentRunForUser, recordAgentDecision } from "@/lib/agent/store";
import { listUserApiConnections } from "@/lib/api-connections/store";
import { getPublicProviderCatalog } from "@/lib/api-connections/providers";
import { VIDEO_MODELS } from "@/lib/catalogs";
import type { Project } from "@/lib/domain";
import { getVideoModelVersions } from "@/lib/video-model-versions";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function providerIdForModel(modelId: string) {
  if (modelId === "seedance-2-5") return "seedance";
  return modelId;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await context.params;
  const run = await getAgentRunForUser(id, user.id);
  if (!run) return NextResponse.json({ error: "AGENT_RUN_NOT_FOUND" }, { status: 404 });
  if (!["PAUSED", "FAILED"].includes(run.status)) {
    return NextResponse.json({
      error: "กรุณาพักงานก่อนแก้โมเดล งานเดิมและ Artifact ที่ทำเสร็จแล้วจะยังคงอยู่",
      code: "AGENT_RUN_MUST_BE_PAUSED",
    }, { status: 409 });
  }

  const body = await request.json().catch(() => ({})) as { modelId?: string; modelVersionId?: string };
  const modelId = String(body.modelId || "").trim();
  const model = VIDEO_MODELS.find((item) => item.id === modelId && item.enabled);
  if (!model) return NextResponse.json({ error: "ไม่พบโมเดลวิดีโอที่เลือก", code: "VIDEO_MODEL_INVALID" }, { status: 400 });

  const versions = getVideoModelVersions(model.name);
  const requestedVersion = String(body.modelVersionId || "").trim();
  const version = versions.find((item) => item.apiModelId === requestedVersion || item.id === requestedVersion)
    || versions.find((item) => item.recommended)
    || versions[0];
  if (!version) return NextResponse.json({ error: "โมเดลนี้ยังไม่มีรุ่นที่พร้อมใช้งาน", code: "VIDEO_MODEL_VERSION_INVALID" }, { status: 400 });

  const providerId = providerIdForModel(model.id);
  const [connections, catalog] = await Promise.all([
    listUserApiConnections(user.id),
    Promise.resolve(getPublicProviderCatalog()),
  ]);
  const provider = catalog.find((item) => item.kind === "VIDEO" && item.id === providerId);
  const connected = connections.some((item) => item.kind === "VIDEO" && item.provider === providerId && item.enabled && item.status === "CONNECTED");
  const ready = Boolean(provider?.ready && (connected || provider.systemConfigured));
  if (!ready) {
    return NextResponse.json({
      error: `${model.name} ยังไม่พร้อมใช้งาน กรุณาเชื่อมต่อและทดสอบ Provider ใน API & Models ก่อน`,
      code: "VIDEO_MODEL_NOT_READY",
      providerId,
    }, { status: 409 });
  }

  const input = run.inputJson && typeof run.inputJson === "object" && !Array.isArray(run.inputJson)
    ? run.inputJson as { project?: Project; [key: string]: unknown }
    : {};
  if (!input.project) return NextResponse.json({ error: "ไม่พบรายละเอียดโปรเจกต์เดิมของงานนี้", code: "AGENT_PROJECT_NOT_FOUND" }, { status: 409 });

  const previousModelId = input.project.mainModelId;
  const previousVersionId = input.project.mainModelVersionId || null;
  const nextInput = {
    ...input,
    project: {
      ...input.project,
      mainModelId: model.id,
      mainModelVersionId: version.apiModelId,
    },
  };
  const nextState = {
    ...(run.stateJson || {}),
    selectedProviderId: null,
    providerSwitches: 0,
  };
  const inputJson = JSON.stringify(nextInput);
  const stateJson = JSON.stringify(nextState);

  await prisma.$executeRaw`
    UPDATE "AgentRun"
    SET "inputJson"=${inputJson}::jsonb,
        "stateJson"=${stateJson}::jsonb,
        "updatedAt"=NOW()
    WHERE "id"=${run.id} AND "userId"=${user.id}
  `;

  await recordAgentDecision({
    runId: run.id,
    stage: run.stage,
    action: "USER_CHANGED_VIDEO_MODEL",
    reason: `ผู้ใช้เปลี่ยนเฉพาะโมเดลวิดีโอของงานเดิมเป็น ${model.name} · ${version.label} โดยคงรายละเอียดและ Artifact เดิมไว้`,
    providerId,
    metadata: {
      previousModelId,
      previousVersionId,
      modelId: model.id,
      modelVersionId: version.apiModelId,
    },
  });

  return NextResponse.json({
    ok: true,
    runId: run.id,
    status: run.status,
    model: { id: model.id, name: model.name, versionId: version.apiModelId, versionLabel: version.label, providerId },
    message: "บันทึกโมเดลและรุ่นใหม่แล้ว รายละเอียดงานเดิมยังอยู่ครบ",
  });
}
