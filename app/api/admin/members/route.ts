import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createMember, listMembers, resolveSession } from "@/lib/auth-core";

export const runtime = "nodejs";

async function adminUser() {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  return user?.role === "ADMIN" ? user : null;
}

export async function GET() {
  if (!(await adminUser())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json({ members: await listMembers() });
}

export async function POST(request: Request) {
  if (!(await adminUser())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !name || password.length < 8) {
    return NextResponse.json({ error: "กรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
  }
  try {
    const member = await createMember({ email, name, password });
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "EMAIL_EXISTS" ? "อีเมลนี้มีอยู่แล้ว" : "สร้างสมาชิกไม่สำเร็จ" }, { status: 400 });
  }
}
