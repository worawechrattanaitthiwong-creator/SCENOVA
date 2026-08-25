import { STYLE_PRESETS, VIDEO_MODELS } from "@/lib/catalogs";
import type { Episode, Project, PromptBundle, TimelineSegment } from "@/lib/domain";

const yes = (value: boolean) => (value ? "ON" : "OFF");

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
        .map((beat) => `Dialogue ${beat.start}-${beat.end}s: ${beat.text} (${beat.emotion}, ${beat.speed})`)
        .join(" | ");

      return `## SHOT ${shotIndex + 1}.${cameraIndex + 1} — ${shot.start.toFixed(1)}-${shot.end.toFixed(1)}s\nCamera: ${shot.shotType}; ${shot.angle}\nLens: ${shot.lensMm}mm\nCamera height: ${shot.cameraHeight}\nMovement: ${shot.movement} (${shot.movementSpeed})\nFocus: ${shot.focus}\nDepth of field: ${shot.depthOfField}\nComposition: ${shot.composition}\nForeground occlusion: ${shot.foregroundOcclusion}\nScene: ${segment.scene}\nAction: ${segment.action}\nEmotion: ${segment.emotion}\nLighting: ${segment.lighting}\nSound: ${segment.sound}\n${dialogue ? `${dialogue}\n` : ""}Maintain all active project, character, style, camera and continuity locks.`;
    })
    .join("\n\n");
}

function episodeTimeline(episode: Episode) {
  return episode.segments
    .map((segment, index) => {
      const characters = segment.characterIds.join(", ") || "none";
      return `# SEGMENT ${String(index + 1).padStart(2, "0")} — ${segment.start}-${segment.end}s\nTITLE: ${segment.title}\nLOCATION: ${segment.location}\nCHARACTERS: ${characters}\nACTION: ${segment.action}\nEMOTION: ${segment.emotion}\nLIGHTING: ${segment.lighting}\nSOUND: ${segment.sound}\n\n${shotLine(segment, index)}`;
    })
    .join("\n\n---\n\n");
}

export function buildPromptBundle(project: Project, episode: Episode): PromptBundle {
  const style = STYLE_PRESETS.find((item) => item.id === project.styleId) ?? STYLE_PRESETS[0];
  const model = VIDEO_MODELS.find((item) => item.id === project.mainModelId) ?? VIDEO_MODELS[0];

  const master = `# SCENOVA CINEMATIC STORY PROMPT\n\nFORMAT: ${project.aspectRatio} cinematic frame\nGENRE: ${project.genre}\nMOOD: ${project.mood}\nTARGET MODEL: ${model.name}\nPROMPT MODE: ${project.promptMode}\nMODEL MODE: ${project.modelMode}\nRESOLUTION TARGET: ${project.resolution}\n\n# MASTER VISUAL STYLE LOCK\n\nSTYLE: ${style.nameEn} (${style.nameTh})\n${style.prompt}\nCOLOR PALETTE: ${style.palette.join(", ")}\n\n# PROJECT BIBLE\n\n${project.projectBible}\n\n# STORY\n\n${project.story}\n\n# LOCK MATRIX\nProject Lock: ${yes(project.locks.project)}\nCharacter Lock: ${yes(project.locks.character)}\nStyle Lock: ${yes(project.locks.style)}\nVoice Lock: ${yes(project.locks.voice)}\nLocation Lock: ${yes(project.locks.location)}\nProp Lock: ${yes(project.locks.prop)}\nCanon Lock: ${yes(project.locks.canon)}\nCamera Style Lock: ${yes(project.locks.camera)}\nLighting Lock: ${yes(project.locks.lighting)}\nMotion Lock: ${yes(project.locks.motion)}\nModel Lock: ${yes(project.locks.model)}\n\n${characterBlock(project)}\n\n# GLOBAL CAMERA STYLE LOCK\nUse physically believable cinematic camera placement. Respect every shot's selected shot size, angle, lens, camera height, focus, depth of field, composition and movement. Do not add random zooms, fisheye distortion, unnecessary orbiting, drone shots or handheld shake unless explicitly requested.\n\n# GLOBAL LIGHTING LOCK\nMaintain consistent light direction, time of day, color temperature and motivated light sources across connected shots unless the timeline explicitly changes them.\n\n# GLOBAL MOTION LOCK\nPreserve natural body mechanics, gravity, secondary clothing/hair motion, prop continuity and believable acceleration. No teleporting, object popping, sudden scale changes, limb deformation or identity morphing.\n\n# ABSOLUTE CONSISTENCY COMMAND\nKeep the same character identities, costumes, signature accessories, locations, props, world rules and scale relationships across connected shots. Camera changes must reveal the same three-dimensional designs from different viewpoints, not reinterpret them. Canon facts may not be contradicted unless the user explicitly edits the canon.\n`;

  const episodePrompt = `# EPISODE ${String(episode.number).padStart(2, "0")} — ${episode.title}\nDURATION: ${episode.duration} seconds\nSYNOPSIS: ${episode.synopsis}\n\n${episodeTimeline(episode)}`;

  const shots = episode.segments.flatMap((segment, index) =>
    segment.cameraShots.map((_, cameraIndex) => shotLine(segment, index).split("\n\n")[cameraIndex] ?? "")
  );

  const negative = `# GLOBAL NEGATIVE PROMPT\n${style.negativePrompt}, character redesign, inconsistent face, different hairstyle, costume flicker, missing signature props, duplicate characters, extra limbs, malformed hands, broken anatomy, asymmetrical eyes, texture flicker, background flicker, random objects appearing, excessive motion blur, shaky camera, overexposed highlights, crushed shadows, text, captions, logo, watermark`;

  const thaiSummary = `ตอนที่ ${episode.number} “${episode.title}” ความยาว ${episode.duration} วินาที ใช้สไตล์ ${style.nameTh} โมเดลหลัก ${model.name} มี ${episode.segments.length} ช่วงเวลา และ ${episode.segments.reduce((sum, item) => sum + item.cameraShots.length, 0)} ช็อตกล้อง ระบบจะยึดค่าที่ผู้ใช้เลือกเป็นข้อบังคับ แล้วเรียบเรียงเป็น Prompt ระดับภาพยนตร์โดยไม่เปลี่ยน Lock ที่เปิดไว้`;

  return { master, episode: episodePrompt, shots, negative, thaiSummary };
}

export function exportProductionPrompt(project: Project, episode: Episode) {
  const bundle = buildPromptBundle(project, episode);
  return `${bundle.master}\n\n${bundle.episode}\n\n${bundle.negative}`;
}
