import { describe, expect, it } from "vitest";
import { CINEMATIC_COVERAGE_PRESETS } from "@/lib/cinematic-coverage-presets";
import { planDirectRenderWindows } from "@/lib/direct-render";
import { exportProductionPrompt } from "@/lib/prompt-engine";
import { SAMPLE_PROJECT } from "@/lib/sample-project";

function cloneProject() {
  return JSON.parse(JSON.stringify(SAMPLE_PROJECT)) as typeof SAMPLE_PROJECT;
}

describe("cinematic coverage", () => {
  it("ships 30 selectable coverage ideas with unique ids", () => {
    expect(CINEMATIC_COVERAGE_PRESETS).toHaveLength(30);
    expect(new Set(CINEMATIC_COVERAGE_PRESETS.map((preset) => preset.id)).size).toBe(30);
    expect(CINEMATIC_COVERAGE_PRESETS.some((preset) => preset.id === "creature-encounter")).toBe(true);
    expect(CINEMATIC_COVERAGE_PRESETS.some((preset) => preset.id === "shot-reverse-shot")).toBe(true);
  });

  it("uses editorial camera-shot boundaries for providers without native multi-shot", () => {
    const project = cloneProject();
    const scene = project.episodes[0]!.segments[0]!;
    const duration = scene.end - scene.start;
    const third = duration / 3;
    scene.cameraShots = [0, 1, 2].map((index) => ({
      ...scene.cameraShots[0]!,
      id: `coverage-${index + 1}`,
      start: scene.start + (third * index),
      end: index === 2 ? scene.end : scene.start + (third * (index + 1)),
      cameraSlot: index === 1 ? "CAM_B_REACTION" : "CAM_A_HERO",
      coverageRole: index === 1 ? "Reaction" : "Hero coverage",
    }));

    const windows = planDirectRenderWindows(project, 8, { supportsMultiShot: false });
    expect(windows.length).toBeGreaterThan(project.episodes[0]!.segments.length);
    expect(windows.every((window) => window.duration <= 8)).toBe(true);
    expect(windows[0]!.start).toBeCloseTo(scene.start, 3);
    expect(windows[0]!.end).toBeCloseTo(scene.start + third, 3);
  });

  it("exports reusable camera-slot and eyeline continuity into production prompts", () => {
    const project = cloneProject();
    const scene = project.episodes[0]!.segments[0]!;
    scene.cameraShots[0] = {
      ...scene.cameraShots[0]!,
      cameraSlot: "CAM_A_HERO_CU",
      coverageRole: "Reaction close-up",
      subject: "Hero",
      screenDirection: "Hero looks screen-left",
      eyelineTarget: "Creature on screen-left",
      transitionOut: "Cut on Action",
      continuityAnchor: "Return to identical hero close-up setup",
    };
    const prompt = exportProductionPrompt(project, project.episodes[0]!);
    expect(prompt).toContain("Camera slot: CAM_A_HERO_CU");
    expect(prompt).toContain("Eyeline target: Creature on screen-left");
    expect(prompt).toContain("CINEMATIC COVERAGE CONTINUITY");
  });
});
