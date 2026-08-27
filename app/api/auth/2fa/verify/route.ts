import { NextResponse } from "next/server";
import { completeLogin, signSession, verifyTwoFactorChallenge, verifyTwoFactorForUser } from "@/lib/auth-core";
import { attachSessionCookie, setPrivateNoStore } from "@/lib/auth-cookie";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestMeta(request: Request) {
  return {
    userAgent: request.headers.get("user-agent") || "",
    forwardedFor: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
  };
}

export async function POST(request: Request) {
  try {
    const challenge = verifyTwoFactorChallenge(request.headers.get("x-scenova-2fa-challenge"));
    if (!challenge) {
      return setPrivateNoStore(NextResponse.json(
        { error: "เซสชันยืนยัน 2FA หมดอายุ กรุณาเข้าสู่ระบบใหม่" },
        { status: 401 },
      ));
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) {
      return setPrivateNoStore(NextResponse.json({ error: "กรอกรหัสจาก Authenticator หรือ Recovery Code" }, { status: 400 }));
    }

    const valid = await verifyTwoFactorForUser(challenge.userId, code);
    if (!valid) {
      await prisma.auditLog.create({
        data: { userId: challenge.userId, action: "LOGIN_2FA_FAILED", resource: "auth", resourceId: challenge.userId, metadata: requestMeta(request) },
      }).catch(() => undefined);
      return setPrivateNoStore(NextResponse.json({ error: "รหัสไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 }));
    }

    const sessionUser = await completeLogin(challenge.userId);
    await prisma.auditLog.create({
      data: { userId: challenge.userId, action: "LOGIN_SUCCESS_2FA", resource: "auth", resourceId: challenge.userId, metadata: requestMeta(request) },
    }).catch(() => undefined);
    const response = NextResponse.json({ ok: true, user: sessionUser });
    return attachSessionCookie(response, signSession(sessionUser), request);
  } catch (error) {
    console.error("SCENOVA_2FA_VERIFY_FAILED", error);
    return setPrivateNoStore(NextResponse.json(
      { error: "ไม่สามารถตรวจสอบ 2FA ได้ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง" },
      { status: 503 },
    ));
  }
}
