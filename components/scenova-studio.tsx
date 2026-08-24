"use client";

import { useMemo, useState } from "react";
import { CAMERA_HELP, LENS_HELP, STYLE_PRESETS, VIDEO_MODELS } from "@/lib/catalogs";
import type { CameraShot, Character, Project, TimelineSegment } from "@/lib/domain";
import { exportProductionPrompt } from "@/lib/prompt-engine";
import { explainModelMode, planEpisodeRender } from "@/lib/render-planner";
import { SAMPLE_PROJECT } from "@/lib/sample-project";

const NAV = [
  ["studio", "✦", "สตูดิโอ"],
  ["project", "◈", "โปรเจกต์"],
  ["characters", "◉", "ตัวละคร"],
  ["styles", "◇", "สไตล์ภาพ"],
  ["timeline", "▥", "Timeline"],
  ["models", "⬡", "โมเดล"],
  ["prompt", "✧", "Prompt Studio"],
  ["render", "▶", "Render Plan"],
  ["locks", "▣", "ระบบล็อก"],
] as const;

type TabId = (typeof NAV)[number][0];

const shotTypeOptions = CAMERA_HELP.shotTypes.map((item) => item[0]);
const angleOptions = CAMERA_HELP.angles.map((item) => item[0]);
const movementOptions = CAMERA_HELP.movements.map((item) => item[0]);

const characterLibrary: Character[] = [
  {
    id: "LIB_HERO",
    name: "HERO_A",
    kind: "human",
    description: "ตัวละครมนุษย์สำหรับงาน Action / Sci-Fi สามารถแก้รูปลักษณ์และชุดได้ทั้งหมด",
    appearance: "young adult, balanced proportions, cinematic face",
    outfit: "custom outfit",
    personality: "determined, observant",
    lock: true,
    references: [],
  },
  {
    id: "LIB_CAT",
    name: "CAT_A",
    kind: "animal",
    description: "แมวสำหรับงานเล่าเรื่อง สัตว์เลี้ยง หรือ Fantasy สามารถสร้าง Reference Pack ได้",
    appearance: "small natural cat, expressive eyes, realistic anatomy",
    outfit: "none",
    personality: "curious, gentle",
    lock: true,
    references: [],
  },
  {
    id: "LIB_DRAGON",
    name: "DRAGON_A",
    kind: "creature",
    description: "สิ่งมีชีวิตแฟนตาซีสำหรับฉาก Epic / Adventure ปรับสเกล เกล็ด ปีก สี และลักษณะเฉพาะได้",
    appearance: "cinematic fantasy dragon, readable anatomy",
    outfit: "none",
    personality: "majestic, cautious",
    lock: true,
    references: [],
  },
  {
    id: "LIB_ROBOT",
    name: "MECHA_A",
    kind: "robot",
    description: "หุ่นยนต์/Mecha สำหรับ Action Sci-Fi สามารถล็อกโครงสร้าง โลหะ สี สัญลักษณ์ และสัดส่วนได้",
    appearance: "large tactical mecha, detailed mechanical joints",
    outfit: "integrated armor",
    personality: "precise, protective",
    lock: true,
    references: [],
  },
];

function Field({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      <div className="help">ⓘ {help}</div>
    </div>
  );
}

