import {
  formatBetweenFilterLabel,
} from "@/server/filters/column-filter-range";
import type {
  ActiveFilterPill,
  ColumnFilterInput,
} from "@/server/filters/column-filter.types";

function formatActiveFilterLabel(
  displayName: string,
  filter: ColumnFilterInput,
): string {
  if (filter.operator === "between") {
    return (
      formatBetweenFilterLabel(displayName, filter.value) ??
      `${displayName}: ${filter.value}`
    );
  }

  return `${displayName}: "${filter.value}"`;
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
  columns: Array<{ internalKey: string; displayName: string }>,
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
      label: formatActiveFilterLabel(displayName, filter),
    };
  });
}
