import fs from "node:fs";

const studioPath = "components/single-episode-studio.tsx";
const cssPath = "components/single-episode-studio.module.css";

function replaceOrFail(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`PATCH_MISS:${label}`);
  return source.replace(search, replacement);
}

let studio = fs.readFileSync(studioPath, "utf8");

studio = replaceOrFail(
  studio,
  `const GLOBAL_LOCKS = [\n  { key: "Character", label: "Character Lock", help: "รักษาหน้าตา รูปร่าง เสื้อผ้า และจุดจำของตัวละครตลอดทั้งตอน" },\n  { key: "Voice", label: "Voice Lock", help: "รักษา Voice Profile และบุคลิกการพูดของแต่ละตัวละคร" },\n  { key: "Visual Style", label: "Visual Style Lock", help: "คุมภาษาภาพ สี และระดับความสมจริงให้เหมือนกันทุกฉาก" },\n  { key: "Camera Language", label: "Camera Language Lock", help: "รักษาภาษากล้องหลัก แต่ยังปรับ Shot ของแต่ละฉากได้" },\n  { key: "Lighting", label: "Lighting Lock", help: "ช่วยรักษาทิศทางและคุณภาพแสงระหว่างฉากที่ต่อเนื่องกัน" },\n  { key: "Location", label: "Location Lock", help: "รักษารูปทรงและรายละเอียดสถานที่เมื่อกลับมาใช้สถานที่เดิม" },\n  { key: "Props", label: "Props Lock", help: "รักษารูปร่าง สี ตำแหน่ง และเจ้าของ Prop สำคัญ" },\n] as const;`,
  `const GLOBAL_LOCKS = [\n  { key: "Character", label: "ล็อกตัวละคร", help: "รักษาหน้าตา รูปร่าง เสื้อผ้า และจุดจำของตัวละครตลอดทั้งตอน" },\n  { key: "Voice", label: "ล็อกเสียง", help: "รักษาโปรไฟล์เสียงและบุคลิกการพูดของแต่ละตัวละคร" },\n  { key: "Visual Style", label: "ล็อกสไตล์ภาพ", help: "คุมภาษาภาพ สี และระดับความสมจริงให้เหมือนกันทุกฉาก" },\n  { key: "Camera Language", label: "ล็อกภาษากล้อง", help: "รักษาภาษากล้องหลัก แต่ยังปรับระยะภาพของแต่ละฉากได้" },\n  { key: "Lighting", label: "ล็อกแสง", help: "ช่วยรักษาทิศทางและคุณภาพแสงระหว่างฉากที่ต่อเนื่องกัน" },\n  { key: "Location", label: "ล็อกสถานที่", help: "รักษารูปทรงและรายละเอียดสถานที่เมื่อกลับมาใช้สถานที่เดิม" },\n  { key: "Props", label: "ล็อกพร็อพ", help: "รักษารูปร่าง สี ตำแหน่ง และเจ้าของพร็อพสำคัญ" },\n] as const;`,
  "global-lock-thai",
);

studio = studio
  .replace('<a href="#characters"><b>2</b><span>ตัวละคร<small>Identity + Voice Lock</small></span></a>', '<a href="#characters"><b>2</b><span>ตัวละคร<small>ล็อกตัวตน + ล็อกเสียง</small></span></a>')
  .replace('<a href="#scenes"><b>3</b><span>กำกับฉาก<small>Camera + Light + Sound</small></span></a>', '<a href="#scenes"><b>3</b><span>กำกับฉาก<small>กล้อง + แสง + เสียง</small></span></a>');

studio = replaceOrFail(
  studio,
  '        <label className={`${styles.field} ${styles.negativeField}`}><span>ข้อห้ามหลักของตอน</span><textarea value={globalNegative} onChange={(event) => setGlobalNegative(event.target.value)} /><small>ข้อห้ามระดับทั้งตอน เช่น ห้ามเปลี่ยนหน้า ห้ามเปลี่ยนชุด ห้ามตัวละครซ้ำ ห้ามตัวหนังสือ/ลายน้ำ</small></label>\n',
  '',
  "remove-global-negative-ui",
);

