import { NextResponse } from "next/server";
import type { Project } from "@/lib/domain";
import { planGeneration } from "@/lib/orchestrator";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { project: Project; episodeIndex?: number };
    if (!body.project) return NextResponse.json({ error: "Project is required" }, { status: 400 });
    const plan = await planGeneration(body.project, body.episodeIndex ?? 0);
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
