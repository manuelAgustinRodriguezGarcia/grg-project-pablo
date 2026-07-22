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
    showFilterMenu ? styles.tableHeaderFilterable : undefined,
    hasActiveFilter ? styles.tableHeaderFiltered : undefined,
    isFilterMenuOpen ? styles.tableHeaderFilterOpen : undefined,
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
        // USUARIO: evitar que el <th> robe el foco al abrir el filtro,
        // así el input puede quedar enfocado de inmediato.
        if (!showFilterMenu || isAdmin) {
          return;
        }

        if (!headerRef.current?.contains(event.target as Node)) {
          return;
        }

        if (!isFilterMenuOpen) {
          event.preventDefault();
        }
      }}
      onClick={(event) => {
        if (!showFilterMenu) {
          return;
        }

        // Portaled popovers still bubble in the React tree. Ignore clicks
        // that did not originate inside the header cell DOM.
        if (!headerRef.current?.contains(event.target as Node)) {
          return;
        }

        event.preventDefault();

        if (isFilterMenuOpen) {
          onFilterMenuClose?.();
          return;
        }

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
