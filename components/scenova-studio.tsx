"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./scenova-studio-v2.module.css";

type Mode = "auto" | "scene" | "pro" | "episode";
type Gender = "หญิง" | "ชาย" | "ไม่ระบุ";
type Choice = { value: string; label: string; help: string };
type Character = {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  nationality: string;
  personality: string;
  voice: string;
  hair: string;
  eyes: string;
  mouth: string;
  body: string;
  reference?: string;
};
type Scene = {
  id: string;
  title: string;
  duration: number;
  story: string;
  cast: string[];
  location: string;
  shot: string;
  angle: string;
  lens: string;
  movement: string;
  height: string;
  lighting: string;
  focus: string;
  dof: string;
  composition: string;
  emotion: string;
  dialogue: string;
  sound: string;
};

const MODES = [
  { id: "auto" as const, icon: "✦", name: "AI ทำให้หมด", note: "กำหนดข้อมูลหลัก แล้ว AI ช่วยวางฉาก กล้อง แสง และจังหวะให้", tag: "ง่ายที่สุด" },
  { id: "scene" as const, icon: "▦", name: "แบ่งฉากเอง", note: "กำหนดเนื้อหาแต่ละฉากเอง และเรียก AI ช่วยเฉพาะส่วนที่ต้องการ", tag: "ควบคุมง่าย" },
  { id: "pro" as const, icon: "◆", name: "Director Pro", note: "ใช้หน้าจอเดียวกัน แต่เปิด Focus, DOF และ Composition ระดับมืออาชีพ", tag: "มืออาชีพ" },
  { id: "episode" as const, icon: "EP", name: "EP / Series", note: "สร้างเป็นตอน โดยรักษาตัวละครและความต่อเนื่องจากตอนก่อนหน้า", tag: "หลายตอน" },
];

const MODELS = ["Seedance 2.5", "Kling", "Veo", "Runway", "Wan"];
const STYLES = ["Cinematic Anime", "Photorealistic Film", "Warm Golden Hour", "Action Blockbuster", "Sci-Fi Neon", "Fantasy Storybook", "Dark Thriller", "Cute 3D"];
const VOICES = [["Mira", "หญิง • อบอุ่น"], ["Nami", "หญิง • สดใส"], ["Arin", "ชาย • สุขุม"], ["Keen", "ชาย • หนักแน่น"], ["Luna", "หญิง • นุ่มแฟนตาซี"]] as const;

const SHOTS: Choice[] = [
  { value: "AI เลือกให้", label: "AI เลือกให้", help: "ให้ AI เลือกระยะภาพให้เหมาะกับเหตุการณ์และอารมณ์ของฉาก" },
  { value: "Extreme Wide", label: "Extreme Wide — ภาพกว้างมาก", help: "เห็นสถานที่และสเกลเป็นหลัก เหมาะกับเปิดเรื่อง เมืองใหญ่ ภูเขา หรือฉากมหากาพย์" },
  { value: "Wide", label: "Wide — ภาพกว้าง", help: "เห็นตัวละครเต็มตัวพร้อมบริบทของสถานที่ เหมาะกับการเดิน วิ่ง และแอ็กชัน" },
  { value: "Full", label: "Full — เต็มตัว", help: "เห็นตัวละครเต็มตัวชัดเจน ใช้ดูท่าทาง เสื้อผ้า และการเคลื่อนไหว" },
  { value: "Medium", label: "Medium — ครึ่งตัว", help: "สมดุลระหว่างสีหน้าและท่าทาง เหมาะกับบทสนทนาและการเล่าเรื่องทั่วไป" },
  { value: "Close-up", label: "Close-up — ภาพใกล้", help: "เน้นใบหน้าและอารมณ์ เหมาะกับช่วงสำคัญหรือปฏิกิริยาของตัวละคร" },
  { value: "Extreme Close-up", label: "Extreme Close-up — ใกล้มาก", help: "เน้นรายละเอียด เช่น ดวงตา มือ ปาก หรือวัตถุสำคัญ" },
  { value: "POV", label: "POV — มุมสายตาตัวละคร", help: "กล้องแทนสายตาของตัวละคร ทำให้ผู้ชมรู้สึกอยู่ในเหตุการณ์" },
  { value: "OTS", label: "OTS — ข้ามไหล่", help: "มองข้ามไหล่ของตัวละคร เหมาะกับบทสนทนาและการเผชิญหน้า" },
  { value: "Insert Shot", label: "Insert Shot — ภาพแทรกรายละเอียด", help: "ตัดไปเห็นสิ่งของหรือรายละเอียดสำคัญ เช่น มือถือ จดหมาย กุญแจ" },
];

