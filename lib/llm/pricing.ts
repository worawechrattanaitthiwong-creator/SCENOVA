export type LlmPrice = {
  inputUsdPerMillion: number;
  cachedInputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

const DEFAULT_PRICES: Record<string, LlmPrice> = {
  "gpt-5.6-luna": { inputUsdPerMillion: 0.2, cachedInputUsdPerMillion: 0.02, outputUsdPerMillion: 1.2 },
  "gpt-5.6-terra": { inputUsdPerMillion: 2, cachedInputUsdPerMillion: 0.2, outputUsdPerMillion: 12 },
  "gpt-5.6-sol": { inputUsdPerMillion: 4, cachedInputUsdPerMillion: 0.4, outputUsdPerMillion: 20 },
  "gpt-5.6": { inputUsdPerMillion: 4, cachedInputUsdPerMillion: 0.4, outputUsdPerMillion: 20 },
};

function envPrice(modelId: string, base: LlmPrice) {
  const prefix = `LLM_PRICE_${modelId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  const value = (name: string, fallback: number) => {
    const parsed = Number(process.env[`${prefix}_${name}`]);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  return {
    inputUsdPerMillion: value("INPUT_USD_PER_M", base.inputUsdPerMillion),
    cachedInputUsdPerMillion: value("CACHED_INPUT_USD_PER_M", base.cachedInputUsdPerMillion),
    outputUsdPerMillion: value("OUTPUT_USD_PER_M", base.outputUsdPerMillion),
  };
}

export function getLlmPrice(modelId: string): LlmPrice {
  const base = DEFAULT_PRICES[modelId] || {
    inputUsdPerMillion: Number(process.env.LLM_DEFAULT_INPUT_USD_PER_M || 1),
    cachedInputUsdPerMillion: Number(process.env.LLM_DEFAULT_CACHED_INPUT_USD_PER_M || 0.1),
    outputUsdPerMillion: Number(process.env.LLM_DEFAULT_OUTPUT_USD_PER_M || 5),
  };
  return envPrice(modelId, base);
}

export function calculateLlmCostThb(input: { modelId: string; inputTokens: number; cachedInputTokens?: number; outputTokens: number }) {
  const price = getLlmPrice(input.modelId);
  const cached = Math.max(0, Math.min(input.inputTokens, input.cachedInputTokens || 0));
  const uncached = Math.max(0, input.inputTokens - cached);
  const usd = (uncached / 1_000_000) * price.inputUsdPerMillion
    + (cached / 1_000_000) * price.cachedInputUsdPerMillion
    + (Math.max(0, input.outputTokens) / 1_000_000) * price.outputUsdPerMillion;
  const usdThb = Number(process.env.SCENOVA_USD_THB_RATE || 33);
  return Number((usd * (Number.isFinite(usdThb) && usdThb > 0 ? usdThb : 33)).toFixed(6));
}
