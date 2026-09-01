import { randomUUID } from "crypto";
import nextEnv from "@next/env";

let stopping = false;

function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[SCENOVA] ${signal} received. Agent worker will stop after active jobs finish.`);
}

process.once("SIGTERM", () => stop("SIGTERM"));
process.once("SIGINT", () => stop("SIGINT"));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const isProduction = process.env.NODE_ENV === "production";
  const { loadEnvConfig } = nextEnv;
  loadEnvConfig(process.cwd(), !isProduction);

  const [{ runAgentWorkerOnce }, { getEmergencySecurityState }, { repairOrphanedAgentRuns }, { writeAgentWorkerHeartbeat }] = await Promise.all([
    import("@/lib/agent/worker-runtime"),
    import("@/lib/emergency-security"),
    import("@/lib/agent/runtime-health"),
    import("@/lib/agent/worker-heartbeat"),
  ]);
  const baseWorkerId = process.env.AGENT_WORKER_ID || `agent-worker-${randomUUID().slice(0, 8)}`;
  const pollMs = Math.max(250, Number(process.env.AGENT_WORKER_POLL_MS || 1000));
  const concurrency = Math.max(1, Math.min(8, Math.floor(Number(process.env.AGENT_WORKER_CONCURRENCY || 2))));
  let lastGateReason = "";
  let lastRepairAt = 0;
  let repairingQueue = false;
  let activeLanes = 0;
  let lastJobAt: string | null = null;
  let lastError: string | null = null;

  async function publishHeartbeat(stateOverride?: "starting" | "idle" | "working" | "blocked" | "error" | "stopping") {
    const state = stateOverride || (lastGateReason ? "blocked" : activeLanes > 0 ? "working" : lastError ? "error" : "idle");
    await writeAgentWorkerHeartbeat({
      workerId: baseWorkerId,
      pid: process.pid,
      state,
      activeLanes,
      concurrency,
      reason: lastGateReason || null,
      lastJobAt,
      lastError,
      updatedAt: new Date().toISOString(),
    });
  }

  async function repairQueueIfNeeded(force = false) {
    const now = Date.now();
    if (repairingQueue || (!force && now - lastRepairAt < 10_000)) return 0;
    repairingQueue = true;
    lastRepairAt = now;
    try {
      const repaired = await repairOrphanedAgentRuns(50);
      if (repaired > 0) console.log(`[SCENOVA] Agent worker repaired ${repaired} orphaned run queue(s).`);
      return repaired;
    } finally {
      repairingQueue = false;
    }
  }

  async function lane(index: number) {
    const workerId = `${baseWorkerId}:${index + 1}`;
    console.log(`[SCENOVA] Agent worker lane started: ${workerId}`);
    while (!stopping) {
      try {
        const emergency = await getEmergencySecurityState();
        const gateReason = emergency.lockdownEnabled
          ? `LOCKDOWN${emergency.reason ? `: ${emergency.reason}` : ""}`
          : emergency.agentDisabled
            ? `AGENT_DISABLED${emergency.reason ? `: ${emergency.reason}` : ""}`
            : emergency.queuePaused
              ? `QUEUE_PAUSED${emergency.reason ? `: ${emergency.reason}` : ""}`
              : "";

        if (gateReason) {
          if (gateReason !== lastGateReason) {
            lastGateReason = gateReason;
            console.warn(`[SCENOVA] Agent worker paused by security control: ${gateReason}`);
          }
          lastError = null;
          await sleep(Math.max(1000, pollMs));
          continue;
        }

        if (lastGateReason) {
          console.log(`[SCENOVA] Agent worker security gate cleared. Resuming queue processing.`);
          lastGateReason = "";
          lastError = null;
          await repairQueueIfNeeded(true);
        }

        activeLanes += 1;
        let worked = false;
        try {
          worked = await runAgentWorkerOnce(workerId);
          if (worked) {
            lastJobAt = new Date().toISOString();
            lastError = null;
          }
        } finally {
          activeLanes = Math.max(0, activeLanes - 1);
        }

        if (!worked && !stopping) {
          await repairQueueIfNeeded(false);
          await sleep(pollMs);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error(`[SCENOVA] Agent worker lane ${workerId} error`, error);
        if (!stopping) await sleep(Math.max(2000, pollMs));
      }
    }
  }

  const repairedOnBoot = await repairQueueIfNeeded(true).catch((error) => {
    lastError = error instanceof Error ? error.message : String(error);
    console.error("[SCENOVA] Agent queue boot repair failed", error);
    return 0;
  });
  await publishHeartbeat("starting").catch(() => undefined);
  const heartbeatTimer = setInterval(() => {
    void publishHeartbeat().catch((error) => console.error("[SCENOVA] Agent worker heartbeat file write failed", error));
  }, 2000);
  heartbeatTimer.unref?.();

  console.log(`[SCENOVA] Agent worker started: ${baseWorkerId} · concurrency=${concurrency} · bootRepair=${repairedOnBoot}`);
  await Promise.all(Array.from({ length: concurrency }, (_, index) => lane(index)));
  clearInterval(heartbeatTimer);
  await publishHeartbeat("stopping").catch(() => undefined);
  console.log(`[SCENOVA] Agent worker stopped: ${baseWorkerId}`);
}

void main().catch((error) => {
  console.error("[SCENOVA] Agent worker fatal error", error);
  process.exitCode = 1;
});
