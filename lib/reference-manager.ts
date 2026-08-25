import type { Character, Project, TimelineSegment } from "@/lib/domain";

export type ReferenceAsset = {
  id: string;
  kind: "character-image" | "style-image" | "location-image" | "prop-image" | "motion-video" | "camera-video" | "voice-audio" | "music-audio" | "sfx-audio";
  ownerKey?: string;
  label: string;
  url?: string;
  durationSec?: number;
  priority: number;
};

export type ReferenceSelection = {
  images: ReferenceAsset[];
  videos: ReferenceAsset[];
  audio: ReferenceAsset[];
  explanationTh: string[];
};

function characterReferenceAssets(character: Character): ReferenceAsset[] {
  return character.references.map((reference, index) => ({
    id: reference.id,
    kind: "character-image" as const,
    ownerKey: character.id,
    label: `${character.name} — ${reference.label}`,
    url: reference.url,
    priority: 100 - index,
  }));
}

export function selectReferencesForSegment(input: {
  project: Project;
  segment: TimelineSegment;
  library?: ReferenceAsset[];
  maxImages?: number;
  maxVideos?: number;
  maxAudio?: number;
}): ReferenceSelection {
  const maxImages = input.maxImages ?? 12;
  const maxVideos = input.maxVideos ?? 4;
  const maxAudio = input.maxAudio ?? 4;
  const library = input.library ?? [];
  const images: ReferenceAsset[] = [];
  const videos: ReferenceAsset[] = [];
  const audio: ReferenceAsset[] = [];
  const explanationTh: string[] = [];

  for (const characterId of input.segment.characterIds) {
    const character = input.project.characters.find((item) => item.id === characterId);
    if (!character) continue;
    const refs = characterReferenceAssets(character).slice(0, 4);
    images.push(...refs);
    explanationTh.push(`ใช้ Character Reference ของ ${character.name} ${refs.length} ภาพ เพราะปรากฏในช่วง ${input.segment.start}-${input.segment.end} วิ`);
  }

  const related = library
    .filter((asset) => !asset.ownerKey || input.segment.characterIds.includes(asset.ownerKey) || input.segment.location.toLowerCase().includes((asset.ownerKey ?? "").toLowerCase()))
    .sort((a, b) => b.priority - a.priority);

  for (const asset of related) {
    if (asset.kind.endsWith("image") && images.length < maxImages) images.push(asset);
    if (asset.kind.endsWith("video") && videos.length < maxVideos) videos.push(asset);
    if (asset.kind.endsWith("audio") && audio.length < maxAudio) audio.push(asset);
  }

  if (videos.length) explanationTh.push("ใช้ Video Reference เฉพาะ Motion/Camera ที่เกี่ยวข้องเพื่อลดการรบกวน Character และ Style");
  if (audio.length) explanationTh.push("เลือก Voice/Music/SFX เฉพาะรายการที่เกี่ยวกับช่วงเวลา ไม่ส่งเสียงทุกไฟล์พร้อมกัน");

  return {
    images: images.slice(0, maxImages),
    videos: videos.slice(0, maxVideos),
    audio: audio.slice(0, maxAudio),
    explanationTh,
  };
}
