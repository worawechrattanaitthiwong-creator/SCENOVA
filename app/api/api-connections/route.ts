import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth-core";
import { prisma } from "@/lib/db";
import {
  deleteUserApiConnection,
  getUserApiConnectionSecretById,
  listUserApiConnections,
  patchUserApiConnection,
  upsertUserApiConnection,
  type ApiConnectionKind,
} from "@/lib/api-connections/store";
import {
  discoverProviderModels,
  getProviderDefinition,
  getPublicProviderCatalog,
} from "@/lib/api-connections/providers";
import { buildApiRoutingSnapshot } from "@/lib/api-connections/routing";
import { buildSharedApiConnections } from "@/lib/api-connections/shared-credentials";

export const runtime = "nodejs";

const kindSchema = z.enum(["ANALYZER", "VIDEO", "IMAGE", "VOICE"]);
const modelIdsSchema = z.array(z.string().trim().min(1).max(200)).min(1).max(500);

const discoverSchema = z.object({
  action: z.literal("DISCOVER"),
  provider: z.string().trim().min(1).max(60),
  kind: kindSchema,
  apiKey: z.string().trim().min(8).max(4096),
  baseUrl: z.string().trim().url().max(500).nullable().optional(),
});

const createSchema = z.object({
  provider: z.string().trim().min(1).max(60),
  kind: kindSchema,
  apiKey: z.string().trim().min(8).max(4096),
  modelId: z.string().trim().min(1).max(200),
  enabledModelIds: modelIdsSchema,
  baseUrl: z.string().trim().url().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  modelId: z.string().trim().min(1).max(200).nullable().optional(),
  enabledModelIds: modelIdsSchema.optional(),
  syncModels: z.boolean().optional(),
}).refine((value) => value.enabled !== undefined
  || value.isDefault !== undefined
  || value.modelId !== undefined
  || value.enabledModelIds !== undefined
  || value.syncModels === true, {
  message: "NO_CHANGES",
});

async function currentUser() {
  const store = await cookies();
  return resolveSession(store.get("scenova_session")?.value);
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "API_CONNECTION_NOT_FOUND") return NextResponse.json({ error: message }, { status: 404 });
  if (message.startsWith("API_KEY_ENCRYPTION_KEY")) return NextResponse.json({ error: "SERVER_SECRET_CONFIGURATION_REQUIRED" }, { status: 503 });
  return NextResponse.json({ error: message }, { status: 400 });
}

