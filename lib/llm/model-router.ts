export type LlmTask = "AI_SUGGEST" | "AGENT_PLAN" | "PROMPT_PRODUCTION" | "CONTINUITY" | "RECOVERY";
export type LlmTier = "fast" | "balanced" | "premium";

export type LlmRoute = {
  provider: "openai";
  modelId: string;
  tier: LlmTier;
  reason: string;
  maxOutputTokens: number;
};

function model(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export function routeLlm(input: { task: LlmTask; contextChars?: number; retryCount?: number; forceTier?: LlmTier }): LlmRoute {
  const fast = model("SCENOVA_LLM_FAST_MODEL", "gpt-5.6-luna");
  const balanced = model("SCENOVA_LLM_BALANCED_MODEL", "gpt-5.6-terra");
  const premium = model("SCENOVA_LLM_PREMIUM_MODEL", "gpt-5.6-sol");
  const contextChars = Math.max(0, input.contextChars || 0);
  const retryCount = Math.max(0, input.retryCount || 0);

  let tier: LlmTier = input.forceTier || "fast";
  if (!input.forceTier) {
    if (input.task === "PROMPT_PRODUCTION" && contextChars > 12_000) tier = "balanced";
    if (input.task === "AGENT_PLAN" && contextChars > 18_000) tier = "balanced";
    if (input.task === "CONTINUITY" && contextChars > 25_000) tier = "balanced";
    if (retryCount >= 2 && input.task !== "AI_SUGGEST") tier = "balanced";
    if (retryCount >= 4) tier = "premium";
  }

  const modelId = tier === "fast" ? fast : tier === "balanced" ? balanced : premium;
  return {
    provider: "openai",
    modelId,
    tier,
    reason: tier === "fast"
      ? "ใช้โมเดลประหยัดเป็นค่าเริ่มต้นเพื่อลดต้นทุนต่อ AI interaction"
      : tier === "balanced"
        ? "Context/Retry สูงขึ้น จึงยกระดับโมเดลเพื่อรักษาคุณภาพ"
        : "ใช้โมเดลระดับสูงเฉพาะงานที่ retry หลายรอบหรือซับซ้อนมาก",
    maxOutputTokens: input.task === "AI_SUGGEST" ? 700 : input.task === "PROMPT_PRODUCTION" ? 2200 : 1200,
  };
}
