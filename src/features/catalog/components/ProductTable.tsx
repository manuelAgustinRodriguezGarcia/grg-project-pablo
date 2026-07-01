"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import { ChevronLeft, ChevronRight, File, ICON_STROKE } from "@/shared/icons";
import type {
  ProductTablePrimaryImage,
  ProductTableItem,
  ProductTableResponse,
} from "@/features/catalog/types/product-table.types";
import { ActiveFilterPills } from "@/features/catalog/components/ActiveFilterPills";
import { ColumnHeaderCell } from "@/features/catalog/components/ColumnHeaderCell";
import { ProductImagePreviewModal } from "./ProductImagePreviewModal";
import { getProductTableColumns } from "@/features/catalog/utils/product-table-columns";
import { toActiveFilterPillsFromState } from "@/features/catalog/utils/column-filter-state";
import { normalizeMultilineText } from "@/shared/text/normalize-multiline-text";
import type { ColumnFilterInput } from "@/server/filters/column-filter.types";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ProductTableProps = {
  data: ProductTableResponse | null;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  enableColumnFilters?: boolean;
  columnFilters?: ColumnFilterInput[];
  onColumnFilterChange?: (
    columnInternalKey: string,
    filter: ColumnFilterInput | null,
  ) => void;
  onClearColumnFilters?: () => void;
};

function formatTableHeaderLines(displayName: string): string[] {
  const normalized = displayName.replace(/\r\n/g, "\n").trim();
  const bracketMatch = normalized.match(
    /^([\s\S]+?)\s*(?:\n\s*)?\[\s*([^\]]+?)\s*\]\s*$/,
  );

  if (bracketMatch) {
    return [
      bracketMatch[1].replace(/\n/g, " ").trim(),
      bracketMatch[2].trim(),
    ];
  }

  if (normalized.includes("\n")) {
    const parts = normalized
      .split("\n")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return [parts[0], parts.slice(1).join(" ")];
    }
  }

  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length <= 1) {
    return [words[0] ?? normalized];
  }

  if (words.length === 2) {
    return [words[0], words[1]];
  }

  const splitAt = Math.ceil(words.length / 2);
  return [words.slice(0, splitAt).join(" "), words.slice(splitAt).join(" ")];
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return normalizeMultilineText(String(value));
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

function getProductImagePreviewUrl(
  image: ProductTablePrimaryImage | null | undefined,
): string | null {
  if (!image) {
    return null;
  }

  return image.fullUrl ?? image.thumbnailUrl;
}

function buildProductImageAlt(
  primaryCode: string | null,
  description: string | null,
  columnName?: string,
): string {
  const base =
    primaryCode && description
      ? `${primaryCode} — ${description}`
      : (primaryCode ?? description ?? "Imagen del producto");

  return columnName ? `${base} (${columnName})` : base;
}

function hasColumnImages(
  imagesByColumnKey: ProductTableItem["imagesByColumnKey"],
): boolean {
  return Object.values(imagesByColumnKey).some((images) => images.length > 0);
}

function shouldShowGlobalImageColumn(products: ProductTableItem[]): boolean {
  return products.some(
    (product) =>
      product.primaryImage !== null && !hasColumnImages(product.imagesByColumnKey),
  );
}

