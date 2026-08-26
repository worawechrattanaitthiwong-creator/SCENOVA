import fs from "node:fs";
import path from "node:path";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function replaceRequired(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(search, replacement);
}

function replaceRegexRequired(text, regex, replacement, label) {
  if (!regex.test(text)) throw new Error(`Missing regex patch target: ${label}`);
  regex.lastIndex = 0;
  return text.replace(regex, replacement);
}

const studioPath = "components/scenova-studio-v3.tsx";
let studio = read(studioPath);

studio = replaceRequired(
  studio,
  'import { useEffect, useMemo, useState } from "react";',
  'import { useEffect, useId, useMemo, useState } from "react";',
  "React useId import",
);

if (!studio.includes("type OptionalControlKey")) {
  studio = replaceRequired(
    studio,
    "type Scene = {",
    `type OptionalControlKey =
  | "sound"
  | "secondarySound"
  | "sfx"
  | "music"
  | "sfxTimeline"
  | "soundMix"
  | "focus"
  | "dof"
  | "composition"
  | "cameraSpeed"
  | "performance"
  | "colorTemp"
  | "blocking";

type CameraDirective = {
  id: string;
  start: number;
  end: number;
  shot: string;
  angle: string;
  lens: string;
  movement: string;
  height: string;
};

type Scene = {`,
    "Studio control types",
  );
}

studio = replaceRequired(
  studio,
  "  rimLight: string;\n  locks: string[];",
  "  rimLight: string;\n  cameraShots: CameraDirective[];\n  manual: Partial<Record<OptionalControlKey, boolean>>;\n  locks: string[];",
  "Scene camera/manual fields",
);

if (!studio.includes("function createCameraDirectives")) {
  studio = replaceRequired(
    studio,
    "function createScene(index: number, duration = 6): Scene {",
    `function cameraDirectiveId() {
  return \`shot_\${Date.now()}_\${Math.random().toString(36).slice(2, 8)}\`;
}

function fitCameraDirectives(shots: CameraDirective[], duration: number): CameraDirective[] {
  const minimum = shots.length >= 2
    ? shots
    : [...shots, { ...(shots[0] || { id: cameraDirectiveId(), shot: "Wide Shot", angle: "Eye Level", lens: "24mm", movement: "Dolly In", height: "Eye Level", start: 0, end: duration }), id: cameraDirectiveId(), shot: "Medium Close-Up", lens: "50mm", movement: "Tracking" }];
  return minimum.map((shot, index) => ({
    ...shot,
    start: Number(((duration * index) / minimum.length).toFixed(2)),
    end: index === minimum.length - 1 ? duration : Number(((duration * (index + 1)) / minimum.length).toFixed(2)),
  }));
}

function createCameraDirectives(duration: number): CameraDirective[] {
  return fitCameraDirectives([
    { id: cameraDirectiveId(), start: 0, end: duration / 2, shot: "Wide Shot", angle: "Eye Level", lens: "24mm", movement: "Dolly In", height: "Eye Level" },
    { id: cameraDirectiveId(), start: duration / 2, end: duration, shot: "Medium Close-Up", angle: "Low Angle", lens: "50mm", movement: "Tracking", height: "Chest Level" },
  ], duration);
}

function createScene(index: number, duration = 6): Scene {`,
    "Camera directive helpers",
  );
}

studio = replaceRequired(
  studio,
  '    rimLight: "AI",\n    locks: ["Character", "Style", "Voice"],',
  '    rimLight: "AI",\n    cameraShots: createCameraDirectives(duration),\n    manual: {},\n    locks: ["Character", "Style", "Voice"],',
  "Scene camera/manual defaults",
);

