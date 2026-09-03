import type { ApiConnectionKind, SafeApiConnection } from "@/lib/api-connections/store";
import { getDefaultUserApiConnectionSecret, getUserApiConnectionSecret } from "@/lib/api-connections/store";
import {
  buildSharedApiConnections,
  getSharedCredentialTarget,
  getSharedCredentialTargetsForKind,
} from "@/lib/api-connections/shared-credentials";

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
  const sharedConnections = buildSharedApiConnections(connections);
  const allConnections = [...connections, ...sharedConnections];

  return API_ROUTE_STAGES.map((stage) => {
    const stageConnections = allConnections.filter((connection) => connection.kind === stage.kind);
    const active = stageConnections.find((connection) => connection.enabled && connection.isDefault)
      || stageConnections.find((connection) => connection.enabled && connection.status === "CONNECTED")
      || stageConnections.find((connection) => connection.enabled)
      || null;

    return {
      ...stage,
      connectionCount: stageConnections.length,
      activeConnectionId: active?.id || null,
      activeProvider: active?.provider || null,
      activeStatus: active?.status || null,
      ready: Boolean(active && active.enabled && active.status === "CONNECTED"),
      sharedConnectionCount: stageConnections.filter((connection) => "virtual" in connection && connection.virtual === true).length,
    };
  });
}

function asSharedTargetCredential<T extends Awaited<ReturnType<typeof getUserApiConnectionSecret>>>(
  credential: NonNullable<T>,
  target: NonNullable<ReturnType<typeof getSharedCredentialTarget>>,
) {
  return {
    ...credential,
    connection: {
      ...credential.connection,
      provider: target.provider,
      kind: target.kind,
      modelId: target.defaultModelId,
      enabledModelIds: [target.defaultModelId],
      availableModels: [{ apiModelId: target.defaultModelId, label: target.defaultModelId, recommended: true, availability: "UNVERIFIED" as const }],
      baseUrl: target.baseUrl,
      isDefault: false,
    },
  };
}

async function resolveSharedCredential(input: {
  userId: string;
  kind: ApiConnectionKind;
  preferredProvider?: string | null;
}) {
  const targets = input.preferredProvider
    ? [getSharedCredentialTarget(input.preferredProvider, input.kind)].filter(Boolean)
    : getSharedCredentialTargetsForKind(input.kind);

  for (const target of targets) {
    if (!target) continue;
    for (const source of target.sources) {
      const credential = await getUserApiConnectionSecret({
        userId: input.userId,
        provider: source.provider,
        kind: source.kind,
      });
      if (credential && credential.connection.status === "CONNECTED" && credential.connection.enabled) {
        return asSharedTargetCredential(credential, target);
      }
    }
  }
  return null;
}

/**
 * Server-only credential resolver used by image/video/voice adapters.
 * Secrets never leave the server. Exact connections win. If the target
 * provider is declared as compatible with another SCENOVA provider on the same
 * API platform, the same encrypted credential may be reused without asking the
 * user to store the key a second time.
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

    const sharedPreferred = await resolveSharedCredential({
      userId: input.userId,
      kind: input.kind,
      preferredProvider,
    });
    if (sharedPreferred) return sharedPreferred;
  }

  const directDefault = await getDefaultUserApiConnectionSecret(input.userId, input.kind);
  if (directDefault) return directDefault;

  return resolveSharedCredential({ userId: input.userId, kind: input.kind });
}
