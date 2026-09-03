import { readFile, rm, writeFile } from "node:fs/promises";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const generatedClientPath = new URL("../generated/prisma/", import.meta.url);
const original = await readFile(schemaPath, "utf8");

const next = original
  .replace('runtime      = "cloudflare"', 'runtime      = "nodejs"')
  .replace('runtime = "cloudflare"', 'runtime = "nodejs"');

if (!next.includes('runtime      = "nodejs"') && !next.includes('runtime = "nodejs"')) {
  throw new Error("Unable to set Prisma runtime=nodejs in prisma/schema.prisma");
}

if (next !== original) {
  await writeFile(schemaPath, next, "utf8");
  console.log("SCENOVA VPS: Prisma runtime changed to nodejs");
} else {
  console.log("SCENOVA VPS: Prisma runtime already nodejs");
}

// The prisma-client generator emits runtime-specific TypeScript plus WASM glue.
// A VPS deploy can otherwise retain ignored files from a previous generation,
// leaving JS glue and query-compiler WASM from different generations. Always
// rebuild this server-only artifact from an empty directory before Prisma runs.
await rm(generatedClientPath, { recursive: true, force: true });
console.log("SCENOVA VPS: cleared generated Prisma client before regeneration");
