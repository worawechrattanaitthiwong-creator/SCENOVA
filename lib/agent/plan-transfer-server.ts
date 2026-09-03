import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { AgentPlanTarget, AgentStructuredPlan } from "@/lib/agent/plan-schema";

const TRANSFER_TTL_MS = 15 * 60 * 1000;

type TransferPayload = {
  userId: string;
  target: AgentPlanTarget;
  projectKey: string;
  planHash: string;
  iat: number;
  exp: number;
};

function transferSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "scenova-dev-agent-plan-transfer-secret";
  throw new Error("SESSION_SECRET_REQUIRED");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashAgentPlan(plan: AgentStructuredPlan) {
  return createHash("sha256").update(stableJson(plan)).digest("base64url");
}

function signPayload(payload: TransferPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", transferSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function issueAgentPlanTransfer(input: {
  userId: string;
  target: AgentPlanTarget;
  projectKey: string;
  plan: AgentStructuredPlan;
}) {
  const now = Date.now();
  return signPayload({
    userId: input.userId,
    target: input.target,
    projectKey: input.projectKey,
    planHash: hashAgentPlan(input.plan),
    iat: now,
    exp: now + TRANSFER_TTL_MS,
  });
}

export function verifyAgentPlanTransfer(input: {
  token: string;
  userId: string;
  target: AgentPlanTarget;
  projectKey: string;
  plan: AgentStructuredPlan;
}) {
  const [encoded, signature] = input.token.split(".");
  if (!encoded || !signature) return false;
  const expected = createHmac("sha256", transferSecret()).update(encoded).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<TransferPayload>;
    if (!payload.exp || payload.exp < Date.now()) return false;
    if (payload.userId !== input.userId || payload.target !== input.target || payload.projectKey !== input.projectKey) return false;
    return payload.planHash === hashAgentPlan(input.plan);
  } catch {
    return false;
  }
}
