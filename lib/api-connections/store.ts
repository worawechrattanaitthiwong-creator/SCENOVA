import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { decryptApiSecret, encryptApiSecret, maskApiKey } from "@/lib/api-connections/crypto";

export type ApiConnectionKind = "ANALYZER" | "VIDEO" | "IMAGE" | "VOICE";
export type ApiConnectionStatus = "CONNECTED" | "INVALID" | "RATE_LIMITED" | "ERROR";

export type ApiConnectionModel = {
  apiModelId: string;
  label: string;
  note?: string;
  recommended?: boolean;
  availability?: "AVAILABLE" | "SUPPORTED" | "UNVERIFIED";
};

export type ApiConnectionRow = {
  id: string;
  userId: string;
  provider: string;
  kind: string;
  modelId: string | null;
  enabledModelIds: unknown;
  availableModels: unknown;
  baseUrl: string | null;
  secretCiphertext: string;
  secretIv: string;
  keyLast4: string;
  status: string;
  enabled: boolean;
  isDefault: boolean;
  lastTestedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SafeApiConnection = {
  id: string;
  provider: string;
  kind: ApiConnectionKind;
  modelId: string | null;
  enabledModelIds: string[];
  availableModels: ApiConnectionModel[];
  baseUrl: string | null;
  maskedKey: string;
  status: ApiConnectionStatus;
  enabled: boolean;
  isDefault: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)));
}

function connectionModels(value: unknown): ApiConnectionModel[] {
  if (!Array.isArray(value)) return [];
  const result: ApiConnectionModel[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const apiModelId = typeof item.apiModelId === "string" ? item.apiModelId.trim() : "";
    if (!apiModelId || seen.has(apiModelId)) continue;
    seen.add(apiModelId);
    const availability = item.availability === "AVAILABLE" || item.availability === "SUPPORTED" || item.availability === "UNVERIFIED"
      ? item.availability
      : undefined;
    result.push({
      apiModelId,
      label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : apiModelId,
      note: typeof item.note === "string" && item.note.trim() ? item.note.trim() : undefined,
      recommended: item.recommended === true || undefined,
      availability,
    });
  }
  return result;
}

