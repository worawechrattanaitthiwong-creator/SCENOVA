import fs from "node:fs";

const studioPath = "components/single-episode-studio.tsx";
const cssPath = "components/single-episode-studio.module.css";
const polishPath = "components/single-episode-studio-polish.tsx";

function replaceOrFail(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`PATCH_MISS:${label}`);
  return source.replace(search, replacement);
}

let studio = fs.readFileSync(studioPath, "utf8");

studio = replaceOrFail(
  studio,
  '} from "@/lib/sound-design-options";\n',
  '} from "@/lib/sound-design-options";\nimport { getVideoUiCapability } from "@/lib/providers/video-ui-capabilities";\n',
  "capability import",
);

studio = replaceOrFail(
  studio,
  "const safeCount = Math.max(1, Math.min(count, Math.min(12, total)));",
  "const safeCount = Math.max(1, Math.min(count, total));",
  "scene limit",
);

studio = replaceOrFail(
  studio,
  'if (typeof draft.totalDuration === "number") setTotalDuration(Math.max(10, Math.min(180, draft.totalDuration)));\n      if (Array.isArray(draft.scenes) && draft.scenes.length) setScenes(draft.scenes.slice(0, 12).map((scene, index) => normalizeScene(scene, index + 1)));',
  'if (typeof draft.totalDuration === "number") setTotalDuration(Math.max(1, Math.min(180, Math.round(draft.totalDuration))));\n      if (Array.isArray(draft.scenes) && draft.scenes.length) setScenes(draft.scenes.slice(0, 180).map((scene, index) => normalizeScene(scene, index + 1)));',
  "draft limits",
);

studio = replaceOrFail(
  studio,
  '  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];\n  const usedDuration = useMemo(() => scenes.reduce((sum, scene) => sum + scene.duration, 0), [scenes]);',
  '  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0];\n  const videoCapability = getVideoUiCapability(model);\n  const providerMaxSeconds = Math.max(...videoCapability.durationSeconds);\n  const providerMinScenes = Math.max(1, Math.ceil(totalDuration / providerMaxSeconds));\n  const usedDuration = useMemo(() => scenes.reduce((sum, scene) => sum + scene.duration, 0), [scenes]);',
  "provider derived values",
);

studio = replaceOrFail(
  studio,
  '  function resizeScenes(count: number) {\n    setScenes((current) => distributeScenes(current, count, totalDuration));\n  }\n\n  function changeTotalDuration(value: number) {\n    const next = Math.max(10, Math.min(180, value));\n    setTotalDuration(next);\n    setScenes((current) => fitScenesToTotal(current, next));\n  }',
  '  function resizeScenes(count: number) {\n    const safeCount = Math.max(providerMinScenes, Math.min(Math.max(1, Math.round(count)), totalDuration));\n    setScenes((current) => distributeScenes(current, safeCount, totalDuration));\n  }\n\n  function changeTotalDuration(value: number) {\n    const next = Math.max(1, Math.min(180, Math.round(value || 1)));\n    const requiredScenes = Math.max(1, Math.ceil(next / providerMaxSeconds));\n    setTotalDuration(next);\n    setScenes((current) => {\n      const nextCount = Math.max(requiredScenes, Math.min(current.length, next));\n      return distributeScenes(fitScenesToTotal(current, next), nextCount, next);\n    });\n  }\n\n  function changeModel(nextModel: string) {\n    const capability = getVideoUiCapability(nextModel);\n    const maxSeconds = Math.max(...capability.durationSeconds);\n    const requiredScenes = Math.max(1, Math.ceil(totalDuration / maxSeconds));\n    setModel(nextModel);\n    setScenes((current) => {\n      const needsSplit = current.length < requiredScenes || current.some((scene) => scene.duration > maxSeconds);\n      return needsSplit ? distributeScenes(current, Math.max(requiredScenes, current.length), totalDuration) : current;\n    });\n  }',
  "timing functions",
);

studio = replaceOrFail(
  studio,
  '      const nextDuration = Math.max(1, Math.min(value, Math.max(1, totalDuration - other)));',
  '      const nextDuration = Math.max(1, Math.min(value, providerMaxSeconds, Math.max(1, totalDuration - other)));',
  "scene provider max",
);

