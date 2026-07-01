"use client";

import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import { CatalogGlobalSearchResultRow } from "@/features/catalog/components/CatalogGlobalSearchResultRow";
import type {
  GlobalSearchResponse,
  SearchResultItem,
} from "@/features/catalog/types/global-search.types";
import { ChevronLeft, ChevronRight, Search, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type CatalogGlobalSearchResultsProps = {
  data: GlobalSearchResponse | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onSelectResult: (item: SearchResultItem) => void;
};

function getPaginationRange(pagination: GlobalSearchResponse["pagination"]): {
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

export function CatalogGlobalSearchResults({
  data,
  searchQuery,
  isLoading,
  error,
  onPageChange,
  onSelectResult,
}: CatalogGlobalSearchResultsProps) {
  if (isLoading && !data) {
    return (
      <section className={styles.tablePanel} aria-label="Resultados de búsqueda global" aria-busy="true">
        <AdminTableSkeleton variant="catalog" label="Buscando en catálogos" />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.tablePanel} aria-label="Resultados de búsqueda global">
        <div className={styles.tableEmpty}>
          <p className={styles.tableEmptyText}>{error}</p>
        </div>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  const { items, pagination } = data;
  const { from, to } = getPaginationRange(pagination);

  return (
    <section className={styles.tablePanel} aria-label="Resultados de búsqueda global">
      <div className={items.length === 0 ? styles.tableWrapEmpty : styles.tableWrap}>
        {items.length === 0 ? (
          <div className={styles.tableEmpty}>
            <Search className={styles.tableEmptyIcon} strokeWidth={ICON_STROKE} aria-hidden />
            <p className={styles.tableEmptyText}>
              Sin resultados para «{searchQuery.trim()}»
            </p>
          </div>
        ) : (
          <table className={styles.productTable}>
            <thead>
              <tr>
                <th scope="col" className={styles.tableThumbHeader}>
                  <span className={styles.tableHeaderLabel}>
                    <span className={styles.tableHeaderLine}>Imagen</span>
                  </span>
                </th>
                <th scope="col" className={styles.tableDataCell}>
                  <span className={styles.tableHeaderLabel}>
                    <span className={styles.tableHeaderLine}>Código</span>
                  </span>
                </th>
                <th scope="col" className={styles.tableDataCell}>
                  <span className={styles.tableHeaderLabel}>
                    <span className={styles.tableHeaderLine}>Descripción</span>
                  </span>
                </th>
                <th scope="col" className={styles.tableDataCell}>
                  <span className={styles.tableHeaderLabel}>
                    <span className={styles.tableHeaderLine}>Catálogo</span>
                  </span>
                </th>
                <th scope="col" className={styles.tableDataCell}>
                  <span className={styles.tableHeaderLabel}>
                    <span className={styles.tableHeaderLine}>Carpeta</span>
                  </span>
                </th>
                <th scope="col" className={styles.tableDataCell}>
                  <span className={styles.tableHeaderLabel}>
                    <span className={styles.tableHeaderLine}>Coincidencia</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <CatalogGlobalSearchResultRow
                  key={item.productId}
                  item={item}
                  onSelect={onSelectResult}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <footer className={styles.tableFooter}>
        <p className={styles.tableSummary}>
          {items.length === 0
            ? `0 resultados para «${searchQuery.trim()}»`
            : `Mostrando ${from} a ${to} de ${pagination.total.toLocaleString("es-AR")} resultados para «${searchQuery.trim()}»`}
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
    </section>
  );
}
