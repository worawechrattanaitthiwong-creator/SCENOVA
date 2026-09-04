"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DirectRenderPanel from "@/components/direct-render-panel";
import { STYLE_PRESETS } from "@/lib/catalogs";
import type { Episode, LockProfile, Project, TimelineSegment } from "@/lib/domain";
import styles from "./studio-direct-render-bridge.module.css";

const MASTER_PROMPT_KEY = "scenova-agent-master-prompt-v1";
const NEGATIVE_PROMPT_KEY = "scenova-agent-negative-prompt-v1";
const SOURCE_INSTRUCTION_KEY = "scenova-agent-source-instruction-v1";

type ModelMeta = {
  providerId: string;
  label: string;
  mode: "generate" | "video-edit" | "hdr";
  fixedVersion?: string;
};

type DirectSnapshot = {
  project: Project;
  providerId: string;
  modelVersionId?: string;
  modelLabel: string;
  modelReady: boolean;
  modelMode: "generate" | "video-edit" | "hdr";
};

const MODEL_META: Record<string, ModelMeta> = {
  "runway:gen4.5": { providerId: "runway", label: "Runway Gen-4.5", mode: "generate", fixedVersion: "gen4.5" },
  "runway:gen4_turbo": { providerId: "runway", label: "Runway Gen-4 Turbo", mode: "generate", fixedVersion: "gen4_turbo" },
  "runway:seedance2_5": { providerId: "runway", label: "Seedance 2.5", mode: "generate", fixedVersion: "seedance2_5" },
  "runway:gemini_omni_flash": { providerId: "runway", label: "Gemini Omni Flash 1.1", mode: "generate", fixedVersion: "gemini_omni_flash" },
  "runway:aleph2": { providerId: "runway", label: "Aleph 2.0", mode: "video-edit", fixedVersion: "aleph2" },
  "runway:ruby": { providerId: "runway", label: "Ruby HDR", mode: "hdr", fixedVersion: "ruby" },
  Kling: { providerId: "kling", label: "Kling", mode: "generate" },
  Veo: { providerId: "veo", label: "Veo", mode: "generate" },
  Wan: { providerId: "wan", label: "Wan", mode: "generate" },
};

function compact(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function directLabel(field: Element) {
  const span = Array.from(field.children).find((child) => child.tagName === "SPAN");
  return compact(span?.textContent);
}

function findField(root: ParentNode, labels: string[]) {
  const normalized = labels.map((label) => label.toLocaleLowerCase());
  return Array.from(root.querySelectorAll<HTMLElement>("label")).find((field) => {
    const current = directLabel(field).toLocaleLowerCase();
    return normalized.some((label) => current === label || current.startsWith(label));
  }) || null;
}

function valueOf(root: ParentNode, labels: string[]) {
  return findField(root, labels)?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input,textarea,select")?.value || "";
}

function selectedCheckboxText(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLLabelElement>("label"))
    .filter((label) => label.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked)
    .map((label) => compact(label.textContent));
}

function sceneButtons() {
  const root = document.getElementById("scenes");
  const list = root?.querySelector<HTMLElement>("[class*='sceneList']");
  return list ? Array.from(list.querySelectorAll<HTMLButtonElement>(":scope > button")) : [];
}

function selectedSceneEditor() {
  return document.getElementById("scenes")?.querySelector<HTMLElement>("[class*='sceneEditor']") || null;
}

function lensNumber(value: string) {
  const parsed = Number(value.match(/\d+(?:\.\d+)?/)?.[0] || 50);
  return Number.isFinite(parsed) ? parsed : 50;
}

function aspectValue(value: string): Project["aspectRatio"] {
  if (value.startsWith("9:16")) return "9:16";
  if (value.startsWith("1:1")) return "1:1";
  if (value.startsWith("4:5")) return "4:5";
  return "16:9";
}

function lockProfile(texts: string[]): LockProfile {
  const combined = texts.join(" ").toLocaleLowerCase();
  const has = (...values: string[]) => values.some((value) => combined.includes(value));
  return {
    project: true,
    character: has("character", "ตัวละคร"),
    style: has("visual style", "สไตล์"),
    voice: has("voice", "เสียง"),
    location: has("location", "สถานที่"),
    prop: has("prop", "พร็อพ"),
    canon: has("canon"),
    camera: has("camera", "กล้อง"),
    lighting: has("lighting", "แสง"),
    motion: has("motion", "movement"),
    model: false,
  };
}

