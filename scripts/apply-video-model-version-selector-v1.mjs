import { readFileSync, writeFileSync } from "node:fs";

const path = "components/single-episode-studio.tsx";
let source = readFileSync(path, "utf8");

if (source.includes("const MODEL_PROFILES: StudioModelProfile[]")) {
  console.log("Single Episode model readiness UI already applied.");
  process.exit(0);
}

function requireAnchor(anchor, label) {
  const index = source.indexOf(anchor);
  if (index < 0) throw new Error(`PATCH_ANCHOR_NOT_FOUND:${label}`);
  return index;
}

const oldModels = 'const MODELS = ["Seedance 2.5", "Kling", "Veo", "Runway", "Wan"];';
requireAnchor(oldModels, "MODELS");
const modelBlock = `type StudioVideoConnection = {
  provider: string;
  kind: string;
  modelId: string | null;
  enabledModelIds: string[];
  status: string;
  enabled: boolean;
};

type StudioVideoProvider = {
  id: string;
  kind: string;
  status: string;
  systemConfigured?: boolean;
};

type StudioVideoConnectionsPayload = {
  ok?: boolean;
  connections?: StudioVideoConnection[];
  providers?: StudioVideoProvider[];
};

type StudioModelProfile = {
  value: string;
  label: string;
  providerId: string;
  image: "ready" | "adapter" | "no";
  mode: "generate" | "video-edit" | "hdr";
  nativeAudio?: boolean;
};

const MODEL_PROFILES: StudioModelProfile[] = [
  { value: "Seedance 2.5", label: "Seedance 2.5", providerId: "seedance", image: "ready", mode: "generate", nativeAudio: true },
  { value: "Kling", label: "Kling", providerId: "kling", image: "ready", mode: "generate", nativeAudio: true },
  { value: "Veo", label: "Veo", providerId: "veo", image: "adapter", mode: "generate", nativeAudio: true },
  { value: "Runway", label: "Runway Gen-4", providerId: "runway", image: "ready", mode: "generate" },
  { value: "Seedance 2.5 (Runway)", label: "Seedance 2.5 — Runway", providerId: "runway-seedance", image: "ready", mode: "generate", nativeAudio: true },
  { value: "Gemini Omni Flash 1.1 (Runway)", label: "Gemini Omni Flash 1.1 — Runway", providerId: "runway-gemini-omni", image: "ready", mode: "generate", nativeAudio: true },
  { value: "Aleph 2.0 (Runway)", label: "Aleph 2.0 — Runway", providerId: "runway-aleph", image: "no", mode: "video-edit" },
  { value: "Ruby HDR (Runway)", label: "Ruby HDR — Runway", providerId: "runway-ruby", image: "no", mode: "hdr", nativeAudio: true },
  { value: "Wan", label: "Wan", providerId: "wan", image: "ready", mode: "generate", nativeAudio: true },
];

const MODELS = MODEL_PROFILES.map((item) => item.value);`;
source = source.replace(oldModels, modelBlock);

const stateAnchor = '  const [sceneAiUndo, setSceneAiUndo] = useState<StoryScene[] | null>(null);';
requireAnchor(stateAnchor, "AI_STATE");
const connectionState = `${stateAnchor}
  const [videoConnections, setVideoConnections] = useState<StudioVideoConnection[]>([]);
  const [videoProviders, setVideoProviders] = useState<StudioVideoProvider[]>([]);
  const [videoConnectionLoading, setVideoConnectionLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/api-connections", { credentials: "same-origin", cache: "no-store" });
        const data = await response.json() as StudioVideoConnectionsPayload;
        if (!active || !response.ok) return;
        setVideoConnections(Array.isArray(data.connections) ? data.connections.filter((item) => item.kind === "VIDEO") : []);
        setVideoProviders(Array.isArray(data.providers) ? data.providers.filter((item) => item.kind === "VIDEO") : []);
      } catch {
        // Status UI falls back to unavailable without changing generation behavior.
      } finally {
        if (active) setVideoConnectionLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);`;
source = source.replace(stateAnchor, connectionState);

const computeAnchor = '  const selectedModelVersion = modelVersions.find((item) => item.apiModelId === modelVersion) || modelVersions[0];\n  const videoCapability = getVideoUiCapability(model);';
requireAnchor(computeAnchor, "MODEL_COMPUTE");
const computed = `  const selectedModelVersion = modelVersions.find((item) => item.apiModelId === modelVersion) || modelVersions[0];
  const selectedModelProfile = MODEL_PROFILES.find((item) => item.value === model) || MODEL_PROFILES[0];
  const modelConnectionStates = useMemo(() => Object.fromEntries(MODEL_PROFILES.map((profile) => {
    const provider = videoProviders.find((item) => item.id === profile.providerId);
    const connection = videoConnections.find((item) => item.provider === profile.providerId && item.kind === "VIDEO");
    const adapterReady = provider?.status === "READY";
    const userConnectionReady = Boolean(connection?.enabled && connection.status === "CONNECTED");
    const credentialReady = userConnectionReady || Boolean(provider?.systemConfigured);
    const operationalReady = adapterReady && credentialReady;
    return [profile.value, { adapterReady, credentialReady, operationalReady, primaryReady: operationalReady && profile.mode === "generate" }];
  })), [videoConnections, videoProviders]);
  const selectedConnection = videoConnections.find((item) => item.provider === selectedModelProfile.providerId && item.kind === "VIDEO");
  const selectedProvider = videoProviders.find((item) => item.id === selectedModelProfile.providerId);
  const selectedConnectionState = modelConnectionStates[model];
  const selectedEnabledIds = Array.isArray(selectedConnection?.enabledModelIds) ? selectedConnection.enabledModelIds : [];
  const selectedVersionEnabled = Boolean(selectedProvider?.systemConfigured) || Boolean(
    selectedConnection?.enabled
    && selectedConnection.status === "CONNECTED"
    && (selectedEnabledIds.length === 0
      || !selectedModelVersion
      || selectedEnabledIds.includes(selectedModelVersion.apiModelId)
      || selectedConnection.modelId === selectedModelVersion.apiModelId)
  );
  const selectedModelReady = Boolean(selectedConnectionState?.primaryReady && selectedVersionEnabled);
  const videoCapability = getVideoUiCapability(model);`;
