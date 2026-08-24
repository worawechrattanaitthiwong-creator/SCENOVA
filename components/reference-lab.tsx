"use client";

import { useState } from "react";
import { MockReferenceVideoAnalyzer, type ReferenceVideoAnalysis } from "@/lib/reference-video-analyzer";

export default function ReferenceLab() {
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<ReferenceVideoAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    const analyzer = new MockReferenceVideoAnalyzer();
    const result = await analyzer.analyze({ assetUrl: "mock://local-reference", fileName });
    setAnalysis(result);
    setLoading(false);
  };

  return (
    <div className="content" style={{ maxWidth: 1250 }}>
      <div className="page-head">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><h1>Reference Lab — ออกแบบจากวิดีโอตัวอย่าง</h1><p>อัปโหลดวิดีโออ้างอิงเพื่อให้ระบบวิเคราะห์ Style, Mood, Color, Lighting, Camera Language, Shot Pattern และ Motion แล้วแปลงเป็น Style/Camera Lock ของโปรเจกต์ใหม่</p></div>
          <a href="/" className="btn">← กลับ Studio</a>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title"><div><h2>วิดีโออ้างอิง (Reference Video)</h2><p>ใช้เพื่อศึกษาภาษาภาพ การเคลื่อนกล้อง แสง และจังหวะ ไม่ใช่การคัดลอกตัวละครหรือเนื้อหาจากต้นฉบับ</p></div></div>
          <label className="btn btn-lg" style={{ display: "inline-block" }}>
            เลือกวิดีโอ
            <input hidden type="file" accept="video/*" onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? "")} />
          </label>
          <div className="help">ⓘ {fileName ? `เลือกแล้ว: ${fileName}` : "รองรับ MP4/WebM/QuickTime เมื่อเชื่อม Storage จริง"}</div>
          <div style={{ height: 14 }} />
          <button className="btn btn-primary" disabled={loading} onClick={analyze}>{loading ? "กำลังวิเคราะห์..." : "✦ วิเคราะห์ Style & Camera"}</button>
          <div style={{ height: 14 }} />
          <div className="notice">ตอนนี้ใช้ Mock Analyzer เพื่อให้ระบบ UI/Flow ทำงานได้ก่อน ตามแผนจะเชื่อม Multimodal AI เป็นขั้นหลัง โดยไฟล์จริงต้องผ่าน Private Storage + Signed URL + Upload Validation</div>
        </div>

        <div className="card">
          <div className="card-title"><div><h2>สิ่งที่ระบบจะดึงออกมา</h2><p>ผลวิเคราะห์จะถูกเก็บเป็น Structured Data และผู้ใช้เลือกได้ว่าจะนำส่วนไหนไปใช้ ไม่บังคับใช้ทั้งหมด</p></div></div>
          <div className="stack">
            {["สไตล์ภาพและพื้นผิว", "Mood / Genre feeling", "Color Palette", "Lighting direction & time of day", "Camera placement / lens feeling", "Shot pattern และจังหวะตัด", "Motion / Blocking", "Continuity notes"].map((item) => <div className="notice success" key={item}>✓ {item}</div>)}
          </div>
        </div>
      </div>

      {analysis && <div className="card">
        <div className="card-title"><div><h2>ผลวิเคราะห์ตัวอย่าง</h2><p>กดนำไปใช้เป็น Style Lock / Camera Lock ได้เมื่อเชื่อม Project Persistence</p></div><span className="badge good">Analyzed</span></div>
        <div className="grid-3">
          <div><label className="label">Visual Style</label><div className="notice">{analysis.visualStyle.join(" · ")}</div></div>
          <div><label className="label">Mood</label><div className="notice">{analysis.mood.join(" · ")}</div></div>
          <div><label className="label">Palette</label><div className="notice">{analysis.colorPalette.join(" · ")}</div></div>
          <div><label className="label">Lighting</label><div className="notice">{analysis.lighting.join(" · ")}</div></div>
          <div><label className="label">Camera Language</label><div className="notice">{analysis.cameraLanguage.join(" · ")}</div></div>
          <div><label className="label">Shot Pattern</label><div className="notice">{analysis.shotPatterns.join(" → ")}</div></div>
        </div>
        <div style={{ height: 14 }} />
        <label className="label">Suggested Style Prompt</label><div className="prompt-box" style={{ maxHeight: 160 }}>{analysis.suggestedStylePrompt}</div>
        <div style={{ height: 10 }} />
        <label className="label">Suggested Camera Lock</label><div className="prompt-box" style={{ maxHeight: 160 }}>{analysis.suggestedCameraLock}</div>
      </div>}
    </div>
  );
}
