import { NextResponse } from "next/server";
import { authenticatePassword, completeLogin, signSession, signTwoFactorChallenge } from "@/lib/auth-core";
import { prisma } from "@/lib/db";
import { buildOtpAuthUri, encryptTwoFactorSecret, generateTotpSecret } from "@/lib/two-factor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";

    const user = await authenticatePassword(email, password);
    if (!user) {
      return NextResponse.json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
    }

    // Existing 2FA: password is correct, so issue a short-lived signed challenge
    // that only exists in the login page memory and is required for OTP verify.
    if (user.twoFactorEnabled) {
      return NextResponse.json({
        ok: true,
        twoFactorRequired: true,
        twoFactorSetupRequired: false,
        challengeToken: signTwoFactorChallenge(user.id),
      });
    }

    // Admin accounts must enroll 2FA. Bootstrap the enrollment in this same
    // password-authenticated request so the browser never has to rely on a
    // challenge cookie between login and setup.
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

      return NextResponse.json({
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
      });
    }

    // Members without 2FA can enter immediately after password verification.
    const sessionUser = await completeLogin(user.id);
    const response = NextResponse.json({ ok: true, user: sessionUser });
    response.cookies.set("scenova_session", signSession(sessionUser), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error("SCENOVA_AUTH_LOGIN_FAILED", error);
    return NextResponse.json(
      { ok: false, error: "ระบบเข้าสู่ระบบหรือการเตรียม Authenticator ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" },
      { status: 503 },
    );
  }
}
