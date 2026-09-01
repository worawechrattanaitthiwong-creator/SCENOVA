export type VideoModelVersion = {
  id: string;
  label: string;
  apiModelId: string;
  note: string;
  recommended?: boolean;
};

export const VIDEO_MODEL_VERSIONS: Record<string, VideoModelVersion[]> = {
  "Seedance 2.5": [
    { id: "seedance-2.5", label: "Seedance 2.5", apiModelId: "dreamina-seedance-2-5-260628", note: "คุณภาพหลัก · Multimodal", recommended: true },
    { id: "seedance-2.0-fast", label: "Seedance 2.0 Fast", apiModelId: "dreamina-seedance-2-0-fast-260128", note: "เน้นความเร็ว" },
    { id: "seedance-2.0-mini", label: "Seedance 2.0 Mini", apiModelId: "dreamina-seedance-2-0-mini-260615", note: "ประหยัดสำหรับ Preview" },
  ],
  Kling: [
    { id: "kling-v3", label: "Kling V3", apiModelId: "kling-v3", note: "รุ่นหลัก · Motion / Multi-shot", recommended: true },
    { id: "kling-v3-turbo", label: "Kling V3 Turbo", apiModelId: "kling-v3-turbo", note: "เร็วกว่า" },
    { id: "kling-v2-6", label: "Kling V2.6", apiModelId: "kling-v2-6", note: "รุ่นเสถียรพร้อมเสียง" },
  ],
  Veo: [
    { id: "veo-3.1-lite", label: "Veo 3.1 Lite", apiModelId: "veo-3.1-lite-generate-preview", note: "ประหยัด · ค่าเริ่มต้นสำหรับทดสอบ API", recommended: true },
    { id: "veo-3.1-fast", label: "Veo 3.1 Fast", apiModelId: "veo-3.1-fast-generate-preview", note: "สมดุลความเร็วและคุณภาพ" },
    { id: "veo-3.1-standard", label: "Veo 3.1 Standard", apiModelId: "veo-3.1-generate-preview", note: "คุณภาพสูง" },
  ],
  Runway: [
    { id: "runway-gen4.5", label: "Runway Gen-4.5", apiModelId: "gen4.5", note: "รุ่นหลัก · Text / Image to Video", recommended: true },
    { id: "runway-gen4-turbo", label: "Runway Gen-4 Turbo", apiModelId: "gen4_turbo", note: "เร็วและประหยัดกว่า · เหมาะกับ Image to Video" },
  ],
  Wan: [
    { id: "wan3-standard", label: "Wan 3.0 Standard", apiModelId: "wan3.0-video", note: "ประหยัด · All-in-One", recommended: true },
    { id: "wan3-prime", label: "Wan 3.0 Prime", apiModelId: "wan3.0-video-prime", note: "รุ่นเร่งความเร็ว" },
  ],
};

export function getVideoModelVersions(modelName: string) {
  return VIDEO_MODEL_VERSIONS[modelName] || [];
}

export function getDefaultVideoModelVersion(modelName: string) {
  const versions = getVideoModelVersions(modelName);
  return versions.find((item) => item.recommended) || versions[0];
}

export function getDefaultVideoModelVersionId(modelName: string) {
  return getDefaultVideoModelVersion(modelName)?.apiModelId || "";
}

export function resolveVideoApiModelId(modelName: string, selected?: string | null) {
  if (!selected) return undefined;
  const version = getVideoModelVersions(modelName).find((item) => item.apiModelId === selected || item.id === selected);
  return version?.apiModelId;
}

export function getVideoModelVersionLabel(modelName: string, selected?: string | null) {
  if (!selected) return "Provider default";
  const version = getVideoModelVersions(modelName).find((item) => item.apiModelId === selected || item.id === selected);
  return version?.label || selected;
}
