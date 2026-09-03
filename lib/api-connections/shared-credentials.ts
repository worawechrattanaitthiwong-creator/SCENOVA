import type { ApiConnectionKind, SafeApiConnection } from "@/lib/api-connections/store";

export type SharedCredentialTarget = {
  provider: string;
  kind: ApiConnectionKind;
  defaultModelId: string;
  baseUrl: string;
  sources: Array<{ provider: string; kind: ApiConnectionKind }>;
};

/**
 * Credential-sharing is intentionally explicit. A shared route means the
 * provider uses the same account/API-key format and SCENOVA already has a
 * compatible adapter for the target pipeline. Video-with-native-audio is not
 * treated as TTS/VOICE unless a real voice adapter exists.
 */
export const SHARED_CREDENTIAL_TARGETS: readonly SharedCredentialTarget[] = [
  {
    provider: "runway-image",
    kind: "IMAGE",
    defaultModelId: "gpt_image_2",
    baseUrl: "https://api.dev.runwayml.com/v1",
    sources: [{ provider: "runway", kind: "VIDEO" }],
  },
  {
    provider: "gemini-image",
    kind: "IMAGE",
    defaultModelId: "gemini-3.1-flash-image",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    sources: [
      { provider: "gemini", kind: "ANALYZER" },
      { provider: "veo", kind: "VIDEO" },
    ],
  },
  {
    provider: "openai-image",
    kind: "IMAGE",
    defaultModelId: "gpt-image-2",
    baseUrl: "https://api.openai.com/v1",
    sources: [{ provider: "openai-voice", kind: "VOICE" }],
  },
  {
    provider: "openai-voice",
    kind: "VOICE",
    defaultModelId: "gpt-4o-mini-tts",
    baseUrl: "https://api.openai.com/v1",
    sources: [{ provider: "openai-image", kind: "IMAGE" }],
  },
] as const;

export type SharedSafeApiConnection = SafeApiConnection & {
  virtual: true;
  sharedFromConnectionId: string;
  sharedFromProvider: string;
};

export function getSharedCredentialTarget(provider: string, kind: ApiConnectionKind) {
  return SHARED_CREDENTIAL_TARGETS.find((target) => target.provider === provider && target.kind === kind) || null;
}

export function getSharedCredentialTargetsForKind(kind: ApiConnectionKind) {
  return SHARED_CREDENTIAL_TARGETS.filter((target) => target.kind === kind);
}

export function buildSharedApiConnections(connections: SafeApiConnection[]): SharedSafeApiConnection[] {
  const result: SharedSafeApiConnection[] = [];

  for (const target of SHARED_CREDENTIAL_TARGETS) {
    const hasExact = connections.some((connection) => connection.provider === target.provider && connection.kind === target.kind);
    if (hasExact) continue;

    for (const source of target.sources) {
      const sourceConnections = connections.filter((connection) =>
        connection.provider === source.provider
        && connection.kind === source.kind
        && connection.enabled
        && connection.status === "CONNECTED",
      );

      for (const connection of sourceConnections) {
        result.push({
          ...connection,
          id: `shared:${connection.id}:${target.provider}`,
          provider: target.provider,
          kind: target.kind,
          modelId: target.defaultModelId,
          enabledModelIds: [target.defaultModelId],
          availableModels: [{ apiModelId: target.defaultModelId, label: target.defaultModelId, recommended: true, availability: "UNVERIFIED" }],
          baseUrl: target.baseUrl,
          isDefault: false,
          virtual: true,
          sharedFromConnectionId: connection.id,
          sharedFromProvider: connection.provider,
        });
      }
    }
  }

  return result;
}
