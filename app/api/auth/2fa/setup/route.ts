import { NextResponse } from "next/server";
import { completeLogin, signSession, verifyTwoFactorChallenge } from "@/lib/auth-core";
import { prisma } from "@/lib/db";
import { decryptTwoFactorSecret, generateRecoveryCodes, hashRecoveryCodes, verifyTotp } from "@/lib/two-factor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function challengeFromRequest(request: Request) {
  const token = request.headers.get("x-scenova-2fa-challenge");
  return verifyTwoFactorChallenge(token);
}

export async function POST(request: Request) {
  try {
    const challenge = challengeFromRequest(request);
    if (!challenge) {
      return NextResponse.json(
        { error: "เซสชันตั้งค่า 2FA หมดอายุ กรุณาเข้าสู่ระบบใหม่" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "กรอกรหัส 6 หลักจาก Authenticator" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
    if (!user?.active || user.role !== "ADMIN") {
      return NextResponse.json({ error: "ไม่พบบัญชี Admin สำหรับการตั้งค่า 2FA" }, { status: 401 });
    }
    if (!user.twoFactorSecret) {
      return NextResponse.json({ error: "ยังไม่มี Setup Key กรุณาเข้าสู่ระบบใหม่" }, { status: 400 });
    }

    const secret = await decryptTwoFactorSecret(user.twoFactorSecret);
    if (!verifyTotp(secret, code)) {
      return NextResponse.json({ error: "รหัส Authenticator ไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });
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

    const sessionUser = await completeLogin(user.id);
    const response = NextResponse.json({ ok: true, recoveryCodes });
    response.cookies.set("scenova_session", signSession(sessionUser), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error("SCENOVA_2FA_SETUP_CONFIRM_FAILED", error);
    return NextResponse.json(
      { error: "ไม่สามารถยืนยัน Authenticator ได้ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง" },
      { status: 503 },
    );
  }
}
