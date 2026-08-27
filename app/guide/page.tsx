import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/auth-core";
import styles from "./guide.module.css";

type GuideItem = { title: string; body: string; steps?: string[]; note?: string };
type GuideSection = { id: string; title: string; summary: string; scope: "ALL" | "ADMIN"; items: GuideItem[] };

const USER_SECTIONS: GuideSection[] = [
  { id: "start", title: "เริ่มต้น / Production Command Center", summary: "จุดเข้าใช้งานหลัก เลือกเส้นทางสร้างงานและเปิด Project ที่เกี่ยวข้อง", scope: "ALL", items: [
    { title: "หน้าเริ่มต้น", body: "ใช้ดูภาพรวม Studio, เส้นทางสร้างงาน, Template/Look และทางลัดไปยังเครื่องมือหลัก โดย Sidebar ชุดเดียวจะอยู่คงที่ทุกหน้าที่ล็อกอิน" },
    { title: "Studio พร้อมใช้งาน", body: "เริ่ม Project ด้วยการกำหนดเรื่อง โมเดล เวลา อัตราส่วนภาพ สไตล์ และค่าการผลิตเอง" },
    { title: "AI ช่วยสร้างทั้งงาน", body: "ให้ AI ช่วยวางโครง Project/Scene/Prompt ภายใต้ข้อกำหนดและ Lock ที่ตั้งไว้ โดยยังตรวจแก้ก่อน Generate ได้" },
    { title: "Template / Look", body: "เริ่มจากแนวภาพที่เตรียมไว้ เช่น Sci‑Fi, Fantasy, Action, Romance, Horror แล้วปรับรายละเอียดต่อใน Studio" },
  ]},
  { id: "projects", title: "โปรเจกต์ / Series Continuity", summary: "จัดการงานหลายตอน พร้อม Canon และความต่อเนื่องระหว่าง Episode", scope: "ALL", items: [
    { title: "Series Bible", body: "กำหนดชื่อซีรีส์ Premise, Video Model, Visual Style, Aspect Ratio, Character Bible และ Canon Rules เพื่อเป็นต้นฉบับกลางของทุกตอน" },
    { title: "Episode Workspace", body: "สร้างและแก้ Synopsis, Scene, Duration และลำดับตอน แต่ละ Episode ใช้ค่า Lock กลางร่วมกันเพื่อป้องกัน Drift" },
    { title: "Continuity Lock", body: "ควบคุม Character, Voice, Soundscape, Visual Style และ Canon ให้ต่อเนื่องข้ามตอน พร้อมตรวจ Ending State ก่อนเริ่มตอนถัดไป" },
    { title: "Ending State / Next Episode", body: "บันทึกสถานะตัวละคร ฉาก เสียง และผลลัพธ์ของตอน เพื่อใช้เป็นจุดเริ่มต้นของ Episode ถัดไป" },
  ]},
  { id: "studio", title: "AI Studio", summary: "พื้นที่สร้างงานหลักตั้งแต่ Setup จนถึง Prompt & Render", scope: "ALL", items: [
    { title: "Production Setup", body: "เลือก Video Model, Target Duration, Aspect Ratio, Visual Style และ Story Premise ก่อนเริ่มสร้าง Scene", steps: ["เลือกโมเดลตามงานและราคา", "กำหนดความยาวรวม", "เลือกอัตราส่วนภาพ", "เลือก Style", "เขียน Premise"] },
    { title: "โหมด AI Director", body: "AI ช่วยกำกับและแนะนำค่าที่เหมาะสม แต่ยังคงให้ผู้ใช้ตรวจและแก้ทุกค่าได้" },
    { title: "Scene Planner", body: "วาง Scene เป็นลำดับเวลา กำหนด Duration, Action, Emotion, Lighting, Sound และรายละเอียดกล้องต่อช่วง" },
    { title: "Director Pro", body: "ใช้ค่าระดับมืออาชีพ เช่น Lens, Camera Height, Movement, Composition, Depth of Field, Foreground Occlusion และ Lock ราย Scene" },
    { title: "Prompt & Render", body: "ตรวจ Prompt ที่รวม Story, Character, Reference, Camera, Lighting, Dialogue และ Negative Rules ก่อนส่งงานไปคิว Generate" },
  ]},
  { id: "characters", title: "ตัวละครและเสียง", summary: "สร้าง Character Reference และ Voice Lock เพื่อรักษาตัวตนให้ตรงกันทุก Scene", scope: "ALL", items: [
    { title: "Character Definition", body: "กำหนดชื่อ บทบาท อายุ ลักษณะภายนอก เครื่องแต่งกาย บุคลิก ความสัมพันธ์ และข้อห้ามด้าน Identity" },
    { title: "Reference Pack", body: "ผูกภาพอ้างอิงหลายมุมกับตัวละครเพื่อให้ระบบใช้เป็นหลักในการสร้างภาพ/วิดีโอ" },
    { title: "Voice Profile", body: "เลือกหรือกำหนดเสียง ตัวตน น้ำเสียง อารมณ์ ความเร็ว และข้อจำกัดการพูดของแต่ละตัวละคร" },
    { title: "Character / Voice Lock", body: "เปิด Lock เพื่อป้องกันหน้า รูปร่าง เสื้อผ้า บุคลิก และเสียงเปลี่ยนระหว่าง Scene หรือ Episode" },
  ]},
  { id: "storyboard", title: "สตอรี่บอร์ด / Cinematic Direction", summary: "กำกับ Shot, กล้อง, บทพูด และ Reference ในระดับ Timeline", scope: "ALL", items: [
    { title: "Storyboard", body: "จัด Scene และ Shot ตาม Timeline กำหนดช่วงเวลา จุดเริ่ม–จบ และลำดับภาพ" },
    { title: "Camera & Lens", body: "เลือก Shot Type, Angle, Lens mm, Camera Height, Movement, Speed, Focus, DOF และ Composition" },
    { title: "Dialogue", body: "กำหนดผู้พูด ข้อความ เวลาเริ่ม–จบ อารมณ์ และ Speed พร้อม Voice Lock เพื่อไม่สลับเสียง" },
    { title: "Reference", body: "แนบภาพ/วิดีโออ้างอิงสำหรับ Character, Location, Prop, Style หรือการกำกับ และกำหนดว่าจะใช้อ้างอิงส่วนใด" },
  ]},
  { id: "library", title: "คลังทรัพยากร", summary: "เก็บและเรียกใช้ทรัพยากรกลางของ Project และระบบ", scope: "ALL", items: [
    { title: "ภาพ & สไตล์", body: "เปิดดู Visual Reference/Style พร้อมรายละเอียด Visual Language, Lighting, Color Mood และ Prompt Guidance" },
    { title: "ตัวละคร / Creature", body: "เก็บ Character Reference Pack, ตัวละครคน สัตว์ และ Creature เพื่อนำกลับมาใช้ซ้ำ" },
    { title: "เสียง / Voice", body: "เลือก Voice Preset และข้อมูลเสียงสำหรับ Dialogue หรือ Voice Lock" },
    { title: "Ambience / SFX", body: "เลือก Soundscape, Ambient และเอฟเฟกต์เสียงที่ใช้ประกอบ Scene" },
    { title: "วิดีโอที่สร้างแล้ว", body: "เปิดผลงาน Generation ที่สำเร็จ ตรวจผลลัพธ์และใช้เป็น Reference ต่อได้" },
  ]},
  { id: "agent", title: "AI Agent", summary: "ระบบงานอัตโนมัติที่วางแผน ทำงานตามขั้น และหยุดรอการอนุมัติเมื่อจำเป็น", scope: "ALL", items: [
    { title: "Agent Run", body: "สร้างงาน Agent ตาม Mode/งบ/จำนวน Episode แล้วติดตาม Stage, Status, Estimated Spend และ Actual Spend" },
    { title: "Approval", body: "งานที่ถึงจุดต้องอนุมัติจะหยุดรอ เพื่อไม่ให้ใช้เครดิตหรือดำเนินขั้นสำคัญโดยอัตโนมัติ" },
    { title: "Decision Log", body: "ระบบเก็บเหตุผลและการตัดสินใจแต่ละ Stage เพื่อให้ตรวจย้อนกลับได้" },
    { title: "Budget Guard", body: "กำหนดเพดานงบและ Approval Threshold เพื่อควบคุมค่าใช้จ่ายของงาน Agent" },
  ]},
  { id: "models", title: "Model Center", summary: "เปรียบเทียบโมเดลตามความสามารถ ข้อจำกัด และต้นทุนก่อนเลือกใช้", scope: "ALL", items: [
    { title: "เลือกโมเดล", body: "ดูโมเดลที่ระบบรองรับ เช่น Seedance และโมเดลอื่นตาม Catalog ปัจจุบัน ก่อนใช้ใน Project" },
    { title: "Model Lock", body: "ล็อกโมเดลหลักเพื่อรักษาภาษาและคุณภาพภาพ หรือใช้โหมด Hybrid เมื่อ Project อนุญาต" },
    { title: "ราคาและความสามารถ", body: "เปรียบเทียบ Resolution, Duration, Reference Support, Audio/Video Capability และเครดิตโดยประมาณ" },
  ]},
  { id: "render", title: "คิวสร้าง / Render Queue", summary: "ติดตาม Generation ตั้งแต่ Reserve Credit จนสำเร็จหรือ Refund", scope: "ALL", items: [
    { title: "Reserve → Generate", body: "ก่อน Generate ระบบกันเครดิตตาม Estimate แล้วส่งงานเข้า Queue โดยใช้ idempotency ป้องกันการหักซ้ำ" },
    { title: "สถานะงาน", body: "ติดตาม Provider, Model, ช่วงเวลา, Resolution, Status, Error และ Output Asset ของแต่ละ Generation Job" },
    { title: "Settle / Refund", body: "เมื่อจบงานจะหัก Actual Usage และคืนส่วนที่กันไว้เกิน หรือ Refund เมื่อ Generation ล้มเหลวตามเงื่อนไข" },
  ]},
  { id: "wallet", title: "เครดิตและค่าใช้จ่าย", summary: "ดูยอดพร้อมใช้ ยอดสำรอง รายการหัก/คืน และต้นทุนของงาน", scope: "ALL", items: [
    { title: "ยอดเครดิต", body: "Paid + Bonus คือยอดรวม และ Available คือยอดที่หัก Reserved แล้ว สามารถใช้สร้างงานได้จริง" },
    { title: "Credit Activity", body: "ดู Ledger ของ Reserve, Charge, Refund, Admin Adjust และรายการเครดิตที่เกี่ยวข้องกับงาน" },
    { title: "Cost Transparency", body: "ระบบบันทึก Cost Quote, Cost Usage Event และ LLM Usage เพื่อแยกต้นทุนแต่ละประเภทงาน" },
  ]},
  { id: "profile", title: "บัญชีและความปลอดภัย", summary: "จัดการข้อมูลบัญชีและ Authenticator 2FA ตามสิทธิ์", scope: "ALL", items: [
    { title: "Profile", body: "ดูชื่อ อีเมล Role และสถานะบัญชีจากข้อมูล Login ปัจจุบัน" },
    { title: "Authenticator 2FA", body: "เปิดและยืนยันรหัส 6 หลักจาก Authenticator; บัญชี Admin บังคับใช้ 2FA" },
    { title: "Recovery Code", body: "ใช้ Recovery Code เมื่อเข้าถึง Authenticator ไม่ได้ โดย Code ที่ใช้แล้วจะถูกตัดออก" },
    { title: "ออกจากระบบ", body: "ล้าง Session Cookie ของ SCENOVA และกลับไปหน้า Login" },
  ]},
];

