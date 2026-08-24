import type { Character, DialogueBeat, TimelineSegment } from "@/lib/domain";

export type ParsedDialogueLine = {
  speaker: string;
  text: string;
  emotion?: string;
};

export function parseDialogueScript(script: string): ParsedDialogueLine[] {
  return script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:：]{1,60})[:：]\s*(.+)$/);
      if (!match) return { speaker: "NARRATION", text: line };
      return { speaker: match[1].trim(), text: match[2].trim() };
    });
}

function estimateSpeechSeconds(text: string, speed = 1) {
  const thaiLike = /[\u0E00-\u0E7F]/.test(text);
  const units = thaiLike ? text.replace(/\s/g, "").length / 4.2 : text.split(/\s+/).length / 2.5;
  return Math.max(1, units / Math.max(0.5, speed));
}

export function dialogueToBeats(input: {
  segment: TimelineSegment;
  script: string;
  characters: Character[];
  defaultEmotion?: string;
  speed?: number;
}): DialogueBeat[] {
  const lines = parseDialogueScript(input.script);
  const available = input.segment.end - input.segment.start;
  const raw = lines.map((line) => ({ ...line, seconds: estimateSpeechSeconds(line.text, input.speed ?? 1) }));
  const total = raw.reduce((sum, line) => sum + line.seconds, 0) || 1;
  const scale = Math.min(1, available / total);
  let cursor = input.segment.start;

  return raw.map((line, index) => {
    const character = input.characters.find((item) => item.name.toLowerCase() === line.speaker.toLowerCase() || item.id.toLowerCase() === line.speaker.toLowerCase());
    const duration = Math.max(0.8, line.seconds * scale);
    const end = index === raw.length - 1 ? Math.min(input.segment.end, cursor + duration) : Math.min(input.segment.end, cursor + duration);
    const beat: DialogueBeat = {
      id: `dialogue-${Date.now()}-${index}`,
      characterId: character?.id ?? line.speaker,
      start: Number(cursor.toFixed(2)),
      end: Number(end.toFixed(2)),
      text: line.text,
      emotion: line.emotion ?? input.defaultEmotion ?? "natural",
      speed: `${input.speed ?? 1}x`,
    };
    cursor = end;
    return beat;
  });
}

export function dialogueCameraSuggestion(beats: DialogueBeat[]) {
  if (beats.length <= 1) return ["Medium Shot", "Close-up", "Reaction Shot"];
  return ["Two Shot", "Over-the-Shoulder", "Reverse Over-the-Shoulder", "Close-up speaker", "Reaction Shot listener"];
}
