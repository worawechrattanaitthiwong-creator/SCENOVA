import { NextResponse } from "next/server";
import type { Project } from "@/lib/domain";
import { buildPromptBundle } from "@/lib/prompt-engine";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { project: Project; episodeIndex?: number };
    const project = body.project;
    const episode = project?.episodes?.[body.episodeIndex ?? 0];

    if (!project || !episode) {
      return NextResponse.json({ error: "ต้องมี project และ episode ที่ถูกต้อง" }, { status: 400 });
    }

    const bundle = buildPromptBundle(project, episode);
    return NextResponse.json({ bundle, promptMode: project.promptMode, aiAssistant: "mock-not-connected" });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถประกอบ Prompt ได้" }, { status: 500 });
  }
}