studio = replaceOrFail(
  studio,
  '<span className={styles.eyebrow}>SINGLE EPISODE STUDIO</span>',
  '<span className={styles.eyebrow}>สตูดิโอสร้างตอนเดียว</span>',
  "hero eyebrow",
);
studio = studio
  .replace('aria-label="ขั้นตอน Single Episode"', 'aria-label="ขั้นตอนสร้างตอนเดียว"')
  .replace('<div><span>EPISODE SETUP — ตั้งค่าตอน</span><h2>กำหนดภาพรวมของตอนเดียว</h2></div>', '<div><span>ตั้งค่าตอน</span><h2>กำหนดภาพรวมของตอนเดียว</h2></div>')
  .replace('<div className={styles.sectionHead}><div><span>CAST & IDENTITY — ตัวละคร</span><h2>กำหนดตัวตนก่อนกำกับกล้อง</h2></div>', '<div className={styles.sectionHead}><div><span>ตัวละครและตัวตน</span><h2>กำหนดตัวตนก่อนกำกับกล้อง</h2></div>')
  .replace('<div className={styles.sectionHead}><div><span>SCENE DIRECTOR — กำกับฉาก</span><h2>กำกับทีละฉาก พร้อมกล้องเต็มชุด</h2></div>', '<div className={styles.sectionHead}><div><span>กำกับฉาก</span><h2>กำกับทีละฉาก พร้อมกล้องเต็มชุด</h2></div>')
  .replace('<div><span>PRODUCTION READINESS</span><h2>ความพร้อมของตอนนี้</h2>', '<div><span>ตรวจความพร้อมก่อนสร้าง</span><h2>ความพร้อมของตอนนี้</h2>')
  .replace('<div className={styles.blockHead}><div><span>CAST BLOCKING</span>', '<div className={styles.blockHead}><div><span>ตัวละครในฉาก</span>')
  .replace('<div className={styles.blockHead}><div><span>ACTION & DIALOGUE</span>', '<div className={styles.blockHead}><div><span>เหตุการณ์และบทพูด</span>')
  .replace('<div className={styles.blockHead}><div><span>CAMERA DIRECTION</span>', '<div className={styles.blockHead}><div><span>กำกับกล้อง</span>')
  .replace('<div className={styles.blockHead}><div><span>LOOK & PERFORMANCE</span>', '<div className={styles.blockHead}><div><span>ภาพและการแสดง</span>')
  .replace('<div className={styles.blockHead}><div><span>SOUND DESIGN</span>', '<div className={styles.blockHead}><div><span>ออกแบบเสียง</span>')
  .replace('<div className={styles.blockHead}><div><span>CONTINUITY & SAFETY</span>', '<div className={styles.blockHead}><div><span>ความต่อเนื่องและข้อห้าม</span>')
  .replace('<span>Video Model</span><select value={model} onChange={(event) => setModel(event.target.value)}>', '<span>โมเดลวิดีโอ</span><select value={model} onChange={(event) => changeModel(event.target.value)}>')
  .replace('<span>Aspect Ratio</span><select value={aspect}', '<span>อัตราส่วนภาพ</span><select value={aspect}')
  .replace('<span>Visual Style</span><select value={visualStyle}', '<span>สไตล์ภาพ</span><select value={visualStyle}')
  .replace('<span>Global Negative Prompt</span>', '<span>ข้อห้ามหลักของตอน</span>')
  .replace('<span>Voice Profile</span>', '<span>โปรไฟล์เสียง</span>')
  .replace('label="Scene Objective — เป้าหมายฉาก"', 'label="เป้าหมายฉาก"')
  .replace('label="Story Beat — จังหวะเรื่อง"', 'label="จังหวะเรื่อง"')
  .replace('label="Transition — การเปลี่ยนฉาก"', 'label="การเปลี่ยนฉาก"')
  .replace('label="Camera Subject — กล้องโฟกัส/ตามใคร"', 'label="กล้องโฟกัส/ตามใคร"')
  .replace('label="Shot Type — ระยะภาพ"', 'label="ระยะภาพ"')
  .replace('label="Camera Angle — มุมกล้อง"', 'label="มุมกล้อง"')
  .replace('label="Lens — เลนส์"', 'label="เลนส์"')
  .replace('label="Movement — การเคลื่อนกล้อง"', 'label="การเคลื่อนกล้อง"')
  .replace('label="Camera Height — ความสูงกล้อง"', 'label="ความสูงกล้อง"')
  .replace('label="Camera Speed — ความเร็วกล้อง"', 'label="ความเร็วกล้อง"')
  .replace('label="Focus — จุดโฟกัส"', 'label="จุดโฟกัส"')
  .replace('label="Depth of Field — ชัดตื้น/ลึก"', 'label="ระยะชัดลึก"')
  .replace('label="Composition — องค์ประกอบภาพ"', 'label="องค์ประกอบภาพ"')
  .replace('label="Lighting Style — รูปแบบแสง"', 'label="รูปแบบแสง"')
  .replace('label="Color Temperature — อุณหภูมิสี"', 'label="อุณหภูมิสี"')
  .replace('label="Scene Emotion — อารมณ์หลัก"', 'label="อารมณ์หลัก"')
  .replace('label="Performance — รูปแบบการแสดง"', 'label="รูปแบบการแสดง"')
  .replace('label="Primary Ambience — เสียงบรรยากาศหลัก"', 'label="เสียงบรรยากาศหลัก"')
  .replace('label="Secondary Ambience — เสียงพื้นรอง"', 'label="เสียงพื้นรอง"')
  .replace('label="SFX Preset — เอฟเฟกต์เสียง"', 'label="เอฟเฟกต์เสียง"')
  .replace('label="Music — ดนตรี"', 'label="ดนตรี"')
  .replace('<span>SCENE {String(scenes.findIndex((item) => item.id === selectedScene.id) + 1).padStart(2, "0")}</span>', '<span>ฉาก {String(scenes.findIndex((item) => item.id === selectedScene.id) + 1).padStart(2, "0")}</span>')
  .replace('<span>Scenes</span>', '<span>ฉาก</span>')
  .replace('<span>Characters</span>', '<span>ตัวละคร</span>')
  .replace('<span>Video Model</span>', '<span>โมเดลวิดีโอ</span>')
  .replace(' • Ready {readiness.score}%', ' • พร้อม {readiness.score}%');