studio = replaceRegexRequired(
  studio,
  /function ChoiceField\([\s\S]*?\n}\n\nfunction LevelField/,
  `function ChoiceField({ label, help, value, options, onChange, manual, onManualChange }: { label: string; help: string; value: string; options: ProductionChoice[]; onChange: (value: string) => void; manual?: boolean; onManualChange?: (manual: boolean) => void }) {
  const selected = options.find((item) => item.value === value);
  const listId = useId();
  const isAuto = manual === false;
  return <div className={styles.field}>
    <div className={styles.fieldLabel}>
      <b>{label}</b>
      {onManualChange ? <label className={styles.autoToggle}><input type="checkbox" checked={manual === true} onChange={(event) => onManualChange(event.target.checked)} /><span>{manual === true ? "กำหนดเอง" : "AI Auto"}</span></label> : null}
    </div>
    <input list={listId} value={isAuto ? "" : value} disabled={isAuto} onChange={(event) => onChange(event.target.value)} placeholder={isAuto ? "AI จะเลือกให้เข้ากับเนื้อเรื่องและจังหวะฉาก" : "เลือกจากรายการ หรือพิมพ์ค่าที่ต้องการในช่องเดียวกัน"} />
    <datalist id={listId}>{options.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</datalist>
    <small>{isAuto ? `AI Auto — ${help}` : selected?.help || help}</small>
  </div>;
}

function LevelField`,
  "Single-field creatable ChoiceField",
);

if (!studio.includes("function CameraShotEditor")) {
  studio = replaceRequired(
    studio,
    "function normalizedRole(role?: string) {",
    `function CameraShotEditor({ shots, duration, onChange }: { shots: CameraDirective[]; duration: number; onChange: (shots: CameraDirective[]) => void }) {
  const normalized = fitCameraDirectives(shots, duration);
  const patchShot = (id: string, patch: Partial<CameraDirective>) => onChange(normalized.map((shot) => shot.id === id ? { ...shot, ...patch } : shot));
  const addShot = () => {
    if (normalized.length >= 8) return;
    const last = normalized[normalized.length - 1];
    onChange(fitCameraDirectives([...normalized, { ...last, id: cameraDirectiveId(), shot: "AI", angle: "AI", lens: "AI", movement: "AI", height: "AI" }], duration));
  };
  const removeShot = (id: string) => {
    if (normalized.length <= 2) return;
    onChange(fitCameraDirectives(normalized.filter((shot) => shot.id !== id), duration));
  };

  return <div className={styles.cameraPlan}>
    <div className={styles.cameraPlanHead}>
      <div><b>Multi-Camera Shot Plan — มุมกล้องหลายช็อตในฉากเดียว</b><small>ทุก Scene มีอย่างน้อย 2 ช็อต ระบบกระจายเวลาให้อัตโนมัติ และเพิ่มได้สูงสุด 8 ช็อต</small></div>
      <button type="button" onClick={addShot}>＋ เพิ่มมุมกล้อง</button>
    </div>
    <div className={styles.cameraShotList}>{normalized.map((shot, index) => <article className={styles.cameraShotCard} key={shot.id}>
      <div className={styles.cameraShotHead}><div><span>SHOT {index + 1}</span><b>{shot.start.toFixed(2)}–{shot.end.toFixed(2)}s</b></div><button type="button" disabled={normalized.length <= 2} onClick={() => removeShot(shot.id)}>ลบช็อต</button></div>
      <div className={styles.cameraShotGrid}>
        <ChoiceField label="Shot Type — ระยะภาพ" help="ขนาด Subject ในกรอบภาพของช็อตนี้" value={shot.shot} options={SHOT_TYPES} onChange={(value) => patchShot(shot.id, { shot: value })} />
        <ChoiceField label="Camera Angle — มุมกล้อง" help="มุมมองของกล้องในช็อตนี้" value={shot.angle} options={CAMERA_ANGLES} onChange={(value) => patchShot(shot.id, { angle: value })} />
        <ChoiceField label="Lens — ระยะเลนส์" help="Perspective และความกว้างของภาพในช็อตนี้" value={shot.lens} options={LENSES} onChange={(value) => patchShot(shot.id, { lens: value })} />
        <ChoiceField label="Movement — การเคลื่อนกล้อง" help="ทิศทางและรูปแบบการเคลื่อนกล้องในช็อตนี้" value={shot.movement} options={CAMERA_MOVEMENTS} onChange={(value) => patchShot(shot.id, { movement: value })} />
        <ChoiceField label="Camera Height — ความสูงกล้อง" help="ระดับความสูงของกล้องในช็อตนี้" value={shot.height} options={CAMERA_HEIGHTS} onChange={(value) => patchShot(shot.id, { height: value })} />
      </div>
    </article>)}</div>
    <small className={styles.cameraPlanNote}>AI Director สามารถออกแบบลำดับช็อตให้เองได้ แต่ทุกช็อตยังแก้ Preset หรือพิมพ์ Custom ในช่องเดียวกันได้</small>
  </div>;
}

function normalizedRole(role?: string) {`,
    "CameraShotEditor",
  );
}

