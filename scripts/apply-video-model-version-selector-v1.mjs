import { readFileSync, writeFileSync } from "node:fs";

function read(path) { return readFileSync(path, "utf8"); }
function write(path, content) { writeFileSync(path, content, "utf8"); }
function replaceOnce(content, from, to, path) {
  if (!content.includes(from)) throw new Error(`PATCH_TARGET_NOT_FOUND:${path}:${from.slice(0, 90)}`);
  return content.replace(from, to);
}

const versionsFile = `export type VideoModelVersion = {
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
    { id: "veo-3.1-lite", label: "Veo 3.1 Lite", apiModelId: "veo-3.1-lite-generate-preview", note: "ประหยัด · เหมาะกับการเริ่มทดสอบ", recommended: true },
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
`;
write("lib/video-model-versions.ts", versionsFile);

{
  const path = "lib/domain.ts";
  let src = read(path);
  src = replaceOnce(src, "  mainModelId: string;\n  modelMode: ModelMode;", "  mainModelId: string;\n  mainModelVersionId?: string;\n  modelMode: ModelMode;", path);
  write(path, src);
}

{
  const path = "lib/providers/video-provider.ts";
  let src = read(path);
  src = replaceOnce(src, "  episodeId: string;\n  renderSegment: RenderSegment;", "  episodeId: string;\n  modelVersionId?: string;\n  renderSegment: RenderSegment;", path);
  write(path, src);
}

{
  const path = "components/single-episode-studio.tsx";
  let src = read(path);
  src = replaceOnce(src,
    'import { getVideoUiCapability } from "@/lib/providers/video-ui-capabilities";',
    'import { getVideoUiCapability } from "@/lib/providers/video-ui-capabilities";\nimport { getDefaultVideoModelVersionId, getVideoModelVersions } from "@/lib/video-model-versions";', path);
  src = replaceOnce(src,
    '  const [model, setModel] = useState("Seedance 2.5");\n  const [aspect, setAspect] = useState("16:9 — Widescreen");',
    '  const [model, setModel] = useState("Seedance 2.5");\n  const [modelVersion, setModelVersion] = useState(() => getDefaultVideoModelVersionId("Seedance 2.5"));\n  const [aspect, setAspect] = useState("16:9 — Widescreen");', path);
  src = replaceOnce(src,
    '  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];\n  const videoCapability = getVideoUiCapability(model);',
    '  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];\n  const modelVersions = useMemo(() => getVideoModelVersions(model), [model]);\n  const selectedModelVersion = modelVersions.find((item) => item.apiModelId === modelVersion) || modelVersions[0];\n  const videoCapability = getVideoUiCapability(model);', path);
  src = replaceOnce(src,
    '    setModel(nextModel);\n    setScenes((current) => {',
    '    setModel(nextModel);\n    setModelVersion(getDefaultVideoModelVersionId(nextModel));\n    setScenes((current) => {', path);
  src = replaceOnce(src,
    '        model,\n        aspect,',
    '        model,\n        modelVersion,\n        aspect,', path);
  src = replaceOnce(src,
    '<label className={styles.field}><span>โมเดลวิดีโอ</span><select value={model} onChange={(event) => changeModel(event.target.value)}>{MODELS.map((item) => <option key={item}>{item}</option>)}</select><small>เลือก Provider ที่จะใช้สร้างคลิปจริง</small></label>',
    '<div className={styles.field}><span>โมเดลวิดีโอ / รุ่น</span><div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)", gap: 6 }}><select aria-label="โมเดลวิดีโอ" value={model} onChange={(event) => changeModel(event.target.value)}>{MODELS.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="รุ่นโมเดล" value={modelVersion} onChange={(event) => setModelVersion(event.target.value)}>{modelVersions.map((item) => <option key={item.apiModelId} value={item.apiModelId}>{item.label}</option>)}</select></div><small>{selectedModelVersion ? `รุ่นที่ใช้จริง: ${selectedModelVersion.label} · ${selectedModelVersion.note}` : "เลือกรุ่นของ Provider ที่จะใช้สร้างคลิปจริง"}</small></div>', path);
  write(path, src);
}

{
  const path = "lib/agent/studio-project.ts";
  let src = read(path);
  src = replaceOnce(src,
    '  model: string;\n  aspect: string;',
    '  model: string;\n  modelVersion?: string;\n  aspect: string;', path);
  src = replaceOnce(src,
    '    mainModelId,\n    modelMode: "single",',
    '    mainModelId,\n    mainModelVersionId: draft.modelVersion || undefined,\n    modelMode: "single",', path);
  src = replaceOnce(src,
    '      `โมเดลหลัก: ${draft.model}`,',
    '      `โมเดลหลัก: ${draft.model}`,\n      `รุ่นโมเดล: ${draft.modelVersion || "Provider default"}`,', path);
  write(path, src);
}

{
  const path = "lib/prompt-engine.ts";
  let src = read(path);
  src = replaceOnce(src,
    'TARGET MODEL: ${model.name}\\nPROMPT MODE:',
    'TARGET MODEL: ${model.name}\\nMODEL VERSION: ${project.mainModelVersionId || "Provider default"}\\nPROMPT MODE:', path);
  write(path, src);
}

{
  const path = "lib/agent/worker-runtime.ts";
  let src = read(path);
  src = replaceOnce(src,
    '        episodeId: episode.id,\n        renderSegment,',
    '        episodeId: episode.id,\n        modelVersionId: project.mainModelVersionId,\n        renderSegment,', path);
  write(path, src);
}