const timingAnchor = '        <label className={`${styles.field} ${styles.negativeField}`}><span>ข้อห้ามหลักของตอน</span><textarea value={globalNegative} onChange={(event) => setGlobalNegative(event.target.value)} /><small>ข้อห้ามระดับทั้งตอน เช่น ห้ามเปลี่ยนหน้า ห้ามเปลี่ยนชุด ห้ามตัวละครซ้ำ ห้ามตัวหนังสือ/ลายน้ำ</small></label>\n';
const timingUi = `${timingAnchor}        <div className={styles.episodeTiming}>\n          <label className={styles.timingField}>\n            <span>ความยาวรวมของตอน</span>\n            <div className={styles.secondsInput}><input type="number" min={1} max={180} step={1} value={totalDuration} onChange={(event) => changeTotalDuration(Number(event.target.value))} /><b>วินาที</b></div>\n            <small>เลือกได้อิสระ 1–180 วินาที (สูงสุด 3 นาที)</small>\n          </label>\n          <div className={styles.timingField}>\n            <span>จำนวนฉาก</span>\n            <Counter value={scenes.length} min={providerMinScenes} max={totalDuration} onChange={resizeScenes} label="จำนวนฉาก" />\n            <small>ขั้นต่ำ {providerMinScenes} ฉากสำหรับ {model} • เพิ่มได้สูงสุด {totalDuration} ฉาก</small>\n          </div>\n          <div className={styles.timingSummary}>\n            <strong>{totalDuration} วินาที • {scenes.length} ฉาก</strong>\n            <span>{model} สร้างได้สูงสุด {providerMaxSeconds} วินาทีต่อคลิป ระบบจะเพิ่มจำนวนฉากอัตโนมัติเมื่อเวลารวมเกินขีดจำกัดของ API</span>\n          </div>\n        </div>\n`;
studio = replaceOrFail(studio, timingAnchor, timingUi, "timing UI");

