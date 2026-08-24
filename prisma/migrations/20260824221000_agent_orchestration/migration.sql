-- Durable AI Agent orchestration state, queue, decision log and approval checkpoints.
CREATE TABLE "AgentRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "stage" TEXT NOT NULL DEFAULT 'PLAN_STORY',
  "inputJson" JSONB NOT NULL,
  "planJson" JSONB,
  "stateJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "budgetThb" DECIMAL(12,4) NOT NULL,
  "estimatedSpendThb" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "actualSpendThb" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "approvalThresholdThb" DECIMAL(12,4) NOT NULL,
  "maxEpisodes" INTEGER NOT NULL DEFAULT 1,
  "stopReason" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgentRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AgentRun_userId_createdAt_idx" ON "AgentRun"("userId", "createdAt");
CREATE INDEX "AgentRun_status_stage_idx" ON "AgentRun"("status", "stage");

CREATE TABLE "AgentQueueJob" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'AGENT_STEP',
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "payloadJson" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentQueueJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgentQueueJob_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AgentQueueJob_status_availableAt_idx" ON "AgentQueueJob"("status", "availableAt");
CREATE INDEX "AgentQueueJob_runId_createdAt_idx" ON "AgentQueueJob"("runId", "createdAt");

CREATE TABLE "AgentDecisionLog" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "providerId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentDecisionLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgentDecisionLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AgentDecisionLog_runId_createdAt_idx" ON "AgentDecisionLog"("runId", "createdAt");

CREATE TABLE "AgentApproval" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'BUDGET_PLAN',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "estimatedCostThb" DECIMAL(12,4) NOT NULL,
  "summary" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  CONSTRAINT "AgentApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AgentApproval_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AgentApproval_runId_status_idx" ON "AgentApproval"("runId", "status");
