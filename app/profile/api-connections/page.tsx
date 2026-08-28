import type { Metadata } from "next";
import ApiConnectionsPanel from "@/components/api-connections-panel";

export const metadata: Metadata = {
  title: "API & Models — SCENOVA",
  description: "จัดการ System API และ BYOK API Keys สำหรับ Analyzer และ Generator",
};

export default function ApiConnectionsPage() {
  return <ApiConnectionsPanel />;
}
