import { NextResponse } from "next/server";
import type { Project } from "@/lib/domain";
import { ensureDevelopmentSeed, studioRepository } from "@/lib/repository-instance";

const DEMO_USER = "demo-user";

export async function GET() {
  await ensureDevelopmentSeed(DEMO_USER);
  const projects = await studioRepository.listProjects(DEMO_USER);
  return NextResponse.json({ projects, persistence: "in-memory-development" });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { project?: Project };
  if (!body.project) return NextResponse.json({ error: "project is required" }, { status: 400 });
  const saved = await studioRepository.saveProject(DEMO_USER, body.project);
  return NextResponse.json({ project: saved, persistence: "in-memory-development" });
}
