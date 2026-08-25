import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("scenova_session", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
  response.cookies.set("scenova_2fa_challenge", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "strict" });
  return response;
}
