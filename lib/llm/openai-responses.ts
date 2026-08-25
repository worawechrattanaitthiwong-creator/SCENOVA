import { calculateLlmCostThb } from "@/lib/llm/pricing";
import { assertLlmBudget, recordLlmUsage } from "@/lib/llm/usage";

export type FunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
};

export type FunctionCallResult = {
  name: string | null;
  arguments: Record<string, unknown>;
  outputText: string;
  responseId: string;
  modelId: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costThb: number;
};

function parseArguments(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function extractText(output: unknown[]) {
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (row.type !== "message" || !Array.isArray(row.content)) continue;
    for (const content of row.content) {
      if (!content || typeof content !== "object") continue;
      const part = content as Record<string, unknown>;
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("\n").trim();
}

export async function callOpenAiFunction(input: {
  userId: string;
  runId?: string | null;
  category: string;
  referenceType?: string | null;
  referenceId?: string | null;
  modelId: string;
  instructions: string;
  prompt: string;
  tools: FunctionTool[];
  maxOutputTokens: number;
  metadata?: Record<string, unknown>;
}): Promise<FunctionCallResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("LLM_NOT_CONFIGURED:OPENAI_API_KEY");
  const baseUrl = (process.env.OPENAI_API_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const approximateInputTokens = Math.max(1, Math.ceil((input.instructions.length + input.prompt.length + JSON.stringify(input.tools).length) / 4));
  const estimatedCostThb = calculateLlmCostThb({ modelId: input.modelId, inputTokens: approximateInputTokens, outputTokens: input.maxOutputTokens });
  await assertLlmBudget({ userId: input.userId, estimatedCostThb });

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: input.modelId,
      instructions: input.instructions,
      input: input.prompt,
      tools: input.tools,
      tool_choice: "auto",
      max_output_tokens: input.maxOutputTokens,
      store: false,
    }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : {};
    const message = typeof error.message === "string" ? error.message : JSON.stringify(body);
    throw new Error(`LLM_HTTP_${response.status}:${message.slice(0, 600)}`);
  }

  const output = Array.isArray(body.output) ? body.output : [];
  const functionCall = output.find((item) => item && typeof item === "object" && (item as Record<string, unknown>).type === "function_call") as Record<string, unknown> | undefined;
  const usage = body.usage && typeof body.usage === "object" ? body.usage as Record<string, unknown> : {};
  const details = usage.input_tokens_details && typeof usage.input_tokens_details === "object" ? usage.input_tokens_details as Record<string, unknown> : {};
  const inputTokens = Math.max(0, Number(usage.input_tokens || approximateInputTokens));
  const cachedInputTokens = Math.max(0, Number(details.cached_tokens || 0));
  const outputTokens = Math.max(0, Number(usage.output_tokens || 0));
  const recorded = await recordLlmUsage({
    userId: input.userId,
    runId: input.runId || null,
    provider: "openai",
    modelId: String(body.model || input.modelId),
    category: input.category,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    referenceType: input.referenceType || null,
    referenceId: input.referenceId || null,
    metadata: { responseId: body.id, ...input.metadata },
  });

  return {
    name: functionCall && typeof functionCall.name === "string" ? functionCall.name : null,
    arguments: parseArguments(functionCall?.arguments),
    outputText: extractText(output),
    responseId: String(body.id || ""),
    modelId: String(body.model || input.modelId),
    inputTokens,
    cachedInputTokens,
    outputTokens,
    costThb: Number(recorded.costThb.toString()),
  };
}
