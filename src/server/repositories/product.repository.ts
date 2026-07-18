import type { Catalog, CatalogFolder, EquivalentCode, Product } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";
import type { JsonTextColumnFilter } from "@/server/filters/column-filter.types";

const VALID_JSON_COLUMN_KEY = /^[a-zA-Z0-9_]+$/;

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export type ProductPaginationOptions = {
  page: number;
  pageSize: number;
};

export type ProductListQueryOptions = ProductPaginationOptions & {
  where?: Prisma.ProductWhereInput;
};

export type PaginatedProducts = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ProductSearchResult = Pick<
  Product,
  | "id"
  | "folderId"
  | "primaryCode"
  | "normalizedCode"
  | "description"
  | "dynamicData"
  | "indexedText"
  | "normalizedIndexedText"
> & {
  equivalentCodes: Array<Pick<EquivalentCode, "originalCode" | "normalizedCode">>;
  folder: Pick<CatalogFolder, "id" | "name"> & {
    catalog: Pick<Catalog, "id" | "name">;
  };
};

export type PaginatedProductSearchResults = Omit<PaginatedProducts, "items"> & {
  items: ProductSearchResult[];
};

export type CreateProductData = {
  folderId: string;
  primaryCode?: string | null;
  normalizedCode?: string | null;
  description?: string | null;
  dynamicData?: Record<string, unknown>;
  originalText?: string | null;
  indexedText?: string | null;
  normalizedIndexedText?: string | null;
};

export class ProductRepository {
  async findByFolderPaginated(
    folderId: string,
    options: ProductPaginationOptions,
    extraWhere: Prisma.ProductWhereInput = {},
  ): Promise<PaginatedProducts> {
    return this.findPaginated(
      { folderId, ...extraWhere },
      options,
    );
  }

  async findPaginated(
    where: Prisma.ProductWhereInput,
    options: ProductPaginationOptions,
  ): Promise<PaginatedProducts> {
    // Prefer findSearchPaginated / findPaginatedBasic for new call sites.
    // Kept for catalog search which only needs product scalars (relations
    // are loaded via findSearchPaginated elsewhere).
    return this.findPaginatedBasic(where, options);
  }

  async findSearchPaginated(
    where: Prisma.ProductWhereInput,
    options: ProductPaginationOptions,
  ): Promise<PaginatedProductSearchResults> {
    const page = Math.max(1, options.page);
    const pageSize = Math.min(Math.max(1, options.pageSize), 200);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip,
        take: pageSize,
        select: {
          id: true,
          folderId: true,
          primaryCode: true,
          normalizedCode: true,
          description: true,
          dynamicData: true,
          indexedText: true,
          normalizedIndexedText: true,
          equivalentCodes: {
            select: {
              originalCode: true,
              normalizedCode: true,
            },
          },
          folder: {
            select: {
              id: true,
              name: true,
              catalog: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async findPaginatedBasic(
    where: Prisma.ProductWhereInput,
    options: ProductPaginationOptions,
  ): Promise<PaginatedProducts> {
    const page = Math.max(1, options.page);
    const pageSize = Math.min(Math.max(1, options.pageSize), 200);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async findIdsMatchingJsonTextFilters(
    folderId: string,
    filters: JsonTextColumnFilter[],
  ): Promise<string[]> {
    if (filters.length === 0) {
      return [];
    }

    for (const filter of filters) {
      if (!VALID_JSON_COLUMN_KEY.test(filter.columnInternalKey)) {
        throw new Error(`Clave de columna inválida: ${filter.columnInternalKey}`);
      }
    }

    const conditions = filters.map((filter) => {
      if (filter.operator === "equals") {
        return Prisma.sql`LOWER("dynamicData"->>${filter.columnInternalKey}) = LOWER(${filter.value})`;
      }

      const pattern = `%${escapeIlikePattern(filter.value)}%`;
      return Prisma.sql`"dynamicData"->>${filter.columnInternalKey} ILIKE ${pattern}`;
    });

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Product"
      WHERE "folderId" = ${folderId}
      AND ${Prisma.join(conditions, " AND ")}
    `;

    return rows.map((row) => row.id);
  }

  async findOptionsByFolder(
    where: Prisma.ProductWhereInput,
    limit = 200,
  ): Promise<
    Array<Pick<Product, "id" | "primaryCode" | "description">>
  > {
    return prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: Math.min(Math.max(1, limit), 200),
      select: {
        id: true,
        primaryCode: true,
        description: true,
      },
    });
  }

  async updateIndexedText(
    id: string,
    indexedText: string | null,
    normalizedIndexedText: string | null = null,
  ): Promise<void> {
    await prisma.product.update({
      where: { id },
      data: { indexedText, normalizedIndexedText },
    });
  }

  async findByFolderIdForReindex(folderId: string): Promise<Product[]> {
    return prisma.product.findMany({
      where: { folderId },
      orderBy: [{ id: "asc" }],
    });
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

  async findForMatchingByFolder(folderId: string): Promise<
    Array<{
      id: string;
      primaryCode: string | null;
      normalizedCode: string | null;
      description: string | null;
      dynamicData: Prisma.JsonValue;
    }>
  > {
    return prisma.product.findMany({
      where: { folderId },
      select: {
        id: true,
        primaryCode: true,
        normalizedCode: true,
        description: true,
        dynamicData: true,
      },
    });
  }

  async findByFolderId(folderId: string): Promise<Product[]> {
    return prisma.product.findMany({
      where: { folderId },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
  }

  async create(data: CreateProductData): Promise<Product> {
    return prisma.product.create({
      data: {
        folderId: data.folderId,
        primaryCode: data.primaryCode ?? null,
        normalizedCode: data.normalizedCode ?? null,
        description: data.description ?? null,
        dynamicData: (data.dynamicData ?? {}) as Prisma.InputJsonValue,
        originalText: data.originalText ?? null,
        indexedText: data.indexedText ?? null,
        normalizedIndexedText: data.normalizedIndexedText ?? null,
      },
    });
  }

  async update(
    id: string,
    data: Omit<CreateProductData, "folderId">,
  ): Promise<Product> {
    return prisma.product.update({
      where: { id },
      data: {
        ...(data.primaryCode !== undefined ? { primaryCode: data.primaryCode } : {}),
        ...(data.normalizedCode !== undefined
          ? { normalizedCode: data.normalizedCode }
          : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.dynamicData !== undefined
          ? { dynamicData: data.dynamicData as Prisma.InputJsonValue }
          : {}),
        ...(data.originalText !== undefined ? { originalText: data.originalText } : {}),
        ...(data.indexedText !== undefined ? { indexedText: data.indexedText } : {}),
        ...(data.normalizedIndexedText !== undefined
          ? { normalizedIndexedText: data.normalizedIndexedText }
          : {}),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.product.delete({ where: { id } });
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
        normalizedIndexedText: item.normalizedIndexedText ?? null,
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
