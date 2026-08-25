import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { prisma } from "@/lib/db";
import {
  activateEmergencyLockdown,
  getEmergencySecurityState,
  restoreEmergencyState,
  revokeAllSessions,
  updateEmergencyControls,
} from "@/lib/emergency-security";

export const runtime = "nodejs";

async function adminUser() {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  return user?.role === "ADMIN" ? user : null;
}

export async function GET() {
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const [state, events] = await Promise.all([
    getEmergencySecurityState(),
    prisma.auditLog.findMany({
      where: { resource: "system-security" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, metadata: true, createdAt: true, userId: true },
    }),
  ]);
  return NextResponse.json({ state, events });
}

export async function POST(request: Request) {
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : "";

  try {
    if (action === "LOCKDOWN") {
      const state = await activateEmergencyLockdown(user.id, reason || "Admin activated emergency lockdown");
      return NextResponse.json({ ok: true, state, sessionRevoked: true, message: "Emergency Lockdown เปิดแล้ว ทุก Session เดิมถูกยกเลิก" });
    }

    if (action === "RESTORE") {
      if (body.confirmation !== "RESTORE SCENOVA") return NextResponse.json({ error: "CONFIRMATION_REQUIRED" }, { status: 400 });
      const state = await restoreEmergencyState(user.id, reason || "Admin restored system after verification");
      return NextResponse.json({ ok: true, state });
    }

    if (action === "REVOKE_SESSIONS") {
      if (body.confirmation !== "REVOKE SESSIONS") return NextResponse.json({ error: "CONFIRMATION_REQUIRED" }, { status: 400 });
      const state = await revokeAllSessions(user.id, reason || "Admin revoked all sessions");
      return NextResponse.json({ ok: true, state, sessionRevoked: true });
    }

    if (action === "UPDATE") {
      const disabledProviderIds = Array.isArray(body.disabledProviderIds)
        ? body.disabledProviderIds.filter((item): item is string => typeof item === "string")
        : undefined;
      const bool = (key: string) => typeof body[key] === "boolean" ? body[key] as boolean : undefined;
      const state = await updateEmergencyControls({
        actorUserId: user.id,
        reason,
        maintenanceMode: bool("maintenanceMode"),
        generationDisabled: bool("generationDisabled"),
        agentDisabled: bool("agentDisabled"),
        llmDisabled: bool("llmDisabled"),
        paymentDisabled: bool("paymentDisabled"),
        newLoginRestricted: bool("newLoginRestricted"),
        queuePaused: bool("queuePaused"),
        emergencyRateLimitEnabled: bool("emergencyRateLimitEnabled"),
        disabledProviderIds,
      });
      return NextResponse.json({ ok: true, state });
    }

    return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "EMERGENCY_CONTROL_FAILED" }, { status: 500 });
  }
}