studio = replaceOrFail(
  studio,
  '      setCharacters((current) => [imported, ...current.filter((item) => item.id !== imported.id)].slice(0, 8));\n      setMessage(`นำเข้า ${payload.title} จากคลังแล้ว`);',
  '      const targetId = localStorage.getItem("scenova-character-import-target-v1");\n      setCharacters((current) => {\n        if (targetId && current.some((item) => item.id === targetId)) {\n          return current.map((item) => item.id === targetId ? { ...imported, id: targetId } : item);\n        }\n        return [imported, ...current.filter((item) => item.id !== imported.id)].slice(0, 8);\n      });\n      setMessage(`นำเข้า ${payload.title} จากคลังแล้ว`);',
  "target-character-import",
);

studio = replaceOrFail(
  studio,
  '    } finally {\n      localStorage.removeItem("scenova-selected-character-v1");\n    }\n  }, []);',
  '    } finally {\n      localStorage.removeItem("scenova-selected-character-v1");\n      localStorage.removeItem("scenova-character-import-target-v1");\n    }\n  }, []);',
  "clear-character-target",
);

studio = replaceOrFail(
  studio,
  '            <div className={styles.miniLocks}><label className={character.identityLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.identityLock} onChange={(event) => patchCharacter(character.id, { identityLock: event.target.checked })} />Identity Lock</label><label className={character.voiceLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.voiceLock} onChange={(event) => patchCharacter(character.id, { voiceLock: event.target.checked })} />Voice Lock</label></div>',
  '            <div className={styles.miniLocks}><label className={character.identityLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.identityLock} onChange={(event) => patchCharacter(character.id, { identityLock: event.target.checked })} />ล็อกตัวตน</label><label className={character.voiceLock ? styles.miniLockActive : ""}><input type="checkbox" checked={character.voiceLock} onChange={(event) => patchCharacter(character.id, { voiceLock: event.target.checked })} />ล็อกเสียง</label><Link href="/libraries?tab=characters" onClick={() => localStorage.setItem("scenova-character-import-target-v1", character.id)}>＋ นำเข้าตัวละครจากคลัง</Link></div>',
  "character-lock-row",
);

studio = replaceOrFail(
  studio,
  '      <div className={styles.castUtilities}><Link href="/libraries?tab=characters">＋ นำเข้าตัวละครจากคลัง</Link><Link href="/libraries?tab=voices">เปิดคลังเสียง</Link></div>',
  '      <div className={styles.castUtilities}><Link href="/libraries?tab=voices">เปิดคลังเสียง</Link></div>',
  "remove-global-character-import",
);

fs.writeFileSync(studioPath, studio);

let css = fs.readFileSync(cssPath, "utf8");
if (!css.includes("/* Single Episode layout v4 */")) {
  css += `\n\n/* Single Episode layout v4 */\n.episodeTiming{grid-column:3/5!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:start!important;margin-top:0!important}.timingSummary{grid-column:1/-1!important}.miniLocks{flex-wrap:wrap;align-items:center}.miniLocks>a{display:inline-flex;align-items:center;min-height:31px;border:1px solid var(--border);border-radius:999px;background:var(--surface3);color:var(--accent);padding:6px 10px;text-decoration:none;font-size:10px;font-weight:850}.miniLocks>a:hover{border-color:var(--borderStrong);background:var(--accentSoft)}.timeline button{flex:1 1 0!important;min-width:150px!important;width:auto!important;max-width:none!important;height:68px!important;min-height:68px!important;padding:8px 10px!important}.timeline button.timelineActive{height:68px!important;min-height:68px!important;transform:none!important}.timeline button b,.timeline button span{line-height:1.35}@media(max-width:980px){.episodeTiming{grid-column:1/-1!important}}@media(max-width:680px){.episodeTiming{grid-template-columns:1fr!important}.timingSummary{grid-column:1!important}}\n`;
}
fs.writeFileSync(cssPath, css);

console.log("Applied Single Episode layout v4 patch");
