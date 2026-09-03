import AgentLocalNav from "@/components/agent-local-nav";
import AgentPlannerWorkspace from "@/components/agent-planner-workspace";
import styles from "./agent-page.module.css";

export default function AgentPage() {
  return <div className={styles.root} data-sc-agent-page>
    <AgentLocalNav />
    <AgentPlannerWorkspace />
  </div>;
}
