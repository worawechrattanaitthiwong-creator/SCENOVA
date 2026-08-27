import { NextResponse } from "next/server";
import { completeLogin, signSession, verifyTwoFactorChallenge } from "@/lib/auth-core";
import { attachSessionCookie, setPrivateNoStore } from "@/lib/auth-cookie";
import { prisma } from "@/lib/db";
import { decryptTwoFactorSecret, generateRecoveryCodes, hashRecoveryCodes, verifyTotp } from "@/lib/two-factor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function challengeFromRequest(request: Request) {
  const token = request.headers.get("x-scenova-2fa-challenge");
  return verifyTwoFactorChallenge(token);
}

function requestMeta(request: Request) {
  return {
    userAgent: request.headers.get("user-agent") || "",
    forwardedFor: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
  };
}

export async function POST(request: Request) {
  try {
    const challenge = challengeFromRequest(request);
    if (!challenge) {
      return setPrivateNoStore(NextResponse.json(
        { error: "เซสชันตั้งค่า 2FA หมดอายุ กรุณาเข้าสู่ระบบใหม่" },
        { status: 401 },
      ));
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      return setPrivateNoStore(NextResponse.json({ error: "กรอกรหัส 6 หลักจาก Authenticator" }, { status: 400 }));
    }

    const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
    if (!user?.active || user.role !== "ADMIN") {
      return setPrivateNoStore(NextResponse.json({ error: "ไม่พบบัญชี Admin สำหรับการตั้งค่า 2FA" }, { status: 401 }));
    }
    if (!user.twoFactorSecret) {
      return setPrivateNoStore(NextResponse.json({ error: "ยังไม่มี Setup Key กรุณาเข้าสู่ระบบใหม่" }, { status: 400 }));
    }

    const secret = await decryptTwoFactorSecret(user.twoFactorSecret);
    if (!verifyTotp(secret, code)) {
      await prisma.auditLog.create({
        data: { userId: user.id, action: "ADMIN_2FA_SETUP_FAILED", resource: "auth", resourceId: user.id, metadata: requestMeta(request) },
      }).catch(() => undefined);
      return setPrivateNoStore(NextResponse.json({ error: "รหัส Authenticator ไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 }));
    }

    const recoveryCodes = generateRecoveryCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorConfirmedAt: new Date(),
        twoFactorRecoveryCodes: hashRecoveryCodes(recoveryCodes),
      },
    });

    await prisma.auditLog.createMany({
      data: [
        { userId: user.id, action: "ADMIN_2FA_ENABLED", resource: "auth", resourceId: user.id, metadata: requestMeta(request) },
        { userId: user.id, action: "LOGIN_SUCCESS_2FA_SETUP", resource: "auth", resourceId: user.id, metadata: requestMeta(request) },
      ],
    }).catch(() => undefined);

    const sessionUser = await completeLogin(user.id);
    const response = NextResponse.json({ ok: true, recoveryCodes });
    return attachSessionCookie(response, signSession(sessionUser), request);
  } catch (error) {
    console.error("SCENOVA_2FA_SETUP_CONFIRM_FAILED", error);
    return setPrivateNoStore(NextResponse.json(
      { error: "ไม่สามารถยืนยัน Authenticator ได้ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง" },
      { status: 503 },
    ));
  }
}
