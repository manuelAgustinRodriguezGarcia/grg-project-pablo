"use client";

import type { ColumnListItem } from "@/features/catalog/types/column.types";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import { ColumnFilterMenu } from "@/features/catalog/components/ColumnFilterMenu";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ColumnHeaderCellProps = {
  column: ColumnListItem;
  headerLines: string[];
  enableColumnFilters?: boolean;
  activeFilter?: ColumnFilterInput;
  onFilterChange?: (filter: ColumnFilterInput | null) => void;
};

export function ColumnHeaderCell({
  column,
  headerLines,
  enableColumnFilters = false,
  activeFilter,
  onFilterChange,
}: ColumnHeaderCellProps) {
  const showFilterMenu = enableColumnFilters && Boolean(onFilterChange);
  const hasActiveFilter = Boolean(activeFilter?.value);

  return (
    <th
      scope="col"
      className={`${styles.tableDataCell} ${showFilterMenu ? styles.tableHeaderFilterable : ""} ${hasActiveFilter ? styles.tableHeaderFiltered : ""}`}
    >
      <div className={styles.tableHeaderContent}>
        <span className={styles.tableHeaderLabel}>
          {headerLines.map((line, lineIndex) => (
            <span key={`${column.id}-${lineIndex}`} className={styles.tableHeaderLine}>
              {line}
            </span>
          ))}
        </span>
        {showFilterMenu ? (
          <ColumnFilterMenu
            column={column}
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
          />
        ) : null}
      </div>
    </th>
  );
}
