import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { createLibraryAsset, listLibraryAssets, removeLibraryAsset, type LibraryKind, type LibraryMetadata } from "@/lib/library-repository";
import { resolveSession } from "@/lib/auth-core";

export const runtime = "nodejs";

const ALLOWED_KINDS: LibraryKind[] = ["images", "voices", "characters", "pets", "ambience", "plots"];

async function isAdmin() {
  const store = await cookies();
  return (await resolveSession(store.get("scenova_session")?.value))?.role === "ADMIN";
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const items = await listLibraryAssets();
    return NextResponse.json({ items });
  } catch (error) {
    console.error("ADMIN_LIBRARY_GET_FAILED", error);
    return NextResponse.json({ error: "LIBRARY_UNAVAILABLE" }, { status: 500 });
  }
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

  const metadata: LibraryMetadata = {
    visualLanguage: String(form.get("visualLanguage") || "").trim() || undefined,
    lighting: String(form.get("lighting") || "").trim() || undefined,
    colorMood: String(form.get("colorMood") || "").trim() || undefined,
    bestFor: String(form.get("bestFor") || "").trim() || undefined,
    promptHint: String(form.get("promptHint") || "").trim() || undefined,
    referenceUsage: String(form.get("referenceUsage") || "").trim() || undefined,
    compatibility: String(form.get("compatibility") || "").trim() || undefined,
    lockNote: String(form.get("lockNote") || "").trim() || undefined,
  };

  try {
    const item = await createLibraryAsset({ kind, title, description, assetUrl, metadata });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("ADMIN_LIBRARY_CREATE_FAILED", error);
    return NextResponse.json({ error: "เพิ่ม Library ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "").trim();
  const assetUrl = String(body.assetUrl || "").trim();
  if (!id) return NextResponse.json({ error: "ไม่พบ Asset ID" }, { status: 400 });

  try {
    const removed = await removeLibraryAsset(id);
    if (!removed) return NextResponse.json({ error: "ไม่พบรายการหรือถูกลบแล้ว" }, { status: 404 });
    if (assetUrl.startsWith("/uploads/")) {
      const safeName = path.basename(assetUrl);
      await unlink(path.join(process.cwd(), "public", "uploads", safeName)).catch(() => undefined);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("ADMIN_LIBRARY_DELETE_FAILED", error);
    return NextResponse.json({ error: "ลบ Asset ไม่สำเร็จ" }, { status: 500 });
  }
}
