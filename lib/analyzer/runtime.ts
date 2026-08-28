import { randomUUID } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";
import { PrismaWalletService } from "@/lib/wallet";
import { calculateLlmCostThb } from "@/lib/llm/pricing";
import { getProviderDefinition, getSystemProviderCredential } from "@/lib/api-connections/providers";
import { getDefaultUserApiConnectionSecret, getUserApiConnectionSecret, markApiConnectionStatus } from "@/lib/api-connections/store";
import { productionAnalysisJsonSchema, productionAnalysisSchema, type ProductionAnalysis } from "@/lib/analyzer/schema";

export type AnalyzerBillingMode = "AUTO" | "BYOK" | "SYSTEM";
export type AnalyzerProviderId = "groq" | "openrouter" | "gemini";

type ResolvedCredential = {
  provider: AnalyzerProviderId;
  billingMode: "BYOK" | "SYSTEM";
  apiKey: string;
  baseUrl: string;
  modelId: string;
  connectionId: string | null;
};

type OpenAiCompatibleResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
};

function envCredits(name: string, fallback = 0) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? Math.ceil(value) : fallback;
}

function asAnalyzerProvider(value: string): AnalyzerProviderId | null {
  const id = value.trim().toLowerCase();
  return id === "groq" || id === "openrouter" || id === "gemini" ? id : null;
}

async function resolveCredential(userId: string, requested: AnalyzerBillingMode, preferredProvider?: string | null): Promise<ResolvedCredential> {
  if (requested !== "SYSTEM") {
    const preferred = preferredProvider ? asAnalyzerProvider(preferredProvider) : null;
    const byok = preferred
      ? await getUserApiConnectionSecret({ userId, provider: preferred, kind: "ANALYZER" })
      : await getDefaultUserApiConnectionSecret(userId, "ANALYZER");
    if (byok?.connection.status === "CONNECTED") {
      const provider = asAnalyzerProvider(byok.connection.provider);
      if (provider) {
        const definition = getProviderDefinition(provider, "ANALYZER");
        if (definition?.ready) {
          return {
            provider,
            billingMode: "BYOK",
            apiKey: byok.apiKey,
            baseUrl: byok.connection.baseUrl || definition.defaultBaseUrl,
            modelId: byok.connection.modelId || definition.defaultModelId || "",
            connectionId: byok.connection.id,
          };
        }
      }
    }
    if (requested === "BYOK") throw new Error("BYOK_ANALYZER_CONNECTION_REQUIRED");
  }

  const systemOrder: AnalyzerProviderId[] = preferredProvider && asAnalyzerProvider(preferredProvider)
    ? [asAnalyzerProvider(preferredProvider)!, "groq", "gemini", "openrouter"]
    : ["groq", "gemini", "openrouter"];
  for (const provider of Array.from(new Set(systemOrder))) {
    const definition = getProviderDefinition(provider, "ANALYZER");
    if (!definition?.ready) continue;
    const system = getSystemProviderCredential(provider, "ANALYZER");
    if (!system) continue;
    return {
      provider,
      billingMode: "SYSTEM",
      apiKey: system.apiKey,
      baseUrl: system.baseUrl,
      modelId: system.modelId || definition.defaultModelId || "",
      connectionId: null,
    };
  }
  throw new Error("ANALYZER_SYSTEM_API_KEY_REQUIRED");
}

async function reservePlatformFee(input: { userId: string; billingMode: "BYOK" | "SYSTEM"; provider: string; requestId: string }) {
  const credits = input.billingMode === "BYOK"
    ? envCredits("SCENOVA_BYOK_ANALYZER_CREDIT_FEE", 0)
    : envCredits("SCENOVA_SYSTEM_ANALYZER_CREDIT_FEE", 0);
  if (credits <= 0) return null;
  return new PrismaWalletService().reserve({
    userId: input.userId,
    credits,
    purpose: "prompt",
    category: input.billingMode === "BYOK" ? "AI_ANALYZER_BYOK" : "AI_ANALYZER_SYSTEM",
    referenceId: input.requestId,
    idempotencyKey: `analyzer:${input.requestId}:fee`,
    metadata: { billingMode: input.billingMode, provider: input.provider },
  });
}

function contextText(context?: Record<string, unknown>) {
  return context && Object.keys(context).length > 0
    ? `\n\nSCENOVA context/locks (authoritative; do not override locked values):\n${JSON.stringify(context)}`
    : "";
}

const SYSTEM_INSTRUCTION = [
  "You are SCENOVA Production Analyzer. Analyze the user's filmmaking instruction; do not generate video.",
  "Return only JSON matching the supplied production schema.",
  "Locked character/style/voice/location/prop/canon facts in SCENOVA context are authoritative. Never rewrite or mutate them.",
  "Do not invent spoken dialogue when none is requested; use null.",
  "Use practical cinematic camera terminology. summaryTh must be concise Thai.",
].join(" ");

