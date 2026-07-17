"use client";

import { useRef } from "react";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import { ColumnFilterMenu } from "@/features/catalog/components/ColumnFilterMenu";
import { isImageCodeColumn } from "@/features/catalog/utils/product-table-columns";
import { Info, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const HEADER_CLICK_SUPPRESS_MS = 500;

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
  onColumnsChanged?: () => void | Promise<void>;
};

function columnHasDescription(column: ColumnListItem): boolean {
  return (
    column.hasContextualHelp ||
    Boolean(column.helpText?.trim()) ||
    Boolean(column.helpImagePreviewUrl ?? column.helpImageFullUrl)
  );
}

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
  const suppressHeaderClickUntilRef = useRef(0);
  const blockHeaderInteractionRef = useRef(false);
  const isImageCode = isImageCodeColumn(column);
  const showFilterMenu =
    enableColumnFilters && Boolean(onFilterChange) && !isImageCode;
  const showVisibilityOnlyMenu =
    isAdmin && Boolean(onColumnsChanged) && isImageCode;
  const showColumnMenu = showFilterMenu || showVisibilityOnlyMenu;
  const hasActiveFilter = Boolean(activeFilter?.value);
  const isHiddenForNormalUser = isAdmin && !column.visibleToNormalUser;
  const hasDescription = columnHasDescription(column);

  return (
    <th
      ref={headerRef}
      scope="col"
      className={`${styles.tableDataCell} ${showColumnMenu ? styles.tableHeaderFilterable : ""} ${hasActiveFilter ? styles.tableHeaderFiltered : ""} ${isFilterMenuOpen ? styles.tableHeaderFilterOpen : ""} ${isHiddenForNormalUser ? styles.tableColumnHidden : ""}`}
      onClick={(event) => {
        if (!showColumnMenu) {
          return;
        }

        // Portaled popovers/modals still bubble in the React tree. Ignore
        // clicks that did not originate inside the header cell DOM.
        if (!headerRef.current?.contains(event.target as Node)) {
          return;
        }

        if (
          blockHeaderInteractionRef.current ||
          Date.now() < suppressHeaderClickUntilRef.current
        ) {
          event.preventDefault();
          event.stopPropagation();
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
      {hasDescription ? (
        <span className={styles.tableHeaderInfoWrap}>
          <span
            className={styles.tableHeaderInfoIcon}
            aria-label="Columna con descripción"
          >
            <Info strokeWidth={ICON_STROKE} aria-hidden />
          </span>
          <span className={styles.tableHeaderInfoTooltip} role="tooltip">
            Columna con descripción
          </span>
        </span>
      ) : null}
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
            onBlockHeaderInteractionChange={(blocked) => {
              blockHeaderInteractionRef.current = blocked;
              if (blocked) {
                suppressHeaderClickUntilRef.current =
                  Date.now() + HEADER_CLICK_SUPPRESS_MS;
              }
            }}
          />
        ) : null}
      </div>
    </th>
  );
}
