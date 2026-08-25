export type ProductionChoice = { value: string; label: string; help: string };

export const SHOT_TYPES: ProductionChoice[] = [
  { value: "AI", label: "AI Suggest — ให้ AI เลือกระยะภาพ", help: "ระบบจะเลือกระยะภาพให้สัมพันธ์กับเหตุการณ์ ตัวละคร และอารมณ์ของ Scene" },
  { value: "Extreme Wide", label: "Extreme Wide — ภาพกว้างมาก", help: "เน้นสถานที่และขนาดของโลก เหมาะกับ Establishing, เมือง, ภูเขา และฉากใหญ่" },
  { value: "Wide", label: "Wide — ภาพกว้าง", help: "เห็นตัวละครเต็มตัวพร้อมสภาพแวดล้อม เหมาะกับการเดิน วิ่ง และ Action" },
  { value: "Full", label: "Full Shot — ภาพเต็มตัว", help: "เห็นท่าทางและร่างกายครบ เหมาะกับ Character Blocking และการเคลื่อนไหว" },
  { value: "Medium", label: "Medium — ภาพครึ่งตัว", help: "สมดุลระหว่างสีหน้าและภาษากาย ใช้ได้ดีใน Dialogue และ Narrative" },
  { value: "Close-up", label: "Close-up — ภาพใกล้", help: "เน้นใบหน้าและอารมณ์ เหมาะกับ Reaction และ Moment สำคัญ" },
  { value: "Extreme Close-up", label: "Extreme Close-up — ภาพใกล้มาก", help: "เน้นรายละเอียด เช่น ดวงตา มือ ปาก หรือ Prop สำคัญ" },
  { value: "POV", label: "POV — มุมมองสายตาตัวละคร", help: "ให้ผู้ชมเห็นเหตุการณ์จากสายตาของตัวละครโดยตรง" },
  { value: "OTS", label: "OTS — มุมข้ามไหล่", help: "เหมาะกับบทสนทนา การเผชิญหน้า และการมองอีกฝ่ายผ่านไหล่ตัวละคร" },
  { value: "Insert Shot", label: "Insert Shot — ภาพแทรกรายละเอียด", help: "ใช้เน้นวัตถุหรือข้อมูลสำคัญ เช่น โทรศัพท์ จดหมาย อาวุธ หรือปุ่มควบคุม" },
];

export const CAMERA_ANGLES: ProductionChoice[] = [
  { value: "AI", label: "AI Suggest — ให้ AI เลือกมุมกล้อง", help: "ระบบจะเลือกมุมกล้องให้เหมาะกับ Scene Objective และอารมณ์" },
  { value: "Eye Level", label: "Eye Level — ระดับสายตา", help: "เป็นธรรมชาติและเป็นกลาง เหมาะกับบทสนทนาและ Scene ทั่วไป" },
  { value: "Low Angle", label: "Low Angle — มุมเงย", help: "กล้องมองขึ้น ทำให้ Subject ดูทรงพลัง เด่น หรือยิ่งใหญ่" },
  { value: "Extreme Low Angle", label: "Extreme Low — ต่ำติดพื้น", help: "เหมาะกับ Action, Creature, Vehicle, Mecha และภาพที่ต้องการ Scale" },
  { value: "High Angle", label: "High Angle — มุมกด", help: "มองลงจากด้านบนเล็กน้อย ทำให้ Subject ดูเล็กหรือเห็นพื้นที่ได้มากขึ้น" },
  { value: "Top View", label: "Top View — มองตรงจากด้านบน", help: "เหมาะกับ Blocking หลายตัวละคร การวางตำแหน่ง และภาพเชิงกราฟิก" },
  { value: "Side View", label: "Side View — มุมด้านข้าง", help: "เหมาะกับ Tracking, การเดิน วิ่ง ต่อสู้ หรือการเคลื่อนขนาน" },
  { value: "Rear View", label: "Rear View — มุมจากด้านหลัง", help: "เหมาะกับ Follow Shot การเดินเข้าสถานที่ใหม่ และการสร้างความรู้สึกร่วมทาง" },
  { value: "Three-quarter", label: "Three-quarter — มุมสามส่วนสี่", help: "เห็นใบหน้าและมิติของร่างกายพร้อมกัน ให้ภาพมีความลึกแบบ Cinematic" },
];

