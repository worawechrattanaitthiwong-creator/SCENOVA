import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { prisma } from "@/lib/db";

export type ProviderCategory = "ANALYZER" | "VIDEO" | "IMAGE" | "VOICE";
export type CredentialSource = "BYOK" | "SYSTEM";

export type ProviderCatalogItem = {
  id: string;
  name: string;
  category: ProviderCategory;
  defaultModel: string | null;
  descriptionTh: string;
  canTest: boolean;
};

export const PROVIDER_CATALOG: readonly ProviderCatalogItem[] = [
  {
    id: "groq",
    name: "Groq",
    category: "ANALYZER",
    defaultModel: "openai/gpt-oss-20b",
    descriptionTh: "AI วิเคราะห์คำสั่งและแปลงเป็น Structured JSON ก่อนส่งให้โมเดลสร้างจริง",
    canTest: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "ANALYZER",
    defaultModel: null,
    descriptionTh: "Analyzer สำรองสำหรับงานวิเคราะห์คำสั่ง",
    canTest: false,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "ANALYZER",
    defaultModel: null,
    descriptionTh: "Fallback สำหรับเลือกโมเดลวิเคราะห์หลายค่ายผ่าน API เดียว",
    canTest: false,
  },
  {
    id: "seedance",
    name: "Seedance",
    category: "VIDEO",
    defaultModel: "dreamina-seedance-2-5-260628",
    descriptionTh: "Video Generator — ค่า Generate ถูกคิดโดย Provider ของเจ้าของ API Key",
    canTest: false,
  },
  {
    id: "kling",
    name: "Kling",
    category: "VIDEO",
    defaultModel: null,
    descriptionTh: "Video Generator — เตรียมช่อง BYOK ไว้สำหรับ Provider Adapter",
    canTest: false,
  },
  {
    id: "veo",
    name: "Veo",
    category: "VIDEO",
    defaultModel: null,
    descriptionTh: "Video Generator — เตรียมช่อง BYOK ไว้สำหรับ Provider Adapter",
    canTest: false,
  },
] as const;

