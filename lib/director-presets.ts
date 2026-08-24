export type DirectorPreset = {
  id: string;
  nameTh: string;
  nameEn: string;
  category: "cinematic" | "dialogue" | "action" | "sci-fi" | "emotion" | "horror";
  descriptionTh: string;
  shotSequence: Array<{ shotType: string; angle: string; lensMm: number; movement: string; weight: number }>;
  motionGuidance: string;
  lightingGuidance: string;
  promptAddendum: string;
};

export const DIRECTOR_PRESETS: DirectorPreset[] = [
  {
    id: "cinematic-walk",
    nameTh: "เดินแบบภาพยนตร์",
    nameEn: "Cinematic Walk",
    category: "cinematic",
    descriptionTh: "เริ่มด้วยภาพกว้าง ติดตามตัวละคร แล้วค่อยเข้าใกล้เพื่อสร้างความผูกพัน เหมาะกับฉากเดินทางหรือเปิดเรื่อง",
    shotSequence: [
      { shotType: "Wide Shot", angle: "Rear View", lensMm: 24, movement: "Dolly", weight: 0.35 },
      { shotType: "Full Shot", angle: "Three-quarter View", lensMm: 35, movement: "Tracking", weight: 0.4 },
      { shotType: "Close-up", angle: "Eye Level", lensMm: 85, movement: "Push-in", weight: 0.25 },
    ],
    motionGuidance: "natural walking cadence, realistic foot placement, subtle secondary clothing and hair motion",
    lightingGuidance: "motivated environmental light with consistent direction across the shot sequence",
    promptAddendum: "Use restrained, observational cinematic pacing and maintain spatial continuity between cuts.",
  },
  {
    id: "conversation",
    nameTh: "บทสนทนาภาพยนตร์",
    nameEn: "Dialogue Coverage",
    category: "dialogue",
    descriptionTh: "วาง Two Shot, Over-the-Shoulder, Close-up และ Reaction ให้บทสนทนาดูเป็นหนังและไม่สลับผู้พูด",
    shotSequence: [
      { shotType: "Medium Shot", angle: "Eye Level", lensMm: 50, movement: "Static", weight: 0.25 },
      { shotType: "Over-the-Shoulder", angle: "Three-quarter View", lensMm: 65, movement: "Static", weight: 0.25 },
      { shotType: "Close-up", angle: "Eye Level", lensMm: 85, movement: "Push-in", weight: 0.3 },
      { shotType: "Close-up", angle: "Eye Level", lensMm: 85, movement: "Static", weight: 0.2 },
    ],
    motionGuidance: "natural blinking, subtle eye lines, restrained head movement, listening reactions while the other character speaks",
    lightingGuidance: "consistent key/fill direction and matching exposure across reverse angles",
    promptAddendum: "Keep speaker identity exact. Use reaction shots and matched eye lines. Never swap voices or dialogue ownership.",
  },
  {
    id: "action-chase",
    nameTh: "ฉากไล่ล่า",
    nameEn: "Action Chase",
    category: "action",
    descriptionTh: "สำหรับวิ่ง ไล่ล่า รถ หรือ Parkour เน้นอ่านทิศทางการเคลื่อนไหวชัด ไม่สั่นกล้องจนดูไม่รู้เรื่อง",
    shotSequence: [
      { shotType: "Wide Shot", angle: "Low Angle", lensMm: 24, movement: "Tracking", weight: 0.25 },
      { shotType: "Full Shot", angle: "Side View", lensMm: 28, movement: "Tracking", weight: 0.3 },
      { shotType: "Medium Shot", angle: "Three-quarter View", lensMm: 35, movement: "Dolly", weight: 0.25 },
      { shotType: "Wide Shot", angle: "Rear View", lensMm: 24, movement: "Pull-out", weight: 0.2 },
    ],
    motionGuidance: "readable acceleration, grounded footfalls, believable momentum, clear direction of travel, controlled motion blur",
    lightingGuidance: "preserve light direction at speed and keep silhouettes readable from the background",
    promptAddendum: "Prioritize readable geography and continuity of screen direction. Avoid random cuts, teleporting or impossible acceleration.",
  },
  {
    id: "martial-fight",
    nameTh: "ต่อสู้ระยะประชิด",
    nameEn: "Martial Arts Fight",
    category: "action",
    descriptionTh: "เน้นเห็นท่าต่อสู้เต็มตัว แรงปะทะ และตำแหน่งคู่ต่อสู้ชัดเจน โดยไม่ตัดเร็วเกินไป",
    shotSequence: [
      { shotType: "Wide Shot", angle: "Eye Level", lensMm: 28, movement: "Tracking", weight: 0.45 },
      { shotType: "Medium Shot", angle: "Low Angle", lensMm: 35, movement: "Dolly", weight: 0.25 },
      { shotType: "Close-up", angle: "Three-quarter View", lensMm: 65, movement: "Push-in", weight: 0.15 },
      { shotType: "Wide Shot", angle: "Side View", lensMm: 28, movement: "Static", weight: 0.15 },
    ],
    motionGuidance: "anatomically believable strikes, blocks and recovery, stable feet, realistic balance, readable contact timing",
    lightingGuidance: "strong edge separation and readable body silhouettes",
    promptAddendum: "Show complete choreography with consistent fighter positions. Do not add extra limbs or morph bodies during impacts.",
  },
  {
    id: "mecha-battle",
    nameTh: "สงครามหุ่นยนต์ Mecha",
    nameEn: "Mecha Battle",
    category: "sci-fi",
    descriptionTh: "เหมาะกับหุ่นยักษ์ สนามรบ Sci-Fi และเครื่องจักรหนัก เน้นน้ำหนัก สเกล และกล้องมุมต่ำ",
    shotSequence: [
      { shotType: "Extreme Wide Shot", angle: "Low Angle", lensMm: 18, movement: "Crane", weight: 0.25 },
      { shotType: "Full Shot", angle: "Extreme Low Angle", lensMm: 24, movement: "Tracking", weight: 0.3 },
      { shotType: "Insert Shot", angle: "Three-quarter View", lensMm: 65, movement: "Push-in", weight: 0.15 },
      { shotType: "Wide Shot", angle: "Side View", lensMm: 28, movement: "Tracking", weight: 0.3 },
    ],
    motionGuidance: "heavy mechanical inertia, delayed secondary panel motion, hydraulic compression, grounded impacts, realistic debris reaction",
    lightingGuidance: "large-scale directional light, volumetric atmosphere, practical emissive technology accents",
    promptAddendum: "Maintain exact mechanical design and scale. Joints, armor panels, insignia and weapon placements must not redesign between shots.",
  },
  {
    id: "space-reveal",
    nameTh: "เปิดเผยโลกอวกาศ",
    nameEn: "Space Reveal",
    category: "sci-fi",
    descriptionTh: "เปิดฉากยาน ดาวเคราะห์ หรือสถานีอวกาศแบบมหากาพย์ด้วยการเคลื่อนกล้องช้าและสเกลใหญ่",
    shotSequence: [
      { shotType: "Extreme Wide Shot", angle: "Eye Level", lensMm: 24, movement: "Pull-out", weight: 0.5 },
      { shotType: "Wide Shot", angle: "Low Angle", lensMm: 35, movement: "Lateral Slide", weight: 0.3 },
      { shotType: "Insert Shot", angle: "Eye Level", lensMm: 85, movement: "Push-in", weight: 0.2 },
    ],
    motionGuidance: "slow large-scale parallax, controlled spacecraft drift, physically coherent relative motion",
    lightingGuidance: "single dominant stellar light source with coherent rim light and deep space shadow",
    promptAddendum: "Emphasize scale through parallax, tiny environmental reference points and restrained camera movement.",
  },
  {
    id: "suspense-reveal",
    nameTh: "ลึกลับค่อย ๆ เปิดเผย",
    nameEn: "Suspense Reveal",
    category: "horror",
    descriptionTh: "ใช้ Foreground บังบางส่วน Slow Push-in และ POV เพื่อสร้างความสงสัยโดยไม่ต้องใช้กล้องสั่น",
    shotSequence: [
      { shotType: "Wide Shot", angle: "Eye Level", lensMm: 35, movement: "Static", weight: 0.3 },
      { shotType: "Medium Shot", angle: "Three-quarter View", lensMm: 50, movement: "Lateral Slide", weight: 0.25 },
      { shotType: "Close-up", angle: "Eye Level", lensMm: 85, movement: "Push-in", weight: 0.25 },
      { shotType: "POV", angle: "Eye Level", lensMm: 50, movement: "Dolly", weight: 0.2 },
    ],
    motionGuidance: "small controlled body reactions, pauses, delayed reveals, subtle eye movement",
    lightingGuidance: "motivated low-key or natural contrast, readable shadow detail, controlled practical highlights",
    promptAddendum: "Build tension through composition, occlusion, pauses and eye lines rather than chaotic camera motion.",
  },
];
