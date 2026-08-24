"use client";

import { useMemo, useState } from "react";
import { CAMERA_HELP, LENS_HELP } from "@/lib/catalogs";

export default function CameraLab() {
  const [shotType, setShotType] = useState("Wide Shot");
  const [angle, setAngle] = useState("Low Angle");
  const [lens, setLens] = useState(28);
  const [height, setHeight] = useState("20 ซม. จากพื้น");
  const [movement, setMovement] = useState("Tracking");
  const [speed, setSpeed] = useState("slow smooth");
  const [focus, setFocus] = useState("ตัวละครหลักและเส้นนำสายตา");
  const [dof, setDof] = useState("Medium depth");
  const [composition, setComposition] = useState("Centered subject, strong leading lines, cinematic negative space");
  const [occlusion, setOcclusion] = useState("ใบไม้หรือขอบกำแพงบังเฟรมประมาณ 1/3 แบบเบลอ");
  const [subjectPosition, setSubjectPosition] = useState("กลางเฟรม");
  const [cameraLanguage, setCameraLanguage] = useState("physically believable, restrained, observational cinematic storytelling");

  const snippet = useMemo(() => `Camera: ${shotType}\nAngle: ${angle}\nLens: ${lens}mm\nCamera height: ${height}\nMovement: ${movement} (${speed})\nFocus: ${focus}\nDepth of field: ${dof}\nSubject position: ${subjectPosition}\nComposition: ${composition}\nForeground occlusion: ${occlusion}\nCamera language: ${cameraLanguage}`, [shotType, angle, lens, height, movement, speed, focus, dof, subjectPosition, composition, occlusion, cameraLanguage]);

  const shotHelp = CAMERA_HELP.shotTypes.find((item) => item[0] === shotType);
  const angleHelp = CAMERA_HELP.angles.find((item) => item[0] === angle);
  const moveHelp = CAMERA_HELP.movements.find((item) => item[0] === movement);
  const lensHelp = LENS_HELP.find((item) => item[0] === lens);

  return (
    <div className="content" style={{ maxWidth: 1300 }}>
      <div className="page-head">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><h1>Camera Lab — ออกแบบกล้องระดับ Production</h1><p>ทุกค่ามีคำอธิบายภาษาไทย และสามารถใช้ Preset หรือ Custom เองได้ ระบบจะเก็บเป็น Structured Data เพื่อใช้ซ้ำใน Timeline และประกอบ Prompt โดยไม่ต้องพิมพ์ศัพท์กล้องเอง</p></div>
          <a href="/" className="btn">← กลับ Studio</a>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title"><div><h2>ระยะภาพและมุมกล้อง</h2><p>กำหนดว่าผู้ชมเห็นตัวละครใกล้/ไกลแค่ไหน และกล้องมองจากทิศทางใด</p></div></div>
          <div className="grid-2">
            <div><label className="label">ประเภทภาพ (Shot Type)</label><select className="select" value={shotType} onChange={(e) => setShotType(e.target.value)}>{CAMERA_HELP.shotTypes.map(([en, th]) => <option value={en} key={en}>{th} ({en})</option>)}</select><div className="help">ⓘ {shotHelp?.[2]}</div></div>
            <div><label className="label">มุมกล้อง (Camera Angle)</label><select className="select" value={angle} onChange={(e) => setAngle(e.target.value)}>{CAMERA_HELP.angles.map(([en, th]) => <option value={en} key={en}>{th} ({en})</option>)}</select><div className="help">ⓘ {angleHelp?.[2]}</div></div>
            <div><label className="label">เลนส์ (Lens)</label><select className="select" value={lens} onChange={(e) => setLens(Number(e.target.value))}>{LENS_HELP.map(([mm, title]) => <option key={mm} value={mm}>{mm}mm — {title}</option>)}</select><div className="help">ⓘ {lensHelp?.[2]}</div></div>
            <div><label className="label">ความสูงกล้อง (Camera Height)</label><input className="input" value={height} onChange={(e) => setHeight(e.target.value)} /><div className="help">ⓘ ใส่เป็นเซนติเมตรหรือคำอธิบายได้ เช่น 10 ซม. จากพื้น, ระดับเข่า, ระดับเอว, ระดับสายตา</div></div>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><div><h2>การเคลื่อนกล้องและ Focus</h2><p>ควบคุมวิธีเคลื่อนกล้อง ความเร็ว และสิ่งที่ต้องเป็นจุดสนใจ</p></div></div>
          <div className="grid-2">
            <div><label className="label">Camera Movement</label><select className="select" value={movement} onChange={(e) => setMovement(e.target.value)}>{CAMERA_HELP.movements.map(([en, th]) => <option value={en} key={en}>{th} ({en})</option>)}</select><div className="help">ⓘ {moveHelp?.[2]}</div></div>
            <div><label className="label">ความเร็วการเคลื่อน</label><input className="input" value={speed} onChange={(e) => setSpeed(e.target.value)} /><div className="help">ⓘ ตัวอย่าง: extremely slow, slow smooth, moderate, quick but controlled</div></div>
            <div><label className="label">จุดโฟกัส (Focus)</label><input className="input" value={focus} onChange={(e) => setFocus(e.target.value)} /><div className="help">ⓘ ระบุว่าอะไรต้องชัด เช่น ดวงตา, กระดิ่ง, ตัวละครเต็มตัว หรือวัตถุฉากหน้า</div></div>
            <div><label className="label">ระยะชัดลึก (Depth of Field)</label><input className="input" value={dof} onChange={(e) => setDof(e.target.value)} /><div className="help">ⓘ Shallow = ฉากหลังเบลอมาก, Deep = สิ่งแวดล้อมชัด เหมาะกับ Establishing Shot</div></div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="card">
          <div className="card-title"><div><h2>องค์ประกอบภาพ (Composition)</h2><p>บอก AI ว่าควรวางตัวละครและสิ่งแวดล้อมในเฟรมอย่างไร ไม่ใช่แค่เลือกเลนส์</p></div></div>
          <label className="label">ตำแหน่งตัวละคร (Subject Position)</label><input className="input" value={subjectPosition} onChange={(e) => setSubjectPosition(e.target.value)} /><div className="help">ⓘ เช่น กลางเฟรม, ซ้าย 1/3, ขวา 1/3, ต่ำกลางเฟรม</div>
          <div style={{ height: 10 }} />
          <label className="label">Composition / Leading Lines / Negative Space</label><textarea className="textarea" value={composition} onChange={(e) => setComposition(e.target.value)} /><div className="help">ⓘ Leading Lines คือเส้นถนน/กำแพงที่นำสายตา ส่วน Negative Space คือพื้นที่ว่างที่ใช้สร้างอารมณ์หรือสเกล</div>
          <div style={{ height: 10 }} />
          <label className="label">Foreground Occlusion — วัตถุฉากหน้าบังบางส่วน</label><textarea className="textarea" value={occlusion} onChange={(e) => setOcclusion(e.target.value)} /><div className="help">ⓘ ใช้ใบไม้ เสา ประตู หรือกำแพงบังตัวละครบางส่วนเพื่อสร้างมิติ ความลับ หรือความรู้สึกแอบสังเกต</div>
        </div>

        <div className="card">
          <div className="card-title"><div><h2>Camera Language Lock</h2><p>กำหนดบุคลิกกล้องของทั้ง Sequence เช่น “กล้องต่ำ สงบ ช้า และสังเกตการณ์” เพื่อให้หลาย Shot รู้สึกเป็นหนังเรื่องเดียวกัน</p></div></div>
          <textarea className="textarea" value={cameraLanguage} onChange={(e) => setCameraLanguage(e.target.value)} />
          <div className="help">ⓘ สามารถล็อกระดับ Project หรือ EP แล้ว Override เฉพาะ Shot ที่ต้องการได้</div>
          <div style={{ height: 14 }} />
          <label className="label">Prompt Snippet ที่ระบบประกอบ</label>
          <div className="prompt-box" style={{ maxHeight: 330 }}>{snippet}</div>
        </div>
      </div>
    </div>
  );
}
