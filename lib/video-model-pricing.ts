export type VideoPricingRow = {
  route: string;
  model: string;
  resolution: string;
  usdPerSecond: number;
  listUsdPerSecond?: number;
  approximate?: boolean;
  note?: string;
};

export type VideoPricingSource = {
  label: string;
  url: string;
};

export type VideoPricingProfile = {
  modelId: string;
  headline: string;
  exampleSeconds: number;
  rows: VideoPricingRow[];
  notes: string[];
  sources: VideoPricingSource[];
  verifiedAt: string;
};

// Pricing shown in SCENOVA is provider/API cost guidance, not a SCENOVA selling price.
// Keep this catalog deliberately explicit and source-backed so we never invent a rate.
// THB examples in the UI use a fixed display-only conversion and are labelled as estimates.
export const VIDEO_PRICING: Record<string, VideoPricingProfile> = {
  "seedance-2-5": {
    modelId: "seedance-2-5",
    headline: "≈ $0.123/วิ ที่ 480p (BytePlus Direct)",
    exampleSeconds: 10,
    rows: [
      {
        route: "BytePlus Direct",
        model: "Seedance 2.5",
        resolution: "480p",
        usdPerSecond: 0.123018,
        approximate: true,
        note: "คำนวณจาก $0.303 × coefficient 0.406; ตัวอย่าง output-only",
      },
      {
        route: "BytePlus Direct",
        model: "Seedance 2.5",
        resolution: "720p",
        usdPerSecond: 0.2764875,
        approximate: true,
        note: "คำนวณจาก $0.303 × coefficient 0.9125; ตัวอย่าง output-only",
      },
      {
        route: "Runway API",
        model: "seedance2_5",
        resolution: "480p",
        usdPerSecond: 0.20,
        note: "+ $0.10/วิ ของ input/reference video; ขั้นต่ำ 80 credits ต่อ generation",
      },
      {
        route: "Runway API",
        model: "seedance2_5",
        resolution: "720p",
        usdPerSecond: 0.30,
        note: "+ $0.15/วิ ของ input/reference video; ขั้นต่ำ 80 credits ต่อ generation",
      },
      {
        route: "Runway API",
        model: "seedance2_5",
        resolution: "1080p",
        usdPerSecond: 0.68,
        note: "+ $0.34/วิ ของ input/reference video; ขั้นต่ำ 80 credits ต่อ generation",
      },
    ],
    notes: [
      "BytePlus Direct คิด billable duration จาก input video + output video แล้วคูณ coefficient ตามความละเอียด จึงอาจสูงกว่าตัวอย่าง output-only เมื่อมีวิดีโออ้างอิง",
      "Runway คิด $0.01 ต่อ credit; reference image และ audio ของ Seedance 2.5 ไม่คิดเพิ่ม แต่ input/reference video มีค่าใช้จ่ายเพิ่ม",
    ],
    sources: [
      { label: "BytePlus Large Model Billing", url: "https://docs.byteplus.com/en/docs/Byteplus_LAS/Large_model_billing" },
      { label: "Runway API Pricing", url: "https://docs.dev.runwayml.com/guides/pricing/" },
    ],
    verifiedAt: "3 ก.ย. 2026",
  },
  kling: {
    modelId: "kling",
    headline: "ตรวจราคาจาก Kling API Plan",
    exampleSeconds: 10,
    rows: [],
    notes: [
      "SCENOVA ยังไม่พบ public pricing table จาก Kling official ที่ยืนยันราคาต่อวินาทีได้ จึงไม่แสดงตัวเลขจากเว็บตัวกลางเพื่อป้องกันราคาคลาดเคลื่อน",
      "ราคาและโควตาจริงขึ้นกับ Kling developer plan / account ที่เชื่อมต่อ",
    ],
    sources: [],
    verifiedAt: "3 ก.ย. 2026",
  },
  veo: {
    modelId: "veo",
    headline: "เริ่ม $0.05/วิ · Veo 3.1 Lite 720p",
    exampleSeconds: 8,
    rows: [
      { route: "Google Gemini API", model: "Veo 3.1 Lite", resolution: "720p", usdPerSecond: 0.05 },
      { route: "Google Gemini API", model: "Veo 3.1 Lite", resolution: "1080p", usdPerSecond: 0.08, note: "1080p ใช้ระยะ 8 วินาที" },
      { route: "Google Gemini API", model: "Veo 3.1 Fast", resolution: "720p", usdPerSecond: 0.10 },
      { route: "Google Gemini API", model: "Veo 3.1 Fast", resolution: "1080p", usdPerSecond: 0.12, note: "1080p ใช้ระยะ 8 วินาที" },
      { route: "Google Gemini API", model: "Veo 3.1 Standard", resolution: "720p / 1080p", usdPerSecond: 0.40 },
      { route: "Google Gemini API", model: "Veo 3.1 Standard", resolution: "4K", usdPerSecond: 0.60, note: "4K ใช้ระยะ 8 วินาที" },
    ],
    notes: [
      "ราคานี้เป็น Veo 3.1 พร้อมเสียงบน Gemini API Paid Tier และ Google ระบุว่าคิดเงินเมื่อวิดีโอสร้างสำเร็จ",
      "Veo 3.1 Preview มี rate limits เข้มกว่ารุ่น stable; มียอด Billing ไม่ได้แปลว่าจะไม่ชน 429",
    ],
    sources: [
      { label: "Gemini API Pricing — Veo 3.1", url: "https://ai.google.dev/gemini-api/docs/pricing" },
      { label: "Veo 3.1 Model Features", url: "https://ai.google.dev/gemini-api/docs/veo" },
    ],
    verifiedAt: "3 ก.ย. 2026",
  },
  runway: {
    modelId: "runway",
    headline: "เริ่ม $0.05/วิ · Gen-4 Turbo",
    exampleSeconds: 10,
    rows: [
      { route: "Runway API", model: "Gen-4 Turbo", resolution: "API standard output", usdPerSecond: 0.05 },
      { route: "Runway API", model: "Gen-4.5", resolution: "API standard output", usdPerSecond: 0.12 },
    ],
    notes: [
      "Runway Developer API คิด $0.01 ต่อ credit: Gen-4 Turbo = 5 credits/วิ และ Gen-4.5 = 12 credits/วิ",
      "Professional/HDR output บางชนิดมี surcharge เพิ่มจากราคาหลักตามตาราง Runway",
    ],
    sources: [
      { label: "Runway API Pricing", url: "https://docs.dev.runwayml.com/guides/pricing/" },
    ],
    verifiedAt: "3 ก.ย. 2026",
  },
  wan: {
    modelId: "wan",
    headline: "โปรฯ เริ่ม $0.035/วิ · Wan 3.0 480p",
    exampleSeconds: 10,
    rows: [
      { route: "Alibaba Model Studio", model: "wan3.0-video", resolution: "480p", usdPerSecond: 0.035, listUsdPerSecond: 0.05, note: "โปรโมชัน 30% ถึง 24 ก.ย. 2026; final price ดูใน console" },
      { route: "Alibaba Model Studio", model: "wan3.0-video", resolution: "720p", usdPerSecond: 0.07, listUsdPerSecond: 0.10, note: "โปรโมชัน 30% ถึง 24 ก.ย. 2026; final price ดูใน console" },
      { route: "Alibaba Model Studio", model: "wan3.0-video", resolution: "1080p", usdPerSecond: 0.14, listUsdPerSecond: 0.20, note: "โปรโมชัน 30% ถึง 24 ก.ย. 2026; final price ดูใน console" },
      { route: "Alibaba Model Studio", model: "wan3.0-video-prime", resolution: "480p", usdPerSecond: 0.068 },
      { route: "Alibaba Model Studio", model: "wan3.0-video-prime", resolution: "720p", usdPerSecond: 0.14 },
      { route: "Alibaba Model Studio", model: "wan3.0-video-prime", resolution: "1080p", usdPerSecond: 0.28 },
    ],
    notes: [
      "Alibaba ระบุว่าทั้ง input และ output video อาจถูกคิดตามระยะเวลา; failed requests ไม่ถูกคิดเงินตาม pricing rule ของ Model Studio",
      "ราคาโปรโมชันของ wan3.0-video มีวันหมดอายุ จึงควรดู final bill/console ก่อนงานใหญ่",
    ],
    sources: [
      { label: "Wan 3.0 Official Pricing", url: "https://modelstudio.console.alibabacloud.com/model-releases/wan3.0-video" },
      { label: "Alibaba Model Studio Pricing", url: "https://www.alibabacloud.com/help/en/model-studio/model-pricing" },
    ],
    verifiedAt: "3 ก.ย. 2026",
  },
};

export const MODEL_PRICE_EXAMPLE_USD_THB = 33.5;