function safe(row: ApiConnectionRow): SafeApiConnection {
  const enabledModelIds = stringArray(row.enabledModelIds);
  const availableModels = connectionModels(row.availableModels);
  const fallbackEnabled = enabledModelIds.length ? enabledModelIds : row.modelId ? [row.modelId] : [];
  const fallbackAvailable = availableModels.length
    ? availableModels
    : row.modelId
      ? [{ apiModelId: row.modelId, label: row.modelId, recommended: true, availability: "UNVERIFIED" as const }]
      : [];
  return {
    id: row.id,
    provider: row.provider,
    kind: row.kind as ApiConnectionKind,
    modelId: row.modelId,
    enabledModelIds: fallbackEnabled,
    availableModels: fallbackAvailable,
    baseUrl: row.baseUrl,
    maskedKey: maskApiKey(row.keyLast4),
    status: row.status as ApiConnectionStatus,
    enabled: row.enabled,
    isDefault: row.isDefault,
    lastTestedAt: row.lastTestedAt?.toISOString() || null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listUserApiConnections(userId: string) {
  const rows = await prisma.$queryRaw<ApiConnectionRow[]>`
    SELECT * FROM "UserApiConnection"
    WHERE "userId" = ${userId}
    ORDER BY "kind" ASC, "isDefault" DESC, "provider" ASC, "createdAt" ASC
  `;
  return rows.map(safe);
}

/**
 * Creates a new encrypted credential connection.
 *
 * Historically this function upserted on (userId, provider, kind), which meant
 * adding a second key for the same provider replaced the first one. Keep the
 * exported name for compatibility with existing callers, but intentionally
 * INSERT a distinct row now so one provider/model family can hold many keys.
 */
export async function upsertUserApiConnection(input: {
  userId: string;
  provider: string;
  kind: ApiConnectionKind;
  apiKey: string;
  modelId?: string | null;
  enabledModelIds?: string[];
  availableModels?: ApiConnectionModel[];
  baseUrl?: string | null;
  status?: ApiConnectionStatus;
  enabled?: boolean;
  isDefault?: boolean;
  lastError?: string | null;
}) {
  const id = randomUUID();
  const apiKey = input.apiKey.trim();
  const encrypted = encryptApiSecret(apiKey);
  const keyLast4 = apiKey.slice(-4);
  const enabled = input.enabled ?? true;
  const isDefault = input.isDefault ?? true;
  const status = input.status || "CONNECTED";
  const modelId = input.modelId?.trim() || null;
  const enabledModelIds = stringArray(input.enabledModelIds || (modelId ? [modelId] : []));
  const availableModels = connectionModels(input.availableModels || []);
  const enabledModelIdsJson = JSON.stringify(enabledModelIds);
  const availableModelsJson = JSON.stringify(availableModels);
  const baseUrl = input.baseUrl?.trim().replace(/\/$/, "") || null;
  const lastError = input.lastError || null;

  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.$executeRaw`
        UPDATE "UserApiConnection"
        SET "isDefault" = false, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${input.userId} AND "kind" = ${input.kind}
      `;
    }

    await tx.$executeRaw`
      INSERT INTO "UserApiConnection" (
        "id", "userId", "provider", "kind", "modelId", "enabledModelIds", "availableModels", "baseUrl",
        "secretCiphertext", "secretIv", "keyLast4", "status", "enabled",
        "isDefault", "lastTestedAt", "lastError", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${input.userId}, ${input.provider}, ${input.kind}, ${modelId}, ${enabledModelIdsJson}::jsonb, ${availableModelsJson}::jsonb, ${baseUrl},
        ${encrypted.ciphertext}, ${encrypted.iv}, ${keyLast4}, ${status}, ${enabled},
        ${isDefault}, CURRENT_TIMESTAMP, ${lastError}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
  });

  const rows = await prisma.$queryRaw<ApiConnectionRow[]>`
    SELECT * FROM "UserApiConnection"
    WHERE "id" = ${id} AND "userId" = ${input.userId}
    LIMIT 1
  `;
  if (!rows[0]) throw new Error("API_CONNECTION_SAVE_FAILED");
  return safe(rows[0]);
}

export async function getUserApiConnectionSecret(input: {
  userId: string;
  provider: string;
  kind: ApiConnectionKind;
}) {
  const rows = await prisma.$queryRaw<ApiConnectionRow[]>`
    SELECT * FROM "UserApiConnection"
    WHERE "userId" = ${input.userId}
      AND "provider" = ${input.provider}
      AND "kind" = ${input.kind}
      AND "enabled" = true
    ORDER BY "isDefault" DESC, "updatedAt" DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    connection: safe(row),
    apiKey: decryptApiSecret({ ciphertext: row.secretCiphertext, iv: row.secretIv }),
  };
}

export async function getUserApiConnectionSecretById(userId: string, id: string) {
  const rows = await prisma.$queryRaw<ApiConnectionRow[]>`
    SELECT * FROM "UserApiConnection"
    WHERE "id" = ${id} AND "userId" = ${userId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    connection: safe(row),
    apiKey: decryptApiSecret({ ciphertext: row.secretCiphertext, iv: row.secretIv }),
  };
}

export async function getDefaultUserApiConnectionSecret(userId: string, kind: ApiConnectionKind) {
  const rows = await prisma.$queryRaw<ApiConnectionRow[]>`
    SELECT * FROM "UserApiConnection"
    WHERE "userId" = ${userId} AND "kind" = ${kind} AND "enabled" = true
    ORDER BY "isDefault" DESC, "updatedAt" DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    connection: safe(row),
    apiKey: decryptApiSecret({ ciphertext: row.secretCiphertext, iv: row.secretIv }),
  };
}