export const LENSES: ProductionChoice[] = [
  { value: "AI", label: "AI Suggest — ให้ AI เลือก Lens", help: "ระบบจะเลือกระยะเลนส์ให้สัมพันธ์กับ Shot Type, พื้นที่ และอารมณ์" },
  { value: "18mm", label: "18mm — Ultra Wide", help: "กว้างมาก เห็น Environment เยอะและ Perspective ชัด เหมาะกับพื้นที่ใหญ่" },
  { value: "24mm", label: "24mm — Cinematic Wide", help: "เหมาะกับ Establishing, Action และภาพที่ต้องเห็นตัวละครพร้อมสถานที่" },
  { value: "28mm", label: "28mm — Natural Wide", help: "ยังคงความกว้างแต่บิดเบี้ยวน้อยลง เหมาะกับ Narrative ที่ต้องเห็นบริบท" },
  { value: "35mm", label: "35mm — Contextual", help: "ใช้งานง่ายมาก เหมาะกับ Movement, Dialogue และ Scene ทั่วไป" },
  { value: "50mm", label: "50mm — Natural Perspective", help: "สัดส่วนใกล้สายตามนุษย์ เหมาะกับ Medium Shot และ Dialogue" },
  { value: "65mm", label: "65mm — Character Focus", help: "แยกตัวละครออกจากฉากหลังมากขึ้น เหมาะกับอารมณ์และ Medium Close-up" },
  { value: "85mm", label: "85mm — Portrait", help: "เหมาะกับ Close-up ใบหน้า ฉากหลังละลาย และการเน้น Emotion" },
  { value: "100mm", label: "100mm — Telephoto", help: "บีบมิติและเน้นรายละเอียด เหมาะกับ Close-up หรือ Subject ที่อยู่ไกล" },
  { value: "Macro", label: "Macro — รายละเอียดระยะใกล้", help: "เหมาะกับดวงตา หยดน้ำ กลไก หรือวัตถุขนาดเล็กมาก" },
];

export const CAMERA_MOVEMENTS: ProductionChoice[] = [
  { value: "AI", label: "AI Suggest — ให้ AI เลือก Movement", help: "ระบบจะเลือกการเคลื่อนกล้องตาม Action, Rhythm และจุดสนใจ" },
  { value: "Static", label: "Static — กล้องนิ่ง", help: "ภาพสงบ มั่นคง เหมาะกับ Dialogue, Tension และ Composition ที่ต้องการความนิ่ง" },
  { value: "Push-in", label: "Push-in — เคลื่อนเข้า", help: "ค่อย ๆ เข้าใกล้ Subject เพื่อเพิ่มอารมณ์ ความคิด หรือการค้นพบ" },
  { value: "Pull-out", label: "Pull-out — ถอยออก", help: "ค่อย ๆ เปิดเผย Environment หรือใช้เป็นจังหวะปิด Scene" },
  { value: "Dolly", label: "Dolly — เลื่อนกล้องนุ่ม", help: "เคลื่อนเป็นเส้นอย่างนุ่มนวล ให้ความรู้สึกภาพยนตร์" },
  { value: "Tracking", label: "Tracking — ติดตามตัวละคร", help: "กล้องเคลื่อนตาม Subject เหมาะกับเดิน วิ่ง ไล่ล่า และสำรวจ" },
  { value: "Pan", label: "Pan — หมุนซ้ายขวา", help: "กล้องอยู่จุดเดิมแต่หมุนตามแนวนอนเพื่อเปลี่ยนจุดสนใจ" },
  { value: "Tilt", label: "Tilt — ก้มเงยขึ้นลง", help: "ใช้ Reveal ความสูงหรือรายละเอียดตามแนวตั้ง" },
  { value: "Crane", label: "Crane — ยกกล้องขึ้นลง", help: "Movement แนวดิ่งขนาดใหญ่ เหมาะกับเปิดหรือปิด Scene และภาพ Scale ใหญ่" },
  { value: "Orbit", label: "Orbit — วนรอบ Subject", help: "เพิ่มพลัง ดราม่า และมิติรอบตัวละครหรือวัตถุ" },
  { value: "Whip Pan", label: "Whip Pan — ปัดกล้องเร็ว", help: "เหมาะกับ Action, Transition และการเปลี่ยนจุดสนใจอย่างรวดเร็ว" },
  { value: "Lateral Slide", label: "Lateral Slide — เลื่อนด้านข้าง", help: "สร้าง Parallax และ Reveal ด้วยการเคลื่อนขนานด้านข้าง" },
  { value: "Handheld", label: "Handheld — ถือกล้อง", help: "เพิ่มความสด ดิบ สมจริง หรือเร่งด่วน เหมาะกับ Action และ Documentary Feel" },
];

