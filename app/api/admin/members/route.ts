import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { createAdminMember, deleteAdminMember, listAdminMembers, updateAdminMember } from "@/lib/user-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminUser() {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  return user?.role === "ADMIN" ? user : null;
}

function errorResponse(error: unknown, fallback: string) {
  const code = error instanceof Error ? error.message : "";
  const message: Record<string, string> = {
    EMAIL_EXISTS: "อีเมลนี้มีอยู่แล้ว",
    INVALID_EMAIL: "อีเมลไม่ถูกต้อง",
    INVALID_NAME: "กรุณากรอกชื่อผู้ใช้",
    PASSWORD_TOO_SHORT: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
    MEMBER_NOT_FOUND: "ไม่พบบัญชีผู้ใช้",
    CREDIT_BELOW_AVAILABLE: "ไม่สามารถหักเครดิตต่ำกว่ายอดที่พร้อมใช้งานได้",
    ADMIN_ACCOUNT_CREDIT_ONLY: "บัญชี Administrator ปรับได้เฉพาะเครดิตและดู Activity จากหน้านี้ เพื่อป้องกันการล็อกหรือลบบัญชี Admin โดยไม่ตั้งใจ",
  };
  return NextResponse.json({ error: message[code] || fallback, code: code || undefined }, { status: code === "MEMBER_NOT_FOUND" ? 404 : 400 });
}

export async function GET() {
  if (!(await adminUser())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json({ members: await listAdminMembers() });
}

export async function POST(request: Request) {
  const actor = await adminUser();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !name || password.length < 8) {
    return NextResponse.json({ error: "กรอกชื่อ อีเมล และรหัสผ่านอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
  }
  try {
    const member = await createAdminMember(actor, { email, name, password });
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    return errorResponse(error, "สร้างสมาชิกไม่สำเร็จ");
  }
}

export async function PATCH(request: Request) {
  const actor = await adminUser();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "กรุณาระบุผู้ใช้" }, { status: 400 });
  try {
    const member = await updateAdminMember(actor, {
      id,
      name: typeof body.name === "string" ? body.name : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
      creditDelta: typeof body.creditDelta === "number" ? body.creditDelta : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
      suspendMinutes: typeof body.suspendMinutes === "number" ? body.suspendMinutes : undefined,
      suspensionReason: typeof body.suspensionReason === "string" ? body.suspensionReason : undefined,
    });
    return NextResponse.json({ ok: true, member });
  } catch (error) {
    return errorResponse(error, "แก้ไขผู้ใช้ไม่สำเร็จ");
  }
}

export async function DELETE(request: Request) {
  const actor = await adminUser();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "กรุณาระบุผู้ใช้" }, { status: 400 });
  try {
    const deleted = await deleteAdminMember(actor, id);
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    return errorResponse(error, "ลบสมาชิกไม่สำเร็จ");
  }
}
