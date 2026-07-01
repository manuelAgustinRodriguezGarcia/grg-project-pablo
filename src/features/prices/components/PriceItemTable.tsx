"use client";

import { useMemo } from "react";
import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import { ChevronLeft, ChevronRight, Pencil, Receipt, Trash2, ICON_STROKE } from "@/shared/icons";
import { PriceCellValue } from "@/features/prices/components/PriceCellValue";
import { PriceColumnHeaderCell } from "@/features/prices/components/PriceColumnHeaderCell";
import type { PriceItemTableColumn } from "@/features/prices/types/price-item-table.types";
import type { PriceItemTableResponse } from "@/features/prices/types/price-item-table.types";
import type { PriceItemTableRow } from "@/features/prices/types/price-item-table.types";
import type { PriceColumnListItem } from "@/features/prices/types/price-column.types";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceItemTableProps = {
  data: PriceItemTableResponse | null;
  isLoading: boolean;
  error: string | null;
  isAdmin: boolean;
  searchQuery: string;
  hasSelectedList: boolean;
  hasAnyLists: boolean;
  onPageChange: (page: number) => void;
  onAddItem: () => void;
  onCreateList: () => void;
  onImportExcel?: () => void;
  onEditItem?: (item: PriceItemTableRow) => void;
  onDeleteItem?: (item: PriceItemTableRow) => void;
  columnDetails: PriceColumnListItem[];
};

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

export function PriceItemTable({
  data,
  isLoading,
  error,
  isAdmin,
  searchQuery,
  hasSelectedList,
  hasAnyLists,
  onPageChange,
  onAddItem,
  onCreateList,
  onImportExcel,
  onEditItem,
  onDeleteItem,
  columnDetails,
}: PriceItemTableProps) {
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

  if (!hasAnyLists) {
    return (
      <section className={styles.tablePanel} aria-label="Ítems de precios">
        <div className={styles.tableStatePanel}>
          <Receipt className={styles.tableStateIcon} strokeWidth={ICON_STROKE} aria-hidden />
          <h2 className={styles.tableStateTitle}>No hay listas de precios</h2>
          <p className={styles.tableStateText}>
            Importá un Excel para crear la lista automáticamente o creá una lista vacía
            manualmente.
          </p>
          {isAdmin ? (
            <div className={styles.emptyStateActions}>
              {onImportExcel ? (
                <button
                  type="button"
                  className={`${styles.emptyStateCta} ${styles.emptyStateCtaGreen}`}
                  onClick={onImportExcel}
                >
                  Importar Excel
                </button>
              ) : null}
              <button type="button" className={styles.emptyStateCta} onClick={onCreateList}>
                Crear lista vacía
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
        <AdminTableSkeleton variant="prices" label="Cargando ítems de precios" />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.tablePanel} aria-label="Ítems de precios">
        <div className={styles.tableStatePanel}>
          <p className={styles.tableStateText}>{error}</p>
        </div>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  const { pagination, columns, items } = data;
  const { from, to } = getPaginationRange(pagination);
  const primaryColumn = columns.find((column) => column.isPrimaryCode);

  return (
    <section className={styles.tablePanel} aria-label="Ítems de precios">
      <div className={styles.tableWrap}>
        {items.length === 0 ? (
          <div className={styles.tableStatePanel}>
            <Receipt className={styles.tableStateIcon} strokeWidth={ICON_STROKE} aria-hidden />
            <h2 className={styles.tableStateTitle}>
              {searchQuery.trim()
                ? `Sin resultados para «${searchQuery.trim()}»`
                : "Esta lista está vacía"}
            </h2>
            <p className={styles.tableStateText}>
              {searchQuery.trim()
                ? "Probá con otro término o limpiá la búsqueda."
                : "Agregá ítems manualmente o importá un Excel."}
            </p>
            {isAdmin && !searchQuery.trim() ? (
              <button type="button" className={styles.emptyStateCta} onClick={onAddItem}>
                Agregar ítem
              </button>
            ) : null}
          </div>
        ) : (
          <table className={styles.priceTable}>
            <thead>
              <tr>
                {sortedColumns.map((column) => (
                  <PriceColumnHeaderCell
                    key={column.id}
                    column={column}
                    isSticky={primaryColumn?.id === column.id}
                  />
                ))}
                {isAdmin && (onEditItem || onDeleteItem) ? (
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
                      className={
                        primaryColumn?.id === column.id ? styles.stickyCodeColumn : undefined
                      }
                    >
                      <PriceCellValue
                        column={column}
                        value={getCellValue(item, column)}
                      />
                    </td>
                  ))}
                  {isAdmin && (onEditItem || onDeleteItem) ? (
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
            {searchQuery.trim()
              ? `${pagination.total.toLocaleString("es-AR")} resultados para «${searchQuery.trim()}»`
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
}
