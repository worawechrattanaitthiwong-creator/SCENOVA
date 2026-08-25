import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type EmergencySecurityState = {
  lockdownEnabled: boolean;
  maintenanceMode: boolean;
  generationDisabled: boolean;
  agentDisabled: boolean;
  llmDisabled: boolean;
  paymentDisabled: boolean;
  newLoginRestricted: boolean;
  queuePaused: boolean;
  emergencyRateLimitEnabled: boolean;
  disabledProviderIds: string[];
  sessionInvalidBefore: Date | null;
  reason: string | null;
  updatedByUserId: string | null;
  updatedAt: Date;
  environmentHardLock: boolean;
};

const GLOBAL_ID = "global";

const DEFAULT_STATE: Omit<EmergencySecurityState, "environmentHardLock"> = {
  lockdownEnabled: false,
  maintenanceMode: false,
  generationDisabled: false,
  agentDisabled: false,
  llmDisabled: false,
  paymentDisabled: false,
  newLoginRestricted: false,
  queuePaused: false,
  emergencyRateLimitEnabled: false,
  disabledProviderIds: [],
  sessionInvalidBefore: null,
  reason: null,
  updatedByUserId: null,
  updatedAt: new Date(0),
};

type SecurityRow = {
  lockdownEnabled: boolean;
  maintenanceMode: boolean;
  generationDisabled: boolean;
  agentDisabled: boolean;
  llmDisabled: boolean;
  paymentDisabled: boolean;
  newLoginRestricted: boolean;
  queuePaused: boolean;
  emergencyRateLimitEnabled: boolean;
  disabledProviderIds: unknown;
  sessionInvalidBefore: Date | null;
  reason: string | null;
  updatedByUserId: string | null;
  updatedAt: Date;
};

function providerIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function normalizeRow(row: SecurityRow): Omit<EmergencySecurityState, "environmentHardLock"> {
  return {
    lockdownEnabled: Boolean(row.lockdownEnabled),
    maintenanceMode: Boolean(row.maintenanceMode),
    generationDisabled: Boolean(row.generationDisabled),
    agentDisabled: Boolean(row.agentDisabled),
    llmDisabled: Boolean(row.llmDisabled),
    paymentDisabled: Boolean(row.paymentDisabled),
    newLoginRestricted: Boolean(row.newLoginRestricted),
    queuePaused: Boolean(row.queuePaused),
    emergencyRateLimitEnabled: Boolean(row.emergencyRateLimitEnabled),
    disabledProviderIds: providerIds(row.disabledProviderIds),
    sessionInvalidBefore: row.sessionInvalidBefore ? new Date(row.sessionInvalidBefore) : null,
    reason: row.reason || null,
    updatedByUserId: row.updatedByUserId || null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(0),
  };
}

async function dbState(): Promise<Omit<EmergencySecurityState, "environmentHardLock">> {
  try {
    await prisma.$executeRaw`
      INSERT INTO "SystemSecurityState" (
        "id","lockdownEnabled","maintenanceMode","generationDisabled","agentDisabled","llmDisabled","paymentDisabled",
        "newLoginRestricted","queuePaused","emergencyRateLimitEnabled","disabledProviderIds","updatedAt"
      ) VALUES (${GLOBAL_ID},false,false,false,false,false,false,false,false,false,'[]'::jsonb,NOW())
      ON CONFLICT ("id") DO NOTHING`;

    const rows = await prisma.$queryRaw<SecurityRow[]>`
      SELECT "lockdownEnabled","maintenanceMode","generationDisabled","agentDisabled","llmDisabled","paymentDisabled",
             "newLoginRestricted","queuePaused","emergencyRateLimitEnabled","disabledProviderIds","sessionInvalidBefore",
             "reason","updatedByUserId","updatedAt"
      FROM "SystemSecurityState" WHERE "id"=${GLOBAL_ID} LIMIT 1`;
    return rows[0] ? normalizeRow(rows[0]) : { ...DEFAULT_STATE };
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw new Error(`EMERGENCY_SECURITY_STATE_UNAVAILABLE:${error instanceof Error ? error.message : String(error)}`);
    return { ...DEFAULT_STATE, updatedAt: new Date() };
  }
}

function environmentHardLockEnabled() {
  return process.env.SCENOVA_EMERGENCY_LOCKDOWN === "true";
}