studio = replaceRequired(
  studio,
  "  function patchScene(patch: Partial<Scene>) { setScenes((current) => current.map((scene) => scene.id === selected.id ? { ...scene, ...patch } : scene)); }\n  function patchCharacter",
  "  function patchScene(patch: Partial<Scene>) { setScenes((current) => current.map((scene) => scene.id === selected.id ? { ...scene, ...patch } : scene)); }\n  function setManual(key: OptionalControlKey, enabled: boolean) { patchScene({ manual: { ...selected.manual, [key]: enabled } }); }\n  function patchCharacter",
  "Manual override setter",
);

studio = replaceRequired(
  studio,
  "  function setSceneDuration(value: number) { const other = used - selected.duration; patchScene({ duration: Math.max(1, Math.min(value, duration - other)) }); }",
  "  function setSceneDuration(value: number) { const other = used - selected.duration; const nextDuration = Math.max(1, Math.min(value, duration - other)); patchScene({ duration: nextDuration, cameraShots: fitCameraDirectives(selected.cameraShots, nextDuration) }); }",
  "Scene duration camera rescale",
);

studio = replaceRequired(
  studio,
  "      transition: choose(TRANSITIONS, i), shot: choose(SHOT_TYPES, i + 1), angle: choose(CAMERA_ANGLES, i), lens: choose(LENSES, i + 2), movement: choose(CAMERA_MOVEMENTS, i + 1), height: choose(CAMERA_HEIGHTS, i), lighting: choose(LIGHTING_STYLES, i + 1), emotion: choose(EMOTIONS, i),",
  "      transition: choose(TRANSITIONS, i), cameraShots: fitCameraDirectives(selected.cameraShots.map((shot, shotIndex) => ({ ...shot, shot: choose(SHOT_TYPES, i + shotIndex + 1), angle: choose(CAMERA_ANGLES, i + shotIndex), lens: choose(LENSES, i + shotIndex + 2), movement: choose(CAMERA_MOVEMENTS, i + shotIndex + 1), height: choose(CAMERA_HEIGHTS, i + shotIndex) })), selected.duration), shot: choose(SHOT_TYPES, i + 1), angle: choose(CAMERA_ANGLES, i), lens: choose(LENSES, i + 2), movement: choose(CAMERA_MOVEMENTS, i + 1), height: choose(CAMERA_HEIGHTS, i), lighting: choose(LIGHTING_STYLES, i + 1), emotion: choose(EMOTIONS, i),",
  "AI Suggest multi-camera",
);

studio = replaceRequired(
  studio,
  "location: choose(LOCATION_PRESETS, index), objective: choose(OBJECTIVE_PRESETS, index), beat: choose(SCENE_BEATS, index), shot: choose(SHOT_TYPES, index + 1)",
  "location: choose(LOCATION_PRESETS, index), objective: choose(OBJECTIVE_PRESETS, index), beat: choose(SCENE_BEATS, index), cameraShots: fitCameraDirectives(scene.cameraShots.map((shot, shotIndex) => ({ ...shot, shot: choose(SHOT_TYPES, index + shotIndex + 1), angle: choose(CAMERA_ANGLES, index + shotIndex), lens: choose(LENSES, index + shotIndex + 3), movement: choose(CAMERA_MOVEMENTS, index + shotIndex + 1), height: choose(CAMERA_HEIGHTS, index + shotIndex + 2) })), scene.duration), shot: choose(SHOT_TYPES, index + 1)",
  "AI Fill multi-camera",
);

