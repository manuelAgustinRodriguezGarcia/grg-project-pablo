import type { GlobalField } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export class GlobalFieldRepository {
  async findAll(): Promise<GlobalField[]> {
    return prisma.globalField.findMany({
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });
  }

  async findByKey(key: string): Promise<GlobalField | null> {
    return prisma.globalField.findUnique({
      where: { key },
    });
  }

  async existsByKey(key: string): Promise<boolean> {
    const count = await prisma.globalField.count({
      where: { key },
    });
    return count > 0;
  }
}

export const globalFieldRepository = new GlobalFieldRepository();
