import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function write(file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function replaceStrict(content, search, replacement, label) {
  if (!content.includes(search)) throw new Error(`PATCH_TARGET_NOT_FOUND:${label}`);
  return content.replace(search, replacement);
}

const studioPath = "components/single-episode-studio.tsx";
let studio = read(studioPath);

studio = replaceStrict(studio, `type Character = {
  id: string;
  name: string;
  role: string;
  appearance: string;
  voice: string;
  identityLock: boolean;
  voiceLock: boolean;
};`, `type CharacterReference = {
  id: string;
  label: string;
  kind: "custom";
  url: string;
};

type Character = {
  id: string;
  name: string;
  role: string;
  appearance: string;
  voice: string;
  identityLock: boolean;
  voiceLock: boolean;
  references: CharacterReference[];
};`, "character-type");

studio = replaceStrict(studio, `    voiceProfile?: string;
    promptHint?: string;`, `    voiceProfile?: string;
    promptHint?: string;
    referenceImages?: string[];`, "selected-character-reference-images");

studio = replaceStrict(studio, `    identityLock: true,
    voiceLock: true,
  };`, `    identityLock: true,
    voiceLock: true,
    references: [],
  };`, "make-character-references");

studio = replaceStrict(studio, `    identityLock: input.identityLock ?? true,
    voiceLock: input.voiceLock ?? true,
  };`, `    identityLock: input.identityLock ?? true,
    voiceLock: input.voiceLock ?? true,
    references: Array.isArray(input.references) ? input.references : base.references,
  };`, "normalize-character-references");

studio = replaceStrict(studio, `  const [agentBudgetThb, setAgentBudgetThb] = useState(500);
  const [agentSubmitting, setAgentSubmitting] = useState(false);`, `  const [agentBudgetThb, setAgentBudgetThb] = useState(500);
  const [agentSubmitting, setAgentSubmitting] = useState(false);
  const [uploadingCharacterId, setUploadingCharacterId] = useState("");`, "upload-state");

studio = replaceStrict(studio, `        identityLock: true,
        voiceLock: true,
      };`, `        identityLock: true,
        voiceLock: true,
        references: (meta.referenceImages || []).filter(Boolean).slice(0, 8).map((url, referenceIndex) => ({
          id: payload.id ? "library_" + payload.id + "_reference_" + referenceIndex : makeId("library_reference"),
          label: "Library Reference " + (referenceIndex + 1),
          kind: "custom" as const,
          url,
        })),
      };`, "imported-character-references");

studio = replaceStrict(studio, `  function patchCharacter(id: string, patch: Partial<Character>) {
    setCharacters((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function patchAnimal`, `  function patchCharacter(id: string, patch: Partial<Character>) {
    setCharacters((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  async function uploadCharacterReferences(characterId: string, files: File[]) {
    if (!files.length || uploadingCharacterId) return;
    const character = characters.find((item) => item.id === characterId);
    const remaining = Math.max(0, 8 - (character?.references.length || 0));
    if (!remaining) {
      setMessage("ตัวละครนี้มีรูปอ้างอิงครบ 8 รูปแล้ว");
      return;
    }
    const selected = files.slice(0, remaining);
    const formData = new FormData();
    selected.forEach((file) => formData.append("images", file));
    setUploadingCharacterId(characterId);
    setMessage("กำลังอัปโหลดรูปอ้างอิงตัวละคร...");
    try {
      const response = await fetch("/api/character-references", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });
      const data = await response.json() as { references?: CharacterReference[]; error?: string };
      if (!response.ok || !Array.isArray(data.references)) throw new Error(data.error || "อัปโหลดรูปตัวละครไม่สำเร็จ");
      setCharacters((current) => current.map((item) => item.id === characterId
        ? { ...item, references: [...item.references, ...data.references!].slice(0, 8) }
        : item));
      setMessage("เพิ่มรูปอ้างอิงตัวละคร " + data.references.length + " รูปแล้ว");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อัปโหลดรูปตัวละครไม่สำเร็จ");
    } finally {
      setUploadingCharacterId("");
    }
  }

  async function removeCharacterReference(characterId: string, reference: CharacterReference) {
    setCharacters((current) => current.map((item) => item.id === characterId
      ? { ...item, references: item.references.filter((entry) => entry.id !== reference.id) }
      : item));
    try {
      await fetch(reference.url, { method: "DELETE", credentials: "same-origin" });
    } catch {
      // UI removal should not be blocked if storage cleanup is temporarily unavailable.
    }
  }

  function patchAnimal`, "character-upload-handlers");

studio = replaceStrict(studio, `            <label className={styles.field}><span>รูปลักษณ์ / เสื้อผ้า / บุคลิก / จุดจำ</span><textarea value={character.appearance} onChange={(event) => patchCharacter(character.id, { appearance: event.target.value })} placeholder="ใบหน้า ทรงผม อายุ รูปร่าง เสื้อผ้า เครื่องประดับ บุคลิก และรายละเอียดที่ห้ามเปลี่ยน" /></label>
            <div className={styles.miniLocks}><label className={character.identityLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.identityLock} onChange={(event) => patchCharacter(character.id, { identityLock: event.target.checked })} />ล็อกตัวตน</label><label className={character.voiceLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.voiceLock} onChange={(event) => patchCharacter(character.id, { voiceLock: event.target.checked })} />ล็อกเสียง</label><Link href="/libraries?tab=characters" onClick={() => localStorage.setItem("scenova-character-import-target-v1", character.id)}>＋ นำเข้าตัวละครจากคลัง</Link></div>`, `            <label className={styles.field}><span>รูปลักษณ์ / เสื้อผ้า / บุคลิก / จุดจำ</span><textarea value={character.appearance} onChange={(event) => patchCharacter(character.id, { appearance: event.target.value })} placeholder="ใบหน้า ทรงผม อายุ รูปร่าง เสื้อผ้า เครื่องประดับ บุคลิก และรายละเอียดที่ห้ามเปลี่ยน" /></label>
            <div className={styles.referencePicker}>
              <div className={styles.referenceHead}>
                <div><b>รูปอ้างอิงตัวละคร</b><span>เลือกรูปจากเครื่องได้หลายไฟล์พร้อมกัน สูงสุด 8 รูป ระบบจะส่งภาพเหล่านี้เป็น Character Reference ให้โมเดลที่รองรับ</span></div>
                <label className={styles.referenceButton} aria-disabled={uploadingCharacterId === character.id}>
                  {uploadingCharacterId === character.id ? "กำลังอัปโหลด..." : "＋ เลือกรูปจากเครื่อง"}
                  <input
                    className={styles.referenceInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={uploadingCharacterId === character.id || character.references.length >= 8}
                    onChange={(event) => {
                      const files = Array.from(event.currentTarget.files || []);
                      event.currentTarget.value = "";
                      void uploadCharacterReferences(character.id, files);
                    }}
                  />
                </label>
              </div>
              {character.references.length ? <div className={styles.referenceGrid}>
                {character.references.map((reference) => <figure className={styles.referenceThumb} key={reference.id}>
                  <img src={reference.url} alt={reference.label || character.name} loading="lazy" />
                  <figcaption title={reference.label}>{reference.label}</figcaption>
                  <button type="button" onClick={() => void removeCharacterReference(character.id, reference)} aria-label={"ลบ " + reference.label}>×</button>
                </figure>)}
              </div> : <div className={styles.referenceEmpty}>ยังไม่มีรูปอ้างอิง — เลือก Front / 3/4 / Side / Full Body หรือ Expression ได้หลายรูป</div>}
            </div>
            <div className={styles.miniLocks}><label className={character.identityLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.identityLock} onChange={(event) => patchCharacter(character.id, { identityLock: event.target.checked })} />ล็อกตัวตน</label><label className={character.voiceLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.voiceLock} onChange={(event) => patchCharacter(character.id, { voiceLock: event.target.checked })} />ล็อกเสียง</label><Link href="/libraries?tab=characters" onClick={() => localStorage.setItem("scenova-character-import-target-v1", character.id)}>＋ นำเข้าตัวละครจากคลัง</Link></div>`, "character-reference-ui");

write(studioPath, studio);

const cssPath = "components/single-episode-studio.module.css";
let css = read(cssPath);
if (!css.includes(".referencePicker{")) {
  css += `

.referencePicker{margin-top:10px;padding:11px;border:1px solid var(--border);border-radius:11px;background:var(--surface3)}
.referenceHead{display:flex;align-items:center;justify-content:space-between;gap:12px}.referenceHead>div{min-width:0}.referenceHead b,.referenceHead span{display:block}.referenceHead b{font-size:11px}.referenceHead span{margin-top:2px;color:var(--muted);font-size:9px;line-height:1.45}.referenceButton{position:relative;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-height:36px;border:1px solid var(--borderStrong);border-radius:9px;background:var(--accentSoft);color:var(--accent);padding:7px 10px;font-size:10px;font-weight:900;cursor:pointer}.referenceButton[aria-disabled="true"]{opacity:.55;cursor:wait}.referenceInput{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.referenceGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;margin-top:10px}.referenceThumb{position:relative;min-width:0;margin:0;border:1px solid var(--border);border-radius:9px;background:var(--surface);overflow:hidden}.referenceThumb img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:var(--surface2)}.referenceThumb figcaption{padding:6px 7px;color:var(--muted);font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.referenceThumb button{position:absolute;top:5px;right:5px;width:23px;height:23px;border:1px solid color-mix(in srgb,var(--danger) 35%,var(--border));border-radius:999px;background:color-mix(in srgb,var(--surface) 88%,transparent);color:var(--danger);font-size:16px;line-height:1;cursor:pointer;backdrop-filter:blur(6px)}.referenceEmpty{margin-top:9px;border:1px dashed var(--border);border-radius:8px;color:var(--muted);padding:9px;text-align:center;font-size:9px}
@media(max-width:760px){.referenceHead{align-items:stretch;flex-direction:column}.referenceButton{width:100%}.referenceGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
`;
}
write(cssPath, css);

const projectPath = "lib/agent/studio-project.ts";
let project = read(projectPath);
project = replaceStrict(project, `import type { AspectRatio, EpisodeDuration, Project } from "@/lib/domain";`, `import type { AspectRatio, CharacterReference, EpisodeDuration, Project } from "@/lib/domain";`, "project-reference-import");
project = replaceStrict(project, `  identityLock: boolean;
  voiceLock: boolean;
};`, `  identityLock: boolean;
  voiceLock: boolean;
  references?: CharacterReference[];
};`, "project-character-references-type");
project = replaceStrict(project, `    lock: character.identityLock,
    references: [],`, `    lock: character.identityLock,
    references: character.references || [],`, "project-character-references-map");
write(projectPath, project);

const workerPath = "lib/agent/worker-runtime.ts";
let worker = read(workerPath);
worker = replaceStrict(worker, `function quoteItems(plan: PlannedGeneration): CostQuoteItem[] {`, `function imageReferencesForRenderSegment(project: Project, episode: Project["episodes"][number], renderSegment: GenerateVideoRequest["renderSegment"]) {
  const sourceIds = new Set(renderSegment.sourceSegmentIds || []);
  const relevantSegments = sourceIds.size
    ? episode.segments.filter((segment) => sourceIds.has(segment.id))
    : episode.segments.filter((segment) => segment.start < renderSegment.end && segment.end > renderSegment.start);
  const characterIds = new Set(relevantSegments.flatMap((segment) => segment.characterIds));
  const urls = project.characters
    .filter((character) => characterIds.has(character.id))
    .flatMap((character) => character.references || [])
    .map((reference) => reference.url)
    .filter((url): url is string => Boolean(url));
  return [...new Set(urls)].slice(0, 8);
}

function quoteItems(plan: PlannedGeneration): CostQuoteItem[] {`, "worker-reference-helper");
worker = replaceStrict(worker, `        aspectRatio: project.aspectRatio,
        imageReferences: [],
        videoReferences: [],`, `        aspectRatio: project.aspectRatio,
        imageReferences: provider.getModelDefinition().supportsImageReference
          ? imageReferencesForRenderSegment(project, episode, renderSegment)
          : [],
        videoReferences: [],`, "worker-image-references");
write(workerPath, worker);

const storageFile = String.raw`import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
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
`;
write("lib/character-reference-storage.ts", storageFile);

const uploadRoute = String.raw`import { cookies } from "next/headers";
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
`;
write("app/api/character-references/route.ts", uploadRoute);

const deliveryRoute = String.raw`import { cookies } from "next/headers";
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
`;
write("app/api/character-references/[id]/route.ts", deliveryRoute);

const envPath = ".env.example";
let env = read(envPath);
if (!env.includes("SCENOVA_UPLOAD_DIR=")) {
  env += `\n# Persistent private uploads. Empty uses ../uploads/character-references relative to app cwd.\nSCENOVA_UPLOAD_DIR=""\n`;
}
write(envPath, env);

console.log("Character reference multi-file upload patch applied.");
