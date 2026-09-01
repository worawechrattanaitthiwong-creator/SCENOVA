import { STYLE_PRESETS, VIDEO_MODELS } from "@/lib/catalogs";
import type { Episode, Project, PromptBundle, TimelineSegment } from "@/lib/domain";

const yes = (value: boolean) => (value ? "ON" : "OFF");

function isAiAuto(value: string | null | undefined) {
  const normalized = (value || "").trim();
  return /^AI(?:\s|_|$)/i.test(normalized);
}

function autoField(value: string | null | undefined, instruction: string) {
  if (isAiAuto(value)) return `AI AUTO — ${instruction}`;
  return value || "Not specified";
}

function characterBlock(project: Project) {
  return project.characters
    .map((character, index) => {
      const refs = character.references.length
        ? character.references.map((reference) => reference.label).join(", ")
        : "No uploaded references yet";

      return `# CHARACTER LOCK ${index + 1} — ${character.name.toUpperCase()}\n\n${character.description}\n\nAPPEARANCE: ${character.appearance}\nOUTFIT: ${character.outfit}\nPERSONALITY: ${character.personality}\nVOICE PROFILE: ${character.voiceProfile ?? "Not assigned"}\nREFERENCE PACK: ${refs}\nABSOLUTE CHARACTER LOCK: ${character.lock ? "Preserve the exact same identity, face, body proportions, hairstyle, outfit, color palette and signature details in every connected shot." : "Use the character design as guidance; identity lock is disabled."}`;
    })
    .join("\n\n---\n\n");
}

function shotLine(segment: TimelineSegment, shotIndex: number) {
  return segment.cameraShots
    .map((shot, cameraIndex) => {
      const dialogue = segment.dialogue
        .filter((beat) => beat.start < shot.end && beat.end > shot.start)
        .map((beat) => {
          const emotion = autoField(beat.emotion, "infer the speaking emotion from dialogue, story beat and performance context");
          return `Dialogue ${beat.start}-${beat.end}s: ${beat.text} (${emotion}, ${beat.speed})`;
        })
        .join(" | ");
      const lens = shot.lensMm <= 0
        ? "AI AUTO — choose focal length to match shot scale, space, subject distance and emotion"
        : `${shot.lensMm}mm`;

      return `## SHOT ${shotIndex + 1}.${cameraIndex + 1} — ${shot.start.toFixed(1)}-${shot.end.toFixed(1)}s\nCamera: ${autoField(shot.shotType, "choose shot size to best tell this story beat")}; ${autoField(shot.angle, "choose camera angle from scene objective, power relationship and emotion")}\nLens: ${lens}\nCamera height: ${autoField(shot.cameraHeight, "choose a physically believable camera height for the selected framing and action")}\nMovement: ${autoField(shot.movement, "choose camera movement from action, pacing and subject motion")} (${autoField(shot.movementSpeed, "choose movement speed from scene rhythm")})\nFocus: ${autoField(shot.focus, "choose the most important subject or story detail to prioritize")}\nDepth of field: ${autoField(shot.depthOfField, "choose depth of field to support attention, space and emotion")}\nComposition: ${autoField(shot.composition, "compose the frame around story priority, blocking and visual balance")}\nForeground occlusion: ${autoField(shot.foregroundOcclusion, "use or avoid foreground layers according to scene clarity and cinematic depth")}\nScene: ${segment.scene}\nAction: ${segment.action}\nEmotion: ${autoField(segment.emotion, "infer scene emotion and performance from story, action and dialogue")}\nLighting: ${autoField(segment.lighting, "design lighting, color temperature and visual mood from location, time, story and emotion")}\nSound: ${autoField(segment.sound, "design ambience, SFX, cue timing and music from location, action, dialogue, pacing and emotion")}\n${dialogue ? `${dialogue}\n` : ""}Respect every explicit user value and active lock. Every field marked AI AUTO must be actively decided by the AI from story context; AI AUTO never means disabled or omitted.`;
    })
    .join("\n\n");
}

function episodeTimeline(episode: Episode) {
  return episode.segments
    .map((segment, index) => {
      const characters = segment.characterIds.join(", ") || "none";
      return `# SEGMENT ${String(index + 1).padStart(2, "0")} — ${segment.start}-${segment.end}s\nTITLE: ${segment.title}\nLOCATION: ${segment.location}\nCHARACTERS: ${characters}\nACTION: ${segment.action}\nEMOTION: ${autoField(segment.emotion, "infer from the story beat, action and dialogue")}\nLIGHTING: ${autoField(segment.lighting, "choose lighting and color treatment that fit the scene")}\nSOUND: ${autoField(segment.sound, "create an appropriate sound design for the scene")}\n\n${shotLine(segment, index)}`;
    })
    .join("\n\n---\n\n");
}

