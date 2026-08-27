import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createMember, hashPassword, type SessionUser } from "@/lib/auth-core";

const RESTRICTION_ACTIONS = ["ADMIN_USER_SUSPENDED", "ADMIN_USER_BLOCKED", "ADMIN_USER_UNBLOCKED", "AUTO_USER_SUSPENSION_EXPIRED"] as const;

function jsonObject(value?: Record<string, unknown>): Prisma.InputJsonObject {
  return (value || {}) as Prisma.InputJsonObject;
}

async function writeAudit(actorId: string | null, action: string, targetId: string | null, metadata?: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action,
      resource: "user",
      resourceId: targetId,
      metadata: jsonObject(metadata),
    },
  });
}

async function latestRestriction(userId: string) {
  return prisma.auditLog.findFirst({
    where: {
      resource: "user",
      resourceId: userId,
      action: { in: [...RESTRICTION_ACTIONS] },
    },
    orderBy: { createdAt: "desc" },
  });
}

function restrictionView(log: Awaited<ReturnType<typeof latestRestriction>>) {
  if (!log) return { suspendedUntil: null as string | null, suspensionReason: null as string | null, restriction: null as string | null };
  const metadata = log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
    ? log.metadata as Record<string, unknown>
    : {};
  const suspendedUntil = typeof metadata.suspendedUntil === "string" ? metadata.suspendedUntil : null;
  const suspensionReason = typeof metadata.reason === "string" ? metadata.reason : null;
  return {
    suspendedUntil,
    suspensionReason,
    restriction: log.action,
  };
}

export async function listAdminMembers() {
  const users = await prisma.user.findMany({
    where: { role: "MEMBER" },
    include: { wallet: true },
    orderBy: { createdAt: "desc" },
  });
  const restrictions = await prisma.auditLog.findMany({
    where: {
      resource: "user",
      resourceId: { in: users.map((user) => user.id) },
      action: { in: [...RESTRICTION_ACTIONS] },
    },
    orderBy: { createdAt: "desc" },
  });
  const latestByUser = new Map<string, (typeof restrictions)[number]>();
  for (const log of restrictions) {
    if (log.resourceId && !latestByUser.has(log.resourceId)) latestByUser.set(log.resourceId, log);
  }

  return users.map((user) => {
    const wallet = user.wallet;
    const paid = wallet?.paidBalance || 0;
    const bonus = wallet?.bonusBalance || 0;
    const reserved = wallet?.reserved || 0;
    return {
      id: user.id,
      name: user.displayName || user.email,
      email: user.email,
      role: "MEMBER" as const,
      active: user.active,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      twoFactorEnabled: user.twoFactorEnabled,
      balance: { paid, bonus, reserved, available: Math.max(0, paid + bonus - reserved) },
      ...restrictionView(latestByUser.get(user.id) || null),
    };
  });
}

export async function releaseExpiredUserSuspension(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  if (!email) return false;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, active: true, role: true } });
  if (!user || user.active || user.role === "ADMIN") return false;
  const log = await latestRestriction(user.id);
  if (!log || log.action !== "ADMIN_USER_SUSPENDED") return false;
  const state = restrictionView(log);
  if (!state.suspendedUntil) return false;
  const until = new Date(state.suspendedUntil);
  if (!Number.isFinite(until.getTime()) || until.getTime() > Date.now()) return false;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { active: true } });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "AUTO_USER_SUSPENSION_EXPIRED",
        resource: "user",
        resourceId: user.id,
        metadata: jsonObject({ previousSuspendedUntil: state.suspendedUntil }),
      },
    });
  });
  return true;
}

export async function createAdminMember(actor: SessionUser, input: { email: string; name: string; password: string }) {
  const member = await createMember(input);
  await writeAudit(actor.id, "ADMIN_USER_CREATED", member.id, { email: member.email, name: member.name });
  return member;
}

export type UpdateAdminMemberInput = {
  id: string;
  name?: string;
  email?: string;
  password?: string;
  creditDelta?: number;
  active?: boolean;
  suspendMinutes?: number;
  suspensionReason?: string;
};

