import AgentControlCenter from "@/components/agent-control-center";
import AgentJobStatusDock from "@/components/agent-job-status-dock";
import AgentLocalNav from "@/components/agent-local-nav";
import AgentQuickRecovery from "@/components/agent-quick-recovery";
import AgentRunModelEditor from "@/components/agent-run-model-editor";
import AgentRuntimeStatus from "@/components/agent-runtime-status";
import styles from "./agent-page.module.css";

export default function AgentPage() {
  return <div className={styles.root} data-sc-agent-page>
    <AgentLocalNav />
    <AgentRuntimeStatus />
    <AgentRunModelEditor />
    <AgentControlCenter />
    <AgentQuickRecovery />
    <AgentJobStatusDock />
  </div>;
}
