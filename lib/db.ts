import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
};

function getPrismaClient() {
  if (globalForPrisma.prismaClient) return globalForPrisma.prismaClient;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");

  const adapter = new PrismaNeon({ connectionString });
  const client = new PrismaClient({ adapter });

  // A long-lived Node.js VPS process is not subject to Cloudflare Workers'
  // request-bound I/O isolation. Reusing one client avoids creating a new
  // Neon adapter/pool for every Prisma operation.
  globalForPrisma.prismaClient = client;
  return client;
}

// Keep construction lazy so Next.js can import route modules during build
// without requiring runtime secrets. The singleton is created on first DB use.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
