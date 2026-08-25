import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type LibraryKind = "images" | "voices" | "characters" | "pets" | "ambience" | "plots";
export type LibraryMetadata = {
  visualLanguage?: string;
  lighting?: string;
  colorMood?: string;
  bestFor?: string;
  promptHint?: string;
  referenceUsage?: string;
  compatibility?: string;
  lockNote?: string;
  role?: string;
  genderPresentation?: string;
  ageRange?: string;
  appearance?: string;
  personality?: string;
  costume?: string;
  voiceProfile?: string;
  emotionRange?: string;
  performanceStyle?: string;
  negativeIdentityRules?: string;
  referenceImages?: string[];
};
export type LibraryAssetRecord = {
  id: string;
  kind: LibraryKind;
  title: string;
  description: string;
  assetUrl?: string;
  source: "SYSTEM" | "ADMIN";
  metadata?: LibraryMetadata;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type DbLibraryAsset = {
  id: string;
  kind: string;
  title: string;
  description: string;
  assetUrl: string | null;
  source: string;
  metadata: Prisma.JsonValue | null;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

const SYSTEM_ASSETS: Array<Omit<LibraryAssetRecord, "createdAt" | "updatedAt" | "active">> = [
  { id: "anime", kind: "images", title: "Cinematic Anime", description: "อนิเมะภาพยนตร์ แสงมีมิติ เหมาะกับเรื่องเล่า Coming-of-age และ Fantasy", assetUrl: "/library/styles/cinematic-anime.png", source: "SYSTEM", sortOrder: 10, metadata: { visualLanguage: "อนิเมะภาพยนตร์ที่ใช้มุมกล้องและองค์ประกอบแบบหนังจริง เส้นสะอาด ฉากมีมิติ และเน้นอารมณ์ของตัวละคร", lighting: "แสงนุ่มแบบภาพยนตร์ มี Rim Light และแสงบรรยากาศช่วยแยกตัวละครออกจากฉาก", colorMood: "สีสดแต่คุมโทน อบอุ่นและมี Highlight ชัด", bestFor: "Anime, Coming-of-age, Fantasy, Romance และเรื่องเล่าที่เน้นอารมณ์", promptHint: "cinematic anime, expressive character acting, dimensional background, controlled film lighting", referenceUsage: "ใช้เป็น Style Reference เพื่อคุมโทนทั้ง Production หรือ Image Reference เฉพาะ Scene" } },
  { id: "golden", kind: "images", title: "Warm Golden Hour", description: "แสงเย็นสีทอง อบอุ่น นุ่ม เหมาะกับ Romance, Slice of Life และฉากความทรงจำ", assetUrl: "/library/styles/warm-golden-hour.png", source: "SYSTEM", sortOrder: 20, metadata: { visualLanguage: "ภาพเน้นความอบอุ่น ความทรงจำ และความใกล้ชิด ใช้แสงอาทิตย์ต่ำสร้างมิติและเงายาว", lighting: "Golden Hour / Backlight / Soft Flare แสงอุ่นจากด้านหลังหรือด้านข้าง", colorMood: "ทอง ส้ม น้ำตาลอ่อน และ Skin Tone อบอุ่น", bestFor: "Romance, Slice of Life, Family, Memory และ Emotional Scene", promptHint: "warm golden-hour sunlight, soft backlight, natural atmosphere, gentle contrast", referenceUsage: "ใช้เป็น Style Reference หรือภาพอ้างอิงเฉพาะ Scene ได้" } },
  { id: "real", kind: "images", title: "Photorealistic Film", description: "ภาพสมจริงแบบภาพยนตร์ ผิว วัสดุ และแสงเป็นธรรมชาติ", assetUrl: "/library/styles/photorealistic-film.png", source: "SYSTEM", sortOrder: 30, metadata: { visualLanguage: "ภาพสมจริงแบบกองถ่ายภาพยนตร์ เน้นผิว วัสดุ สภาพอากาศ และ Depth ที่เป็นธรรมชาติ", lighting: "Motivated Lighting เลียนแบบแหล่งแสงจริงในฉาก พร้อม Contrast แบบฟิล์ม", colorMood: "Natural Film Color, Skin Tone สมจริง และ Saturation พอดี", bestFor: "Drama, Commercial, Documentary-style, Thriller และงานสมจริง", promptHint: "photorealistic cinematic film, natural skin texture, realistic materials, motivated lighting", referenceUsage: "เหมาะเป็น Style Reference หลักสำหรับงานสมจริง" } },
  { id: "action", kind: "images", title: "Action Blockbuster", description: "ภาพพลังงานสูง คอนทราสต์แรง เหมาะกับ Chase, Combat และฉากแอ็กชันขนาดใหญ่", assetUrl: "/library/styles/action-blockbuster.png", source: "SYSTEM", sortOrder: 40, metadata: { visualLanguage: "ภาพพลังงานสูง มี Perspective แรง การเคลื่อนไหวชัด และองค์ประกอบนำสายตาไปยังเหตุการณ์หลัก", lighting: "Hard Light, Practical Explosion Light และ Contrast สูง", colorMood: "ดำ เทา ส้มไฟ และโทนเย็นตัดร้อน", bestFor: "Action, Chase, Combat, Disaster และ Hero Moment", promptHint: "high-energy blockbuster action, dynamic camera perspective, debris and motion, dramatic contrast", referenceUsage: "ใช้คุมภาษาภาพและพลังงานของฉากแอ็กชัน" } },
  { id: "scifi", kind: "images", title: "Sci-Fi Neon", description: "เมืองอนาคต เทคโนโลยี แสงนีออน และโครงสร้างล้ำยุค", assetUrl: "/library/styles/sci-fi-neon.png", source: "SYSTEM", sortOrder: 50, metadata: { visualLanguage: "สถาปัตยกรรมอนาคต เทคโนโลยีซับซ้อน เส้นนำสายตา และ Scale ขนาดใหญ่", lighting: "Neon, Holographic Light, Volumetric Glow และแสงเมืองอนาคต", colorMood: "น้ำเงิน Cyan ม่วง และ Accent สีสดบนพื้นมืด", bestFor: "Sci-Fi, Cyberpunk, Space Opera, AI World และ Future City", promptHint: "futuristic cinematic city, advanced architecture, holographic interfaces, neon accent lighting", referenceUsage: "ใช้เป็น Visual Style หลักของโลกอนาคต" } },
  { id: "fantasy", kind: "images", title: "Fantasy Storybook", description: "โลกแฟนตาซีขนาดใหญ่ แสงเหนือจริง และภูมิทัศน์มหัศจรรย์", assetUrl: "/library/styles/fantasy-storybook.png", source: "SYSTEM", sortOrder: 60, metadata: { visualLanguage: "โลกแฟนตาซีขนาดใหญ่ เน้นภูมิประเทศ สถาปัตยกรรมมหัศจรรย์ และความรู้สึก Epic", lighting: "God Rays, Atmospheric Light และแสงเหนือจริงที่ยังรักษาทิศทางชัด", colorMood: "เขียว น้ำเงิน ทอง และสีธรรมชาติที่มี Magical Accent", bestFor: "Epic Fantasy, Adventure, Creature, Quest และ Storybook", promptHint: "epic fantasy kingdom, vast landscape, magical atmospheric light, detailed architecture", referenceUsage: "ใช้เป็น Style Reference สำหรับโลกแฟนตาซีและฉากกว้าง" } },
  { id: "thriller", kind: "images", title: "Dark Thriller", description: "ตรอกกลางคืนเปียกฝน แสงน้อย คอนทราสต์จัด เหมาะกับ Crime, Noir และ Suspense", assetUrl: "/library/styles/dark-thriller.png", source: "SYSTEM", sortOrder: 70, metadata: { visualLanguage: "ภาพกดดันแบบ Noir ใช้พื้นที่มืด Negative Space และมุมมองที่ทำให้ผู้ชมรู้สึกไม่ปลอดภัย", lighting: "Low-key Lighting, Street Practical, Reflection บนพื้นเปียก และแสงเฉียง", colorMood: "ดำ เทา เขียวอมฟ้า มีแดงหรือส้มเป็น Accent เล็กน้อย", bestFor: "Crime, Mystery, Noir, Suspense และ Psychological Thriller", promptHint: "dark cinematic thriller, rain-soaked street, low-key lighting, deep shadows", referenceUsage: "ใช้คุม Mood, Contrast และภาษาภาพของ Thriller" } },
  { id: "gothic", kind: "images", title: "Gothic Horror", description: "คฤหาสน์โกธิก หมอกกลางคืน และโทนเย็นลึกลับ เหมาะกับ Horror และ Dark Fantasy", assetUrl: "/library/styles/gothic-horror.png", source: "SYSTEM", sortOrder: 80, metadata: { visualLanguage: "สถาปัตยกรรมโกธิก เงารูปทรงใหญ่ หมอก และองค์ประกอบที่ให้ความรู้สึกโดดเดี่ยว", lighting: "Moonlight, Fog Diffusion, Window Practical และแสงเย็นความเข้มต่ำ", colorMood: "น้ำเงินดำ เทา และทองหม่นจากหน้าต่าง", bestFor: "Gothic Horror, Supernatural, Dark Fantasy และ Haunted Location", promptHint: "gothic mansion, moonlit fog, ominous silhouette, cold cinematic palette", referenceUsage: "ใช้คุมโลกและบรรยากาศ Horror / Dark Fantasy" } },
  { id: "romance", kind: "images", title: "Cinematic Romance", description: "โทนอุ่นยามอาทิตย์ตก ชัดตื้น และอารมณ์ใกล้ชิด เหมาะกับ Romance และ Emotional Drama", assetUrl: "/library/styles/cinematic-romance.png", source: "SYSTEM", sortOrder: 90, metadata: { visualLanguage: "ภาพใกล้ชิด เน้นใบหน้า Eye Line และภาษากาย ใช้ Depth ตื้นเพื่อแยกคู่ตัวละครจากฉาก", lighting: "Soft Sunset Light, Beauty Light และ Backlight บาง ๆ รอบเส้นผม", colorMood: "ส้มชมพู น้ำตาลอุ่น และ Skin Tone นุ่ม", bestFor: "Romance, Relationship, Wedding, Emotional Drama และ Intimate Scene", promptHint: "intimate cinematic romance, soft sunset light, shallow depth of field, subtle expression", referenceUsage: "ใช้คุมโทนอารมณ์และความใกล้ชิดของฉากความสัมพันธ์" } },
  { id: "period", kind: "images", title: "Period Drama", description: "งานย้อนยุคหรูหรา เครื่องแต่งกายและสถาปัตยกรรมละเอียด เหมาะกับ Historical และ Costume Film", assetUrl: "/library/styles/period-drama.png", source: "SYSTEM", sortOrder: 100, metadata: { visualLanguage: "ภาพย้อนยุคที่เน้น Production Design เครื่องแต่งกาย วัสดุ และสถาปัตยกรรมตามยุค", lighting: "Natural Window Light, Candle / Practical และ Soft Directional Light", colorMood: "ทอง ครีม น้ำเงินเข้ม และสีผ้าหรูที่ Saturation คุมไว้", bestFor: "Historical Drama, Royal Drama, Costume Film และ Period Romance", promptHint: "period cinematic drama, historically inspired costume, ornate architecture, natural period lighting", referenceUsage: "ใช้เป็น Style Reference สำหรับ Production ย้อนยุค" } },
  { id: "voice-mira", kind: "voices", title: "Mira", description: "หญิง • อบอุ่น • เป็นธรรมชาติ", source: "SYSTEM", sortOrder: 10 },

  { id: "char-starter", kind: "characters", title: "Female Cinematic", description: "ตัวละครหญิงสมจริงสำหรับ Drama / Commercial พร้อมโครง Character Bible สำหรับนำไปปรับต่อ", source: "SYSTEM", sortOrder: 10, metadata: { role: "Protagonist — ตัวละครหลัก", genderPresentation: "Female — หญิง", ageRange: "Adult 22–35", appearance: "ใบหน้าจดจำง่าย สัดส่วนสมจริง ทรงผมร่วมสมัย รูปร่างสมส่วน และมี Silhouette ที่อ่านง่ายในทุกระยะภาพ", personality: "อบอุ่น มั่นใจ สังเกตเก่ง แสดงอารมณ์อย่างเป็นธรรมชาติ", costume: "Contemporary cinematic wardrobe — เสื้อผ้าร่วมสมัยโทนกลาง ปรับสีได้ตามเรื่อง", voiceProfile: "Mira", emotionRange: "Neutral, Warm, Happy, Concerned, Sad, Determined", performanceStyle: "Natural / Restrained cinematic acting", bestFor: "Drama, Romance, Commercial, Slice of Life", promptHint: "cinematic adult female character, memorable facial identity, natural proportions, consistent hairstyle and facial features, realistic skin texture", negativeIdentityRules: "ห้ามเปลี่ยนรูปหน้า อายุโดยประมาณ สีตา ทรงผมหลัก และสัดส่วนร่างกายโดยไม่มีเหตุผลในเรื่อง", referenceUsage: "ใช้ Main Reference เป็น Character Identity หลัก และเพิ่ม Front / 3/4 / Side / Full Body / Expression เพื่อเพิ่มความแม่นยำ", lockNote: "แนะนำเปิด Character Lock + Costume Lock + Voice Lock เมื่อนำไปใช้ใน Production" } },
  { id: "char-male-cinematic", kind: "characters", title: "Male Cinematic", description: "ตัวละครชายสมจริงสำหรับ Drama / Action / Commercial เน้นใบหน้าและสัดส่วนที่คงที่", source: "SYSTEM", sortOrder: 20, metadata: { role: "Protagonist / Supporting", genderPresentation: "Male — ชาย", ageRange: "Adult 25–40", appearance: "ใบหน้าคมแบบภาพยนตร์ รูปร่างสมจริง รายละเอียดผิวและเส้นผมเป็นธรรมชาติ", personality: "สุขุม มั่นคง มี Presence และตอบสนองอารมณ์แบบไม่โอเวอร์", costume: "Modern cinematic wardrobe — เสื้อเชิ้ต แจ็กเก็ต หรือชุด Casual/Professional", voiceProfile: "Arin", emotionRange: "Neutral, Calm, Tense, Angry, Sad, Determined", performanceStyle: "Grounded / Natural", bestFor: "Drama, Action, Detective, Commercial", promptHint: "cinematic adult male character, stable facial identity, realistic body proportions, natural skin and hair detail", negativeIdentityRules: "ห้ามเปลี่ยนรูปหน้า ทรงผม โครงร่าง และช่วงอายุโดยไม่ตั้งใจ", referenceUsage: "เพิ่ม Full Body และ Side View หากมีฉาก Action หรือการเคลื่อนไหวมาก", lockNote: "แนะนำ Character Lock + Voice Lock; Costume Lock เปิดเมื่อฉากต่อเนื่อง" } },
  { id: "char-anime-heroine", kind: "characters", title: "Anime Heroine", description: "ตัวละครอนิเมะหญิงสำหรับ Coming-of-age / Fantasy / Romance เน้น Expression ที่อ่านชัด", source: "SYSTEM", sortOrder: 30, metadata: { role: "Heroine / Protagonist", genderPresentation: "Female — หญิง", ageRange: "Teen / Young Adult", appearance: "รูปหน้าสไตล์อนิเมะภาพยนตร์ ดวงตาแสดงอารมณ์ชัด ทรงผมมีรูปทรงจำง่าย และสัดส่วนคงที่", personality: "สดใส อ่อนไหว กล้าตัดสินใจเมื่อถึงจุดสำคัญ", costume: "School / Casual / Fantasy Outfit ตาม Production", voiceProfile: "Nami", emotionRange: "Neutral, Happy, Shy, Sad, Angry, Fear, Surprise", performanceStyle: "Expressive cinematic anime", bestFor: "Anime, Coming-of-age, Fantasy, Romance", promptHint: "cinematic anime heroine, stable face design, expressive eyes, consistent hairstyle silhouette, clean costume continuity", negativeIdentityRules: "ห้ามเปลี่ยนสีตา ทรงผม รูปหน้า และ Style ของตัวละครระหว่าง Shot", referenceUsage: "ควรมี Expression Sheet และ 3/4 View เพื่อช่วยรักษาหน้าในมุมต่าง ๆ", lockNote: "Character Lock และ Style Lock สำคัญมากสำหรับอนิเมะหลาย Scene" } },
  { id: "char-anime-hero", kind: "characters", title: "Anime Hero", description: "ตัวละครอนิเมะชายสำหรับ Adventure / Action / School / Fantasy พร้อมแนวทางรักษาเอกลักษณ์", source: "SYSTEM", sortOrder: 40, metadata: { role: "Hero / Protagonist", genderPresentation: "Male — ชาย", ageRange: "Teen / Young Adult", appearance: "ทรงผมมี Silhouette ชัด รูปหน้าและดวงตาคงที่ สัดส่วนอนิเมะภาพยนตร์", personality: "มุ่งมั่น เป็นมิตร มีพลัง และพัฒนาอารมณ์ได้ชัดเจน", costume: "School / Adventure / Hero Outfit", voiceProfile: "Kai", emotionRange: "Neutral, Happy, Determined, Angry, Fear, Exhausted", performanceStyle: "Energetic / Expressive", bestFor: "Anime, Adventure, Action, School, Fantasy", promptHint: "cinematic anime male hero, consistent facial design, recognizable hair silhouette, expressive controlled acting", negativeIdentityRules: "ห้ามเปลี่ยนทรงผม สีตา รูปหน้า และสัดส่วนตัวละคร", referenceUsage: "เพิ่ม Full Body และ Action Pose หากมีฉากต่อสู้หรือวิ่ง", lockNote: "Character Lock + Style Lock + Costume Lock ช่วยลด Character Drift" } },
  { id: "char-child", kind: "characters", title: "Child Character", description: "ตัวละครเด็กสำหรับ Family / Adventure / Fantasy โดยเน้นสัดส่วนและอายุให้คงที่", source: "SYSTEM", sortOrder: 50, metadata: { role: "Child / Supporting / Protagonist", genderPresentation: "Flexible — ปรับได้", ageRange: "Child 7–12", appearance: "สัดส่วนเด็กตามวัย ใบหน้าอ่อนเยาว์ การแต่งกายเรียบง่ายและอ่านชัด", personality: "อยากรู้อยากเห็น เป็นธรรมชาติ แสดง Reaction ชัดแต่ไม่โอเวอร์", costume: "Family / School / Adventure wardrobe", voiceProfile: "Lumi", emotionRange: "Curious, Happy, Fear, Sad, Surprise, Brave", performanceStyle: "Natural child performance", bestFor: "Family, Adventure, Fantasy, Coming-of-age", promptHint: "age-consistent child character, natural child proportions, stable facial identity, family-friendly cinematic performance", negativeIdentityRules: "ห้ามทำให้อายุ รูปร่าง หรือสัดส่วนเปลี่ยนเป็นวัยรุ่น/ผู้ใหญ่โดยไม่ตั้งใจ", referenceUsage: "ควรมี Full Body เพราะสัดส่วนตามวัยสำคัญต่อความต่อเนื่อง", lockNote: "Character Lock ต้องรักษา Age Range และ Body Proportion เป็น Hard Constraint" } },
  { id: "char-senior", kind: "characters", title: "Senior Character", description: "ตัวละครสูงวัยสำหรับ Mentor / Historical / Family เน้นรายละเอียดใบหน้าและวัยที่คงที่", source: "SYSTEM", sortOrder: 60, metadata: { role: "Mentor / Elder / Supporting", genderPresentation: "Flexible — ปรับได้", ageRange: "Senior 60–80", appearance: "รายละเอียดริ้วรอยตามวัย เส้นผมและโครงหน้าจำง่าย ท่าทางมีน้ำหนัก", personality: "สุขุม น่าเชื่อถือ มีประสบการณ์ และมีจังหวะการแสดงชัด", costume: "Classic / Historical / Family wardrobe", voiceProfile: "Orin", emotionRange: "Calm, Warm, Concerned, Stern, Sad, Wise", performanceStyle: "Measured / Restrained", bestFor: "Family, Historical, Mentor, Drama", promptHint: "senior cinematic character, age-consistent facial details, stable wrinkles and hair, dignified natural performance", negativeIdentityRules: "ห้ามลดอายุ เปลี่ยนริ้วรอยหลัก หรือเปลี่ยนสี/รูปทรงผมโดยไม่มีเหตุผล", referenceUsage: "Front + 3/4 + Side ช่วยรักษาโครงหน้าและอายุได้ดี", lockNote: "Character Lock ควรรวม Age Detail เป็นส่วนหนึ่งของ Identity" } },
  { id: "char-scifi", kind: "characters", title: "Sci-Fi Character", description: "ตัวละครมนุษย์/ไซบอร์กสำหรับ Sci-Fi และ Cyberpunk พร้อมรายละเอียดเทคโนโลยีที่ต้องล็อกต่อเนื่อง", source: "SYSTEM", sortOrder: 70, metadata: { role: "Agent / Pilot / Scientist / Hero", genderPresentation: "Flexible — ปรับได้", ageRange: "Adult 20–45", appearance: "รูปลักษณ์มนุษย์สมจริงผสมอุปกรณ์ไซเบอร์ จุดแสงหรือชิ้นส่วนเทคโนโลยีมีตำแหน่งตายตัว", personality: "แม่นยำ สุขุม มีความเป็นมืออาชีพ หรือปรับไปทาง Rebel ได้", costume: "Techwear / Flight Suit / Cybernetic Armor", voiceProfile: "Astra AI / Arin / Vela", emotionRange: "Neutral, Focused, Tense, Determined, Shock", performanceStyle: "Controlled sci-fi cinematic", bestFor: "Sci-Fi, Cyberpunk, Space, AI World", promptHint: "cinematic sci-fi character, consistent cybernetic details, fixed tech placement, stable facial identity and costume design", negativeIdentityRules: "ห้ามย้ายตำแหน่งชิ้นส่วนไซเบอร์ ลายชุด สี Accent และรายละเอียดใบหน้าระหว่าง Scene", referenceUsage: "Full Body สำคัญเพื่อรักษา Costume/Armor และตำแหน่งอุปกรณ์", lockNote: "Character + Costume + Prop Lock ควรเปิดพร้อมกัน" } },
  { id: "char-fantasy", kind: "characters", title: "Fantasy Character", description: "ตัวละครแฟนตาซีสำหรับ Adventure / Quest / Dark Fantasy พร้อมชุดและเอกลักษณ์ที่ล็อกได้", source: "SYSTEM", sortOrder: 80, metadata: { role: "Warrior / Mage / Royal / Adventurer", genderPresentation: "Flexible — ปรับได้", ageRange: "Young Adult / Adult", appearance: "ใบหน้าและสัดส่วนมนุษย์หรือแฟนตาซี จุดเด่นเช่นหู เครื่องหมาย เวทมนตร์ หรือสีตาต้องกำหนดชัด", personality: "กล้าหาญ ลึกลับ สุขุม หรือสง่างามตามบท", costume: "Fantasy armor / Robe / Royal costume", voiceProfile: "Nyx Character / Narrator Epic", emotionRange: "Neutral, Heroic, Fear, Rage, Grief, Wonder", performanceStyle: "Cinematic fantasy / Heroic", bestFor: "Fantasy, Adventure, Quest, Dark Fantasy", promptHint: "cinematic fantasy character, stable facial identity, consistent magical markings, detailed costume continuity, heroic readable silhouette", negativeIdentityRules: "ห้ามเปลี่ยนสีตา เครื่องหมายแฟนตาซี อาวุธหลัก รูปทรงชุด และรายละเอียดใบหน้า", referenceUsage: "เพิ่ม Costume Reference + Full Body + Prop Reference หากมีอาวุธหรือเครื่องประดับสำคัญ", lockNote: "Character + Costume + Prop + Canon Lock เหมาะกับงานแฟนตาซีหลาย Episode" } },

  { id: "pet-cat", kind: "pets", title: "แมว", description: "สัตว์เลี้ยงสำหรับเรื่องทั่วไป", source: "SYSTEM", sortOrder: 10 },
  { id: "amb-rain", kind: "ambience", title: "ฝนตก", description: "เสียงฝนและบรรยากาศเมืองเปียก", source: "SYSTEM", sortOrder: 10 },
  { id: "plot-mystery", kind: "plots", title: "พบสิ่งมีชีวิตลึกลับ", description: "พล็อตมิตรภาพแฟนตาซีสำหรับ Short Film", source: "SYSTEM", sortOrder: 10 },
];

function toRecord(row: DbLibraryAsset): LibraryAssetRecord {
  return {
    id: row.id,
    kind: row.kind as LibraryKind,
    title: row.title,
    description: row.description,
    assetUrl: row.assetUrl || undefined,
    source: row.source === "SYSTEM" ? "SYSTEM" : "ADMIN",
    metadata: (row.metadata || undefined) as LibraryMetadata | undefined,
    active: row.active,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function ensureSystemLibraryAssets() {
  for (const asset of SYSTEM_ASSETS) {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "LibraryAsset" ("id","kind","title","description","assetUrl","source","metadata","active","sortOrder","createdAt","updatedAt")
      VALUES (${asset.id}, ${asset.kind}, ${asset.title}, ${asset.description}, ${asset.assetUrl || null}, ${asset.source}, ${JSON.stringify(asset.metadata || {})}::jsonb, true, ${asset.sortOrder}, NOW(), NOW())
      ON CONFLICT ("id") DO UPDATE SET
        "kind" = EXCLUDED."kind",
        "title" = EXCLUDED."title",
        "description" = EXCLUDED."description",
        "assetUrl" = EXCLUDED."assetUrl",
        "source" = EXCLUDED."source",
        "metadata" = EXCLUDED."metadata",
        "sortOrder" = EXCLUDED."sortOrder",
        "updatedAt" = NOW()
    `);
  }
}

export async function listLibraryAssets(options: { includeInactive?: boolean } = {}) {
  await ensureSystemLibraryAssets();
  const rows = await prisma.$queryRaw<DbLibraryAsset[]>(Prisma.sql`
    SELECT "id","kind","title","description","assetUrl","source","metadata","active","sortOrder","createdAt","updatedAt"
    FROM "LibraryAsset"
    ${options.includeInactive ? Prisma.empty : Prisma.sql`WHERE "active" = true`}
    ORDER BY "kind" ASC, "sortOrder" ASC, "createdAt" DESC
  `);
  return rows.map(toRecord);
}

export async function createLibraryAsset(input: { kind: LibraryKind; title: string; description: string; assetUrl?: string; metadata?: LibraryMetadata }) {
  const id = `lib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const rows = await prisma.$queryRaw<DbLibraryAsset[]>(Prisma.sql`
    INSERT INTO "LibraryAsset" ("id","kind","title","description","assetUrl","source","metadata","active","sortOrder","createdAt","updatedAt")
    VALUES (${id}, ${input.kind}, ${input.title}, ${input.description}, ${input.assetUrl || null}, 'ADMIN', ${JSON.stringify(input.metadata || {})}::jsonb, true, 1000, NOW(), NOW())
    RETURNING "id","kind","title","description","assetUrl","source","metadata","active","sortOrder","createdAt","updatedAt"
  `);
  return toRecord(rows[0]);
}

export async function removeLibraryAsset(id: string) {
  const updated = await prisma.$executeRaw(Prisma.sql`UPDATE "LibraryAsset" SET "active" = false, "updatedAt" = NOW() WHERE "id" = ${id} AND "active" = true`);
  return updated > 0;
}

export async function disabledSystemAssetIds() {
  await ensureSystemLibraryAssets();
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "LibraryAsset" WHERE "source" = 'SYSTEM' AND "active" = false`);
  return rows.map((row) => row.id);
}
