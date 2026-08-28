-- User-owned API credentials (BYOK)
-- Secrets are encrypted by the application before they reach this table.
CREATE TABLE "UserApiConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "modelId" TEXT,
  "baseUrl" TEXT,
  "secretCiphertext" TEXT NOT NULL,
  "secretIv" TEXT NOT NULL,
  "keyLast4" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CONNECTED',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "lastTestedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserApiConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserApiConnection_userId_provider_kind_key"
  ON "UserApiConnection"("userId", "provider", "kind");

CREATE INDEX "UserApiConnection_userId_kind_enabled_idx"
  ON "UserApiConnection"("userId", "kind", "enabled");

CREATE INDEX "UserApiConnection_userId_createdAt_idx"
  ON "UserApiConnection"("userId", "createdAt");

ALTER TABLE "UserApiConnection"
  ADD CONSTRAINT "UserApiConnection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
