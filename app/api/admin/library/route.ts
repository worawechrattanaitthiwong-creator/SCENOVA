import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { addLibraryItem, libraryStore, type LibraryKind } from "@/lib/library-store";
import { verifySession } from "@/lib/auth-core";

export const runtime = "nodejs";

const ALLOWED_KINDS: LibraryKind[] = ["images", "voices", "characters", "pets", "ambience", "plots"];

async function isAdmin() {
  const store = await cookies();
  return verifySession(store.get("scenova_session")?.value)?.role === "ADMIN";
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json({ items: libraryStore });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const form = await request.formData();
  const kind = String(form.get("kind") || "images") as LibraryKind;
  const title = String(form.get("title") || "").trim();
  const description = String(form.get("description") || "").trim();
  const file = form.get("file");
  if (!ALLOWED_KINDS.includes(kind) || !title) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  let assetUrl: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "ไฟล์ใหญ่เกิน 10MB" }, { status: 400 });
    const safeExt = (file.name.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
    assetUrl = `/uploads/${filename}`;
  }

  const item = addLibraryItem({ kind, title, description, assetUrl });
  return NextResponse.json({ ok: true, item });
}
