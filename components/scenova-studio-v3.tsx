"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./scenova-studio-v3.module.css";
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

function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className={styles.counter}>
      <span>{label}</span>
      <div>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`ลด${label}`}>−</button>
        <strong>{value}</strong>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`เพิ่ม${label}`}>＋</button>
      </div>
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
  const [message, setMessage] = useState("พร้อมสร้างเรื่องของคุณ");

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
          role: meta.role?.toLowerCase().includes("protagonist") ? "ตัวละครหลัก" : current[0]?.role || "ตัวละครหลัก",
          appearance: detail || "นำเข้าจากคลังตัวละคร",
          voice: meta.voiceProfile && VOICE_PROFILES.includes(meta.voiceProfile) ? meta.voiceProfile : current[0]?.voice || VOICE_PROFILES[0],
        };
        return [imported, ...current.slice(1)];
      });
      setMessage(`นำเข้า ${payload.title} จากคลังตัวละครแล้ว`);
    } catch {
      setMessage("ไม่สามารถอ่านข้อมูลตัวละครจากคลังได้");
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
    setScenes((current) => distributeScenes(current, Math.min(current.length, next), next));
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
    setMessage("บันทึก Story Draft แล้ว");
  }

  return (
    <main className={styles.main}>
      <header className={styles.hero}>
        <div>
          <span>SCENOVA STORY MODE</span>
          <h1>สร้างเรื่องแบบเป็นลำดับ</h1>
          <p>กำหนดเรื่อง ตัวละคร ฉาก และเวลาให้ครบก่อน แล้วค่อยส่งไปสร้าง Prompt หรือวิดีโอ</p>
        </div>
        <div className={styles.status}>{message}</div>
      </header>

      <nav className={styles.workflowNav} aria-label="ลำดับการสร้างเรื่อง">
        <a href="#story"><b>1</b><span>เรื่องและรูปแบบ</span></a>
        <a href="#cast"><b>2</b><span>ตัวละคร / สัตว์</span></a>
        <a href="#scenes"><b>3</b><span>ฉากและเวลา</span></a>
        <a href="#review"><b>4</b><span>ตรวจและสร้าง</span></a>
      </nav>

      <section id="story" className={styles.card}>
        <div className={styles.sectionHead}>
          <b>1</b>
          <div><h2>เรื่องและรูปแบบ</h2><p>ใส่เฉพาะข้อมูลหลักที่จำเป็นต่อการสร้างเรื่อง</p></div>
        </div>
        <div className={styles.setupGrid}>
          <label className={styles.field}><span>โมเดลวิดีโอ</span><select value={model} onChange={(event) => setModel(event.target.value)}>{MODELS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className={styles.field}><span>อัตราส่วนภาพ</span><select value={aspect} onChange={(event) => setAspect(event.target.value)}>{ASPECTS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className={styles.field}><span>สไตล์ภาพ</span><select value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)}>{STYLES.map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <label className={styles.field}>
          <span>เรื่องที่ต้องการสร้าง</span>
          <textarea value={story} onChange={(event) => setStory(event.target.value)} placeholder="ตัวอย่าง: เด็กหญิงหลงเข้าไปในป่าลึกลับและพบสุนัขที่พาเธอกลับบ้าน..." />
          <small>เขียนใจความของเรื่องตรง ๆ ระบบจะใช้ข้อมูลนี้เป็นแกนกลางของทุกฉาก</small>
        </label>
      </section>

      <section id="cast" className={styles.card}>
        <div className={styles.sectionHeadRow}>
          <div className={styles.sectionHead}><b>2</b><div><h2>ตัวละครและสัตว์</h2><p>เปิดเฉพาะสิ่งที่มีอยู่ในเรื่อง</p></div></div>
          <Link className={styles.secondaryLink} href="/libraries?tab=characters">เปิดคลังตัวละคร</Link>
        </div>

        <Counter label="จำนวนตัวละคร" value={characters.length} min={1} max={8} onChange={resizeCharacters} />
        <div className={styles.castList}>
          {characters.map((character, index) => (
            <article className={styles.castCard} key={character.id}>
              <div className={styles.castTitle}><b>{index + 1}</b><input value={character.name} onChange={(event) => patchCharacter(character.id, { name: event.target.value })} aria-label={`ชื่อตัวละคร ${index + 1}`} /></div>
              <div className={styles.twoCol}>
                <label className={styles.field}><span>บทบาท</span><select value={character.role} onChange={(event) => patchCharacter(character.id, { role: event.target.value })}>{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
                <label className={styles.field}><span>เสียง</span><select value={character.voice} onChange={(event) => patchCharacter(character.id, { voice: event.target.value })}>{VOICE_PROFILES.map((voice) => <option key={voice}>{voice}</option>)}</select></label>
              </div>
              <label className={styles.field}><span>รูปลักษณ์และบุคลิก</span><textarea value={character.appearance} onChange={(event) => patchCharacter(character.id, { appearance: event.target.value })} placeholder="หน้าตา เสื้อผ้า อายุโดยประมาณ บุคลิก จุดสังเกตสำคัญ" /></label>
            </article>
          ))}
        </div>

        <div className={styles.animalSwitch}>
          <div><b>มีสัตว์หรือสิ่งมีชีวิตในเรื่องหรือไม่?</b><span>ถ้าไม่มี ระบบจะซ่อนส่วนนี้ทั้งหมด</span></div>
          <div><button type="button" className={!hasAnimals ? styles.primaryAction : ""} onClick={() => toggleAnimals(false)}>ไม่มี</button><button type="button" className={hasAnimals ? styles.primaryAction : ""} onClick={() => toggleAnimals(true)}>มี</button></div>
        </div>

        {hasAnimals ? (
          <div className={styles.animalArea}>
            <Counter label="จำนวนสัตว์ / สิ่งมีชีวิต" value={animals.length} min={1} max={4} onChange={resizeAnimals} />
            <div className={styles.castList}>
              {animals.map((animal, index) => (
                <article className={styles.castCard} key={animal.id}>
                  <div className={styles.castTitle}><b>{index + 1}</b><input value={animal.name} onChange={(event) => patchAnimal(animal.id, { name: event.target.value })} aria-label={`ชื่อสัตว์ ${index + 1}`} /></div>
                  <div className={styles.twoCol}>
                    <label className={styles.field}><span>ชนิด</span><input value={animal.species} onChange={(event) => patchAnimal(animal.id, { species: event.target.value })} placeholder="เช่น สุนัข, แมว, มังกร" /></label>
                    <label className={styles.field}><span>พฤติกรรม</span><input value={animal.behavior} onChange={(event) => patchAnimal(animal.id, { behavior: event.target.value })} placeholder="เชื่อง, ระวังตัว, ดุ, ขี้เล่น..." /></label>
                  </div>
                  <label className={styles.field}><span>รูปลักษณ์</span><textarea value={animal.appearance} onChange={(event) => patchAnimal(animal.id, { appearance: event.target.value })} placeholder="สี ขนาด ลักษณะเด่น เครื่องหมายเฉพาะ" /></label>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section id="scenes" className={styles.card}>
        <div className={styles.sectionHead}><b>3</b><div><h2>ฉากและเวลา</h2><p>กำหนดจำนวนฉากและเลื่อนเวลาแต่ละฉากได้โดยตรง</p></div></div>

        <div className={styles.sceneControls}>
          <Counter label="จำนวนฉาก" value={scenes.length} min={1} max={12} onChange={resizeScenes} />
          <div className={styles.totalDuration}>
            <div><span>เวลารวมของเรื่อง</span><strong>{totalDuration} วินาที</strong></div>
            <input type="range" min={10} max={180} step={5} value={totalDuration} onChange={(event) => changeTotalDuration(Number(event.target.value))} />
            <small>ใช้แล้ว {usedDuration} วินาที • เหลือ {remainingDuration} วินาที</small>
          </div>
        </div>

        <div className={styles.timeline}>
          {scenes.map((scene, index) => {
            const time = sceneTimes.find((item) => item.id === scene.id);
            return <button type="button" key={scene.id} className={scene.id === selectedScene?.id ? styles.timelineActive : ""} onClick={() => setSelectedSceneId(scene.id)} style={{ flexGrow: Math.max(1, scene.duration) }}><b>{index + 1}</b><span>{time?.start ?? 0}–{time?.end ?? scene.duration}s</span></button>;
          })}
        </div>

        {selectedScene ? (
          <div className={styles.sceneEditor}>
            <div className={styles.sceneEditorHead}>
              <label className={styles.field}><span>ชื่อฉาก</span><input value={selectedScene.title} onChange={(event) => patchScene({ title: event.target.value })} /></label>
              <div className={styles.timeSummary}><span>เวลาฉาก</span><strong>{selectedScene.duration} วินาที</strong></div>
            </div>

            <div className={styles.sceneDuration}>
              <input type="range" min={1} max={Math.max(1, selectedScene.duration + remainingDuration)} value={selectedScene.duration} onChange={(event) => changeSceneDuration(Number(event.target.value))} />
              <small>ลากเพื่อกำหนดเวลาของฉากนี้ ระบบจะไม่ให้เวลารวมเกิน {totalDuration} วินาที</small>
            </div>

            <label className={styles.field}><span>สถานที่</span><input value={selectedScene.location} onChange={(event) => patchScene({ location: event.target.value })} placeholder="เช่น บ้าน, โรงเรียน, ป่า, ถนนกลางคืน" /></label>

            <div className={styles.presenceBlock}>
              <span>ตัวละครที่อยู่ในฉากนี้</span>
              <div>{characters.map((character) => <label key={character.id}><input type="checkbox" checked={selectedScene.characterIds.includes(character.id)} onChange={() => toggleSceneCharacter(character.id)} />{character.name}</label>)}</div>
            </div>

            {hasAnimals ? (
              <div className={styles.presenceBlock}>
                <span>สัตว์ / สิ่งมีชีวิตที่อยู่ในฉากนี้</span>
                <div>{animals.map((animal) => <label key={animal.id}><input type="checkbox" checked={selectedScene.animalIds.includes(animal.id)} onChange={() => toggleSceneAnimal(animal.id)} />{animal.name}</label>)}</div>
              </div>
            ) : null}

            <label className={styles.field}><span>เกิดอะไรขึ้นในฉากนี้</span><textarea value={selectedScene.action} onChange={(event) => patchScene({ action: event.target.value })} placeholder="บอกตรง ๆ ว่าใครทำอะไร เริ่มอย่างไร และฉากจบอย่างไร" /></label>
            <label className={styles.field}><span>บทพูด (ถ้ามี)</span><textarea value={selectedScene.dialogue} onChange={(event) => patchScene({ dialogue: event.target.value })} placeholder={'ตัวละคร 1: ...\nตัวละคร 2: ...'} /></label>
          </div>
        ) : null}
      </section>

      <section id="review" className={styles.card}>
        <div className={styles.sectionHead}><b>4</b><div><h2>ตรวจและสร้าง</h2><p>ดูข้อมูลสำคัญก่อนส่งไปขั้นตอนสร้าง</p></div></div>
        <div className={styles.reviewGrid}>
          <div><span>โมเดล</span><b>{model}</b></div>
          <div><span>รูปแบบภาพ</span><b>{aspect}</b></div>
          <div><span>ตัวละคร</span><b>{characters.length} ตัว</b></div>
          <div><span>สัตว์ / สิ่งมีชีวิต</span><b>{hasAnimals ? `${animals.length} ตัว` : "ไม่มี"}</b></div>
          <div><span>จำนวนฉาก</span><b>{scenes.length} ฉาก</b></div>
          <div><span>เวลาที่กำหนด</span><b>{usedDuration} / {totalDuration} วินาที</b></div>
        </div>
        <div className={styles.finalBar}>
          <button type="button" onClick={saveDraft}>บันทึกร่าง</button>
          <Link className={styles.primaryAction} href="/render" onClick={saveDraft}>ไป Prompt & Render →</Link>
        </div>
      </section>
    </main>
  );
}
