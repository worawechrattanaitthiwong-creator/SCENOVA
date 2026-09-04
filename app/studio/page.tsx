"use client";

import dynamic from "next/dynamic";
import AgentPlanStudioBridge from "@/components/agent-plan-studio-bridge";
import StudioDirectRenderBridge from "@/components/studio-direct-render-bridge";
import StudioDirectRenderInstant from "@/components/studio-direct-render-instant";

const SingleEpisodeStudio = dynamic(
  () => import("@/components/single-episode-studio"),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: "2rem", minHeight: "50vh" }}>
        กำลังเปิด Single Episode Studio...
      </div>
    ),
  },
);

export default function StudioPage() {
  return <>
    <SingleEpisodeStudio />
    <AgentPlanStudioBridge />
    <StudioDirectRenderBridge />
    <StudioDirectRenderInstant />
  </>;
}