export function ProductTable({
  data,
  isLoading,
  error,
  onPageChange,
  enableColumnFilters = false,
  columnFilters = [],
  onColumnFilterChange,
  onClearColumnFilters,
}: ProductTableProps) {
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    alt: string;
    productId: string;
    imageId: string;
  } | null>(null);

  useEffect(() => {
    const tableWrap = tableWrapRef.current;
    if (!tableWrap) {
      return;
    }

    const headerSolidScrollDistance = 56;

    const syncHeaderSolidState = () => {
      const progress = Math.min(1, tableWrap.scrollTop / headerSolidScrollDistance);
      tableWrap.style.setProperty("--header-scroll-progress", progress.toFixed(3));
    };

    syncHeaderSolidState();
    tableWrap.addEventListener("scroll", syncHeaderSolidState, { passive: true });

    return () => {
      tableWrap.removeEventListener("scroll", syncHeaderSolidState);
      tableWrap.style.removeProperty("--header-scroll-progress");
    };
  }, [data?.products.length, data?.pagination.page]);

  const sortedColumns = useMemo(
    () =>
      data
        ? getProductTableColumns(
            [...data.columns].sort((left, right) => left.order - right.order),
          )
        : [],
    [data],
  );
  const showImageColumn = useMemo(
    () => (data ? shouldShowGlobalImageColumn(data.products) : false),
    [data],
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

  const activeFilterCount = activeFilterPills.length;

  if (isLoading && !data) {
    return (
      <section
        className={styles.tablePanel}
        aria-label="Tabla de productos"
        aria-busy="true"
      >
        <div className={styles.tableWrap}>
          <AdminTableSkeleton variant="catalog" label="Cargando productos" />
        </div>
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

  const { from, to } = getPaginationRange(data.pagination);
  const { pagination } = data;

  return (
    <section
      className={styles.tablePanel}
      aria-label="Tabla de productos"
      aria-busy={isLoading || undefined}
    >
      {enableColumnFilters && activeFilterPills.length > 0 ? (
        <ActiveFilterPills
          filters={activeFilterPills}
          onRemove={handleRemoveFilter}
          onClearAll={onClearColumnFilters}
        />
      ) : null}
      <div
        ref={tableWrapRef}
        className={`${styles.tableWrap} ${data.products.length === 0 ? styles.tableWrapEmpty : ""}`}
      >
        {data.products.length === 0 ? (
          <div className={styles.tableEmpty} role="status">
            <File
              className={styles.tableEmptyIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <p className={styles.tableEmptyText}>No hay productos en esta carpeta.</p>
          </div>
        ) : (
        <table className={styles.productTable}>
          <thead>
            <tr>
              {showImageColumn ? (
                <th scope="col" className={styles.tableThumbHeader}>
                  <span className={styles.tableHeaderLabel}>
                    <span className={styles.tableHeaderLine}>Imagen</span>
                  </span>
                </th>
              ) : null}
              {sortedColumns.map((column) => (
                <ColumnHeaderCell
                  key={column.id}
                  column={column}
                  headerLines={formatTableHeaderLines(column.displayName)}
                  enableColumnFilters={enableColumnFilters}
                  activeFilter={columnFilters.find(
                    (filter) => filter.columnInternalKey === column.internalKey,
                  )}
                  onFilterChange={
                    enableColumnFilters
                      ? (filter) => onColumnFilterChange?.(column.internalKey, filter)
                      : undefined
                  }
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {data.products.map((product) => {
                const previewUrl = getProductImagePreviewUrl(product.primaryImage);

                return (
                <tr key={product.id}>
                  {showImageColumn ? (
                    <td className={styles.tableThumbCell}>
                      {previewUrl ? (
                        <button
                          type="button"
                          className={styles.tableThumbButton}
                          onClick={() =>
                            setPreviewImage({
                              url:
                                product.primaryImage?.thumbnailUrl ?? previewUrl,
                              alt: buildProductImageAlt(
                                product.primaryCode,
                                product.description,
                              ),
                              productId: product.id,
                              imageId: product.primaryImage?.id ?? "",
                            })
                          }
                          aria-label={`Ver imagen de ${buildProductImageAlt(
                            product.primaryCode,
                            product.description,
                          )}`}
                        >
                          <img
                            src={product.primaryImage?.thumbnailUrl ?? previewUrl}
                            alt=""
                            className={styles.tableThumb}
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      ) : (
                        <span className={styles.tableThumbEmpty}>—</span>
                      )}
                    </td>
                  ) : null}
                  {sortedColumns.map((column) => {
                    let value: unknown;

                    if (column.isPrimaryCode) {
                      value = product.primaryCode;
                    } else if (column.isDescription) {
                      value = product.description;
                    } else {
                      value = product.dynamicData[column.internalKey];
                    }

                    const columnImages =
                      product.imagesByColumnKey[column.internalKey] ?? [];
                    const textValue = formatCellValue(value);
                    const previewImages = columnImages
                      .map((image) => ({
                        image,
                        url: getProductImagePreviewUrl(image),
                      }))
                      .filter(
                        (entry): entry is { image: ProductTablePrimaryImage; url: string } =>
                          Boolean(entry.url),
                      );

                    return (
                      <td
                        key={`${product.id}-${column.id}`}
                        className={
                          previewImages.length > 0
                            ? `${styles.tableDataCell} ${styles.tableCellWithMedia}`
                            : styles.tableDataCell
                        }
                      >
                        {previewImages.length > 0 ? (
                          <div className={styles.tableCellImages}>
                            {previewImages.map(({ image, url }) => (
                              <button
                                key={image.id}
                                type="button"
                                className={styles.tableCellThumbButton}
                                onClick={() =>
                                  setPreviewImage({
                                    url: image.thumbnailUrl ?? url,
                                    alt: buildProductImageAlt(
                                      product.primaryCode,
                                      product.description,
                                      column.displayName,
                                    ),
                                    productId: product.id,
                                    imageId: image.id,
                                  })
                                }
                                aria-label={`Ver imagen de ${buildProductImageAlt(
                                  product.primaryCode,
                                  product.description,
                                  column.displayName,
                                )}`}
                              >
                                <img
                                  src={image.thumbnailUrl ?? url}
                                  alt=""
                                  className={styles.tableCellThumb}
                                  loading="lazy"
                                  decoding="async"
                                />
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {textValue !== "—" || previewImages.length === 0 ? (
                          <span className={styles.tableCellText}>{textValue}</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
                );
            })}
          </tbody>
        </table>
        )}
      </div>

      <footer className={styles.tableFooter}>
        <p className={styles.tableSummary}>
          Mostrando {from} a {to} de {pagination.total} productos
          {enableColumnFilters && activeFilterCount > 0
            ? ` · ${activeFilterCount} filtros activos`
            : ""}
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

      {previewImage ? (
        <ProductImagePreviewModal
          imageUrl={previewImage.url}
          imageAlt={previewImage.alt}
          productId={previewImage.productId}
          imageId={previewImage.imageId}
          onClose={() => setPreviewImage(null)}
        />
      ) : null}
    </section>
  );
}
