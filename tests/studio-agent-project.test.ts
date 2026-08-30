import { describe, expect, it } from "vitest";
import { buildStudioAgentProject, type StudioAgentDraft } from "@/lib/agent/studio-project";

const draft: StudioAgentDraft = {
  episodeTitle: "เมืองเงา",
  model: "Veo",
  aspect: "9:16 — Vertical",
  visualStyle: "Dark Thriller — ทริลเลอร์โทนมืด",
  story: "นักสืบตามหาความจริงในเมืองที่ไม่มีใครยอมพูดถึงอดีต",
  globalNegative: "no watermark",
  locks: ["Character", "Voice", "Visual Style", "Camera Language"],
  characters: [{ id: "char-1", name: "มีนา", role: "ตัวละครหลัก", appearance: "เสื้อโค้ตสีดำ", voice: "Warm", identityLock: true, voiceLock: true }],
  hasAnimals: false,
  animals: [],
  totalDuration: 12,
  scenes: [
    {
      id: "scene-1", title: "ทางเข้าเมือง", duration: 5, location: "ประตูเมือง", action: "มีนาเดินเข้าสู่เมือง", dialogue: "มีนา: ที่นี่เงียบเกินไป", characterIds: ["char-1"], cameraSubjectId: "char-1", shot: "Wide", angle: "Eye Level", lens: "35mm", movement: "Tracking", height: "Eye", cameraSpeed: "Slow", focus: "Auto Subject", dof: "Natural", composition: "Rule of Thirds", lighting: "Moonlight", colorTemp: "Cool", emotion: "Suspicious", performance: "Natural", ambience: "Night", secondaryAmbience: "Wind", sfx: "Footsteps", sfxTimeline: "00:02 footsteps", music: "Tension", continuityNote: "เสื้อโค้ตสีดำ", negativePrompt: "no costume change",
    },
    {
      id: "scene-2", title: "ตรอกมืด", duration: 7, location: "ตรอก", action: "เงาปริศนาปรากฏ", dialogue: "", characterIds: ["char-1"], cameraSubjectId: "char-1", shot: "Medium", angle: "Low Angle", lens: "50mm", movement: "Push-in", height: "Low", cameraSpeed: "Slow", focus: "Face", dof: "Shallow", composition: "Center", lighting: "Low Key", colorTemp: "Cool", emotion: "Fear", performance: "Restrained", ambience: "Night", secondaryAmbience: "Silence", sfx: "Impact", sfxTimeline: "", music: "Tension", continuityNote: "ต่อจากประตูเมือง", negativePrompt: "",
    },
  ],
};

describe("Studio to Agent project adapter", () => {
  it("preserves storyboard timing, model, locks, and cast", () => {
    const project = buildStudioAgentProject(draft, "test");

    expect(project.id).toBe("studio-project-test");
    expect(project.mainModelId).toBe("veo");
    expect(project.aspectRatio).toBe("9:16");
    expect(project.characters[0].name).toBe("มีนา");
    expect(project.locks.character).toBe(true);
    expect(project.episodes[0].segments.map((segment) => [segment.start, segment.end])).toEqual([[0, 5], [5, 12]]);
    expect(project.episodes[0].segments[0].cameraShots[0].lensMm).toBe(35);
    expect(project.episodes[0].segments[0].dialogue[0].text).toContain("ที่นี่เงียบเกินไป");
  });
});