export async function patchUserApiConnection(input: {
  userId: string;
  id: string;
  enabled?: boolean;
  isDefault?: boolean;
  modelId?: string | null;
  enabledModelIds?: string[];
  availableModels?: ApiConnectionModel[];
  baseUrl?: string | null;
  status?: ApiConnectionStatus;
  lastError?: string | null;
}) {
  await prisma.$transaction(async (tx) => {
    if (input.isDefault === true) {
      const current = await tx.$queryRaw<ApiConnectionRow[]>`
        SELECT * FROM "UserApiConnection" WHERE "id" = ${input.id} AND "userId" = ${input.userId} LIMIT 1
      `;
      if (!current[0]) throw new Error("API_CONNECTION_NOT_FOUND");
      await tx.$executeRaw`
        UPDATE "UserApiConnection"
        SET "isDefault" = false, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${input.userId} AND "kind" = ${current[0].kind}
      `;
    }

    if (typeof input.enabled === "boolean") {
      await tx.$executeRaw`
        UPDATE "UserApiConnection" SET "enabled" = ${input.enabled}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.id} AND "userId" = ${input.userId}
      `;
    }
    if (typeof input.isDefault === "boolean") {
      await tx.$executeRaw`
        UPDATE "UserApiConnection" SET "isDefault" = ${input.isDefault}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.id} AND "userId" = ${input.userId}
      `;
    }
    if (input.modelId !== undefined) {
      await tx.$executeRaw`
        UPDATE "UserApiConnection" SET "modelId" = ${input.modelId?.trim() || null}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.id} AND "userId" = ${input.userId}
      `;
    }
    if (input.enabledModelIds !== undefined) {
      const enabledModelIdsJson = JSON.stringify(stringArray(input.enabledModelIds));
      await tx.$executeRaw`
        UPDATE "UserApiConnection" SET "enabledModelIds" = ${enabledModelIdsJson}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.id} AND "userId" = ${input.userId}
      `;
    }
    if (input.availableModels !== undefined) {
      const availableModelsJson = JSON.stringify(connectionModels(input.availableModels));
      await tx.$executeRaw`
        UPDATE "UserApiConnection" SET "availableModels" = ${availableModelsJson}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.id} AND "userId" = ${input.userId}
      `;
    }
    if (input.baseUrl !== undefined) {
      await tx.$executeRaw`
        UPDATE "UserApiConnection" SET "baseUrl" = ${input.baseUrl?.trim().replace(/\/$/, "") || null}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.id} AND "userId" = ${input.userId}
      `;
    }
    if (input.status !== undefined || input.lastError !== undefined) {
      await tx.$executeRaw`
        UPDATE "UserApiConnection"
        SET "status" = COALESCE(${input.status || null}, "status"),
            "lastError" = ${input.lastError || null},
            "lastTestedAt" = CURRENT_TIMESTAMP,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${input.id} AND "userId" = ${input.userId}
      `;
    }
  });

  const rows = await prisma.$queryRaw<ApiConnectionRow[]>`
    SELECT * FROM "UserApiConnection" WHERE "id" = ${input.id} AND "userId" = ${input.userId} LIMIT 1
  `;
  if (!rows[0]) throw new Error("API_CONNECTION_NOT_FOUND");
  return safe(rows[0]);
}

export async function markApiConnectionStatus(input: {
  userId: string;
  id: string;
  status: ApiConnectionStatus;
  error?: string | null;
}) {
  await prisma.$executeRaw`
    UPDATE "UserApiConnection"
    SET "status" = ${input.status}, "lastError" = ${input.error || null}, "lastTestedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.id} AND "userId" = ${input.userId}
  `;
}

export async function deleteUserApiConnection(userId: string, id: string) {
  const deleted = await prisma.$executeRaw`
    DELETE FROM "UserApiConnection" WHERE "id" = ${id} AND "userId" = ${userId}
  `;
  return deleted > 0;
}
