import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const studio = readFileSync("components/single-episode-studio.tsx", "utf8");
const page = readFileSync("app/studio/page.tsx", "utf8");
const shell = readFileSync("components/app-shell.tsx", "utf8");
const draftTray = readFileSync("components/workspace-draft-tray.tsx", "utf8");

describe("AI Studio pre-rebuild UI regression guard", () => {
  it("restores the original Single Episode workspace structure", () => {
    expect(studio).toContain("กำหนดภาพรวมของตอนเดียว");
    expect(studio).toContain("กำหนดตัวตนก่อนกำกับกล้อง");
    expect(studio).toContain("กำกับทีละฉาก พร้อมกล้องเต็มชุด");
    expect(studio).toContain("ความพร้อมของตอนนี้");
    expect(studio).toContain("StudioStylePreviewGallery");

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
  });

  it("keeps the original behavioral defaults and controls", () => {
    expect(studio).toContain('const [model, setModel] = useState("")');
    expect(studio).toContain('const [aspect, setAspect] = useState("")');
    expect(studio).toContain('const [visualStyle, setVisualStyle] = useState("")');
    expect(studio).toContain("const [totalDuration, setTotalDuration] = useState(30)");
    expect(studio).toContain("distributeScenes([], 3, 30)");
    expect(studio).toContain("มีสัตว์หรือสิ่งมีชีวิตในตอนนี้หรือไม่?");
    expect(studio).toContain("คัดลอกกล้องไปทุกฉาก");
    expect(studio).toContain("คัดลอกแสงไปทุกฉาก");
    expect(studio).toContain("ส่ง Storyboard ให้ทีม AI");
  });
});
