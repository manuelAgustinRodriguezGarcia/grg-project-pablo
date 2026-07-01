import type {
  ActiveFilterPill,
  ColumnFilterInput,
  ColumnFilterOperator,
} from "@/server/filters/column-filter.types";
import type { ColumnListItem } from "@/features/catalog/types/column.types";

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

export function upsertColumnFilter(
  filters: ColumnFilterInput[],
  columnInternalKey: string,
  filter: ColumnFilterInput | null,
): ColumnFilterInput[] {
  const otherFilters = filters.filter(
    (entry) => entry.columnInternalKey !== columnInternalKey,
  );

  return filter ? [...otherFilters, filter] : otherFilters;
}

export function serializeColumnFilters(filters: ColumnFilterInput[]): string {
  return JSON.stringify(
    [...filters].sort((left, right) =>
      left.columnInternalKey.localeCompare(right.columnInternalKey),
    ),
  );
}

export function toActiveFilterPillsFromState(
  filters: ColumnFilterInput[],
  columns: Pick<ColumnListItem, "internalKey" | "displayName">[],
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
