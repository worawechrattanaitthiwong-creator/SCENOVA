# SCENOVA — AI Movie & Series Studio

SCENOVA คือสตูดิโอ AI สำหรับออกแบบหนังและซีรีส์แบบหลาย EP โดยให้ผู้ใช้เลือกได้ทั้งโหมดง่ายและโหมดผู้กำกับระดับ Production

> สถานะปัจจุบัน: Core Studio + Structured Timeline + Character/Style/Model Locks + Prompt Composer + Render Planner + Mock Provider พร้อมแล้วใน branch `feat/scenova-core-studio` ส่วน Video API, AI Prompt API, Credit Wallet จริง และ Payment Gateway ถูกแยกเป็น Adapter เพื่อเชื่อมภายหลังโดยไม่รื้อระบบหลัก

## หลักการสถาปัตยกรรม

SCENOVA แยก “ระบบหนัง” ออกจาก “ผู้ให้บริการ AI” และ “ระบบเงินจริง” อย่างชัดเจน

```text
User
  ↓
Project / Project Bible / Canon
  ↓
Characters + Styles + Locations + Props + Locks
  ↓
Episodes (10s / 15s / 30s / 1–3 min)
  ↓
Timeline Segments
  ↓
Multi-camera Shots + Dialogue + Action + Emotion + Lighting
  ↓
Structured Prompt Composer
  ↓
AI Prompt Assistant (adapter — connect later)
  ↓
Render Planner
  ↓
Video Provider Adapter (Seedance / Kling / Veo / Runway / Wan)
  ↓
Generation Queue + Continuity Snapshot
  ↓
Credit Reserve → Generate → Charge / Refund (connect later)
```

## ฟีเจอร์ Core ที่ใส่ไว้แล้ว

- ธีม Black / Purple แบบ Premium Cinematic
- UI ภาษาไทยพร้อมคำอธิบายว่าแต่ละค่า “คืออะไร / ใช้ทำอะไร / เหมาะกับอะไร”
- Project Bible และ Canon Facts
- Character Library: คน / สัตว์ / Creature / Robot-Mecha / Custom
- Character Reference Pack และ Character Lock
- Style Gallery พร้อม Visual Preview Placeholder และหมวด Anime, Realistic, Action, Sci-Fi, Mecha, Fantasy, Horror, Commercial ฯลฯ
- Episode Duration: 10 / 15 / 30 / 60 / 90 / 120 / 150 / 180 วินาที
- Time Segment Director แก้รายละเอียดตามช่วงเวลา
- Multi-camera ต่อช่วง พร้อม Shot Type, Angle, Lens, Camera Height, Movement, Focus, Depth of Field, Composition และ Foreground Occlusion
- Model Center: Single Model / Safe Hybrid / Custom Hybrid
- Model Lock และ Main Model
- Prompt Modes: Strict / AI Assisted / Creative Director
- Production Prompt Composer: Master Style Lock, Character Locks, Project Bible, Shot-by-Shot, Camera/Lighting/Motion Locks, Absolute Consistency, Negative Prompt
- Render Planner แบ่ง EP อัตโนมัติตาม max duration ของแต่ละโมเดล
- Continuity Snapshot เตรียมส่ง Last Frame / Video Tail / Character State / Costume / Lighting / Canon ไปงานถัดไป
- Mock Video Provider เพื่อทดสอบ Flow โดยไม่เสีย API
- Database schema สำหรับ Project, Episode, Timeline, Character, Assets, Generation Jobs, Wallet Ledger, Payment Transactions และ Audit Logs
- Security policy: Backend-only keys, rate limits, spend caps, audit, signed URLs และ kill switch

## โหมด Prompt

### Strict Composer
ค่าที่ผู้ใช้เลือกเป็นคำสั่งตรง ระบบไม่มีสิทธิ์เปลี่ยน Lens, Camera, Timing หรือ Locks

### AI Assisted (ค่าเริ่มต้น)
ระบบคุม Hard Constraints และ AI ช่วยเรียบเรียง Cinematic Language, Continuity และ Provider-specific phrasing

### Creative Director
AI เสนอรายละเอียดเพิ่มได้ แต่การแก้ Hard Constraint ต้องผ่านการยืนยันของผู้ใช้

## โหมดโมเดล

### Single Model
ใช้โมเดลเดียวทั้งขอบเขตที่ล็อก เหมาะกับ Character Consistency สูง

### Safe Hybrid
ฉากที่มีตัวละครหลักใช้ Main Model ส่วน B-roll หรือฉากเสี่ยงต่ำอนุญาตให้ใช้โมเดลอื่น

### Custom Hybrid
ผู้ใช้เลือกโมเดลเองรายช่วง/ฉาก ระบบต้องเตือนความเสี่ยงเมื่อสลับโมเดลใน Character Scene

## ทำไม 3 นาทีต่อ EP ได้

UI มอง EP เป็น Timeline ต่อเนื่องได้ถึง 180 วินาที ส่วน Render Planner จะแบ่งงานเบื้องหลังตามความสามารถของโมเดล เช่นโมเดลที่รองรับ 30 วินาทีต่อครั้งจะถูกแบ่งเป็นหลาย Generation Jobs พร้อม Continuity State ระหว่างงาน

## ระบบเครดิตที่เตรียมไว้ (ยังไม่เชื่อมเงินจริง)

ระบบธุรกิจเป็น Credit-only ไม่มี Membership

```text
Server-side Price
  ↓
Reserve Credits
  ↓
Queue
  ↓
Generate
  ↓
Success → Charge
Failure ที่ Provider ไม่คิดเงิน → Refund
```

Browser ไม่มีสิทธิ์กำหนดราคาเอง และทุก transaction ใช้ idempotency key

## Payment (เชื่อมเป็นขั้นท้าย)

Payment Gateway มีหน้าที่เพียงรับเงินจริงและเพิ่มเครดิตเข้ากระเป๋าผ่าน verified webhook เท่านั้น ไม่ผูกกับระบบหนังโดยตรง สามารถเชื่อม PromptPay/Opn/Stripe หรือ Provider อื่นในภายหลัง

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000`

Type check และ build:

```bash
npm run typecheck
npm run build
```

## Database

เตรียม PostgreSQL แล้วตั้ง `DATABASE_URL` จากนั้น:

```bash
npm run db:generate
npm run db:push
```

## ขั้นเชื่อม API ภายหลัง

1. สร้าง implementation ของ `VideoProvider` สำหรับ Seedance
2. เชื่อม `PromptAssistant` กับ Gemini/OpenAI/Claude ตาม Prompt Router
3. เพิ่ม Queue Worker และ Provider Status Polling/Webhook
4. เชื่อม Object Storage แบบ Private + Signed URL
5. เชื่อม Wallet Service จริง
6. เชื่อม PromptPay/Payment Gateway ผ่าน signed webhook
7. เปิด Rate Limit, Spend Caps, Audit Log และ Kill Switch ใน production

## Product rule สำคัญ

**ระบบคุมโครงสร้างและกฎ — AI คุมความฉลาดและภาษาภาพยนตร์**

ข้อมูล Timeline, Camera, Lens, Character, Lock และ Canon ต้องถูกเก็บเป็น Structured Data เสมอ ไม่เก็บเพียง Prompt ก้อนเดียว เพื่อให้แก้เฉพาะช่วง 1–10s / 11–20s / 21–30s หรือ Shot ใด Shot หนึ่งได้โดยไม่ต้องรื้อทั้งโปรเจกต์