export const CAMERA_HEIGHTS: ProductionChoice[] = [
  { value: "AI", label: "AI Suggest — ให้ AI เลือกความสูงกล้อง", help: "ระบบจะเลือก Camera Height ให้สัมพันธ์กับ Shot Type และ Camera Angle" },
  { value: "10 cm", label: "10 cm — ระดับพื้น", help: "เหมาะกับ Creature ตัวเล็ก เท้า ล้อรถ หรือ Extreme Low Angle" },
  { value: "Knee", label: "Knee Level — ระดับเข่า", help: "มุมต่ำที่ยังเห็น Movement ชัด เหมาะกับ Action และ Tracking" },
  { value: "Waist", label: "Waist Level — ระดับเอว", help: "ให้ความรู้สึกมีพลังและติดตามตัวละครได้ดี" },
  { value: "Chest", label: "Chest Level — ระดับอก", help: "เหมาะกับ Medium Shot และ Dialogue ทั่วไป" },
  { value: "Eye", label: "Eye Level Height — ระดับสายตา", help: "ธรรมชาติและเป็นกลางที่สุด" },
  { value: "Above Head", label: "Above Head — เหนือศีรษะ", help: "ช่วยเห็นพื้นที่ ตำแหน่ง และ Blocking ได้ชัดขึ้น" },
];

export const LIGHTING_STYLES: ProductionChoice[] = [
  { value: "AI", label: "AI Suggest — ให้ AI จัดแสง", help: "ระบบจะจัด Lighting ตามเวลา สถานที่ Mood และ Visual Style" },
  { value: "Natural Soft", label: "Natural Soft — แสงธรรมชาตินุ่ม", help: "เหมาะกับ Narrative สมจริง ชีวิตประจำวัน และ Dialogue" },
  { value: "Golden Hour", label: "Golden Hour — แสงทอง", help: "อบอุ่น โรแมนติก มี Rim Light เหมาะกับความทรงจำและช่วงเย็น" },
  { value: "Blue Hour", label: "Blue Hour — แสงฟ้าเย็น", help: "สงบ ลึกลับ เหงา เหมาะกับเมืองยามค่ำหรือก่อนกลางคืน" },
  { value: "Low Key", label: "Low Key — แสงน้อย เงาจัด", help: "เหมาะกับ Thriller, Horror, Noir และ Tension" },
  { value: "High Key", label: "High Key — สว่างนุ่ม", help: "ภาพสว่างสะอาด เหมาะกับ Beauty, Commercial และ Feel Good" },
  { value: "Neon", label: "Neon — แสงนีออน", help: "เหมาะกับ Sci-Fi, Cyberpunk และเมืองกลางคืน" },
  { value: "Volumetric", label: "Volumetric — ลำแสงและหมอก", help: "สร้างมิติในอากาศ เหมาะกับ Fantasy, Epic และ Sci-Fi" },
  { value: "Backlight", label: "Backlight — ย้อนแสง", help: "สร้างขอบแสง Rim และ Silhouette เพื่อแยก Subject จากพื้นหลัง" },
  { value: "Overcast", label: "Overcast — ฟ้าครึ้ม", help: "แสงกระจายไม่มีเงาแข็ง เหมาะกับ Drama, Rain และ Realism" },
];

