import { describe, expect, it } from "vitest";
import { createNextEpisode, createTimelineSegments, resizeEpisode, validateTimeline } from "@/lib/episode-engine";
import { exportProductionPrompt } from "@/lib/prompt-engine";
import { planEpisodeRender } from "@/lib/render-planner";
import { SAMPLE_PROJECT } from "@/lib/sample-project";

function cloneProject() {
  return JSON.parse(JSON.stringify(SAMPLE_PROJECT));
}

describe("SCENOVA core", () => {
  it("builds a valid 30-second timeline", () => {
    const segments = createTimelineSegments(30, 10);
    expect(segments).toHaveLength(3);
    const episode = { ...SAMPLE_PROJECT.episodes[0], duration: 30 as const, segments };
    expect(validateTimeline(episode)).toEqual({ valid: true, errors: [] });
  });

  it("resizes an episode timeline to 3 minutes", () => {
    const resized = resizeEpisode(SAMPLE_PROJECT.episodes[0], 180);
    expect(resized.duration).toBe(180);
    expect(resized.segments[0].start).toBe(0);
    expect(resized.segments.at(-1)?.end).toBe(180);
    expect(validateTimeline(resized).valid).toBe(true);
  });

  it("creates the next episode without generating video", () => {
    const project = cloneProject();
    const next = createNextEpisode(project);
    expect(next.number).toBe(2);
    expect(next.status).toBe("draft");
    expect(next.segments.length).toBeGreaterThan(0);
  });

  it("exports a production prompt with locks and shots", () => {
    const prompt = exportProductionPrompt(SAMPLE_PROJECT, SAMPLE_PROJECT.episodes[0]);
    expect(prompt).toContain("MASTER VISUAL STYLE LOCK");
    expect(prompt).toContain("CHARACTER LOCK");
    expect(prompt).toContain("GLOBAL CAMERA STYLE LOCK");
    expect(prompt).toContain("GLOBAL NEGATIVE PROMPT");
  });

  it("splits long Seedance segments according to model limits", () => {
    const project = cloneProject();
    const episode = resizeEpisode(project.episodes[0], 180);
    project.episodes = [episode];
    project.mainModelId = "seedance-2-5";
    project.modelMode = "single";
    const jobs = planEpisodeRender(project, episode);
    expect(jobs.length).toBeGreaterThanOrEqual(6);
    expect(jobs.every((job) => job.duration <= 30)).toBe(true);
  });
});
