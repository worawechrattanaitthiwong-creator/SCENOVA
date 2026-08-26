import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { completeLogin, signSession, verifyTwoFactorChallenge, verifyTwoFactorForUser } from "@/lib/auth-core";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headerChallenge = verifyTwoFactorChallenge(request.headers.get("x-scenova-2fa-challenge"));
  const store = await cookies();
  const cookieChallenge = verifyTwoFactorChallenge(store.get("scenova_2fa_challenge")?.value);
  const challenge = headerChallenge || cookieChallenge;
  if (!challenge) return NextResponse.json({ error: "เซสชันยืนยันตัวตนหมดอายุ กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: "กรอกรหัสจาก Authenticator หรือ Recovery Code" }, { status: 400 });

  const valid = await verifyTwoFactorForUser(challenge.userId, code);
  if (!valid) return NextResponse.json({ error: "รหัสไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 400 });

  const sessionUser = await completeLogin(challenge.userId);
  const response = NextResponse.json({ ok: true, user: sessionUser });
  response.cookies.set("scenova_session", signSession(sessionUser), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  response.cookies.set("scenova_2fa_challenge", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "strict" });
  return response;
}
