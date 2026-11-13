import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  pgPoolUrl: string | undefined;
};

/**
 * En desarrollo la app usa la conexión de sesión (DIRECT_URL, puerto 5432).
 * En esta red el pooler de transacciones (DATABASE_URL, puerto 6543) acepta el
 * TCP y no responde el handshake de Postgres, así que cada consulta queda
 * colgada. Producción sigue usando DATABASE_URL.
 */
function resolveConnectionString(): string {
  const pooled = process.env.DATABASE_URL?.trim();
  const direct = process.env.DIRECT_URL?.trim();

  if (process.env.NODE_ENV !== "production" && direct) {
    return direct;
  }

  if (!pooled) {
    throw new Error("DATABASE_URL no está definida en las variables de entorno.");
  }

  return pooled;
}

function getPgPool(connectionString: string): Pool {
  if (globalForPrisma.pgPool && globalForPrisma.pgPoolUrl === connectionString) {
    return globalForPrisma.pgPool;
  }

  if (globalForPrisma.pgPool) {
    void globalForPrisma.pgPool.end().catch(() => undefined);
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  pool.on("error", () => {
    // El servidor o el NAT cierran clientes ociosos. El pool descarta ese cliente.
  });

  globalForPrisma.pgPool = pool;
  globalForPrisma.pgPoolUrl = connectionString;

  return pool;
}

function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg(getPgPool(connectionString));

  return new PrismaClient({ adapter });
}

function isPrismaClientCurrent(client: PrismaClient): boolean {
  return (
    typeof client.billingInvoice?.aggregate === "function" &&
    typeof client.billingReceiptAllocation?.groupBy === "function" &&
    typeof client.billingNote?.findMany === "function" &&
    typeof client.billingLibroIvaArchive?.findMany === "function"
  );
}

function resolvePrismaClient(): PrismaClient {
  const connectionString = resolveConnectionString();
  const cached = globalForPrisma.prisma;
  const samePool = globalForPrisma.pgPoolUrl === connectionString;

  if (cached && isPrismaClientCurrent(cached) && samePool) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect().catch(() => undefined);
  }

  const client = createPrismaClient(connectionString);
  globalForPrisma.prisma = client;

  return client;
}

export const prisma = resolvePrismaClient();