// Respect fields explicitly switched to manual mode when AI suggestions run.
for (const [from, to] of [
  ["sound: choose(AMBIENCE_PRESETS, i)", "sound: selected.manual.sound ? selected.sound : choose(AMBIENCE_PRESETS, i)"],
  ["secondarySound: choose(AMBIENCE_PRESETS, i + 5)", "secondarySound: selected.manual.secondarySound ? selected.secondarySound : choose(AMBIENCE_PRESETS, i + 5)"],
  ["sfx: choose(SFX_PRESETS, i + 2)", "sfx: selected.manual.sfx ? selected.sfx : choose(SFX_PRESETS, i + 2)"],
  ["music: choose(MUSIC_PRESETS, i)", "music: selected.manual.music ? selected.music : choose(MUSIC_PRESETS, i)"],
  ["focus: choose(FOCUS_OPTIONS, i)", "focus: selected.manual.focus ? selected.focus : choose(FOCUS_OPTIONS, i)"],
  ["dof: choose(DOF_OPTIONS, i)", "dof: selected.manual.dof ? selected.dof : choose(DOF_OPTIONS, i)"],
  ["composition: choose(COMPOSITION_OPTIONS, i)", "composition: selected.manual.composition ? selected.composition : choose(COMPOSITION_OPTIONS, i)"],
  ["cameraSpeed: choose(CAMERA_SPEEDS, i)", "cameraSpeed: selected.manual.cameraSpeed ? selected.cameraSpeed : choose(CAMERA_SPEEDS, i)"],
  ["performance: choose(PERFORMANCE_OPTIONS, i)", "performance: selected.manual.performance ? selected.performance : choose(PERFORMANCE_OPTIONS, i)"],
  ["colorTemp: choose(COLOR_TEMPERATURES, i)", "colorTemp: selected.manual.colorTemp ? selected.colorTemp : choose(COLOR_TEMPERATURES, i)"],
  ["blocking: \"วาง Subject หลักในตำแหน่งที่สอดคล้องกับ Composition และรักษาทิศทางสายตาจาก Shot ก่อนหน้า\"", "blocking: selected.manual.blocking ? selected.blocking : \"วาง Subject หลักในตำแหน่งที่สอดคล้องกับ Composition และรักษาทิศทางสายตาจาก Shot ก่อนหน้า\""],
  ["sound: choose(AMBIENCE_PRESETS, index + 2)", "sound: scene.manual.sound ? scene.sound : choose(AMBIENCE_PRESETS, index + 2)"],
  ["secondarySound: choose(AMBIENCE_PRESETS, index + 7)", "secondarySound: scene.manual.secondarySound ? scene.secondarySound : choose(AMBIENCE_PRESETS, index + 7)"],
  ["sfx: choose(SFX_PRESETS, index + 1)", "sfx: scene.manual.sfx ? scene.sfx : choose(SFX_PRESETS, index + 1)"],
  ["music: choose(MUSIC_PRESETS, index)", "music: scene.manual.music ? scene.music : choose(MUSIC_PRESETS, index)"],
]) {
  studio = replaceRequired(studio, from, to, `manual AI protection: ${from.slice(0, 28)}`);
}

studio = replaceRegexRequired(
  studio,
  /<div className=\{styles\.cameraGrid\}><ChoiceField label="Shot Type — ระยะภาพ"[\s\S]*?<\/div>\n          <div className=\{styles\.field\}><ChoiceField label="Emotion — อารมณ์หลัก"/,
  `<CameraShotEditor shots={selected.cameraShots} duration={selected.duration} onChange={(cameraShots) => { const first = cameraShots[0]; patchScene({ cameraShots, shot: first?.shot || selected.shot, angle: first?.angle || selected.angle, lens: first?.lens || selected.lens, movement: first?.movement || selected.movement, height: first?.height || selected.height }); }} />
          <div className={styles.field}><ChoiceField label="Emotion — อารมณ์หลัก"`,
  "Replace single camera controls with multi-camera editor",
);

studio = replaceRequired(
  studio,
  '<details open className={styles.advanced}><summary>Sound Design — ออกแบบเสียงฉาก</summary>',
  '<details className={styles.advanced}><summary>Sound Design — ออกแบบเสียงฉาก <span className={styles.summaryHint}>กดเพื่อกำหนดเอง • ไม่เปิด = AI จัดให้</span></summary>',
  "Collapsed Sound Design",
);

