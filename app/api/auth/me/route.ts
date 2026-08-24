import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth-core";

export async function GET() {
  const store = await cookies();
  const user = verifySession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ authenticated: false });
  return NextResponse.json({ authenticated: true, ...user });
}
