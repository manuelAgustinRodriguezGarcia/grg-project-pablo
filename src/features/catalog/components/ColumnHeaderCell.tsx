"use client";

import { useRef } from "react";
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
  isFilterMenuOpen?: boolean;
  onFilterMenuOpen?: () => void;
  onFilterMenuClose?: () => void;
  alignFilterPopoverStart?: boolean;
  isAdmin?: boolean;
  onColumnsChanged?: () => void;
};

export function ColumnHeaderCell({
  column,
  headerLines,
  enableColumnFilters = false,
  activeFilter,
  onFilterChange,
  isFilterMenuOpen = false,
  onFilterMenuOpen,
  onFilterMenuClose,
  alignFilterPopoverStart = false,
  isAdmin = false,
  onColumnsChanged,
}: ColumnHeaderCellProps) {
  const headerRef = useRef<HTMLTableCellElement>(null);
  const isImageCode = isImageCodeColumn(column);
  const showFilterMenu =
    enableColumnFilters && Boolean(onFilterChange) && !isImageCode;
  const showVisibilityOnlyMenu =
    isAdmin && Boolean(onColumnsChanged) && isImageCode;
  const showColumnMenu = showFilterMenu || showVisibilityOnlyMenu;
  const hasActiveFilter = Boolean(activeFilter?.value);
  const isHiddenForNormalUser = isAdmin && !column.visibleToNormalUser;

  return (
    <th
      ref={headerRef}
      scope="col"
      className={`${styles.tableDataCell} ${showColumnMenu ? styles.tableHeaderFilterable : ""} ${hasActiveFilter ? styles.tableHeaderFiltered : ""} ${isFilterMenuOpen ? styles.tableHeaderFilterOpen : ""} ${isHiddenForNormalUser ? styles.tableColumnHidden : ""}`}
      onDoubleClick={(event) => {
        if (!showColumnMenu) {
          return;
        }

        event.preventDefault();
        onFilterMenuOpen?.();
      }}
    >
      <div className={styles.tableHeaderContent}>
        <span className={styles.tableHeaderLabel}>
          {headerLines.map((line, lineIndex) => (
            <span key={`${column.id}-${lineIndex}`} className={styles.tableHeaderLine}>
              {line}
            </span>
          ))}
        </span>
        {showColumnMenu ? (
          <ColumnFilterMenu
            column={column}
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
            isOpen={isFilterMenuOpen}
            anchorRef={headerRef}
            onOpenChange={(open) => {
              if (open) {
                onFilterMenuOpen?.();
                return;
              }

              onFilterMenuClose?.();
            }}
            alignPopover={alignFilterPopoverStart ? "start" : "center"}
            mode={showVisibilityOnlyMenu ? "visibility-only" : "filter"}
            isAdmin={isAdmin}
            onColumnsChanged={onColumnsChanged}
          />
        ) : null}
      </div>
    </th>
  );
}