function PageHead({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) {
  return <button aria-label={label} className={`switch ${value ? "on" : ""}`} onClick={onChange} />;
}

function cloneSample(): Project {
  return JSON.parse(JSON.stringify(SAMPLE_PROJECT)) as Project;
}

export default function ScenovaStudio() {
  const [tab, setTab] = useState<TabId>("studio");
  const [project, setProject] = useState<Project>(() => cloneSample());
  const [episodeIndex, setEpisodeIndex] = useState(0);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [mockStatus, setMockStatus] = useState("พร้อมออกแบบ");

  const episode = project.episodes[episodeIndex] ?? project.episodes[0];
  const renderPlan = useMemo(() => planEpisodeRender(project, episode), [project, episode]);
  const activeStyle = STYLE_PRESETS.find((item) => item.id === project.styleId) ?? STYLE_PRESETS[0];
  const activeModel = VIDEO_MODELS.find((item) => item.id === project.mainModelId) ?? VIDEO_MODELS[0];

  const patchProject = (patch: Partial<Project>) => setProject((current) => ({ ...current, ...patch }));

  const patchEpisode = (patch: Partial<typeof episode>) => {
    setProject((current) => ({
      ...current,
      episodes: current.episodes.map((item, index) => (index === episodeIndex ? { ...item, ...patch } : item)),
    }));
  };

  const patchSegment = (segmentId: string, patch: Partial<TimelineSegment>) => {
    patchEpisode({
      segments: episode.segments.map((segment) => (segment.id === segmentId ? { ...segment, ...patch } : segment)),
    });
  };

  const patchShot = (segmentId: string, shotId: string, patch: Partial<CameraShot>) => {
    patchEpisode({
      segments: episode.segments.map((segment) =>
        segment.id === segmentId
          ? {
              ...segment,
              cameraShots: segment.cameraShots.map((shot) => (shot.id === shotId ? { ...shot, ...patch } : shot)),
            }
          : segment
      ),
    });
  };

  const toggleLock = (key: keyof Project["locks"]) => {
    setProject((current) => ({ ...current, locks: { ...current.locks, [key]: !current.locks[key] } }));
  };

  const generatePrompt = () => {
    setGeneratedPrompt(exportProductionPrompt(project, episode));
    setTab("prompt");
  };

  const startMockRender = () => {
    setMockStatus(`วางแผน Render แล้ว ${renderPlan.length} งาน — รอเชื่อม Video API`);
    setTab("render");
  };

  const addLibraryCharacter = (template: Character) => {
    const copy = { ...template, id: `${template.id}-${Date.now()}`, name: `${template.name}_${project.characters.length + 1}` };
    patchProject({ characters: [...project.characters, copy] });
  };

  const addCustomCharacter = () => {
    const custom: Character = {
      id: `CUSTOM_${Date.now()}`,
      name: `CUSTOM_${project.characters.length + 1}`,
      kind: "custom",
      description: "ตัวละครกำหนดเอง — แก้คำอธิบาย รูปลักษณ์ ชุด บุคลิก และ Reference ได้",
      appearance: "",
      outfit: "",
      personality: "",
      lock: true,
      references: [],
    };
    patchProject({ characters: [...project.characters, custom] });
  };

  const updateCharacter = (id: string, patch: Partial<Character>) => {
    patchProject({ characters: project.characters.map((character) => (character.id === id ? { ...character, ...patch } : character)) });
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div className="brand-copy"><strong>SCENOVA</strong><small>AI Movie & Series Studio</small></div>
        </div>
        <nav className="nav">
          {NAV.map(([id, icon, label]) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              <span className="nav-icon">{icon}</span><span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="credit-card">
            <small>เครดิต (เตรียมระบบไว้ — ยังไม่เชื่อมเงินจริง)</small>
            <strong>— Credits</strong>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="project-title">
            <span>{project.title}</span>
            <small>EP.{String(episode.number).padStart(2, "0")} · {episode.duration} วิ · {activeModel.name} · {activeStyle.nameTh}</small>
          </div>
          <div className="top-actions">
            <span className="badge good">● {mockStatus}</span>
            <button className="btn" onClick={generatePrompt}>✧ สร้าง Prompt</button>
            <button className="btn btn-primary" onClick={startMockRender}>▶ สร้างคลิปเลย</button>
          </div>
        </header>

        <div className="content">
          {tab === "studio" && (
            <>
              <PageHead title="SCENOVA Studio">ศูนย์กลางสร้างหนังและซีรีส์ AI แบบง่าย แต่สามารถเปิดรายละเอียดระดับผู้กำกับได้ ตั้งแต่เรื่อง ตัวละคร สไตล์ กล้อง Lens ช่วงเวลา ไปจนถึง Production Prompt</PageHead>
              <div className="grid-2">
                <div className="card">
                  <div className="card-title"><div><h2>① เรื่องของคุณ (Story)</h2><p>ใส่เรื่อง บทพูด หรือไอเดียสั้น ๆ ระบบจะใช้เป็นแกนกลางของ Storyboard และ Prompt</p></div><span className="badge">Project</span></div>
                  <Field label="ชื่อโปรเจกต์" help="ชื่อหนังหรือซีรีส์ ใช้แยกโปรเจกต์และแสดงบน Dashboard">
                    <input className="input" value={project.title} onChange={(e) => patchProject({ title: e.target.value })} />
                  </Field>
                  <div style={{ height: 12 }} />
                  <Field label="เนื้อเรื่อง / บทภาพยนตร์" help="เขียนภาษาไทยธรรมดาได้ AI Prompt Director จะช่วยแปลงเป็นภาษาภาพยนตร์ภายหลัง">
                    <textarea className="textarea" value={project.story} onChange={(e) => patchProject({ story: e.target.value })} />
                  </Field>
                </div>

                <div className="card">
                  <div className="card-title"><div><h2>② ตั้งค่าหนัง (Film Setup)</h2><p>กำหนดรูปแบบภาพ ความยาว และคุณภาพโดยไม่ต้องรู้ข้อจำกัด API เบื้องหลัง</p></div></div>
                  <div className="grid-2">
                    <Field label="อัตราส่วนภาพ (Aspect Ratio)" help="9:16 เหมาะกับ TikTok/Reels, 16:9 เหมาะกับ YouTube/หนังแนวนอน">
                      <select className="select" value={project.aspectRatio} onChange={(e) => patchProject({ aspectRatio: e.target.value as Project["aspectRatio"] })}>
                        <option>9:16</option><option>16:9</option><option>1:1</option><option>4:5</option>
                      </select>
                    </Field>
                    <Field label="ความยาว EP" help="รองรับ 10, 15, 30 วินาที ถึง 3 นาที ระบบ Render Planner จะแบ่งงานตามโมเดลให้อัตโนมัติ">
                      <select className="select" value={episode.duration} onChange={(e) => patchEpisode({ duration: Number(e.target.value) as typeof episode.duration })}>
                        {[10,15,30,60,90,120,150,180].map((value) => <option key={value} value={value}>{value < 60 ? `${value} วินาที` : `${value / 60} นาที`}</option>)}
                      </select>
                    </Field>
                    <Field label="แนวเรื่อง (Genre)" help="ใช้ช่วยกำหนดภาษา การกำกับ และคำแนะนำ Style/Camera">
                      <input className="input" value={project.genre} onChange={(e) => patchProject({ genre: e.target.value })} />
                    </Field>
                    <Field label="อารมณ์ภาพ (Mood)" help="ตัวอย่าง: อบอุ่น, ตื่นเต้น, ลึกลับ, ดราม่า, แอ็กชันไซไฟ">
                      <input className="input" value={project.mood} onChange={(e) => patchProject({ mood: e.target.value })} />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-title"><div><h2>③ ขั้นตอนพร้อมสร้าง</h2><p>ผู้ใช้มีสองทาง: สร้าง Prompt เพื่อนำไปใช้ภายนอก หรือสร้างคลิปใน SCENOVA โดยระบบ + AI ช่วยประกอบ Prompt เบื้องหลัง</p></div></div>
                <div className="hero-actions">
                  <div className="action-panel">
                    <span className="badge">Prompt Export</span>
                    <h3>✧ สร้าง Prompt</h3>
                    <p>สร้าง Prompt ระดับ Production จากค่าที่ตั้งทั้งหมด พร้อม Master Style, Character Lock, Shot-by-Shot, Camera, Lighting, Motion และ Negative Prompt</p>
                    <button className="btn btn-lg" onClick={generatePrompt}>สร้าง Prompt จากโปรเจกต์นี้</button>
                  </div>
                  <div className="action-panel primary">
                    <span className="badge good">AI + System</span>
                    <h3>▶ สร้างคลิปเลย</h3>
                    <p>ระบบคุมข้อบังคับและ Timeline ส่วน AI จะช่วยเรียบเรียงภาษาภาพยนตร์ ก่อนส่งเข้า Video Provider เมื่อเชื่อม API ในขั้นสุดท้าย</p>
                    <button className="btn btn-primary btn-lg" onClick={startMockRender}>วางแผนสร้างคลิป</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "project" && (
            <>
              <PageHead title="โปรเจกต์และ Project Bible">Project Bible คือข้อมูลอ้างอิงกลางของหนังทั้งเรื่อง ใช้รักษากฎโลก ตัวละคร ความสัมพันธ์ Timeline และ Canon ให้ EP ต่อ ๆ ไปไม่ขัดกัน</PageHead>
              <div className="grid-2">
                <div className="card">
                  <div className="card-title"><div><h2>Project Bible</h2><p>ข้อมูลนี้จะถูกใช้เป็นบริบทกลางในทุก EP และทุก Prompt</p></div></div>
                  <textarea className="textarea" style={{ minHeight: 260 }} value={project.projectBible} onChange={(e) => patchProject({ projectBible: e.target.value })} />
                </div>
                <div className="card">
                  <div className="card-title"><div><h2>Canon Facts (ข้อเท็จจริงของเรื่อง)</h2><p>เหตุการณ์ที่ยืนยันแล้ว AI ห้ามเขียนขัดกันในตอนถัดไปเมื่อ Canon Lock เปิด</p></div></div>
                  <div className="stack">
                    {project.canon.map((fact, index) => <div className="notice success" key={index}>✓ {fact}</div>)}
                    <button className="btn" onClick={() => patchProject({ canon: [...project.canon, "เพิ่ม Canon ใหม่และแก้ข้อความนี้"] })}>+ เพิ่ม Canon</button>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === "characters" && (
            <>
              <PageHead title="คลังตัวละคร (Character Library)">สร้างตัวละครคน สัตว์ สิ่งมีชีวิตแฟนตาซี Robot/Mecha หรืออัปโหลด Reference ของตัวเอง ตัวละครแต่ละตัวมี Character ID และ Lock แยกจากกันเพื่อใช้ต่อหลาย Scene และหลาย EP</PageHead>
              <div className="card">
                <div className="card-title"><div><h2>ตัวละครในโปรเจกต์</h2><p>Character Lock ช่วยรักษา Identity, ใบหน้า, สัดส่วน, เสื้อผ้า และรายละเอียดประจำตัว ไม่รับประกันเหมือน 100% แต่ช่วยลดการเปลี่ยนแปลงระหว่างช็อต</p></div><button className="btn" onClick={addCustomCharacter}>+ สร้างเอง</button></div>
                <div className="grid-2">
                  {project.characters.map((character) => (
                    <div className="character-card" key={character.id}>
                      <div className="avatar">{character.kind === "human" ? "👤" : character.kind === "animal" ? "🐾" : character.kind === "robot" ? "🤖" : "✦"}</div>
                      <div style={{ flex: 1 }}>
                        <div className="row" style={{ justifyContent: "space-between" }}><h4>{character.name}</h4><span className={`badge ${character.lock ? "good" : "warn"}`}>{character.lock ? "🔒 Lock" : "Unlock"}</span></div>
                        <p>{character.description}</p>
                        <div style={{ height: 9 }} />
                        <input className="input" value={character.appearance} placeholder="รูปลักษณ์" onChange={(e) => updateCharacter(character.id, { appearance: e.target.value })} />
                        <div style={{ height: 7 }} />
                        <input className="input" value={character.outfit} placeholder="เสื้อผ้า / อุปกรณ์" onChange={(e) => updateCharacter(character.id, { outfit: e.target.value })} />
                        <div className="row" style={{ marginTop: 8 }}>
                          <button className="btn" onClick={() => updateCharacter(character.id, { lock: !character.lock })}>{character.lock ? "ปลดล็อกตัวละคร" : "🔒 ล็อกตัวละคร"}</button>
                          <label className="btn">อัปโหลด Reference <input hidden type="file" accept="image/*" multiple onChange={(e) => {
                            const count = e.currentTarget.files?.length ?? 0;
                            if (!count) return;
                            const refs = Array.from({ length: count }, (_, index) => ({ id: `${character.id}-upload-${Date.now()}-${index}`, label: `Reference อัปโหลด ${index + 1}`, kind: "custom" as const }));
                            updateCharacter(character.id, { references: [...character.references, ...refs] });
                          }} /></label>
                        </div>
                        <div className="help">Reference Pack ปัจจุบัน: {character.references.length} รายการ — แนะนำหน้าตรง, ด้านข้าง, เต็มตัว, Close-up และสีหน้าสำคัญ</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-title"><div><h2>ตัวอย่างจากคลัง</h2><p>เลือกเป็นจุดเริ่มต้นแล้วแก้รายละเอียดได้ทั้งหมด คลังจริงสามารถเพิ่ม Preset คน สัตว์ Creature และ Sci-Fi ได้ต่อเนื่อง</p></div></div>
                <div className="grid-4">
                  {characterLibrary.map((character) => <div className="model-card" key={character.id}><h3>{character.name}</h3><p>{character.description}</p><button className="btn" onClick={() => addLibraryCharacter(character)}>+ เพิ่มเข้าหนัง</button></div>)}
                </div>
              </div>
            </>
          )}

          {tab === "styles" && (
            <>
              <PageHead title="สไตล์ภาพพร้อม Preview">กดดูตัวอย่าง Mood/Color ของแต่ละสไตล์ก่อนเลือก ทุก Style มี Prompt Template และ Negative Prompt ของตัวเอง และสามารถล็อกสไตล์ทั้งโปรเจกต์ได้</PageHead>
              <div className="notice">ⓘ Preview ชุดนี้เป็น Visual Placeholder ที่อยู่ในระบบโดยไม่เรียก Image API เมื่อเชื่อมระบบภาพภายหลัง ปุ่ม “Preview กับตัวละครของฉัน” จะสร้างภาพจริงและค่อยคิดเครดิตตาม Provider</div>
              <div style={{ height: 14 }} />
              <div className="grid-4">
                {STYLE_PRESETS.map((item) => (
                  <button className={`style-card ${project.styleId === item.id ? "selected" : ""}`} key={item.id} onClick={() => patchProject({ styleId: item.id })}>
                    <div className={`preview-tile ${item.previewClass}`} />
                    <div className="style-meta"><b>{item.nameTh}</b><small>{item.nameEn}</small><small>{item.descriptionTh}</small></div>
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === "timeline" && (
            <>
              <PageHead title="Time Segment Director">กำกับวิดีโอตามช่วงเวลา เช่น 0–10 วิ, 10–20 วิ, 20–30 วิ หรือแบ่ง Custom เองได้ แต่ละช่วงแก้ฉาก Action บทพูด Emotion Lighting และหลายมุมกล้องได้อิสระ</PageHead>
              <div className="card">
                <div className="card-title"><div><h2>Timeline Overview — {episode.duration} วินาที</h2><p>แถบด้านล่างแสดงช่วงเวลาแบบสัมพันธ์กับความยาว EP เมื่อเพิ่ม EP ถึง 3 นาที ระบบยังใช้โครงสร้างเดียวกัน</p></div></div>
                <div className="timeline-ruler">{[0,1,2,3,4,5,6].map((n) => <span key={n}>{Math.round((episode.duration / 6) * n)}s</span>)}</div>
                <div className="timeline-track">
                  {episode.segments.map((segment) => <div className="timeline-segment" key={segment.id} style={{ left: `${(segment.start / episode.duration) * 100}%`, width: `${((segment.end - segment.start) / episode.duration) * 100}%` }}><b>{segment.title}</b><span>{segment.start}–{segment.end}s</span></div>)}
                </div>
              </div>

              <div className="stack" style={{ marginTop: 14 }}>
                {episode.segments.map((segment) => (
                  <div className="segment-card" key={segment.id}>
                    <div className="segment-head"><div><b>{segment.start}–{segment.end} วิ · {segment.title}</b><div className="help">แก้รายละเอียดช่วงนี้โดยไม่กระทบช่วงอื่น</div></div><span className="badge">{segment.cameraShots.length} Camera Shots</span></div>
                    <div className="segment-body">
                      <div className="grid-2">
                        <Field label="ฉาก / เหตุการณ์" help="อธิบายว่าในช่วงเวลานี้เกิดอะไรขึ้น ระบบจะไม่เปลี่ยนข้อความนี้เองในโหมด Strict"><textarea className="textarea" value={segment.scene} onChange={(e) => patchSegment(segment.id, { scene: e.target.value })} /></Field>
                        <Field label="การกระทำ (Action)" help="ระบุการเดิน วิ่ง หัน จับ ต่อสู้ เคลื่อนไหว หรือการกระทำแบบ Custom"><textarea className="textarea" value={segment.action} onChange={(e) => patchSegment(segment.id, { action: e.target.value })} /></Field>
                        <Field label="อารมณ์ (Emotion)" help="ระบุการเปลี่ยนอารมณ์ในช่วง เช่น สงบ → สงสัย → ตกใจ"><input className="input" value={segment.emotion} onChange={(e) => patchSegment(segment.id, { emotion: e.target.value })} /></Field>
                        <Field label="แสง (Lighting)" help="กำหนดเวลา ทิศทางแสง สี อุณหภูมิ และบรรยากาศของช่วงนี้"><input className="input" value={segment.lighting} onChange={(e) => patchSegment(segment.id, { lighting: e.target.value })} /></Field>
                      </div>

                      <div style={{ height: 14 }} />
                      <div className="card-title"><div><h3>มุมกล้องในช่วงนี้ (Multi-Camera)</h3><p>หนึ่งช่วงมีหลาย Shot ได้ แต่ละ Shot กำหนด Lens, ความสูง, การเคลื่อนกล้อง, Focus, DOF และ Composition แยกกัน</p></div></div>
                      {segment.cameraShots.map((shot) => (
                        <div className="shot-card" key={shot.id}>
                          <div className="row"><span className="badge">{shot.start}–{shot.end}s</span><b>{shot.shotType}</b><span className="muted">{shot.angle} · {shot.lensMm}mm</span></div>
                          <div className="grid-4" style={{ marginTop: 10 }}>
                            <Field label="ประเภทภาพ (Shot Type)" help={(CAMERA_HELP.shotTypes.find((item) => item[0] === shot.shotType)?.[2] as string) ?? "กำหนดระยะภาพ"}><select className="select" value={shot.shotType} onChange={(e) => patchShot(segment.id, shot.id, { shotType: e.target.value })}>{shotTypeOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
                            <Field label="มุมกล้อง (Camera Angle)" help={(CAMERA_HELP.angles.find((item) => item[0] === shot.angle.split(" / ")[0])?.[2] as string) ?? "กำหนดทิศทางที่กล้องมองตัวละคร"}><select className="select" value={shot.angle.split(" / ")[0]} onChange={(e) => patchShot(segment.id, shot.id, { angle: e.target.value })}>{angleOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
                            <Field label="เลนส์ (Lens)" help={(LENS_HELP.find((item) => item[0] === shot.lensMm)?.[2] as string) ?? "เลขน้อยเห็นฉากกว้าง เลขมากเน้นตัวละครและฉากหลังละลาย"}><select className="select" value={shot.lensMm} onChange={(e) => patchShot(segment.id, shot.id, { lensMm: Number(e.target.value) })}>{LENS_HELP.map(([mm, title]) => <option key={mm} value={mm}>{mm}mm — {title}</option>)}</select></Field>
                            <Field label="การเคลื่อนกล้อง" help={(CAMERA_HELP.movements.find((item) => item[0] === shot.movement)?.[2] as string) ?? "กำหนดวิธีที่กล้องเคลื่อนระหว่างช็อต"}><select className="select" value={shot.movement} onChange={(e) => patchShot(segment.id, shot.id, { movement: e.target.value })}>{movementOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
                            <Field label="ความสูงกล้อง" help="ตัวอย่าง 10 ซม. จากพื้นเหมาะกับสัตว์เล็ก/Action, ระดับสายตาให้ภาพธรรมชาติ"><input className="input" value={shot.cameraHeight} onChange={(e) => patchShot(segment.id, shot.id, { cameraHeight: e.target.value })} /></Field>
                            <Field label="จุดโฟกัส (Focus)" help="บอกว่าอะไรต้องคมชัดและเป็นจุดสนใจหลัก"><input className="input" value={shot.focus} onChange={(e) => patchShot(segment.id, shot.id, { focus: e.target.value })} /></Field>
                            <Field label="ระยะชัดลึก (Depth of Field)" help="Shallow ทำฉากหลังเบลอเน้นตัวละคร, Deep เห็นฉากแวดล้อมชัดมากขึ้น"><input className="input" value={shot.depthOfField} onChange={(e) => patchShot(segment.id, shot.id, { depthOfField: e.target.value })} /></Field>
                            <Field label="องค์ประกอบภาพ (Composition)" help="กำหนดตำแหน่งตัวละคร Leading Lines, Centered, Rule of Thirds หรือ Negative Space"><input className="input" value={shot.composition} onChange={(e) => patchShot(segment.id, shot.id, { composition: e.target.value })} /></Field>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "models" && (
            <>
              <PageHead title="Model Center & Model Lock">เลือกโมเดลหลัก ล็อกใช้โมเดลเดียว หรือเปิด Safe/Custom Hybrid โมเดลทุกตัวทำงานผ่าน Provider Adapter เพื่อให้เปลี่ยน API ภายหลังโดยไม่ต้องรื้อระบบหนัง</PageHead>
              <div className="card">
                <div className="grid-3">
                  <Field label="โหมดโมเดล (Model Mode)" help={explainModelMode(project.modelMode)}>
                    <select className="select" value={project.modelMode} onChange={(e) => patchProject({ modelMode: e.target.value as Project["modelMode"] })}>
                      <option value="single">Single Model — ใช้โมเดลเดียว</option><option value="safe-hybrid">Safe Hybrid — ผสมแบบปลอดภัย</option><option value="custom-hybrid">Custom Hybrid — เลือกเองรายฉาก</option>
                    </select>
                  </Field>
                  <Field label="โมเดลหลัก (Main Model)" help="ฉากตัวละครหลักจะใช้โมเดลนี้เป็นค่าเริ่มต้น โดยเฉพาะเมื่อ Model Lock เปิด"><select className="select" value={project.mainModelId} onChange={(e) => patchProject({ mainModelId: e.target.value })}>{VIDEO_MODELS.map((model) => <option value={model.id} key={model.id}>{model.name}</option>)}</select></Field>
                  <Field label="ความละเอียด" help="ระบบจะแสดงเฉพาะความละเอียดที่โมเดลรองรับจริงเมื่อเชื่อม Provider"><select className="select" value={project.resolution} onChange={(e) => patchProject({ resolution: e.target.value as Project["resolution"] })}><option>480p</option><option>720p</option><option>1080p</option></select></Field>
                </div>
              </div>
              <div className="grid-3" style={{ marginTop: 14 }}>
                {VIDEO_MODELS.map((model) => <button className={`model-card ${project.mainModelId === model.id ? "selected" : ""}`} key={model.id} onClick={() => patchProject({ mainModelId: model.id })}><div className="row" style={{ justifyContent: "space-between" }}><h3>{model.name}</h3><span className="price-dots">{"฿".repeat(model.priceLevel)}</span></div><p>{model.descriptionTh}</p><div className="row"><span className="badge">สูงสุด {model.maxSecondsPerGeneration}s/งาน</span>{model.supportsAudio && <span className="badge good">Audio</span>}{model.supportsVideoReference && <span className="badge">Video Ref</span>}</div></button>)}
              </div>
            </>
          )}

          {tab === "prompt" && (
            <>
              <PageHead title="SCENOVA Prompt Studio">ระบบคุมโครงสร้างและ Lock ส่วน AI Prompt Director จะเข้ามาช่วยเรียบเรียงภาษาเมื่อเชื่อม AI API ผู้ใช้สามารถ Export Prompt ไปใช้ภายนอก หรือสร้างคลิปใน SCENOVA โดยไม่ต้องซื้อ Prompt แยก</PageHead>
              <div className="card">
                <div className="grid-3">
                  <Field label="Strict Composer" help="ยึดค่าที่ผู้ใช้เลือกเท่านั้น AI ไม่มีสิทธิ์เปลี่ยน Camera, Lens, Timing หรือ Lock"><button className={`btn ${project.promptMode === "strict" ? "btn-primary" : ""}`} onClick={() => patchProject({ promptMode: "strict" })}>ใช้ Strict</button></Field>
                  <Field label="AI Assisted (แนะนำ)" help="ค่าที่เลือกเป็นข้อบังคับ แต่ AI ช่วยเติมภาษาภาพยนตร์ เชื่อมช็อต และปรับ Prompt ให้เหมาะกับโมเดล"><button className={`btn ${project.promptMode === "assisted" ? "btn-primary" : ""}`} onClick={() => patchProject({ promptMode: "assisted" })}>ใช้ Assisted</button></Field>
                  <Field label="Creative Director" help="AI เสนอรายละเอียดเพิ่มเติมได้ แต่การเปลี่ยน Hard Constraint ต้องให้ผู้ใช้ยืนยัน"><button className={`btn ${project.promptMode === "creative-director" ? "btn-primary" : ""}`} onClick={() => patchProject({ promptMode: "creative-director" })}>ใช้ Director</button></Field>
                </div>
                <div className="row" style={{ marginTop: 14 }}><button className="btn btn-primary" onClick={generatePrompt}>✧ ประกอบ Production Prompt</button><button className="btn" onClick={() => generatedPrompt && navigator.clipboard?.writeText(generatedPrompt)}>คัดลอก Prompt</button></div>
              </div>
              <div className="card"><div className="card-title"><div><h2>Production Prompt Preview</h2><p>ตัวอย่างก้อน Prompt ที่เกิดจาก Structured Data ของโปรเจกต์ ไม่ใช่ข้อความตายตัวก้อนเดียว เมื่อแก้ Timeline ระบบจะประกอบใหม่ได้ทันที</p></div></div><div className="prompt-box">{generatedPrompt || "กด “ประกอบ Production Prompt” เพื่อดู Master Style Lock + Character Locks + Episode Timeline + Shot-by-Shot + Global Camera/Lighting/Motion Locks + Negative Prompt"}</div></div>
            </>
          )}

          {tab === "render" && (
            <>
              <PageHead title="Render Planner">แปลง EP ที่ผู้ใช้เห็นเป็นเวลาต่อเนื่องให้เป็น Generation Jobs ตามข้อจำกัดของแต่ละโมเดล เช่น 3 นาทีบนโมเดลที่สร้างได้ 30 วิ/ครั้ง จะถูกแบ่งเป็นหลายงานและเชื่อม Continuity อัตโนมัติ</PageHead>
              <div className="notice success">{mockStatus} — ตอนนี้เป็น Mock Provider ตามแผน: ระบบ Core ทำงานก่อน จากนั้นค่อยเสียบ Seedance/Kling/Veo API และ Credit/Payment ขั้นสุดท้าย</div>
              <div className="card" style={{ marginTop: 14 }}>
                <div className="card-title"><div><h2>Generation Jobs</h2><p>งานแต่ละชิ้นรู้ช่วงเวลา โมเดล และว่าต้องต่อ Continuity จากงานก่อนหน้าหรือไม่</p></div><span className="badge">{renderPlan.length} jobs</span></div>
                {renderPlan.map((item) => { const model = VIDEO_MODELS.find((x) => x.id === item.modelId); return <div className="render-row" key={item.id}><b>#{item.order}</b><span>{item.start}–{item.end}s</span><span>{model?.name}</span><span>{item.duration}s</span><span>{item.continuityFromPrevious ? "🔗 Continue" : "Start"}</span></div>; })}
              </div>
            </>
          )}

          {tab === "locks" && (
            <>
              <PageHead title="Lock & Continuity Center">เลือกได้ว่าต้องล็อกอะไรบ้าง Lock คือกฎที่ระบบต้องรักษาเมื่อสร้าง Prompt และตอนเชื่อม Video API จะส่ง Reference/Constraints ที่เหมาะสมให้ Provider</PageHead>
              <div className="grid-2">
                <div className="card">
                  {([
                    ["project", "Project Lock", "ล็อกกฎของโลก Project Bible และค่าหลักของหนัง"],
                    ["character", "Character Lock", "รักษา Identity ใบหน้า รูปร่าง เสื้อผ้าและรายละเอียดประจำตัว"],
                    ["style", "Style Lock", "รักษาสไตล์ภาพ Texture Color Palette และการ Render ให้ต่อเนื่อง"],
                    ["voice", "Voice Lock", "ล็อก Voice ID ให้ตัวละครไม่สลับเสียง"],
                    ["location", "Location Lock", "รักษาสถาปัตยกรรมและรายละเอียดสถานที่เมื่อกลับมาฉากเดิม"],
                    ["prop", "Prop Lock", "รักษารูปร่าง สี และลักษณะของสิ่งของสำคัญ"],
                  ] as const).map(([key, title, text]) => <div className="lock-row" key={key}><div className="lock-copy"><b>🔒 {title}</b><span>{text}</span></div><Toggle label={title} value={project.locks[key]} onChange={() => toggleLock(key)} /></div>)}
                </div>
                <div className="card">
                  {([
                    ["canon", "Canon Lock", "ป้องกันเนื้อหา EP ใหม่ขัดกับเหตุการณ์ที่ยืนยันแล้ว"],
                    ["camera", "Camera Style Lock", "รักษาภาษากล้อง เช่น low-angle / restrained movement / composition style"],
                    ["lighting", "Lighting Lock", "รักษาทิศทาง แหล่งกำเนิด และอุณหภูมิแสงในฉากต่อเนื่อง"],
                    ["motion", "Motion Lock", "รักษากฎการเคลื่อนไหว Gravity Secondary Motion และความเป็นธรรมชาติ"],
                    ["model", "Model Lock", "ล็อกโมเดลตาม Project/EP/Character Scene เพื่อลดความต่างของภาพ"],
                  ] as const).map(([key, title, text]) => <div className="lock-row" key={key}><div className="lock-copy"><b>🔒 {title}</b><span>{text}</span></div><Toggle label={title} value={project.locks[key]} onChange={() => toggleLock(key)} /></div>)}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
