import { NextResponse } from "next/server";
import { completeLogin, signSession, verifyTwoFactorChallenge, verifyTwoFactorForUser } from "@/lib/auth-core";
import { attachSessionCookie, setPrivateNoStore } from "@/lib/auth-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      return setPrivateNoStore(NextResponse.json({ error: "รหัสไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 }));
    }

    const sessionUser = await completeLogin(challenge.userId);
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
