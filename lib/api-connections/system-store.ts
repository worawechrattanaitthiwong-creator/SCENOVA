import { prisma } from "@/lib/db";
import { decryptApiSecret } from "@/lib/api-connections/crypto";

export type SystemAnalyzerConnectionSecret = {
  connectionId: string;
  ownerUserId: string;
  provider: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  isDefault: boolean;
};

type SystemAnalyzerRow = {
  id: string;
  userId: string;
  provider: string;
  modelId: string | null;
  baseUrl: string | null;
  secretCiphertext: string;
  secretIv: string;
  isDefault: boolean;
  updatedAt: Date;
};

/**
 * Returns Analyzer credentials owned by an active SCENOVA Admin.
 *
 * Connections created from Settings are intentionally stored per-user. For an
 * ADMIN account, Analyzer connections are platform credentials: AI Agent and
 * Generate Prompt must be able to use them for every authenticated SCENOVA
 * user without exposing the key to the browser.
 *
 * The default Admin Analyzer is returned first, followed by other connected
 * Admin analyzers as failover candidates. Environment credentials remain a
 * separate fallback in lib/llm/system-ai.ts.
 */
export async function getAdminSystemAnalyzerConnections(): Promise<SystemAnalyzerConnectionSecret[]> {
  const configuredAdminEmail = (process.env.SCENOVA_ADMIN_EMAIL || "").trim().toLowerCase();
  const rows = await prisma.$queryRaw<SystemAnalyzerRow[]>`
    SELECT
      c."id",
      c."userId",
      c."provider",
      c."modelId",
      c."baseUrl",
      c."secretCiphertext",
      c."secretIv",
      c."isDefault",
      c."updatedAt"
    FROM "UserApiConnection" c
    INNER JOIN "User" u ON u."id" = c."userId"
    WHERE u."role" = 'ADMIN'
      AND u."active" = true
      AND c."kind" = 'ANALYZER'
      AND c."enabled" = true
      AND c."status" = 'CONNECTED'
      AND c."modelId" IS NOT NULL
    ORDER BY
      CASE WHEN ${configuredAdminEmail} <> '' AND LOWER(u."email") = ${configuredAdminEmail} THEN 0 ELSE 1 END ASC,
      c."isDefault" DESC,
      c."updatedAt" DESC
    LIMIT 12
  `;

  const result: SystemAnalyzerConnectionSecret[] = [];
  for (const row of rows) {
    const modelId = row.modelId?.trim();
    const baseUrl = row.baseUrl?.trim().replace(/\/$/, "");
    if (!modelId || !baseUrl) continue;
    try {
      const apiKey = decryptApiSecret({ ciphertext: row.secretCiphertext, iv: row.secretIv }).trim();
      if (!apiKey) continue;
      result.push({
        connectionId: row.id,
        ownerUserId: row.userId,
        provider: row.provider.trim().toLowerCase(),
        modelId,
        baseUrl,
        apiKey,
        isDefault: row.isDefault,
      });
    } catch {
      // A bad/legacy encrypted row must not prevent another System Analyzer or
      // the environment fallback from being tried.
    }
  }
  return result;
}
