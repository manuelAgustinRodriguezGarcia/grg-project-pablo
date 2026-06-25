"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, File, ICON_STROKE, TableProperties } from "@/shared/icons";
import type {
  ProductTablePrimaryImage,
  ProductTableItem,
  ProductTableResponse,
} from "@/features/catalog/types/product-table.types";
import { ProductImagePreviewModal } from "./ProductImagePreviewModal";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ProductTableProps = {
  data: ProductTableResponse | null;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
};

function formatTableHeaderLines(displayName: string): string[] {
  const normalized = displayName.replace(/\r\n/g, "\n").trim();
  const bracketMatch = normalized.match(/^(.+?)\s*(?:\n\s*)?\[\s*([^\]]+?)\s*\]\s*$/s);

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
}: ProductTableProps) {
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    alt: string;
  } | null>(null);

  if (isLoading) {
    return (
      <section
        className={`${styles.tablePanel} ${styles.tablePanelLoading}`}
        aria-label="Tabla de productos"
        aria-busy="true"
      >
        <div className={styles.tableLoading} role="status" aria-live="polite">
          <TableProperties
            className={styles.tableLoadingIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <p className={styles.tableLoadingText}>Cargando productos</p>
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

  const sortedColumns = [...data.columns].sort((left, right) => left.order - right.order);
  const showImageColumn = shouldShowGlobalImageColumn(data.products);
  const { from, to } = getPaginationRange(data.pagination);
  const { pagination } = data;

  return (
    <section className={styles.tablePanel} aria-label="Tabla de productos">
      <div
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
              {sortedColumns.map((column) => {
                const headerLines = formatTableHeaderLines(column.displayName);

                return (
                  <th key={column.id} scope="col">
                    <span className={styles.tableHeaderLabel}>
                      {headerLines.map((line, lineIndex) => (
                        <span key={`${column.id}-${lineIndex}`} className={styles.tableHeaderLine}>
                          {line}
                        </span>
                      ))}
                    </span>
                  </th>
                );
              })}
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
                              url: previewUrl,
                              alt: buildProductImageAlt(
                                product.primaryCode,
                                product.description,
                              ),
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
                          previewImages.length > 0 ? styles.tableCellWithMedia : undefined
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
                                    url,
                                    alt: buildProductImageAlt(
                                      product.primaryCode,
                                      product.description,
                                      column.displayName,
                                    ),
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

      {previewImage ? (
        <ProductImagePreviewModal
          imageUrl={previewImage.url}
          imageAlt={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      ) : null}
    </section>
  );
}