type CredentialRow = {
  id: string;
  userId: string;
  provider: string;
  category: string;
  label: string;
  modelId: string | null;
  ciphertext: string;
  iv: string;
  authTag: string;
  last4: string;
  keyVersion: number;
  enabled: boolean;
  isDefault: boolean;
  status: string;
  lastTestedAt: Date | null;
  lastErrorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProviderConnectionSummary = {
  id: string;
  provider: string;
  category: ProviderCategory;
  label: string;
  modelId: string | null;
  maskedKey: string;
  enabled: boolean;
  isDefault: boolean;
  status: string;
  lastTestedAt: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedProviderCredential = {
  source: CredentialSource;
  provider: string;
  category: ProviderCategory;
  modelId: string | null;
  apiKey: string;
  credentialId: string | null;
};

function normalizeCategory(value: string): ProviderCategory {
  if (value === "ANALYZER" || value === "VIDEO" || value === "IMAGE" || value === "VOICE") return value;
  throw new Error("INVALID_PROVIDER_CATEGORY");
}

function getCatalogItem(provider: string, category: ProviderCategory) {
  const item = PROVIDER_CATALOG.find((candidate) => candidate.id === provider && candidate.category === category);
  if (!item) throw new Error("UNSUPPORTED_PROVIDER");
  return item;
}

function getMasterKey() {
  const configured = process.env.SCENOVA_BYOK_MASTER_KEY?.trim();
  if (!configured) {
    if (process.env.NODE_ENV === "production") throw new Error("SCENOVA_BYOK_MASTER_KEY_REQUIRED");
    return createHash("sha256").update(process.env.SESSION_SECRET || "scenova-dev-byok-key").digest();
  }

  if (/^[a-f0-9]{64}$/i.test(configured)) return Buffer.from(configured, "hex");
  const decoded = Buffer.from(configured, "base64");
  if (decoded.length !== 32) throw new Error("SCENOVA_BYOK_MASTER_KEY_INVALID");
  return decoded;
}

function aadFor(input: { id: string; userId: string; provider: string; category: ProviderCategory; keyVersion: number }) {
  return Buffer.from(`scenova-byok:v${input.keyVersion}:${input.userId}:${input.provider}:${input.category}:${input.id}`, "utf8");
}

function encryptApiKey(input: { id: string; userId: string; provider: string; category: ProviderCategory; apiKey: string }) {
  const keyVersion = 1;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getMasterKey(), iv);
  cipher.setAAD(aadFor({ ...input, keyVersion }));
  const ciphertext = Buffer.concat([cipher.update(input.apiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyVersion,
  };
}

function decryptApiKey(row: CredentialRow) {
  const category = normalizeCategory(row.category);
  const decipher = createDecipheriv("aes-256-gcm", getMasterKey(), Buffer.from(row.iv, "base64"));
  decipher.setAAD(aadFor({ id: row.id, userId: row.userId, provider: row.provider, category, keyVersion: row.keyVersion }));
  decipher.setAuthTag(Buffer.from(row.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function toSummary(row: CredentialRow): ProviderConnectionSummary {
  return {
    id: row.id,
    provider: row.provider,
    category: normalizeCategory(row.category),
    label: row.label,
    modelId: row.modelId,
    maskedKey: `••••••••${row.last4}`,
    enabled: row.enabled,
    isDefault: row.isDefault,
    status: row.status,
    lastTestedAt: row.lastTestedAt?.toISOString() || null,
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function writeAudit(userId: string, action: string, resourceId: string | null, metadata?: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resource: "provider-credential",
      resourceId,
      metadata: metadata || undefined,
    },
  });
}

export async function listProviderConnections(userId: string) {
  const rows = await prisma.$queryRaw<CredentialRow[]>`
    SELECT * FROM "ProviderCredential"
    WHERE "userId" = ${userId}
    ORDER BY "category" ASC, "isDefault" DESC, "provider" ASC
  `;
  return rows.map(toSummary);
}

async function getConnectionRow(userId: string, id: string) {
  const rows = await prisma.$queryRaw<CredentialRow[]>`
    SELECT * FROM "ProviderCredential"
    WHERE "userId" = ${userId} AND "id" = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function saveProviderConnection(input: {
  userId: string;
  provider: string;
  category: ProviderCategory;
  apiKey: string;
  modelId?: string | null;
  label?: string | null;
  isDefault?: boolean;
}) {
  const provider = input.provider.trim().toLowerCase();
  const category = input.category;
  const catalog = getCatalogItem(provider, category);
  const apiKey = input.apiKey.trim();
  if (apiKey.length < 8 || apiKey.length > 4096) throw new Error("INVALID_API_KEY");

  const existingRows = await prisma.$queryRaw<CredentialRow[]>`
    SELECT * FROM "ProviderCredential"
    WHERE "userId" = ${input.userId} AND "provider" = ${provider} AND "category" = ${category}
    LIMIT 1
  `;
  const existing = existingRows[0] || null;
  const id = existing?.id || randomUUID();
  const sealed = encryptApiKey({ id, userId: input.userId, provider, category, apiKey });
  const modelId = input.modelId?.trim() || catalog.defaultModel || null;
  const label = input.label?.trim() || catalog.name;

  const categoryCountRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "ProviderCredential"
    WHERE "userId" = ${input.userId} AND "category" = ${category}
  `;
  const shouldDefault = Boolean(input.isDefault) || Number(categoryCountRows[0]?.count || 0) === 0;

  await prisma.$executeRaw`
    INSERT INTO "ProviderCredential" (
      "id", "userId", "provider", "category", "label", "modelId",
      "ciphertext", "iv", "authTag", "last4", "keyVersion",
      "enabled", "isDefault", "status", "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${input.userId}, ${provider}, ${category}, ${label}, ${modelId},
      ${sealed.ciphertext}, ${sealed.iv}, ${sealed.authTag}, ${apiKey.slice(-4)}, ${sealed.keyVersion},
      true, ${shouldDefault}, 'UNTESTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT ("userId", "provider", "category") DO UPDATE SET
      "label" = EXCLUDED."label",
      "modelId" = EXCLUDED."modelId",
      "ciphertext" = EXCLUDED."ciphertext",
      "iv" = EXCLUDED."iv",
      "authTag" = EXCLUDED."authTag",
      "last4" = EXCLUDED."last4",
      "keyVersion" = EXCLUDED."keyVersion",
      "enabled" = true,
      "isDefault" = CASE WHEN ${shouldDefault} THEN true ELSE "ProviderCredential"."isDefault" END,
      "status" = 'UNTESTED',
      "lastTestedAt" = NULL,
      "lastErrorCode" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  if (shouldDefault) {
    await prisma.$executeRaw`
      UPDATE "ProviderCredential"
      SET "isDefault" = CASE WHEN "id" = ${id} THEN true ELSE false END,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "userId" = ${input.userId} AND "category" = ${category}
    `;
  }

  await writeAudit(input.userId, existing ? "PROVIDER_KEY_REPLACED" : "PROVIDER_KEY_ADDED", id, {
    provider,
    category,
    modelId,
    isDefault: shouldDefault,
  });

  const saved = await getConnectionRow(input.userId, id);
  if (!saved) throw new Error("PROVIDER_CREDENTIAL_SAVE_FAILED");
  return toSummary(saved);
}

export async function deleteProviderConnection(userId: string, id: string) {
  const row = await getConnectionRow(userId, id);
  if (!row) return false;
  await prisma.$executeRaw`
    DELETE FROM "ProviderCredential"
    WHERE "userId" = ${userId} AND "id" = ${id}
  `;
  await writeAudit(userId, "PROVIDER_KEY_DELETED", id, { provider: row.provider, category: row.category });
  return true;
}

export async function setProviderConnectionEnabled(userId: string, id: string, enabled: boolean) {
  const row = await getConnectionRow(userId, id);
  if (!row) throw new Error("PROVIDER_CONNECTION_NOT_FOUND");
  await prisma.$executeRaw`
    UPDATE "ProviderCredential"
    SET "enabled" = ${enabled}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${userId} AND "id" = ${id}
  `;
  await writeAudit(userId, enabled ? "PROVIDER_KEY_ENABLED" : "PROVIDER_KEY_DISABLED", id, { provider: row.provider });
}

export async function setDefaultProviderConnection(userId: string, id: string) {
  const row = await getConnectionRow(userId, id);
  if (!row) throw new Error("PROVIDER_CONNECTION_NOT_FOUND");
  await prisma.$executeRaw`
    UPDATE "ProviderCredential"
    SET "isDefault" = CASE WHEN "id" = ${id} THEN true ELSE false END,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${userId} AND "category" = ${row.category}
  `;
  await writeAudit(userId, "PROVIDER_KEY_SET_DEFAULT", id, { provider: row.provider, category: row.category });
}

async function testGroqKey(apiKey: string, modelId: string | null) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, verified: true, code: `PROVIDER_HTTP_${response.status}` } as const;
    if (modelId) {
      const payload = await response.json().catch(() => null) as { data?: Array<{ id?: string }> } | null;
      if (payload?.data && !payload.data.some((model) => model.id === modelId)) {
        return { ok: false, verified: true, code: "MODEL_NOT_AVAILABLE" } as const;
      }
    }
    return { ok: true, verified: true, code: "CONNECTED" } as const;
  } catch (error) {
    const code = error instanceof Error && error.name === "TimeoutError" ? "PROVIDER_TIMEOUT" : "PROVIDER_UNREACHABLE";
    return { ok: false, verified: true, code } as const;
  }
}

export async function testProviderConnection(userId: string, id: string) {
  const row = await getConnectionRow(userId, id);
  if (!row) throw new Error("PROVIDER_CONNECTION_NOT_FOUND");
  const category = normalizeCategory(row.category);
  const catalog = getCatalogItem(row.provider, category);
  const apiKey = decryptApiKey(row);

  const result = catalog.canTest && row.provider === "groq"
    ? await testGroqKey(apiKey, row.modelId)
    : { ok: true, verified: false, code: "STORED_UNVERIFIED" } as const;

  await prisma.$executeRaw`
    UPDATE "ProviderCredential"
    SET "status" = ${result.ok ? (result.verified ? "CONNECTED" : "STORED") : "ERROR"},
        "lastTestedAt" = CURRENT_TIMESTAMP,
        "lastErrorCode" = ${result.ok ? null : result.code},
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${userId} AND "id" = ${id}
  `;
  await writeAudit(userId, "PROVIDER_KEY_TESTED", id, {
    provider: row.provider,
    category,
    ok: result.ok,
    verified: result.verified,
    code: result.code,
  });
  return result;
}

const SYSTEM_KEY_ENV: Readonly<Record<string, string>> = {
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  seedance: "SEEDANCE_API_KEY",
  kling: "KLING_API_KEY",
  veo: "VEO_API_KEY",
};

export async function resolveProviderCredential(input: {
  userId: string;
  category: ProviderCategory;
  provider?: string | null;
}): Promise<ResolvedProviderCredential | null> {
  let rows: CredentialRow[];
  if (input.provider) {
    const provider = input.provider.trim().toLowerCase();
    rows = await prisma.$queryRaw<CredentialRow[]>`
      SELECT * FROM "ProviderCredential"
      WHERE "userId" = ${input.userId}
        AND "category" = ${input.category}
        AND "provider" = ${provider}
        AND "enabled" = true
      LIMIT 1
    `;
  } else {
    rows = await prisma.$queryRaw<CredentialRow[]>`
      SELECT * FROM "ProviderCredential"
      WHERE "userId" = ${input.userId}
        AND "category" = ${input.category}
        AND "enabled" = true
      ORDER BY "isDefault" DESC, "updatedAt" DESC
      LIMIT 1
    `;
  }

  const byok = rows[0];
  if (byok) {
    return {
      source: "BYOK",
      provider: byok.provider,
      category: normalizeCategory(byok.category),
      modelId: byok.modelId,
      apiKey: decryptApiKey(byok),
      credentialId: byok.id,
    };
  }

  if (input.provider) {
    const provider = input.provider.trim().toLowerCase();
    const envName = SYSTEM_KEY_ENV[provider];
    const systemKey = envName ? process.env[envName]?.trim() : "";
    if (systemKey) {
      const catalog = getCatalogItem(provider, input.category);
      return {
        source: "SYSTEM",
        provider,
        category: input.category,
        modelId: catalog.defaultModel,
        apiKey: systemKey,
        credentialId: null,
      };
    }
  }

  return null;
}