export const FOCUS_OPTIONS: ProductionChoice[] = [
  { value: "Auto Subject", label: "Auto Subject — โฟกัสตัวแบบหลัก", help: "ยึด Subject หลักเป็นจุดโฟกัสตลอด Shot" },
  { value: "Rack Focus", label: "Rack Focus — ย้ายจุดโฟกัส", help: "เปลี่ยนโฟกัสจาก Subject หนึ่งไปอีก Subject เพื่อพาความสนใจ" },
  { value: "Deep Focus", label: "Deep Focus — ชัดหลายระยะ", help: "เก็บรายละเอียดหน้า กลาง และหลัง เหมาะกับ Blocking และ Environment" },
];

export const DOF_OPTIONS: ProductionChoice[] = [
  { value: "Natural", label: "Natural DOF — ความชัดธรรมชาติ", help: "ชัดตื้นปานกลาง ใช้ง่ายกับ Narrative ทั่วไป" },
  { value: "Shallow", label: "Shallow DOF — ฉากหลังละลาย", help: "แยกตัวละครจากฉากหลัง เหมาะกับ Portrait และ Emotion" },
  { value: "Deep", label: "Deep DOF — ชัดลึก", help: "เห็น Environment ชัด เหมาะกับ Blocking และฉากที่มีข้อมูลหลายระยะ" },
];

export const COMPOSITION_OPTIONS: ProductionChoice[] = [
  { value: "Rule of Thirds", label: "Rule of Thirds — กฎสามส่วน", help: "วาง Subject ตามจุดตัดเพื่อให้ภาพสมดุลและเป็นธรรมชาติ" },
  { value: "Centered", label: "Centered — จัดกึ่งกลาง", help: "ให้ความรู้สึกมั่นคง สมมาตร กดดัน หรือเป็นทางการ" },
  { value: "Leading Lines", label: "Leading Lines — เส้นนำสายตา", help: "ใช้ถนน สถาปัตยกรรม หรือวัตถุพาสายตาไปยัง Subject" },
  { value: "Negative Space", label: "Negative Space — พื้นที่ว่าง", help: "สร้างความโดดเดี่ยว ความลึกลับ หรือเผื่อพื้นที่ให้ Movement" },
  { value: "Symmetry", label: "Symmetry — สมมาตร", help: "เหมาะกับงานที่ต้องการความแม่นยำ ความสงบ หรือความแปลกประหลาด" },
];

export const LOCATION_PRESETS: ProductionChoice[] = [
  { value: "Japanese Suburban Alley", label: "Japanese Suburban Alley — ตรอกชานเมืองญี่ปุ่น", help: "ตรอกสงบ บ้านเตี้ย เสาไฟ และรายละเอียดชีวิตประจำวัน" },
  { value: "Modern City Night", label: "Modern City Night — เมืองสมัยใหม่กลางคืน", help: "แสงเมือง รถ อาคาร และบรรยากาศร่วมสมัย" },
  { value: "Futuristic Metropolis", label: "Futuristic Metropolis — มหานครอนาคต", help: "เหมาะกับ Sci-Fi, Hologram, Neon และเทคโนโลยีขั้นสูง" },
  { value: "Forest Path", label: "Forest Path — ทางเดินในป่า", help: "เหมาะกับ Fantasy, Mystery, Adventure และการค้นพบ" },
  { value: "Interior Home", label: "Interior Home — ภายในบ้าน", help: "เหมาะกับ Dialogue, Family, Slice of Life และฉากส่วนตัว" },
  { value: "School Corridor", label: "School Corridor — ทางเดินโรงเรียน", help: "เหมาะกับ Coming-of-age, Anime และเรื่องวัยเรียน" },
  { value: "Space Station", label: "Space Station — สถานีอวกาศ", help: "เหมาะกับ Sci-Fi, Hard Surface, Zero-gravity และเทคโนโลยี" },
];

