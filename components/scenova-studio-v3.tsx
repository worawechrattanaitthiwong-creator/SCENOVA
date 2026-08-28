"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./story-mode.module.css";
import { VOICE_PROFILES } from "@/lib/sound-design-options";

type Character = {
  id: string;
  name: string;
  role: string;
  appearance: string;
  voice: string;
};

type Animal = {
  id: string;
  name: string;
  species: string;
  appearance: string;
  behavior: string;
};

type StoryScene = {
  id: string;
  title: string;
  duration: number;
  location: string;
  action: string;
  dialogue: string;
  characterIds: string[];
  animalIds: string[];
};

type SelectedCharacterPayload = {
  id?: string;
  title?: string;
  metadata?: {
    role?: string;
    appearance?: string;
    personality?: string;
    costume?: string;
    voiceProfile?: string;
    promptHint?: string;
  };
};

type DraftPayload = {
  model?: string;
  aspect?: string;
  visualStyle?: string;
  story?: string;
  characters?: Character[];
  hasAnimals?: boolean;
  animals?: Animal[];
  totalDuration?: number;
  scenes?: StoryScene[];
};

const MODELS = ["Seedance 2.5", "Kling", "Veo", "Runway", "Wan"];
const STYLES = [
  "Cinematic Anime — อนิเมะภาพยนตร์",
  "Photorealistic Film — สมจริงแบบภาพยนตร์",
  "Warm Golden Hour — อบอุ่นแสงทอง",
  "Action Blockbuster — แอ็กชันบล็อกบัสเตอร์",
  "Sci-Fi Neon — ไซไฟนีออน",
  "Fantasy Storybook — แฟนตาซีภาพเล่าเรื่อง",
  "Dark Thriller — ทริลเลอร์โทนมืด",
  "Gothic Horror — สยองขวัญโกธิก",
  "Cinematic Romance — โรแมนติกภาพยนตร์",
  "Period Drama — ดราม่าย้อนยุค",
];
const ASPECTS = ["16:9 — Widescreen", "9:16 — Vertical", "1:1 — Square", "4:5 — Portrait"];
const ROLES = ["ตัวละครหลัก", "ตัวละครรอง", "ฝ่ายตรงข้าม", "ตัวละครรับเชิญ"];

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeCharacter(index: number): Character {
  return {
    id: makeId("character"),
    name: `ตัวละคร ${index}`,
    role: index === 1 ? "ตัวละครหลัก" : "ตัวละครรอง",
    appearance: "",
    voice: VOICE_PROFILES[0] || "Default",
  };
}

function makeAnimal(index: number): Animal {
  return {
    id: makeId("animal"),
    name: `สัตว์ ${index}`,
    species: "",
    appearance: "",
    behavior: "",
  };
}

function makeScene(index: number, duration: number): StoryScene {
  return {
    id: makeId("scene"),
    title: `ฉาก ${index}`,
    duration,
    location: "",
    action: "",
    dialogue: "",
    characterIds: [],
    animalIds: [],
  };
}

function distributeScenes(current: StoryScene[], count: number, total: number): StoryScene[] {
  const safeCount = Math.max(1, Math.min(count, Math.min(12, total)));
  const base = Math.floor(total / safeCount);
  let remainder = total - base * safeCount;

  return Array.from({ length: safeCount }, (_, index) => {
    const duration = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    const existing = current[index];
    return existing
      ? { ...existing, duration, title: existing.title || `ฉาก ${index + 1}` }
      : makeScene(index + 1, duration);
  });
}

function fitScenesToTotal(current: StoryScene[], total: number): StoryScene[] {
  const next = current.slice(0, Math.min(current.length, total)).map((scene) => ({ ...scene }));
  let overflow = next.reduce((sum, scene) => sum + scene.duration, 0) - total;
  for (let index = next.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const reducible = Math.max(0, next[index].duration - 1);
    const cut = Math.min(reducible, overflow);
    next[index].duration -= cut;
    overflow -= cut;
  }
  return next;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function Counter({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (value: number) => void; label: string }) {
  return (
    <div className={styles.counter} aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`ลด${label}`}>−</button>
      <strong>{value}</strong>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`เพิ่ม${label}`}>＋</button>
    </div>
  );
}

