import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

function getPrismaClient() {
  if (globalForPrisma.prismaClient) return globalForPrisma.prismaClient;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");

  const adapter = new PrismaNeon({ connectionString });
  const client = new PrismaClient({ adapter });
  globalForPrisma.prismaClient = client;
  return client;
}

// Delay construction until the first actual database operation. Next/OpenNext
// imports route modules during production builds, where Cloudflare runtime
// secrets are intentionally unavailable. At request time, Workers populates
// process.env from bindings/secrets and the real Neon client is created once.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
