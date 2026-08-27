import { NextResponse } from "next/server";
import { authenticatePassword, completeLogin, signSession, signTwoFactorChallenge } from "@/lib/auth-core";
import { attachSessionCookie, setPrivateNoStore } from "@/lib/auth-cookie";
import { prisma } from "@/lib/db";
import { releaseExpiredUserSuspension } from "@/lib/user-admin";
import { buildOtpAuthUri, encryptTwoFactorSecret, generateTotpSecret } from "@/lib/two-factor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requestMeta(request: Request, email: string) {
  return {
    email: email.trim().toLowerCase(),
    userAgent: request.headers.get("user-agent") || "",
    forwardedFor: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    await releaseExpiredUserSuspension(email);
    const user = await authenticatePassword(email, password);
    if (!user) {
      await prisma.auditLog.create({
        data: { action: "LOGIN_FAILED", resource: "auth", metadata: requestMeta(request, email) },
      }).catch(() => undefined);
      return setPrivateNoStore(NextResponse.json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับการใช้งาน" }, { status: 401 }));
    }

    if (user.twoFactorEnabled) {
      await prisma.auditLog.create({
        data: { userId: user.id, action: "LOGIN_PASSWORD_ACCEPTED_2FA", resource: "auth", resourceId: user.id, metadata: requestMeta(request, email) },
      }).catch(() => undefined);
      return setPrivateNoStore(NextResponse.json({
        ok: true,
        twoFactorRequired: true,
        twoFactorSetupRequired: false,
        challengeToken: signTwoFactorChallenge(user.id),
      }));
    }

    if (user.role === "ADMIN") {
      const secret = generateTotpSecret();
      const encryptedSecret = await encryptTwoFactorSecret(secret);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: encryptedSecret,
          twoFactorRecoveryCodes: [],
          twoFactorConfirmedAt: null,
        },
      });

      await prisma.auditLog.create({
        data: { userId: user.id, action: "ADMIN_2FA_SETUP_REQUIRED", resource: "auth", resourceId: user.id, metadata: requestMeta(request, email) },
      }).catch(() => undefined);

      return setPrivateNoStore(NextResponse.json({
        ok: true,
        twoFactorRequired: false,
        twoFactorSetupRequired: true,
        challengeToken: signTwoFactorChallenge(user.id),
        setup: {
          secret,
          otpauthUri: buildOtpAuthUri({ secret, email: user.email }),
          account: user.email,
          issuer: "SCENOVA",
        },
      }));
    }

    const sessionUser = await completeLogin(user.id);
    await prisma.auditLog.create({
      data: { userId: user.id, action: "LOGIN_SUCCESS", resource: "auth", resourceId: user.id, metadata: requestMeta(request, email) },
    }).catch(() => undefined);
    const response = NextResponse.json({ ok: true, user: sessionUser });
    return attachSessionCookie(response, signSession(sessionUser), request);
  } catch (error) {
    console.error("SCENOVA_AUTH_LOGIN_FAILED", error);
    return setPrivateNoStore(NextResponse.json(
      { ok: false, error: "ระบบเข้าสู่ระบบหรือการเตรียม Authenticator ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
      { status: 503 },
    ));
  }
}
