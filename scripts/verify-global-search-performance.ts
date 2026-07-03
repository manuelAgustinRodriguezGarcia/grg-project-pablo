#!/usr/bin/env tsx
import "dotenv/config";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

async function main(): Promise<void> {
  const term = process.argv[2]?.trim();
  if (!term || term.length < 3) {
    console.error("Uso: pnpm dlx tsx scripts/verify-global-search-performance.ts <query-3+-chars>");
    process.exitCode = 1;
    return;
  }

  const pattern = `%${term}%`;
  const rows = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT "id"
    FROM "Product"
    WHERE "indexedText" ILIKE ${pattern}
    ORDER BY "updatedAt" DESC, "id" ASC
    LIMIT 25
  `;

  const plan = rows.map((row) => row["QUERY PLAN"]).join("\n");
  console.log(plan);

  if (!plan.includes("Product_indexedText_trgm_idx")) {
    console.warn(
      "Advertencia: el plan no menciona Product_indexedText_trgm_idx. Revisar estadísticas, tamaño del dataset o migraciones aplicadas.",
    );
  }
}

main()
  .catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`${error.code}: ${error.message}`);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