export async function updateAdminMember(actor: SessionUser, input: UpdateAdminMemberInput) {
  const target = await prisma.user.findUnique({ where: { id: input.id }, include: { wallet: true } });
  if (!target || target.role !== "MEMBER") throw new Error("MEMBER_NOT_FOUND");

  const userData: Prisma.UserUpdateInput = {};
  const changed: Record<string, unknown> = {};

  if (typeof input.name === "string") {
    const name = input.name.trim();
    if (!name) throw new Error("INVALID_NAME");
    userData.displayName = name;
    changed.name = name;
  }
  if (typeof input.email === "string") {
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes("@")) throw new Error("INVALID_EMAIL");
    userData.email = email;
    changed.email = email;
  }
  if (typeof input.password === "string" && input.password.length) {
    if (input.password.length < 8) throw new Error("PASSWORD_TOO_SHORT");
    userData.passwordHash = await hashPassword(input.password);
    changed.passwordReset = true;
  }

  const suspendMinutes = Math.max(0, Math.floor(Number(input.suspendMinutes || 0)));
  if (suspendMinutes > 0) {
    const suspendedUntil = new Date(Date.now() + suspendMinutes * 60_000).toISOString();
    userData.active = false;
    changed.suspendMinutes = suspendMinutes;
    changed.suspendedUntil = suspendedUntil;
  } else if (typeof input.active === "boolean") {
    userData.active = input.active;
    changed.active = input.active;
  }

  const delta = Math.trunc(Number(input.creditDelta || 0));

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length) await tx.user.update({ where: { id: target.id }, data: userData });

    if (delta !== 0) {
      const wallet = await tx.wallet.upsert({ where: { userId: target.id }, update: {}, create: { userId: target.id } });
      if (delta < 0 && wallet.paidBalance + wallet.bonusBalance - wallet.reserved < Math.abs(delta)) {
        throw new Error("CREDIT_BELOW_AVAILABLE");
      }
      let paidAfter = wallet.paidBalance;
      let bonusAfter = wallet.bonusBalance;
      if (delta > 0) {
        bonusAfter += delta;
      } else {
        let remaining = Math.abs(delta);
        const bonusDeduct = Math.min(bonusAfter, remaining);
        bonusAfter -= bonusDeduct;
        remaining -= bonusDeduct;
        paidAfter -= remaining;
      }
      const balanceAfter = paidAfter + bonusAfter;
      await tx.wallet.update({ where: { id: wallet.id }, data: { paidBalance: paidAfter, bonusBalance: bonusAfter } });
      await tx.walletLedger.create({
        data: {
          walletId: wallet.id,
          type: "ADMIN_ADJUST",
          credits: delta,
          balanceAfter,
          referenceType: "admin-user",
          referenceId: target.id,
          idempotencyKey: `admin-user:${actor.id}:${target.id}:${randomUUID()}`,
          metadata: jsonObject({ actorId: actor.id, actorEmail: actor.email }),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "ADMIN_USER_CREDIT_ADJUSTED",
          resource: "user",
          resourceId: target.id,
          metadata: jsonObject({ delta, balanceAfter, targetEmail: target.email }),
        },
      });
    }

    if (suspendMinutes > 0) {
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "ADMIN_USER_SUSPENDED",
          resource: "user",
          resourceId: target.id,
          metadata: jsonObject({
            suspendMinutes,
            suspendedUntil: changed.suspendedUntil,
            reason: input.suspensionReason?.trim() || "Admin suspension",
            targetEmail: target.email,
          }),
        },
      });
    } else if (input.active === false) {
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "ADMIN_USER_BLOCKED",
          resource: "user",
          resourceId: target.id,
          metadata: jsonObject({ reason: input.suspensionReason?.trim() || "Admin block", targetEmail: target.email }),
        },
      });
    } else if (input.active === true) {
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "ADMIN_USER_UNBLOCKED",
          resource: "user",
          resourceId: target.id,
          metadata: jsonObject({ targetEmail: target.email }),
        },
      });
    }

    if (Object.keys(changed).some((key) => !["suspendMinutes", "suspendedUntil", "active"].includes(key))) {
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: "ADMIN_USER_UPDATED",
          resource: "user",
          resourceId: target.id,
          metadata: jsonObject({ ...changed, targetEmail: target.email }),
        },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return listAdminMembers().then((members) => members.find((member) => member.id === target.id) || null);
}

export async function deleteAdminMember(actor: SessionUser, targetId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, email: true, displayName: true, role: true } });
  if (!target || target.role !== "MEMBER") throw new Error("MEMBER_NOT_FOUND");
  await writeAudit(actor.id, "ADMIN_USER_DELETED", target.id, {
    targetEmail: target.email,
    targetName: target.displayName || target.email,
  });
  await prisma.user.delete({ where: { id: target.id } });
  return { id: target.id, email: target.email };
}

function jsonDetail(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export async function getMemberActivity(targetId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId }, include: { wallet: true } });
  if (!target || target.role !== "MEMBER") throw new Error("MEMBER_NOT_FOUND");

  const [audits, jobs, agentRuns, ledger] = await Promise.all([
    prisma.auditLog.findMany({
      where: { OR: [{ userId: targetId }, { resource: "user", resourceId: targetId }] },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.generationJob.findMany({ where: { userId: targetId }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.agentRun.findMany({ where: { userId: targetId }, orderBy: { createdAt: "desc" }, take: 40 }),
    target.wallet
      ? prisma.walletLedger.findMany({ where: { walletId: target.wallet.id }, orderBy: { createdAt: "desc" }, take: 60 })
      : Promise.resolve([]),
  ]);

  const items = [
    ...audits.map((log) => ({
      id: `audit:${log.id}`,
      kind: "AUDIT",
      title: log.action,
      detail: jsonDetail(log.metadata),
      createdAt: log.createdAt.toISOString(),
    })),
    ...jobs.map((job) => ({
      id: `job:${job.id}`,
      kind: "GENERATION",
      title: `${job.status} · ${job.modelId}`,
      detail: `${job.provider} · ${job.startSec}-${job.endSec}s${job.errorMessage ? ` · ${job.errorMessage}` : ""}`,
      createdAt: job.createdAt.toISOString(),
    })),
    ...agentRuns.map((run) => ({
      id: `agent:${run.id}`,
      kind: "AGENT",
      title: `${run.status} · ${run.stage}`,
      detail: `mode=${run.mode} · spend=${run.actualSpendThb.toString()} THB`,
      createdAt: run.createdAt.toISOString(),
    })),
    ...ledger.map((entry) => ({
      id: `wallet:${entry.id}`,
      kind: "CREDIT",
      title: `${entry.type} · ${entry.credits > 0 ? "+" : ""}${entry.credits} เครดิต`,
      detail: `balance=${entry.balanceAfter}${entry.referenceType ? ` · ${entry.referenceType}` : ""}`,
      createdAt: entry.createdAt.toISOString(),
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 180);

  return {
    user: { id: target.id, name: target.displayName || target.email, email: target.email },
    items,
  };
}
