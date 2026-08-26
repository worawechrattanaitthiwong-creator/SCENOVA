import { NextResponse } from "next/server";
import { authenticatePassword, completeLogin, signSession, signTwoFactorChallenge } from "@/lib/auth-core";
import { attachSessionCookie, setPrivateNoStore } from "@/lib/auth-cookie";
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
      return setPrivateNoStore(NextResponse.json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 }));
    }

    if (user.twoFactorEnabled) {
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
