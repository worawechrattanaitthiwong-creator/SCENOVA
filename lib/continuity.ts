import type { Episode, Project, TimelineSegment } from "@/lib/domain";

export type ContinuitySnapshot = {
  projectId: string;
  episodeId: string;
  atSecond: number;
  activeCharacterIds: string[];
  location: string;
  emotionByCharacter: Record<string, string>;
  costumeByCharacter: Record<string, string>;
  lockedProps: string[];
  lighting: string;
  cameraDirection: string;
  canon: string[];
  lastFrameAssetKey?: string;
  videoTailAssetKey?: string;
};

export function createContinuitySnapshot(project: Project, episode: Episode, segment: TimelineSegment): ContinuitySnapshot {
  const characters = project.characters.filter((character) => segment.characterIds.includes(character.id));
  const lastShot = segment.cameraShots.at(-1);

  return {
    projectId: project.id,
    episodeId: episode.id,
    atSecond: segment.end,
    activeCharacterIds: segment.characterIds,
    location: segment.location,
    emotionByCharacter: Object.fromEntries(segment.characterIds.map((id) => [id, segment.emotion])),
    costumeByCharacter: Object.fromEntries(characters.map((character) => [character.id, character.outfit])),
    lockedProps: project.locks.prop ? ["use project prop registry"] : [],
    lighting: segment.lighting,
    cameraDirection: lastShot ? `${lastShot.angle}; ${lastShot.movement}; ${lastShot.composition}` : "not specified",
    canon: project.locks.canon ? project.canon : [],
  };
}

export function continuityPrompt(snapshot: ContinuitySnapshot) {
  return `CONTINUITY FROM PREVIOUS SEGMENT:\nAt ${snapshot.atSecond}s keep characters ${snapshot.activeCharacterIds.join(", ") || "none"} in ${snapshot.location}. Maintain costume state ${JSON.stringify(snapshot.costumeByCharacter)}, emotion state ${JSON.stringify(snapshot.emotionByCharacter)}, lighting ${snapshot.lighting}, and camera continuity ${snapshot.cameraDirection}. Preserve canon facts: ${snapshot.canon.join(" | ")}. If a last-frame or video-tail reference is supplied, treat it as the visual continuity anchor.`;
}
