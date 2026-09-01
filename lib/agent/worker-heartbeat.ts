import { readFile, writeFile } from "node:fs/promises";

export type AgentWorkerHeartbeat = {
  workerId: string;
  pid: number;
  state: "starting" | "idle" | "working" | "blocked" | "error" | "stopping";
  activeLanes: number;
  concurrency: number;
  reason: string | null;
  lastJobAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

const heartbeatPath = process.env.SCENOVA_AGENT_HEARTBEAT_FILE || "/tmp/scenova-agent-worker-heartbeat.json";

export async function writeAgentWorkerHeartbeat(value: AgentWorkerHeartbeat) {
  await writeFile(heartbeatPath, JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
}

export async function readAgentWorkerHeartbeat() {
  try {
    const raw = await readFile(heartbeatPath, "utf8");
    const value = JSON.parse(raw) as AgentWorkerHeartbeat;
    const updatedAtMs = new Date(value.updatedAt).getTime();
    const ageMs = Number.isFinite(updatedAtMs) ? Math.max(0, Date.now() - updatedAtMs) : Number.POSITIVE_INFINITY;
    return {
      ...value,
      ageMs,
      online: ageMs <= 10_000 && value.state !== "stopping",
    };
  } catch {
    return null;
  }
}
