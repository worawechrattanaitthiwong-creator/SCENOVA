export const AGENT_RUN_SELECTION_EVENT = "scenova:agent-run-selected";

export function readSelectedAgentRunId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("run") || "";
}

export function selectAgentRun(runId: string) {
  if (typeof window === "undefined" || !runId) return;
  const url = new URL(window.location.href);
  if (url.searchParams.get("run") !== runId) {
    url.searchParams.set("run", runId);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
  window.dispatchEvent(new CustomEvent(AGENT_RUN_SELECTION_EVENT, { detail: { runId } }));
}

export function selectedAgentRunIdFromEvent(event: Event) {
  return String((event as CustomEvent<{ runId?: string }>).detail?.runId || "");
}
