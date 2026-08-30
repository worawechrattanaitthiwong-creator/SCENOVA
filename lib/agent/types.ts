export type AgentStage =
  | "PLAN_STORY"
  | "STORY_ARCHITECT"
  | "SCRIPT_WRITE"
  | "SCRIPT_EDIT"
  | "DIRECT_SCENES"
  | "PLAN_CINEMATOGRAPHY"
  | "SELECT_STYLE"
  | "BUILD_PROMPTS"
  | "STORYBOARD"
  | "AWAIT_APPROVAL"
  | "GENERATE"
  | "VERIFY_CONTINUITY"
  | "POST_PRODUCTION"
  | "FINAL_QUALITY"
  | "NEXT_EPISODE"
  | "COMPLETED"
  | "FAILED";

export type AgentRunStatus = "QUEUED" | "RUNNING" | "WAITING_APPROVAL" | "PAUSED" | "COMPLETED" | "FAILED" | "CANCELLED";
export type AgentToolName =
  | "plan_episode"
  | "architect_story"
  | "write_script"
  | "edit_script"
  | "direct_scenes"
  | "plan_cinematography"
  | "select_style"
  | "improve_prompt"
  | "create_storyboard"
  | "generate_video"
  | "verify_continuity"
  | "plan_post_production"
  | "quality_check"
  | "switch_provider"
  | "request_approval"
  | "pause_run";

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
  heartbeatAt: Date | null;
  leaseExpiresAt: Date | null;
  idempotencyKey: string;
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
  maxLlmCallsPerRun: number;
  maxLlmCallsPerClip: number;
  maxConcurrentRunsPerUser: number;
  queueLeaseSeconds: number;
};
