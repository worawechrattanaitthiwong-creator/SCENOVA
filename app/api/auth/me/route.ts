import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSecurityState, resolveSession } from "@/lib/auth-core";
import { setPrivateNoStore } from "@/lib/auth-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return setPrivateNoStore(NextResponse.json({ authenticated: false }));

  const security = await getSecurityState(user.id);
  return setPrivateNoStore(NextResponse.json({
    authenticated: true,
    ...user,
    twoFactorEnabled: security?.twoFactorEnabled ?? false,
    twoFactorRequired: security?.twoFactorRequired ?? false,
  }));
}
