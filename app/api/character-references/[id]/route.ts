import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolveSession } from "@/lib/auth-core";
import {
  characterReferenceOwner,
  deleteCharacterReference,
  readCharacterReference,
  verifyCharacterReferenceSignature,
} from "@/lib/character-reference-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function signedRequest(request: Request, id: string) {
  const url = new URL(request.url);
  const owner = url.searchParams.get("o") || "";
  const signature = url.searchParams.get("sig") || "";
  return { owner, valid: verifyCharacterReferenceSignature(owner, id, signature) };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const signed = signedRequest(request, id);
  if (!signed.valid) return NextResponse.json({ error: "INVALID_REFERENCE_SIGNATURE" }, { status: 403 });
  const file = await readCharacterReference(signed.owner, id);
  if (!file) return NextResponse.json({ error: "REFERENCE_NOT_FOUND" }, { status: 404 });
  return new Response(file.data, {
    status: 200,
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.data.byteLength),
      "Cache-Control": "private, max-age=3600, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const signed = signedRequest(request, id);
  if (!signed.valid || signed.owner !== characterReferenceOwner(user.id)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  await deleteCharacterReference(user.id, id);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
