export type AgentStage =
  | "PLAN_STORY"
  | "SELECT_STYLE"
  | "BUILD_PROMPTS"
  | "AWAIT_APPROVAL"
  | "GENERATE"
  | "VERIFY_CONTINUITY"
  | "NEXT_EPISODE"
  | "COMPLETED"
  | "FAILED";

export type AgentRunStatus = "QUEUED" | "RUNNING" | "WAITING_APPROVAL" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";
export type AgentToolName = "plan_episode" | "select_style" | "improve_prompt" | "generate_video" | "verify_continuity" | "switch_provider" | "request_approval" | "pause_run";

export type AgentRunRecord = {
  id: string;
  userId: string;
  mode: string;
  status: AgentRunStatus;
  stage: AgentStage;
  inputJson: unknown;
  planJson: unknown | null;
  stateJson: Record<string, unknown>;
  budgetThb: number;
  estimatedSpendThb: number;
  actualSpendThb: number;
  approvalThresholdThb: number;
  maxEpisodes: number;
  stopReason: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentQueueJobRecord = {
  id: string;
  runId: string;
  kind: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  payloadJson: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  lockedBy: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentPolicy = {
  defaultRunBudgetThb: number;
  hardRunBudgetThb: number;
  approvalThresholdThb: number;
  maxEpisodesPerRun: number;
  maxRetriesPerStep: number;
  maxProviderSwitches: number;
};
