import type { GenerateVideoRequest, ProviderBillingMode } from "@/lib/providers/video-provider";

export function buildCompiledVideoPrompt(request: GenerateVideoRequest) {
  return [
    request.prompt.master,
    request.prompt.episode,
    request.prompt.shots.join("\n"),
    request.prompt.negative ? `NEGATIVE / AVOID:\n${request.prompt.negative}` : "",
    `Requested segment: ${request.renderSegment.start}-${request.renderSegment.end}s. Preserve every character, style, voice, location, prop, canon, camera and continuity lock supplied by SCENOVA.`,
  ].filter(Boolean).join("\n\n").trim();
}

export function byokAwareEstimate(billingMode: ProviderBillingMode | undefined, systemAmountThb: number) {
  return {
    currency: "THB" as const,
    estimatedAmount: billingMode === "BYOK" ? 0 : Number(Math.max(0, systemAmountThb).toFixed(4)),
  };
}

export function normalizedAspectRatio(value?: string) {
  if (value === "9:16" || value === "1:1" || value === "4:5") return value;
  return "16:9";
}

export function ratioToLandscapePortrait(value?: string) {
  return value === "9:16" || value === "4:5" ? "9:16" : "16:9";
}

export function runwayRatio(value?: string) {
  return value === "9:16" || value === "4:5" ? "720:1280" : "1280:720";
}

export function wanSize(value?: string) {
  if (value === "9:16" || value === "4:5") return "720*1280";
  if (value === "1:1") return "1024*1024";
  return "1280*720";
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export function errorMessage(value: unknown) {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "string") return record.error;
  const error = asRecord(record.error);
  if (typeof error.message === "string") return error.message;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
