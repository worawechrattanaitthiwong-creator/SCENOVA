import { NextResponse } from "next/server";
import type { Project } from "@/lib/domain";
import { buildPromptBundle } from "@/lib/prompt-engine";
import { planEpisodeRender } from "@/lib/render-planner";
import { MockVideoProvider } from "@/lib/providers/mock-video-provider";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { project: Project; episodeIndex?: number };
    const project = body.project;
    const episode = project?.episodes?.[body.episodeIndex ?? 0];
    if (!project || !episode) return NextResponse.json({ error: "Project/Episode ไม่ถูกต้อง" }, { status: 400 });

    const plan = planEpisodeRender(project, episode);
    const prompt = buildPromptBundle(project, episode);
    const provider = new MockVideoProvider();
    const tasks = [];

    for (const renderSegment of plan) {
      const requestPayload = {
        projectId: project.id,
        episodeId: episode.id,
        renderSegment,
        prompt,
        resolution: project.resolution,
        imageReferences: [],
        videoReferences: [],
        audioReferences: [],
        idempotencyKey: `${project.id}:${episode.id}:${renderSegment.order}`,
      } as const;
      const estimate = await provider.estimateCost(requestPayload);
      const task = await provider.generate(requestPayload);
      tasks.push({ ...task, estimate, renderSegment });
    }

    return NextResponse.json({ provider: provider.id, tasks, note: "Mock only — ยังไม่เรียก Video API จริงและยังไม่หักเครดิต" });
  } catch {
    return NextResponse.json({ error: "Mock generation failed" }, { status: 500 });
  }
}
