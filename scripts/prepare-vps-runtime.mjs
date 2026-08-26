import { readFile, writeFile } from "node:fs/promises";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
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
