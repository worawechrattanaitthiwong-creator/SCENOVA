import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const studio = readFileSync("components/single-episode-studio.tsx", "utf8");
const directBridge = readFileSync("components/studio-direct-render-bridge.tsx", "utf8");
const directInstant = readFileSync("components/studio-direct-render-instant.tsx", "utf8");
const agentBridge = readFileSync("components/agent-plan-studio-bridge.tsx", "utf8");
const modelIcon = readFileSync("components/model-brand-icon.tsx", "utf8");
const modelSelect = readFileSync("components/studio-model-select.tsx", "utf8");

function occurrences(source: string, token: string) {
  return source.split(token).length - 1;
}

describe("AI Studio UI integrity", () => {
  it("keeps the original Single Episode behavioral defaults", () => {
    expect(studio).toContain('useState("")');
    expect(studio).toContain("const [totalDuration, setTotalDuration] = useState(30)");
    expect(studio).toContain("distributeScenes([], 3, 30)");
    expect(studio).not.toContain('const [model, setModel] = useState("runway:seedance2_5")');
  });

  it("keeps every production workflow reachable from the rebuilt UI", () => {
    for (const handler of [
      "resizeAnimals",
      "patchAnimal",
      "patchCharacterDirection",
      "toggleSceneAnimal",
      "copyCameraToAll",
      "copyLookToAll",
      "sendToAgent",
    ]) {
      expect(occurrences(studio, handler), handler).toBeGreaterThan(1);
    }

    for (const state of [
      "objective",
      "beat",
      "transition",
      "cameraSubjectId",
      "ambienceLevel",
      "sfxLevel",
      "dialogueLevel",
      "musicLevel",
    ]) expect(studio).toContain(state);

    expect(studio).toContain("วงเงินสูงสุดของ Agent");
    expect(studio).toContain("ส่ง Storyboard ให้ทีม AI");
    expect(studio).toContain("มีสัตว์หรือสิ่งมีชีวิตในตอนนี้หรือไม่?");
  });

  it("keeps stable DOM contracts required by Agent and Direct Render bridges", () => {
    expect(studio).toContain('aria-label="โมเดลวิดีโอ"');
    expect(studio).toContain('aria-label="รุ่นโมเดล"');
    expect(studio).toContain('data-studio-character-card="true"');
    expect(studio).toContain('data-studio-character-presence="true"');
    expect(studio).toContain('data-studio-dialogue-card="true"');
    expect(studio).toContain("data-studio-model-ready");
    expect(studio).toContain('label="จำนวนตัวละคร"');
    expect(studio).toContain('label="จำนวนฉาก"');
    expect(studio).toContain("scenova-direct-render-host");

    expect(directBridge).toContain('data-studio-character-card="true"');
    expect(directBridge).toContain('data-studio-character-presence="true"');
    expect(directBridge).toContain('data-studio-dialogue-card="true"');
    expect(directBridge).toContain('data-studio-model-ready="true"');
    expect(directBridge).not.toContain("suppressLegacyAgentSubmit()");
    expect(directBridge).toContain("snapshot && !stale");
    expect(directBridge).toContain("setSnapshot(null)");
    expect(studio).toContain('new CustomEvent("scenova-studio-data-change")');
    expect(directBridge).toContain('"scenova-studio-data-change"');
    expect(directInstant).toContain('"scenova-studio-data-change"');
    expect(agentBridge).toContain('data-studio-character-card="true"');
    expect(agentBridge).toContain('data-studio-character-presence="true"');
    expect(agentBridge).toContain('data-studio-dialogue-card="true"');
  });

  it("restores a visible icon for every selectable video model family", () => {
    for (const family of ["runway", "seedance", "gemini", "aleph", "ruby", "kling", "veo", "wan"]) {
      expect(modelIcon.toLocaleLowerCase()).toContain(family);
    }
    expect(studio).toContain("StudioModelSelect");
    expect(studio).toContain("ModelBrandIcon");
    expect(modelSelect).toContain("ModelBrandIcon");
    expect(modelSelect).toContain("รูปอ้างอิงพร้อม");
    expect(modelSelect).toContain("Native Audio");
  });

  it("preserves readiness, API and provider status messaging", () => {
    expect(studio).toContain("/api/api-connections");
    expect(studio).toContain("🟢 คีย์เชื่อมต่อแล้ว");
    expect(studio).toContain("🟠 ยังไม่ได้เชื่อมต่อ / Connection ไม่พร้อม");
    expect(studio).toContain("🔴 Adapter ยังไม่พร้อม");
    expect(studio).toContain("selectedConnectionState?.operationalReady");
  });
});
