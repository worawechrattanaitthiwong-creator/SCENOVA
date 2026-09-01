import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-core";
import { saveCharacterReference, signCharacterReference } from "@/lib/character-reference-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  try {
    const formData = await request.formData();
    const files = formData.getAll("images").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (!files.length) return NextResponse.json({ error: "กรุณาเลือกไฟล์รูปตัวละคร" }, { status: 400 });
    if (files.length > MAX_FILES) return NextResponse.json({ error: "เลือกได้สูงสุด 8 รูปต่อครั้ง" }, { status: 400 });
    if (files.some((file) => !ALLOWED_TYPES.has(file.type))) return NextResponse.json({ error: "รองรับเฉพาะ JPG, PNG และ WebP" }, { status: 415 });
    if (files.some((file) => file.size > MAX_FILE_BYTES)) return NextResponse.json({ error: "แต่ละรูปต้องมีขนาดไม่เกิน 10 MB" }, { status: 413 });
    if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) return NextResponse.json({ error: "ไฟล์รวมต่อครั้งต้องไม่เกิน 40 MB" }, { status: 413 });

    const origin = new URL(request.url).origin;
    const references = [];
    for (const file of files) {
      const saved = await saveCharacterReference(user.id, file);
      const signature = signCharacterReference(saved.owner, saved.id);
      const url = origin + "/api/character-references/" + encodeURIComponent(saved.id)
        + "?o=" + encodeURIComponent(saved.owner) + "&sig=" + encodeURIComponent(signature);
      references.push({ id: saved.id, label: saved.label, kind: "custom" as const, url });
    }
    return NextResponse.json({ references }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("CHARACTER_REFERENCE_UPLOAD_FAILED", error);
    return NextResponse.json({ error: "อัปโหลดรูปตัวละครไม่สำเร็จ" }, { status: 500 });
  }
}
