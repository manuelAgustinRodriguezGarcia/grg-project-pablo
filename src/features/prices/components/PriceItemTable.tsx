"use client";

import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useTableHeaderScrollProgress } from "@/shared/hooks/useTableHeaderScrollProgress";
import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import { ActiveFilterPills } from "@/features/catalog/components/ActiveFilterPills";
import { toActiveFilterPillsFromState } from "@/features/catalog/utils/column-filter-state";
import { ChevronLeft, ChevronRight, Pencil, Receipt, Trash2, ICON_STROKE } from "@/shared/icons";
import { PriceListTableSearch } from "@/features/prices/components/PriceListTableSearch";
import { PriceCellValue } from "@/features/prices/components/PriceCellValue";
import { PriceColumnHeaderCell } from "@/features/prices/components/PriceColumnHeaderCell";
import type { PriceItemTableColumn } from "@/features/prices/types/price-item-table.types";
import type { PriceItemTableResponse } from "@/features/prices/types/price-item-table.types";
import type { PriceItemTableRow } from "@/features/prices/types/price-item-table.types";
import type { PriceColumnListItem } from "@/features/prices/types/price-column.types";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import filterStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceItemTableProps = {
  data: PriceItemTableResponse | null;
  isLoading: boolean;
  error: string | null;
  canEdit: boolean;
  isAdmin: boolean;
  priceListId: string;
  searchQuery: string;
  listName: string;
  listSearchResetKey: string;
  onSearchSubmit: (value: string) => void;
  enableColumnFilters?: boolean;
  columnFilters?: ColumnFilterInput[];
  onColumnFilterChange?: (
    columnInternalKey: string,
    filter: ColumnFilterInput | null,
  ) => void;
  onClearColumnFilters?: () => void;
  onColumnsChanged?: () => void;
  hasSelectedList: boolean;
  hasAnyLists: boolean;
  onPageChange: (page: number) => void;
  onImportExcel?: () => void;
  onEditItem?: (item: PriceItemTableRow) => void;
  onDeleteItem?: (item: PriceItemTableRow) => void;
  columnDetails: PriceColumnListItem[];
};