const ANGLES: Choice[] = [
  { value: "AI เลือกให้", label: "AI เลือกให้", help: "ให้ AI เลือกมุมกล้องตามอารมณ์และความหมายของฉาก" },
  { value: "Eye Level", label: "Eye Level — ระดับสายตา", help: "มุมธรรมชาติ เป็นกลาง เหมาะกับฉากทั่วไปและบทสนทนา" },
  { value: "Low Angle", label: "Low Angle — มุมเงย", help: "กล้องต่ำกว่าตัวละคร ทำให้ดูทรงพลัง เด่น หรือยิ่งใหญ่" },
  { value: "Extreme Low Angle", label: "Extreme Low — ต่ำติดพื้น", help: "สร้างสเกลและแรงปะทะ เหมาะกับ Action, Creature, รถ หรือ Mecha" },
  { value: "High Angle", label: "High Angle — มุมกด", help: "มองลงจากด้านบนเล็กน้อย ทำให้ตัวละครดูเล็ก อ่อนแอ หรือเห็นพื้นที่ชัด" },
  { value: "Top View", label: "Top View — มองตรงจากด้านบน", help: "เหมาะกับการจัดองค์ประกอบ การเคลื่อนที่หลายตัวละคร และภาพเชิงกราฟิก" },
  { value: "Side View", label: "Side View — ด้านข้าง", help: "เหมาะกับการเดิน วิ่ง ต่อสู้ หรือ Tracking ไปตามแนวข้าง" },
  { value: "Rear View", label: "Rear View — จากด้านหลัง", help: "ใช้ติดตามตัวละครเข้าสู่สถานที่ใหม่ หรือสร้างความรู้สึกร่วมเดินทาง" },
  { value: "Three-quarter", label: "Three-quarter — มุมสามส่วนสี่", help: "เห็นใบหน้าและมิติของร่างกายพร้อมกัน ดูเป็นภาพยนตร์และมีความลึก" },
];

const LENSES: Choice[] = [
  { value: "AI เลือกให้", label: "AI เลือกให้", help: "ให้ AI เลือกระยะเลนส์ตาม Shot และพื้นที่ของฉาก" },
  { value: "18mm", label: "18mm — กว้างมาก", help: "เก็บพื้นที่ได้มากและให้ความรู้สึกเว่อร์ เหมาะกับสถานที่ใหญ่หรือกล้องใกล้ตัวแบบดรามาติก" },
  { value: "24mm", label: "24mm — กว้างแบบภาพยนตร์", help: "เหมาะกับ Establishing, Action และช็อตที่ต้องเห็นตัวละครพร้อมสภาพแวดล้อม" },
  { value: "28mm", label: "28mm — กว้างธรรมชาติ", help: "ยังเห็นสภาพแวดล้อมชัด แต่บิดเบี้ยวน้อยกว่า 18–24mm" },
  { value: "35mm", label: "35mm — ธรรมชาติและมีบริบท", help: "เลนส์ใช้ง่ายมาก เหมาะกับฉากเดิน บทสนทนา และภาพยนตร์ทั่วไป" },
  { value: "50mm", label: "50mm — ใกล้สายตามนุษย์", help: "ให้สัดส่วนธรรมชาติ เหมาะกับ Medium Shot และบทสนทนา" },
  { value: "65mm", label: "65mm — เน้นตัวละคร", help: "แยกตัวละครจากฉากหลังมากขึ้น เหมาะกับอารมณ์และ Medium Close-up" },
  { value: "85mm", label: "85mm — Portrait / Close-up", help: "เหมาะกับใบหน้า ให้ฉากหลังละลายและอารมณ์เด่น" },
  { value: "100mm", label: "100mm — รายละเอียด / Tele", help: "บีบมิติและเน้นรายละเอียด เหมาะกับ Close-up หรือวัตถุสำคัญ" },
  { value: "Macro", label: "Macro — รายละเอียดเล็กมาก", help: "เหมาะกับดวงตา หยดน้ำ เครื่องจักร หรือรายละเอียดวัตถุระยะใกล้มาก" },
];

const MOVEMENTS: Choice[] = [
  { value: "AI เลือกให้", label: "AI เลือกให้", help: "ให้ AI เลือกการเคลื่อนกล้องตามจังหวะของฉาก" },
  { value: "Static", label: "Static — กล้องนิ่ง", help: "ภาพสงบ มั่นคง เหมาะกับบทสนทนา ภาพกดดัน หรือองค์ประกอบที่ต้องการความนิ่ง" },
  { value: "Push-in", label: "Push-in — เคลื่อนเข้า", help: "ค่อย ๆ เข้าใกล้ตัวละครเพื่อเน้นอารมณ์ ความคิด หรือการค้นพบ" },
  { value: "Pull-out", label: "Pull-out — ถอยออก", help: "ค่อย ๆ เผยสถานที่หรือทิ้งระยะ เหมาะกับตอนจบหรือ Reveal" },
  { value: "Dolly", label: "Dolly — เลื่อนกล้องนุ่ม", help: "เคลื่อนกล้องเป็นเส้นอย่างนุ่มนวล ให้ความรู้สึกภาพยนตร์" },
  { value: "Tracking", label: "Tracking — ติดตามตัวละคร", help: "กล้องเคลื่อนตามตัวละคร เหมาะกับเดิน วิ่ง ไล่ล่า และสำรวจสถานที่" },
  { value: "Pan", label: "Pan — หมุนซ้ายขวา", help: "กล้องอยู่จุดเดิมแต่หมุนตามเหตุการณ์หรือเผยสิ่งที่อยู่ด้านข้าง" },
  { value: "Tilt", label: "Tilt — ก้มเงยขึ้นลง", help: "กล้องอยู่จุดเดิมแต่ก้มหรือเงย เหมาะกับเผยความสูงหรือรายละเอียดตามแนวตั้ง" },
  { value: "Crane", label: "Crane — ยกกล้องขึ้นลง", help: "เคลื่อนกล้องในแนวดิ่งขนาดใหญ่ เหมาะกับเปิด/ปิดฉากและภาพสเกลใหญ่" },
  { value: "Orbit", label: "Orbit — วนรอบตัวละคร", help: "กล้องโคจรรอบตัวละคร เพิ่มพลัง ดราม่า และมิติ" },
  { value: "Whip Pan", label: "Whip Pan — ปัดกล้องเร็ว", help: "หมุนกล้องเร็วเพื่อเปลี่ยนจุดสนใจ เหมาะกับ Action และ Transition" },
  { value: "Lateral Slide", label: "Lateral Slide — เลื่อนด้านข้าง", help: "เลื่อนขนานด้านข้าง สร้าง Parallax และเปิดเผยฉากแบบนุ่ม" },
  { value: "Handheld", label: "Handheld — ถือกล้อง", help: "มีการสั่นอย่างควบคุม ให้ความรู้สึกสด ดิบ สมจริง หรือเร่งด่วน" },
];

