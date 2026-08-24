"use client";

import { useMemo, useState } from "react";
import styles from "./scenova-studio.module.css";

type Mode = "auto" | "scene" | "pro";
type InspectorTab = "story" | "camera" | "voice" | "light";

type CharacterSetup = {
  id: string;
  name: string;
  gender: "หญิง" | "ชาย" | "ไม่ระบุ";
  archetype: string;
  voice: string;
};

type ScenePlan = {
  id: string;
  title: string;
  duration: number;
  summary: string;
  shotType: string;
  angle: string;
  lens: string;
  height: string;
  movement: string;
  lighting: string;
  emotion: string;
  dialogue: string;
  sound: string;
};

const TOOLS = [
  ["/series", "EP Manager", "จัดการตอนและความยาว"],
  ["/dialogue", "Dialogue Director", "จัดบทพูดและจังหวะสนทนา"],
  ["/director", "Director Console", "กำกับ Timeline แบบละเอียด"],
  ["/reference", "Reference Lab", "วิเคราะห์วิดีโออ้างอิง"],
  ["/camera", "Camera Lab", "คลังมุมกล้องและ Lens"],
  ["/wallet", "Credit Wallet", "เครดิตและประวัติการใช้งาน"],
] as const;

const MODES = [
  {
    id: "auto" as const,
    icon: "✦",
    title: "AI ทำให้หมด",
    subtitle: "เลือกตัวละคร • เสียง • สไตล์ • แนวกล้อง แล้วให้ AI วางฉากและกำกับให้",
  },
  {
    id: "scene" as const,
    icon: "▦",
    title: "แบ่งฉากเอง",
    subtitle: "แต่ละฉากมีช่องใส่เรื่องด้านซ้าย และตัวเลือกกล้อง/เสียง/แสงด้านขวา",
  },
  {
    id: "pro" as const,
    icon: "◆",
    title: "Director Pro",
    subtitle: "ควบคุม Shot, Lens, Height, Movement, Dialogue, Emotion และ Lighting รายฉาก",
  },
];

const STYLE_OPTIONS = [
  "Cinematic Anime",
  "Photorealistic Film",
  "Warm Golden Hour",
  "Action Blockbuster",
  "Sci‑Fi Neon",
  "Fantasy Storybook",
  "Dark Thriller",
  "Cute 3D",
];

const VOICE_OPTIONS = [
  ["Mira", "หญิง • อบอุ่น • เป็นธรรมชาติ"],
  ["Nami", "หญิง • สดใส • วัยรุ่น"],
  ["Arin", "ชาย • สุขุม • ภาพยนตร์"],
  ["Keen", "ชาย • หนักแน่น • แอ็กชัน"],
  ["Luna", "หญิง • นุ่ม • แฟนตาซี"],
] as const;

const CAMERA_PRESETS = [
  ["AI เลือกให้", "AI เปลี่ยนมุมกล้องตามอารมณ์และการกระทำ"],
  ["Cinematic Natural", "เน้น 35–85mm, movement นุ่มและดูเป็นหนัง"],
  ["Dynamic Action", "Tracking, low angle, whip/push-in สำหรับฉากเร็ว"],
  ["Emotional", "Close-up, 65–85mm, push-in ช้า เน้นสีหน้า"],
  ["Anime Story", "สลับ wide/close-up/POV แบบงานเล่าเรื่องอนิเมะ"],
] as const;

const DEFAULT_CHARACTERS: CharacterSetup[] = [
  { id: "girl", name: "มินะ", gender: "หญิง", archetype: "ใจดี ช่างสงสัย กล้าขึ้นเมื่อจำเป็น", voice: "Mira" },
  { id: "boy", name: "เรน", gender: "ชาย", archetype: "สุขุม อ่อนโยน ปกป้องเพื่อน", voice: "Arin" },
  { id: "guest", name: "ตัวละคร 3", gender: "ไม่ระบุ", archetype: "กำหนดเอง", voice: "Nami" },
  { id: "guest2", name: "ตัวละคร 4", gender: "ไม่ระบุ", archetype: "กำหนดเอง", voice: "Keen" },
];

