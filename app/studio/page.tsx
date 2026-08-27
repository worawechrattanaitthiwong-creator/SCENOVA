"use client";

import dynamic from "next/dynamic";

const ScenovaStudioV3 = dynamic(
  () => import("@/components/scenova-studio-v3"),
  {
    ssr: false,
    loading: () => (
      <div style={{ padding: "2rem", minHeight: "50vh" }}>
        Opening SCENOVA Studio...
      </div>
    ),
  },
);

export default function StudioPage() {
  return <ScenovaStudioV3 />;
}
