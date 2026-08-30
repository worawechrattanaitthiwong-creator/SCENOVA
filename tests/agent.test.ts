import { describe, expect, it } from "vitest";
import { decideAgentRecovery } from "@/lib/agent/recovery";
import { normalizeRunBudget } from "@/lib/agent/policy";
import { assertAgentToolAllowed } from "@/lib/agent/tools";
import type { AgentRunRecord } from "@/lib/agent/types";
import { FILM_WORKFLOW_TASKS, handoffEnvelopeSchema } from "@/lib/agent/contracts";
import { deterministicRoleArtifact } from "@/lib/agent/role-runtime";
import type { Project } from "@/lib/domain";

function run(overrides: Partial<AgentRunRecord> = {}): AgentRunRecord {
  const now = new Date();
  return {
    id: "run-1", userId: "user-1", mode: "test", status: "RUNNING", stage: "GENERATE", inputJson: {}, planJson: null, stateJson: {},
    budgetThb: 500, estimatedSpendThb: 100, actualSpendThb: 0, approvalThresholdThb: 150, maxEpisodes: 1, stopReason: null,
    startedAt: now, finishedAt: null, createdAt: now, updatedAt: now, ...overrides,
  };
}

describe("agent guardrails", () => {
  it("hard caps a requested run budget", () => {
    expect(normalizeRunBudget(999999)).toBeLessThanOrEqual(2000);
  });

  it("requires a credit reservation before generation", () => {
    expect(() => assertAgentToolAllowed({ run: run(), tool: "generate_video", requestedSpendThb: 10, providerId: "mock-seedance" })).toThrow("CREDIT_RESERVATION_REQUIRED");
  });

  it("requires human approval when estimated spend crosses threshold", () => {
    expect(() => assertAgentToolAllowed({
      run: run({ estimatedSpendThb: 200 }), tool: "generate_video", requestedSpendThb: 10, providerId: "mock-seedance",
      creditReservationId: "mock-reservation", creditReservationMode: "mock", approvedBudgetThb: 0,
    })).toThrow("AGENT_APPROVAL_REQUIRED");
  });
});

describe("agent recovery policy", () => {
  it("stops on budget guardrail failures", () => {
    expect(decideAgentRecovery({ error: new Error("AGENT_RUN_BUDGET_EXCEEDED"), attempt: 1, maxRetries: 2, providerSwitches: 0, maxProviderSwitches: 1 }).action).toBe("STOP");
  });

  it("retries transient failures with backoff", () => {
    const result = decideAgentRecovery({ error: new Error("provider timeout"), attempt: 1, maxRetries: 2, providerSwitches: 0, maxProviderSwitches: 1 });
    expect(result.action).toBe("RETRY");
    expect(result.delayMs).toBeGreaterThan(0);
  });
});

function project(): Project {
  return {
    id: "project-1", title: "Test Film", story: "A short test story", genre: "Drama", mood: "Hopeful", aspectRatio: "16:9",
    episodeCount: 1, mainModelId: "mock-seedance", modelMode: "single", promptMode: "strict", resolution: "720p", styleId: "neo-noir",
    locks: { project: true, character: true, style: true, voice: false, location: true, prop: false, canon: true, camera: true, lighting: true, motion: false, model: true },
    projectBible: "The hero never removes the red coat.", canon: ["The coat is red"], characters: [],
    episodes: [{
      id: "episode-1", number: 1, title: "Pilot", duration: 10, synopsis: "The hero enters the city.", status: "ready",
      segments: [{ id: "scene-1", start: 0, end: 10, title: "Arrival", scene: "Night city", location: "Gate", characterIds: [], action: "The hero walks through the gate.", emotion: "determined", lighting: "purple neon", sound: "rain", dialogue: [], cameraShots: [{ id: "shot-1", start: 0, end: 10, shotType: "wide", angle: "eye-level", lensMm: 35, cameraHeight: "eye", movement: "dolly-in", movementSpeed: "slow", focus: "hero", depthOfField: "deep", composition: "centered", foregroundOcclusion: "rain" }] }],
    }],
  };
}

describe("multi-agent workflow contracts", () => {
  it("assigns one owner and artifact contract to every production stage", () => {
    const stages = FILM_WORKFLOW_TASKS.map((task) => task.stage);
    expect(new Set(stages).size).toBe(stages.length);
    expect(FILM_WORKFLOW_TASKS.map((task) => task.agentKey)).toContain("SCRIPT_EDITOR");
    expect(FILM_WORKFLOW_TASKS.map((task) => task.artifactType)).toContain("FINAL_QUALITY_REPORT");
  });

  it("validates explicit handoff envelopes", () => {
    const parsed = handoffEnvelopeSchema.parse({
      runId: "run-1", workflowId: "workflow-1", fromTaskId: "writer", toTaskId: "editor",
      artifactId: "artifact-1", artifactType: "SCRIPT_DRAFT", artifactVersion: 2, scopeKey: "episode:0",
    });
    expect(parsed.contractVersion).toBe(1);
    expect(parsed.artifactType).toBe("SCRIPT_DRAFT");
  });

  it("creates deterministic specialist artifacts when LLM is unavailable", () => {
    const input = project();
    const script = deterministicRoleArtifact("SCRIPT_WRITER", input, input.episodes[0]);
    const camera = deterministicRoleArtifact("CINEMATOGRAPHER", input, input.episodes[0]);
    expect(script.verdict).toBe("PASS");
    expect(Array.isArray(script.payload.scenes)).toBe(true);
    expect(camera.verdict).toBe("PASS");
    expect(Array.isArray(camera.payload.shots)).toBe(true);
  });
});