export const OBJECTIVE_PRESETS: ProductionChoice[] = [
  { value: "Establish World", label: "Establish World — แนะนำโลกและบรรยากาศ", help: "ใช้เพื่อให้ผู้ชมเข้าใจสถานที่ เวลา และ Mood ก่อนเหตุการณ์หลัก" },
  { value: "Introduce Character", label: "Introduce Character — แนะนำตัวละคร", help: "เปิดเผยบุคลิก รูปลักษณ์ หรือสิ่งที่ตัวละครกำลังทำ" },
  { value: "Reveal Information", label: "Reveal Information — เปิดเผยข้อมูลสำคัญ", help: "ใช้เมื่อ Scene ต้องเผยความลับ เบาะแส หรือข้อมูลใหม่" },
  { value: "Build Tension", label: "Build Tension — เพิ่มความตึงเครียด", help: "ค่อย ๆ เพิ่มแรงกดดัน ความสงสัย หรือภัยที่กำลังเข้าใกล้" },
  { value: "Emotional Beat", label: "Emotional Beat — เน้นอารมณ์", help: "โฟกัสความรู้สึก ความสัมพันธ์ หรือการเปลี่ยนแปลงภายในตัวละคร" },
  { value: "Action Progression", label: "Action Progression — เดินหน้าเหตุการณ์ Action", help: "ใช้กับการต่อสู้ ไล่ล่า หลบหนี หรือการเคลื่อนไหวที่เปลี่ยนสถานการณ์" },
  { value: "Resolve Scene", label: "Resolve Scene — ปิด Scene", help: "สรุปผลของเหตุการณ์และส่งต่อไป Scene ถัดไปอย่างชัดเจน" },
];

export const SCENE_BEATS: ProductionChoice[] = [
  { value: "Opening", label: "Opening Beat — เปิด Scene", help: "ตั้งสถานที่ เวลา ตัวละคร และสิ่งที่กำลังเกิดขึ้น" },
  { value: "Setup", label: "Setup Beat — วางสถานการณ์", help: "เตรียมข้อมูลหรือเงื่อนไขก่อนจุดเปลี่ยน" },
  { value: "Turn", label: "Turning Beat — จุดเปลี่ยน", help: "เกิดสิ่งใหม่ที่เปลี่ยนทิศทาง Scene หรือการตัดสินใจ" },
  { value: "Peak", label: "Peak Beat — จุดพีก", help: "ช่วงที่แรงอารมณ์ Action หรือความขัดแย้งสูงที่สุด" },
  { value: "Reaction", label: "Reaction Beat — ปฏิกิริยา", help: "ให้ตัวละครตอบสนองต่อสิ่งที่เพิ่งเกิดขึ้น" },
  { value: "Exit", label: "Exit Beat — ส่งออกจาก Scene", help: "สร้างจุดจบหรือแรงส่งเข้าสู่ Scene ถัดไป" },
];

export const TRANSITIONS: ProductionChoice[] = [
  { value: "Hard Cut", label: "Hard Cut — ตัดตรง", help: "เปลี่ยน Shot หรือ Scene ทันที เหมาะกับ Narrative ทั่วไป" },
  { value: "Match Cut", label: "Match Cut — ตัดด้วยภาพหรือการเคลื่อนไหวที่สัมพันธ์", help: "ช่วยให้การเปลี่ยน Scene ต่อเนื่องและมีความหมาย" },
  { value: "Cross Dissolve", label: "Cross Dissolve — ภาพซ้อนละลาย", help: "เหมาะกับเวลาเปลี่ยน ความทรงจำ หรือ Mood อ่อนโยน" },
  { value: "Fade", label: "Fade — ค่อย ๆ มืด/สว่าง", help: "เหมาะกับจบช่วงสำคัญ เปิดตอน หรือการเปลี่ยนเวลาชัดเจน" },
  { value: "Whip", label: "Whip Transition — ปัดกล้องเชื่อม", help: "เหมาะกับ Action, Energy และการเชื่อม Movement" },
  { value: "Seamless", label: "AI Seamless — ต่อเนื่องไร้รอย", help: "ใช้ Continuity State, Last Frame และ Movement เชื่อม Scene ให้ลื่นไหล" },
];

