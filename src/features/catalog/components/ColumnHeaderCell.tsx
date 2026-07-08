"use client";

import type { ColumnListItem } from "@/features/catalog/types/column.types";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import { ColumnFilterMenu } from "@/features/catalog/components/ColumnFilterMenu";
import { isImageCodeColumn } from "@/features/catalog/utils/product-table-columns";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ColumnHeaderCellProps = {
  column: ColumnListItem;
  headerLines: string[];
  enableColumnFilters?: boolean;
  activeFilter?: ColumnFilterInput;
  onFilterChange?: (filter: ColumnFilterInput | null) => void;
  isAdmin?: boolean;
  onColumnsChanged?: () => void;
};

export function ColumnHeaderCell({
  column,
  headerLines,
  enableColumnFilters = false,
  activeFilter,
  onFilterChange,
  isAdmin = false,
  onColumnsChanged,
}: ColumnHeaderCellProps) {
  const showFilterMenu =
    enableColumnFilters && Boolean(onFilterChange) && !isImageCodeColumn(column);
  const hasActiveFilter = Boolean(activeFilter?.value);
  const isHiddenForNormalUser = isAdmin && !column.visibleToNormalUser;

  return (
    <th
      scope="col"
      className={`${styles.tableDataCell} ${showFilterMenu ? styles.tableHeaderFilterable : ""} ${hasActiveFilter ? styles.tableHeaderFiltered : ""} ${isHiddenForNormalUser ? styles.tableColumnHidden : ""}`}
    >
      <div className={styles.tableHeaderContent}>
        <span className={styles.tableHeaderLabel}>
          {headerLines.map((line, lineIndex) => (
            <span key={`${column.id}-${lineIndex}`} className={styles.tableHeaderLine}>
              {line}
            </span>
          ))}
        </span>
        {showFilterMenu && onFilterChange ? (
          <ColumnFilterMenu
            column={column}
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
            isAdmin={isAdmin}
            onColumnsChanged={onColumnsChanged}
          />
        ) : null}
      </div>
    </th>
  );
}
