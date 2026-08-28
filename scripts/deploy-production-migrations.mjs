import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

process.env.NODE_ENV = "production";
loadEnvConfig(process.cwd(), false);

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is missing after loading .env.production");
  process.exit(1);
}

if (!process.env.DIRECT_URL) {
  console.error("ERROR: DIRECT_URL is missing after loading .env.production");
  process.exit(1);
}

const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  console.error("ERROR: unable to start Prisma migrate deploy", result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
