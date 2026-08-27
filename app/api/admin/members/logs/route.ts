import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { getMemberActivity } from "@/lib/user-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminUser() {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  return user?.role === "ADMIN" ? user : null;
}

export async function GET(request: Request) {
  if (!(await adminUser())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const userId = new URL(request.url).searchParams.get("userId") || "";
  if (!userId) return NextResponse.json({ error: "กรุณาระบุผู้ใช้" }, { status: 400 });
  try {
    return NextResponse.json(await getMemberActivity(userId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "MEMBER_NOT_FOUND" ? "ไม่พบบัญชีสมาชิก" : "โหลด Log ไม่สำเร็จ" }, { status: 404 });
  }
}
