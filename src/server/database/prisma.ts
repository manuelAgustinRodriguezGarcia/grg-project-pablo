import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function getPgPool(connectionString: string): Pool {
  if (!globalForPrisma.pgPool) {
    globalForPrisma.pgPool = new Pool({ connectionString });
  }

  return globalForPrisma.pgPool;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL no está definida en las variables de entorno.");
  }

  const adapter = new PrismaPg(getPgPool(connectionString));

  return new PrismaClient({ adapter });
}

function isPrismaClientCurrent(client: PrismaClient): boolean {
  return (
    typeof client.billingInvoice?.aggregate === "function" &&
    typeof client.billingReceiptAllocation?.groupBy === "function" &&
    typeof client.billingNote?.findMany === "function"
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
  globalForPrisma.prisma = client;

  return client;
}

export const prisma = resolvePrismaClient();