const ADMIN_SECTIONS: GuideSection[] = [
  { id: "admin-users", title: "Admin — จัดการผู้ใช้", summary: "ศูนย์ควบคุมบัญชี MEMBER พร้อม Audit Trail", scope: "ADMIN", items: [
    { title: "เพิ่ม / แก้ไข User", body: "สร้างสมาชิกใหม่ แก้ชื่อและอีเมลจาก Admin เท่านั้น ไม่มี Public Sign-up" },
    { title: "รีเซ็ตรหัสผ่าน", body: "ตั้งรหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร ระบบเก็บเฉพาะ Password Hash และบันทึกการเปลี่ยนลง AuditLog" },
    { title: "เพิ่ม / หักเครดิต", body: "ปรับเครดิตด้วยค่าบวกหรือลบ ระบบตรวจ Available Credit ก่อนหัก และเขียน WalletLedger + AuditLog ทุกครั้ง" },
    { title: "ระงับตามเวลา", body: "เลือก 15 นาที, 1 ชั่วโมง, 1 วัน, 7 วัน หรือระบุนาทีเอง เมื่อระงับ Account จะ Active=false ทำให้ Session เดิมใช้งานต่อไม่ได้ และปลดอัตโนมัติเมื่อ User Login หลังครบเวลา" },
    { title: "บล็อก / ปลดบล็อก", body: "บล็อกแบบไม่กำหนดเวลาจน Admin ปลดเอง พร้อมบันทึกเหตุผลใน Log" },
    { title: "ลบบัญชี", body: "ลบ MEMBER จริงหลังพิมพ์ DELETE ยืนยัน ข้อมูลที่มี onDelete Cascade จะถูกลบตาม Database relation จึงควรตรวจ Log ก่อนดำเนินการ", note: "ใช้เมื่อแน่ใจเท่านั้น เพราะการลบไม่ใช่การ Disable ชั่วคราว" },
    { title: "Activity Log ราย User", body: "รวม AuditLog, Generation Job, Agent Run และ WalletLedger ล่าสุดเพื่อไล่ตรวจการใช้งานของแต่ละบัญชี" },
  ]},
  { id: "admin-library", title: "Admin — Library Management", summary: "จัดการ Asset กลางที่สมาชิกเห็นในคลัง", scope: "ADMIN", items: [
    { title: "เพิ่ม Asset", body: "อัปโหลดภาพ เสียง ตัวละคร Creature Ambience หรือ Plot พร้อม Metadata และ Reference File" },
    { title: "รายละเอียด Style", body: "กำหนด Visual Language, Lighting, Color Mood, Best For, Prompt Guidance, Compatibility และ Lock Note" },
    { title: "ลบ Asset", body: "ลบรายการจาก Library จริง โดย System Asset และ Admin Upload ใช้กติกาการลบที่ API กำหนด" },
  ]},
  { id: "admin-security", title: "Admin — Security Center", summary: "ควบคุมความปลอดภัยระดับระบบและ Emergency Control", scope: "ADMIN", items: [
    { title: "Maintenance / Login Restriction", body: "จำกัดการ Login ใหม่หรือเปิด Maintenance Mode สำหรับ MEMBER เมื่อระบบต้องหยุดงานชั่วคราว" },
    { title: "Session Control", body: "ใช้ Emergency Security State เพื่อตัด Session ตามเวลาที่กำหนดเมื่อเกิดเหตุด้านความปลอดภัย" },
    { title: "Wallet / Generation Guard", body: "Freeze ความสามารถสำคัญเมื่อพบความผิดปกติ เพื่อหยุดการใช้เครดิตหรือ Generation" },
  ]},
  { id: "admin-cost", title: "Admin — AI Cost & Operations", summary: "ดูต้นทุน AI, LLM usage และสถานะการใช้ทรัพยากรของระบบ", scope: "ADMIN", items: [
    { title: "LLM Cost Meter", body: "ดู Token/Cost ตาม Provider, Model, Category และช่วงเวลา เพื่อควบคุมต้นทุนหลังบ้าน" },
    { title: "Audit / Operational Review", body: "ใช้ข้อมูล Usage, Wallet Ledger และ Security Log ร่วมกันเพื่อตรวจสอบเหตุการณ์และค่าใช้จ่าย" },
  ]},
];

