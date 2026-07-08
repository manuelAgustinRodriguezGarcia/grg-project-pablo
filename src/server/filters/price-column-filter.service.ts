import { z } from "zod";
import type { PriceColumn } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/generated/prisma/client";
import { PriceItemError } from "@/server/services/price-item.errors";
import type {
  ActiveFilterPill,
  ColumnFilterInput,
  ColumnFilterOperator,
  JsonTextColumnFilter,
} from "./column-filter.types";

const columnFilterSchema = z.object({
  columnInternalKey: z.string().trim().min(1),
  operator: z.enum(["contains", "equals"]),
  value: z.string().trim().min(1).max(200),
});

const columnFiltersSchema = z
  .array(columnFilterSchema)
  .max(20, "No se pueden aplicar más de 20 filtros.");

export type PartitionedPriceColumnFilters = {
  prismaFilters: ColumnFilterInput[];
  jsonTextFilters: JsonTextColumnFilter[];
  amountContainsFilters: JsonTextColumnFilter[];
};

function formatActiveFilterLabel(displayName: string, value: string): string {
  return `${displayName}: "${value}"`;
}

function isJsonTextDynamicFilter(
  column: PriceColumn,
  filter: ColumnFilterInput,
): boolean {
  return (
    !column.isPrimaryCode &&
    !column.isDescription &&
    !column.isPrice &&
    column.dataType === "TEXT" &&
    column.internalKey === filter.columnInternalKey
  );
}

function isAmountContainsFilter(
  column: PriceColumn,
  filter: ColumnFilterInput,
): boolean {
  return column.isPrice && filter.operator === "contains";
}

function buildDynamicDataCondition(
  columnInternalKey: string,
  operator: ColumnFilterOperator,
  value: string,
  dataType: PriceColumn["dataType"],
): Prisma.PriceItemWhereInput {
  if (dataType === "NUMBER" && operator === "equals") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      return {
        dynamicData: {
          path: [columnInternalKey],
          equals: numeric,
        },
      };
    }
  }

  if (operator === "equals") {
    return {
      dynamicData: {
        path: [columnInternalKey],
        equals: value,
      },
    };
  }

  return {
    dynamicData: {
      path: [columnInternalKey],
      string_contains: value,
    },
  };
}

export class PriceColumnFilterService {
  parseFilters(raw: unknown): ColumnFilterInput[] {
    if (raw === undefined || raw === null || raw === "") {
      return [];
    }

    let parsedRaw: unknown = raw;
    if (typeof raw === "string") {
      try {
        parsedRaw = JSON.parse(raw);
      } catch {
        throw new PriceItemError("Formato de filtros inválido.", "VALIDATION_ERROR");
      }
    }

    const parsed = columnFiltersSchema.safeParse(parsedRaw);
    if (!parsed.success) {
      throw new PriceItemError(
        parsed.error.issues[0]?.message ?? "Filtros inválidos.",
        "VALIDATION_ERROR",
      );
    }

    return parsed.data;
  }

  validateFiltersForColumns(
    filters: ColumnFilterInput[],
    columns: PriceColumn[],
    allowedKeys: string[],
    options?: { requireFilterableColumn?: boolean },
  ): void {
    const requireFilterableColumn = options?.requireFilterableColumn ?? true;
    const columnsByKey = new Map(columns.map((column) => [column.internalKey, column]));

    for (const filter of filters) {
      if (!allowedKeys.includes(filter.columnInternalKey)) {
        throw new PriceItemError(
          `La columna "${filter.columnInternalKey}" no admite filtros en esta lista.`,
          "VALIDATION_ERROR",
        );
      }

      const column = columnsByKey.get(filter.columnInternalKey);
      if (requireFilterableColumn && !column?.isFilterable) {
        throw new PriceItemError(
          `La columna "${column?.displayName ?? filter.columnInternalKey}" no es filtrable.`,
          "VALIDATION_ERROR",
        );
      }
    }
  }

  partitionFilters(
    filters: ColumnFilterInput[],
    columns: PriceColumn[],
  ): PartitionedPriceColumnFilters {
    const columnsByKey = new Map(columns.map((column) => [column.internalKey, column]));
    const prismaFilters: ColumnFilterInput[] = [];
    const jsonTextFilters: JsonTextColumnFilter[] = [];
    const amountContainsFilters: JsonTextColumnFilter[] = [];

    for (const filter of filters) {
      const column = columnsByKey.get(filter.columnInternalKey);
      if (!column) {
        continue;
      }

      if (isJsonTextDynamicFilter(column, filter)) {
        jsonTextFilters.push(filter);
        continue;
      }

      if (isAmountContainsFilter(column, filter)) {
        amountContainsFilters.push(filter);
        continue;
      }

      prismaFilters.push(filter);
    }

    return { prismaFilters, jsonTextFilters, amountContainsFilters };
  }

  buildFilterWhere(
    filters: ColumnFilterInput[],
    columns: PriceColumn[],
  ): Prisma.PriceItemWhereInput {
    if (filters.length === 0) {
      return {};
    }

    const columnsByKey = new Map(columns.map((column) => [column.internalKey, column]));
    const andConditions: Prisma.PriceItemWhereInput[] = [];

    for (const filter of filters) {
      const column = columnsByKey.get(filter.columnInternalKey);
      if (!column) {
        continue;
      }

      if (column.isPrimaryCode) {
        andConditions.push(
          filter.operator === "equals"
            ? {
                primaryCode: {
                  equals: filter.value,
                  mode: "insensitive",
                },
              }
            : {
                primaryCode: {
                  contains: filter.value,
                  mode: "insensitive",
                },
              },
        );
        continue;
      }

      if (column.isDescription) {
        andConditions.push(
          filter.operator === "equals"
            ? {
                description: {
                  equals: filter.value,
                  mode: "insensitive",
                },
              }
            : {
                description: {
                  contains: filter.value,
                  mode: "insensitive",
                },
              },
        );
        continue;
      }

      if (column.isPrice) {
        if (filter.operator === "equals") {
          try {
            andConditions.push({
              amount: {
                equals: new PrismaNamespace.Decimal(filter.value.replace(",", ".")),
              },
            });
          } catch {
            andConditions.push({ id: { in: [] } });
          }
        }
        continue;
      }

      andConditions.push(
        buildDynamicDataCondition(
          filter.columnInternalKey,
          filter.operator,
          filter.value,
          column.dataType,
        ),
      );
    }

    return andConditions.length === 1 ? andConditions[0]! : { AND: andConditions };
  }

  toActiveFilterPills(
    filters: ColumnFilterInput[],
    columns: PriceColumn[],
  ): ActiveFilterPill[] {
    const columnsByKey = new Map(columns.map((column) => [column.internalKey, column]));

    return filters.map((filter) => {
      const column = columnsByKey.get(filter.columnInternalKey);
      const displayName = column?.displayName ?? filter.columnInternalKey;

      return {
        id: filter.columnInternalKey,
        columnInternalKey: filter.columnInternalKey,
        columnDisplayName: displayName,
        operator: filter.operator,
        value: filter.value,
        label: formatActiveFilterLabel(displayName, filter.value),
      };
    });
  }
}

export const priceColumnFilterService = new PriceColumnFilterService();
