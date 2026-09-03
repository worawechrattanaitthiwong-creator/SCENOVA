import { randomUUID } from "node:crypto";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";
import { getSystemProviderCredential } from "@/lib/api-connections/providers";
import { calculateLlmCostThb } from "@/lib/llm/pricing";
import { assertLlmBudget, recordLlmUsage } from "@/lib/llm/usage";
import { callOpenAiFunction, type FunctionCallResult, type FunctionTool } from "@/lib/llm/openai-responses";

export type SystemAiFunctionInput = {
  userId: string;
  runId?: string | null;
  category: string;
  referenceType?: string | null;
  referenceId?: string | null;
  instructions: string;
  prompt: string;
  tools: FunctionTool[];
  maxOutputTokens: number;
  openAiModelId: string;
  metadata?: Record<string, unknown>;
};

type CompatibleProvider = "inception" | "groq" | "openrouter";

type SystemCandidate = {
  provider: CompatibleProvider;
  apiKey: string;
  baseUrl: string;
  modelId: string;
};

function parseObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function providerOrder() {
  const preferred = (process.env.SCENOVA_SYSTEM_AI_PROVIDER || "")
    .trim()
    .toLowerCase();
  const supported: CompatibleProvider[] = ["inception", "groq", "openrouter"];
  if (!supported.includes(preferred as CompatibleProvider)) return supported;
  return [preferred as CompatibleProvider, ...supported.filter((provider) => provider !== preferred)];
}

function systemCandidates(): SystemCandidate[] {
  const candidates: SystemCandidate[] = [];
  for (const provider of providerOrder()) {
    const credential = getSystemProviderCredential(provider, "ANALYZER");
    if (!credential?.apiKey || !credential.modelId) continue;
    candidates.push({
      provider,
      apiKey: credential.apiKey,
      baseUrl: credential.baseUrl.replace(/\/$/, ""),
      modelId: credential.modelId,
    });
  }
  return candidates;
}

async function callCompatibleSystemProvider(candidate: SystemCandidate, input: SystemAiFunctionInput): Promise<FunctionCallResult> {
  await assertEmergencyCapability("llm", candidate.provider);
  await enforceEmergencyRateLimit(
    `llm:system:${candidate.provider}:${input.userId}`,
    Number(process.env.EMERGENCY_LLM_CALLS_PER_MINUTE || 5),
  );

  const approximateInputTokens = Math.max(
    1,
    Math.ceil((input.instructions.length + input.prompt.length + JSON.stringify(input.tools).length) / 4),
  );
  const estimatedCostThb = calculateLlmCostThb({
    modelId: candidate.modelId,
    inputTokens: approximateInputTokens,
    outputTokens: input.maxOutputTokens,
  });
  await assertLlmBudget({ userId: input.userId, estimatedCostThb });

  const response = await fetch(`${candidate.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${candidate.apiKey}`,
      "Content-Type": "application/json",
      ...(candidate.provider === "openrouter"
        ? {
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://scnva.com",
            "X-Title": "SCENOVA Studio",
          }
        : {}),
    },
    body: JSON.stringify({
      model: candidate.modelId,
      messages: [
        { role: "system", content: input.instructions },
        { role: "user", content: input.prompt },
      ],
      tools: input.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      })),
      tool_choice: "auto",
      temperature: 0.65,
      max_tokens: Math.min(8192, Math.max(256, input.maxOutputTokens)),
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : {};
    const message = typeof error.message === "string" ? error.message : JSON.stringify(body);
    throw new Error(`SYSTEM_AI_${candidate.provider.toUpperCase()}_HTTP_${response.status}:${message.slice(0, 600)}`);
  }

  const choices = Array.isArray(body.choices) ? body.choices : [];
  const first = choices[0] && typeof choices[0] === "object" ? choices[0] as Record<string, unknown> : {};
  const message = first.message && typeof first.message === "object" ? first.message as Record<string, unknown> : {};
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  const call = toolCalls[0] && typeof toolCalls[0] === "object" ? toolCalls[0] as Record<string, unknown> : {};
  const fn = call.function && typeof call.function === "object" ? call.function as Record<string, unknown> : {};
  const content = typeof message.content === "string" ? message.content : "";
  const functionArguments = parseObject(fn.arguments);
  const contentArguments = parseObject(content);
  const argumentsValue = Object.keys(functionArguments).length ? functionArguments : contentArguments;
  const inferredToolName = Object.keys(argumentsValue).length && input.tools.length === 1 ? input.tools[0]?.name || null : null;

  const usage = body.usage && typeof body.usage === "object" ? body.usage as Record<string, unknown> : {};
  const inputTokens = Math.max(0, Number(usage.prompt_tokens || approximateInputTokens));
  const outputTokens = Math.max(0, Number(usage.completion_tokens || 0));
  const recorded = await recordLlmUsage({
    userId: input.userId,
    runId: input.runId || null,
    provider: candidate.provider,
    modelId: String(body.model || candidate.modelId),
    category: input.category,
    inputTokens,
    outputTokens,
    referenceType: input.referenceType || null,
    referenceId: input.referenceId || null,
    metadata: {
      requestId: String(body.id || randomUUID()),
      billingMode: "SYSTEM",
      billingScope: "SCENOVA_SYSTEM",
      systemAiProvider: candidate.provider,
      ...input.metadata,
    },
  });

  return {
    name: typeof fn.name === "string" ? fn.name : inferredToolName,
    arguments: argumentsValue,
    outputText: content,
    responseId: String(body.id || ""),
    modelId: String(body.model || candidate.modelId),
    inputTokens,
    cachedInputTokens: 0,
    outputTokens,
    costThb: Number(recorded.costThb.toString()),
  };
}

