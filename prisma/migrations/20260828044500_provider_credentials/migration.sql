-- SCENOVA BYOK / Provider Connections
-- Secrets are application-encrypted before they reach this table.
CREATE TABLE "ProviderCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "modelId" TEXT,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'UNTESTED',
    "lastTestedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderCredential_userId_provider_category_key"
ON "ProviderCredential"("userId", "provider", "category");

CREATE INDEX "ProviderCredential_userId_category_idx"
ON "ProviderCredential"("userId", "category");

CREATE INDEX "ProviderCredential_userId_enabled_idx"
ON "ProviderCredential"("userId", "enabled");

ALTER TABLE "ProviderCredential"
ADD CONSTRAINT "ProviderCredential_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
