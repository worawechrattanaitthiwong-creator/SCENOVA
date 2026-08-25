import { NextResponse } from "next/server";
import { disabledSystemAssetIds, listLibraryAssets } from "@/lib/library-repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [items, disabledSystemIds] = await Promise.all([listLibraryAssets(), disabledSystemAssetIds()]);
    return NextResponse.json({ items, disabledSystemIds });
  } catch (error) {
    console.error("LIBRARY_GET_FAILED", error);
    return NextResponse.json({ error: "LIBRARY_UNAVAILABLE" }, { status: 500 });
  }
}