for (const [needle, manualKey] of [
  ['<ChoiceField label="Primary Ambience — บรรยากาศหลัก"', "sound"],
  ['<ChoiceField label="Secondary Ambience — บรรยากาศเสริม"', "secondarySound"],
  ['<ChoiceField label="SFX Event — เสียงเหตุการณ์"', "sfx"],
  ['<ChoiceField label="Music — ดนตรีประกอบ"', "music"],
  ['<ChoiceField label="Focus — จุดโฟกัส"', "focus"],
  ['<ChoiceField label="Depth of Field (DOF) — ชัดตื้น/ชัดลึก"', "dof"],
  ['<ChoiceField label="Composition — การจัดองค์ประกอบภาพ"', "composition"],
  ['<ChoiceField label="Camera Speed — ความเร็วกล้อง"', "cameraSpeed"],
  ['<ChoiceField label="Performance — ระดับการแสดง"', "performance"],
  ['<ChoiceField label="Color Temperature — อุณหภูมิสีของแสง"', "colorTemp"],
]) {
  studio = replaceRequired(
    studio,
    needle,
    `<ChoiceField manual={selected.manual.${manualKey} === true} onManualChange={(manual) => setManual("${manualKey}", manual)} ${needle.slice("<ChoiceField ".length)}`,
    `Optional control ${manualKey}`,
  );
}

studio = replaceRequired(
  studio,
  '<div className={styles.field}><div className={styles.fieldLabel}><b>SFX Timeline — กำหนดเวลาเสียงเหตุการณ์</b></div><textarea value={selected.sfxTimeline} onChange={(e) => patchScene({ sfxTimeline:e.target.value })}',
  '<div className={styles.field}><div className={styles.fieldLabel}><b>SFX Timeline — กำหนดเวลาเสียงเหตุการณ์</b><label className={styles.autoToggle}><input type="checkbox" checked={selected.manual.sfxTimeline === true} onChange={(event) => setManual("sfxTimeline", event.target.checked)} /><span>{selected.manual.sfxTimeline === true ? "กำหนดเอง" : "AI Auto"}</span></label></div><textarea disabled={selected.manual.sfxTimeline !== true} value={selected.manual.sfxTimeline === true ? selected.sfxTimeline : ""} onChange={(e) => patchScene({ sfxTimeline:e.target.value })}',
  "Optional SFX timeline",
);

studio = replaceRegexRequired(
  studio,
  /<div className=\{styles\.cameraGrid\}><LevelField label="Ambience Level — ระดับบรรยากาศ"[\s\S]*?<LevelField label="Music Level — ระดับดนตรี"[\s\S]*?<\/div>/,
  `<div className={styles.optionalGroup}><div className={styles.optionalGroupHead}><div><b>Sound Mix — ระดับเสียงแต่ละชั้น</b><small>ไม่ติ๊ก = ให้ AI จัดบาลานซ์ตามบทพูด เหตุการณ์ และอารมณ์ของฉาก</small></div><label className={styles.autoToggle}><input type="checkbox" checked={selected.manual.soundMix === true} onChange={(event) => setManual("soundMix", event.target.checked)} /><span>{selected.manual.soundMix === true ? "กำหนดเอง" : "AI Auto"}</span></label></div><fieldset className={styles.optionalFieldset} disabled={selected.manual.soundMix !== true}><div className={styles.cameraGrid}><LevelField label="Ambience Level — ระดับบรรยากาศ" value={selected.ambienceLevel} onChange={(value) => patchScene({ ambienceLevel:value })} /><LevelField label="SFX Level — ระดับเอฟเฟกต์" value={selected.sfxLevel} onChange={(value) => patchScene({ sfxLevel:value })} /><LevelField label="Dialogue Level — ระดับบทพูด" value={selected.dialogueLevel} onChange={(value) => patchScene({ dialogueLevel:value })} /><LevelField label="Music Level — ระดับดนตรี" value={selected.musicLevel} onChange={(value) => patchScene({ musicLevel:value })} /></div></fieldset></div>`,
  "Optional Sound Mix",
);