export function buildPromptBundle(project: Project, episode: Episode): PromptBundle {
  const style = STYLE_PRESETS.find((item) => item.id === project.styleId) ?? STYLE_PRESETS[0];
  const model = VIDEO_MODELS.find((item) => item.id === project.mainModelId) ?? VIDEO_MODELS[0];

  const master = `# SCENOVA CINEMATIC STORY PROMPT\n\nFORMAT: ${project.aspectRatio} cinematic frame\nGENRE: ${project.genre}\nMOOD: ${project.mood}\nTARGET MODEL: ${model.name}\nPROMPT MODE: ${project.promptMode}\nMODEL MODE: ${project.modelMode}\nRESOLUTION TARGET: ${project.resolution}\n\n# MASTER VISUAL STYLE LOCK\n\nSTYLE: ${style.nameEn} (${style.nameTh})\n${style.prompt}\nCOLOR PALETTE: ${style.palette.join(", ")}\n\n# PROJECT BIBLE\n\n${project.projectBible}\n\n# STORY\n\n${project.story}\n\n# LOCK MATRIX\nProject Lock: ${yes(project.locks.project)}\nCharacter Lock: ${yes(project.locks.character)}\nStyle Lock: ${yes(project.locks.style)}\nVoice Lock: ${yes(project.locks.voice)}\nLocation Lock: ${yes(project.locks.location)}\nProp Lock: ${yes(project.locks.prop)}\nCanon Lock: ${yes(project.locks.canon)}\nCamera Style Lock: ${yes(project.locks.camera)}\nLighting Lock: ${yes(project.locks.lighting)}\nMotion Lock: ${yes(project.locks.motion)}\nModel Lock: ${yes(project.locks.model)}\n\n# AI AUTO RULE\nAI AUTO is an active creative-director instruction, not an OFF state. When a field is marked AI AUTO, infer and choose the most suitable production value from the story, location, action, dialogue, emotion, visual style, character continuity and neighboring shots. Explicit user values always override AI AUTO.\n\n${characterBlock(project)}\n\n# GLOBAL CAMERA STYLE LOCK\nFor explicit camera values, respect the selected shot size, angle, lens, camera height, focus, depth of field, composition and movement. For AI AUTO camera values, choose those parameters deliberately from the scene objective, blocking, action, pacing and emotion. Keep placement physically believable and avoid random zooms, fisheye distortion, unnecessary orbiting, drone shots or handheld shake unless the scene calls for them.\n\n# GLOBAL LIGHTING LOCK\nFor explicit lighting values, preserve them and maintain continuity across connected shots. For AI AUTO lighting, design motivated light direction, time of day, color temperature and contrast from the scene's location, story and mood, then keep that decision continuous until the story changes it.\n\n# GLOBAL MOTION LOCK\nPreserve natural body mechanics, gravity, secondary clothing/hair motion, prop continuity and believable acceleration. No teleporting, object popping, sudden scale changes, limb deformation or identity morphing.\n\n# ABSOLUTE CONSISTENCY COMMAND\nKeep the same character identities, costumes, signature accessories, locations, props, world rules and scale relationships across connected shots. Camera changes must reveal the same three-dimensional designs from different viewpoints, not reinterpret them. Canon facts may not be contradicted unless the user explicitly edits the canon.\n`;

  const episodePrompt = `# EPISODE ${String(episode.number).padStart(2, "0")} — ${episode.title}\nDURATION: ${episode.duration} seconds\nSYNOPSIS: ${episode.synopsis}\n\n${episodeTimeline(episode)}`;

  const shots = episode.segments.flatMap((segment, index) =>
    segment.cameraShots.map((_, cameraIndex) => shotLine(segment, index).split("\n\n")[cameraIndex] ?? "")
  );

  const negative = `# GLOBAL NEGATIVE PROMPT\n${style.negativePrompt}, character redesign, inconsistent face, different hairstyle, costume flicker, missing signature props, duplicate characters, extra limbs, malformed hands, broken anatomy, asymmetrical eyes, texture flicker, background flicker, random objects appearing, excessive motion blur, shaky camera, overexposed highlights, crushed shadows, text, captions, logo, watermark`;

  const thaiSummary = `ตอนที่ ${episode.number} “${episode.title}” ความยาว ${episode.duration} วินาที ใช้สไตล์ ${style.nameTh} โมเดลหลัก ${model.name} มี ${episode.segments.length} ช่วงเวลา และ ${episode.segments.reduce((sum, item) => sum + item.cameraShots.length, 0)} ช็อตกล้อง ระบบจะยึดค่าที่ผู้ใช้เปิดปรับเองเป็นข้อบังคับ ส่วนค่าที่เป็น AI AUTO จะให้ทีม AI เลือกกล้อง แสง การแสดง เสียง และความต่อเนื่องให้เหมาะกับเนื้อเรื่องโดยอัตโนมัติ`;

  return { master, episode: episodePrompt, shots, negative, thaiSummary };
}

export function exportProductionPrompt(project: Project, episode: Episode) {
  const bundle = buildPromptBundle(project, episode);
  return `${bundle.master}\n\n${bundle.episode}\n\n${bundle.negative}`;
}
