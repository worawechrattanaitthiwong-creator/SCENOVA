import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth-core";
import { prisma } from "@/lib/db";
import {
  deleteUserApiConnection,
  listUserApiConnections,
  patchUserApiConnection,
  upsertUserApiConnection,
  type ApiConnectionKind,
} from "@/lib/api-connections/store";
import { getProviderDefinition, testProviderConnection } from "@/lib/api-connections/providers";

export const runtime = "nodejs";

const kindSchema = z.enum(["ANALYZER", "VIDEO", "IMAGE", "VOICE"]);

const createSchema = z.object({
  provider: z.string().trim().min(1).max(60),
  kind: kindSchema,
  apiKey: z.string().trim().min(8).max(4096),
  modelId: z.string().trim().max(200).nullable().optional(),
  baseUrl: z.string().trim().url().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  modelId: z.string().trim().max(200).nullable().optional(),
}).refine((value) => value.enabled !== undefined || value.isDefault !== undefined || value.modelId !== undefined, {
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

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const connections = await listUserApiConnections(user.id);
    return NextResponse.json({ ok: true, connections });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten() }, { status: 400 });

  const provider = parsed.data.provider.toLowerCase();
  const kind = parsed.data.kind as ApiConnectionKind;
  const definition = getProviderDefinition(provider, kind);
  if (!definition) return NextResponse.json({ error: "UNSUPPORTED_PROVIDER" }, { status: 400 });

  const test = await testProviderConnection({
    provider,
    kind,
    apiKey: parsed.data.apiKey,
    baseUrl: parsed.data.baseUrl,
  });
  if (!test.ok) return NextResponse.json({ error: test.code, message: test.message }, { status: test.code === "INVALID_API_KEY" ? 401 : 400 });

  try {
    const connection = await upsertUserApiConnection({
      userId: user.id,
      provider,
      kind,
      apiKey: parsed.data.apiKey,
      modelId: parsed.data.modelId || test.modelId || definition.defaultModelId || null,
      baseUrl: parsed.data.baseUrl || test.baseUrl || definition.defaultBaseUrl || null,
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
        metadata: { provider, kind, modelId: connection.modelId, keyLast4: connection.maskedKey.slice(-4) },
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
    const connection = await patchUserApiConnection({ userId: user.id, ...parsed.data });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "API_CONNECTION_UPDATE",
        resource: "UserApiConnection",
        resourceId: connection.id,
        metadata: { enabled: connection.enabled, isDefault: connection.isDefault, modelId: connection.modelId },
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
