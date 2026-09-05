import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const studio = readFileSync("components/single-episode-studio.tsx", "utf8");
const page = readFileSync("app/studio/page.tsx", "utf8");
const shell = readFileSync("components/app-shell.tsx", "utf8");
const draftTray = readFileSync("components/workspace-draft-tray.tsx", "utf8");
const directBridge = readFileSync("components/studio-direct-render-bridge.tsx", "utf8");
const studioProject = readFileSync("lib/agent/studio-project.ts", "utf8");
const railCss = readFileSync("components/single-episode-summary-rail.module.css", "utf8");
const studioCss = readFileSync("components/single-episode-studio.module.css", "utf8");
const setupCss = readFileSync("components/single-episode-setup-compact.module.css", "utf8");
const modelPicker = readFileSync("components/studio-model-picker-polish.tsx", "utf8");
const studioPolish = readFileSync("components/single-episode-studio-polish.tsx", "utf8");

describe("AI Studio pre-rebuild UI regression guard", () => {
  it("restores the original Single Episode workspace structure", () => {
    expect(studio).toContain("กำหนดภาพรวมของตอนเดียว");
    expect(studio).toContain("กำหนดตัวตนก่อนกำกับกล้อง");
    expect(studio).toContain("กำกับทีละฉาก พร้อมกล้องเต็มชุด");
    expect(studio).toContain("ความพร้อมของตอนนี้");
    expect(studio).not.toContain("StudioStylePreviewGallery");

    expect(studio).not.toContain("ไอเดีย & ตั้งค่าพื้นฐาน");
    expect(studio).not.toContain("สร้างฉาก มุมกล้อง การเคลื่อนไหว บทพูด และอารมณ์");
  });

  it("restores the original helper layers including per-model icons", () => {
    expect(page).toContain("SingleEpisodeStudioPolish");
    expect(page).toContain("StudioModelPickerPolish");
    expect(page).toContain("SingleEpisodeAiAuto");
  });

  it("restores the original Studio shell and draft tray behavior", () => {
    expect(shell).not.toContain('const studioShell = pathname === "/studio"');
    expect(draftTray).toContain("if (!authenticated) return null;");
    expect(draftTray).not.toContain('!authenticated || pathname === "/studio"');
  });

  it("keeps only the requested preview and settings summary section from the rebuild", () => {
    expect(studio).toContain("ตัวอย่างภาพจากฉากแรก");
    expect(studio).toContain("สรุปการตั้งค่า");
    expect(studio).toContain("สร้างภาพตัวอย่างก่อน");
    expect(studio).toContain("หากเกิดข้อผิดพลาด เครดิตจะคืนให้อัตโนมัติ");
    expect(studio).toContain('id="studio-kept-preview-summary"');
    expect(studio).toContain("workspaceGrid");
    expect(studio).toContain("primaryColumn");
    expect(studio).toContain("STYLE_PREVIEW_IMAGE");
    expect(studio).toContain("rightPreviewImage");
    expect(studio).not.toContain("<StudioStylePreviewGallery");
    expect(studio.split("className={rail.previewImage}").length - 1).toBe(1);
    expect(studioCss).toContain("grid-template-columns:minmax(0,1fr) 360px");
    expect(railCss).toContain("position: sticky");
    expect(directBridge).toContain('review.insertAdjacentElement("afterend", node)');
  });

  it("keeps the setup card compact and orderly without changing its controls", () => {
    expect(studio).toContain("setupCard.panel");
    expect(studio).toContain("setupCard.grid");
    expect(studio).toContain("setupCard.storyField");
    expect(studio).toContain("setupCard.timing");
    expect(studio).toContain("setupCard.locks");
    expect(setupCss).toContain("grid-template-columns: repeat(12, minmax(0, 1fr))");
    expect(setupCss).toContain("grid-column: 1 / 9");
    expect(setupCss).toContain("grid-template-columns: repeat(7, minmax(0, 1fr))");
    expect(setupCss).toContain("grid-column: 9 / 13");
    expect(setupCss).toContain("height: 112px");
    expect(setupCss).toContain("min-height: 112px");
    expect(setupCss).toContain("min-height: 44px");
  });

  it("keeps all five top setup controls on the same baseline and height", () => {
    expect(setupCss).toContain("height: 44px !important");
    expect(setupCss).toContain("min-height: 14px !important");
    expect(setupCss).toContain("line-height: 14px !important");
    expect(modelPicker).toContain("min-height:14px");
    expect(modelPicker).toContain("height:44px;min-height:44px");
    expect(studioPolish).toContain("height:44px;min-height:44px");
    expect(studioPolish).toContain("width:34px;height:30px");
  });

  it("separates every model family from its version list", () => {
    for (const family of ["Runway", "Seedance", "Gemini", "Aleph", "Ruby", "Kling", "Veo", "Wan"]) {
      expect(studio).toContain(`value: "${family}", label: "${family}"`);
    }
    expect(studio).not.toContain('label: "Runway Gen-4.5"');
    expect(studio).not.toContain('label: "Seedance 2.5"');
    expect(studio).not.toContain('label: "Gemini Omni Flash 1.1"');
    expect(studio).toContain('if (model === "Runway") return clean.replace(/^Runway\\s+/i, "").replace(/^Gen-/i, "Gen ");');
    expect(studio).toContain('if (model === "Seedance") return clean.replace(/^Seedance\\s+/i, "");');
    expect(studio).toContain('if (model === "Gemini") return clean.replace(/^Gemini\\s+/i, "");');
    expect(studio).toContain('if (model === "Aleph") return clean.replace(/^Aleph\\s+/i, "");');
    expect(studio).toContain('if (model === "Ruby") return clean.replace(/^Ruby\\s+/i, "");');
    expect(studio).toContain('if (model === "Kling") return clean.replace(/^Kling\\s+/i, "");');
    expect(studio).toContain('if (model === "Veo") return clean.replace(/^Veo\\s+/i, "");');
    expect(studio).toContain('if (model === "Wan") return clean.replace(/^Wan\\s+/i, "");');

    for (const runwayFamily of ["Runway", "Seedance", "Gemini", "Aleph", "Ruby"]) {
      expect(directBridge).toContain(`${runwayFamily}: { providerId: "runway"`);
      expect(studioProject).toContain(`${runwayFamily}: "runway"`);
    }
    expect(directBridge).toContain('Kling: { providerId: "kling"');
    expect(directBridge).toContain('Veo: { providerId: "veo"');
    expect(directBridge).toContain('Wan: { providerId: "wan"');
    expect(studioProject).toContain('Kling: "kling"');
    expect(studioProject).toContain('Veo: "veo"');
    expect(studioProject).toContain('Wan: "wan"');
  });

  it("keeps the original behavioral defaults and controls", () => {
    expect(studio).toContain('const [model, setModel] = useState("")');
    expect(studio).toContain('const [aspect, setAspect] = useState("9:16 — Vertical")');
    expect(studio).toContain('const [visualStyle, setVisualStyle] = useState("")');
    expect(studio).toContain("const [totalDuration, setTotalDuration] = useState(30)");
    expect(studio).toContain("distributeScenes([], 3, 30)");
    expect(studio).toContain("มีสัตว์หรือสิ่งมีชีวิตในตอนนี้หรือไม่?");
    expect(studio).toContain("คัดลอกกล้องไปทุกฉาก");
    expect(studio).toContain("คัดลอกแสงไปทุกฉาก");
    expect(studio).toContain("ส่ง Storyboard ให้ทีม AI");
  });
});
