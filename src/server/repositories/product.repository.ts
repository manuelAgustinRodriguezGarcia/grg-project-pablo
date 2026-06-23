import type { Product } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";

export type ProductPaginationOptions = {
  page: number;
  pageSize: number;
};

export type PaginatedProducts = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateProductData = {
  folderId: string;
  primaryCode?: string | null;
  normalizedCode?: string | null;
  description?: string | null;
  dynamicData?: Record<string, unknown>;
  originalText?: string | null;
  indexedText?: string | null;
};

export class ProductRepository {
  async findByFolderPaginated(
    folderId: string,
    options: ProductPaginationOptions,
  ): Promise<PaginatedProducts> {
    const page = Math.max(1, options.page);
    const pageSize = Math.min(Math.max(1, options.pageSize), 200);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where: { folderId },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.product.count({ where: { folderId } }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async findById(id: string): Promise<Product | null> {
    return prisma.product.findUnique({
      where: { id },
    });
  }

  async countByFolder(folderId: string): Promise<number> {
    return prisma.product.count({ where: { folderId } });
  }

  async findPrimaryCodesByFolder(folderId: string): Promise<
    Array<{ id: string; primaryCode: string | null; normalizedCode: string | null }>
  > {
    return prisma.product.findMany({
      where: { folderId },
      select: { id: true, primaryCode: true, normalizedCode: true },
    });
  }

  async createMany(data: CreateProductData[]): Promise<number> {
    if (data.length === 0) {
      return 0;
    }

    const result = await prisma.product.createMany({
      data: data.map((item) => ({
        folderId: item.folderId,
        primaryCode: item.primaryCode ?? null,
        normalizedCode: item.normalizedCode ?? null,
        description: item.description ?? null,
        dynamicData: (item.dynamicData ?? {}) as Prisma.InputJsonValue,
        originalText: item.originalText ?? null,
        indexedText: item.indexedText ?? null,
      })),
    });

    return result.count;
  }

  async deleteByFolder(folderId: string): Promise<number> {
    const result = await prisma.product.deleteMany({ where: { folderId } });
    return result.count;
  }

  async hasNonEmptyDynamicValue(
    folderId: string,
    internalKey: string,
  ): Promise<boolean> {
    const products = await prisma.product.findMany({
      where: { folderId },
      select: { dynamicData: true },
    });

    return products.some((product) => {
      const value = (product.dynamicData as Record<string, unknown> | null)?.[
        internalKey
      ];

      if (value === null || value === undefined) {
        return false;
      }

      return String(value).trim().length > 0;
    });
  }
}

export const productRepository = new ProductRepository();