export async function callSystemAiFunction(input: SystemAiFunctionInput): Promise<FunctionCallResult> {
  const errors: string[] = [];
  const candidates = systemCandidates();

  for (const candidate of candidates) {
    try {
      return await callCompatibleSystemProvider(candidate, input);
    } catch (error) {
      errors.push(error instanceof Error ? error.message.split(":")[0] : `SYSTEM_AI_${candidate.provider.toUpperCase()}_FAILED`);
    }
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      return await callOpenAiFunction({
        userId: input.userId,
        runId: input.runId || null,
        category: input.category,
        referenceType: input.referenceType || null,
        referenceId: input.referenceId || null,
        modelId: input.openAiModelId,
        instructions: input.instructions,
        prompt: input.prompt,
        tools: input.tools,
        maxOutputTokens: input.maxOutputTokens,
        metadata: {
          billingMode: "SYSTEM",
          billingScope: "SCENOVA_SYSTEM",
          systemAiProvider: "openai",
          ...input.metadata,
        },
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message.split(":")[0] : "SYSTEM_AI_OPENAI_FAILED");
    }
  }

  if (!candidates.length && !process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("SYSTEM_AI_NOT_CONFIGURED");
  }
  throw new Error(`SYSTEM_AI_UNAVAILABLE:${errors.join(",") || "UNKNOWN"}`);
}

export function systemAiErrorMessage(code: string) {
  if (code === "SYSTEM_AI_NOT_CONFIGURED") {
    return "ยังไม่ได้ตั้งค่า System AI ของ SCENOVA กรุณาเชื่อมต่อ System Analyzer ก่อนใช้งาน AI Agent หรือ Generate Prompt";
  }
  if (code === "SYSTEM_AI_UNAVAILABLE") {
    return "System AI ของ SCENOVA เชื่อมต่ออยู่แต่ตอบกลับไม่สำเร็จ กรุณาลองใหม่อีกครั้งหรือตรวจสถานะ System Analyzer";
  }
  if (code.includes("BUDGET_EXCEEDED")) {
    return "System AI ถึงวงเงินการใช้งานที่กำหนดไว้ กรุณาตรวจสอบ LLM Budget ของระบบ";
  }
  return "System AI ประมวลผลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}
