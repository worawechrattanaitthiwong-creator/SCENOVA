import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export type Role = "ADMIN" | "MEMBER";
export type SessionUser = { id: string; email: string; name: string; role: Role };
export type MemberRecord = SessionUser & { passwordHash: string; active: boolean; createdAt: string };

const globalStore = globalThis as unknown as { __scenovaMembers?: Map<string, MemberRecord> };
export const memberStore = globalStore.__scenovaMembers ?? new Map<string, MemberRecord>();
if (!globalStore.__scenovaMembers) globalStore.__scenovaMembers = memberStore;

const secret = () => process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "CHANGE_ME_IN_PRODUCTION" : "scenova-dev-session-secret");

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

export function createMember(input: { email: string; name: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (!email || memberStore.has(email)) throw new Error("EMAIL_EXISTS");
  const record: MemberRecord = {
    id: `member_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email,
    name: input.name.trim() || email,
    role: "MEMBER",
    passwordHash: hashPassword(input.password),
    active: true,
    createdAt: new Date().toISOString(),
  };
  memberStore.set(email, record);
  return record;
}

export function listMembers() {
  return [...memberStore.values()].map(({ passwordHash: _passwordHash, ...member }) => member);
}

export function authenticate(emailInput: string, password: string): SessionUser | null {
  const email = emailInput.trim().toLowerCase();
  const adminEmail = (process.env.SCENOVA_ADMIN_EMAIL || "admin@scenova.local").toLowerCase();
  const adminPassword = process.env.SCENOVA_ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "admin1234");
  if (email === adminEmail && adminPassword && password === adminPassword) {
    return { id: "admin", email: adminEmail, name: "SCENOVA Admin", role: "ADMIN" };
  }
  const member = memberStore.get(email);
  if (!member || !member.active || !verifyPassword(password, member.passwordHash)) return null;
  return { id: member.id, email: member.email, name: member.name, role: member.role };
}

export function signSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(token?: string | null): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
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
