import type { ModelDefinition, PromptBundle, RenderSegment, Resolution } from "@/lib/domain";

export type GenerateVideoRequest = {
  projectId: string;
  episodeId: string;
  renderSegment: RenderSegment;
  prompt: PromptBundle;
  resolution: Resolution;
  aspectRatio?: string;
  imageReferences: string[];
  videoReferences: string[];
  audioReferences: string[];
  idempotencyKey: string;
};

export type GenerateVideoResult = {
  providerTaskId: string;
  status: "queued" | "generating" | "completed" | "failed";
  outputUrl?: string;
  lastFrameUrl?: string;
  error?: string;
  usage?: {
    totalTokens?: number;
    outputTokens?: number;
    durationSec?: number;
    resolution?: string;
  };
};

export interface VideoProvider {
  id: string;
  getModelDefinition(): ModelDefinition;
  estimateCost(request: GenerateVideoRequest): Promise<{ currency: "THB"; estimatedAmount: number }>;
  generate(request: GenerateVideoRequest): Promise<GenerateVideoResult>;
  getStatus(providerTaskId: string): Promise<GenerateVideoResult>;
  cancel(providerTaskId: string): Promise<boolean>;
}
