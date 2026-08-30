-- Multi-agent production workflow: role definitions, versioned artifacts,
-- explicit handoffs, quality reviews and human checkpoints.

CREATE TABLE "AgentDefinition" (
    "key" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "modelTier" TEXT NOT NULL DEFAULT 'balanced',
    "instructionVersion" INTEGER NOT NULL DEFAULT 1,
    "inputTypes" JSONB NOT NULL DEFAULT '[]',
    "outputType" TEXT NOT NULL,
    "toolsJson" JSONB NOT NULL DEFAULT '[]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentDefinition_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "AgentWorkflow" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "workflowKey" TEXT NOT NULL DEFAULT 'SCENOVA_FILM_PRODUCTION',
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "definitionJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sequence" INTEGER NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "inputJson" JSONB NOT NULL DEFAULT '{}',
    "outputJson" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentArtifact" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT NOT NULL,
    "contentJson" JSONB NOT NULL,
    "lineageJson" JSONB NOT NULL DEFAULT '[]',
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentHandoff" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "fromTaskId" TEXT NOT NULL,
    "toTaskId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "contractVersion" INTEGER NOT NULL DEFAULT 1,
    "payloadJson" JSONB NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentHandoff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentReview" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "artifactId" TEXT,
    "reviewerAgentKey" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "score" INTEGER,
    "summary" TEXT NOT NULL,
    "issuesJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HumanCheckpoint" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "taskId" TEXT,
    "artifactId" TEXT,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "summary" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    CONSTRAINT "HumanCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentWorkflow_runId_key" ON "AgentWorkflow"("runId");
CREATE INDEX "AgentWorkflow_status_updatedAt_idx" ON "AgentWorkflow"("status", "updatedAt");
CREATE UNIQUE INDEX "AgentTask_idempotencyKey_key" ON "AgentTask"("idempotencyKey");
CREATE UNIQUE INDEX "AgentTask_runId_stage_scopeKey_key" ON "AgentTask"("runId", "stage", "scopeKey");
CREATE INDEX "AgentTask_workflowId_status_sequence_idx" ON "AgentTask"("workflowId", "status", "sequence");
CREATE INDEX "AgentTask_runId_scopeKey_sequence_idx" ON "AgentTask"("runId", "scopeKey", "sequence");
CREATE INDEX "AgentTask_agentKey_status_idx" ON "AgentTask"("agentKey", "status");
CREATE UNIQUE INDEX "AgentArtifact_runId_type_scopeKey_version_key" ON "AgentArtifact"("runId", "type", "scopeKey", "version");
CREATE INDEX "AgentArtifact_runId_scopeKey_createdAt_idx" ON "AgentArtifact"("runId", "scopeKey", "createdAt");
CREATE INDEX "AgentArtifact_taskId_createdAt_idx" ON "AgentArtifact"("taskId", "createdAt");
CREATE UNIQUE INDEX "AgentHandoff_fromTaskId_toTaskId_artifactId_key" ON "AgentHandoff"("fromTaskId", "toTaskId", "artifactId");
CREATE INDEX "AgentHandoff_runId_status_createdAt_idx" ON "AgentHandoff"("runId", "status", "createdAt");
CREATE INDEX "AgentHandoff_toTaskId_status_idx" ON "AgentHandoff"("toTaskId", "status");
CREATE INDEX "AgentReview_runId_createdAt_idx" ON "AgentReview"("runId", "createdAt");
CREATE INDEX "AgentReview_artifactId_verdict_idx" ON "AgentReview"("artifactId", "verdict");
CREATE INDEX "HumanCheckpoint_runId_status_requestedAt_idx" ON "HumanCheckpoint"("runId", "status", "requestedAt");

ALTER TABLE "AgentWorkflow" ADD CONSTRAINT "AgentWorkflow_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AgentWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_agentKey_fkey" FOREIGN KEY ("agentKey") REFERENCES "AgentDefinition"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentArtifact" ADD CONSTRAINT "AgentArtifact_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentHandoff" ADD CONSTRAINT "AgentHandoff_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AgentWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentHandoff" ADD CONSTRAINT "AgentHandoff_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentHandoff" ADD CONSTRAINT "AgentHandoff_fromTaskId_fkey" FOREIGN KEY ("fromTaskId") REFERENCES "AgentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentHandoff" ADD CONSTRAINT "AgentHandoff_toTaskId_fkey" FOREIGN KEY ("toTaskId") REFERENCES "AgentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentHandoff" ADD CONSTRAINT "AgentHandoff_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "AgentArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentReview" ADD CONSTRAINT "AgentReview_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentReview" ADD CONSTRAINT "AgentReview_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentReview" ADD CONSTRAINT "AgentReview_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "AgentArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HumanCheckpoint" ADD CONSTRAINT "HumanCheckpoint_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HumanCheckpoint" ADD CONSTRAINT "HumanCheckpoint_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HumanCheckpoint" ADD CONSTRAINT "HumanCheckpoint_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "AgentArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
