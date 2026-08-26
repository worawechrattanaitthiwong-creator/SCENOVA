from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Missing replacement target: {label} in {path}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


def append_once(path: str, marker: str, block: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if marker not in text:
        p.write_text(text.rstrip() + "\n\n" + block.strip() + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Render Queue — make demo status explicit, remove fake actions, improve mobile.
# ---------------------------------------------------------------------------
Path("app/render/render.module.css").write_text('''.page{max-width:1320px;margin:0 auto;padding:30px;color:#f5f5ef}.hero{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-bottom:16px}.eyebrow{color:#f2c94c;font-size:12px;font-weight:900;letter-spacing:.14em}.hero h1{font-size:clamp(28px,3vw,34px);margin:7px 0 5px}.hero p{color:#93938c;font-size:14px;line-height:1.7;margin:0;max-width:780px}.primaryLink{display:inline-flex;align-items:center;min-height:44px;color:#0a0a0a;background:#f2c94c;border-radius:9px;padding:9px 13px;text-decoration:none;font-weight:850;font-size:12px}.demoNotice{margin-bottom:14px;padding:13px 14px;border:1px solid #4b4020;border-radius:12px;background:#17150d;color:#dfca74;font-size:13px;line-height:1.6}.list{display:grid;gap:10px}.job{border:1px solid #242424;border-radius:14px;background:#0f0f0f;padding:15px}.row{display:grid;grid-template-columns:86px minmax(220px,1fr) 90px 150px 110px 110px;gap:12px;align-items:center}.id{color:#f2c94c;font-size:12px;font-weight:850}.project b{display:block;font-size:14px}.project small{color:#7e7e78;font-size:12px}.value,.status{font-size:13px}.status{color:#d9c45f}.sample{justify-self:end;border:1px solid #33301f;border-radius:999px;background:#15140d;color:#b9a95f;padding:6px 9px;font-size:11px;font-weight:800}.track{height:6px;border-radius:999px;background:#1e1e1e;overflow:hidden;margin-top:12px}.bar{height:100%;background:#f2c94c}.emptyHint{margin-top:14px;color:#8f8f88;font-size:12px;line-height:1.6}.page :is(a,button):focus-visible{outline:2px solid #f2c94c;outline-offset:2px}@media(max-width:900px){.hero{align-items:flex-start;flex-direction:column}.row{grid-template-columns:80px 1fr 100px}.row>*:nth-child(4),.row>*:nth-child(5){font-size:12px}.sample{justify-self:start}.job{overflow:hidden}}@media(max-width:620px){.page{padding:18px 12px 76px}.row{grid-template-columns:1fr 1fr;gap:8px}.project{grid-column:1/-1;grid-row:1}.id{grid-row:2}.sample{justify-self:end}.hero p{font-size:13px}.primaryLink{width:100%;justify-content:center}}
''', encoding="utf-8")

Path("app/render/page.tsx").write_text('''import Link from "next/link";
import styles from "./render.module.css";

const jobs = [
  { id: "R-001", project: "เด็กหญิงกับสิ่งมีชีวิตลึกลับ", ep: "EP01", model: "Seedance 2.5", duration: "30s", status: "พร้อมสร้าง", progress: 0 },
  { id: "R-002", project: "เมืองอนาคต", ep: "EP02", model: "Veo", duration: "8s", status: "รอคิว", progress: 35 },
];

export default function RenderQueuePage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div><span className={styles.eyebrow}>RENDER QUEUE</span><h1>งานสร้างคลิป</h1><p>ศูนย์รวมงานที่รอ กำลังสร้าง สำเร็จ หรือล้มเหลว เมื่อเชื่อม Provider จริงหน้านี้จะแสดง Progress, Retry, Cancel, เครดิต และไฟล์ผลลัพธ์จากข้อมูลจริง</p></div>
        <Link href="/libraries?tab=videos" className={styles.primaryLink}>เปิดคลังวิดีโอ</Link>
      </header>
      <div className={styles.demoNotice}><b>สถานะ: UX DEMO</b> — รายการด้านล่างเป็นข้อมูลตัวอย่างเพื่อทดสอบหน้าจอเท่านั้น ยังไม่ใช่งานที่ถูกส่งไปยัง Video Provider และไม่มีการหักเครดิตจากรายการตัวอย่างนี้</div>
      <section className={styles.list} aria-label="ตัวอย่าง Render Queue">
        {jobs.map((job) => <article key={job.id} className={styles.job}>
          <div className={styles.row}>
            <span className={styles.id}>{job.id}</span>
            <div className={styles.project}><b>{job.project}</b><small>{job.ep}</small></div>
            <span className={styles.value}>{job.duration}</span><span className={styles.value}>{job.model}</span>
            <span className={styles.status}>{job.status}</span><span className={styles.sample}>ตัวอย่าง</span>
          </div>
          <div className={styles.track} aria-label={`ความคืบหน้าตัวอย่าง ${job.progress}%`}><div className={styles.bar} style={{ width: `${job.progress}%` }} /></div>
        </article>)}
      </section>
      <p className={styles.emptyHint}>เมื่อ Render orchestration เชื่อมกับ Provider Queue แล้ว จะเปลี่ยนรายการตัวอย่างนี้เป็นข้อมูลจากฐานจริงโดยไม่เปลี่ยนโครง UX หลัก</p>
    </main>
  );
}
''', encoding="utf-8")

# ---------------------------------------------------------------------------
# Model Center — readable specs and correct links back to Studio.
# ---------------------------------------------------------------------------
Path("app/models/models.module.css").write_text('''.page{max-width:1320px;margin:0 auto;padding:30px;color:#f5f5ef}.hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:16px}.eyebrow{color:#f2c94c;font-size:12px;font-weight:900;letter-spacing:.14em}.hero h1{margin:7px 0 5px;font-size:clamp(28px,3vw,34px)}.hero p{margin:0;color:#92928b;font-size:14px;line-height:1.7;max-width:780px}.primaryLink{display:inline-flex;align-items:center;min-height:44px;color:#0a0a0a;background:#f2c94c;border-radius:9px;padding:9px 13px;text-decoration:none;font-weight:850;font-size:12px}.notice{padding:13px 14px;border-radius:11px;border:1px solid #3b351e;background:#17160f;color:#d9c45f;font-size:13px;line-height:1.6;margin-bottom:14px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(285px,1fr));gap:12px}.card{border:1px solid #242424;border-radius:15px;padding:16px;background:#0f0f0f}.cardTop{display:flex;justify-content:space-between;gap:10px}.cardTop b{display:block;font-size:17px}.provider{color:#85857e;font-size:12px}.price{align-self:flex-start;border:1px solid #3b351e;border-radius:999px;padding:5px 8px;color:#d9c45f;background:#17160f;font-size:11px;font-weight:800}.description{color:#a1a19a;font-size:13px;line-height:1.65;min-height:42px}.specs{display:grid;grid-template-columns:1fr 1fr;gap:7px}.spec{padding:10px;border-radius:9px;background:#090909;border:1px solid #202020}.spec b{display:block;font-size:13px}.spec span{color:#777770;font-size:11px}.tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}.tags span{color:#d6bc5a;font-size:11px;padding:5px 7px;border-radius:6px;background:#19180f}.choose{display:inline-flex;align-items:center;min-height:42px;margin-top:13px;color:#0a0a0a;text-decoration:none;padding:8px 11px;border-radius:8px;background:#f2c94c;font-size:12px;font-weight:900}.page :is(a,button):focus-visible{outline:2px solid #f2c94c;outline-offset:2px}@media(max-width:700px){.page{padding:18px 12px 76px}.hero{align-items:flex-start;flex-direction:column}.primaryLink{width:100%;justify-content:center}.grid{grid-template-columns:1fr}.description{min-height:auto}}
''', encoding="utf-8")

Path("app/models/page.tsx").write_text('''import Link from "next/link";
import { VIDEO_MODELS } from "@/lib/catalogs";
import styles from "./models.module.css";

const priceLabel = (level: number) => level === 1 ? "ประหยัด" : level === 2 ? "ปานกลาง" : "พรีเมียม";

export default function ModelsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div><span className={styles.eyebrow}>MODEL CENTER</span><h1>โมเดล & เรทราคา</h1><p>เปรียบเทียบโมเดลก่อนใช้งาน ดูความยาวสูงสุด ความละเอียด Audio, Reference และระดับราคา แล้วกลับไปเลือกใน Studio</p></div>
        <Link href="/studio#setup" className={styles.primaryLink}>กลับ Studio</Link>
      </header>
      <div className={styles.notice}>ยังไม่ใช้ Pricing API สด จึงแสดง “ระดับราคา” แทนตัวเลขตายตัวเพื่อไม่ให้ข้อมูลล้าสมัย เมื่อเชื่อม Provider ระบบจะคำนวณราคา/วินาทีและเครดิตจาก Server ก่อนยืนยันทุกครั้ง</div>
      <div className={styles.grid}>
        {VIDEO_MODELS.map((model) => <article key={model.id} className={styles.card}>
          <div className={styles.cardTop}><div><b>{model.name}</b><span className={styles.provider}>{model.provider}</span></div><span className={styles.price}>{priceLabel(model.priceLevel)}</span></div>
          <p className={styles.description}>{model.descriptionTh}</p>
          <div className={styles.specs}>
            {[[`${model.maxSecondsPerGeneration} วิ`,"สูงสุด / generation"],[model.resolutions.join(" / "),"Resolution"],[model.supportsAudio?"รองรับ":"ไม่รองรับ","Audio"],[model.supportsVideoReference?"รองรับ":"ไม่รองรับ","Video Reference"]].map(([value,label]) => <div key={label} className={styles.spec}><b>{value}</b><span>{label}</span></div>)}
          </div>
          <div className={styles.tags}>{model.bestFor.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <Link prefetch href="/studio#setup" className={styles.choose}>เลือกใน Studio →</Link>
        </article>)}
      </div>
    </main>
  );
}
''', encoding="utf-8")

# ---------------------------------------------------------------------------
# Series typography — previously many 7–10px controls were below comfortable UI.
# ---------------------------------------------------------------------------
append_once("components/series-manager-v3.module.css", "SCENOVA_SERIES_READABILITY_V2", r'''/* SCENOVA_SERIES_READABILITY_V2 */
.hero>div:first-child>span,.sectionTitle>div>span,.cardHead>div>span{font-size:11px}.hero h1{font-size:clamp(30px,3vw,36px)}.hero p{font-size:14px;line-height:1.7}.heroActions a,.heroActions button,.actions button,.sceneTools button,.cardHead button{font-size:12px;min-height:40px}.guideHead b{font-size:16px}.guideHead span{font-size:12px}.guideGrid article>b{font-size:12px}.guideGrid strong{font-size:13px}.guideGrid span{font-size:12px;line-height:1.6}.sectionTitle h2{font-size:20px}.sectionTitle>span,.sectionTitle>div:last-child span{font-size:12px}.score span{font-size:11px}.score b{font-size:15px}.bible label>span,.card label>span,.sceneEditor label>span,.field>span{font-size:13px}.bible input,.bible select,.bible textarea,.card input,.card select,.card textarea,.sceneEditor input,.sceneEditor select,.sceneEditor textarea,.field input,.field select{font-size:14px;min-height:44px}.bible small,.card small,.sceneEditor small,.field small{font-size:12px}.locks label,.locks label span{font-size:12px;min-height:40px}.historyRail span{font-size:11px}.historyRail b{font-size:13px}.historyRail small{font-size:11px}.cardHead h2{font-size:19px}.cardHead>strong{font-size:11px}.previous b{font-size:12px}.previous p{font-size:12px;line-height:1.6}.timeline button{min-height:42px}.timeline b,.timeline span{font-size:11px}.sceneTools span{font-size:12px}.sceneWorkspace aside button>b{font-size:11px}.sceneWorkspace aside strong{font-size:13px}.sceneWorkspace aside small{font-size:11px}.sceneTitle input{font-size:19px}.sceneTitle button{font-size:12px;min-height:40px}.durationBox b{font-size:13px}.durationBox strong{font-size:14px}.durationBox small{font-size:11px}.sceneEditor summary{font-size:13px;min-height:36px;display:flex;align-items:center}.rule>b{font-size:12px}.rule span{font-size:11px}.main :is(button,a,input,select,textarea,summary):focus-visible{outline:2px solid #f1cf55;outline-offset:2px}
''')

# ---------------------------------------------------------------------------
# Agent Control Center readability and explicit same-origin auth on API calls.
# ---------------------------------------------------------------------------
append_once("components/agent-control-center.module.css", "SCENOVA_AGENT_READABILITY_V2", r'''/* SCENOVA_AGENT_READABILITY_V2 */
.hero>div>span{font-size:11px}.hero p{font-size:14px;line-height:1.65}.hero>a{font-size:12px;min-height:42px;display:flex;align-items:center}.runTitle b{font-size:14px}.runTitle button{min-width:40px;min-height:40px}.runList>button{min-height:58px}.runList>button b{font-size:12px}.runList>button i{font-size:11px}.runList small{font-size:11px}.statusBar small{font-size:11px}.statusBar strong{font-size:15px}.timeline>div{font-size:11px}.timeline i{width:30px;height:30px}.approval>span{font-size:11px}.approval p{font-size:14px;line-height:1.65}.approval>small{font-size:12px;line-height:1.55}.approval button,.controls button{font-size:12px;min-height:42px}.stopReason b,.stopReason span{font-size:13px}.panelTitle h2{font-size:18px}.panelTitle span{font-size:11px}.log b{font-size:13px}.log i{font-size:11px}.log p{font-size:13px}.log small{font-size:11px}.jobs>div{font-size:12px;line-height:1.5}.empty,.muted{font-size:13px;line-height:1.6}.page :is(button,a):focus-visible{outline:2px solid #f0c83d;outline-offset:2px}
''')
replace_once(
    "components/agent-control-center.tsx",
    'fetch("/api/agent/runs", { cache: "no-store" })',
    'fetch("/api/agent/runs", { cache: "no-store", credentials: "same-origin" })',
    "agent run credentials",
)
replace_once(
    "components/agent-control-center.tsx",
    'fetch(`/api/agent/runs/${id}`, { cache: "no-store" })',
    'fetch(`/api/agent/runs/${id}`, { cache: "no-store", credentials: "same-origin" })',
    "agent detail credentials",
)
replace_once(
    "components/agent-control-center.tsx",
    'fetch(`/api/agent/runs/${selectedId}/${name}`, { method: "POST" })',
    'fetch(`/api/agent/runs/${selectedId}/${name}`, { method: "POST", credentials: "same-origin" })',
    "agent action credentials",
)

# ---------------------------------------------------------------------------
# Wallet — do not present a fake payment control as a live payment action.
# ---------------------------------------------------------------------------
replace_once(
    "components/wallet-console.tsx",
    '<div><span style={{ color: "#f2c94c", fontSize: 10, fontWeight: 900, letterSpacing: ".14em" }}>CREDIT WALLET</span>',
    '<div><span style={{ color: "#f2c94c", fontSize: 12, fontWeight: 900, letterSpacing: ".14em" }}>CREDIT WALLET</span>',
    "wallet eyebrow size",
)
replace_once(
    "components/wallet-console.tsx",
    '<div className="row"><button className="btn btn-primary btn-lg" onClick={() => setMessage(`เลือกเติม ฿${selected.toLocaleString()} แล้ว — รอเชื่อม PromptPay/Payment Gateway จริง`)}>สร้าง QR PromptPay</button><span className="badge warn">ยังไม่เชื่อมเงินจริง</span></div>',
    '<div className="row"><button className="btn btn-lg" type="button" disabled title="จะเปิดใช้งานหลังเชื่อม Payment Gateway และ Webhook จริง">PromptPay — กำลังเชื่อมระบบ</button><span className="badge warn">โหมดแสดงผลเท่านั้น • ไม่มีการชำระเงินจริง</span></div>',
    "disable fake PromptPay action",
)

# ---------------------------------------------------------------------------
# Admin Library uploads — local filesystem is not durable on Cloudflare Workers.
# Metadata-only assets remain possible; binary uploads require R2/object storage.
# ---------------------------------------------------------------------------
replace_once(
    "app/api/admin/library/route.ts",
    'export const runtime = "nodejs";\n',
    'export const runtime = "nodejs";\nexport const dynamic = "force-dynamic";\n',
    "admin library dynamic route",
)
replace_once(
    "app/api/admin/library/route.ts",
    '  if (referenceFiles.reduce((sum, item) => sum + item.size, 0) > MAX_REFERENCE_TOTAL) return NextResponse.json({ error: "Reference Pack รวมกันใหญ่เกิน 30MB" }, { status: 400 });\n\n  const writtenUrls: string[] = [];',
    '  if (referenceFiles.reduce((sum, item) => sum + item.size, 0) > MAX_REFERENCE_TOTAL) return NextResponse.json({ error: "Reference Pack รวมกันใหญ่เกิน 30MB" }, { status: 400 });\n\n  const hasBinaryUpload = (file instanceof File && file.size > 0) || referenceFiles.length > 0;\n  if (process.env.NODE_ENV === "production" && hasBinaryUpload) {\n    return NextResponse.json({ error: "การอัปโหลดไฟล์บน Cloudflare ยังปิดไว้เพื่อป้องกันไฟล์สูญหาย กรุณาเชื่อม R2/Object Storage ก่อน ส่วน Asset แบบข้อมูล/Prompt ที่ไม่แนบไฟล์ยังเพิ่มได้" }, { status: 503 });\n  }\n\n  const writtenUrls: string[] = [];',
    "block non-durable production uploads",
)

print("SCENOVA product polish applied")
