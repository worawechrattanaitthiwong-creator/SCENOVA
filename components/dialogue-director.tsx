"use client";

import { useMemo, useState } from "react";
import { dialogueCameraSuggestion, dialogueToBeats, parseDialogueScript } from "@/lib/dialogue-engine";
import { SAMPLE_PROJECT } from "@/lib/sample-project";

export default function DialogueDirector() {
  const project = SAMPLE_PROJECT;
  const segment = project.episodes[0].segments[1] ?? project.episodes[0].segments[0];
  const [script, setScript] = useState("GIRL_A: เอ๊ะ...เสียงอะไรนะ?\nMOON_CREATURE_A: ...\nGIRL_A: ไม่ต้องกลัวนะ ฉันไม่ทำอะไรเธอหรอก");
  const beats = useMemo(() => dialogueToBeats({ segment, script, characters: project.characters, defaultEmotion: "curious", speed: 1 }), [segment, script, project.characters]);
  const lines = useMemo(() => parseDialogueScript(script), [script]);
  const camera = dialogueCameraSuggestion(beats);

  return (
    <div className="content" style={{ maxWidth: 1250 }}>
      <div className="page-head">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div><h1>Dialogue Director — สร้างวิดีโอจากบทพูด</h1><p>พิมพ์บทแบบ “ชื่อตัวละคร: บทพูด” ระบบจะแยกผู้พูด วางช่วงเวลา และเตรียม Camera Coverage ให้ AI Director ใช้ต่อ โดย Character ID และ Voice Lock จะป้องกันบท/เสียงสลับตัวละคร</p></div>
          <a href="/" className="btn">← กลับ Studio</a>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title"><div><h2>บทสนทนา (Dialogue Script)</h2><p>ใส่เฉพาะบทพูดก็ได้ หรือผสมคำบรรยาย ระบบ AI สามารถช่วยสร้าง Scene/Action จากบทได้เมื่อเชื่อม Prompt Assistant</p></div></div>
          <textarea className="textarea" style={{ minHeight: 260 }} value={script} onChange={(e) => setScript(e.target.value)} />
          <div className="help">ⓘ ตัวอย่าง: “MIKI: เธอได้ยินไหม?” ระบบจะจับ MIKI เป็น Speaker และผูกกับ Character ID ที่ชื่อเดียวกัน ถ้าไม่พบจะเตือนให้เลือกตัวละครก่อน Generate</div>
          <div style={{ height: 12 }} />
          <div className="notice success">ตรวจพบ {lines.length} บรรทัด · ประเมินลงในช่วง {segment.start}–{segment.end} วินาที</div>
        </div>

        <div className="card">
          <div className="card-title"><div><h2>AI Camera Coverage ที่แนะนำ</h2><p>ใช้เป็นแนวทาง ไม่ใช่คำสั่งตายตัว ผู้ใช้สามารถเปลี่ยนเป็น Camera Preset หรือ Custom ราย Shot ได้</p></div></div>
          <div className="stack">
            {camera.map((item, index) => <div className="notice" key={item}><b>{index + 1}. {item}</b><br/><span className="muted">เหมาะสำหรับสลับผู้พูด คนฟัง และ Reaction โดยรักษา eye-line ต่อเนื่อง</span></div>)}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><div><h2>Dialogue Timeline</h2><p>ระบบกำหนดเวลาเริ่ม/จบคร่าว ๆ จากความยาวประโยค แล้วผู้ใช้สามารถลากแก้ใน Timeline ได้ก่อน Generate</p></div></div>
        <div className="stack">
          {beats.map((beat) => (
            <div className="segment-card" key={beat.id}>
              <div className="segment-head"><div><b>{beat.start}–{beat.end}s · {beat.characterId}</b><div className="help">Voice/Character owner ของประโยคนี้</div></div><span className="badge">{beat.emotion} · {beat.speed}</span></div>
              <div className="segment-body">“{beat.text}”</div>
            </div>
          ))}
        </div>
      </div>

      <div className="notice">ⓘ เมื่อเชื่อม Voice API จริง ระบบจะใช้ Voice ID จาก Character Lock และสร้างเสียงตาม Emotion/Speed ของแต่ละ Dialogue Beat โดยห้าม Voice Swap</div>
    </div>
  );
}
