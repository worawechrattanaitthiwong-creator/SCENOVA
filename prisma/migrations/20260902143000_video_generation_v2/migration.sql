-- Deterministic video generation boundary: one paid submission per shot.
CREATE TABLE "VideoGeneration" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectRef" TEXT NOT NULL,
    "episodeRef" TEXT NOT NULL,
    "segmentId" TEXT,
    "shotOrder" INTEGER NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "modelVersionId" TEXT,
    "billingMode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "promptSnapshot" JSONB NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "providerTaskId" TEXT,
    "providerSubmissionCount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "estimatedProviderCost" DECIMAL(12,4),
    "reservedCredits" INTEGER NOT NULL DEFAULT 0,
    "reservationId" TEXT,
    "outputUrl" TEXT,
    "storagePath" TEXT,
    "lastFrameUrl" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "providerAcceptedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoGeneration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoGenerationEvent" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VideoGenerationEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderRateGate" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "nextAvailableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minuteWindowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minuteCount" INTEGER NOT NULL DEFAULT 0,
    "dayWindowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderRateGate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VideoGeneration_idempotencyKey_key" ON "VideoGeneration"("idempotencyKey");
CREATE UNIQUE INDEX "VideoGeneration_runId_episodeRef_shotOrder_key" ON "VideoGeneration"("runId", "episodeRef", "shotOrder");
CREATE INDEX "VideoGeneration_runId_status_shotOrder_idx" ON "VideoGeneration"("runId", "status", "shotOrder");
CREATE INDEX "VideoGeneration_userId_createdAt_idx" ON "VideoGeneration"("userId", "createdAt");
CREATE INDEX "VideoGeneration_providerId_status_updatedAt_idx" ON "VideoGeneration"("providerId", "status", "updatedAt");
CREATE INDEX "VideoGenerationEvent_generationId_createdAt_idx" ON "VideoGenerationEvent"("generationId", "createdAt");
CREATE UNIQUE INDEX "ProviderRateGate_scopeKey_key" ON "ProviderRateGate"("scopeKey");
CREATE INDEX "ProviderRateGate_providerId_nextAvailableAt_idx" ON "ProviderRateGate"("providerId", "nextAvailableAt");

ALTER TABLE "VideoGeneration" ADD CONSTRAINT "VideoGeneration_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoGeneration" ADD CONSTRAINT "VideoGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VideoGenerationEvent" ADD CONSTRAINT "VideoGenerationEvent_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "VideoGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