export default async function GuidePage() {
  const store = await cookies();
  const user = await resolveSession(store.get("scenova_session")?.value);
  if (!user) redirect("/login");
  const sections = user.role === "ADMIN" ? [...USER_SECTIONS, ...ADMIN_SECTIONS] : USER_SECTIONS;
  const functionCount = sections.reduce((total, section) => total + section.items.length, 0);

  return <main className={styles.page}>
    <div className={styles.hero}>
      <section className={styles.heroCard}><span className={styles.eyebrow}>SCENOVA SYSTEM GUIDE</span><h1>คู่มือการใช้งานระบบทั้งหมด</h1><p>อธิบายการทำงานของ Workspace, Project, Studio, Cinematic Controls, Library, Agent, Model, Render, Credit, Security และเครื่องมือ Admin ตามสิทธิ์ของบัญชีที่กำลังเข้าสู่ระบบ คู่มือนี้แยกจากหน้าเริ่มต้นและเปิดใช้งานได้จากปุ่ม “คู่มือการใช้งาน” ด้านบนทุกหน้า</p></section>
      <aside className={styles.roleCard}><div><small>สิทธิ์ปัจจุบัน</small><b>{user.role === "ADMIN" ? "Administrator" : "Member"}</b><p style={{ color: "#8d8495", fontSize: 12, lineHeight: 1.6 }}>แสดงเฉพาะฟังก์ชันที่บัญชีนี้มีสิทธิ์ใช้งานจริง</p></div><div className={styles.coverage}><div><small>หมวดคู่มือ</small><b>{sections.length}</b></div><div><small>ฟังก์ชันอธิบาย</small><b>{functionCount}</b></div></div></aside>
    </div>

    <nav className={styles.toc} aria-label="สารบัญคู่มือ">{sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav>

    {sections.map((section) => <section id={section.id} key={section.id} className={`${styles.section} ${section.scope === "ADMIN" ? styles.admin : ""}`}>
      <header className={styles.sectionHead}><div><span className={styles.eyebrow}>{section.scope === "ADMIN" ? "ADMIN ONLY" : "USER WORKFLOW"}</span><h2>{section.title}</h2><p>{section.summary}</p></div><span className={styles.badge}>{section.items.length} ฟังก์ชัน</span></header>
      <div className={styles.grid}>{section.items.map((item) => <article className={styles.item} key={item.title}><h3>{item.title}</h3><p>{item.body}</p>{item.steps?.length ? <ul>{item.steps.map((step) => <li key={step}>{step}</li>)}</ul> : null}{item.note ? <div className={styles.note}>{item.note}</div> : null}</article>)}</div>
    </section>)}

    <p className={styles.footer}>หมายเหตุ: คู่มือนี้อธิบายฟังก์ชันที่มีอยู่ใน SCENOVA เวอร์ชันปัจจุบันและจะต้องอัปเดตพร้อม Feature ใหม่ทุกครั้งเพื่อให้ Coverage ตรงกับระบบจริง</p>
  </main>;
}