studio = replaceRequired(
  studio,
  '<div className={styles.field}><b>Character Blocking — ตำแหน่งและการเคลื่อนของตัวละคร</b><textarea value={selected.blocking} onChange={(e) => patchScene({ blocking:e.target.value })}',
  '<div className={styles.field}><div className={styles.fieldLabel}><b>Character Blocking — ตำแหน่งและการเคลื่อนของตัวละคร</b><label className={styles.autoToggle}><input type="checkbox" checked={selected.manual.blocking === true} onChange={(event) => setManual("blocking", event.target.checked)} /><span>{selected.manual.blocking === true ? "กำหนดเอง" : "AI Auto"}</span></label></div><textarea disabled={selected.manual.blocking !== true} value={selected.manual.blocking === true ? selected.blocking : ""} onChange={(e) => patchScene({ blocking:e.target.value })}',
  "Optional Character Blocking",
);

studio = replaceRequired(
  studio,
  '{scene.duration}s • {scene.shot === "AI" ? "AI Suggest" : scene.shot}',
  '{scene.duration}s • {scene.cameraShots.length} camera shots',
  "Scene list camera shot count",
);

studio = replaceRequired(
  studio,
  '<div><b>Scenes — จำนวนฉาก</b><span>{scenes.length}</span></div><div><b>Duration — เวลารวม</b>',
  '<div><b>Scenes — จำนวนฉาก</b><span>{scenes.length}</span></div><div><b>Camera Shots — จำนวนช็อต</b><span>{scenes.reduce((sum, scene) => sum + scene.cameraShots.length, 0)}</span></div><div><b>Duration — เวลารวม</b>',
  "Review camera shot count",
);

write(studioPath, studio);

const studioCssPath = "components/scenova-studio-v3.module.css";
let studioCss = read(studioCssPath);
if (!studioCss.includes("SCENOVA_OPTIONAL_MULTI_CAMERA_V3")) {
  studioCss += `\n\n/* SCENOVA_OPTIONAL_MULTI_CAMERA_V3 */\n.autoToggle{display:inline-flex!important;align-items:center;gap:6px;border:1px solid #484022;border-radius:999px;background:#15140d;color:#dbc85f;padding:5px 8px;min-height:30px;font-size:11px!important;font-weight:850;cursor:pointer;white-space:nowrap}.autoToggle input{width:15px!important;min-height:15px!important;height:15px!important;margin:0!important;padding:0!important;accent-color:#f1cf55}.field input:disabled,.field textarea:disabled{color:#c9b85a;background:#0d0d0a;border-style:dashed;opacity:.78;cursor:not-allowed}.summaryHint{margin-left:8px;color:#8e8e86;font-size:11px;font-weight:650}.cameraPlan{border:1px solid #3b351d;border-radius:14px;background:linear-gradient(145deg,#12110c,#0b0b0b);padding:13px;margin:4px 0 13px}.cameraPlanHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:11px}.cameraPlanHead>div>b{display:block;color:#f1d66c;font-size:14px}.cameraPlanHead>div>small{display:block;color:#909089;font-size:12px;line-height:1.55;margin-top:4px}.cameraPlanHead>button,.cameraShotHead>button{border:1px solid #4b4221;border-radius:9px;background:#1a180f;color:#f0d26a;min-height:38px;padding:8px 11px;font-size:12px;font-weight:850;cursor:pointer}.cameraShotHead>button:disabled{opacity:.35;cursor:not-allowed}.cameraShotList{display:grid;gap:10px}.cameraShotCard{border:1px solid #2b2b27;border-radius:12px;background:#090909;padding:12px}.cameraShotHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.cameraShotHead>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cameraShotHead span{color:#0a0a0a;background:#f1cf55;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:950}.cameraShotHead b{color:#b7b7b0;font-size:12px;font-variant-numeric:tabular-nums}.cameraShotGrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.cameraShotGrid .field{margin-bottom:0}.cameraPlanNote{display:block;color:#85857e;font-size:12px;line-height:1.55;margin-top:10px}.optionalGroup{border:1px solid #2e2b20;border-radius:11px;background:#0c0c0a;padding:11px;margin-top:10px}.optionalGroupHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:9px}.optionalGroupHead b{display:block;color:#ece7d1;font-size:13px}.optionalGroupHead small{display:block;color:#85857e;font-size:12px;line-height:1.5;margin-top:3px}.optionalFieldset{border:0;padding:0;margin:0;min-width:0}.optionalFieldset:disabled{opacity:.58}.advanced summary{line-height:1.5}.field input[list]{min-height:44px}\n@media(max-width:1200px){.cameraShotGrid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.cameraPlanHead,.optionalGroupHead{flex-direction:column}.cameraShotGrid{grid-template-columns:1fr 1fr}.cameraPlanHead>button{width:100%}}@media(max-width:520px){.cameraShotGrid{grid-template-columns:1fr}.autoToggle{min-height:34px}.summaryHint{display:block;margin:4px 0 0}}\n`;
}
write(studioCssPath, studioCss);