const DEFAULT_SCENES: ScenePlan[] = [
  {
    id: "s1",
    title: "ฉาก 1 — เปิดเรื่อง",
    duration: 8,
    summary: "หญิงสาวเดินกลับบ้านช่วงเย็น เมืองเงียบและมีแสงอาทิตย์ลอดตามตรอก",
    shotType: "Wide → Medium",
    angle: "Eye Level",
    lens: "35mm",
    height: "ระดับเอว",
    movement: "Slow Tracking",
    lighting: "Golden Hour",
    emotion: "สงบ • ชวนสงสัย",
    dialogue: "",
    sound: "เสียงเมืองเบา ๆ + ฝีเท้า",
  },
  {
    id: "s2",
    title: "ฉาก 2 — ได้ยินบางอย่าง",
    duration: 7,
    summary: "เธอหยุดเดิน หันมองหลัง และเริ่มรู้สึกว่ามีบางอย่างกำลังตามมา",
    shotType: "Medium → Close-up → POV",
    angle: "Three-quarter",
    lens: "50–85mm",
    height: "ระดับอก",
    movement: "Slow Push-in",
    lighting: "Warm Backlight",
    emotion: "สงสัย • ระวังตัว",
    dialogue: "มินะ: เอ๊ะ...เสียงอะไรนะ?",
    sound: "เสียงใบไม้ + ambience เงียบลง",
  },
  {
    id: "s3",
    title: "ฉาก 3 — พบสิ่งมีชีวิต",
    duration: 8,
    summary: "สิ่งมีชีวิตตัวเล็กโผล่จากมุมกำแพง ก่อนวิ่งหนีอย่างรวดเร็ว",
    shotType: "Low Close-up → Side Tracking",
    angle: "Low Angle",
    lens: "28–50mm",
    height: "10–20 ซม.",
    movement: "Quick Lateral Tracking",
    lighting: "Golden Rim Light",
    emotion: "ประหลาดใจ • น่ารัก",
    dialogue: "",
    sound: "เสียงกระดิ่งเล็ก + วิ่งเบา ๆ",
  },
  {
    id: "s4",
    title: "ฉาก 4 — วิ่งตาม",
    duration: 7,
    summary: "หญิงสาวยิ้มแล้ววิ่งตามสิ่งมีชีวิตไป กล้องเคลื่อนตามและจบด้วยภาพกว้าง",
    shotType: "Tracking → Extreme Wide",
    angle: "Low Rear",
    lens: "24–35mm",
    height: "20–40 ซม.",
    movement: "Tracking → Pull-back",
    lighting: "Warm Sunset",
    emotion: "อบอุ่น • สนุก",
    dialogue: "มินะ: รอฉันด้วย!",
    sound: "ดนตรีอบอุ่นเริ่มขึ้น",
  },
];

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className={styles.sectionTitle}>
      <span>{eyebrow}</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export default function ScenovaStudio() {
  const [mode, setMode] = useState<Mode>("auto");
  const [story, setStory] = useState("เด็กหญิงพบสิ่งมีชีวิตลึกลับระหว่างทางกลับบ้าน และค่อย ๆ กลายเป็นเพื่อนกัน");
  const [style, setStyle] = useState("Cinematic Anime");
  const [duration, setDuration] = useState(30);
  const [aspect, setAspect] = useState("9:16");
  const [castCount, setCastCount] = useState(2);
  const [hasPet, setHasPet] = useState(true);
  const [petType, setPetType] = useState("สิ่งมีชีวิตแฟนตาซีตัวเล็ก");
  const [cameraPreset, setCameraPreset] = useState("AI เลือกให้");
  const [characters, setCharacters] = useState(DEFAULT_CHARACTERS);
  const [scenes, setScenes] = useState(DEFAULT_SCENES);
  const [selectedSceneId, setSelectedSceneId] = useState("s1");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("story");
  const [status, setStatus] = useState("พร้อมออกแบบ");
  const [promptPreview, setPromptPreview] = useState("");
  const [uploadName, setUploadName] = useState("");

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? scenes[0];
  const activeCharacters = useMemo(() => characters.slice(0, castCount), [characters, castCount]);

  const patchCharacter = (id: string, patch: Partial<CharacterSetup>) => {
    setCharacters((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const patchScene = (id: string, patch: Partial<ScenePlan>) => {
    setScenes((current) => current.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene)));
  };

  const addScene = () => {
    const index = scenes.length + 1;
    const next: ScenePlan = {
      id: `s${Date.now()}`,
      title: `ฉาก ${index} — ฉากใหม่`,
      duration: 6,
      summary: "อธิบายว่าเกิดอะไรขึ้นในฉากนี้",
      shotType: "Medium",
      angle: "Eye Level",
      lens: "50mm",
      height: "ระดับอก",
      movement: "Static",
      lighting: "Natural Soft Light",
      emotion: "เป็นธรรมชาติ",
      dialogue: "",
      sound: "",
    };
    setScenes((current) => [...current, next]);
    setSelectedSceneId(next.id);
  };

  const playVoice = (voiceName: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setStatus("เบราว์เซอร์นี้ยังเล่นเสียงตัวอย่างไม่ได้");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("สวัสดีค่ะ นี่คือตัวอย่างเสียงสำหรับตัวละครใน SCENOVA");
    utterance.lang = "th-TH";
    utterance.rate = voiceName === "Keen" ? 0.9 : voiceName === "Nami" ? 1.08 : 0.98;
    utterance.pitch = voiceName === "Arin" || voiceName === "Keen" ? 0.82 : voiceName === "Luna" ? 1.16 : 1.04;
    const thaiVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("th"));
    if (thaiVoice) utterance.voice = thaiVoice;
    window.speechSynthesis.speak(utterance);
    setStatus(`กำลังเล่นตัวอย่างเสียง ${voiceName}`);
  };

  const buildPrompt = () => {
    const cast = activeCharacters.map((character) => `${character.name} (${character.gender}) — ${character.archetype}, voice ${character.voice}`).join("\n");
    const sceneText = scenes
      .map(
        (scene, index) =>
          `SCENE ${index + 1} | ${scene.duration}s\nStory: ${scene.summary}\nCamera: ${scene.shotType}, ${scene.angle}, ${scene.lens}, height ${scene.height}, ${scene.movement}\nLighting: ${scene.lighting}\nEmotion: ${scene.emotion}\nDialogue: ${scene.dialogue || "No dialogue"}\nSound: ${scene.sound || "Natural ambience"}`
      )
      .join("\n\n");
    setPromptPreview(
      `SCENOVA PRODUCTION PROMPT\nSTYLE: ${style}\nFORMAT: ${aspect}\nDURATION: ${duration}s\nCAMERA LANGUAGE: ${cameraPreset}\n\nSTORY\n${story}\n\nCHARACTERS\n${cast}${hasPet ? `\nCompanion/Pet: ${petType}` : ""}\n\n${sceneText}\n\nCONSISTENCY: Preserve face, body, costume, voice, props and visual style across all shots.\nNEGATIVE: no identity drift, no costume morphing, no duplicate limbs, no random text, no camera teleportation.`
    );
    setStatus("สร้าง Prompt Preview แล้ว");
  };

  const planWithAI = () => {
    setStatus("AI วางโครงเรื่อง กล้อง เสียง และฉากให้แล้ว — ตรวจได้ก่อนสร้างคลิป");
    setMode("scene");
  };

  const createClip = () => {
    setStatus("วางแผนสร้างคลิปแล้ว — ตอนนี้ใช้ Mock Provider และยังไม่เสียเครดิต");
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brandArea}>
          <div className={styles.logo}>S</div>
          <div>
            <strong>SCENOVA</strong>
            <span>AI Movie & Series Studio</span>
          </div>
        </div>
        <div className={styles.headerProject}>
          <b>โปรเจกต์ใหม่</b>
          <span>{duration} วินาที · {aspect} · {style}</span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.status}>{status}</span>
          <button className={styles.secondaryButton} onClick={buildPrompt}>✦ สร้าง Prompt</button>
          <button className={styles.primaryButton} onClick={createClip}>▶ สร้างคลิปเลย</button>
        </div>
      </header>

      <nav className={styles.toolSlider} aria-label="เครื่องมือเพิ่มเติม">
        {TOOLS.map(([href, label, description]) => (
          <a href={href} key={href} title={description}>
            <b>{label}</b><span>{description}</span>
          </a>
        ))}
      </nav>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>สร้างแบบที่คุณถนัด</span>
            <h1>ไม่ต้องวิ่งไปตั้งค่าทีละเมนูอีกแล้ว</h1>
            <p>เลือกโหมดก่อน จากนั้น SCENOVA จะแสดงเฉพาะสิ่งที่จำเป็นกับงานนั้น ตัวละครและ Reference อยู่ด้านบนเสมอ ส่วนการตั้งค่ากล้องจะอยู่กับฉากที่กำลังแก้ทันที</p>
          </div>
          <div className={styles.modeSelector}>
            {MODES.map((item) => (
              <button key={item.id} onClick={() => setMode(item.id)} className={mode === item.id ? styles.modeActive : ""}>
                <span className={styles.modeIcon}>{item.icon}</span>
                <b>{item.title}</b>
                <small>{item.subtitle}</small>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.assetDock}>
          <div className={styles.assetDockTitle}>
            <div><b>ตัวละคร & Reference</b><span>อยู่ด้านบนทุกโหมด เลือกจากคลังหรืออัปโหลดของคุณเองได้ทันที</span></div>
            <div className={styles.assetActions}>
              <button className={styles.smallButton}>＋ เลือกจากคลัง</button>
              <label className={styles.smallButton}>↑ อัปโหลดตัวละคร<input type="file" accept="image/*" hidden onChange={(event) => setUploadName(event.target.files?.[0]?.name ?? "")} /></label>
            </div>
          </div>
          <div className={styles.assetRow}>
            {activeCharacters.map((character, index) => (
              <div className={styles.characterChip} key={character.id}>
                <div className={styles.avatar}>{index + 1}</div>
                <div><b>{character.name}</b><span>{character.gender} · {character.voice}</span></div>
              </div>
            ))}
            {hasPet ? <div className={styles.characterChip}><div className={styles.petAvatar}>✦</div><div><b>สัตว์/สิ่งมีชีวิต</b><span>{petType}</span></div></div> : null}
            {uploadName ? <div className={styles.uploadBadge}>อัปโหลดแล้ว: {uploadName}</div> : null}
          </div>
        </section>

        {mode === "auto" ? (
          <section className={styles.autoLayout}>
            <div className={styles.autoMain}>
              <SectionTitle eyebrow="MODE 01" title="AI ทำให้หมด" description="คุณเลือกคน เสียง สไตล์ และความรู้สึกโดยรวม ที่เหลือ AI ช่วยคิดฉาก มุมกล้อง จังหวะตัด และ Prompt ให้ทั้งหมด" />

              <div className={styles.card}>
                <div className={styles.stepHead}><span>1</span><div><b>เล่าเรื่องสั้น ๆ</b><small>ไม่ต้องเขียน Prompt และไม่ต้องเขียนภาษากล้อง</small></div></div>
                <textarea className={styles.textareaLarge} value={story} onChange={(event) => setStory(event.target.value)} placeholder="เช่น ผู้หญิงกับผู้ชายเจอกันในสถานีรถไฟร้าง และพบแมวลึกลับ..." />
              </div>

              <div className={styles.card}>
                <div className={styles.stepHead}><span>2</span><div><b>ใครอยู่ในเรื่องนี้</b><small>เลือกจำนวนคน เพศ ชื่อ บุคลิก และเสียงของแต่ละคน</small></div></div>
                <div className={styles.quickGrid}>
                  <Field label="จำนวนตัวละครหลัก"><select value={castCount} onChange={(e) => setCastCount(Number(e.target.value))}>{[1,2,3,4].map((n) => <option key={n} value={n}>{n} คน</option>)}</select></Field>
                  <Field label="มีสัตว์เลี้ยง / Creature ไหม"><select value={hasPet ? "yes" : "no"} onChange={(e) => setHasPet(e.target.value === "yes")}><option value="no">ไม่มี</option><option value="yes">มี</option></select></Field>
                </div>
                <div className={styles.castGrid}>
                  {activeCharacters.map((character, index) => (
                    <div className={styles.castCard} key={character.id}>
                      <div className={styles.castTop}><div className={styles.avatarLarge}>{index + 1}</div><b>ตัวละคร {index + 1}</b></div>
                      <Field label="ชื่อ"><input value={character.name} onChange={(e) => patchCharacter(character.id, { name: e.target.value })} /></Field>
                      <Field label="เพศ"><select value={character.gender} onChange={(e) => patchCharacter(character.id, { gender: e.target.value as CharacterSetup["gender"] })}><option>หญิง</option><option>ชาย</option><option>ไม่ระบุ</option></select></Field>
                      <Field label="คาแรกเตอร์"><input value={character.archetype} onChange={(e) => patchCharacter(character.id, { archetype: e.target.value })} /></Field>
                      <Field label="เสียง" hint="กดฟังได้ทันทีด้วยเสียงในเบราว์เซอร์ ก่อนเชื่อม Voice Provider จริง">
                        <div className={styles.inlineControl}>
                          <select value={character.voice} onChange={(e) => patchCharacter(character.id, { voice: e.target.value })}>{VOICE_OPTIONS.map(([name, desc]) => <option key={name} value={name}>{name} — {desc}</option>)}</select>
                          <button onClick={() => playVoice(character.voice)}>▶ ฟัง</button>
                        </div>
                      </Field>
                    </div>
                  ))}
                </div>
                {hasPet ? <Field label="สัตว์เลี้ยง / สิ่งมีชีวิต"><input value={petType} onChange={(e) => setPetType(e.target.value)} placeholder="แมว, สุนัข, creature, หุ่นยนต์ตัวเล็ก..." /></Field> : null}
              </div>

              <div className={styles.card}>
                <div className={styles.stepHead}><span>3</span><div><b>หน้าตาของหนัง</b><small>เลือกสไตล์ เสียงรวม และแนวกล้องแบบง่าย ๆ</small></div></div>
                <div className={styles.quickGrid3}>
                  <Field label="สไตล์ภาพ"><select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLE_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="ความยาว"><select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{[10,15,30,60,90,120,150,180].map((n) => <option key={n} value={n}>{n < 60 ? `${n} วินาที` : `${n/60} นาที`}</option>)}</select></Field>
                  <Field label="อัตราส่วนภาพ"><select value={aspect} onChange={(e) => setAspect(e.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option><option>4:5</option></select></Field>
                </div>
                <div className={styles.cameraPresetGrid}>
                  {CAMERA_PRESETS.map(([name, desc]) => <button key={name} onClick={() => setCameraPreset(name)} className={cameraPreset === name ? styles.presetActive : ""}><b>{name}</b><span>{desc}</span></button>)}
                </div>
              </div>

              <button className={styles.bigAction} onClick={planWithAI}>✦ ให้ AI วางทุกฉาก + กล้อง + เสียงให้ แล้วค่อยตรวจ</button>
            </div>

            <aside className={styles.autoSummary}>
              <b>AI จะทำอะไรให้บ้าง</b>
              <div className={styles.checkList}><span>✓ แบ่งเรื่องเป็นฉาก</span><span>✓ เลือก Shot และ Lens</span><span>✓ วาง Camera Movement</span><span>✓ จัดบทพูดและจังหวะ</span><span>✓ วาง Lighting / Emotion</span><span>✓ ทำ Character & Style Lock</span><span>✓ สร้าง Production Prompt</span><span>✓ แบ่ง Render ตามโมเดล</span></div>
              <div className={styles.notice}>คุณยังแก้ทุกอย่างได้หลัง AI วางแผนเสร็จ ไม่มีการสร้างคลิปจริงจนกว่าจะกด “สร้างคลิปเลย”</div>
            </aside>
          </section>
        ) : null}

        {mode === "scene" ? (
          <section>
            <SectionTitle eyebrow="MODE 02" title="แบ่งฉากเอง — แก้เรื่องและกล้องในจุดเดียว" description="เลือกฉากทางซ้าย แล้วตัวเลือกของฉากนั้นจะแสดงทางขวาทันที ไม่ต้องออกจากหน้านี้เพื่อไป Camera Lab" />
            <div className={styles.sceneWorkspace}>
              <div className={styles.sceneList}>
                <div className={styles.sceneListHead}><b>ฉากทั้งหมด</b><button onClick={addScene}>＋ เพิ่มฉาก</button></div>
                {scenes.map((scene, index) => (
                  <button key={scene.id} onClick={() => setSelectedSceneId(scene.id)} className={selectedSceneId === scene.id ? styles.sceneActive : ""}>
                    <div className={styles.sceneNumber}>{String(index + 1).padStart(2, "0")}</div>
                    <div className={styles.sceneCopy}><b>{scene.title}</b><p>{scene.summary}</p><div><span>{scene.duration}s</span><span>{scene.shotType}</span><span>{scene.movement}</span></div></div>
                  </button>
                ))}
              </div>

              <div className={styles.sceneEditor}>
                <div className={styles.sceneEditorHead}><div><span>กำลังแก้</span><h3>{selectedScene.title}</h3></div><span className={styles.sceneDuration}>{selectedScene.duration} วินาที</span></div>
                <Field label="ชื่อฉาก"><input value={selectedScene.title} onChange={(e) => patchScene(selectedScene.id, { title: e.target.value })} /></Field>
                <Field label="เกิดอะไรขึ้นในฉากนี้" hint="เขียนเป็นภาษาธรรมดา AI จะช่วยแปลงเป็นภาษาหนัง"><textarea value={selectedScene.summary} onChange={(e) => patchScene(selectedScene.id, { summary: e.target.value })} /></Field>
                <div className={styles.quickGrid}>
                  <Field label="ความยาวฉาก"><input type="number" min={1} max={30} value={selectedScene.duration} onChange={(e) => patchScene(selectedScene.id, { duration: Number(e.target.value) })} /></Field>
                  <Field label="อารมณ์"><input value={selectedScene.emotion} onChange={(e) => patchScene(selectedScene.id, { emotion: e.target.value })} /></Field>
                </div>
                <Field label="บทพูด"><textarea value={selectedScene.dialogue} onChange={(e) => patchScene(selectedScene.id, { dialogue: e.target.value })} placeholder="มินะ: เอ๊ะ...เสียงอะไรนะ?" /></Field>
                <Field label="เสียง / SFX / บรรยากาศ"><input value={selectedScene.sound} onChange={(e) => patchScene(selectedScene.id, { sound: e.target.value })} /></Field>
              </div>

              <aside className={styles.inspector}>
                <div className={styles.inspectorTabs}>
                  {(["story","camera","voice","light"] as InspectorTab[]).map((tab) => <button key={tab} onClick={() => setInspectorTab(tab)} className={inspectorTab === tab ? styles.inspectorActive : ""}>{tab === "story" ? "ฉาก" : tab === "camera" ? "กล้อง" : tab === "voice" ? "เสียง" : "แสง"}</button>)}
                </div>
                {inspectorTab === "story" ? <div className={styles.inspectorBody}><h4>AI ช่วยฉากนี้</h4><button className={styles.inspectorChoice}>✦ เพิ่มรายละเอียดให้ฉาก</button><button className={styles.inspectorChoice}>↔ ทำให้เชื่อมกับฉากก่อนหน้า</button><button className={styles.inspectorChoice}>⚡ เพิ่มความตื่นเต้น</button><button className={styles.inspectorChoice}>♡ เน้นอารมณ์ตัวละคร</button></div> : null}
                {inspectorTab === "camera" ? <CameraInspector scene={selectedScene} patch={(patch) => patchScene(selectedScene.id, patch)} simple /> : null}
                {inspectorTab === "voice" ? <div className={styles.inspectorBody}><h4>เสียงของฉาก</h4><Field label="Dialogue"><textarea value={selectedScene.dialogue} onChange={(e) => patchScene(selectedScene.id, { dialogue: e.target.value })} /></Field><Field label="Sound Design"><input value={selectedScene.sound} onChange={(e) => patchScene(selectedScene.id, { sound: e.target.value })} /></Field>{activeCharacters.map((c) => <button key={c.id} className={styles.voicePreview} onClick={() => playVoice(c.voice)}>▶ {c.name} — {c.voice}</button>)}</div> : null}
                {inspectorTab === "light" ? <div className={styles.inspectorBody}><h4>Lighting & Mood</h4><Field label="แสง"><select value={selectedScene.lighting} onChange={(e) => patchScene(selectedScene.id, { lighting: e.target.value })}><option>Golden Hour</option><option>Warm Backlight</option><option>Natural Soft Light</option><option>Blue Hour</option><option>Neon Night</option><option>High Contrast</option><option>Moonlight</option></select></Field><Field label="อารมณ์"><input value={selectedScene.emotion} onChange={(e) => patchScene(selectedScene.id, { emotion: e.target.value })} /></Field></div> : null}
              </aside>
            </div>
          </section>
        ) : null}

        {mode === "pro" ? (
          <section>
            <SectionTitle eyebrow="MODE 03" title="Director Pro" description="โหมดมืออาชีพ ทุกฉากมี Shot/Lens/Camera Height/Movement/Dialogue/Emotion/Lighting ของตัวเอง และแก้ได้โดยไม่เปลี่ยนหน้าจอ" />
            <div className={styles.proWorkspace}>
              <div className={styles.proSceneRail}>
                <div className={styles.sceneListHead}><b>SCENES</b><button onClick={addScene}>＋</button></div>
                {scenes.map((scene, index) => <button key={scene.id} onClick={() => setSelectedSceneId(scene.id)} className={selectedSceneId === scene.id ? styles.sceneActive : ""}><b>{String(index + 1).padStart(2,"0")}</b><span>{scene.title.replace(/^ฉาก \d+ — /, "")}</span><small>{scene.duration}s · {scene.lens}</small></button>)}
              </div>
              <div className={styles.proCenter}>
                <div className={styles.timelineHeader}><b>Timeline / Shot Plan</b><span>EP {duration}s</span></div>
                <div className={styles.timelineBar}>{scenes.map((scene, index) => <button key={scene.id} onClick={() => setSelectedSceneId(scene.id)} className={selectedSceneId === scene.id ? styles.timelineActive : ""} style={{ flex: Math.max(scene.duration, 2) }}><b>S{index+1}</b><span>{scene.duration}s</span></button>)}</div>
                <div className={styles.proSceneCard}>
                  <div className={styles.proSceneTop}><div><span>ACTIVE SCENE</span><h3>{selectedScene.title}</h3></div><button className={styles.smallButton}>✦ AI เสนอ Shot เพิ่ม</button></div>
                  <Field label="Action / Story"><textarea value={selectedScene.summary} onChange={(e) => patchScene(selectedScene.id, { summary: e.target.value })} /></Field>
                  <div className={styles.quickGrid}><Field label="Dialogue"><textarea value={selectedScene.dialogue} onChange={(e) => patchScene(selectedScene.id, { dialogue: e.target.value })} /></Field><Field label="Emotion"><textarea value={selectedScene.emotion} onChange={(e) => patchScene(selectedScene.id, { emotion: e.target.value })} /></Field></div>
                  <Field label="Sound Design"><input value={selectedScene.sound} onChange={(e) => patchScene(selectedScene.id, { sound: e.target.value })} /></Field>
                </div>
              </div>
              <aside className={styles.proInspector}>
                <div className={styles.proInspectorHead}><span>DIRECTOR INSPECTOR</span><b>Camera / Light</b></div>
                <CameraInspector scene={selectedScene} patch={(patch) => patchScene(selectedScene.id, patch)} />
                <div className={styles.divider} />
                <Field label="Lighting"><select value={selectedScene.lighting} onChange={(e) => patchScene(selectedScene.id, { lighting: e.target.value })}><option>Golden Hour</option><option>Warm Backlight</option><option>Blue Hour</option><option>Neon Night</option><option>High Contrast</option><option>Moonlight</option></select></Field>
                <button className={styles.aiAssistButton}>✦ ให้ AI ปรับกล้องโดยรักษาค่าที่ล็อกไว้</button>
              </aside>
            </div>
          </section>
        ) : null}

        {promptPreview ? <section className={styles.promptPreview}><div className={styles.promptHead}><div><span>PROMPT PREVIEW</span><b>Production Prompt ที่จะใช้</b></div><button onClick={() => navigator.clipboard?.writeText(promptPreview)}>คัดลอก</button></div><pre>{promptPreview}</pre></section> : null}

        <section className={styles.bottomActions}>
          <div><b>พร้อมเมื่อคุณพร้อม</b><span>สร้าง Prompt เพื่อเอาไปใช้ภายนอก หรือสร้างคลิปใน SCENOVA โดย AI + ระบบช่วยกันกำกับ</span></div>
          <div><button className={styles.secondaryButton} onClick={buildPrompt}>✦ สร้าง Prompt</button><button className={styles.primaryButton} onClick={createClip}>▶ สร้างคลิปเลย</button></div>
        </section>
      </main>
    </div>
  );
}

function CameraInspector({ scene, patch, simple = false }: { scene: ScenePlan; patch: (patch: Partial<ScenePlan>) => void; simple?: boolean }) {
  return (
    <div className={styles.inspectorBody}>
      <h4>{simple ? "มุมกล้องของฉากนี้" : "Camera Control"}</h4>
      <Field label="Shot Type" hint="ขนาดภาพ เช่น Wide เพื่อเห็นสถานที่, Close-up เพื่อเน้นอารมณ์"><select value={scene.shotType} onChange={(e) => patch({ shotType: e.target.value })}><option>Extreme Wide</option><option>Wide → Medium</option><option>Medium</option><option>Medium → Close-up → POV</option><option>Close-up</option><option>Low Close-up → Side Tracking</option><option>Tracking → Extreme Wide</option><option>POV</option><option>OTS</option></select></Field>
      <Field label="Camera Angle"><select value={scene.angle} onChange={(e) => patch({ angle: e.target.value })}><option>Eye Level</option><option>Low Angle</option><option>Extreme Low Angle</option><option>High Angle</option><option>Three-quarter</option><option>Rear View</option><option>Side View</option><option>Top View</option></select></Field>
      <Field label="Lens"><select value={scene.lens} onChange={(e) => patch({ lens: e.target.value })}><option>18mm</option><option>24mm</option><option>28mm</option><option>35mm</option><option>50mm</option><option>65mm</option><option>85mm</option><option>100mm</option><option>24–35mm</option><option>28–50mm</option><option>50–85mm</option></select></Field>
      {!simple ? <Field label="Camera Height"><input value={scene.height} onChange={(e) => patch({ height: e.target.value })} /></Field> : null}
      <Field label="Movement"><select value={scene.movement} onChange={(e) => patch({ movement: e.target.value })}><option>Static</option><option>Slow Tracking</option><option>Slow Push-in</option><option>Quick Lateral Tracking</option><option>Tracking → Pull-back</option><option>Dolly In</option><option>Dolly Out</option><option>Orbit</option><option>Whip Pan</option><option>Crane</option></select></Field>
      <div className={styles.cameraTip}>ⓘ ค่านี้เป็นของ “ฉากที่เลือกอยู่” เท่านั้น เปลี่ยนฉากแล้วค่ากล้องจะเปลี่ยนตามฉาก ไม่ต้องกลับไปตั้งค่าใหม่ทั้งเรื่อง</div>
    </div>
  );
}
