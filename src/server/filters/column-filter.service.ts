import { z } from "zod";
import type { FolderColumn } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { ProductError } from "@/server/services/product.errors";
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

export type PartitionedColumnFilters = {
  prismaFilters: ColumnFilterInput[];
  jsonTextFilters: JsonTextColumnFilter[];
};

function operatorLabel(operator: ColumnFilterOperator): string {
  switch (operator) {
    case "contains":
      return "contiene";
    case "equals":
      return "=";
    default: {
      const exhaustive: never = operator;
      return exhaustive;
    }
  }
}

function getDynamicValue(
  dynamicData: unknown,
  key: string,
): unknown {
  if (
    typeof dynamicData !== "object" ||
    dynamicData === null ||
    Array.isArray(dynamicData)
  ) {
    return null;
  }

  return (dynamicData as Record<string, unknown>)[key] ?? null;
}

function isJsonTextDynamicFilter(
  column: FolderColumn,
  filter: ColumnFilterInput,
): boolean {
  return (
    !column.isPrimaryCode &&
    !column.isDescription &&
    column.dataType === "TEXT" &&
    column.internalKey === filter.columnInternalKey
  );
}

function buildDynamicDataCondition(
  columnInternalKey: string,
  operator: ColumnFilterOperator,
  value: string,
  dataType: FolderColumn["dataType"],
): Prisma.ProductWhereInput {
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

export class ColumnFilterService {
  parseFilters(raw: unknown): ColumnFilterInput[] {
    if (raw === undefined || raw === null || raw === "") {
      return [];
    }

    let parsedRaw: unknown = raw;
    if (typeof raw === "string") {
      try {
        parsedRaw = JSON.parse(raw);
      } catch {
        throw new ProductError("Formato de filtros inválido.", "VALIDATION_ERROR");
      }
    }

    const parsed = columnFiltersSchema.safeParse(parsedRaw);
    if (!parsed.success) {
      throw new ProductError(
        parsed.error.issues[0]?.message ?? "Filtros inválidos.",
        "VALIDATION_ERROR",
      );
    }

    return parsed.data;
  }

  validateFiltersForColumns(
    filters: ColumnFilterInput[],
    columns: FolderColumn[],
    allowedKeys: string[],
    options?: { requireFilterableColumn?: boolean },
  ): void {
    const requireFilterableColumn = options?.requireFilterableColumn ?? true;
    const columnsByKey = new Map(columns.map((column) => [column.internalKey, column]));

    for (const filter of filters) {
      if (!allowedKeys.includes(filter.columnInternalKey)) {
        throw new ProductError(
          `La columna "${filter.columnInternalKey}" no admite filtros en esta carpeta.`,
          "VALIDATION_ERROR",
        );
      }

      const column = columnsByKey.get(filter.columnInternalKey);
      if (requireFilterableColumn && !column?.isFilterable) {
        throw new ProductError(
          `La columna "${column?.displayName ?? filter.columnInternalKey}" no es filtrable.`,
          "VALIDATION_ERROR",
        );
      }
    }
  }

  partitionFilters(
    filters: ColumnFilterInput[],
    columns: FolderColumn[],
  ): PartitionedColumnFilters {
    const columnsByKey = new Map(columns.map((column) => [column.internalKey, column]));
    const prismaFilters: ColumnFilterInput[] = [];
    const jsonTextFilters: JsonTextColumnFilter[] = [];

    for (const filter of filters) {
      const column = columnsByKey.get(filter.columnInternalKey);
      if (!column) {
        continue;
      }

      if (isJsonTextDynamicFilter(column, filter)) {
        jsonTextFilters.push(filter);
        continue;
      }

      prismaFilters.push(filter);
    }

    return { prismaFilters, jsonTextFilters };
  }

  buildFilterWhere(
    filters: ColumnFilterInput[],
    columns: FolderColumn[],
  ): Prisma.ProductWhereInput {
    if (filters.length === 0) {
      return {};
    }

    const columnsByKey = new Map(columns.map((column) => [column.internalKey, column]));
    const andConditions: Prisma.ProductWhereInput[] = [];

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

      andConditions.push(
        buildDynamicDataCondition(
          filter.columnInternalKey,
          filter.operator,
          filter.value,
          column.dataType,
        ),
      );
    }

    return andConditions.length === 1
      ? andConditions[0]!
      : { AND: andConditions };
  }

  toActiveFilterPills(
    filters: ColumnFilterInput[],
    columns: FolderColumn[],
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
        label: `${displayName} ${operatorLabel(filter.operator)} "${filter.value}"`,
      };
    });
  }

  buildGlobalFieldFilterWhere(
    columns: FolderColumn[],
    globalFieldKey: string,
    value: string,
  ): Prisma.ProductWhereInput {
    const matchingColumns = columns.filter(
      (column) =>
        column.globalFieldKey === globalFieldKey && column.isGloballyFilterable,
    );

    if (matchingColumns.length === 0) {
      return { id: { in: [] } };
    }

    return {
      OR: matchingColumns.map((column) =>
        buildDynamicDataCondition(column.internalKey, "contains", value, column.dataType),
      ),
    };
  }
}

export const columnFilterService = new ColumnFilterService();

export { getDynamicValue };
