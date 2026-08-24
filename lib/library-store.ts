export type LibraryKind = "images" | "voices" | "characters" | "pets" | "ambience" | "plots";
export type LibraryItem = { id: string; kind: LibraryKind; title: string; description: string; assetUrl?: string; createdAt: string };

const globalStore = globalThis as unknown as { __scenovaLibrary?: LibraryItem[] };
const defaults: LibraryItem[] = [
  { id: "img-cinematic", kind: "images", title: "Cinematic Anime", description: "สไตล์ภาพยนตร์อนิเมะสำหรับเรื่องเล่า", createdAt: new Date(0).toISOString() },
  { id: "voice-mira", kind: "voices", title: "Mira", description: "หญิง • อบอุ่น • เป็นธรรมชาติ", createdAt: new Date(0).toISOString() },
  { id: "char-starter", kind: "characters", title: "Starter Character", description: "ตัวละครต้นแบบสำหรับสร้าง Reference Pack", createdAt: new Date(0).toISOString() },
  { id: "pet-cat", kind: "pets", title: "แมว", description: "สัตว์เลี้ยงสำหรับเรื่องทั่วไป", createdAt: new Date(0).toISOString() },
  { id: "amb-rain", kind: "ambience", title: "ฝนตก", description: "เสียงฝนและบรรยากาศเมืองเปียก", createdAt: new Date(0).toISOString() },
  { id: "plot-mystery", kind: "plots", title: "พบสิ่งมีชีวิตลึกลับ", description: "พล็อตมิตรภาพแฟนตาซีสำหรับ Short Film", createdAt: new Date(0).toISOString() },
];
export const libraryStore = globalStore.__scenovaLibrary ?? defaults;
if (!globalStore.__scenovaLibrary) globalStore.__scenovaLibrary = libraryStore;

export function addLibraryItem(input: Omit<LibraryItem, "id" | "createdAt">) {
  const item: LibraryItem = { ...input, id: `lib_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() };
  libraryStore.unshift(item);
  return item;
}
