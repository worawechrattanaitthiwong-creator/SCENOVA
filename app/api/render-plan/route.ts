import { NextResponse } from "next/server";
import type { Project } from "@/lib/domain";
import { planEpisodeRender } from "@/lib/render-planner";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { project: Project; episodeIndex?: number };
    const project = body.project;
    const episode = project?.episodes?.[body.episodeIndex ?? 0];

    if (!project || !episode) {
      return NextResponse.json({ error: "ต้องมี project และ episode ที่ถูกต้อง" }, { status: 400 });
    }

    const jobs = planEpisodeRender(project, episode);
    return NextResponse.json({ jobs, totalJobs: jobs.length, totalSeconds: episode.duration });
  } catch {
    return NextResponse.json({ error: "ไม่สามารถวางแผน Render ได้" }, { status: 500 });
  }
}
