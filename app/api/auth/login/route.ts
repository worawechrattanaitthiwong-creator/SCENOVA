import { NextResponse } from "next/server";
import { authenticatePassword, completeLogin, signSession, signTwoFactorChallenge } from "@/lib/auth-core";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const user = await authenticatePassword(email, password);
  if (!user) return NextResponse.json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });

  const mustSetupTwoFactor = user.role === "ADMIN" && !user.twoFactorEnabled;
  if (user.twoFactorEnabled || mustSetupTwoFactor) {
    const response = NextResponse.json({
      ok: true,
      twoFactorRequired: user.twoFactorEnabled,
      twoFactorSetupRequired: mustSetupTwoFactor,
    });
    response.cookies.set("scenova_2fa_challenge", signTwoFactorChallenge(user.id), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  }

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
}
