import type { Catalog } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export class CatalogRepository {
  async findActiveOrdered(): Promise<Catalog[]> {
    return prisma.catalog.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  }
}

export const catalogRepository = new CatalogRepository();
