"use client";

import dynamic from "next/dynamic";

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
  return <SingleEpisodeStudio />;
}