const HEIGHTS: Choice[] = [
  { value: "AI เลือกให้", label: "AI เลือกให้", help: "ให้ AI เลือกระดับความสูงให้สัมพันธ์กับมุมและตัวละคร" },
  { value: "10 cm", label: "10 ซม. — ติดพื้น", help: "เหมาะกับสัตว์ตัวเล็ก ล้อรถ เท้า หรือ Extreme Low Angle" },
  { value: "Knee", label: "ระดับเข่า", help: "ให้มุมต่ำแต่ยังเห็นการเคลื่อนไหวชัด เหมาะกับ Action และ Tracking" },
  { value: "Waist", label: "ระดับเอว", help: "มุมต่ำเล็กน้อย ใช้ติดตามตัวละครและให้ความรู้สึกมีพลัง" },
  { value: "Chest", label: "ระดับอก", help: "เป็นระดับใช้งานง่ายสำหรับ Medium Shot และบทสนทนา" },
  { value: "Eye", label: "ระดับสายตา", help: "ธรรมชาติและเป็นกลางที่สุด" },
  { value: "Above Head", label: "เหนือศีรษะ", help: "มองลงเล็กน้อย เหมาะกับเห็นพื้นที่และตำแหน่งตัวละคร" },
];

const LIGHTS: Choice[] = [
  { value: "AI เลือกให้", label: "AI เลือกให้", help: "ให้ AI จัดแสงตามเวลา สถานที่ Mood และ Style" },
  { value: "Natural Soft", label: "Natural Soft — แสงธรรมชาตินุ่ม", help: "ดูเป็นธรรมชาติ เหมาะกับชีวิตประจำวัน บทสนทนา และงานสมจริง" },
  { value: "Golden Hour", label: "Golden Hour — แสงทอง", help: "อบอุ่น โรแมนติก และมี Rim Light เหมาะกับช่วงเย็นหรือความทรงจำ" },
  { value: "Blue Hour", label: "Blue Hour — ฟ้าหลังอาทิตย์ตก", help: "โทนเย็น สงบ ลึกลับ เหมาะกับเมืองยามค่ำและอารมณ์เหงา" },
  { value: "Low Key", label: "Low Key — แสงน้อยเงาจัด", help: "เหมาะกับ Thriller, Horror, Noir และฉากตึงเครียด" },
  { value: "High Key", label: "High Key — สว่างนุ่ม", help: "ภาพสว่างสะอาด เหมาะกับโฆษณา ความสุข และงาน Beauty" },
  { value: "Neon", label: "Neon — แสงนีออน", help: "เหมาะกับ Cyberpunk, Sci-Fi และเมืองกลางคืน" },
  { value: "Volumetric", label: "Volumetric — ลำแสง/หมอก", help: "เห็นลำแสงในอากาศ เพิ่มมิติและบรรยากาศแฟนตาซีหรือมหากาพย์" },
  { value: "Backlight", label: "Backlight — ย้อนแสง", help: "แสงมาจากด้านหลังตัวละคร สร้างขอบแสงและ Silhouette" },
  { value: "Overcast", label: "Overcast — ฟ้าครึ้ม", help: "แสงกระจาย ไม่มีเงาแข็ง เหมาะกับดราม่า เมืองฝนตก และงานสมจริง" },
];

