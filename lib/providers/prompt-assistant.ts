import type { PromptBundle, PromptMode, Project, Episode } from "@/lib/domain";

export type PromptAssistRequest = {
  project: Project;
  episode: Episode;
  base: PromptBundle;
  mode: PromptMode;
  targetModelId: string;
};

export interface PromptAssistant {
  id: string;
  improve(request: PromptAssistRequest): Promise<PromptBundle>;
}

/**
 * ใช้ระหว่างพัฒนาระบบก่อนเชื่อม Gemini/OpenAI/Claude API
 * - Strict: คืน Prompt เดิม 100%
 * - Assisted/Director: ตอนนี้คืนโครงเดิม เพื่อให้ Flow ทั้งระบบทดสอบได้โดยไม่มีค่า API
 * เมื่อเชื่อม AI จริง ให้เปลี่ยน implementation ตัวนี้โดยไม่แตะ Timeline/Project UI
 */
export class MockPromptAssistant implements PromptAssistant {
  id = "mock-prompt-assistant";

  async improve(request: PromptAssistRequest): Promise<PromptBundle> {
    if (request.mode === "strict") return request.base;
    return {
      ...request.base,
      master: `${request.base.master}\n\n# AI ASSISTANCE LAYER\nMode: ${request.mode}. Preserve all hard constraints exactly. Improve cinematic language, temporal continuity and provider-specific phrasing without changing user-selected camera, lens, timing or active locks.`,
    };
  }
}
