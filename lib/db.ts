import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

// Cloudflare Workers reuse isolates across requests. Database adapters can hold
// request-bound I/O internally, so a PrismaClient created for one request must
// never be cached in globalThis and reused by a later request.
//
// Keep this export lazy so Next/OpenNext can import route modules during builds
// without requiring DATABASE_URL. Each database operation receives a fresh
// client/adapter and therefore cannot inherit request-scoped sockets/state from
// a previous Worker invocation.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = createPrismaClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
