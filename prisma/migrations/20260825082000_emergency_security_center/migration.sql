CREATE TABLE "SystemSecurityState" (
  "id" TEXT NOT NULL,
  "lockdownEnabled" BOOLEAN NOT NULL DEFAULT false,
  "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "generationDisabled" BOOLEAN NOT NULL DEFAULT false,
  "agentDisabled" BOOLEAN NOT NULL DEFAULT false,
  "llmDisabled" BOOLEAN NOT NULL DEFAULT false,
  "paymentDisabled" BOOLEAN NOT NULL DEFAULT false,
  "newLoginRestricted" BOOLEAN NOT NULL DEFAULT false,
  "queuePaused" BOOLEAN NOT NULL DEFAULT false,
  "emergencyRateLimitEnabled" BOOLEAN NOT NULL DEFAULT false,
  "disabledProviderIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "sessionInvalidBefore" TIMESTAMP(3),
  "reason" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemSecurityState_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SystemSecurityState" (
  "id","lockdownEnabled","maintenanceMode","generationDisabled","agentDisabled","llmDisabled","paymentDisabled",
  "newLoginRestricted","queuePaused","emergencyRateLimitEnabled","disabledProviderIds","createdAt","updatedAt"
) VALUES ('global',false,false,false,false,false,false,false,false,false,'[]'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
