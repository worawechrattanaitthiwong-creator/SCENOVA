-- Worker crash recovery / idempotency
ALTER TABLE "AgentQueueJob" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "AgentQueueJob" ADD COLUMN "heartbeatAt" TIMESTAMP(3);
ALTER TABLE "AgentQueueJob" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
UPDATE "AgentQueueJob" SET "idempotencyKey" = "id" WHERE "idempotencyKey" IS NULL;
ALTER TABLE "AgentQueueJob" ALTER COLUMN "idempotencyKey" SET NOT NULL;
CREATE UNIQUE INDEX "AgentQueueJob_idempotencyKey_key" ON "AgentQueueJob"("idempotencyKey");
CREATE INDEX "AgentQueueJob_status_leaseExpiresAt_idx" ON "AgentQueueJob"("status", "leaseExpiresAt");

-- Persistent wallet reservations used before paid provider calls.
CREATE TABLE "CreditReservation" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'reserved',
  "credits" INTEGER NOT NULL,
  "chargedCredits" INTEGER NOT NULL DEFAULT 0,
  "purpose" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditReservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CreditReservation_idempotencyKey_key" ON "CreditReservation"("idempotencyKey");
CREATE INDEX "CreditReservation_userId_createdAt_idx" ON "CreditReservation"("userId", "createdAt");
CREATE INDEX "CreditReservation_status_expiresAt_idx" ON "CreditReservation"("status", "expiresAt");
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditReservation" ADD CONSTRAINT "CreditReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Estimate -> reserve -> live usage -> receipt.
CREATE TABLE "CostQuote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREVIEW',
  "estimatedCredits" INTEGER NOT NULL,
  "maxCredits" INTEGER NOT NULL,
  "actualCredits" INTEGER NOT NULL DEFAULT 0,
  "itemsJson" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostQuote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CostQuote_userId_createdAt_idx" ON "CostQuote"("userId", "createdAt");
CREATE INDEX "CostQuote_referenceType_referenceId_idx" ON "CostQuote"("referenceType", "referenceId");
ALTER TABLE "CostQuote" ADD CONSTRAINT "CostQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CostUsageEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "quoteId" TEXT,
  "category" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "credits" INTEGER NOT NULL DEFAULT 0,
  "costThb" DECIMAL(12,4),
  "providerId" TEXT,
  "modelId" TEXT,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "projectId" TEXT,
  "episodeId" TEXT,
  "sceneId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostUsageEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CostUsageEvent_userId_createdAt_idx" ON "CostUsageEvent"("userId", "createdAt");
CREATE INDEX "CostUsageEvent_quoteId_createdAt_idx" ON "CostUsageEvent"("quoteId", "createdAt");
CREATE INDEX "CostUsageEvent_category_createdAt_idx" ON "CostUsageEvent"("category", "createdAt");
ALTER TABLE "CostUsageEvent" ADD CONSTRAINT "CostUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CostUsageEvent" ADD CONSTRAINT "CostUsageEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "CostQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Raw provider usage for the owner/admin cost meter.
CREATE TABLE "LlmUsageEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "runId" TEXT,
  "provider" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "costThb" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LlmUsageEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LlmUsageEvent_userId_createdAt_idx" ON "LlmUsageEvent"("userId", "createdAt");
CREATE INDEX "LlmUsageEvent_runId_createdAt_idx" ON "LlmUsageEvent"("runId", "createdAt");
CREATE INDEX "LlmUsageEvent_modelId_createdAt_idx" ON "LlmUsageEvent"("modelId", "createdAt");
CREATE INDEX "LlmUsageEvent_category_createdAt_idx" ON "LlmUsageEvent"("category", "createdAt");
ALTER TABLE "LlmUsageEvent" ADD CONSTRAINT "LlmUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LlmUsageEvent" ADD CONSTRAINT "LlmUsageEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unlock is charged once per prompt version/scope; repeat copy/download is free.
CREATE TABLE "PromptExportUnlock" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "promptFingerprint" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "scope" TEXT NOT NULL DEFAULT 'production',
  "creditsCharged" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromptExportUnlock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromptExportUnlock_userId_promptFingerprint_version_scope_key" ON "PromptExportUnlock"("userId", "promptFingerprint", "version", "scope");
CREATE INDEX "PromptExportUnlock_userId_createdAt_idx" ON "PromptExportUnlock"("userId", "createdAt");
ALTER TABLE "PromptExportUnlock" ADD CONSTRAINT "PromptExportUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
