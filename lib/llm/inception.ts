import { randomUUID } from "node:crypto";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";
import { getSystemProviderCredential } from "@/lib/api-connections/providers";
import { getUserApiConnectionSecret } from "@/lib/api-connections/store";
import { recordLlmUsage } from "@/lib/llm/usage";
import type { FunctionCallResult, FunctionTool } from "@/lib/llm/openai-responses";

function parseObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch { return {}; }
}

async function credential(userId: string) {
  const byok = await getUserApiConnectionSecret({ userId, provider: "inception", kind: "ANALYZER" });
  if (byok?.connection.status === "CONNECTED") {
    return {
      apiKey: byok.apiKey,
      baseUrl: byok.connection.baseUrl || "https://api.inceptionlabs.ai/v1",
      modelId: byok.connection.modelId || "mercury-2",
      billingMode: "BYOK" as const,
      connectionId: byok.connection.id,
    };
  }
  const system = getSystemProviderCredential("inception", "ANALYZER");
  if (!system) throw new Error("INCEPTION_NOT_CONFIGURED");
  return { ...system, modelId: system.modelId || "mercury-2", billingMode: "SYSTEM" as const, connectionId: null };
}

export async function callInceptionFunction(input: {
  userId: string;
  runId?: string | null;
  category: string;
  referenceType?: string | null;
  referenceId?: string | null;
  instructions: string;
  prompt: string;
  tools: FunctionTool[];
  maxOutputTokens?: number;
  metadata?: Record<string, unknown>;
}): Promise<FunctionCallResult> {
  const resolved = await credential(input.userId);
  await assertEmergencyCapability("llm", "inception");
  await enforceEmergencyRateLimit(`llm:inception:${input.userId}`, Number(process.env.EMERGENCY_LLM_CALLS_PER_MINUTE || 5));
  const approximateInputTokens = Math.max(1, Math.ceil((input.instructions.length + input.prompt.length + JSON.stringify(input.tools).length) / 4));
  const response = await fetch(`${resolved.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${resolved.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: resolved.modelId,
      messages: [{ role: "system", content: input.instructions }, { role: "user", content: input.prompt }],
      tools: input.tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })),
      tool_choice: "auto",
      temperature: 0.75,
      reasoning_effort: "medium",
      max_tokens: Math.min(8192, Math.max(256, input.maxOutputTokens || 2048)),
    }),
    signal: AbortSignal.timeout(35_000),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`INCEPTION_HTTP_${response.status}:${JSON.stringify(body).slice(0, 500)}`);
  const choices = Array.isArray(body.choices) ? body.choices : [];
  const message = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>).message as Record<string, unknown> | undefined : undefined;
  const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  const call = toolCalls[0] && typeof toolCalls[0] === "object" ? toolCalls[0] as Record<string, unknown> : undefined;
  const fn = call?.function && typeof call.function === "object" ? call.function as Record<string, unknown> : undefined;
  const usage = body.usage && typeof body.usage === "object" ? body.usage as Record<string, unknown> : {};
  const inputTokens = Math.max(0, Number(usage.prompt_tokens || approximateInputTokens));
  const outputTokens = Math.max(0, Number(usage.completion_tokens || 0));
  const recorded = await recordLlmUsage({
    userId: input.userId, runId: input.runId || null, provider: "inception", modelId: String(body.model || resolved.modelId),
    category: input.category, inputTokens, outputTokens,
    referenceType: input.referenceType || null, referenceId: input.referenceId || null,
    metadata: { requestId: String(body.id || randomUUID()), billingMode: resolved.billingMode, connectionId: resolved.connectionId, ...input.metadata },
  });
  const content = typeof message?.content === "string" ? message.content : "";
  const functionArguments = parseObject(fn?.arguments);
  return {
    name: typeof fn?.name === "string" ? fn.name : null,
    arguments: Object.keys(functionArguments).length ? functionArguments : parseObject(content),
    outputText: content,
    responseId: String(body.id || ""), modelId: String(body.model || resolved.modelId),
    inputTokens, cachedInputTokens: 0, outputTokens, costThb: Number(recorded.costThb.toString()),
  };
}
