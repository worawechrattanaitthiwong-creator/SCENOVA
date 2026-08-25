import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: "reachable" }, { status: 200 });
  } catch (error) {
    console.error("SCENOVA_DB_HEALTH_FAILED", error);
    return NextResponse.json({ ok: false, database: "unreachable" }, { status: 503 });
  }
}
