import { NextResponse } from "next/server";
import { libraryStore } from "@/lib/library-store";

export async function GET() {
  return NextResponse.json({ items: libraryStore });
}
