import AgentControlCenter from "@/components/agent-control-center";
import AgentLocalNav from "@/components/agent-local-nav";
import AgentRuntimeStatus from "@/components/agent-runtime-status";

export default function AgentPage() {
  return <>
    <AgentLocalNav />
    <AgentRuntimeStatus />
    <AgentControlCenter />
  </>;
}