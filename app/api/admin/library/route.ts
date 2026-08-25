import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { createLibraryAsset, listLibraryAssets, removeLibraryAsset, type LibraryKind, type LibraryMetadata } from "@/lib/library-repository";
import { resolveSession } from "@/lib/auth-core";

export const runtime = "nodejs";

const ALLOWED_KINDS: LibraryKind[] = ["images", "voices", "characters", "pets", "ambience", "plots"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REFERENCE_FILES = 8;
const MAX_REFERENCE_TOTAL = 30 * 1024 * 1024;

async function isAdmin() {
  const store = await cookies();
  return (await resolveSession(store.get("scenova_session")?.value))?.role === "ADMIN";
}

function allowedMime(kind: LibraryKind, file: File) {
  if (kind === "voices" || kind === "ambience") return file.type.startsWith("audio/") || file.type.startsWith("image/");
  return file.type.startsWith("image/");
}

async function saveUpload(file: File) {
  const safeExt = (file.name.split(".").pop() || "bin").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "bin";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${filename}`;
}

async function removeUploadedUrl(url: string) {
  if (!url.startsWith("/uploads/")) return;
  const safeName = path.basename(url);
  await unlink(path.join(process.cwd(), "public", "uploads", safeName)).catch(() => undefined);
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
  const referenceFiles = form.getAll("referenceFiles").filter((value): value is File => value instanceof File && value.size > 0);

  if (!ALLOWED_KINDS.includes(kind) || !title) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "ไฟล์หลักใหญ่เกิน 10MB" }, { status: 400 });
    if (!allowedMime(kind, file)) return NextResponse.json({ error: "ประเภทไฟล์หลักไม่รองรับ" }, { status: 400 });
  }
  if (referenceFiles.length > 0 && kind !== "characters") return NextResponse.json({ error: "Reference Pack ใช้กับ Character เท่านั้น" }, { status: 400 });
  if (referenceFiles.length > MAX_REFERENCE_FILES) return NextResponse.json({ error: `Reference Pack ได้สูงสุด ${MAX_REFERENCE_FILES} ภาพ` }, { status: 400 });
  if (referenceFiles.some((item) => item.size > MAX_FILE_SIZE || !item.type.startsWith("image/"))) return NextResponse.json({ error: "Reference Pack ต้องเป็นภาพและแต่ละไฟล์ไม่เกิน 10MB" }, { status: 400 });
  if (referenceFiles.reduce((sum, item) => sum + item.size, 0) > MAX_REFERENCE_TOTAL) return NextResponse.json({ error: "Reference Pack รวมกันใหญ่เกิน 30MB" }, { status: 400 });

  const writtenUrls: string[] = [];
  try {
    let assetUrl: string | undefined;
    if (file instanceof File && file.size > 0) {
      assetUrl = await saveUpload(file);
      writtenUrls.push(assetUrl);
    }

    const referenceImages: string[] = [];
    for (const referenceFile of referenceFiles) {
      const url = await saveUpload(referenceFile);
      writtenUrls.push(url);
      referenceImages.push(url);
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
      role: String(form.get("role") || "").trim() || undefined,
      genderPresentation: String(form.get("genderPresentation") || "").trim() || undefined,
      ageRange: String(form.get("ageRange") || "").trim() || undefined,
      appearance: String(form.get("appearance") || "").trim() || undefined,
      personality: String(form.get("personality") || "").trim() || undefined,
      costume: String(form.get("costume") || "").trim() || undefined,
      voiceProfile: String(form.get("voiceProfile") || "").trim() || undefined,
      emotionRange: String(form.get("emotionRange") || "").trim() || undefined,
      performanceStyle: String(form.get("performanceStyle") || "").trim() || undefined,
      negativeIdentityRules: String(form.get("negativeIdentityRules") || "").trim() || undefined,
      referenceImages: referenceImages.length ? referenceImages : undefined,
    };

    const item = await createLibraryAsset({ kind, title, description, assetUrl, metadata });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    await Promise.all(writtenUrls.map(removeUploadedUrl));
    console.error("ADMIN_LIBRARY_CREATE_FAILED", error);
    return NextResponse.json({ error: "เพิ่ม Library ไม่สำเร็จ" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "").trim();
  const assetUrl = String(body.assetUrl || "").trim();
  const referenceImages = Array.isArray(body.referenceImages) ? body.referenceImages.map(String) : [];
  if (!id) return NextResponse.json({ error: "ไม่พบ Asset ID" }, { status: 400 });

  try {
    const removed = await removeLibraryAsset(id);
    if (!removed) return NextResponse.json({ error: "ไม่พบรายการหรือถูกลบแล้ว" }, { status: 404 });
    await removeUploadedUrl(assetUrl);
    await Promise.all(referenceImages.map(removeUploadedUrl));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("ADMIN_LIBRARY_DELETE_FAILED", error);
    return NextResponse.json({ error: "ลบ Asset ไม่สำเร็จ" }, { status: 500 });
  }
}