function uniqueModelIds(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function providerError(result: { code?: string; message?: string }) {
  return NextResponse.json(
    { error: result.code || "PROVIDER_CONNECTION_FAILED", message: result.message || "เชื่อมต่อ Provider ไม่สำเร็จ" },
    { status: result.code === "INVALID_API_KEY" ? 401 : 400 },
  );
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const connections = await listUserApiConnections(user.id);
    const sharedConnections = buildSharedApiConnections(connections);
    return NextResponse.json({
      ok: true,
      connections,
      sharedConnections,
      providers: getPublicProviderCatalog(),
      routing: buildApiRoutingSnapshot(connections),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && (body as { action?: unknown }).action === "DISCOVER") {
    const parsed = discoverSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten() }, { status: 400 });
    const provider = parsed.data.provider.toLowerCase();
    const kind = parsed.data.kind as ApiConnectionKind;
    const definition = getProviderDefinition(provider, kind);
    if (!definition) return NextResponse.json({ error: "UNSUPPORTED_PROVIDER" }, { status: 400 });
    const result = await discoverProviderModels({
      provider,
      kind,
      apiKey: parsed.data.apiKey,
      baseUrl: parsed.data.baseUrl,
    });
    if (!result.ok) return providerError(result);
    return NextResponse.json({
      ok: true,
      provider,
      kind,
      baseUrl: result.baseUrl,
      defaultModelId: result.defaultModelId,
      models: result.models,
    });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten() }, { status: 400 });

  const provider = parsed.data.provider.toLowerCase();
  const kind = parsed.data.kind as ApiConnectionKind;
  const definition = getProviderDefinition(provider, kind);
  if (!definition) return NextResponse.json({ error: "UNSUPPORTED_PROVIDER" }, { status: 400 });

  const discovery = await discoverProviderModels({
    provider,
    kind,
    apiKey: parsed.data.apiKey,
    baseUrl: parsed.data.baseUrl,
  });
  if (!discovery.ok) return providerError(discovery);

  const enabledModelIds = uniqueModelIds(parsed.data.enabledModelIds);
  const availableIds = new Set(discovery.models.map((model) => model.apiModelId));
  if (availableIds.size && enabledModelIds.some((modelId) => !availableIds.has(modelId))) {
    return NextResponse.json({ error: "MODEL_NOT_AVAILABLE_FOR_CONNECTION" }, { status: 409 });
  }
  if (!enabledModelIds.includes(parsed.data.modelId)) {
    return NextResponse.json({ error: "DEFAULT_MODEL_MUST_BE_ENABLED" }, { status: 409 });
  }

  try {
    const connection = await upsertUserApiConnection({
      userId: user.id,
      provider,
      kind,
      apiKey: parsed.data.apiKey,
      modelId: parsed.data.modelId,
      enabledModelIds,
      availableModels: discovery.models,
      baseUrl: discovery.baseUrl,
      enabled: parsed.data.enabled,
      isDefault: parsed.data.isDefault,
      status: "CONNECTED",
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "API_CONNECTION_UPSERT",
        resource: "UserApiConnection",
        resourceId: connection.id,
        metadata: {
          provider,
          kind,
          modelId: connection.modelId,
          enabledModelIds: connection.enabledModelIds,
          keyLast4: connection.maskedKey.slice(-4),
        },
      },
    });

    return NextResponse.json({ ok: true, connection });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten() }, { status: 400 });

  try {
    if (parsed.data.syncModels) {
      const secret = await getUserApiConnectionSecretById(user.id, parsed.data.id);
      if (!secret) return NextResponse.json({ error: "API_CONNECTION_NOT_FOUND" }, { status: 404 });
      const discovery = await discoverProviderModels({
        provider: secret.connection.provider,
        kind: secret.connection.kind,
        apiKey: secret.apiKey,
        baseUrl: secret.connection.baseUrl,
      });
      if (!discovery.ok) return providerError(discovery);

      const availableIds = new Set(discovery.models.map((model) => model.apiModelId));
      let enabledModelIds = secret.connection.enabledModelIds.filter((modelId) => !availableIds.size || availableIds.has(modelId));
      if (!enabledModelIds.length && discovery.defaultModelId) enabledModelIds = [discovery.defaultModelId];
      const modelId = secret.connection.modelId && enabledModelIds.includes(secret.connection.modelId)
        ? secret.connection.modelId
        : enabledModelIds[0] || discovery.defaultModelId || null;

      const connection = await patchUserApiConnection({
        userId: user.id,
        id: parsed.data.id,
        modelId,
        enabledModelIds,
        availableModels: discovery.models,
        baseUrl: discovery.baseUrl,
        status: "CONNECTED",
        lastError: null,
      });
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "API_CONNECTION_MODELS_SYNC",
          resource: "UserApiConnection",
          resourceId: connection.id,
          metadata: { provider: connection.provider, modelId: connection.modelId, enabledModelIds: connection.enabledModelIds },
        },
      });
      return NextResponse.json({ ok: true, connection });
    }

    const connections = await listUserApiConnections(user.id);
    const current = connections.find((connection) => connection.id === parsed.data.id);
    if (!current) return NextResponse.json({ error: "API_CONNECTION_NOT_FOUND" }, { status: 404 });

    const enabledModelIds = parsed.data.enabledModelIds ? uniqueModelIds(parsed.data.enabledModelIds) : undefined;
    if (enabledModelIds) {
      const availableIds = new Set(current.availableModels.map((model) => model.apiModelId));
      if (availableIds.size && enabledModelIds.some((modelId) => !availableIds.has(modelId))) {
        return NextResponse.json({ error: "MODEL_NOT_AVAILABLE_FOR_CONNECTION" }, { status: 409 });
      }
    }
    const modelId = parsed.data.modelId !== undefined
      ? parsed.data.modelId
      : enabledModelIds && !enabledModelIds.includes(current.modelId || "")
        ? enabledModelIds[0]
        : undefined;
    if (modelId && enabledModelIds && !enabledModelIds.includes(modelId)) {
      return NextResponse.json({ error: "DEFAULT_MODEL_MUST_BE_ENABLED" }, { status: 409 });
    }

    const connection = await patchUserApiConnection({
      userId: user.id,
      id: parsed.data.id,
      enabled: parsed.data.enabled,
      isDefault: parsed.data.isDefault,
      modelId,
      enabledModelIds,
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "API_CONNECTION_UPDATE",
        resource: "UserApiConnection",
        resourceId: connection.id,
        metadata: {
          enabled: connection.enabled,
          isDefault: connection.isDefault,
          modelId: connection.modelId,
          enabledModelIds: connection.enabledModelIds,
        },
      },
    });
    return NextResponse.json({ ok: true, connection });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    const deleted = await deleteUserApiConnection(user.id, id);
    if (!deleted) return NextResponse.json({ error: "API_CONNECTION_NOT_FOUND" }, { status: 404 });
    await prisma.auditLog.create({
      data: { userId: user.id, action: "API_CONNECTION_DELETE", resource: "UserApiConnection", resourceId: id },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
