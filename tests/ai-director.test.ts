import { describe, expect, it } from "vitest";
import { buildAiDirectorPlan, type AiDirectorRequest, type AiDirectorScene } from "@/lib/ai-director";
import type { ProductionAnalysis } from "@/lib/analyzer/schema";

const analysis: ProductionAnalysis = {
  intent: "build tension and reveal information",
  summaryTh: "ตัวละครสองคนคุยกันอย่างระแวงก่อนเปิดเผยข้อมูลสำคัญ",
  sourceLanguage: "th",
  scene: {
    description: "ในโกดังมืด ตัวละคร 1 ก้าวเข้าใกล้โต๊ะ ขณะที่ตัวละคร 2 ซ่อนความกังวลและตอบคำถาม",
    location: "โกดังร้าง",
    timeOfDay: "night",
    weather: null,
  },
  characters: [
    { name: "ตัวละคร 1", action: "ก้าวเข้าหาโต๊ะ", emotion: "Suspicious", dialogue: "คุณรู้เรื่องนี้มานานแค่ไหน" },
    { name: "ตัวละคร 2", action: "ชะงักก่อนตอบ", emotion: "Nervous", dialogue: "นานพอที่จะรู้ว่าเราไม่ควรอยู่ที่นี่" },
  ],
  camera: {
    shotType: "Medium",
    angle: "Eye Level",
    lensMm: 50,
    cameraHeight: "Eye",
    movement: "Push-in",
    composition: "Rule of Thirds",
    depthOfField: "Natural",
  },
  lighting: { style: "Natural Soft", mood: "cool tense night" },
  audio: { ambience: "Room Tone", music: "None", soundEffects: ["Footsteps"] },
  generation: { durationSec: 8, aspectRatio: "16:9", negativePrompt: ["identity drift"] },
  locks: { respectCharacterLock: true, respectStyleLock: true, respectVoiceLock: true, respectLocationLock: false },
};

function scene(): AiDirectorScene {
  return {
    id: "scene_1",
    title: "ฉาก 1",
    duration: 7,
    location: "โกดังร้าง",
    objective: "Reveal Information",
    beat: "Turn",
    transition: "Hard Cut",
    action: "ตัวละครสองคนเผชิญหน้ากัน",
    dialogue: "",
    characterIds: ["c1", "c2"],
    animalIds: [],
    characterDirections: {},
    cameraSubjectId: "c1",
    shot: "Medium",
    angle: "Eye Level",
    lens: "50mm",
    movement: "Static",
    height: "Eye",
    cameraSpeed: "Normal",
    focus: "Auto Subject",
    dof: "Natural",
    composition: "Rule of Thirds",
    lighting: "Natural Soft",
    colorTemp: "Neutral 4500K",
    emotion: "Natural",
    performance: "Natural",
    ambience: "Room Tone",
    secondaryAmbience: "Silence",
    sfx: "None",
    sfxTimeline: "",
    music: "None",
    ambienceLevel: 55,
    sfxLevel: 80,
    dialogueLevel: 100,
    musicLevel: 35,
    continuityNote: "รักษาตัวละครและสถานที่",
    negativePrompt: "identity drift",
  };
}

function request(seed = 1001): AiDirectorRequest {
  const currentScene = scene();
  return {
    mode: "production",
    novelty: "balanced",
    scope: "all",
    fillMode: "replace-scope",
    seed,
    episodeTitle: "คืนในโกดัง",
    story: "สองคนพบกันในโกดังร้าง คนหนึ่งระแวงว่าอีกคนกำลังปิดบังความลับ",
    model: "Veo",
    modelVersion: "veo-3.1-lite",
    aspect: "16:9 — Widescreen",
    visualStyle: "Photorealistic Film — สมจริงแบบภาพยนตร์",
    locks: ["Character", "Voice", "Visual Style", "Camera Language"],
    totalDuration: 30,
    sceneIndex: 1,
    sceneCount: 4,
    currentScene,
    previousScene: { ...currentScene, id: "scene_0", lens: "50mm", movement: "Static" },
    nextScene: { ...currentScene, id: "scene_2" },
    cast: [
      { id: "c1", name: "ตัวละคร 1", role: "ตัวละครหลัก" },
      { id: "c2", name: "ตัวละคร 2", role: "ตัวละครรอง" },
    ],
    manualSections: { blocking: false, camera: false, look: false, sound: false, continuity: false },
    history: [],
    analysis,
  };
}

