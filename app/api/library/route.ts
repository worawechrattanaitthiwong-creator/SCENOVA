import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { disabledSystemAssetIds, listLibraryAssets, SYSTEM_ASSETS } from "@/lib/library-repository";
import { VOICE_PROFILES } from "@/lib/sound-design-options";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function voiceId(title: string) {
  return `voice-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

const SYSTEM_VOICES = VOICE_PROFILES.map((profile, index) => {
  const [title, ...descriptionParts] = profile.split(" — ");
  const description = descriptionParts.join(" — ") || "เสียงตัวละคร SCENOVA";
  return {
    id: title === "Mira" ? "voice-mira" : voiceId(title),
    kind: "voices",
    title,
    description,
    source: "SYSTEM" as const,
    sortOrder: (index + 1) * 10,
    metadata: {
      bestFor: description,
      promptHint: `ใช้เสียง ${title} และรักษาน้ำเสียง บุคลิก จังหวะ และช่วงอายุของเสียงให้คงที่ตลอดตัวละคร`,
      referenceUsage: "เลือกเป็น Voice Profile ของตัวละคร แล้วใช้ Voice Lock เมื่อทำหลาย Scene / Episode",
      lockNote: "เมื่อใช้ตัวละครต่อเนื่อง แนะนำเปิด Voice Lock เพื่อไม่ให้บุคลิกเสียงเปลี่ยนโดยไม่ตั้งใจ",
    },
  };
});

type VisualAsset = { id: string; kind: string; title: string; assetUrl?: string | null } & Record<string, unknown>;

function addVisualFallback<T extends VisualAsset>(item: T): T {
  if (item.kind !== "characters" || item.assetUrl) return item;
  const assetUrl = `/api/character-avatar?name=${encodeURIComponent(item.title)}&seed=${encodeURIComponent(item.id)}`;
  return { ...item, assetUrl };
}

function mergeUnique<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function GET() {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) return noStore(NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }));

  try {
    const items = await listLibraryAssets();
    let disabledSystemIds: string[] = [];
    let canMergeBuiltIns = true;
    try {
      disabledSystemIds = await disabledSystemAssetIds();
    } catch (error) {
      canMergeBuiltIns = false;
      console.error("LIBRARY_DISABLED_IDS_FAILED", error);
    }

    const existingIds = new Set(items.map((item) => item.id));
    const disabledIds = new Set(disabledSystemIds);
    const builtInFallback = canMergeBuiltIns
      ? SYSTEM_ASSETS.filter((item) => !existingIds.has(item.id) && !disabledIds.has(item.id))
      : [];
    const combined = [...items, ...builtInFallback];
    const combinedIds = new Set(combined.map((item) => item.id));
    const voiceFallback = canMergeBuiltIns
      ? SYSTEM_VOICES.filter((item) => !combinedIds.has(item.id) && !disabledIds.has(item.id))
      : [];

    return noStore(NextResponse.json({
      items: [...combined, ...voiceFallback].map((item) => addVisualFallback(item as VisualAsset)),
      disabledSystemIds,
      degraded: false,
    }));
  } catch (error) {
    console.error("LIBRARY_GET_FAILED", error);
    const fallback = mergeUnique([...SYSTEM_ASSETS, ...SYSTEM_VOICES] as Array<(typeof SYSTEM_ASSETS)[number] | (typeof SYSTEM_VOICES)[number]>);
    return noStore(NextResponse.json({
      items: fallback.map((item) => addVisualFallback(item as VisualAsset)),
      disabledSystemIds: [],
      degraded: true,
      warning: "เชื่อมต่อคลังข้อมูลชั่วคราวไม่ได้ จึงแสดง SCENOVA System Library จากชุดสำรอง",
    }));
  }
}