source = source.replace(computeAnchor, computed);

const selectorStartAnchor = '        <div className={styles.field}><span>โมเดลวิดีโอ / รุ่น</span>';
const selectorEndAnchor = '        <label className={styles.field}><span>อัตราส่วนภาพ</span>';
const selectorStart = requireAnchor(selectorStartAnchor, "SELECTOR_START");
const selectorEnd = requireAnchor(selectorEndAnchor, "SELECTOR_END");
if (selectorEnd <= selectorStart) throw new Error("PATCH_SELECTOR_RANGE_INVALID");
const selector = `        <div className={styles.field}>
          <span>โมเดลวิดีโอ / รุ่น</span>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)", gap: 6 }}>
            <select aria-label="โมเดลวิดีโอ" value={model} onChange={(event) => changeModel(event.target.value)}>
              {MODEL_PROFILES.map((item) => {
                const state = modelConnectionStates[item.value];
                const marker = videoConnectionLoading ? "⚪" : state?.operationalReady ? (item.mode === "generate" ? "🟢" : "🟣") : state?.adapterReady ? "🟠" : "🔴";
                const inputMarker = item.image === "ready" ? "🖼" : item.image === "adapter" ? "⚠️🖼" : item.mode === "generate" ? "" : "🎞";
                return <option key={item.value} value={item.value}>{marker} {inputMarker} {item.label}</option>;
              })}
            </select>
            <select aria-label="รุ่นโมเดล" value={modelVersion} onChange={(event) => setModelVersion(event.target.value)}>
              {modelVersions.map((item) => {
                const versionReady = Boolean(selectedProvider?.systemConfigured) || Boolean(selectedConnection?.enabled && selectedConnection.status === "CONNECTED" && (selectedEnabledIds.length === 0 || selectedEnabledIds.includes(item.apiModelId) || selectedConnection.modelId === item.apiModelId));
                return <option key={item.apiModelId} value={item.apiModelId}>{versionReady ? "🟢" : "⚪"} {item.label}</option>;
              })}
            </select>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 }}>
            <span style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontSize: 10 }}>
              {videoConnectionLoading ? "⚪ กำลังตรวจ Connection…" : selectedConnectionState?.operationalReady ? (selectedModelProfile.mode === "generate" ? "🟢 พร้อมใช้งาน" : "🟣 Connection พร้อม · เครื่องมือแปลงวิดีโอ") : selectedConnectionState?.adapterReady ? "🟠 ยังไม่ได้เชื่อมต่อ / Connection ไม่พร้อม" : "🔴 Adapter ยังไม่พร้อม"}
            </span>
            <span style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontSize: 10 }}>
              {selectedModelProfile.image === "ready" ? "🖼 รับรูปอ้างอิง" : selectedModelProfile.image === "adapter" ? "⚠️🖼 Model รองรับรูป แต่ SCENOVA Adapter ยังไม่ส่งรูป" : "🎞 ใช้วิดีโอต้นฉบับ ไม่รับรูป"}
            </span>
            {selectedModelProfile.nativeAudio ? <span style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", fontSize: 10 }}>🔊 Native Audio</span> : null}
            {selectedModelProfile.mode === "video-edit" ? <span style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid rgba(167,112,255,.35)", fontSize: 10 }}>🎞 Video Edit เท่านั้น · ต้องมีวิดีโอต้นฉบับ</span> : null}
            {selectedModelProfile.mode === "hdr" ? <span style={{ padding: "3px 7px", borderRadius: 999, border: "1px solid rgba(167,112,255,.35)", fontSize: 10 }}>🎞 HDR Post-process เท่านั้น · ต้องมีวิดีโอต้นฉบับ</span> : null}
            {!videoConnectionLoading && selectedModelProfile.mode === "generate" && !selectedModelReady ? <Link href="/profile/api" style={{ fontSize: 10, color: "#bd8cff" }}>ตั้งค่า Provider →</Link> : null}
          </div>
          <small>{selectedModelVersion ? \`รุ่นที่ใช้จริง: \${selectedModelVersion.label} · \${selectedModelVersion.note}\` : "เลือกรุ่นของ Provider ที่จะใช้สร้างคลิปจริง"}</small>
        </div>
`;
source = source.slice(0, selectorStart) + selector + source.slice(selectorEnd);

if (!source.includes("Seedance 2.5 — Runway")) throw new Error("PATCH_VERIFY_SPLIT_MODELS_FAILED");
if (!source.includes("🖼 รับรูปอ้างอิง")) throw new Error("PATCH_VERIFY_IMAGE_STATUS_FAILED");
if (!source.includes("/api/api-connections")) throw new Error("PATCH_VERIFY_CONNECTION_STATUS_FAILED");

writeFileSync(path, source, "utf8");
console.log("Applied complete video model readiness and image-input indicators to Single Episode Studio.");
