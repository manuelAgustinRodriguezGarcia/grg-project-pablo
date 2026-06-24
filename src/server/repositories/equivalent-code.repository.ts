import type { EquivalentCode } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type CreateEquivalentCodeData = {
  productId: string;
  originalCode: string;
  normalizedCode: string;
  sourceColumnKey?: string | null;
};

export class EquivalentCodeRepository {
  async findByProductId(productId: string): Promise<EquivalentCode[]> {
    return prisma.equivalentCode.findMany({
      where: { productId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  async findByIdAndProduct(
    id: string,
    productId: string,
  ): Promise<EquivalentCode | null> {
    return prisma.equivalentCode.findFirst({
      where: { id, productId },
    });
  }

  async createMany(data: CreateEquivalentCodeData[]): Promise<number> {
    if (data.length === 0) {
      return 0;
    }

    const result = await prisma.equivalentCode.createMany({
      data: data.map((item) => ({
        productId: item.productId,
        originalCode: item.originalCode,
        normalizedCode: item.normalizedCode,
        sourceColumnKey: item.sourceColumnKey ?? null,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  async deleteByProductId(productId: string): Promise<number> {
    const result = await prisma.equivalentCode.deleteMany({
      where: { productId },
    });

    return result.count;
  }

  async deleteById(id: string): Promise<void> {
    await prisma.equivalentCode.delete({ where: { id } });
  }

  async copyToProduct(
    sourceProductId: string,
    targetProductId: string,
  ): Promise<number> {
    const sourceCodes = await this.findByProductId(sourceProductId);
    if (sourceCodes.length === 0) {
      return 0;
    }

    return this.createMany(
      sourceCodes.map((code) => ({
        productId: targetProductId,
        originalCode: code.originalCode,
        normalizedCode: code.normalizedCode,
        sourceColumnKey: code.sourceColumnKey,
      })),
    );
  }
}

export const equivalentCodeRepository = new EquivalentCodeRepository();
