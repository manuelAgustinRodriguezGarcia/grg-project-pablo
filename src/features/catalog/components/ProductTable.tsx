"use client";

import { ChevronLeft, ChevronRight, ICON_STROKE } from "@/shared/icons";
import type { ProductTableResponse } from "@/features/catalog/types/product-table.types";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ProductTableProps = {
  data: ProductTableResponse | null;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
};

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function getPaginationRange(pagination: ProductTableResponse["pagination"]): {
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

export function ProductTable({
  data,
  isLoading,
  error,
  onPageChange,
}: ProductTableProps) {
  if (isLoading) {
    return (
      <section className={styles.tablePanel} aria-label="Tabla de productos">
        <p className={styles.tableState}>Cargando productos…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.tablePanel} aria-label="Tabla de productos">
        <p className={styles.tableStateError}>{error}</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className={styles.tablePanel} aria-label="Tabla de productos">
        <p className={styles.tableState}>Seleccioná un catálogo y una carpeta.</p>
      </section>
    );
  }

  const sortedColumns = [...data.columns].sort((left, right) => left.order - right.order);
  const { from, to } = getPaginationRange(data.pagination);
  const { pagination } = data;

  return (
    <section className={styles.tablePanel} aria-label="Tabla de productos">
      <div className={styles.tableWrap}>
        <table className={styles.productTable}>
          <thead>
            <tr>
              {sortedColumns.map((column) => (
                <th key={column.id} scope="col">
                  {column.displayName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.products.length === 0 ? (
              <tr>
                <td colSpan={Math.max(sortedColumns.length, 1)} className={styles.tableEmptyCell}>
                  No hay productos en esta carpeta.
                </td>
              </tr>
            ) : (
              data.products.map((product) => (
                <tr key={product.id}>
                  {sortedColumns.map((column) => {
                    let value: unknown;

                    if (column.isPrimaryCode) {
                      value = product.primaryCode;
                    } else if (column.isDescription) {
                      value = product.description;
                    } else {
                      value = product.dynamicData[column.internalKey];
                    }

                    return (
                      <td key={`${product.id}-${column.id}`}>{formatCellValue(value)}</td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className={styles.tableFooter}>
        <p className={styles.tableSummary}>
          Mostrando {from} a {to} de {pagination.total} productos
        </p>

        <div className={styles.tablePagination}>
          <button
            type="button"
            className={styles.paginationButton}
            disabled={pagination.page <= 1}
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
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
            aria-label="Página siguiente"
          >
            <ChevronRight strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>
      </footer>
    </section>
  );
}
