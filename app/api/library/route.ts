import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveSession } from "@/lib/auth-core";
import { disabledSystemAssetIds, listLibraryAssets, SYSTEM_ASSETS } from "@/lib/library-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
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

    return noStore(NextResponse.json({
      items: [...items, ...builtInFallback],
      disabledSystemIds,
      degraded: false,
    }));
  } catch (error) {
    console.error("LIBRARY_GET_FAILED", error);
    return noStore(NextResponse.json({
      items: SYSTEM_ASSETS,
      disabledSystemIds: [],
      degraded: true,
      warning: "เชื่อมต่อคลังข้อมูลชั่วคราวไม่ได้ จึงแสดง SCENOVA System Library จากชุดสำรอง",
    }));
  }
}
