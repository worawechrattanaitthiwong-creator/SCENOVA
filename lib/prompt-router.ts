import type { Episode, Project } from "@/lib/domain";

export type PromptRoute = {
  tier: "free-composer" | "ai-assisted" | "production";
  provider: "local" | "gemini" | "openai" | "anthropic";
  model: string;
  reasonTh: string;
  chargePromptCredits: boolean;
};

export function routePrompt(project: Project, episode: Episode, purpose: "video" | "export"): PromptRoute {
  const shotCount = episode.segments.reduce((sum, segment) => sum + segment.cameraShots.length, 0);
  const complex = episode.duration > 30 || shotCount > 8 || project.characters.length > 2 || project.modelMode !== "single";

  // ผู้ใช้กดสร้างคลิปใน SCENOVA: Prompt เป็นส่วนหนึ่งของ Video Generation ไม่คิด Prompt Credits ซ้ำ
  if (purpose === "video") {
    return {
      tier: complex ? "production" : "ai-assisted",
      provider: complex ? "openai" : "gemini",
      model: complex ? "production-model-config" : "fast-model-config",
      reasonTh: complex ? "งานมีหลายช็อต/หลายช่วง ใช้ AI คุณภาพสูงช่วยเรียบเรียง แต่ไม่คิดค่า Prompt ซ้ำจากค่าคลิป" : "ใช้ AI รุ่นเร็วช่วยเพิ่มภาษาภาพยนตร์จาก Structured Data",
      chargePromptCredits: false,
    };
  }

  if (project.promptMode === "strict") {
    return {
      tier: "free-composer",
      provider: "local",
      model: "structured-template",
      reasonTh: "Strict Composer ประกอบจากค่าที่ผู้ใช้เลือกโดยตรง ไม่ต้องเรียก LLM",
      chargePromptCredits: false,
    };
  }

  return {
    tier: complex ? "production" : "ai-assisted",
    provider: complex ? "openai" : "gemini",
    model: complex ? "production-model-config" : "fast-model-config",
    reasonTh: complex ? "Prompt สำหรับ Export มีความซับซ้อนสูง จึงใช้ Production Prompt Assistant" : "Prompt Export ระดับทั่วไป ใช้ AI รุ่นเร็วเพื่อประหยัดต้นทุน",
    chargePromptCredits: true,
  };
}
