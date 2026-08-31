import fs from "node:fs";

const path = "components/single-episode-studio.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOrFail(search, replacement, label) {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`PATCH_MISS:${label}`);
  source = next;
}

// Remove the Single Episode local draft persistence contract and key.
replaceOrFail(/type DraftPayload = \{[\s\S]*?\};\n\n/, "", "draft-payload-type");
replaceOrFail('const DRAFT_KEY = "scenova-story-draft-v1";\n', "", "draft-key");

// Remove automatic localStorage draft restore.
replaceOrFail(
  /  useEffect\(\(\) => \{\n    const raw = localStorage\.getItem\(DRAFT_KEY\);[\s\S]*?\n  \}, \[\]\);\n\n/,
  "",
  "draft-load-effect",
);

// Remove currentDraft/saveDraft while preserving sendToAgent.
replaceOrFail(
  /  function currentDraft\(\) \{[\s\S]*?\n  async function sendToAgent\(\) \{/,
  "  async function sendToAgent() {",
  "draft-functions",
);

// Sending to AI should no longer create a hidden local draft.
replaceOrFail(
  '    const draft = currentDraft();\n    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));\n\n',
  "",
  "draft-write-before-agent",
);

// Remove all visible draft-save and render-queue shortcuts from Single Episode Studio.
source = source.replace(/\s*<button type="button" className=\{styles\.secondaryButton\} onClick=\{saveDraft\}>บันทึกร่าง<\/button>/g, "");
source = source.replace(/\s*<Link href="\/render" className=\{styles\.secondaryButton\}(?: onClick=\{saveDraft\})?>[^<]*<\/Link>/g, "");

for (const forbidden of ["DRAFT_KEY", "currentDraft", "saveDraft", "บันทึกร่าง", 'href="/render"']) {
  if (source.includes(forbidden)) throw new Error(`PATCH_INCOMPLETE:${forbidden}`);
}

fs.writeFileSync(path, source);
console.log("Removed Single Episode draft persistence and render queue controls");