function styleIdFor(value: string) {
  const needle = compact(value).toLocaleLowerCase();
  const matched = STYLE_PRESETS.find((style) => needle.includes(style.nameEn.toLocaleLowerCase()) || needle.includes(style.nameTh.toLocaleLowerCase()) || style.nameEn.toLocaleLowerCase().includes(needle));
  return matched?.id || STYLE_PRESETS[0]?.id || "cinematic-anime";
}

function suppressLegacyAgentSubmit() {
  const main = document.querySelector("main");
  if (!main) return;
  Array.from(main.querySelectorAll<HTMLButtonElement>("button")).forEach((button) => {
    const text = compact(button.textContent);
    if (text.includes("ส่งให้ทีม AI ผลิต") || text.includes("ส่ง Storyboard ให้ทีม AI")) button.style.display = "none";
  });
  Array.from(main.querySelectorAll<HTMLElement>("label")).forEach((label) => {
    if (compact(label.textContent).includes("วงเงินสูงสุดของงาน")) label.style.display = "none";
  });
}

function characterCards() {
  const root = document.getElementById("characters");
  return root ? Array.from(root.querySelectorAll<HTMLElement>("article")) : [];
}

function captureCharacters() {
  return characterCards().map((card, index) => {
    const name = valueOf(card, ["ชื่อ"]) || `ตัวละคร ${index + 1}`;
    const role = valueOf(card, ["บทบาท"]);
    const appearance = valueOf(card, ["รูปลักษณ์ / เสื้อผ้า / บุคลิก / จุดจำ"]);
    const voice = valueOf(card, ["โปรไฟล์เสียง"]);
    const lock = Array.from(card.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).some((input) => input.checked);
    const references = Array.from(card.querySelectorAll<HTMLImageElement>("figure img")).slice(0, 8).map((image, referenceIndex) => ({
      id: `studio-ref-${index + 1}-${referenceIndex + 1}`,
      label: image.alt || `${name} reference ${referenceIndex + 1}`,
      kind: "custom" as const,
      url: image.currentSrc || image.src,
    }));
    const costumeLine = appearance.split(/\r?\n/).find((line) => /^costume\s*:/i.test(line));
    const personalityLine = appearance.split(/\r?\n/).find((line) => /^personality\s*:/i.test(line));
    return {
      id: `studio-character-${index + 1}-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      kind: "human" as const,
      description: role || "Studio character",
      appearance,
      outfit: costumeLine?.replace(/^costume\s*:\s*/i, "") || appearance,
      personality: personalityLine?.replace(/^personality\s*:\s*/i, "") || "",
      voiceProfile: voice || undefined,
      lock,
      references,
    };
  });
}

function dialogueFromEditor(editor: HTMLElement, characterIdByName: Map<string, string>, start: number, end: number) {
  return Array.from(editor.querySelectorAll<HTMLElement>("[class*='dialogueCard']")).flatMap((card, index) => {
    const name = compact(card.querySelector("b")?.textContent);
    const text = compact(card.querySelector<HTMLTextAreaElement>("textarea")?.value);
    if (!text) return [];
    return [{
      id: `dialogue-${index + 1}-${start}`,
      characterId: characterIdByName.get(name.toLocaleLowerCase()) || "",
      start,
      end,
      text,
      emotion: valueOf(editor, ["อารมณ์หลัก"]),
      speed: "Normal",
    }];
  });
}

async function captureSegments(characters: ReturnType<typeof captureCharacters>) {
  const buttons = sceneButtons();
  const originalIndex = Math.max(0, buttons.findIndex((button) => String(button.className).toLocaleLowerCase().includes("active")));
  const characterIdByName = new Map(characters.map((character) => [character.name.toLocaleLowerCase(), character.id]));
  const segments: TimelineSegment[] = [];
  let cursor = 0;

  for (let index = 0; index < buttons.length; index += 1) {
    sceneButtons()[index]?.click();
    await nextFrame();
    const editor = selectedSceneEditor();
    if (!editor) continue;
    const durationRange = editor.querySelector<HTMLInputElement>("[class*='sceneDuration'] input[type='range']");
    const duration = Math.max(1, Number(durationRange?.value || compact(sceneButtons()[index]?.querySelector("small")?.textContent).match(/(\d+)\s*วินาที/)?.[1] || 1));
    const start = cursor;
    const end = start + duration;
    cursor = end;

    const title = valueOf(editor, ["ชื่อฉาก"]) || `ฉาก ${index + 1}`;
    const location = valueOf(editor, ["สถานที่"]);
    const action = valueOf(editor, ["Action รวมของฉาก"]);
    const continuity = valueOf(editor, ["Continuity Note"]);
    const negative = valueOf(editor, ["Scene Negative Prompt"]);
    const shotType = valueOf(editor, ["ระยะภาพ"]);
    const angle = valueOf(editor, ["มุมกล้อง"]);
    const lens = valueOf(editor, ["เลนส์"]);
    const movement = valueOf(editor, ["การเคลื่อนกล้อง"]);
    const height = valueOf(editor, ["ความสูงกล้อง"]);
    const cameraSpeed = valueOf(editor, ["ความเร็วกล้อง"]);
    const focus = valueOf(editor, ["จุดโฟกัส"]);
    const dof = valueOf(editor, ["ระยะชัดลึก"]);
    const composition = valueOf(editor, ["องค์ประกอบภาพ"]);
    const lighting = [valueOf(editor, ["รูปแบบแสง"]), valueOf(editor, ["อุณหภูมิสี"])].filter(Boolean).join(" · ");
    const emotion = valueOf(editor, ["อารมณ์หลัก"]);
    const sound = [
      valueOf(editor, ["เสียงบรรยากาศหลัก"]),
      valueOf(editor, ["เสียงพื้นรอง"]),
      valueOf(editor, ["เอฟเฟกต์เสียง"]),
      valueOf(editor, ["SFX Timeline"]),
      valueOf(editor, ["ดนตรี"]),
    ].filter(Boolean).join(" · ");

    const missingCamera = [
      ["ระยะภาพ", shotType],
      ["มุมกล้อง", angle],
      ["เลนส์", lens],
      ["การเคลื่อนกล้อง", movement],
      ["ความสูงกล้อง", height],
      ["ความเร็วกล้อง", cameraSpeed],
      ["จุดโฟกัส", focus],
      ["ระยะชัดลึก", dof],
      ["องค์ประกอบภาพ", composition],
    ].filter(([, value]) => !value).map(([label]) => label);
    if (missingCamera.length) {
      throw new Error(`ฉาก ${index + 1}: กรุณาเลือก ${missingCamera.join(", ")} ก่อนสร้าง Prompt`);
    }

    const presenceLabels = Array.from(editor.querySelectorAll<HTMLLabelElement>("[class*='presenceChips'] label"));
    const names = presenceLabels.filter((label) => label.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).map((label) => compact(label.textContent));
    const characterIds = names.map((name) => characterIdByName.get(name.toLocaleLowerCase())).filter((id): id is string => Boolean(id));
    const dialogue = dialogueFromEditor(editor, characterIdByName, start, end);

    segments.push({
      id: `studio-scene-${index + 1}`,
      start,
      end,
      title,
      scene: title,
      location,
      characterIds,
      action: [action, continuity && `CONTINUITY: ${continuity}`, negative && `AVOID: ${negative}`].filter(Boolean).join("\n"),
      emotion,
      lighting,
      sound,
      cameraShots: [{
        id: `studio-shot-${index + 1}`,
        start,
        end,
        shotType,
        angle,
        lensMm: lensNumber(lens),
        cameraHeight: height,
        movement,
        movementSpeed: cameraSpeed,
        focus,
        depthOfField: dof,
        composition,
        foregroundOcclusion: "None",
      }],
      dialogue,
    });
  }

  sceneButtons()[originalIndex]?.click();
  await nextFrame();
  return { segments, usedDuration: cursor };
}

async function captureStudioSnapshot(): Promise<DirectSnapshot> {
  const setup = document.getElementById("setup");
  if (!setup) throw new Error("AI_STUDIO_NOT_READY");
  const modelSelect = setup.querySelector<HTMLSelectElement>('select[aria-label="โมเดลวิดีโอ"]');
  if (!modelSelect) throw new Error("VIDEO_MODEL_FIELD_NOT_FOUND");
  const modelValue = modelSelect.value;
  if (!modelValue) throw new Error("กรุณาเลือกโมเดลวิดีโอก่อนสร้าง Prompt");
  const meta = MODEL_META[modelValue] || { providerId: modelValue.toLocaleLowerCase(), label: compact(modelSelect.selectedOptions[0]?.textContent) || modelValue, mode: "generate" as const };
  const versionSelect = setup.querySelector<HTMLSelectElement>('select[aria-label="รุ่นโมเดล"]');
  const version = versionSelect?.value || meta.fixedVersion;
  const modelField = findField(setup, ["โมเดลวิดีโอ"]);
  const modelReady = compact(modelField?.textContent).includes("คีย์เชื่อมต่อแล้ว");
  const aspect = valueOf(setup, ["อัตราส่วนภาพ"]);
  if (!aspect) throw new Error("กรุณาเลือกอัตราส่วนภาพก่อนสร้าง Prompt");
  const visualStyle = valueOf(setup, ["สไตล์ภาพ"]);
  if (!visualStyle) throw new Error("กรุณาเลือกสไตล์ภาพก่อนสร้าง Prompt");
  const characters = captureCharacters();
  const { segments, usedDuration } = await captureSegments(characters);
  const title = valueOf(setup, ["ชื่อตอน"]) || "Untitled Episode";
  const story = valueOf(setup, ["เรื่อง / เหตุการณ์ของตอน"]);
  const durationValue = Math.max(1, Number(valueOf(setup, ["ความยาวรวมของตอน"]) || usedDuration || 1));
  const sourceInstruction = window.sessionStorage.getItem(SOURCE_INSTRUCTION_KEY) || "";
  const masterPrompt = window.sessionStorage.getItem(MASTER_PROMPT_KEY) || "";
  const negativePrompt = window.sessionStorage.getItem(NEGATIVE_PROMPT_KEY) || "";
  const lockTexts = selectedCheckboxText(setup);

  const episode: Episode = {
    id: `studio-episode-${Date.now()}`,
    number: 1,
    title,
    duration: durationValue as Episode["duration"],
    synopsis: story,
    status: "draft",
    segments,
  };
  const project: Project = {
    id: `studio-direct-${Date.now()}`,
    title,
    story,
    genre: "Cinematic",
    mood: segments[0]?.emotion || "Natural",
    aspectRatio: aspectValue(aspect),
    episodeCount: 1,
    mainModelId: meta.providerId,
    mainModelVersionId: version,
    modelMode: "single",
    promptMode: "assisted",
    resolution: "1080p",
    styleId: styleIdFor(visualStyle),
    locks: lockProfile(lockTexts),
    projectBible: [
      sourceInstruction && `# SOURCE INSTRUCTION\n${sourceInstruction}`,
      masterPrompt && `# USER APPROVED MASTER PROMPT\n${masterPrompt}`,
      negativePrompt && `# USER GLOBAL NEGATIVE PROMPT\n${negativePrompt}`,
      "DIRECT RENDER POLICY: Scene is an editorial scene/shot beat, not a render job. Split provider requests only by the selected model's maximum generation duration.",
    ].filter(Boolean).join("\n\n"),
    canon: [],
    characters,
    episodes: [episode],
  };
  return { project, providerId: meta.providerId, modelVersionId: version, modelLabel: meta.label, modelReady, modelMode: meta.mode };
}

export default function StudioDirectRenderBridge() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [snapshot, setSnapshot] = useState<DirectSnapshot | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [stale, setStale] = useState(false);
  const [status, setStatus] = useState("ซิงก์ข้อมูล Studio ก่อนสร้าง Prompt หรือ Direct Render");
  const [error, setError] = useState("");
  const capturingRef = useRef(false);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let observer: MutationObserver | null = null;
    const discover = () => {
      if (stopped) return;
      const review = document.getElementById("review");
      const main = review?.closest("main");
      if (!review || !main) {
        timer = window.setTimeout(discover, 80);
        return;
      }
      let node = document.getElementById("scenova-direct-render-host");
      if (!node) {
        node = document.createElement("div");
        node.id = "scenova-direct-render-host";
        review.insertAdjacentElement("afterend", node);
      }
      setHost(node);
      suppressLegacyAgentSubmit();
      observer = new MutationObserver(suppressLegacyAgentSubmit);
      observer.observe(main, { childList: true, subtree: true });
      const changed = () => {
        if (!capturingRef.current && snapshot) {
          setStale(true);
          setStatus("ข้อมูล Studio มีการแก้ไขหลังซิงก์ · กรุณาซิงก์ใหม่ก่อนสร้าง Prompt รอบถัดไป");
        }
      };
      main.addEventListener("input", changed, true);
      main.addEventListener("change", changed, true);
      (node as HTMLElement & { __cleanup?: () => void }).__cleanup = () => {
        main.removeEventListener("input", changed, true);
        main.removeEventListener("change", changed, true);
      };
    };
    discover();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      observer?.disconnect();
      const node = document.getElementById("scenova-direct-render-host") as (HTMLElement & { __cleanup?: () => void }) | null;
      node?.__cleanup?.();
    };
  // snapshot intentionally excluded; event registration is refreshed by the stale marker below.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A lightweight document listener keeps the stale flag accurate even though
  // the portal host is created once.
  useEffect(() => {
    if (!snapshot) return;
    const changed = () => {
      if (!capturingRef.current) {
        setStale(true);
        setStatus("ข้อมูล Studio มีการแก้ไขหลังซิงก์ · กรุณาซิงก์ใหม่ก่อนสร้าง Prompt รอบถัดไป");
      }
    };
    document.addEventListener("input", changed, true);
    document.addEventListener("change", changed, true);
    return () => {
      document.removeEventListener("input", changed, true);
      document.removeEventListener("change", changed, true);
    };
  }, [snapshot]);

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    setError("");
    setStatus("กำลังอ่าน Scene / Camera / Dialogue / Lighting / Sound ล่าสุดจาก AI Studio...");
    capturingRef.current = true;
    try {
      const next = await captureStudioSnapshot();
      setSnapshot(next);
      setStale(false);
      const episode = next.project.episodes[0];
      setStatus(`ซิงก์แล้ว · ${episode.segments.length} Scenes · ${episode.duration}s · ${next.modelLabel} · พร้อมสร้าง Prompt`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ซิงก์ข้อมูล Studio ไม่สำเร็จ");
    } finally {
      capturingRef.current = false;
      setSyncing(false);
    }
  }

  if (!host) return null;
  return createPortal(<div className={styles.shell}>
    <div className={styles.syncBar}>
      <div className={styles.syncCopy}><strong>Direct Render Data Sync</strong><span className={error ? styles.error : stale ? styles.stale : snapshot ? styles.ready : ""}>{error || status}</span></div>
      <div className={styles.actions}><button type="button" onClick={() => void syncNow()} disabled={syncing}>{syncing ? "กำลังซิงก์..." : snapshot ? "↻ ซิงก์ข้อมูลล่าสุด" : "ซิงก์ข้อมูล Studio"}</button></div>
    </div>
    {snapshot ? <DirectRenderPanel
      project={snapshot.project}
      providerId={snapshot.providerId}
      modelVersionId={snapshot.modelVersionId}
      modelLabel={snapshot.modelLabel}
      modelReady={snapshot.modelReady}
      modelMode={snapshot.modelMode}
    /> : <div className={styles.placeholder}>Direct Render จะใช้ข้อมูลที่คุณกรอกใน AI Studio เท่านั้น กด “ซิงก์ข้อมูล Studio” เพื่อเตรียม Structured Project สำหรับสร้าง Prompt / Copy Prompt / สร้างวิดีโอตรง โดยไม่ผ่าน AI Agent</div>}
  </div>, host);
}
