import type { ApiConnectionKind, SafeApiConnection } from "@/lib/api-connections/store";
import { getDefaultUserApiConnectionSecret, getUserApiConnectionSecret } from "@/lib/api-connections/store";

export type ApiRouteStageId = "A" | "B" | "C" | "D";

export type ApiRouteStage = {
  id: ApiRouteStageId;
  kind: ApiConnectionKind;
  labelTh: string;
  shortTh: string;
  descriptionTh: string;
  optional: boolean;
};

export const API_ROUTE_STAGES: readonly ApiRouteStage[] = [
  {
    id: "A",
    kind: "ANALYZER",
    labelTh: "A · วิเคราะห์คำสั่ง",
    shortTh: "Analyzer",
    descriptionTh: "อ่านคำสั่งและ Locks แล้วสร้าง Structured JSON กลางให้ทุก Generator ใช้ต่อ",
    optional: false,
  },
  {
    id: "B",
    kind: "IMAGE",
    labelTh: "B · ภาพและ Reference",
    shortTh: "Image / Reference",
    descriptionTh: "สร้างหรือเตรียมภาพอ้างอิงก่อนส่งเข้าโมเดลวิดีโอเมื่อ Workflow ต้องใช้",
    optional: true,
  },
  {
    id: "C",
    kind: "VIDEO",
    labelTh: "C · สร้างคลิป",
    shortTh: "Video Generator",
    descriptionTh: "รับ Prompt ที่ Compile แล้วเพื่อสร้างคลิปจริง เช่น Seedance, Kling, Veo, Runway หรือ Wan",
    optional: false,
  },
  {
    id: "D",
    kind: "VOICE",
    labelTh: "D · เสียงและพากย์",
    shortTh: "Voice / TTS",
    descriptionTh: "สร้างเสียงพูดหรือเสียงประกอบเมื่อโปรเจกต์เลือกใช้ Provider เสียงภายนอก",
    optional: true,
  },
] as const;

export function getApiRouteStage(kind: ApiConnectionKind) {
  return API_ROUTE_STAGES.find((stage) => stage.kind === kind) || null;
}

export function buildApiRoutingSnapshot(connections: SafeApiConnection[]) {
  return API_ROUTE_STAGES.map((stage) => {
    const stageConnections = connections.filter((connection) => connection.kind === stage.kind);
    const active = stageConnections.find((connection) => connection.enabled && connection.isDefault)
      || stageConnections.find((connection) => connection.enabled)
      || null;

    return {
      ...stage,
      connectionCount: stageConnections.length,
      activeConnectionId: active?.id || null,
      activeProvider: active?.provider || null,
      activeStatus: active?.status || null,
      ready: Boolean(active && active.enabled && active.status === "CONNECTED"),
    };
  });
}

/**
 * Server-only credential resolver used by future image/video/voice adapters.
 * Secrets never leave the server. Preferred provider is honored only when the
 * user has an enabled connection for the requested pipeline kind.
 */
export async function resolveUserPipelineCredential(input: {
  userId: string;
  kind: ApiConnectionKind;
  preferredProvider?: string | null;
}) {
  const preferredProvider = input.preferredProvider?.trim().toLowerCase();
  if (preferredProvider) {
    const preferred = await getUserApiConnectionSecret({
      userId: input.userId,
      provider: preferredProvider,
      kind: input.kind,
    });
    if (preferred) return preferred;
  }
  return getDefaultUserApiConnectionSecret(input.userId, input.kind);
}