describe("production AI Director", () => {
  it("returns a coherent production plan with real model duration handling", () => {
    const result = buildAiDirectorPlan(request());
    expect(result.meta.scores.total).toBeGreaterThan(0.6);
    expect(result.meta.capability.timelineDurationSec).toBe(7);
    expect(result.meta.capability.renderDurationSec).toBe(8);
    expect(result.meta.capability.trimSec).toBe(1);
    expect(result.meta.capability.durationSupported).toBe(true);
    expect(result.scene.shot).not.toBe("AI");
    expect(result.scene.lens).not.toBe("AI");
    expect(result.scene.movement).not.toBe("AI");
  });

  it("never overwrites sections explicitly switched to Manual", () => {
    const input = request(2002);
    input.manualSections = { blocking: true, camera: true, look: true, sound: true, continuity: true };
    const result = buildAiDirectorPlan(input);
    expect(result.scene.shot).toBeUndefined();
    expect(result.scene.lighting).toBeUndefined();
    expect(result.scene.ambience).toBeUndefined();
    expect(result.scene.continuityNote).toBeUndefined();
    expect(result.scene.characterDirections).toBeUndefined();
    expect(result.meta.frozenSections).toContain("Camera");
  });

  it("penalizes recent combinations and avoids an exact recent fingerprint when alternatives exist", () => {
    const first = buildAiDirectorPlan(request(3003));
    const secondInput = request(4004);
    secondInput.novelty = "different";
    secondInput.history = [first.meta.historyEntry];
    const second = buildAiDirectorPlan(secondInput);
    expect(second.meta.fingerprint).not.toBe(first.meta.fingerprint);
    expect(second.meta.scores.novelty).toBeGreaterThan(0);
    expect(second.meta.alternatives.length).toBeGreaterThan(0);
  });

  it("fills only empty fields for the whole-scene helper and preserves user choices", () => {
    const input = request(6006);
    input.fillMode = "empty-only";
    input.currentScene.location = "โกดังที่ผู้ใช้เลือก";
    input.currentScene.objective = "Reveal Information";
    input.currentScene.beat = "Turn";
    input.currentScene.transition = "Hard Cut";
    input.currentScene.shot = "Medium";
    input.currentScene.angle = "";
    input.currentScene.lens = "50mm";
    input.currentScene.movement = "";
    input.currentScene.lighting = "Natural Soft";
    input.currentScene.characterIds = ["c1", "c2"];
    input.currentScene.characterDirections = {
      c1: {
        blocking: "ซ้ายเฟรมหลังโต๊ะ",
        action: "",
        emotion: "",
        eyeline: "",
        dialogue: "ประโยคที่ผู้ใช้เขียนไว้",
      },
    };

    const result = buildAiDirectorPlan(input);

    expect(result.scene.location).toBeUndefined();
    expect(result.scene.objective).toBeUndefined();
    expect(result.scene.beat).toBeUndefined();
    expect(result.scene.transition).toBeUndefined();
    expect(result.scene.shot).toBeUndefined();
    expect(result.scene.lens).toBeUndefined();
    expect(result.scene.lighting).toBeUndefined();
    expect(result.scene.characterIds).toBeUndefined();

    expect(result.scene.angle).toBeTruthy();
    expect(result.scene.movement).toBeTruthy();
    expect(result.scene.characterDirections?.c1.blocking).toBe("ซ้ายเฟรมหลังโต๊ะ");
    expect(result.scene.characterDirections?.c1.dialogue).toBe("ประโยคที่ผู้ใช้เขียนไว้");
    expect(result.scene.characterDirections?.c1.action).toBeTruthy();
    expect(result.meta.frozenSections).toContain("ค่าที่ผู้ใช้กรอก/เลือกไว้แล้ว");
    expect(result.meta.rationaleTh).toContain("เชื่อมเหตุและผลกับฉากข้างเคียง");
  });

  it("can plan a scene before video model and aspect are selected", () => {
    const input = request(7007);
    input.model = "";
    input.modelVersion = "";
    input.aspect = "";
    input.fillMode = "empty-only";
    input.currentScene.angle = "";
    input.currentScene.movement = "";

    const result = buildAiDirectorPlan(input);

    expect(result.meta.capability.model).toBe("AI Planning");
    expect(result.meta.capability.durationSupported).toBe(true);
    expect(result.meta.capability.aspectSupported).toBe(true);
    expect(result.scene.angle).toBeTruthy();
    expect(result.scene.movement).toBeTruthy();
  });

  it("keeps locked lighting unchanged", () => {
    const input = request(5005);
    input.locks = [...input.locks, "Lighting"];
    input.currentScene.lighting = "Natural Soft";
    input.currentScene.colorTemp = "Neutral 4500K";
    const result = buildAiDirectorPlan(input);
    expect(result.scene.lighting).toBeUndefined();
    expect(result.scene.colorTemp).toBeUndefined();
    expect(result.meta.frozenSections).toContain("Lighting Lock");
  });
});
