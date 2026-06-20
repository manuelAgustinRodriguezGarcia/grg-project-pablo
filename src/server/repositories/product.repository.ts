import type { Product } from "@/generated/prisma/client";
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
}

export const productRepository = new ProductRepository();
