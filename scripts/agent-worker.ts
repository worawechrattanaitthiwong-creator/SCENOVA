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

  const [{ runAgentWorkerOnce }, { getEmergencySecurityState }] = await Promise.all([
    import("@/lib/agent/worker-runtime"),
    import("@/lib/emergency-security"),
  ]);
  const baseWorkerId = process.env.AGENT_WORKER_ID || `agent-worker-${randomUUID().slice(0, 8)}`;
  const pollMs = Math.max(250, Number(process.env.AGENT_WORKER_POLL_MS || 1000));
  const concurrency = Math.max(1, Math.min(8, Math.floor(Number(process.env.AGENT_WORKER_CONCURRENCY || 2))));

  async function lane(index: number) {
    const workerId = `${baseWorkerId}:${index + 1}`;
    console.log(`[SCENOVA] Agent worker lane started: ${workerId}`);
    while (!stopping) {
      try {
        const emergency = await getEmergencySecurityState();
        if (emergency.lockdownEnabled || emergency.queuePaused || emergency.agentDisabled) {
          await sleep(Math.max(1000, pollMs));
          continue;
        }
        const worked = await runAgentWorkerOnce(workerId);
        if (!worked && !stopping) await sleep(pollMs);
      } catch (error) {
        console.error(`[SCENOVA] Agent worker lane ${workerId} error`, error);
        if (!stopping) await sleep(Math.max(2000, pollMs));
      }
    }
  }

  console.log(`[SCENOVA] Agent worker started: ${baseWorkerId} · concurrency=${concurrency}`);
  await Promise.all(Array.from({ length: concurrency }, (_, index) => lane(index)));
  console.log(`[SCENOVA] Agent worker stopped: ${baseWorkerId}`);
}

void main().catch((error) => {
  console.error("[SCENOVA] Agent worker fatal error", error);
  process.exitCode = 1;
});
