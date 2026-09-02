import { VIDEO_MODELS } from "@/lib/catalogs";
import type { GenerateVideoRequest, GenerateVideoResult, VideoProvider } from "@/lib/providers/video-provider";

const tasks = new Map<string, GenerateVideoResult>();

function completedMock(providerTaskId: string): GenerateVideoResult {
  return {
    providerTaskId,
    status: "completed",
    outputUrl: `/api/mock-video?task=${encodeURIComponent(providerTaskId)}`,
    lastFrameUrl: `/api/mock-video?task=${encodeURIComponent(providerTaskId)}&frame=last`,
  };
}

export class MockVideoProvider implements VideoProvider {
  id = "mock-seedance";

  getModelDefinition() {
    return VIDEO_MODELS.find((model) => model.id === "seedance-2-5") ?? VIDEO_MODELS[0];
  }

  async estimateCost(request: GenerateVideoRequest) {
    const seconds = request.renderSegment.duration;
    const multiplier = request.resolution === "720p" ? 2.2 : request.resolution === "1080p" ? 3.5 : 1;
    return { currency: "THB" as const, estimatedAmount: Number((seconds * 2.5 * multiplier).toFixed(2)) };
  }

  async generate(request: GenerateVideoRequest) {
    const providerTaskId = `mock_${request.idempotencyKey}`;
    const result: GenerateVideoResult = { providerTaskId, status: "queued" };
    tasks.set(providerTaskId, result);
    return result;
  }

  async getStatus(providerTaskId: string) {
    const task = tasks.get(providerTaskId);
    // Agent mock IDs are deterministic. Reconstructing the completed result makes local/dev runs resumable after a worker restart.
    if (!task && (providerTaskId.startsWith("mock_agent:") || providerTaskId.startsWith("mock_video-generation-v2:"))) return completedMock(providerTaskId);
    if (!task) return { providerTaskId, status: "failed" as const, error: "Mock task not found" };
    if (task.status === "queued" || task.status === "generating") {
      const result = completedMock(providerTaskId);
      tasks.set(providerTaskId, result);
      return result;
    }
    return task;
  }

  async cancel(providerTaskId: string) {
    const task = tasks.get(providerTaskId);
    if (!task && (providerTaskId.startsWith("mock_agent:") || providerTaskId.startsWith("mock_video-generation-v2:"))) return true;
    if (!task) return false;
    tasks.set(providerTaskId, { ...task, status: "failed", error: "Cancelled in mock provider" });
    return true;
  }
}
