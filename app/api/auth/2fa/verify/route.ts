import { NextResponse } from "next/server";
import { completeLogin, signSession, verifyTwoFactorChallenge, verifyTwoFactorForUser } from "@/lib/auth-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const challenge = verifyTwoFactorChallenge(request.headers.get("x-scenova-2fa-challenge"));
    if (!challenge) {
      return NextResponse.json(
        { error: "เซสชันยืนยัน 2FA หมดอายุ กรุณาเข้าสู่ระบบใหม่" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) {
      return NextResponse.json({ error: "กรอกรหัสจาก Authenticator หรือ Recovery Code" }, { status: 400 });
    }

    const valid = await verifyTwoFactorForUser(challenge.userId, code);
    if (!valid) {
      return NextResponse.json({ error: "รหัสไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });
    }

    const sessionUser = await completeLogin(challenge.userId);
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
    console.error("SCENOVA_2FA_VERIFY_FAILED", error);
    return NextResponse.json(
      { error: "ไม่สามารถตรวจสอบ 2FA ได้ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง" },
      { status: 503 },
    );
  }
}