export default function ScenovaStudioV3() {
  const [model, setModel] = useState("Seedance 2.5");
  const [aspect, setAspect] = useState("16:9 — Widescreen");
  const [visualStyle, setVisualStyle] = useState(STYLES[0]);
  const [story, setStory] = useState("");
  const [characters, setCharacters] = useState<Character[]>([makeCharacter(1), makeCharacter(2)]);
  const [hasAnimals, setHasAnimals] = useState(false);
  const [animals, setAnimals] = useState<Animal[]>([makeAnimal(1)]);
  const [totalDuration, setTotalDuration] = useState(30);
  const [scenes, setScenes] = useState<StoryScene[]>(() => distributeScenes([], 3, 30));
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [message, setMessage] = useState("พร้อมเริ่มวางเรื่อง");

  useEffect(() => {
    const raw = localStorage.getItem("scenova-story-draft-v1");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as DraftPayload;
      if (draft.model && MODELS.includes(draft.model)) setModel(draft.model);
      if (draft.aspect && ASPECTS.includes(draft.aspect)) setAspect(draft.aspect);
      if (draft.visualStyle && STYLES.includes(draft.visualStyle)) setVisualStyle(draft.visualStyle);
      if (typeof draft.story === "string") setStory(draft.story);
      if (Array.isArray(draft.characters) && draft.characters.length) setCharacters(draft.characters.slice(0, 8));
      if (typeof draft.hasAnimals === "boolean") setHasAnimals(draft.hasAnimals);
      if (Array.isArray(draft.animals) && draft.animals.length) setAnimals(draft.animals.slice(0, 4));
      if (typeof draft.totalDuration === "number") setTotalDuration(Math.max(10, Math.min(180, draft.totalDuration)));
      if (Array.isArray(draft.scenes) && draft.scenes.length) setScenes(draft.scenes.slice(0, 12));
      setMessage("เปิดร่างล่าสุดแล้ว");
    } catch {
      localStorage.removeItem("scenova-story-draft-v1");
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("scenova-selected-character-v1");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as SelectedCharacterPayload;
      if (!payload.title) return;
      const meta = payload.metadata || {};
      const detail = [meta.appearance, meta.personality && `บุคลิก: ${meta.personality}`, meta.costume && `ชุด: ${meta.costume}`, meta.promptHint].filter(Boolean).join("\n");
      setCharacters((current) => {
        const imported: Character = {
          id: payload.id ? `library_${payload.id}` : makeId("library"),
          name: payload.title || "ตัวละครจากคลัง",
          role: meta.role?.toLowerCase().includes("protagonist") ? "ตัวละครหลัก" : "ตัวละครรอง",
          appearance: detail || "นำเข้าจากคลังตัวละคร",
          voice: meta.voiceProfile && VOICE_PROFILES.includes(meta.voiceProfile) ? meta.voiceProfile : VOICE_PROFILES[0] || "Default",
        };
        return [imported, ...current.filter((item) => item.id !== imported.id)].slice(0, 8);
      });
      setMessage(`นำเข้า ${payload.title} แล้ว`);
    } catch {
      setMessage("อ่านข้อมูลตัวละครจากคลังไม่สำเร็จ");
    } finally {
      localStorage.removeItem("scenova-selected-character-v1");
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("scenova-selected-style-v1");
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as { title?: string };
      const title = payload.title?.trim();
      const matched = title ? STYLES.find((item) => item.toLowerCase().startsWith(title.toLowerCase())) : undefined;
      if (matched) setVisualStyle(matched);
    } finally {
      localStorage.removeItem("scenova-selected-style-v1");
    }
  }, []);

  useEffect(() => {
    if (!selectedSceneId && scenes[0]) setSelectedSceneId(scenes[0].id);
    if (selectedSceneId && !scenes.some((scene) => scene.id === selectedSceneId) && scenes[0]) setSelectedSceneId(scenes[0].id);
  }, [scenes, selectedSceneId]);

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];
  const usedDuration = useMemo(() => scenes.reduce((sum, scene) => sum + scene.duration, 0), [scenes]);
  const remainingDuration = Math.max(0, totalDuration - usedDuration);
  const sceneTimes = useMemo(() => {
    let cursor = 0;
    return scenes.map((scene) => {
      const start = cursor;
      cursor += scene.duration;
      return { id: scene.id, start, end: cursor };
    });
  }, [scenes]);

  function resizeCharacters(count: number) {
    const safeCount = Math.max(1, Math.min(8, count));
    const next = characters.slice(0, safeCount);
    while (next.length < safeCount) next.push(makeCharacter(next.length + 1));
    const allowed = new Set(next.map((item) => item.id));
    setCharacters(next);
    setScenes((current) => current.map((scene) => ({ ...scene, characterIds: scene.characterIds.filter((id) => allowed.has(id)) })));
  }

  function resizeAnimals(count: number) {
    const safeCount = Math.max(1, Math.min(4, count));
    const next = animals.slice(0, safeCount);
    while (next.length < safeCount) next.push(makeAnimal(next.length + 1));
    const allowed = new Set(next.map((item) => item.id));
    setAnimals(next);
    setScenes((current) => current.map((scene) => ({ ...scene, animalIds: scene.animalIds.filter((id) => allowed.has(id)) })));
  }

  function toggleAnimals(enabled: boolean) {
    setHasAnimals(enabled);
    if (!enabled) setScenes((current) => current.map((scene) => ({ ...scene, animalIds: [] })));
  }

  function resizeScenes(count: number) {
    setScenes((current) => distributeScenes(current, count, totalDuration));
  }

  function changeTotalDuration(value: number) {
    const next = Math.max(10, Math.min(180, value));
    setTotalDuration(next);
    setScenes((current) => fitScenesToTotal(current, next));
  }

  function patchCharacter(id: string, patch: Partial<Character>) {
    setCharacters((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function patchAnimal(id: string, patch: Partial<Animal>) {
    setAnimals((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function patchScene(patch: Partial<StoryScene>) {
    if (!selectedScene) return;
    setScenes((current) => current.map((scene) => scene.id === selectedScene.id ? { ...scene, ...patch } : scene));
  }

  function changeSceneDuration(value: number) {
    if (!selectedScene) return;
    setScenes((current) => {
      const otherDuration = current.reduce((sum, scene) => sum + (scene.id === selectedScene.id ? 0 : scene.duration), 0);
      const maxDuration = Math.max(1, totalDuration - otherDuration);
      const nextDuration = Math.max(1, Math.min(value, maxDuration));
      return current.map((scene) => scene.id === selectedScene.id ? { ...scene, duration: nextDuration } : scene);
    });
  }

  function toggleSceneCharacter(id: string) {
    if (!selectedScene) return;
    patchScene({ characterIds: selectedScene.characterIds.includes(id) ? selectedScene.characterIds.filter((item) => item !== id) : [...selectedScene.characterIds, id] });
  }

  function toggleSceneAnimal(id: string) {
    if (!selectedScene) return;
    patchScene({ animalIds: selectedScene.animalIds.includes(id) ? selectedScene.animalIds.filter((item) => item !== id) : [...selectedScene.animalIds, id] });
  }

  function saveDraft() {
    localStorage.setItem("scenova-story-draft-v1", JSON.stringify({ model, aspect, visualStyle, story, characters, hasAnimals, animals: hasAnimals ? animals : [], totalDuration, scenes }));
    setMessage("บันทึกร่างแล้ว");
  }

  return (
    <main className={styles.main}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>STORY MODE</span>
          <h1>วางเรื่องและฉาก</h1>
          <p>กรอกเฉพาะข้อมูลที่ต้องใช้จริง แล้วกำหนดว่าแต่ละฉากเกิดอะไรขึ้นและใช้เวลากี่วินาที</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.status}>{message}</span>
          <button type="button" className={styles.secondaryButton} onClick={saveDraft}>บันทึกร่าง</button>
          <Link className={styles.primaryButton} href="/render" onClick={saveDraft}>Prompt & Render →</Link>
        </div>
      </header>

      <section className={styles.section} aria-labelledby="story-heading">
        <div className={styles.sectionTitle}>
          <div><span>เรื่องหลัก</span><h2 id="story-heading">กำหนดสิ่งที่จะเล่า</h2></div>
          <p>เริ่มจากเรื่องสั้น ๆ ก่อน รายละเอียดภาพและการแสดงค่อยกำหนดในฉาก</p>
        </div>

        <div className={styles.foundationGrid}>
          <label className={`${styles.field} ${styles.storyField}`}>
            <span>เรื่องที่ต้องการสร้าง</span>
            <textarea value={story} onChange={(event) => setStory(event.target.value)} placeholder="ตัวอย่าง: เด็กหญิงหลงเข้าไปในป่าลึกลับและพบสุนัขที่ช่วยพาเธอกลับบ้าน..." />
            <small>เขียนแก่นเรื่องตรง ๆ ระบบจะใช้ข้อความนี้เป็นฐานของทุกฉาก</small>
          </label>

          <div className={styles.settingsGrid}>
            <label className={styles.field}><span>โมเดลวิดีโอ</span><select value={model} onChange={(event) => setModel(event.target.value)}>{MODELS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className={styles.field}><span>อัตราส่วนภาพ</span><select value={aspect} onChange={(event) => setAspect(event.target.value)}>{ASPECTS.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className={styles.field}><span>สไตล์ภาพ</span><select value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)}>{STYLES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <div className={styles.libraryHint}><span>ต้องการใช้ตัวละครหรือสไตล์เดิม?</span><Link href="/libraries">เปิดคลังทรัพยากร</Link></div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="cast-heading">
        <div className={styles.sectionTitleRow}>
          <div className={styles.sectionTitle}>
            <div><span>ตัวละคร</span><h2 id="cast-heading">ใครอยู่ในเรื่องนี้</h2></div>
            <p>กำหนดจำนวนก่อน แล้วใส่เฉพาะข้อมูลที่จำเป็นต่อการรักษาตัวละครให้เหมือนเดิม</p>
          </div>
          <div className={styles.countControl}><span>จำนวนตัวละคร</span><Counter label="จำนวนตัวละคร" value={characters.length} min={1} max={8} onChange={resizeCharacters} /></div>
        </div>

        <div className={styles.castList}>
          {characters.map((character, index) => (
            <article className={styles.castRow} key={character.id}>
              <b className={styles.itemNumber}>{index + 1}</b>
              <label className={styles.field}><span>ชื่อ</span><input value={character.name} onChange={(event) => patchCharacter(character.id, { name: event.target.value })} /></label>
              <label className={styles.field}><span>บทบาท</span><select value={character.role} onChange={(event) => patchCharacter(character.id, { role: event.target.value })}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
              <label className={styles.field}><span>เสียง</span><select value={character.voice} onChange={(event) => patchCharacter(character.id, { voice: event.target.value })}>{VOICE_PROFILES.map((voice) => <option key={voice}>{voice}</option>)}</select></label>
              <label className={`${styles.field} ${styles.castDetail}`}><span>รูปลักษณ์และบุคลิก</span><textarea value={character.appearance} onChange={(event) => patchCharacter(character.id, { appearance: event.target.value })} placeholder="หน้าตา เสื้อผ้า อายุโดยประมาณ บุคลิก และจุดสังเกตสำคัญ" /></label>
            </article>
          ))}
        </div>

        <div className={styles.animalToggle}>
          <div><strong>มีสัตว์หรือสิ่งมีชีวิตในเรื่องหรือไม่?</strong><span>ถ้าไม่มี ส่วนนี้จะไม่ถูกนำไปใช้ในฉาก</span></div>
          <div><button type="button" className={!hasAnimals ? styles.toggleActive : ""} onClick={() => toggleAnimals(false)}>ไม่มี</button><button type="button" className={hasAnimals ? styles.toggleActive : ""} onClick={() => toggleAnimals(true)}>มี</button></div>
        </div>

        {hasAnimals ? (
          <div className={styles.animalBlock}>
            <div className={styles.animalHeading}><strong>สัตว์ / สิ่งมีชีวิต</strong><div className={styles.countControl}><span>จำนวน</span><Counter label="จำนวนสัตว์" value={animals.length} min={1} max={4} onChange={resizeAnimals} /></div></div>
            <div className={styles.castList}>
              {animals.map((animal, index) => (
                <article className={styles.castRow} key={animal.id}>
                  <b className={styles.itemNumber}>{index + 1}</b>
                  <label className={styles.field}><span>ชื่อ</span><input value={animal.name} onChange={(event) => patchAnimal(animal.id, { name: event.target.value })} /></label>
                  <label className={styles.field}><span>ชนิด</span><input value={animal.species} onChange={(event) => patchAnimal(animal.id, { species: event.target.value })} placeholder="สุนัข, แมว, มังกร..." /></label>
                  <label className={styles.field}><span>พฤติกรรม</span><input value={animal.behavior} onChange={(event) => patchAnimal(animal.id, { behavior: event.target.value })} placeholder="เชื่อง, ดุ, ขี้เล่น..." /></label>
                  <label className={`${styles.field} ${styles.castDetail}`}><span>รูปลักษณ์</span><textarea value={animal.appearance} onChange={(event) => patchAnimal(animal.id, { appearance: event.target.value })} placeholder="สี ขนาด ลักษณะเด่น หรือเครื่องหมายเฉพาะ" /></label>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className={`${styles.section} ${styles.sceneSection}`} aria-labelledby="scene-heading">
        <div className={styles.sectionTitleRow}>
          <div className={styles.sectionTitle}>
            <div><span>ฉากและเวลา</span><h2 id="scene-heading">แบ่งเรื่องเป็นฉาก</h2></div>
            <p>เลือกฉากจากด้านซ้าย แล้วแก้รายละเอียดด้านขวา เวลาแต่ละฉากเลื่อนได้โดยตรง</p>
          </div>
          <div className={styles.countControl}><span>จำนวนฉาก</span><Counter label="จำนวนฉาก" value={scenes.length} min={1} max={12} onChange={resizeScenes} /></div>
        </div>

        <div className={styles.durationControl}>
          <div><span>เวลารวมของเรื่อง</span><strong>{totalDuration} วินาที</strong></div>
          <input type="range" min={10} max={180} step={5} value={totalDuration} onChange={(event) => changeTotalDuration(Number(event.target.value))} />
          <small>ใช้ในฉากแล้ว {usedDuration} วินาที{remainingDuration > 0 ? ` • เหลือยังไม่จัด ${remainingDuration} วินาที` : " • จัดเวลาครบแล้ว"}</small>
        </div>

        <div className={styles.timeline} aria-label="ไทม์ไลน์ฉาก">
          {scenes.map((scene, index) => {
            const time = sceneTimes[index];
            return (
              <button type="button" key={scene.id} className={scene.id === selectedScene?.id ? styles.timelineActive : ""} onClick={() => setSelectedSceneId(scene.id)} style={{ flexGrow: Math.max(1, scene.duration) }}>
                <b>{index + 1}</b><span>{scene.duration}s</span>
              </button>
            );
          })}
        </div>

        <div className={styles.sceneWorkspace}>
          <aside className={styles.sceneList} aria-label="รายการฉาก">
            {scenes.map((scene, index) => {
              const time = sceneTimes[index];
              return (
                <button type="button" key={scene.id} className={scene.id === selectedScene?.id ? styles.sceneActive : ""} onClick={() => setSelectedSceneId(scene.id)}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <span><strong>{scene.title}</strong><small>{formatTime(time?.start || 0)}–{formatTime(time?.end || scene.duration)} • {scene.duration} วินาที</small></span>
                </button>
              );
            })}
          </aside>

          {selectedScene ? (
            <div className={styles.sceneEditor}>
              <div className={styles.sceneEditorHead}>
                <div><span>กำลังแก้ไข</span><h3>{selectedScene.title}</h3></div>
                <strong>{selectedScene.duration} วินาที</strong>
              </div>

              <div className={styles.sceneFormGrid}>
                <label className={styles.field}><span>ชื่อฉาก</span><input value={selectedScene.title} onChange={(event) => patchScene({ title: event.target.value })} /></label>
                <label className={styles.field}><span>สถานที่</span><input value={selectedScene.location} onChange={(event) => patchScene({ location: event.target.value })} placeholder="บ้าน, โรงเรียน, ป่า, ถนนกลางคืน..." /></label>
              </div>

              <div className={styles.sceneDuration}>
                <div><span>เวลาของฉากนี้</span><strong>{selectedScene.duration} วินาที</strong></div>
                <input type="range" min={1} max={Math.max(1, selectedScene.duration + remainingDuration)} value={selectedScene.duration} onChange={(event) => changeSceneDuration(Number(event.target.value))} />
                <small>ลากเพื่อเพิ่มหรือลดเวลา ระบบจะไม่ให้เวลารวมเกิน {totalDuration} วินาที</small>
              </div>

              <div className={styles.presenceBlock}>
                <span>ตัวละครในฉากนี้</span>
                <div>{characters.map((character) => <label key={character.id} className={selectedScene.characterIds.includes(character.id) ? styles.presenceActive : ""}><input type="checkbox" checked={selectedScene.characterIds.includes(character.id)} onChange={() => toggleSceneCharacter(character.id)} />{character.name}</label>)}</div>
              </div>

              {hasAnimals ? (
                <div className={styles.presenceBlock}>
                  <span>สัตว์ / สิ่งมีชีวิตในฉากนี้</span>
                  <div>{animals.map((animal) => <label key={animal.id} className={selectedScene.animalIds.includes(animal.id) ? styles.presenceActive : ""}><input type="checkbox" checked={selectedScene.animalIds.includes(animal.id)} onChange={() => toggleSceneAnimal(animal.id)} />{animal.name}</label>)}</div>
                </div>
              ) : null}

              <label className={styles.field}><span>เกิดอะไรขึ้นในฉากนี้</span><textarea className={styles.actionText} value={selectedScene.action} onChange={(event) => patchScene({ action: event.target.value })} placeholder="บอกตรง ๆ ว่าใครทำอะไร ฉากเริ่มอย่างไร และจบอย่างไร" /></label>
              <label className={styles.field}><span>บทพูด (ถ้ามี)</span><textarea value={selectedScene.dialogue} onChange={(event) => patchScene({ dialogue: event.target.value })} placeholder={'ตัวละคร 1: ...\nตัวละคร 2: ...'} /></label>
            </div>
          ) : null}
        </div>
      </section>

      <footer className={styles.footerBar}>
        <div><strong>{scenes.length} ฉาก</strong><span> • {characters.length} ตัวละคร{hasAnimals ? ` • ${animals.length} สัตว์/สิ่งมีชีวิต` : ""} • {usedDuration}/{totalDuration} วินาที</span></div>
        <div><button type="button" className={styles.secondaryButton} onClick={saveDraft}>บันทึกร่าง</button><Link className={styles.primaryButton} href="/render" onClick={saveDraft}>Prompt & Render →</Link></div>
      </footer>
    </main>
  );
}
