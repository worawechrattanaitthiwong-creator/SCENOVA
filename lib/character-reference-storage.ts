import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function storageRoot() {
  return process.env.SCENOVA_UPLOAD_DIR?.trim()
    || path.resolve(process.cwd(), "..", "uploads", "character-references");
}

function signingSecret() {
  const secret = process.env.STORAGE_SIGNING_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (!secret) throw new Error("CHARACTER_REFERENCE_SIGNING_SECRET_MISSING");
  return secret;
}

export function characterReferenceOwner(userId: string) {
  return createHash("sha256").update(userId).digest("hex").slice(0, 32);
}

export function signCharacterReference(owner: string, id: string) {
  return createHmac("sha256", signingSecret()).update(owner + ":" + id).digest("hex");
}

export function verifyCharacterReferenceSignature(owner: string, id: string, signature: string) {
  if (!/^[a-f0-9]{32}$/i.test(owner) || !/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(id) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = signCharacterReference(owner, id);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

export async function saveCharacterReference(userId: string, file: File) {
  const extension = MIME_TO_EXT[file.type];
  if (!extension) throw new Error("CHARACTER_REFERENCE_TYPE_UNSUPPORTED");
  const owner = characterReferenceOwner(userId);
  const id = randomUUID() + "." + extension;
  const directory = path.join(storageRoot(), owner);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(directory, id), bytes, { mode: 0o600 });
  return { id, owner, mime: file.type, label: file.name || "Character reference" };
}

export async function readCharacterReference(owner: string, id: string) {
  const extension = id.split(".").pop()?.toLowerCase() || "";
  const mime = EXT_TO_MIME[extension];
  if (!mime) return null;
  try {
    const data = await readFile(path.join(storageRoot(), owner, id));
    return { data, mime };
  } catch {
    return null;
  }
}

export async function deleteCharacterReference(userId: string, id: string) {
  const owner = characterReferenceOwner(userId);
  try {
    await unlink(path.join(storageRoot(), owner, id));
    return true;
  } catch {
    return false;
  }
}