export async function getEmergencySecurityState(): Promise<EmergencySecurityState> {
  const state = await dbState();
  const hardLock = environmentHardLockEnabled();
  const generationEnvLock = process.env.SCENOVA_GENERATION_KILL_SWITCH === "true";
  return {
    ...state,
    lockdownEnabled: state.lockdownEnabled || hardLock,
    maintenanceMode: state.maintenanceMode || hardLock,
    generationDisabled: state.generationDisabled || hardLock || generationEnvLock,
    agentDisabled: state.agentDisabled || hardLock,
    llmDisabled: state.llmDisabled || hardLock,
    paymentDisabled: state.paymentDisabled || hardLock,
    newLoginRestricted: state.newLoginRestricted || hardLock,
    queuePaused: state.queuePaused || hardLock,
    emergencyRateLimitEnabled: state.emergencyRateLimitEnabled || hardLock,
    environmentHardLock: hardLock || generationEnvLock,
  };
}

async function writeState(
  next: Omit<EmergencySecurityState, "environmentHardLock">,
  actorUserId: string | null,
  auditAction: string,
  auditMetadata: Record<string, unknown>,
) {
  const disabledProviderIds = JSON.stringify(Array.from(new Set(next.disabledProviderIds)));
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "SystemSecurityState" SET
        "lockdownEnabled"=${next.lockdownEnabled},
        "maintenanceMode"=${next.maintenanceMode},
        "generationDisabled"=${next.generationDisabled},
        "agentDisabled"=${next.agentDisabled},
        "llmDisabled"=${next.llmDisabled},
        "paymentDisabled"=${next.paymentDisabled},
        "newLoginRestricted"=${next.newLoginRestricted},
        "queuePaused"=${next.queuePaused},
        "emergencyRateLimitEnabled"=${next.emergencyRateLimitEnabled},
        "disabledProviderIds"=${disabledProviderIds}::jsonb,
        "sessionInvalidBefore"=${next.sessionInvalidBefore},
        "reason"=${next.reason},
        "updatedByUserId"=${actorUserId},
        "updatedAt"=NOW()
      WHERE "id"=${GLOBAL_ID}`;
    await tx.auditLog.create({
      data: {
        userId: actorUserId,
        action: auditAction,
        resource: "system-security",
        resourceId: GLOBAL_ID,
        metadata: auditMetadata as Prisma.InputJsonObject,
      },
    });
  });
  return getEmergencySecurityState();
}

export async function activateEmergencyLockdown(actorUserId: string | null, reason: string) {
  const current = await dbState();
  const now = new Date();
  return writeState({
    ...current,
    lockdownEnabled: true,
    maintenanceMode: true,
    generationDisabled: true,
    agentDisabled: true,
    llmDisabled: true,
    paymentDisabled: true,
    newLoginRestricted: true,
    queuePaused: true,
    emergencyRateLimitEnabled: true,
    sessionInvalidBefore: now,
    reason: reason.trim() || "Emergency lockdown activated",
    updatedByUserId: actorUserId,
    updatedAt: now,
  }, actorUserId, "EMERGENCY_LOCKDOWN", { reason: reason.trim() || "Emergency lockdown activated", sessionRevokedAt: now.toISOString() });
}

export async function restoreEmergencyState(actorUserId: string | null, reason: string) {
  const current = await dbState();
  const now = new Date();
  return writeState({
    ...current,
    lockdownEnabled: false,
    maintenanceMode: false,
    generationDisabled: false,
    agentDisabled: false,
    llmDisabled: false,
    paymentDisabled: false,
    newLoginRestricted: false,
    queuePaused: false,
    emergencyRateLimitEnabled: false,
    disabledProviderIds: [],
    reason: reason.trim() || "Emergency lockdown cleared",
    updatedByUserId: actorUserId,
    updatedAt: now,
  }, actorUserId, "EMERGENCY_RESTORE", { reason: reason.trim() || "Emergency lockdown cleared" });
}

export async function revokeAllSessions(actorUserId: string | null, reason: string) {
  const current = await dbState();
  const now = new Date();
  return writeState({ ...current, sessionInvalidBefore: now, reason: reason.trim() || current.reason, updatedAt: now }, actorUserId, "REVOKE_ALL_SESSIONS", { reason: reason.trim() || "Admin revoked all sessions", sessionRevokedAt: now.toISOString() });
}

export async function updateEmergencyControls(input: {
  actorUserId: string | null;
  reason?: string;
  maintenanceMode?: boolean;
  generationDisabled?: boolean;
  agentDisabled?: boolean;
  llmDisabled?: boolean;
  paymentDisabled?: boolean;
  newLoginRestricted?: boolean;
  queuePaused?: boolean;
  emergencyRateLimitEnabled?: boolean;
  disabledProviderIds?: string[];
}) {
  const current = await dbState();
  const next: Omit<EmergencySecurityState, "environmentHardLock"> = {
    ...current,
    maintenanceMode: input.maintenanceMode ?? current.maintenanceMode,
    generationDisabled: input.generationDisabled ?? current.generationDisabled,
    agentDisabled: input.agentDisabled ?? current.agentDisabled,
    llmDisabled: input.llmDisabled ?? current.llmDisabled,
    paymentDisabled: input.paymentDisabled ?? current.paymentDisabled,
    newLoginRestricted: input.newLoginRestricted ?? current.newLoginRestricted,
    queuePaused: input.queuePaused ?? current.queuePaused,
    emergencyRateLimitEnabled: input.emergencyRateLimitEnabled ?? current.emergencyRateLimitEnabled,
    disabledProviderIds: input.disabledProviderIds ? providerIds(input.disabledProviderIds) : current.disabledProviderIds,
    reason: input.reason?.trim() || current.reason,
    updatedAt: new Date(),
  };
  return writeState(next, input.actorUserId, "EMERGENCY_CONTROL_UPDATE", {
    reason: input.reason?.trim() || null,
    maintenanceMode: next.maintenanceMode,
    generationDisabled: next.generationDisabled,
    agentDisabled: next.agentDisabled,
    llmDisabled: next.llmDisabled,
    paymentDisabled: next.paymentDisabled,
    newLoginRestricted: next.newLoginRestricted,
    queuePaused: next.queuePaused,
    emergencyRateLimitEnabled: next.emergencyRateLimitEnabled,
    disabledProviderIds: next.disabledProviderIds,
  });
}

export type EmergencyCapability = "generation" | "agent" | "llm" | "payment";

export async function assertEmergencyCapability(capability: EmergencyCapability, providerId?: string) {
  const state = await getEmergencySecurityState();
  if (state.lockdownEnabled) throw new Error(`EMERGENCY_LOCKDOWN:${state.reason || "SYSTEM_LOCKED"}`);
  if (capability === "generation") {
    if (state.generationDisabled) throw new Error(`GENERATION_DISABLED:${state.reason || "SECURITY_CONTROL"}`);
    if (providerId && state.disabledProviderIds.includes(providerId)) throw new Error(`PROVIDER_DISABLED:${providerId}`);
  }
  if (capability === "agent" && (state.agentDisabled || state.queuePaused)) throw new Error(`AGENT_DISABLED:${state.reason || "SECURITY_CONTROL"}`);
  if (capability === "llm" && state.llmDisabled) throw new Error(`LLM_DISABLED:${state.reason || "SECURITY_CONTROL"}`);
  if (capability === "payment" && state.paymentDisabled) throw new Error(`PAYMENT_DISABLED:${state.reason || "SECURITY_CONTROL"}`);
  return state;
}

export async function enforceEmergencyRateLimit(bucketKey: string, limitPerMinute: number) {
  const state = await getEmergencySecurityState();
  if (!state.emergencyRateLimitEnabled || state.lockdownEnabled) return;
  const limit = Math.max(1, Math.floor(limitPerMinute));
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setSeconds(0, 0);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "EmergencyRateLimitBucket" ("bucketKey","windowStart","count","updatedAt")
    VALUES (${bucketKey},${windowStart},1,NOW())
    ON CONFLICT ("bucketKey","windowStart") DO UPDATE SET "count"="EmergencyRateLimitBucket"."count"+1,"updatedAt"=NOW()
    RETURNING "count"`;
  const count = Number(rows[0]?.count || 0);
  if (count > limit) throw new Error(`EMERGENCY_RATE_LIMIT_EXCEEDED:${bucketKey}:${limit}/min`);
}
