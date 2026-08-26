import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEmergencySecurityState } from "@/lib/emergency-security";
import { decryptTwoFactorSecret, hashRecoveryCode, verifyTotp } from "@/lib/two-factor";

export type Role = "ADMIN" | "MEMBER";
export type SessionUser = { id: string; email: string; name: string; role: Role };
export type SafeMember = SessionUser & { active: boolean; createdAt: string; lastLoginAt?: string | null; twoFactorEnabled: boolean };
export type PasswordUser = SessionUser & { twoFactorEnabled: boolean };

type SignedPayload = { sub: string; exp: number; iat: number; purpose: "session" | "2fa" };

const PASSWORD_KEY_LENGTH = 64;

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV !== "production") return "scenova-dev-session-secret";
  throw new Error("SESSION_SECRET_REQUIRED");
}

function adminBootstrapCredentials() {
  return {
    email: (process.env.SCENOVA_ADMIN_EMAIL || (process.env.NODE_ENV !== "production" ? "admin@scenova.local" : "")).trim().toLowerCase(),
    password: process.env.SCENOVA_ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "admin1234" : ""),
  };
}

function derivePasswordKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, PASSWORD_KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Buffer.from(derivedKey));
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derivePasswordKey(password, salt)).toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = await derivePasswordKey(password, salt);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

function toSessionUser(user: { id: string; email: string; displayName: string | null; role: string }): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.displayName || user.email,
    role: user.role === "ADMIN" ? "ADMIN" : "MEMBER",
  };
}

export async function createMember(input: { email: string; name: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("INVALID_EMAIL");
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw new Error("EMAIL_EXISTS");

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      displayName: input.name.trim() || email,
      passwordHash,
      role: "MEMBER",
      active: true,
      wallet: { create: {} },
    },
  });

  return {
    ...toSessionUser(user),
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
    twoFactorEnabled: user.twoFactorEnabled,
  } satisfies SafeMember;
}

export async function listMembers() {
  const users = await prisma.user.findMany({
    where: { role: "MEMBER" },
    orderBy: { createdAt: "desc" },
  });

  return users.map((user: User) => ({
    ...toSessionUser(user),
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
    twoFactorEnabled: user.twoFactorEnabled,
  } satisfies SafeMember));
}

export async function authenticatePassword(emailInput: string, password: string): Promise<PasswordUser | null> {
  const email = emailInput.trim().toLowerCase();
  if (!email || !password) return null;

  const admin = adminBootstrapCredentials();
  let user = await prisma.user.findUnique({ where: { email } });

  // Bootstrap the first Admin from environment variables.
  if (!user) {
    if (admin.email && admin.password && email === admin.email && password === admin.password) {
      const passwordHash = await hashPassword(admin.password);
      user = await prisma.user.create({
        data: {
          email: admin.email,
          displayName: "SCENOVA Admin",
          passwordHash,
          role: "ADMIN",
          active: true,
          wallet: { create: {} },
        },
      });
    } else {
      return null;
    }
  }

  if (!user.active) return null;

  let passwordValid = await verifyPassword(password, user.passwordHash);

  // Production recovery path: SCENOVA_ADMIN_PASSWORD is also a break-glass
  // credential for the configured Admin account. This fixes the common case
  // where the environment password was changed after the Admin row had already
  // been bootstrapped. It never promotes MEMBER accounts to ADMIN.
  const isConfiguredAdmin = user.role === "ADMIN" && Boolean(admin.email) && user.email.toLowerCase() === admin.email;
  if (!passwordValid && isConfiguredAdmin && admin.password && password === admin.password) {
    const passwordHash = await hashPassword(admin.password);
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    passwordValid = true;
  }

  if (!passwordValid) return null;
  const emergency = await getEmergencySecurityState();
  if ((emergency.newLoginRestricted || emergency.maintenanceMode) && user.role !== "ADMIN") return null;
  return { ...toSessionUser(user), twoFactorEnabled: user.twoFactorEnabled };
}

export async function completeLogin(userId: string) {
  const user = await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  return toSessionUser(user);
}

function signPayload(payload: Omit<SignedPayload, "iat"> & { iat?: number }) {
  const fullPayload: SignedPayload = { ...payload, iat: payload.iat ?? Date.now() };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyPayload(token: string | null | undefined, purpose: SignedPayload["purpose"]) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SignedPayload>;
    if (!parsed.exp || parsed.exp < Date.now() || parsed.purpose !== purpose || !parsed.sub) return null;
    return {
      sub: parsed.sub,
      exp: parsed.exp,
      iat: typeof parsed.iat === "number" ? parsed.iat : 0,
      purpose: parsed.purpose,
    } as SignedPayload;
  } catch {
    return null;
  }
}

export function signSession(user: SessionUser) {
  return signPayload({ sub: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 * 7, purpose: "session" });
}

export function verifySession(token?: string | null): { userId: string; issuedAt: number } | null {
  const payload = verifyPayload(token, "session");
  return payload ? { userId: payload.sub, issuedAt: payload.iat } : null;
}

export async function resolveSession(token?: string | null): Promise<SessionUser | null> {
  const session = verifySession(token);
  if (!session) return null;
  const emergency = await getEmergencySecurityState();
  if (emergency.sessionInvalidBefore && session.issuedAt <= emergency.sessionInvalidBefore.getTime()) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.active) return null;
  if (emergency.maintenanceMode && user.role !== "ADMIN") return null;
  return toSessionUser(user);
}

export function signTwoFactorChallenge(userId: string) {
  return signPayload({ sub: userId, exp: Date.now() + 1000 * 60 * 10, purpose: "2fa" });
}

export function verifyTwoFactorChallenge(token?: string | null) {
  const payload = verifyPayload(token, "2fa");
  return payload ? { userId: payload.sub } : null;
}

export async function getSecurityState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, active: true, twoFactorEnabled: true, twoFactorConfirmedAt: true },
  });
  if (!user?.active) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role === "ADMIN" ? "ADMIN" as const : "MEMBER" as const,
    twoFactorEnabled: user.twoFactorEnabled,
    twoFactorRequired: user.role === "ADMIN",
    twoFactorConfirmedAt: user.twoFactorConfirmedAt?.toISOString() || null,
  };
}

export async function verifyTwoFactorForUser(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.active || !user.twoFactorEnabled || !user.twoFactorSecret) return false;

  const normalized = code.trim().toUpperCase();
  if (/^\d{6}$/.test(normalized)) {
    return verifyTotp(decryptTwoFactorSecret(user.twoFactorSecret), normalized);
  }

  const hashes = Array.isArray(user.twoFactorRecoveryCodes) ? user.twoFactorRecoveryCodes.filter((item): item is string => typeof item === "string") : [];
  const attemptedHash = hashRecoveryCode(normalized);
  const index = hashes.indexOf(attemptedHash);
  if (index < 0) return false;

  const nextHashes = hashes.filter((_, itemIndex) => itemIndex !== index);
  await prisma.user.update({ where: { id: userId }, data: { twoFactorRecoveryCodes: nextHashes } });
  return true;
}