const loginPath = "app/login/page.tsx";
let login = read(loginPath);
if (!login.includes("cinematicBackdrop")) {
  login = replaceRequired(
    login,
    '      <section className={styles.hero}>\n        <div className={styles.brand}>',
    `      <section className={styles.hero}>
        <div className={styles.cinematicBackdrop} aria-hidden="true">
          <div className={styles.cinematicFallback}><span className={styles.neonOrbA} /><span className={styles.neonOrbB} /><span className={styles.energySlash} /><span className={styles.cityGrid} /></div>
          <video className={styles.cinematicVideo} autoPlay muted loop playsInline preload="metadata" poster="/media/scenova-login-cinematic-poster.svg">
            <source media="(min-width: 901px)" src="/media/scenova-login-cinematic-4k.mp4" type="video/mp4" />
          </video>
          <div className={styles.cinematicOverlay} />
        </div>
        <div className={styles.brand}>`,
    "Login cinematic backdrop",
  );
}
write(loginPath, login);

const loginCssPath = "app/login/login.module.css";
let loginCss = read(loginCssPath);
if (!loginCss.includes("SCENOVA_CINEMATIC_LOGIN_V1")) {
  loginCss += `\n\n/* SCENOVA_CINEMATIC_LOGIN_V1 */\n.hero{position:relative;overflow:hidden;isolation:isolate;background:#05060b!important}.brand,.heroCopy,.heroFooter{position:relative;z-index:4}.cinematicBackdrop{position:absolute;inset:0;z-index:0;overflow:hidden;background:#05060b}.cinematicVideo,.cinematicFallback,.cinematicOverlay{position:absolute;inset:0;width:100%;height:100%}.cinematicVideo{z-index:2;object-fit:cover;object-position:center center;filter:saturate(1.08) contrast(1.08) brightness(.76)}.cinematicFallback{z-index:1;background-image:url('/media/scenova-login-cinematic-poster.svg');background-size:cover;background-position:center;transform:scale(1.035);animation:cinematicDrift 12s ease-in-out infinite alternate}.cinematicOverlay{z-index:3;background:linear-gradient(90deg,rgba(4,5,9,.82) 0%,rgba(4,5,9,.48) 46%,rgba(4,5,9,.66) 100%),linear-gradient(0deg,rgba(5,5,7,.78),transparent 42%);box-shadow:inset -70px 0 120px rgba(0,0,0,.32)}.neonOrbA,.neonOrbB,.energySlash,.cityGrid{position:absolute;display:block;pointer-events:none}.neonOrbA{width:44%;aspect-ratio:1;left:-8%;top:10%;border-radius:50%;background:radial-gradient(circle,rgba(0,205,255,.24),rgba(0,205,255,0) 68%);filter:blur(12px);animation:orbFloat 8s ease-in-out infinite}.neonOrbB{width:48%;aspect-ratio:1;right:-14%;bottom:-18%;border-radius:50%;background:radial-gradient(circle,rgba(255,28,169,.24),rgba(255,28,169,0) 66%);filter:blur(15px);animation:orbFloat 10s ease-in-out infinite reverse}.energySlash{width:70%;height:3px;left:18%;top:47%;background:linear-gradient(90deg,transparent,#53dcff 35%,#fff 51%,#ff3bae 68%,transparent);box-shadow:0 0 18px #43cfff,0 0 38px rgba(255,40,170,.5);transform:rotate(-10deg);animation:energyPulse 2.4s ease-in-out infinite}.cityGrid{inset:55% -10% -25%;background-image:linear-gradient(rgba(76,185,255,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(255,52,178,.11) 1px,transparent 1px);background-size:54px 36px;transform:perspective(520px) rotateX(62deg);transform-origin:50% 0;mask-image:linear-gradient(to bottom,#000,transparent 78%)}@keyframes cinematicDrift{from{transform:scale(1.035) translate3d(-.5%,0,0)}to{transform:scale(1.08) translate3d(1.4%,-.8%,0)}}@keyframes orbFloat{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(8%,6%,0) scale(1.12)}}@keyframes energyPulse{0%,100%{opacity:.42;transform:rotate(-10deg) scaleX(.92)}50%{opacity:.95;transform:rotate(-8deg) scaleX(1.08)}}\n@media(max-width:900px){.cinematicVideo{display:none}.cinematicOverlay{background:linear-gradient(180deg,rgba(5,6,10,.7),rgba(7,7,9,.9))}.cinematicFallback{animation:none;transform:none;background-position:center 48%}}@media(prefers-reduced-motion:reduce){.cinematicVideo{display:none}.cinematicFallback,.neonOrbA,.neonOrbB,.energySlash{animation:none!important}}\n`;
}
write(loginCssPath, loginCss);

