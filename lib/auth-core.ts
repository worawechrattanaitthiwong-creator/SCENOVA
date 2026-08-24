import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

export type Role = "ADMIN" | "MEMBER";
export type SessionUser = { id: string; email: string; name: string; role: Role };
export type SafeMember = SessionUser & { active: boolean; createdAt: string; lastLoginAt?: string | null };

function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV !== "production") return "scenova-dev-session-secret";
  throw new Error("SESSION_SECRET_REQUIRED");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
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

  const user = await prisma.user.create({
    data: {
      email,
      displayName: input.name.trim() || email,
      passwordHash: hashPassword(input.password),
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
  } satisfies SafeMember;
}

export async function listMembers() {
  const users = await prisma.user.findMany({
    where: { role: "MEMBER" },
    orderBy: { createdAt: "desc" },
  });

  return users.map((user) => ({
    ...toSessionUser(user),
    active: user.active,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
  } satisfies SafeMember));
}

export async function authenticate(emailInput: string, password: string): Promise<SessionUser | null> {
  const email = emailInput.trim().toLowerCase();
  if (!email || !password) return null;

  let user = await prisma.user.findUnique({ where: { email } });

  // Bootstrap the first Admin from environment variables exactly once.
  if (!user) {
    const adminEmail = (process.env.SCENOVA_ADMIN_EMAIL || (process.env.NODE_ENV !== "production" ? "admin@scenova.local" : "")).trim().toLowerCase();
    const adminPassword = process.env.SCENOVA_ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "admin1234" : "");
    if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
      user = await prisma.user.create({
        data: {
          email: adminEmail,
          displayName: "SCENOVA Admin",
          passwordHash: hashPassword(adminPassword),
          role: "ADMIN",
          active: true,
          lastLoginAt: new Date(),
          wallet: { create: {} },
        },
      });
      return toSessionUser(user);
    }
    return null;
  }

  if (!user.active || !verifyPassword(password, user.passwordHash)) return null;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  return toSessionUser(updated);
}

export function signSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(token?: string | null): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser & { exp: number };
    if (parsed.exp < Date.now()) return null;
    return { id: parsed.id, email: parsed.email, name: parsed.name, role: parsed.role };
  } catch {
    return null;
  }
}
