"use client";

import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import { CatalogGlobalSearchResultRow } from "@/features/catalog/components/CatalogGlobalSearchResultRow";
import type {
  CatalogSearchHit,
  FolderSearchHit,
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
  onSelectCatalog: (catalogId: string) => void;
  onSelectFolder: (catalogId: string, folderId: string) => void;
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

function formatOptionalText(value: string | null): string {
  return value?.trim() ? value.trim() : "Sin descripción";
}

function CatalogHitRow({
  catalog,
  onSelect,
}: {
  catalog: CatalogSearchHit;
  onSelect: (catalogId: string) => void;
}) {
  return (
    <li className={styles.searchEntityItem}>
      <button
        type="button"
        className={styles.searchEntityButton}
        onClick={() => onSelect(catalog.catalogId)}
      >
        <span className={styles.searchEntityType}>Catálogo</span>
        <span className={styles.searchEntityTitle}>{catalog.name}</span>
        <span className={styles.searchEntityMeta}>
          {formatOptionalText(catalog.description)}
        </span>
      </button>
    </li>
  );
}

function FolderHitRow({
  folder,
  onSelect,
}: {
  folder: FolderSearchHit;
  onSelect: (catalogId: string, folderId: string) => void;
}) {
  return (
    <li className={styles.searchEntityItem}>
      <button
        type="button"
        className={styles.searchEntityButton}
        onClick={() => onSelect(folder.catalog.id, folder.folderId)}
      >
        <span className={styles.searchEntityType}>Sección</span>
        <span className={styles.searchEntityTitle}>{folder.name}</span>
        <span className={styles.searchEntityMeta}>
          {folder.catalog.name} · {formatOptionalText(folder.description)}
        </span>
      </button>
    </li>
  );
}

export function CatalogGlobalSearchResults({
  data,
  searchQuery,
  isLoading,
  error,
  onPageChange,
  onSelectCatalog,
  onSelectFolder,
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

  const catalogs = data.catalogs ?? [];
  const folders = data.folders ?? [];
  const { items, pagination } = data;
  const { from, to } = getPaginationRange(pagination);
  const hasEntityResults = catalogs.length > 0 || folders.length > 0;
  const hasProductResults = items.length > 0;
  const hasAnyResults = hasEntityResults || hasProductResults;
  const totalEntityResults = catalogs.length + folders.length;

  return (
    <section className={styles.tablePanel} aria-label="Resultados de búsqueda global">
      <div className={!hasAnyResults ? styles.tableWrapEmpty : styles.tableWrap}>
        {!hasAnyResults ? (
          <div className={styles.tableEmpty}>
            <Search className={styles.tableEmptyIcon} strokeWidth={ICON_STROKE} aria-hidden />
            <p className={styles.tableEmptyText}>
              Sin resultados para «{searchQuery.trim()}»
            </p>
          </div>
        ) : (
          <div className={styles.searchResultsStack}>
            {catalogs.length > 0 ? (
              <section className={styles.searchEntitySection} aria-label="Catálogos encontrados">
                <h2 className={styles.searchEntityHeading}>Catálogos</h2>
                <ul className={styles.searchEntityList}>
                  {catalogs.map((catalog) => (
                    <CatalogHitRow
                      key={catalog.catalogId}
                      catalog={catalog}
                      onSelect={onSelectCatalog}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {folders.length > 0 ? (
              <section className={styles.searchEntitySection} aria-label="Secciones encontradas">
                <h2 className={styles.searchEntityHeading}>Secciones</h2>
                <ul className={styles.searchEntityList}>
                  {folders.map((folder) => (
                    <FolderHitRow
                      key={folder.folderId}
                      folder={folder}
                      onSelect={onSelectFolder}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {hasProductResults ? (
              <section className={styles.searchProductsSection} aria-label="Productos encontrados">
                <h2 className={styles.searchEntityHeading}>Productos</h2>
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
              </section>
            ) : null}
          </div>
        )}
      </div>

      <footer className={styles.tableFooter}>
        <p className={styles.tableSummary}>
          {!hasAnyResults
            ? `0 resultados para «${searchQuery.trim()}»`
            : `${totalEntityResults.toLocaleString("es-AR")} catálogos/secciones y ${pagination.total.toLocaleString("es-AR")} productos${hasProductResults ? ` (mostrando ${from} a ${to})` : ""} para «${searchQuery.trim()}»`}
        </p>

        {pagination.total > 0 ? (
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
        ) : null}
      </footer>
    </section>
  );
}
