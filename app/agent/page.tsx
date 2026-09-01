import AgentControlCenter from "@/components/agent-control-center";
import AgentLocalNav from "@/components/agent-local-nav";
import AgentRuntimeStatus from "@/components/agent-runtime-status";
import styles from "./agent-page.module.css";

export default function AgentPage() {
  return <div className={styles.root} data-sc-agent-page>
    <AgentLocalNav />
    <AgentRuntimeStatus />
    <AgentControlCenter />
  </div>;
}