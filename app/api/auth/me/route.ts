import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSecurityState, resolveSession, verifySession } from "@/lib/auth-core";
import { setPrivateNoStore } from "@/lib/auth-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = await cookies();
    const token = store.get("scenova_session")?.value;

    if (!token) {
      return setPrivateNoStore(NextResponse.json({
        authenticated: false,
        reason: "SESSION_COOKIE_MISSING",
      }));
    }

    if (!verifySession(token)) {
      return setPrivateNoStore(NextResponse.json({
        authenticated: false,
        reason: "SESSION_COOKIE_INVALID",
      }));
    }

    const user = await resolveSession(token);
    if (!user) {
      return setPrivateNoStore(NextResponse.json({
        authenticated: false,
        reason: "SESSION_REJECTED",
      }));
    }

    const security = await getSecurityState(user.id);
    return setPrivateNoStore(NextResponse.json({
      authenticated: true,
      ...user,
      twoFactorEnabled: security?.twoFactorEnabled ?? false,
      twoFactorRequired: security?.twoFactorRequired ?? false,
    }));
  } catch (error) {
    console.error("SCENOVA_AUTH_ME_FAILED", error);
    return setPrivateNoStore(NextResponse.json({
      authenticated: false,
      reason: "SESSION_CHECK_FAILED",
    }, { status: 503 }));
  }
}
