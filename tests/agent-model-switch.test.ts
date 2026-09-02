import { describe, expect, it } from "vitest";
import type { RenderSegment } from "@/lib/domain";
import { compatibleRenderOrders, safeVideoModelRestartStage } from "@/lib/agent/model-switch";

function segment(order: number, start: number, end: number, sourceSegmentIds = [`source-${order}`]): RenderSegment {
  return {
    id: `render-${order}`,
    episodeId: "episode-1",
    order,
    start,
    end,
    duration: end - start,
    modelId: "veo",
    sourceSegmentIds,
    continuityFromPrevious: order > 1,
  };
}

describe("safe video model switching", () => {
  it("continues creative stages before prompt planning without rewinding them", () => {
    expect(safeVideoModelRestartStage("SCRIPT_WRITE")).toBe("SCRIPT_WRITE");
    expect(safeVideoModelRestartStage("PLAN_CINEMATOGRAPHY")).toBe("PLAN_CINEMATOGRAPHY");
    expect(safeVideoModelRestartStage("SELECT_STYLE")).toBe("SELECT_STYLE");
  });

  it("rebuilds from BUILD_PROMPTS once provider-specific planning has started", () => {
    expect(safeVideoModelRestartStage("BUILD_PROMPTS")).toBe("BUILD_PROMPTS");
    expect(safeVideoModelRestartStage("STORYBOARD")).toBe("BUILD_PROMPTS");
    expect(safeVideoModelRestartStage("AWAIT_APPROVAL")).toBe("BUILD_PROMPTS");
    expect(safeVideoModelRestartStage("GENERATE")).toBe("BUILD_PROMPTS");
    expect(safeVideoModelRestartStage("VERIFY_CONTINUITY")).toBe("BUILD_PROMPTS");
    expect(safeVideoModelRestartStage("POST_PRODUCTION")).toBe("BUILD_PROMPTS");
    expect(safeVideoModelRestartStage("FINAL_QUALITY")).toBe("BUILD_PROMPTS");
  });

  it("keeps NEXT_EPISODE so a new model applies forward without rerendering the completed episode", () => {
    expect(safeVideoModelRestartStage("NEXT_EPISODE")).toBe("NEXT_EPISODE");
  });

  it("uses the failed workflow stage to decide where a failed run can safely restart", () => {
    expect(safeVideoModelRestartStage("FAILED", "GENERATE")).toBe("BUILD_PROMPTS");
    expect(safeVideoModelRestartStage("FAILED", "SCRIPT_EDIT")).toBe("SCRIPT_EDIT");
  });

  it("reuses a shot only when order, time range and source segment still match", () => {
    const previous = [segment(1, 0, 8), segment(2, 8, 16), segment(3, 16, 24)];
    const same = [segment(1, 0, 8), segment(2, 8, 16), segment(3, 16, 24)];
    expect([...compatibleRenderOrders(previous, same)]).toEqual([1, 2, 3]);

    const changedForLongerProvider = [segment(1, 0, 10), segment(2, 10, 20), segment(3, 20, 24)];
    expect([...compatibleRenderOrders(previous, changedForLongerProvider)]).toEqual([]);

    const changedSource = [segment(1, 0, 8, ["different-source"]), segment(2, 8, 16), segment(3, 16, 24)];
    expect([...compatibleRenderOrders(previous, changedSource)]).toEqual([2, 3]);
  });
});
