import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const studio = readFileSync("components/single-episode-studio.tsx", "utf8");
const page = readFileSync("app/studio/page.tsx", "utf8");
const shell = readFileSync("components/app-shell.tsx", "utf8");
const draftTray = readFileSync("components/workspace-draft-tray.tsx", "utf8");
const directBridge = readFileSync("components/studio-direct-render-bridge.tsx", "utf8");
const railCss = readFileSync("components/single-episode-summary-rail.module.css", "utf8");
const studioCss = readFileSync("components/single-episode-studio.module.css", "utf8");
const setupCss = readFileSync("components/single-episode-setup-compact.module.css", "utf8");

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