async function callOpenAiCompatible(credential: ResolvedCredential, prompt: string, context?: Record<string, unknown>) {
  const response = await fetch(`${credential.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${credential.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: credential.modelId,
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: `${prompt}${contextText(context)}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "scenova_production_analysis", strict: true, schema: productionAnalysisJsonSchema },
      },
    }),
    signal: AbortSignal.timeout(35_000),
  });
  const body = await response.text();
  if (!response.ok) throw Object.assign(new Error(`${credential.provider.toUpperCase()}_HTTP_${response.status}`), { status: response.status, providerBody: body });
  const json = JSON.parse(body) as OpenAiCompatibleResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${credential.provider.toUpperCase()}_EMPTY_ANALYSIS`);
  return {
    analysis: productionAnalysisSchema.parse(JSON.parse(content)),
    inputTokens: Math.max(0, Number(json.usage?.prompt_tokens || 0)),
    outputTokens: Math.max(0, Number(json.usage?.completion_tokens || 0)),
    totalTokens: Math.max(0, Number(json.usage?.total_tokens || 0)),
  };
}

async function callGemini(credential: ResolvedCredential, prompt: string, context?: Record<string, unknown>) {
  const response = await fetch(`${credential.baseUrl.replace(/\/$/, "")}/models/${encodeURIComponent(credential.modelId)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": credential.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: `${prompt}${contextText(context)}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: productionAnalysisJsonSchema,
        temperature: 0.2,
      },
    }),
    signal: AbortSignal.timeout(35_000),
  });
  const body = await response.text();
  if (!response.ok) throw Object.assign(new Error(`GEMINI_HTTP_${response.status}`), { status: response.status, providerBody: body });
  const json = JSON.parse(body) as GeminiResponse;
  const content = json.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!content) throw new Error("GEMINI_EMPTY_ANALYSIS");
  return {
    analysis: productionAnalysisSchema.parse(JSON.parse(content)),
    inputTokens: Math.max(0, Number(json.usageMetadata?.promptTokenCount || 0)),
    outputTokens: Math.max(0, Number(json.usageMetadata?.candidatesTokenCount || 0)),
    totalTokens: Math.max(0, Number(json.usageMetadata?.totalTokenCount || 0)),
  };
}

export async function analyzeProductionPromptUniversal(input: {
  userId: string;
  prompt: string;
  context?: Record<string, unknown>;
  billingMode?: AnalyzerBillingMode;
  preferredProvider?: string | null;
}): Promise<{
  analysis: ProductionAnalysis;
  provider: AnalyzerProviderId;
  modelId: string;
  billingMode: "BYOK" | "SYSTEM";
  usage: { inputTokens: number; outputTokens: number; totalTokens: number; costThb: number };
}> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("ANALYZER_PROMPT_REQUIRED");
  if (prompt.length > 50_000) throw new Error("ANALYZER_PROMPT_TOO_LONG");

  const credential = await resolveCredential(input.userId, input.billingMode || "AUTO", input.preferredProvider);
  await assertEmergencyCapability("llm", credential.provider);
  await enforceEmergencyRateLimit(`llm:analyzer:${input.userId}`, Number(process.env.EMERGENCY_LLM_CALLS_PER_MINUTE || 5));

  const requestId = randomUUID();
  const reservation = await reservePlatformFee({ userId: input.userId, billingMode: credential.billingMode, provider: credential.provider, requestId });
  const wallet = reservation ? new PrismaWalletService() : null;

  try {
    const result = credential.provider === "gemini"
      ? await callGemini(credential, prompt, input.context)
      : await callOpenAiCompatible(credential, prompt, input.context);
    const totalTokens = Math.max(result.inputTokens + result.outputTokens, result.totalTokens);
    const costThb = credential.billingMode === "SYSTEM"
      ? calculateLlmCostThb({ modelId: credential.modelId, inputTokens: result.inputTokens, outputTokens: result.outputTokens })
      : 0;

    await prisma.llmUsageEvent.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        provider: credential.provider,
        modelId: credential.modelId,
        category: "AI_ANALYZER",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costThb,
        referenceType: "analyzer-request",
        referenceId: requestId,
        metadata: {
          billingMode: credential.billingMode,
          connectionId: credential.connectionId,
          providerCostPaidByUser: credential.billingMode === "BYOK",
        } as Prisma.InputJsonObject,
      },
    });

    if (credential.connectionId) {
      await markApiConnectionStatus({ userId: input.userId, id: credential.connectionId, status: "CONNECTED", error: null }).catch(() => undefined);
    }
    if (reservation && wallet) await wallet.charge(reservation.reservationId);

    return {
      analysis: result.analysis,
      provider: credential.provider,
      modelId: credential.modelId,
      billingMode: credential.billingMode,
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, totalTokens, costThb },
    };
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status || 0);
    const detail = String((error as { providerBody?: unknown })?.providerBody || error instanceof Error ? error.message : error).slice(0, 500);
    if (credential.connectionId) {
      await markApiConnectionStatus({
        userId: input.userId,
        id: credential.connectionId,
        status: status === 429 ? "RATE_LIMITED" : status === 401 || status === 403 ? "INVALID" : "ERROR",
        error: detail,
      }).catch(() => undefined);
    }
    if (reservation && wallet) await wallet.refund(reservation.reservationId, "Analyzer request failed").catch(() => undefined);
    throw error;
  }
}
