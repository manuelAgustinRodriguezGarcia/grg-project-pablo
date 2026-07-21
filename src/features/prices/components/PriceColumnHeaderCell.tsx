"use client";

import { useRef } from "react";
import { PriceColumnFilterMenu } from "@/features/prices/components/PriceColumnFilterMenu";
import type { PriceColumnListItem } from "@/features/prices/types/price-column.types";
import type { PriceItemTableColumn } from "@/features/prices/types/price-item-table.types";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import filterStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceColumnHeaderCellProps = {
  column: PriceItemTableColumn;
  columnDetail?: PriceColumnListItem;
  priceListId: string;
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

export function PriceColumnHeaderCell({
  column,
  columnDetail,
  priceListId,
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
}: PriceColumnHeaderCellProps) {
  const headerRef = useRef<HTMLTableCellElement>(null);
  const showFilterMenu = enableColumnFilters && Boolean(onFilterChange) && Boolean(columnDetail);
  const hasActiveFilter = Boolean(activeFilter?.value);
  const isHiddenForNormalUser = isAdmin && !column.visibleToNormalUser;

  const thClassName = [
    column.isPrice ? styles.priceHeaderPrice : undefined,
    showFilterMenu ? filterStyles.tableHeaderFilterable : undefined,
    hasActiveFilter ? filterStyles.tableHeaderFiltered : undefined,
    isFilterMenuOpen ? filterStyles.tableHeaderFilterOpen : undefined,
    isHiddenForNormalUser ? filterStyles.tableColumnHidden : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <th
      ref={headerRef}
      scope="col"
      className={thClassName || undefined}
      onMouseDown={(event) => {
        if (!showFilterMenu || isAdmin || isFilterMenuOpen) {
          return;
        }

        if (!headerRef.current?.contains(event.target as Node)) {
          return;
        }

        event.preventDefault();
      }}
      onDoubleClick={(event) => {
        if (!showFilterMenu) {
          return;
        }

        event.preventDefault();
        onFilterMenuOpen?.();
      }}
    >
      <div className={filterStyles.tableHeaderContent}>
        <span className={styles.tableHeaderLabel}>
          {headerLines.map((line, index) => (
            <span key={`${column.id}-${index}`} className={styles.tableHeaderLine}>
              {line}
            </span>
          ))}
        </span>
        {showFilterMenu && columnDetail ? (
          <PriceColumnFilterMenu
            column={columnDetail}
            priceListId={priceListId}
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
            isAdmin={isAdmin}
            onColumnsChanged={onColumnsChanged}
          />
        ) : null}
      </div>
    </th>
  );
}
