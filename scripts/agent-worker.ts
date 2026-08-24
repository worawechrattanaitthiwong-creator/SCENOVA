import { randomUUID } from "crypto";
import { runAgentWorkerOnce } from "@/lib/agent/worker-runtime";

const workerId = process.env.AGENT_WORKER_ID || `agent-worker-${randomUUID().slice(0, 8)}`;
const pollMs = Math.max(250, Number(process.env.AGENT_WORKER_POLL_MS || 1000));

console.log(`[SCENOVA] Agent worker started: ${workerId}`);

async function loop() {
  for (;;) {
    try {
      const worked = await runAgentWorkerOnce(workerId);
      if (!worked) await new Promise((resolve) => setTimeout(resolve, pollMs));
    } catch (error) {
      console.error("[SCENOVA] Agent worker loop error", error);
      await new Promise((resolve) => setTimeout(resolve, Math.max(2000, pollMs)));
    }
  }
}

void loop();