const FOCUS: Choice[] = [
  { value: "Auto Subject", label: "Auto Subject — โฟกัสตัวแบบ", help: "ยึดตัวละครหลักเป็นจุดโฟกัสตลอดช็อต" },
  { value: "Rack Focus", label: "Rack Focus — ย้ายโฟกัส", help: "สลับโฟกัสจากวัตถุหนึ่งไปอีกวัตถุหนึ่งเพื่อเปลี่ยนจุดสนใจ" },
  { value: "Deep Focus", label: "Deep Focus — ชัดลึก", help: "ให้ทั้งหน้าและหลังค่อนข้างชัด เหมาะกับฉากที่มีข้อมูลหลายระยะ" },
];
const DOF: Choice[] = [
  { value: "Natural", label: "Natural — ธรรมชาติ", help: "ความชัดตื้นปานกลาง สมดุลและใช้ง่าย" },
  { value: "Shallow", label: "Shallow — ฉากหลังละลาย", help: "แยกตัวละครชัด เหมาะกับ Close-up และอารมณ์" },
  { value: "Deep", label: "Deep — ชัดลึก", help: "เห็นรายละเอียดฉากหลัง เหมาะกับ Environment และ Blocking" },
];
const COMPOSITIONS: Choice[] = [
  { value: "Rule of Thirds", label: "Rule of Thirds — กฎสามส่วน", help: "วางตัวละครตามจุดตัด ช่วยให้ภาพสมดุลและเป็นธรรมชาติ" },
  { value: "Centered", label: "Centered — กึ่งกลาง", help: "ให้ความรู้สึกมั่นคง สมมาตร หรือกดดัน" },
  { value: "Leading Lines", label: "Leading Lines — เส้นนำสายตา", help: "ใช้ถนน ราว หรือสถาปัตยกรรมพาสายตาไปยังตัวละคร" },
  { value: "Negative Space", label: "Negative Space — พื้นที่ว่าง", help: "เว้นพื้นที่รอบตัวละครเพื่อสร้างความโดดเดี่ยว ความลึกลับ หรือที่ว่างสำหรับการเคลื่อน" },
];

const newCharacter = (index: number): Character => ({ id: `c${Date.now()}${index}`, name: `ตัวละคร ${index}`, gender: index % 2 ? "หญิง" : "ชาย", age: 24, nationality: "ไทย", personality: "กำหนดบุคลิกของตัวละคร", voice: index % 2 ? "Mira" : "Arin", hair: "", eyes: "", mouth: "", body: "" });
const newScene = (index: number, cast: string[], duration = 6): Scene => ({ id: `s${Date.now()}${index}`, title: `ฉาก ${index}`, duration, story: index === 1 ? "เปิดเรื่องและแนะนำบรรยากาศ" : "อธิบายสิ่งที่เกิดขึ้นในฉากนี้", cast, location: "", shot: "AI เลือกให้", angle: "AI เลือกให้", lens: "AI เลือกให้", movement: "AI เลือกให้", height: "AI เลือกให้", lighting: "AI เลือกให้", focus: "Auto Subject", dof: "Natural", composition: "Rule of Thirds", emotion: "เป็นธรรมชาติ", dialogue: "", sound: "" });

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}
function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return <div className={styles.stepHead}><b>{n}</b><div><strong>{title}</strong><span>{desc}</span></div></div>;
}
function CameraChoice({ label, value, options, onChange }: { label: string; value: string; options: Choice[]; onChange: (value: string) => void }) {
  const selected = options.find((item) => item.value === value) ?? options[0];
  return <Field label={label} hint={selected.help}><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field>;
}