const poster = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160" viewBox="0 0 3840 2160">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#050713"/><stop offset=".52" stop-color="#100922"/><stop offset="1" stop-color="#050609"/></linearGradient>
    <radialGradient id="cyan"><stop stop-color="#37d8ff" stop-opacity=".46"/><stop offset="1" stop-color="#37d8ff" stop-opacity="0"/></radialGradient>
    <radialGradient id="mag"><stop stop-color="#ff2aa8" stop-opacity=".4"/><stop offset="1" stop-color="#ff2aa8" stop-opacity="0"/></radialGradient>
    <linearGradient id="beam" x1="0" x2="1"><stop stop-color="#2ee7ff" stop-opacity="0"/><stop offset=".32" stop-color="#54e8ff"/><stop offset=".52" stop-color="#fff"/><stop offset=".72" stop-color="#ff36b1"/><stop offset="1" stop-color="#ff36b1" stop-opacity="0"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="18" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="3840" height="2160" fill="url(#bg)"/>
  <circle cx="620" cy="420" r="820" fill="url(#cyan)"/>
  <circle cx="3240" cy="1600" r="980" fill="url(#mag)"/>
  <g fill="#080a14">
    <path d="M0 1540h230v-430h130v430h210V930h170v610h180v-510h220v510h160V820h210v720h180v-590h250v590h190V740h170v800h210v-660h250v660h170v-470h230v470h170v-590h240v590h210v-360h190v980H0z"/>
  </g>
  <g opacity=".48" fill="#49dfff"><path d="M300 1200h22v58h-22zm70-90h18v42h-18zm630-160h18v48h-18zm760-100h20v54h-20zm860 210h18v48h-18z"/></g>
  <g opacity=".42" fill="#ff43b4"><path d="M720 1080h20v52h-20zm610-180h20v50h-20zm760 110h20v46h-20zm830-100h20v52h-20z"/></g>
  <g fill="#03040a">
    <circle cx="1530" cy="1390" r="46"/><path d="M1482 1440h96l38 270h-42l-24-150-18 150h-46z"/><path d="M1510 1490l-180 85 20 36 200-55z"/>
    <circle cx="2440" cy="1370" r="48"/><path d="M2392 1422h98l32 288h-44l-22-160-20 160h-48z"/><path d="M2410 1475l190 60-14 38-210-42z"/>
  </g>
  <path d="M1160 1510L2840 1180" stroke="url(#beam)" stroke-width="20" filter="url(#glow)"/>
  <path d="M1350 1290L2600 1600" stroke="url(#beam)" stroke-width="11" opacity=".68" filter="url(#glow)"/>
  <g fill="#ffd66a" opacity=".8"><circle cx="2010" cy="1370" r="8"/><circle cx="2070" cy="1330" r="5"/><circle cx="2130" cy="1420" r="7"/><circle cx="1940" cy="1450" r="4"/></g>
  <rect y="1830" width="3840" height="330" fill="#030409" opacity=".88"/>
</svg>`;
write("public/media/scenova-login-cinematic-poster.svg", poster);

console.log("SCENOVA Studio cinematic upgrade patch applied successfully.");
