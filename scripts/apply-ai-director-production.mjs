import fs from "node:fs";

const target = "components/single-episode-studio.tsx";
let source = fs.readFileSync(target, "utf8");

if (source.includes('import SingleEpisodeAiDirectorPanel from "@/components/single-episode-ai-director-panel";')) {
  console.log("AI Director already wired; no changes needed.");
  process.exit(0);
}

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one anchor, found ${count}`);
  source = source.replace(before, after);
}

replaceOnce(
`import styles from "./single-episode-studio.module.css";\nimport { buildStudioAgentProject } from "@/lib/agent/studio-project";\nimport type { ProductionAnalysis } from "@/lib/analyzer/schema";`,
`import styles from "./single-episode-studio.module.css";\nimport SingleEpisodeAiDirectorPanel from "@/components/single-episode-ai-director-panel";\nimport { buildStudioAgentProject } from "@/lib/agent/studio-project";\nimport type { AiDirectorMeta, AiDirectorMode, AiDirectorNovelty, AiDirectorScenePatch, AiDirectorScope } from "@/lib/ai-director";\nimport {\n  AI_SCOPE_OPTIONS,\n  aiStorySignature,\n  appendAiDirectorHistory,\n  applyAiDirectorPatch,\n  cloneAiDirectorScenes,\n  readAiDirectorHistory,\n  readManualAiSections,\n} from "@/lib/ai-director-client";`,
"imports",
);

replaceOnce(
`  const [sceneAiBusy, setSceneAiBusy] = useState(false);\n  const [sceneAiSummary, setSceneAiSummary] = useState("");`,
`  const [sceneAiBusy, setSceneAiBusy] = useState(false);\n  const [sceneAiSummary, setSceneAiSummary] = useState("");\n  const [aiDirectorMode, setAiDirectorMode] = useState<AiDirectorMode>("production");\n  const [aiDirectorNovelty, setAiDirectorNovelty] = useState<AiDirectorNovelty>("balanced");\n  const [sceneAiMeta, setSceneAiMeta] = useState<AiDirectorMeta | null>(null);\n  const [sceneAiUndo, setSceneAiUndo] = useState<StoryScene[] | null>(null);`,
"AI Director state",
);

replaceOnce(
`  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];`,
`  useEffect(() => {\n    setSceneAiMeta(null);\n    setSceneAiSummary("");\n    setSceneAiUndo(null);\n  }, [selectedSceneId]);\n\n  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];`,
"selected scene reset",
);

const functionStart = source.indexOf("  async function arrangeSceneWithAi() {");
const functionEnd = source.indexOf("  async function sendToAgent() {", functionStart);
if (functionStart < 0 || functionEnd < 0) throw new Error("AI function anchors not found");
const replacement = `  async function arrangeSceneWithAi(scope: AiDirectorScope = "all") {\n    if (!selectedScene || sceneAiBusy) return;\n    if (!story.trim() && !selectedScene.action.trim()) {\n      setMessage("กรุณาเขียนเรื่องหรือ Action ของฉากก่อนให้ AI Director ช่วยคิด");\n      return;\n    }\n    const sceneIndex = scenes.findIndex((item) => item.id === selectedScene.id);\n    const manualSections = readManualAiSections();\n    const historyKey = aiStorySignature(episodeTitle, story, sceneIndex);\n    const history = readAiDirectorHistory(historyKey);\n    const scopeLabel = scope === "all" ? "ทั้งฉาก" : AI_SCOPE_OPTIONS.find((item) => item.value === scope)?.label || scope;\n    setSceneAiBusy(true);\n    setSceneAiSummary("");\n    setMessage(\`AI Director กำลังสร้าง Candidate และตรวจ \${scopeLabel} ของฉาก \${sceneIndex + 1}...\`);\n    try {\n      const response = await fetch("/api/ai/director", {\n        method: "POST",\n        credentials: "same-origin",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({\n          mode: aiDirectorMode,\n          novelty: aiDirectorNovelty,\n          scope,\n          episodeTitle,\n          story,\n          model,\n          modelVersion,\n          aspect,\n          visualStyle,\n          locks,\n          totalDuration,\n          sceneIndex,\n          sceneCount: scenes.length,\n          currentScene: selectedScene,\n          previousScene: sceneIndex > 0 ? scenes[sceneIndex - 1] : null,\n          nextScene: sceneIndex < scenes.length - 1 ? scenes[sceneIndex + 1] : null,\n          cast: characters.map((item) => ({ id: item.id, name: item.name, role: item.role, appearance: item.appearance, voice: item.voice })),\n          manualSections,\n          history,\n        }),\n      });\n      const data = await response.json() as {\n        scene?: AiDirectorScenePatch;\n        meta?: AiDirectorMeta;\n        provider?: string;\n        usage?: { costThb?: number };\n        error?: string;\n      };\n      if (!response.ok || !data.scene || !data.meta) throw new Error(data.error || "AI_DIRECTOR_FAILED");\n\n      setSceneAiUndo(cloneAiDirectorScenes(scenes));\n      setScenes((current) => current.map((scene) => scene.id === selectedScene.id\n        ? applyAiDirectorPatch(scene, data.scene!, manualSections, locks)\n        : scene));\n      appendAiDirectorHistory(historyKey, data.meta.historyEntry);\n      setSceneAiMeta(data.meta);\n      const cost = Number(data.usage?.costThb || 0);\n      const providerCopy = \`\${data.provider || "AI Director"}\${cost > 0 ? \` · ฿\${cost.toFixed(4)}\` : " · BYOK"}\`;\n      setSceneAiSummary(\`\${data.meta.rationaleTh} · \${providerCopy}\`);\n      setMessage(\`AI Director จัด \${scopeLabel} แล้ว · เปลี่ยน \${data.meta.changedFields.length} ค่า · คุมความซ้ำด้วยประวัติ \${history.length + 1} รุ่น\`);\n    } catch (error) {\n      const raw = error instanceof Error ? error.message : "AI_DIRECTOR_FAILED";\n      setMessage(raw === "AI_DIRECTOR_SOURCE_REQUIRED" ? "กรุณาใส่เรื่องหรือ Action ก่อนให้ AI ช่วยคิด" : friendlyAiError(raw));\n    } finally {\n      setSceneAiBusy(false);\n    }\n  }\n\n  function undoLastAiSceneChange() {\n    if (!sceneAiUndo || sceneAiBusy) return;\n    setScenes(cloneAiDirectorScenes(sceneAiUndo));\n    setSceneAiUndo(null);\n    setSceneAiMeta(null);\n    setSceneAiSummary("");\n    setMessage("ย้อนกลับค่าจาก AI ครั้งล่าสุดแล้ว");\n  }\n\n`;
source = source.slice(0, functionStart) + replacement + source.slice(functionEnd);

replaceOnce(
`<button type="button" className={styles.aiArrangeButton} onClick={arrangeSceneWithAi} disabled={sceneAiBusy}>{sceneAiBusy ? "AI กำลังจัดฉาก..." : "✦ AI จัดฉากตามโครงเรื่อง"}</button>`,
`<button type="button" className={styles.aiArrangeButton} onClick={() => void arrangeSceneWithAi("all")} disabled={sceneAiBusy}>{sceneAiBusy ? "AI Director กำลังคิด..." : "✦ AI ช่วยคิดทั้งฉาก"}</button>`,
"primary AI button",
);

replaceOnce(
`          {sceneAiSummary ? <div className={styles.aiSceneNotice}><b>AI จัดฉากแล้ว</b><span>{sceneAiSummary}</span></div> : null}`,
`          <SingleEpisodeAiDirectorPanel\n            busy={sceneAiBusy}\n            summary={sceneAiSummary}\n            meta={sceneAiMeta}\n            mode={aiDirectorMode}\n            novelty={aiDirectorNovelty}\n            canUndo={Boolean(sceneAiUndo)}\n            onModeChange={setAiDirectorMode}\n            onNoveltyChange={setAiDirectorNovelty}\n            onGenerate={(scope) => void arrangeSceneWithAi(scope)}\n            onUndo={undoLastAiSceneChange}\n          />`,
"AI Director panel",
);

if (source.includes("ProductionAnalysis")) throw new Error("Old analyzer type remains after patch");
if (!source.includes("SingleEpisodeAiDirectorPanel")) throw new Error("AI Director panel import missing after patch");
if (!source.includes('fetch("/api/ai/director"')) throw new Error("AI Director endpoint not wired after patch");

fs.writeFileSync(target, source);
console.log("Wired Production AI Director into Single Episode Studio only.");