export const EMOTIONS: ProductionChoice[] = [
  { value: "Natural", label: "Natural — เป็นธรรมชาติ", help: "อารมณ์สมจริง ไม่เน้นเกินไป" },
  { value: "Warm", label: "Warm — อบอุ่น", help: "เหมาะกับ Friendship, Family และ Slice of Life" },
  { value: "Curious", label: "Curious — สงสัย/อยากรู้", help: "เหมาะกับ Discovery, Mystery และการพบสิ่งใหม่" },
  { value: "Tense", label: "Tense — ตึงเครียด", help: "เหมาะกับ Thriller, Suspense และความเสี่ยง" },
  { value: "Fear", label: "Fear — กลัว", help: "เหมาะกับ Horror, Danger และ Reaction ต่อภัย" },
  { value: "Joy", label: "Joy — ดีใจ", help: "เหมาะกับ Moment เชิงบวก การพบกัน และ Resolution" },
  { value: "Sad", label: "Sad — เศร้า", help: "เหมาะกับ Loss, Separation และ Emotional Drama" },
  { value: "Determined", label: "Determined — มุ่งมั่น", help: "เหมาะกับ Action, Decision และ Character Growth" },
];

export const SOUND_PRESETS: ProductionChoice[] = [
  { value: "Natural Ambience", label: "Natural Ambience — เสียงบรรยากาศธรรมชาติ", help: "เสียงพื้นที่โดยรอบ เช่น ลม นก เมือง หรือห้อง" },
  { value: "Soft Wind", label: "Soft Wind — ลมเบา", help: "สร้างความสงบ เหงา หรือพื้นที่เปิด" },
  { value: "City Ambience", label: "City Ambience — เสียงเมือง", help: "รถ ผู้คน และเสียงเมืองไกล ๆ" },
  { value: "Rain", label: "Rain — ฝน", help: "ใช้สร้าง Mood, Texture และความต่อเนื่องของสถานที่" },
  { value: "Cinematic Riser", label: "Cinematic Riser — เสียงไต่ระดับ", help: "เพิ่มแรงส่งก่อน Reveal, Action หรือ Turning Point" },
  { value: "Silence Beat", label: "Silence Beat — ช่วงเงียบ", help: "ตัดเสียงชั่วคราวเพื่อเน้น Moment สำคัญและ Reaction" },
  { value: "Sci-Fi Hum", label: "Sci-Fi Hum — เสียงเครื่องจักรอนาคต", help: "เหมาะกับ Space Station, Lab, Ship และเทคโนโลยี" },
];

export const CAMERA_SPEEDS: ProductionChoice[] = [
  { value: "Slow", label: "Slow — ช้า", help: "เหมาะกับ Emotion, Reveal และการสร้างบรรยากาศ" },
  { value: "Normal", label: "Normal — ปกติ", help: "สมดุลสำหรับ Narrative ทั่วไป" },
  { value: "Fast", label: "Fast — เร็ว", help: "เหมาะกับ Action, Chase และ Energy สูง" },
];

export const PERFORMANCE_OPTIONS: ProductionChoice[] = [
  { value: "Subtle", label: "Subtle — เล่นอารมณ์ละเอียด", help: "สีหน้าและท่าทางน้อยแต่มีนัย เหมาะกับ Drama และ Close-up" },
  { value: "Natural", label: "Natural — เป็นธรรมชาติ", help: "การแสดงสมจริง ใช้ได้กับ Scene ทั่วไป" },
  { value: "Expressive", label: "Expressive — แสดงออกชัด", help: "เหมาะกับ Animation, Comedy และ Emotion ที่ต้องอ่านง่าย" },
  { value: "Intense", label: "Intense — เข้มข้น", help: "เหมาะกับ Confrontation, Action และช่วง Climax" },
];

export const COLOR_TEMPERATURES: ProductionChoice[] = [
  { value: "Warm 3200K", label: "Warm 3200K — โทนอุ่น", help: "สร้างความอบอุ่น ใกล้ชิด หรือแสง Tungsten" },
  { value: "Neutral 4500K", label: "Neutral 4500K — สมดุล", help: "โทนกลาง ใช้งานง่ายและรักษาสีผิวธรรมชาติ" },
  { value: "Daylight 5600K", label: "Daylight 5600K — แสงกลางวัน", help: "เหมาะกับ Exterior และแสงธรรมชาติ" },
  { value: "Cool 7000K", label: "Cool 7000K — โทนเย็น", help: "เหมาะกับ Sci-Fi, Night และ Mood เย็น" },
];
