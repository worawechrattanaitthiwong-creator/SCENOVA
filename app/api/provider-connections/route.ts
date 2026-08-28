import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveSession } from "@/lib/auth-core";
import {
  PROVIDER_CATALOG,
  deleteProviderConnection,
  listProviderConnections,
  saveProviderConnection,
  setDefaultProviderConnection,
  setProviderConnectionEnabled,
  testProviderConnection,
} from "@/lib/provider-connections";

export const runtime = "nodejs";

const categorySchema = z.enum(["ANALYZER", "VIDEO", "IMAGE", "VOICE"]);

async function requireUser() {
  const store = await cookies();
  return resolveSession(store.get("scenova_session")?.value);
}

function safeError(error: unknown) {
  const code = error instanceof Error ? error.message : "PROVIDER_CONNECTION_ERROR";
  const allowed = new Set([
    "INVALID_PROVIDER_CATEGORY",
    "UNSUPPORTED_PROVIDER",
    "INVALID_API_KEY",
    "PROVIDER_CONNECTION_NOT_FOUND",
    "PROVIDER_CREDENTIAL_SAVE_FAILED",
    "SCENOVA_BYOK_MASTER_KEY_REQUIRED",
    "SCENOVA_BYOK_MASTER_KEY_INVALID",
  ]);
  return allowed.has(code) ? code : "PROVIDER_CONNECTION_ERROR";
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const connections = await listProviderConnections(user.id);
    return NextResponse.json({ ok: true, catalog: PROVIDER_CATALOG, connections });
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";

  try {
    if (action === "save") {
      const input = z.object({
        action: z.literal("save"),
        provider: z.string().min(1).max(64),
        category: categorySchema,
        apiKey: z.string().min(8).max(4096),
        modelId: z.string().max(160).nullable().optional(),
        label: z.string().max(120).nullable().optional(),
        isDefault: z.boolean().optional(),
        testAfterSave: z.boolean().optional(),
      }).parse(body);

      const connection = await saveProviderConnection({
        userId: user.id,
        provider: input.provider,
        category: input.category,
        apiKey: input.apiKey,
        modelId: input.modelId,
        label: input.label,
        isDefault: input.isDefault,
      });

      const test = input.testAfterSave === false ? null : await testProviderConnection(user.id, connection.id);
      const connections = await listProviderConnections(user.id);
      return NextResponse.json({ ok: true, connection, test, connections });
    }

    if (action === "test") {
      const input = z.object({ action: z.literal("test"), id: z.string().min(1).max(100) }).parse(body);
      const test = await testProviderConnection(user.id, input.id);
      const connections = await listProviderConnections(user.id);
      return NextResponse.json({ ok: test.ok, test, connections });
    }

    if (action === "delete") {
      const input = z.object({ action: z.literal("delete"), id: z.string().min(1).max(100) }).parse(body);
      const deleted = await deleteProviderConnection(user.id, input.id);
      const connections = await listProviderConnections(user.id);
      return NextResponse.json({ ok: true, deleted, connections });
    }

    if (action === "set-default") {
      const input = z.object({ action: z.literal("set-default"), id: z.string().min(1).max(100) }).parse(body);
      await setDefaultProviderConnection(user.id, input.id);
      const connections = await listProviderConnections(user.id);
      return NextResponse.json({ ok: true, connections });
    }

    if (action === "toggle") {
      const input = z.object({ action: z.literal("toggle"), id: z.string().min(1).max(100), enabled: z.boolean() }).parse(body);
      await setProviderConnectionEnabled(user.id, input.id, input.enabled);
      const connections = await listProviderConnections(user.id);
      return NextResponse.json({ ok: true, connections });
    }

    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
    const code = safeError(error);
    const status = code === "PROVIDER_CONNECTION_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
