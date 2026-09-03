import { randomUUID } from "node:crypto";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";
import { getSystemProviderCredential } from "@/lib/api-connections/providers";
import { getAdminSystemAnalyzerConnections } from "@/lib/api-connections/system-store";
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

type SystemProvider = "inception" | "groq" | "openrouter" | "gemini";
type CandidateSource = "ADMIN_CONNECTION" | "ENV";

type SystemCandidate = {
  provider: SystemProvider;
  apiKey: string;
  baseUrl: string;
  modelId: string;
  source: CandidateSource;
  connectionId: string | null;
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

function providerOrder(): SystemProvider[] {
  const preferred = (process.env.SCENOVA_SYSTEM_AI_PROVIDER || "").trim().toLowerCase();
  const supported: SystemProvider[] = ["inception", "groq", "openrouter", "gemini"];
  if (!supported.includes(preferred as SystemProvider)) return supported;
  return [preferred as SystemProvider, ...supported.filter((provider) => provider !== preferred)];
}

function candidateRank(candidate: SystemCandidate, order: SystemProvider[]) {
  const providerRank = order.indexOf(candidate.provider);
  return (candidate.source === "ADMIN_CONNECTION" ? 0 : 100) + (providerRank < 0 ? 50 : providerRank);
}

async function systemCandidates(): Promise<SystemCandidate[]> {
  const order = providerOrder();
  const candidates: SystemCandidate[] = [];
  const supported = new Set<SystemProvider>(order);

  // Settings/API connections made by an active Admin are SCENOVA platform
  // credentials. They are the primary System AI source for both Agent planning
  // and Studio Generate Prompt. The key never leaves the server.
  const adminConnections = await getAdminSystemAnalyzerConnections();
  for (const connection of adminConnections) {
    const provider = connection.provider as SystemProvider;
    if (!supported.has(provider)) continue;
    candidates.push({
      provider,
      apiKey: connection.apiKey,
      baseUrl: connection.baseUrl.replace(/\/$/, ""),
      modelId: connection.modelId,
      source: "ADMIN_CONNECTION",
      connectionId: connection.connectionId,
    });
  }

  // Environment credentials are retained as a server-only fallback for
  // installations that have not configured an Admin Analyzer in the UI yet.
  for (const provider of order) {
    const credential = getSystemProviderCredential(provider, "ANALYZER");
    if (!credential?.apiKey || !credential.modelId) continue;
    candidates.push({
      provider,
      apiKey: credential.apiKey,
      baseUrl: credential.baseUrl.replace(/\/$/, ""),
      modelId: credential.modelId,
      source: "ENV",
      connectionId: null,
    });
  }

  // Prefer the Admin default connection. getAdminSystemAnalyzerConnections()
  // already returns default/most-recent first; stable sort preserves that order
  // inside the same provider rank.
  return candidates.sort((left, right) => candidateRank(left, order) - candidateRank(right, order));
}

async function prepareCall(candidate: SystemCandidate, input: SystemAiFunctionInput) {
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
  return { approximateInputTokens };
}

async function recordSystemUsage(input: {
  candidate: SystemCandidate;
  request: SystemAiFunctionInput;
  responseId: string;
  responseModelId: string;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
}) {
  return recordLlmUsage({
    userId: input.request.userId,
    runId: input.request.runId || null,
    provider: input.candidate.provider,
    modelId: input.responseModelId,
    category: input.request.category,
    inputTokens: input.inputTokens,
    cachedInputTokens: input.cachedInputTokens || 0,
    outputTokens: input.outputTokens,
    referenceType: input.request.referenceType || null,
    referenceId: input.request.referenceId || null,
    metadata: {
      requestId: input.responseId || randomUUID(),
      billingMode: "SYSTEM",
      billingScope: "SCENOVA_SYSTEM",
      systemAiProvider: input.candidate.provider,
      systemAiSource: input.candidate.source,
      systemConnectionId: input.candidate.connectionId,
      ...input.request.metadata,
    },
  });
}

async function callCompatibleSystemProvider(candidate: SystemCandidate, input: SystemAiFunctionInput): Promise<FunctionCallResult> {
  const { approximateInputTokens } = await prepareCall(candidate, input);
  const toolChoice = input.tools.length === 1
    ? { type: "function", function: { name: input.tools[0]!.name } }
    : "auto";

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
      tool_choice: toolChoice,
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

  if (!Object.keys(argumentsValue).length) {
    throw new Error(`SYSTEM_AI_${candidate.provider.toUpperCase()}_STRUCTURED_OUTPUT_MISSING`);
  }

  const usage = body.usage && typeof body.usage === "object" ? body.usage as Record<string, unknown> : {};
  const inputTokens = Math.max(0, Number(usage.prompt_tokens || approximateInputTokens));
  const outputTokens = Math.max(0, Number(usage.completion_tokens || 0));
  const responseModelId = String(body.model || candidate.modelId);
  const responseId = String(body.id || "");
  const recorded = await recordSystemUsage({
    candidate,
    request: input,
    responseId,
    responseModelId,
    inputTokens,
    outputTokens,
  });

  return {
    name: typeof fn.name === "string" ? fn.name : inferredToolName,
    arguments: argumentsValue,
    outputText: content,
    responseId,
    modelId: responseModelId,
    inputTokens,
    cachedInputTokens: 0,
    outputTokens,
    costThb: Number(recorded.costThb.toString()),
  };
}

async function callGeminiSystemProvider(candidate: SystemCandidate, input: SystemAiFunctionInput): Promise<FunctionCallResult> {
  const { approximateInputTokens } = await prepareCall(candidate, input);
  const modelId = candidate.modelId.replace(/^models\//, "");
  const response = await fetch(`${candidate.baseUrl}/models/${encodeURIComponent(modelId)}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": candidate.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.instructions }] },
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      tools: [{
        functionDeclarations: input.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parametersJsonSchema: tool.parameters,
        })),
      }],
      toolConfig: {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: input.tools.map((tool) => tool.name),
        },
      },
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: Math.min(8192, Math.max(256, input.maxOutputTokens)),
      },
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : {};
    const message = typeof error.message === "string" ? error.message : JSON.stringify(body);
    throw new Error(`SYSTEM_AI_GEMINI_HTTP_${response.status}:${message.slice(0, 600)}`);
  }

  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  const first = candidates[0] && typeof candidates[0] === "object" ? candidates[0] as Record<string, unknown> : {};
  const content = first.content && typeof first.content === "object" ? first.content as Record<string, unknown> : {};
  const parts = Array.isArray(content.parts) ? content.parts : [];
  let toolName: string | null = null;
  let argumentsValue: Record<string, unknown> = {};
  const textParts: string[] = [];

  for (const rawPart of parts) {
    if (!rawPart || typeof rawPart !== "object") continue;
    const part = rawPart as Record<string, unknown>;
    if (typeof part.text === "string") textParts.push(part.text);
    const functionCall = part.functionCall && typeof part.functionCall === "object"
      ? part.functionCall as Record<string, unknown>
      : null;
    if (!functionCall) continue;
    if (typeof functionCall.name === "string") toolName = functionCall.name;
    if (functionCall.args && typeof functionCall.args === "object" && !Array.isArray(functionCall.args)) {
      argumentsValue = functionCall.args as Record<string, unknown>;
    }
  }

  const outputText = textParts.join("\n").trim();
  if (!Object.keys(argumentsValue).length) argumentsValue = parseObject(outputText);
  if (!toolName && Object.keys(argumentsValue).length && input.tools.length === 1) toolName = input.tools[0]?.name || null;
  if (!Object.keys(argumentsValue).length) throw new Error("SYSTEM_AI_GEMINI_STRUCTURED_OUTPUT_MISSING");

  const usage = body.usageMetadata && typeof body.usageMetadata === "object" ? body.usageMetadata as Record<string, unknown> : {};
  const inputTokens = Math.max(0, Number(usage.promptTokenCount || approximateInputTokens));
  const cachedInputTokens = Math.max(0, Number(usage.cachedContentTokenCount || 0));
  const outputTokens = Math.max(0, Number(usage.candidatesTokenCount || 0));
  const responseId = String(body.responseId || body.id || "");
  const recorded = await recordSystemUsage({
    candidate,
    request: input,
    responseId,
    responseModelId: candidate.modelId,
    inputTokens,
    cachedInputTokens,
    outputTokens,
  });

  return {
    name: toolName,
    arguments: argumentsValue,
    outputText,
    responseId,
    modelId: candidate.modelId,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    costThb: Number(recorded.costThb.toString()),
  };
}

async function callCandidate(candidate: SystemCandidate, input: SystemAiFunctionInput) {
  if (candidate.provider === "gemini") return callGeminiSystemProvider(candidate, input);
  return callCompatibleSystemProvider(candidate, input);
}

export async function callSystemAiFunction(input: SystemAiFunctionInput): Promise<FunctionCallResult> {
  const errors: string[] = [];
  let candidates: SystemCandidate[] = [];

  try {
    candidates = await systemCandidates();
  } catch (error) {
    // A database/read problem in the Admin connection source must not prevent an
    // environment System AI from being attempted below.
    errors.push(error instanceof Error ? error.message.split(":")[0] : "SYSTEM_AI_ADMIN_CONNECTION_READ_FAILED");
    const order = providerOrder();
    candidates = order.flatMap((provider) => {
      const credential = getSystemProviderCredential(provider, "ANALYZER");
      if (!credential?.apiKey || !credential.modelId) return [];
      return [{
        provider,
        apiKey: credential.apiKey,
        baseUrl: credential.baseUrl.replace(/\/$/, ""),
        modelId: credential.modelId,
        source: "ENV" as const,
        connectionId: null,
      }];
    });
  }

  for (const candidate of candidates) {
    try {
      return await callCandidate(candidate, input);
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
          systemAiSource: "ENV",
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
    return "ยังไม่พบ System Analyzer ของ SCENOVA กรุณาเชื่อม Analyzer ในบัญชี Admin หรือกำหนด System AI ฝั่ง Server";
  }
  if (code === "SYSTEM_AI_UNAVAILABLE") {
    return "System AI ของ SCENOVA เชื่อมต่ออยู่แต่ตอบกลับไม่สำเร็จ กรุณาลองใหม่อีกครั้งหรือตรวจสถานะ Analyzer ที่บัญชี Admin ตั้งเป็นค่าเริ่มต้น";
  }
  if (code.includes("BUDGET_EXCEEDED")) {
    return "System AI ถึงวงเงินการใช้งานที่กำหนดไว้ กรุณาตรวจสอบ LLM Budget ของระบบ";
  }
  return "System AI ประมวลผลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}
