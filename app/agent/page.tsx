import AgentControlCenter from "@/components/agent-control-center";
import AgentJobStatusDock from "@/components/agent-job-status-dock";
import AgentLocalNav from "@/components/agent-local-nav";
import AgentRunModelEditor from "@/components/agent-run-model-editor";
import AgentRuntimeMonitor from "@/components/agent-runtime-monitor";
import styles from "./agent-page.module.css";

export default function AgentPage() {
  return <div className={styles.root} data-sc-agent-page>
    <AgentLocalNav />
    <AgentRuntimeMonitor />
    <AgentRunModelEditor />
    <AgentControlCenter />
    <AgentJobStatusDock />
  </div>;
}