function formatHeaderLines(displayName: string): string[] {
  const normalized = displayName.replace(/\r\n/g, "\n").trim();
  if (normalized.includes("\n")) {
    return normalized
      .split("\n")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [normalized];
}

function getCellValue(
  item: PriceItemTableResponse["items"][number],
  column: PriceItemTableColumn,
): unknown {
  if (column.isPrimaryCode) {
    return item.primaryCode;
  }

  if (column.isDescription) {
    return item.description;
  }

  if (column.isPrice) {
    return item.amount;
  }

  return item.dynamicData[column.internalKey];
}

function getPaginationRange(pagination: PriceItemTableResponse["pagination"]): {
  from: number;
  to: number;
} {
  if (pagination.total === 0) {
    return { from: 0, to: 0 };
  }

  const from = (pagination.page - 1) * pagination.pageSize + 1;
  const to = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return { from, to };
}

function getColumnColClass(column: PriceItemTableColumn): string {
  if (column.isPrimaryCode) {
    return styles.colPrimaryCode;
  }

  if (column.isDescription) {
    return styles.colDescription;
  }

  if (column.isPrice) {
    return styles.colPrice;
  }

  return styles.colDynamic;
}

export const PriceItemTable = memo(function PriceItemTable({
  data,
  isLoading,
  error,
  canEdit,
  isAdmin,
  priceListId,
  searchQuery,
  listName,
  listSearchResetKey,
  onSearchSubmit,
  enableColumnFilters = false,
  columnFilters = [],
  onColumnFilterChange,
  onClearColumnFilters,
  onColumnsChanged,
  hasSelectedList,
  hasAnyLists,
  onPageChange,
  onImportExcel,
  onEditItem,
  onDeleteItem,
  columnDetails,
}: PriceItemTableProps) {
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [openFilterColumnId, setOpenFilterColumnId] = useState<string | null>(null);

  useTableHeaderScrollProgress(
    tableWrapRef,
    data ? `${data.items.length}-${data.pagination.page}` : null,
  );

  const sortedColumns = useMemo(() => {
    if (!data) {
      return [];
    }

    return [...data.columns].sort((left, right) => {
      const leftOrder =
        columnDetails.find((column) => column.id === left.id)?.order ?? 0;
      const rightOrder =
        columnDetails.find((column) => column.id === right.id)?.order ?? 0;
      return leftOrder - rightOrder || left.displayName.localeCompare(right.displayName, "es");
    });
  }, [columnDetails, data]);

  const columnDetailsById = useMemo(
    () => new Map(columnDetails.map((column) => [column.id, column])),
    [columnDetails],
  );

  const activeFilterPills = useMemo(
    () =>
      enableColumnFilters && data
        ? toActiveFilterPillsFromState(columnFilters, data.columns)
        : [],
    [columnFilters, data, enableColumnFilters],
  );

  const handleRemoveFilter = useCallback(
    (columnInternalKey: string) => {
      onColumnFilterChange?.(columnInternalKey, null);
    },
    [onColumnFilterChange],
  );

  const firstFilterableColumnId = sortedColumns[0]?.id ?? null;
  const hasActiveFilters = enableColumnFilters && activeFilterPills.length > 0;
  const showListSearch = Boolean(listName);

  const tableToolbar =
    showListSearch || hasActiveFilters ? (
      <div className={filterStyles.tableToolbar}>
        <div className={filterStyles.tableToolbarFilters}>
          {hasActiveFilters ? (
            <ActiveFilterPills
              filters={activeFilterPills}
              onRemove={handleRemoveFilter}
              onClearAll={onClearColumnFilters}
            />
          ) : null}
        </div>
        {showListSearch ? (
          <PriceListTableSearch
            listName={listName}
            onSearchSubmit={onSearchSubmit}
            resetKey={listSearchResetKey}
          />
        ) : null}
      </div>
    ) : null;

  if (!hasAnyLists) {
    return (
      <section className={styles.tablePanel} aria-label="Ítems de precios">
        <div className={styles.tableStatePanel}>
          <Receipt className={styles.tableStateIcon} strokeWidth={ICON_STROKE} aria-hidden />
          <h2 className={styles.tableStateTitle}>No hay listas de precios</h2>
          <p className={styles.tableStateText}>
            Importe un Excel para crear la lista automáticamente.
          </p>
          {isAdmin && onImportExcel ? (
            <div className={styles.emptyStateActions}>
              <button
                type="button"
                className={`${styles.emptyStateCta} ${styles.emptyStateCtaGreen}`}
                onClick={onImportExcel}
              >
                Importar Excel
              </button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (!hasSelectedList) {
    return (
      <section className={styles.tablePanel} aria-label="Ítems de precios">
        <div className={styles.tableStatePanel}>
          <p className={styles.tableStateText}>Seleccioná una lista de precios para ver sus ítems.</p>
        </div>
      </section>
    );
  }

  if (isLoading && !data) {
    return (
      <section className={styles.tablePanel} aria-label="Ítems de precios" aria-busy="true">
        {tableToolbar}
        <div className={`${styles.tableWrap} ${styles.tableWrapLoading}`}>
          <AdminTableSkeleton
            variant="prices"
            label="Cargando ítems de precios"
            rowCount={18}
            fillHeight
          />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.tablePanel} aria-label="Ítems de precios">
        {tableToolbar}
        <div className={styles.tableStatePanel}>
          <p className={styles.tableStateText}>{error}</p>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section
        className={styles.tablePanel}
        aria-label="Ítems de precios"
        aria-busy={isLoading || undefined}
      >
        {tableToolbar}
      </section>
    );
  }

  const showActionsColumn = canEdit && Boolean(onEditItem ?? onDeleteItem);
  const { pagination, items } = data;
  const { from, to } = getPaginationRange(pagination);
  const trimmedSearchQuery = searchQuery.trim();
  const hasSearchOrFilters = trimmedSearchQuery.length > 0 || activeFilterPills.length > 0;

  return (
    <section
      className={styles.tablePanel}
      aria-label="Ítems de precios"
      aria-busy={isLoading || undefined}
    >
      {tableToolbar}
      <div
        ref={tableWrapRef}
        className={`${styles.tableWrap} ${items.length === 0 ? styles.tableWrapEmpty : ""} ${isLoading ? filterStyles.tableWrapRefreshing : ""}`}
      >
        {isLoading ? (
          <div
            className={filterStyles.tableRefreshOverlay}
            role="status"
            aria-label="Actualizando ítems de precios"
          />
        ) : null}
        {items.length === 0 ? (
          <div className={styles.tableStatePanel}>
            <Receipt className={styles.tableStateIcon} strokeWidth={ICON_STROKE} aria-hidden />
            <h2 className={styles.tableStateTitle}>
              {hasSearchOrFilters
                ? trimmedSearchQuery
                  ? `Sin resultados para «${trimmedSearchQuery}»`
                  : "Sin resultados para los filtros aplicados"
                : "Esta lista está vacía"}
            </h2>
            {hasSearchOrFilters ? (
              <p className={styles.tableStateText}>
                Probá con otro término o limpiá la búsqueda y los filtros.
              </p>
            ) : null}
          </div>
        ) : (
          <table className={styles.priceTable}>
            <colgroup>
              {sortedColumns.map((column) => (
                <col key={column.id} className={getColumnColClass(column)} />
              ))}
              {showActionsColumn ? <col className={styles.colActions} /> : null}
            </colgroup>
            <thead>
              <tr>
                {sortedColumns.map((column) => {
                  const columnDetail = columnDetailsById.get(column.id);
                  const activeFilter = columnFilters.find(
                    (filter) => filter.columnInternalKey === column.internalKey,
                  );

                  return (
                    <PriceColumnHeaderCell
                      key={column.id}
                      column={column}
                      columnDetail={columnDetail}
                      priceListId={priceListId}
                      headerLines={formatHeaderLines(column.displayName)}
                      enableColumnFilters={enableColumnFilters}
                      activeFilter={activeFilter}
                      onFilterChange={
                        onColumnFilterChange
                          ? (filter) => onColumnFilterChange(column.internalKey, filter)
                          : undefined
                      }
                      isFilterMenuOpen={openFilterColumnId === column.id}
                      onFilterMenuOpen={() => setOpenFilterColumnId(column.id)}
                      onFilterMenuClose={() => setOpenFilterColumnId(null)}
                      alignFilterPopoverStart={column.id === firstFilterableColumnId}
                      isAdmin={isAdmin}
                      onColumnsChanged={onColumnsChanged}
                    />
                  );
                })}
                {showActionsColumn ? (
                  <th scope="col" className={styles.actionsColumn}>
                    Acciones
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className={styles.tbodyFade}>
              {items.map((item) => (
                <tr key={item.id}>
                  {sortedColumns.map((column) => (
                    <td
                      key={`${item.id}-${column.id}`}
                      className={column.isDescription ? styles.descriptionCell : undefined}
                    >
                      <PriceCellValue column={column} value={getCellValue(item, column)} />
                    </td>
                  ))}
                  {showActionsColumn ? (
                    <td className={styles.actionsColumn}>
                      <div className={styles.rowActions}>
                        {onEditItem ? (
                          <button
                            type="button"
                            className={styles.rowActionButton}
                            onClick={() => onEditItem(item)}
                            aria-label="Editar ítem"
                          >
                            <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                          </button>
                        ) : null}
                        {onDeleteItem ? (
                          <button
                            type="button"
                            className={styles.rowActionButton}
                            onClick={() => onDeleteItem(item)}
                            aria-label="Eliminar ítem"
                          >
                            <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {items.length > 0 ? (
        <footer className={styles.tableFooter}>
          <p className={styles.tableSummary}>
            {trimmedSearchQuery
              ? `${pagination.total.toLocaleString("es-AR")} resultados para «${trimmedSearchQuery}»`
              : hasActiveFilters
                ? `${pagination.total.toLocaleString("es-AR")} resultados con filtros`
                : `Mostrando ${from} a ${to} de ${pagination.total.toLocaleString("es-AR")} ítems`}
          </p>

          <div className={styles.tablePagination}>
            <button
              type="button"
              className={styles.paginationButton}
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => onPageChange(pagination.page - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft strokeWidth={ICON_STROKE} aria-hidden />
            </button>

            <span className={styles.paginationLabel}>
              Página {pagination.page} de {Math.max(pagination.totalPages, 1)}
            </span>

            <button
              type="button"
              className={styles.paginationButton}
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => onPageChange(pagination.page + 1)}
              aria-label="Página siguiente"
            >
              <ChevronRight strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          </div>
        </footer>
      ) : null}
    </section>
  );
});