export default function ScenovaStudio() {
  const [mode, setMode] = useState<Mode>("auto");
  const [model, setModel] = useState("Seedance 2.5");
  const [duration, setDuration] = useState(30);
  const [aspect, setAspect] = useState("9:16");
  const [style, setStyle] = useState("Cinematic Anime");
  const [story, setStory] = useState("เด็กหญิงพบสิ่งมีชีวิตลึกลับระหว่างทางกลับบ้าน และค่อย ๆ กลายเป็นเพื่อนกัน");
  const [characters, setCharacters] = useState<Character[]>([newCharacter(1), newCharacter(2)]);
  const [pet, setPet] = useState(true);
  const [petText, setPetText] = useState("แมวสีขาวตัวเล็ก");
  const [scenes, setScenes] = useState<Scene[]>(() => [newScene(1, [], 6), newScene(2, [], 6), newScene(3, [], 6)]);
  const [selectedId, setSelectedId] = useState("");
  const [ep, setEp] = useState(1);
  const [continuity, setContinuity] = useState("ต่อเนื่องจากตอนก่อนหน้า");
  const [status, setStatus] = useState("พร้อมออกแบบ");
  const [prompt, setPrompt] = useState("");

  const selected = scenes.find((scene) => scene.id === selectedId) ?? scenes[0];
  const modeInfo = MODES.find((item) => item.id === mode) ?? MODES[0];
  const usedSeconds = useMemo(() => scenes.reduce((sum, scene) => sum + Number(scene.duration || 0), 0), [scenes]);
  const remainingSeconds = Math.max(0, duration - usedSeconds);
  const selectedMax = selected ? selected.duration + remainingSeconds : duration;

  function setCharacterCount(count: number) {
    setCharacters((current) => count <= current.length ? current.slice(0, count) : [...current, ...Array.from({ length: count - current.length }, (_, index) => newCharacter(current.length + index + 1))]);
  }
  function patchCharacter(id: string, patch: Partial<Character>) { setCharacters((current) => current.map((character) => character.id === id ? { ...character, ...patch } : character)); }
  function patchScene(id: string, patch: Partial<Scene>) { setScenes((current) => current.map((scene) => scene.id === id ? { ...scene, ...patch } : scene)); }

  function fitToTarget(input: Scene[], target: number) {
    if (!input.length) return input;
    if (input.length > target) input = input.slice(0, target);
    const total = input.reduce((sum, scene) => sum + scene.duration, 0);
    if (total <= target) return input;
    const base = Math.floor(target / input.length);
    let rest = target - base * input.length;
    return input.map((scene) => ({ ...scene, duration: Math.max(1, base + (rest-- > 0 ? 1 : 0)) }));
  }

  function changeTargetDuration(next: number) {
    setDuration(next);
    setScenes((current) => fitToTarget([...current], next));
    setStatus(`ตั้งเวลารวม ${next} วินาทีแล้ว ระบบจะไม่ให้เวลาฉากรวมเกินค่านี้`);
  }
  function setSceneCount(count: number) {
    if (count > duration) return setStatus("จำนวนฉากมากกว่าเวลารวมไม่ได้ เพราะแต่ละฉากต้องมีอย่างน้อย 1 วินาที");
    setScenes((current) => {
      const next = count <= current.length ? current.slice(0, Math.max(1, count)) : [...current, ...Array.from({ length: count - current.length }, (_, index) => newScene(current.length + index + 1, characters.slice(0, 1).map((character) => character.id), 1))];
      return fitToTarget(next, duration);
    });
  }
  function addScene() {
    if (scenes.length >= 12) return setStatus("กำหนดสูงสุด 12 ฉากต่อรอบในหน้า Creator นี้");
    if (remainingSeconds < 1) return setStatus("เวลารวมถูกใช้ครบแล้ว กรุณาลดเวลาฉากเดิมหรือเพิ่มเวลารวมก่อนเพิ่มฉาก");
    const scene = newScene(scenes.length + 1, characters.slice(0, 1).map((character) => character.id), Math.min(6, remainingSeconds));
    setScenes((current) => [...current, scene]);
    setSelectedId(scene.id);
  }
  function removeScene(id: string) {
    if (scenes.length <= 1) return;
    const next = scenes.filter((scene) => scene.id !== id);
    setScenes(next);
    setSelectedId(next[0]?.id || "");
  }
  function setSceneDuration(value: number) {
    if (!selected) return;
    const otherSeconds = usedSeconds - selected.duration;
    const safeValue = Math.max(1, Math.min(value, duration - otherSeconds));
    patchScene(selected.id, { duration: safeValue });
  }
  function toggleCast(id: string) {
    if (!selected) return;
    patchScene(selected.id, { cast: selected.cast.includes(id) ? selected.cast.filter((item) => item !== id) : [...selected.cast, id] });
  }
  function playVoice(character: Character) {
    if (!("speechSynthesis" in window)) return setStatus("เบราว์เซอร์นี้ยังเล่นเสียงตัวอย่างไม่ได้");
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(character.gender === "ชาย" ? "สวัสดีครับ นี่คือตัวอย่างเสียงตัวละครจาก SCENOVA" : "สวัสดีค่ะ นี่คือตัวอย่างเสียงตัวละครจาก SCENOVA");
    utterance.lang = "th-TH";
    utterance.rate = character.voice === "Nami" ? 1.08 : .98;
    utterance.pitch = ["Arin", "Keen"].includes(character.voice) ? .82 : 1.05;
    speechSynthesis.speak(utterance);
    setStatus(`กำลังเล่นเสียง ${character.voice}`);
  }
  function aiFill() {
    setScenes((current) => current.map((scene, index) => ({ ...scene, story: scene.story || `AI วางเหตุการณ์ฉาก ${index + 1}`, shot: scene.shot === "AI เลือกให้" ? (index % 3 === 0 ? "Wide" : index % 3 === 1 ? "Medium" : "Close-up") : scene.shot, angle: scene.angle === "AI เลือกให้" ? "Eye Level" : scene.angle, lens: scene.lens === "AI เลือกให้" ? (index % 2 ? "65mm" : "35mm") : scene.lens, movement: scene.movement === "AI เลือกให้" ? (index % 2 ? "Push-in" : "Tracking") : scene.movement, height: scene.height === "AI เลือกให้" ? "Chest" : scene.height, lighting: scene.lighting === "AI เลือกให้" ? "Natural Soft" : scene.lighting })));
    setStatus("AI เติมแนวทางให้แล้ว ทุกช่องยังแก้เองได้");
  }
  function buildPrompt() {
    const cast = characters.map((character) => `${character.name}: ${character.gender}, ${character.age} ปี, ${character.nationality}, ${character.personality}, voice ${character.voice}, hair ${character.hair || "locked from reference"}, eyes ${character.eyes || "locked from reference"}, mouth ${character.mouth || "locked from reference"}, body ${character.body || "locked from reference"}`).join("\n");
    const sceneText = scenes.map((scene, index) => `SCENE ${index + 1} | ${scene.duration}s\n${scene.story}\nLocation: ${scene.location || "AI choose"}\nCamera: ${scene.shot}, ${scene.angle}, ${scene.lens}, ${scene.movement}, height ${scene.height}\nFocus: ${scene.focus}; DOF: ${scene.dof}; Composition: ${scene.composition}\nLighting: ${scene.lighting}\nEmotion: ${scene.emotion}\nDialogue: ${scene.dialogue || "No dialogue"}\nSound: ${scene.sound || "Natural ambience"}`).join("\n\n");
    setPrompt(`SCENOVA PRODUCTION PROMPT\nMODE: ${modeInfo.name}\nMODEL: ${model}\nFORMAT: ${aspect}\nTARGET DURATION: ${duration}s\nUSED SCENE TIME: ${usedSeconds}s\nSTYLE: ${style}${mode === "episode" ? `\nEP: ${ep}\nCONTINUITY: ${continuity}` : ""}\n\nSTORY\n${story}\n\nCHARACTERS\n${cast}${pet ? `\nPET/CREATURE: ${petText}` : ""}\n\n${sceneText}\n\nCONSISTENCY: keep identity, age, face, hair, body, voice, costume and visual style locked across every scene.`);
    setStatus("สร้าง Prompt Preview แล้ว");
  }

  return (
    <main className={styles.main}>
      <section className={styles.titleRow}>
        <div><span>SCENOVA CREATOR</span><h1>สร้างหนังด้วยขั้นตอนเดียวกันทุกโหมด</h1><p>เลือกโหมด แล้วทำงานตามลำดับเดิมเสมอ: ตั้งค่างาน → ตัวละคร → ฉากและกล้อง → ตรวจและสร้าง ไม่ต้องสลับหลายหน้า</p></div>
        <div className={styles.actionRow}><span className={styles.status}>{status}</span><button className={styles.secondary} onClick={buildPrompt}>✦ สร้าง Prompt</button><button className={styles.primary} onClick={() => setStatus("วางแผนสร้างคลิปแล้ว — Mock Provider ยังไม่หักเครดิต")}>▶ สร้างคลิปเลย</button></div>
      </section>

      <section className={styles.modeGrid}>{MODES.map((item) => <button key={item.id} onClick={() => setMode(item.id)} className={mode === item.id ? styles.modeActive : ""}><i>{item.icon}</i><div><strong>{item.name}</strong><p>{item.note}</p><span>{item.tag}</span></div></button>)}</section>

      <section id="setup" className={styles.card}>
        <Step n={1} title="ตั้งค่างาน" desc="เลือกโมเดล เวลารวม จำนวนฉาก ตัวละคร อัตราส่วนภาพ และสไตล์" />
        <div className={styles.sixGrid}>
          <Field label="โมเดล" hint="ดูรายละเอียดและเรทราคาได้จากเมนู โมเดล & ราคา"><select value={model} onChange={(event) => setModel(event.target.value)}>{MODELS.map((item) => <option key={item}>{item}</option>)}</select><Link href="/models">ดูโมเดล & ราคา →</Link></Field>
          <Field label="เวลารวมของคลิป" hint="เวลาของทุกฉากรวมกันจะไม่เกินค่านี้"><select value={duration} onChange={(event) => changeTargetDuration(Number(event.target.value))}>{[10, 15, 30, 60, 90, 120, 150, 180].map((item) => <option value={item} key={item}>{item < 60 ? `${item} วินาที` : `${item / 60} นาที`}</option>)}</select></Field>
          <Field label="จำนวนฉาก" hint="เพิ่ม/ลบทีหลังได้ สูงสุด 12 ฉาก"><select value={scenes.length} onChange={(event) => setSceneCount(Number(event.target.value))}>{Array.from({ length: Math.min(12, duration) }, (_, index) => index + 1).map((item) => <option key={item} value={item}>{item} ฉาก</option>)}</select></Field>
          <Field label="จำนวนตัวละครหลัก"><select value={characters.length} onChange={(event) => setCharacterCount(Number(event.target.value))}>{Array.from({ length: 8 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>{item} คน</option>)}</select></Field>
          <Field label="อัตราส่วนภาพ"><select value={aspect} onChange={(event) => setAspect(event.target.value)}><option>9:16</option><option>16:9</option><option>1:1</option><option>4:5</option></select></Field>
          <Field label="สไตล์ภาพ"><select value={style} onChange={(event) => setStyle(event.target.value)}>{STYLES.map((item) => <option key={item}>{item}</option>)}</select><Link href="/libraries">เปิดคลังทั้งหมด →</Link></Field>
        </div>
        {mode === "episode" ? <div className={styles.twoGrid}><Field label="ตอนที่ (EP)"><input type="number" min={1} value={ep} onChange={(event) => setEp(Number(event.target.value))} /></Field><Field label="ความต่อเนื่อง"><select value={continuity} onChange={(event) => setContinuity(event.target.value)}><option>ต่อเนื่องจากตอนก่อนหน้า</option><option>ข้ามเวลา</option><option>วันถัดไป</option><option>สถานที่ใหม่</option><option>Flashback</option><option>Flash Forward</option></select></Field></div> : null}
        <Field label="เรื่อง / ไอเดียหลัก" hint={mode === "auto" ? "เขียนสั้น ๆ ได้ AI จะช่วยแตกเป็นฉาก" : "เป็นแกนเรื่องหลัก ส่วนรายละเอียดแก้แยกในแต่ละฉาก"}><textarea className={styles.story} value={story} onChange={(event) => setStory(event.target.value)} /></Field>
      </section>

      <section id="characters" className={styles.card}>
        <Step n={2} title="ตัวละครและเสียง" desc="เลือกจากคลังหรือสร้างเอง ถ้าไม่มีต้นฉบับสามารถระบุใบหน้า อายุ สัญชาติ และรูปร่างได้" />
        <div className={styles.quickLinks}><Link href="/libraries">▦ เปิดคลังทั้งหมด</Link><Link href="/libraries#characters">＋ เลือกตัวละครจากคลัง</Link><Link href="/libraries#voices">♫ เลือกเสียงจากคลัง</Link></div>
        <div className={styles.characterGrid}>{characters.map((character, index) => <article className={styles.characterCard} key={character.id}><header><b>{index + 1}</b><strong>{character.name}</strong><label>↑ อัปโหลดรูป<input hidden type="file" accept="image/*" onChange={(event) => patchCharacter(character.id, { reference: event.target.files?.[0]?.name || "" })} /></label></header>{character.reference ? <span className={styles.fileTag}>Reference: {character.reference}</span> : null}<div className={styles.twoGrid}><Field label="ชื่อ"><input value={character.name} onChange={(event) => patchCharacter(character.id, { name: event.target.value })} /></Field><Field label="เพศ"><select value={character.gender} onChange={(event) => patchCharacter(character.id, { gender: event.target.value as Gender })}><option>หญิง</option><option>ชาย</option><option>ไม่ระบุ</option></select></Field><Field label="อายุ"><input type="number" min={1} max={120} value={character.age} onChange={(event) => patchCharacter(character.id, { age: Number(event.target.value) })} /></Field><Field label="สัญชาติ"><input value={character.nationality} onChange={(event) => patchCharacter(character.id, { nationality: event.target.value })} /></Field></div><Field label="คาแรกเตอร์ / บุคลิก"><input value={character.personality} onChange={(event) => patchCharacter(character.id, { personality: event.target.value })} /></Field><Field label="เสียง" hint="กดฟังตัวอย่างได้ก่อนเลือก"><div className={styles.voice}><select value={character.voice} onChange={(event) => patchCharacter(character.id, { voice: event.target.value })}>{VOICES.map(([name, desc]) => <option value={name} key={name}>{name} — {desc}</option>)}</select><button onClick={() => playVoice(character)}>▶ ฟัง</button></div></Field><details><summary>＋ รายละเอียดเพิ่ม กรณีไม่มีตัวต้นฉบับ</summary><div className={styles.twoGrid}><Field label="ผม"><input value={character.hair} onChange={(event) => patchCharacter(character.id, { hair: event.target.value })} /></Field><Field label="ดวงตา"><input value={character.eyes} onChange={(event) => patchCharacter(character.id, { eyes: event.target.value })} /></Field><Field label="ปาก"><input value={character.mouth} onChange={(event) => patchCharacter(character.id, { mouth: event.target.value })} /></Field><Field label="รูปร่าง / ส่วนสูง"><input value={character.body} onChange={(event) => patchCharacter(character.id, { body: event.target.value })} /></Field></div></details></article>)}</div>
        <div className={styles.petRow}><Field label="มีสัตว์เลี้ยง / Creature"><select value={pet ? "yes" : "no"} onChange={(event) => setPet(event.target.value === "yes")}><option value="no">ไม่มี</option><option value="yes">มี</option></select></Field>{pet ? <Field label="รายละเอียดสัตว์ / Creature"><input value={petText} onChange={(event) => setPetText(event.target.value)} /></Field> : null}</div>
      </section>

      <section id="scenes" className={styles.card}>
        <Step n={3} title="แบ่งฉากและตั้งกล้อง" desc="แต่ละฉากมีเวลาของตัวเอง ปรับด้วย Slider และเลือก Shot / Angle / Lens / Movement ได้ครบพร้อมคำอธิบายภาษาไทย" />
        <div className={styles.timeBudget}><div><b>เวลาใช้ไป {usedSeconds} / {duration} วินาที</b><span>เหลือ {remainingSeconds} วินาที</span></div><div className={styles.timeline}>{scenes.map((scene, index) => <button key={scene.id} onClick={() => setSelectedId(scene.id)} className={selected?.id === scene.id ? styles.timelineActive : ""} style={{ flexGrow: Math.max(1, scene.duration) }}><b>{index + 1}</b><span>{scene.duration}s</span></button>)}</div></div>
        <div className={styles.sceneTools}><span>รวม {scenes.length} ฉาก • เวลารวมจะไม่เกิน {duration} วินาที</span><div><button onClick={aiFill}>✦ AI ช่วยเติม</button><button onClick={addScene}>＋ เพิ่มฉาก</button></div></div>
        <div className={styles.sceneWorkspace}>
          <aside>{scenes.map((scene, index) => <button key={scene.id} onClick={() => setSelectedId(scene.id)} className={selected?.id === scene.id ? styles.sceneActive : ""}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{scene.title}</strong><small>{scene.duration}s • {scene.shot}</small></span></button>)}</aside>
          {selected ? <div className={styles.sceneEditor}>
            <div className={styles.sceneTitle}><input value={selected.title} onChange={(event) => patchScene(selected.id, { title: event.target.value })} /><button onClick={() => removeScene(selected.id)}>ลบฉาก</button></div>
            <div className={styles.durationBox}><div><b>เวลาของฉากนี้</b><span>{selected.duration} วินาที</span></div><input type="range" min={1} max={Math.max(1, selectedMax)} value={selected.duration} onChange={(event) => setSceneDuration(Number(event.target.value))} /><small>เลื่อนได้ตั้งแต่ 1–{selectedMax} วินาที โดยระบบจะล็อกไม่ให้เวลารวมเกิน {duration} วินาที</small></div>
            <div className={styles.twoGrid}><Field label="สถานที่"><input value={selected.location} onChange={(event) => patchScene(selected.id, { location: event.target.value })} placeholder="เช่น ตรอกญี่ปุ่นช่วงเย็น" /></Field><Field label="อารมณ์ของฉาก"><input value={selected.emotion} onChange={(event) => patchScene(selected.id, { emotion: event.target.value })} /></Field></div>
            <Field label="เกิดอะไรขึ้นในฉากนี้"><textarea value={selected.story} onChange={(event) => patchScene(selected.id, { story: event.target.value })} /></Field>
            <div className={styles.castChoice}><span>ตัวละครในฉาก</span>{characters.map((character) => <button key={character.id} onClick={() => toggleCast(character.id)} className={selected.cast.includes(character.id) ? styles.castActive : ""}>{character.name}</button>)}</div>
            <div className={styles.cameraGrid}>
              <CameraChoice label="Shot Type — ระยะภาพ" value={selected.shot} options={SHOTS} onChange={(value) => patchScene(selected.id, { shot: value })} />
              <CameraChoice label="Camera Angle — มุมกล้อง" value={selected.angle} options={ANGLES} onChange={(value) => patchScene(selected.id, { angle: value })} />
              <CameraChoice label="Lens — ระยะเลนส์" value={selected.lens} options={LENSES} onChange={(value) => patchScene(selected.id, { lens: value })} />
              <CameraChoice label="Movement — การเคลื่อนกล้อง" value={selected.movement} options={MOVEMENTS} onChange={(value) => patchScene(selected.id, { movement: value })} />
              <CameraChoice label="Camera Height — ความสูงกล้อง" value={selected.height} options={HEIGHTS} onChange={(value) => patchScene(selected.id, { height: value })} />
              <CameraChoice label="Lighting — แสง" value={selected.lighting} options={LIGHTS} onChange={(value) => patchScene(selected.id, { lighting: value })} />
            </div>
            <details className={styles.advanced} open={mode === "pro"}><summary>◆ การตั้งค่ากล้องเพิ่มเติม {mode === "pro" ? "— เปิดอัตโนมัติใน Director Pro" : ""}</summary><div className={styles.cameraGrid}><CameraChoice label="Focus — จุดโฟกัส" value={selected.focus} options={FOCUS} onChange={(value) => patchScene(selected.id, { focus: value })} /><CameraChoice label="Depth of Field — ความชัดตื้น/ชัดลึก" value={selected.dof} options={DOF} onChange={(value) => patchScene(selected.id, { dof: value })} /><CameraChoice label="Composition — การจัดองค์ประกอบ" value={selected.composition} options={COMPOSITIONS} onChange={(value) => patchScene(selected.id, { composition: value })} /></div></details>
            <div id="sound" className={styles.twoGrid}><Field label="บทพูด"><textarea value={selected.dialogue} onChange={(event) => patchScene(selected.id, { dialogue: event.target.value })} placeholder="ชื่อตัวละคร: บทพูด" /></Field><Field label="เสียง / SFX / บรรยากาศ"><textarea value={selected.sound} onChange={(event) => patchScene(selected.id, { sound: event.target.value })} placeholder="เช่น ฝนเบา ๆ, เมืองไกล ๆ, กระดิ่ง" /></Field></div>
          </div> : null}
        </div>
      </section>

      <section id="review" className={styles.card}>
        <Step n={4} title="ตรวจแล้วสร้าง" desc="ตรวจเวลารวม โมเดล ตัวละคร และฉากก่อนส่งให้ AI Prompt Director หรือ Video Provider" />
        <div className={styles.reviewGrid}><div><b>โหมด</b><span>{modeInfo.name}</span></div><div><b>โมเดล</b><span>{model}</span></div><div><b>เวลารวมเป้าหมาย</b><span>{duration}s</span></div><div><b>เวลาฉากที่ใช้</b><span>{usedSeconds}s</span></div><div><b>จำนวนฉาก</b><span>{scenes.length}</span></div><div><b>ตัวละคร</b><span>{characters.length}</span></div></div>
        <div className={styles.finalActions}><Link className={styles.libraryButton} href="/libraries">▦ เปิดคลังทั้งหมด</Link><button className={styles.secondary} onClick={buildPrompt}>✦ สร้าง Prompt</button><button className={styles.primary} onClick={() => setStatus("พร้อมส่ง Render Queue เมื่อเชื่อม Video API จริง")}>▶ สร้างคลิปเลย</button></div>
      </section>

      {prompt ? <section className={styles.prompt}><header><strong>Production Prompt Preview</strong><button onClick={() => navigator.clipboard?.writeText(prompt)}>คัดลอก</button></header><pre>{prompt}</pre></section> : null}
    </main>
  );
}