studio = replaceOrFail(
  studio,
  '      <div className={styles.sectionHeadRow}>\n        <div className={styles.sectionHead}><div><span>กำกับฉาก</span><h2>กำกับทีละฉาก พร้อมกล้องเต็มชุด</h2></div><p>Scene แต่ละฉากมีเวลา Cast Blocking กล้อง เลนส์ แสง Performance Sound Design และ Negative Prompt ของตัวเอง</p></div>\n        <div className={styles.countBox}><span>จำนวนฉาก</span><Counter value={scenes.length} min={1} max={12} onChange={resizeScenes} label="จำนวนฉาก" /></div>\n      </div>\n\n      <div className={styles.durationPanel}><div><span>เวลารวมของตอน</span><strong>{totalDuration} วินาที</strong></div><input type="range" min={10} max={180} step={5} value={totalDuration} onChange={(event) => changeTotalDuration(Number(event.target.value))} /><small>ใช้แล้ว {usedDuration} วินาที{remainingDuration > 0 ? ` • เหลือ ${remainingDuration} วินาที` : " • จัดเวลาครบ"}</small></div>\n      <div className={styles.timeline}>{scenes.map((scene, index) => <button type="button" key={scene.id} className={scene.id === selectedScene?.id ? styles.timelineActive : ""} onClick={() => setSelectedSceneId(scene.id)} style={{ flexGrow: Math.max(1, scene.duration) }}><b>{index + 1}</b><span>{scene.duration}s</span></button>)}</div>',
  '      <div className={styles.sectionHead}>\n        <div><span>กำกับฉาก</span><h2>กำกับทีละฉาก พร้อมกล้องเต็มชุด</h2></div><p>แต่ละฉากมีเวลา ตัวละคร กล้อง เลนส์ แสง การแสดง เสียง และข้อห้ามของตัวเอง โดยเวลารวมจะไม่เกินค่าที่ตั้งไว้ด้านบน</p>\n      </div>\n\n      <div className={styles.timeline}>{scenes.map((scene, index) => <button type="button" key={scene.id} className={scene.id === selectedScene?.id ? styles.timelineActive : ""} onClick={() => setSelectedSceneId(scene.id)}><b>ฉาก {index + 1}</b><span>{scene.duration} วินาที</span></button>)}</div>',
  "scene header timing removal",
);

studio = studio.replace('• {scene.duration}s</small>', '• {scene.duration} วินาที</small>');
studio = studio.replace(
  'max={Math.max(1, selectedScene.duration + remainingDuration)}',
  'max={Math.max(1, Math.min(providerMaxSeconds, selectedScene.duration + remainingDuration))}',
);

fs.writeFileSync(studioPath, studio);

let css = fs.readFileSync(cssPath, "utf8");
css += `\n\n/* Single Episode timing v2 */\n.episodeTiming{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(260px,.75fr) minmax(0,1.15fr);gap:10px;margin-top:2px;padding:13px;border:1px solid var(--border);border-radius:11px;background:var(--surface2)}\n.timingField{display:flex;flex-direction:column;gap:6px;min-width:0}.timingField>span{color:var(--text);font-size:12px;font-weight:850}.timingField>small,.timingSummary span{color:var(--muted);font-size:10px;line-height:1.45}.secondsInput{display:flex;align-items:center;gap:7px}.secondsInput input{width:100%;min-height:43px;border:1px solid var(--border);border-radius:9px;background:var(--input);color:var(--text);padding:9px 10px;outline:none}.secondsInput input:focus{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}.secondsInput b{color:var(--accent);font-size:12px;white-space:nowrap}.timingField .counter{width:max-content}.timingSummary{display:flex;flex-direction:column;justify-content:center;gap:4px;padding:10px 12px;border:1px solid var(--border);border-radius:9px;background:var(--surface3)}.timingSummary strong{color:var(--accent);font-size:13px}.timeline button{flex:1 1 0;min-width:112px}.timeline button b,.timeline button span{text-align:center}.timeline button b{font-size:10px}.timeline button span{margin-top:2px;font-size:9px}.sceneDuration input{max-width:100%}@media(max-width:980px){.episodeTiming{grid-template-columns:1fr 1fr}.timingSummary{grid-column:1/-1}}@media(max-width:680px){.episodeTiming{grid-template-columns:1fr}}\n`;
fs.writeFileSync(cssPath, css);

