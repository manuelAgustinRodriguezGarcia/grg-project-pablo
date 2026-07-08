import type { PriceItem } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";
import type { JsonTextColumnFilter } from "@/server/filters/column-filter.types";

const VALID_JSON_COLUMN_KEY = /^[a-z0-9_]+$/;

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export type PriceItemPaginationOptions = {
  page: number;
  pageSize: number;
};

export type PaginatedPriceItems = {
  items: PriceItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreatePriceItemData = {
  priceListId: string;
  primaryCode?: string | null;
  normalizedCode?: string | null;
  description?: string | null;
  amount?: Prisma.Decimal | null;
  dynamicData?: Record<string, unknown>;
  originalText?: string | null;
  indexedText?: string | null;
};

export class PriceItemRepository {
  async findByPriceListPaginated(
    priceListId: string,
    options: PriceItemPaginationOptions,
    extraWhere: Prisma.PriceItemWhereInput = {},
  ): Promise<PaginatedPriceItems> {
    return this.findPaginated({ priceListId, ...extraWhere }, options);
  }

  async findByPriceListPaginatedWithTextSearch(
    priceListId: string,
    options: PriceItemPaginationOptions,
    textTerm: string,
    normalizedQuery: string,
  ): Promise<PaginatedPriceItems> {
    const page = Math.max(1, options.page);
    const pageSize = Math.min(Math.max(1, options.pageSize), 200);
    const skip = (page - 1) * pageSize;
    const pattern = `%${escapeIlikePattern(textTerm)}%`;
    const normalizedPattern = `%${escapeIlikePattern(normalizedQuery)}%`;

    const searchCondition = Prisma.sql`
      "priceListId" = ${priceListId}
      AND (
        COALESCE("indexedText", '') ILIKE ${pattern}
        OR COALESCE("primaryCode", '') ILIKE ${pattern}
        OR COALESCE("description", '') ILIKE ${pattern}
        OR COALESCE("amount"::text, '') ILIKE ${pattern}
        OR COALESCE("normalizedCode", '') ILIKE ${normalizedPattern}
        OR COALESCE("dynamicData"::text, '') ILIKE ${pattern}
      )
    `;

    const [items, countResult] = await Promise.all([
      prisma.$queryRaw<PriceItem[]>`
        SELECT *
        FROM "PriceItem"
        WHERE ${searchCondition}
        ORDER BY "updatedAt" DESC, "id" ASC
        LIMIT ${pageSize}
        OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count
        FROM "PriceItem"
        WHERE ${searchCondition}
      `,
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async findPaginated(
    where: Prisma.PriceItemWhereInput,
    options: PriceItemPaginationOptions,
  ): Promise<PaginatedPriceItems> {
    const page = Math.max(1, options.page);
    const pageSize = Math.min(Math.max(1, options.pageSize), 200);
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.priceItem.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.priceItem.count({ where }),
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
    priceListId: string,
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
      FROM "PriceItem"
      WHERE "priceListId" = ${priceListId}
      AND ${Prisma.join(conditions, " AND ")}
    `;

    return rows.map((row) => row.id);
  }

  async findIdsMatchingAmountContainsFilters(
    priceListId: string,
    filters: JsonTextColumnFilter[],
  ): Promise<string[]> {
    if (filters.length === 0) {
      return [];
    }

    const conditions = filters.map((filter) => {
      const pattern = `%${escapeIlikePattern(filter.value)}%`;
      return Prisma.sql`COALESCE("amount"::text, '') ILIKE ${pattern}`;
    });

    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "PriceItem"
      WHERE "priceListId" = ${priceListId}
      AND ${Prisma.join(conditions, " AND ")}
    `;

    return rows.map((row) => row.id);
  }

  async findById(id: string): Promise<PriceItem | null> {
    return prisma.priceItem.findUnique({ where: { id } });
  }

  async countByPriceList(priceListId: string): Promise<number> {
    return prisma.priceItem.count({ where: { priceListId } });
  }

  async findCodesByPriceList(priceListId: string): Promise<
    Array<{ id: string; primaryCode: string | null; normalizedCode: string | null }>
  > {
    return prisma.priceItem.findMany({
      where: { priceListId },
      select: { id: true, primaryCode: true, normalizedCode: true },
    });
  }

  async create(data: CreatePriceItemData): Promise<PriceItem> {
    return prisma.priceItem.create({
      data: {
        priceListId: data.priceListId,
        primaryCode: data.primaryCode ?? null,
        normalizedCode: data.normalizedCode ?? null,
        description: data.description ?? null,
        amount: data.amount ?? null,
        dynamicData: (data.dynamicData ?? {}) as Prisma.InputJsonValue,
        originalText: data.originalText ?? null,
        indexedText: data.indexedText ?? null,
      },
    });
  }

  async update(
    id: string,
    data: Omit<CreatePriceItemData, "priceListId">,
  ): Promise<PriceItem> {
    return prisma.priceItem.update({
      where: { id },
      data: {
        ...(data.primaryCode !== undefined ? { primaryCode: data.primaryCode } : {}),
        ...(data.normalizedCode !== undefined
          ? { normalizedCode: data.normalizedCode }
          : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.dynamicData !== undefined
          ? { dynamicData: data.dynamicData as Prisma.InputJsonValue }
          : {}),
        ...(data.originalText !== undefined ? { originalText: data.originalText } : {}),
        ...(data.indexedText !== undefined ? { indexedText: data.indexedText } : {}),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.priceItem.delete({ where: { id } });
  }

  async createMany(data: CreatePriceItemData[]): Promise<number> {
    if (data.length === 0) {
      return 0;
    }

    const result = await prisma.priceItem.createMany({
      data: data.map((item) => ({
        priceListId: item.priceListId,
        primaryCode: item.primaryCode ?? null,
        normalizedCode: item.normalizedCode ?? null,
        description: item.description ?? null,
        amount: item.amount ?? null,
        dynamicData: (item.dynamicData ?? {}) as Prisma.InputJsonValue,
        originalText: item.originalText ?? null,
        indexedText: item.indexedText ?? null,
      })),
    });

    return result.count;
  }

  async deleteByPriceList(priceListId: string): Promise<number> {
    const result = await prisma.priceItem.deleteMany({ where: { priceListId } });
    return result.count;
  }

  async findByPriceListIdCursor(
    priceListId: string,
    cursor: string | undefined,
    take: number,
  ): Promise<PriceItem[]> {
    return prisma.priceItem.findMany({
      where: { priceListId },
      orderBy: [{ id: "asc" }],
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }
}

export const priceItemRepository = new PriceItemRepository();
