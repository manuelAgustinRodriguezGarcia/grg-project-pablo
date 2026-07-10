import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida en las variables de entorno.");
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({ adapter });
}

function isPrismaClientCurrent(client: PrismaClient): boolean {
  // Probe the newest delegates so a HMR-cached client from a previous generate
  // is discarded instead of serving stale model accessors as undefined.
  return (
    typeof client.offlineSyncManifest?.aggregate === "function" &&
    typeof client.rolePermission?.findMany === "function"
  );
}

function resolvePrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;

  if (cached && isPrismaClientCurrent(cached)) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect().catch(() => undefined);
  }

  const client = createPrismaClient();
  // Always cache on globalThis so serverless/prod warm invocations reuse the
  // same PrismaClient + pg pool instead of opening a new connection set.
  globalForPrisma.prisma = client;

  return client;
}

export const prisma = resolvePrismaClient();
