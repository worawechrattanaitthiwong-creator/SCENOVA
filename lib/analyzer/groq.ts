import { randomUUID } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { assertEmergencyCapability, enforceEmergencyRateLimit } from "@/lib/emergency-security";
import { PrismaWalletService } from "@/lib/wallet";
import { calculateLlmCostThb } from "@/lib/llm/pricing";
import { getSystemProviderCredential } from "@/lib/api-connections/providers";
import { getUserApiConnectionSecret, markApiConnectionStatus } from "@/lib/api-connections/store";
import { productionAnalysisJsonSchema, productionAnalysisSchema, type ProductionAnalysis } from "@/lib/analyzer/schema";

export type AnalyzerBillingMode = "AUTO" | "BYOK" | "SYSTEM";

type GroqResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type ResolvedCredential = {
  billingMode: "BYOK" | "SYSTEM";
  apiKey: string;
  baseUrl: string;
  modelId: string;
  connectionId: string | null;
};

function envCredits(name: string, fallback = 0) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? Math.ceil(value) : fallback;
}

async function resolveGroqCredential(userId: string, requested: AnalyzerBillingMode): Promise<ResolvedCredential> {
  if (requested !== "SYSTEM") {
    const byok = await getUserApiConnectionSecret({ userId, provider: "groq", kind: "ANALYZER" });
    if (byok) {
      return {
        billingMode: "BYOK",
        apiKey: byok.apiKey,
        baseUrl: byok.connection.baseUrl || "https://api.groq.com/openai/v1",
        modelId: byok.connection.modelId || "openai/gpt-oss-20b",
        connectionId: byok.connection.id,
      };
    }
    if (requested === "BYOK") throw new Error("BYOK_GROQ_CONNECTION_REQUIRED");
  }

  const system = getSystemProviderCredential("groq", "ANALYZER");
  if (!system) throw new Error("GROQ_SYSTEM_API_KEY_REQUIRED");
  return {
    billingMode: "SYSTEM",
    apiKey: system.apiKey,
    baseUrl: system.baseUrl,
    modelId: system.modelId || "openai/gpt-oss-20b",
    connectionId: null,
  };
}

async function reservePlatformFee(input: { userId: string; billingMode: "BYOK" | "SYSTEM"; requestId: string }) {
  const credits = input.billingMode === "BYOK"
    ? envCredits("SCENOVA_BYOK_ANALYZER_CREDIT_FEE", 0)
    : envCredits("SCENOVA_SYSTEM_ANALYZER_CREDIT_FEE", 0);
  if (credits <= 0) return null;

  const wallet = new PrismaWalletService();
  return wallet.reserve({
    userId: input.userId,
    credits,
    purpose: "prompt",
    category: input.billingMode === "BYOK" ? "AI_ANALYZER_BYOK" : "AI_ANALYZER_SYSTEM",
    referenceId: input.requestId,
    idempotencyKey: `analyzer:${input.requestId}:fee`,
    metadata: { billingMode: input.billingMode, provider: "groq" },
  });
}

export async function analyzeProductionPrompt(input: {
  userId: string;
  prompt: string;
  context?: Record<string, unknown>;
  billingMode?: AnalyzerBillingMode;
}): Promise<{
  analysis: ProductionAnalysis;
  provider: "groq";
  modelId: string;
  billingMode: "BYOK" | "SYSTEM";
  usage: { inputTokens: number; outputTokens: number; totalTokens: number; costThb: number };
}> {
  await assertEmergencyCapability("llm", "groq");
  await enforceEmergencyRateLimit(`llm:analyzer:${input.userId}`, Number(process.env.EMERGENCY_LLM_CALLS_PER_MINUTE || 5));

  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("ANALYZER_PROMPT_REQUIRED");
  if (prompt.length > 50_000) throw new Error("ANALYZER_PROMPT_TOO_LONG");

  const credential = await resolveGroqCredential(input.userId, input.billingMode || "AUTO");
  const requestId = randomUUID();
  const reservation = await reservePlatformFee({ userId: input.userId, billingMode: credential.billingMode, requestId });
  const wallet = reservation ? new PrismaWalletService() : null;

  const contextText = input.context && Object.keys(input.context).length > 0
    ? `\n\nSCENOVA context/locks (authoritative; do not override locked values):\n${JSON.stringify(input.context)}`
    : "";

  try {
    const response = await fetch(`${credential.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: credential.modelId,
        messages: [
          {
            role: "system",
            content: [
              "You are SCENOVA Production Analyzer. Analyze the user's filmmaking instruction; do not generate video.",
              "Return only the requested structured JSON.",
              "Locked character/style/voice/location facts in SCENOVA context are authoritative. Never rewrite or mutate them.",
              "Do not invent spoken dialogue when none is requested; use null.",
              "Use practical cinematic camera terminology. summaryTh must be concise Thai.",
            ].join(" "),
          },
          { role: "user", content: `${prompt}${contextText}` },
        ],
        reasoning_effort: "low",
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "scenova_production_analysis",
            strict: true,
            schema: productionAnalysisJsonSchema,
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const providerError = await response.text().catch(() => "");
      if (credential.connectionId) {
        await markApiConnectionStatus({
          userId: input.userId,
          id: credential.connectionId,
          status: response.status === 429 ? "RATE_LIMITED" : response.status === 401 || response.status === 403 ? "INVALID" : "ERROR",
          error: providerError.slice(0, 500) || `HTTP_${response.status}`,
        }).catch(() => undefined);
      }
      throw new Error(response.status === 429 ? "GROQ_RATE_LIMITED" : response.status === 401 || response.status === 403 ? "GROQ_API_KEY_INVALID" : `GROQ_HTTP_${response.status}`);
    }

    const json = await response.json() as GroqResponse;
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("GROQ_EMPTY_ANALYSIS");

    const parsedJson = JSON.parse(content) as unknown;
    const analysis = productionAnalysisSchema.parse(parsedJson);
    const inputTokens = Math.max(0, Number(json.usage?.prompt_tokens || 0));
    const outputTokens = Math.max(0, Number(json.usage?.completion_tokens || 0));
    const totalTokens = Math.max(inputTokens + outputTokens, Number(json.usage?.total_tokens || 0));
    const costThb = credential.billingMode === "SYSTEM"
      ? calculateLlmCostThb({ modelId: credential.modelId, inputTokens, outputTokens })
      : 0;

    await prisma.llmUsageEvent.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        provider: "groq",
        modelId: credential.modelId,
        category: "AI_ANALYZER",
        inputTokens,
        outputTokens,
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
      analysis,
      provider: "groq",
      modelId: credential.modelId,
      billingMode: credential.billingMode,
      usage: { inputTokens, outputTokens, totalTokens, costThb },
    };
  } catch (error) {
    if (reservation && wallet) await wallet.refund(reservation.reservationId, "Analyzer request failed").catch(() => undefined);
    throw error;
  }
}