for (const [path, family, target, replacement] of [
  ["lib/providers/veo-video-provider.ts", "Veo", 'const DEFAULT_MODEL = "veo-3.1-generate-preview";', 'const DEFAULT_MODEL = "veo-3.1-generate-preview";'],
  ["lib/providers/seedance-video-provider.ts", "Seedance 2.5", 'const DEFAULT_MODEL = "dreamina-seedance-2-5-260628";', 'const DEFAULT_MODEL = "dreamina-seedance-2-5-260628";'],
  ["lib/providers/kling-video-provider.ts", "Kling", 'const DEFAULT_MODEL = "kling-v3";', 'const DEFAULT_MODEL = "kling-v3";'],
  ["lib/providers/runway-video-provider.ts", "Runway", 'const DEFAULT_MODEL = "gen4.5";', 'const DEFAULT_MODEL = "gen4.5";'],
  ["lib/providers/wan-video-provider.ts", "Wan", 'const DEFAULT_MODEL = "wan2.6-t2v";', 'const DEFAULT_MODEL = "wan3.0-video";'],
]) {
  let src = read(path);
  src = replaceOnce(src,
    'import type { GenerateVideoRequest, GenerateVideoResult, ProviderRuntimeCredential, VideoProvider } from "@/lib/providers/video-provider";',
    'import type { GenerateVideoRequest, GenerateVideoResult, ProviderRuntimeCredential, VideoProvider } from "@/lib/providers/video-provider";\nimport { resolveVideoApiModelId } from "@/lib/video-model-versions";', path);
  src = replaceOnce(src, target, replacement, path);
  if (family === "Veo") {
    src = replaceOnce(src,
      '    const instances: Array<Record<string, unknown>> = [{ prompt: buildCompiledVideoPrompt(request).slice(0, 8000) }];',
      '    const modelId = resolveVideoApiModelId("Veo", request.modelVersionId) || this.modelId;\n    const instances: Array<Record<string, unknown>> = [{ prompt: buildCompiledVideoPrompt(request).slice(0, 8000) }];', path);
    src = replaceOnce(src, '${this.baseUrl}/models/${encodeURIComponent(this.modelId)}:predictLongRunning', '${this.baseUrl}/models/${encodeURIComponent(modelId)}:predictLongRunning', path);
  } else if (family === "Seedance 2.5") {
    src = replaceOnce(src,
      '    const duration = Math.round(request.renderSegment.duration);',
      '    const duration = Math.round(request.renderSegment.duration);\n    const modelId = resolveVideoApiModelId("Seedance 2.5", request.modelVersionId) || this.modelId;', path);
    src = replaceOnce(src, '        model: this.modelId,', '        model: modelId,', path);
  } else if (family === "Kling") {
    src = replaceOnce(src,
      '    const hasImage = Boolean(request.imageReferences[0]);',
      '    const modelId = resolveVideoApiModelId("Kling", request.modelVersionId) || this.modelId;\n    const hasImage = Boolean(request.imageReferences[0]);', path);
    src = replaceOnce(src, '      model_name: this.modelId,', '      model_name: modelId,', path);
  } else if (family === "Runway") {
    src = replaceOnce(src,
      '    const duration = clampInt(request.renderSegment.duration, 2, 10);\n    const body: Record<string, unknown> = {',
      '    const duration = clampInt(request.renderSegment.duration, 2, 10);\n    const modelId = resolveVideoApiModelId("Runway", request.modelVersionId) || this.modelId;\n    if (modelId === "gen4_turbo" && !request.imageReferences[0]) throw new Error("RUNWAY_GEN4_TURBO_REQUIRES_IMAGE_REFERENCE");\n    const body: Record<string, unknown> = {', path);
    src = replaceOnce(src, '      model: this.modelId,', '      model: modelId,', path);
  } else if (family === "Wan") {
    src = replaceOnce(src,
      '    const input: Record<string, unknown> = { prompt: buildCompiledVideoPrompt(request).slice(0, 5000) };',
      '    const modelId = resolveVideoApiModelId("Wan", request.modelVersionId) || this.modelId;\n    const input: Record<string, unknown> = { prompt: buildCompiledVideoPrompt(request).slice(0, 5000) };', path);
    src = replaceOnce(src, '        model: this.modelId,', '        model: modelId,', path);
    src = replaceOnce(src, '          audio: request.audioReferences.length > 0 || /2\\.6|2\\.7/.test(this.modelId),', '          audio: request.audioReferences.length > 0 || /2\\.6|2\\.7|3\\.0/.test(modelId),', path);
  }
  write(path, src);
}

{
  const path = "app/models/page.tsx";
  let src = read(path);
  src = replaceOnce(src,
    'import { VIDEO_MODELS } from "@/lib/catalogs";',
    'import { VIDEO_MODELS } from "@/lib/catalogs";\nimport { getVideoModelVersions } from "@/lib/video-model-versions";', path);
  src = replaceOnce(src,
    '          <p className={styles.description}>{model.descriptionTh}</p>\n          <div className={styles.specs}>',
    '          <p className={styles.description}>{model.descriptionTh}</p>\n          <div className={styles.tags}>{getVideoModelVersions(model.name).map((version) => <span key={version.apiModelId}>{version.label}{version.recommended ? " · แนะนำ" : ""}</span>)}</div>\n          <div className={styles.specs}>', path);
  write(path, src);
}

console.log("Applied video model version selector and provider routing.");
