import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { completeLogin, resolveSession, signSession, verifyTwoFactorChallenge } from "@/lib/auth-core";
import { buildOtpAuthUri, encryptTwoFactorSecret, generateRecoveryCodes, generateTotpSecret, hashRecoveryCodes, verifyTotp, decryptTwoFactorSecret } from "@/lib/two-factor";

export const runtime = "nodejs";

async function resolveSetupUserId() {
  const store = await cookies();
  const challenge = verifyTwoFactorChallenge(store.get("scenova_2fa_challenge")?.value);
  if (challenge) return challenge.userId;
  const session = await resolveSession(store.get("scenova_session")?.value);
  return session?.id || null;
}

function setupFailure(stage: string, error: unknown) {
  console.error(`SCENOVA_2FA_SETUP_FAILED:${stage}`, error);
  return NextResponse.json(
    {
      error: `2FA setup failed (${stage}). กรุณาลองใหม่อีกครั้งหลังระบบอัปเดต`,
      code: `SCENOVA_2FA_${stage}`,
    },
    { status: 503 },
  );
}

export async function GET() {
  let userId: string | null = null;
  try {
    userId = await resolveSetupUserId();
  } catch (error) {
    return setupFailure("CHALLENGE", error);
  }
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let user;
  try {
    user = await prisma.user.findUnique({ where: { id: userId } });
  } catch (error) {
    return setupFailure("USER_LOOKUP", error);
  }
  if (!user?.active) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (user.twoFactorEnabled) return NextResponse.json({ enabled: true });

  let secret: string;
  let encryptedSecret: string;
  try {
    secret = generateTotpSecret();
    encryptedSecret = await encryptTwoFactorSecret(secret);
  } catch (error) {
    return setupFailure("CRYPTO", error);
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encryptedSecret, twoFactorRecoveryCodes: [], twoFactorConfirmedAt: null },
    });
  } catch (error) {
    return setupFailure("DATABASE_WRITE", error);
  }

  try {
    return NextResponse.json({
      enabled: false,
      secret,
      otpauthUri: buildOtpAuthUri({ secret, email: user.email }),
      account: user.email,
      issuer: "SCENOVA",
    });
  } catch (error) {
    return setupFailure("RESPONSE", error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await resolveSetupUserId();
    if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "กรอกรหัส 6 หลักจาก Authenticator" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.active || !user.twoFactorSecret) return NextResponse.json({ error: "SETUP_NOT_STARTED" }, { status: 400 });

    const secret = await decryptTwoFactorSecret(user.twoFactorSecret);
    if (!verifyTotp(secret, code)) return NextResponse.json({ error: "รหัส Authenticator ไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });

    const recoveryCodes = generateRecoveryCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorConfirmedAt: new Date(),
        twoFactorRecoveryCodes: hashRecoveryCodes(recoveryCodes),
      },
    });

    const sessionUser = await completeLogin(user.id);
    const response = NextResponse.json({ ok: true, recoveryCodes });
    response.cookies.set("scenova_session", signSession(sessionUser), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.set("scenova_2fa_challenge", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "strict" });
    return response;
  } catch (error) {
    return setupFailure("CONFIRM", error);
  }
}
