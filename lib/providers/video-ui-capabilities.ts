export type VideoUiCapability = {
  model: string;
  providerId: "seedance" | "kling" | "veo" | "runway" | "wan";
  durationSeconds: number[];
  defaultDurationSeconds: number;
  ratioValues: string[];
  durationLabel: string;
};

function range(min: number, max: number) {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
}

export const VIDEO_UI_CAPABILITIES: Record<string, VideoUiCapability> = {
  "Seedance 2.5": {
    model: "Seedance 2.5",
    providerId: "seedance",
    durationSeconds: range(4, 30),
    defaultDurationSeconds: 10,
    ratioValues: ["16:9 — Widescreen", "9:16 — Vertical", "1:1 — Square"],
    durationLabel: "4–30 วินาทีต่อ Generation",
  },
  Kling: {
    model: "Kling",
    providerId: "kling",
    durationSeconds: range(3, 15),
    defaultDurationSeconds: 10,
    ratioValues: ["16:9 — Widescreen", "9:16 — Vertical", "1:1 — Square"],
    durationLabel: "3–15 วินาทีต่อ Generation",
  },
  Veo: {
    model: "Veo",
    providerId: "veo",
    durationSeconds: [8],
    defaultDurationSeconds: 8,
    ratioValues: ["16:9 — Widescreen", "9:16 — Vertical"],
    durationLabel: "8 วินาทีต่อ Generation",
  },
  Runway: {
    model: "Runway",
    providerId: "runway",
    durationSeconds: range(2, 10),
    defaultDurationSeconds: 5,
    ratioValues: ["16:9 — Widescreen", "9:16 — Vertical"],
    durationLabel: "2–10 วินาทีต่อ Generation",
  },
  "Seedance 2.5 (Runway)": {
    model: "Seedance 2.5 (Runway)",
    providerId: "runway",
    durationSeconds: range(4, 30),
    defaultDurationSeconds: 10,
    ratioValues: ["16:9 — Widescreen", "9:16 — Vertical", "1:1 — Square"],
    durationLabel: "4–30 วินาทีต่อ Generation",
  },
  "Gemini Omni Flash 1.1 (Runway)": {
    model: "Gemini Omni Flash 1.1 (Runway)",
    providerId: "runway",
    durationSeconds: range(3, 10),
    defaultDurationSeconds: 5,
    ratioValues: ["16:9 — Widescreen", "9:16 — Vertical"],
    durationLabel: "3–10 วินาทีต่อ Generation",
  },
  "Aleph 2.0 (Runway)": {
    model: "Aleph 2.0 (Runway)",
    providerId: "runway",
    durationSeconds: range(2, 30),
    defaultDurationSeconds: 10,
    ratioValues: ["16:9 — Widescreen", "9:16 — Vertical"],
    durationLabel: "2–30 วินาที · ต้องมีวิดีโอต้นฉบับ",
  },
  "Ruby HDR (Runway)": {
    model: "Ruby HDR (Runway)",
    providerId: "runway",
    durationSeconds: range(1, 30),
    defaultDurationSeconds: 10,
    ratioValues: ["16:9 — Widescreen", "9:16 — Vertical"],
    durationLabel: "1–30 วินาที · ใช้อัตราส่วนจากวิดีโอต้นฉบับ",
  },
  Wan: {
    model: "Wan",
    providerId: "wan",
    durationSeconds: [5, 10],
    defaultDurationSeconds: 5,
    ratioValues: ["16:9 — Widescreen", "9:16 — Vertical", "1:1 — Square"],
    durationLabel: "5 หรือ 10 วินาทีต่อ Generation",
  },
};

export function getVideoUiCapability(model: string) {
  return VIDEO_UI_CAPABILITIES[model] || VIDEO_UI_CAPABILITIES["Seedance 2.5"];
}
