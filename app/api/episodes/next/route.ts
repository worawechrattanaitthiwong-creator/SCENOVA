import { NextResponse } from "next/server";
import type { Project } from "@/lib/domain";
import { createNextEpisode } from "@/lib/episode-engine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { project: Project };
    if (!body.project) return NextResponse.json({ error: "project is required" }, { status: 400 });
    const episode = createNextEpisode(body.project);
    return NextResponse.json({ episode, note: "Episode draft only — no video generation is triggered automatically" });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถสร้างตอนถัดไปได้" }, { status: 500 });
  }
}