const polish = `"use client";\n\nimport { useEffect, useRef, useState } from "react";\nimport { createPortal } from "react-dom";\nimport { getVideoUiCapability } from "@/lib/providers/video-ui-capabilities";\n\ntype RatioPreview = { value: string; short: string; orientation: string; iconWidth: number; iconHeight: number };\nconst RATIOS: RatioPreview[] = [\n  { value: "16:9 — Widescreen", short: "16:9", orientation: "แนวนอน • Widescreen", iconWidth: 32, iconHeight: 18 },\n  { value: "9:16 — Vertical", short: "9:16", orientation: "แนวตั้ง • Vertical", iconWidth: 18, iconHeight: 32 },\n  { value: "1:1 — Square", short: "1:1", orientation: "จัตุรัส • Square", iconWidth: 25, iconHeight: 25 },\n  { value: "4:5 — Portrait", short: "4:5", orientation: "แนวตั้ง • Portrait", iconWidth: 22, iconHeight: 28 },\n];\nfunction compact(value: string | null | undefined){return (value||"").replace(/\\s+/g," ").trim()}\nfunction findFieldByLabel(root: HTMLElement,label: string){return Array.from(root.querySelectorAll<HTMLLabelElement>("label")).find((field)=>{const direct=Array.from(field.children).find((child)=>child.tagName==="SPAN");return compact(direct?.textContent)===label})||null}\nfunction setNativeSelectValue(select: HTMLSelectElement,value: string){const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value")?.set;setter?.call(select,value);select.dispatchEvent(new Event("input",{bubbles:true}));select.dispatchEvent(new Event("change",{bubbles:true}))}\nfunction RatioFrame({ratio}:{ratio:RatioPreview}){return <span className="sc-ratio-frame-shell" aria-hidden="true"><span className="sc-ratio-frame-shape" style={{width:ratio.iconWidth,height:ratio.iconHeight}}/></span>}\nfunction AspectPicker({select,modelSelect}:{select:HTMLSelectElement;modelSelect:HTMLSelectElement}){const [value,setValue]=useState(select.value);const [model,setModel]=useState(modelSelect.value);const [open,setOpen]=useState(false);const rootRef=useRef<HTMLDivElement>(null);useEffect(()=>{const sync=()=>{setValue(select.value);setModel(modelSelect.value)};sync();select.addEventListener("change",sync);modelSelect.addEventListener("change",sync);return()=>{select.removeEventListener("change",sync);modelSelect.removeEventListener("change",sync)}},[select,modelSelect]);const capability=getVideoUiCapability(model);const selected=RATIOS.find((item)=>item.value===value)||RATIOS[0];useEffect(()=>{if(capability.ratioValues.includes(select.value))return;const fallback=capability.ratioValues[0];if(fallback)setNativeSelectValue(select,fallback)},[capability,select]);useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{const target=event.target;if(target instanceof Node&&rootRef.current?.contains(target))return;setOpen(false)};const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};document.addEventListener("pointerdown",close);document.addEventListener("keydown",key);return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",key)}},[open]);return <div className="sc-ratio-picker" ref={rootRef} data-sc-help-ignore><button type="button" className="sc-ratio-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={(event)=>{event.preventDefault();event.stopPropagation();setOpen((current)=>!current)}}><RatioFrame ratio={selected}/><span className="sc-ratio-trigger-copy"><strong>{selected.value}</strong><small>{selected.orientation}</small></span><span className="sc-ratio-chevron" aria-hidden="true">⌄</span></button>{open?<div className="sc-ratio-menu" role="listbox" aria-label="อัตราส่วนภาพ">{RATIOS.map((ratio)=>{const supported=capability.ratioValues.includes(ratio.value);const active=ratio.value===value;return <button key={ratio.value} type="button" role="option" aria-selected={active} disabled={!supported} className={\\`sc-ratio-option\\${active?" is-active":""}\\`} onClick={(event)=>{event.preventDefault();event.stopPropagation();if(!supported)return;setNativeSelectValue(select,ratio.value);setOpen(false)}}><RatioFrame ratio={ratio}/><span><strong>{ratio.value}</strong><small>{supported?ratio.orientation:\\`\\${ratio.orientation} • API รุ่นนี้ไม่รองรับตรง\\`}</small></span>{active?<b aria-hidden="true">✓</b>:null}</button>})}</div>:null}</div>}\nexport default function SingleEpisodeStudioPolish(){const [aspectField,setAspectField]=useState<HTMLLabelElement|null>(null);const [aspectSelect,setAspectSelect]=useState<HTMLSelectElement|null>(null);const [modelSelect,setModelSelect]=useState<HTMLSelectElement|null>(null);useEffect(()=>{let stopped=false;let timer=0;const discover=()=>{if(stopped)return;const setup=document.getElementById("setup");const scenes=document.getElementById("scenes");if(!setup||!scenes){timer=window.setTimeout(discover,80);return}const aspect=findFieldByLabel(setup,"อัตราส่วนภาพ")||findFieldByLabel(setup,"Aspect Ratio");const model=findFieldByLabel(setup,"โมเดลวิดีโอ")||findFieldByLabel(setup,"Video Model");setAspectField(aspect);setAspectSelect(aspect?.querySelector("select")||null);setModelSelect(model?.querySelector("select")||null);const suppress=()=>{["[class*='single-episode-studio_sceneList']","[class*='single-episode-studio_timeline']","[class*='single-episode-studio_sceneEditorHead']","[class*='single-episode-studio_sceneDuration']"].forEach((selector)=>scenes.querySelectorAll<HTMLElement>(selector).forEach((scope)=>{scope.dataset.scHelpIgnore="true";scope.querySelectorAll(".sc-system-info-trigger").forEach((node)=>node.remove())}))};suppress();const observer=new MutationObserver(suppress);observer.observe(scenes,{childList:true,subtree:true});(scenes as HTMLElement&{__scPolishObserver?:MutationObserver}).__scPolishObserver=observer};discover();return()=>{stopped=true;window.clearTimeout(timer);const scenes=document.getElementById("scenes") as (HTMLElement&{__scPolishObserver?:MutationObserver})|null;scenes?.__scPolishObserver?.disconnect()}},[]);return <><style>{\\`[class*='single-episode-studio_field']:has(>span:first-child){position:relative}.sc-ratio-picker{position:relative}.sc-ratio-picker+select,.sc-ratio-picker~select{display:none!important}.sc-ratio-picker~small{display:none!important}.sc-ratio-trigger{width:100%;min-height:43px;display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:9px;background:var(--input);color:var(--text);padding:7px 10px;text-align:left;cursor:pointer}.sc-ratio-frame-shell{width:42px;height:34px;flex:0 0 42px;display:grid;place-items:center;border:1px solid var(--border);border-radius:7px;background:var(--surface3)}.sc-ratio-frame-shape{display:block;border:2px solid var(--accent);border-radius:3px;background:color-mix(in srgb,var(--accent) 9%,transparent)}.sc-ratio-trigger-copy{min-width:0;flex:1}.sc-ratio-trigger-copy strong,.sc-ratio-trigger-copy small{display:block}.sc-ratio-trigger-copy strong{font-size:11px}.sc-ratio-trigger-copy small{margin:1px 0 0;color:var(--muted);font-size:9px}.sc-ratio-chevron{color:var(--muted);font-size:16px}.sc-ratio-menu{position:absolute;z-index:50;top:calc(100% + 5px);left:0;right:0;display:grid;gap:4px;padding:6px;border:1px solid var(--borderStrong);border-radius:10px;background:var(--surface);box-shadow:0 18px 45px rgba(0,0,0,.3)}.sc-ratio-option{width:100%;display:flex;align-items:center;gap:10px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--text);padding:7px;text-align:left;cursor:pointer}.sc-ratio-option:hover:not(:disabled),.sc-ratio-option.is-active{border-color:var(--borderStrong);background:var(--accentSoft)}.sc-ratio-option:disabled{opacity:.38;cursor:not-allowed}.sc-ratio-option>span:nth-child(2){min-width:0;flex:1}.sc-ratio-option strong,.sc-ratio-option small{display:block}.sc-ratio-option strong{font-size:11px}.sc-ratio-option small{margin-top:1px;color:var(--muted);font-size:9px}.sc-ratio-option>b{color:var(--accent)}\\`}</style>{aspectField&&aspectSelect&&modelSelect?createPortal(<AspectPicker select={aspectSelect} modelSelect={modelSelect}/>,aspectField):null}</>}\n`;
fs.writeFileSync(polishPath, polish);

console.log("Applied Single Episode timing v2 patch");
