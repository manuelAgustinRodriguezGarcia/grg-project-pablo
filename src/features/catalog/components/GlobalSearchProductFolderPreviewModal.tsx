"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import type { SearchResultItem } from "@/features/catalog/types/global-search.types";
import type { ProductFolderSearchGroup } from "@/features/catalog/utils/group-search-results-by-folder";
import { ICON_STROKE, X } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type GlobalSearchProductFolderPreviewModalProps = {
  group: ProductFolderSearchGroup;
  onClose: () => void;
  onNavigate: () => void;
};

function groupHasProductImages(items: SearchResultItem[]): boolean {
  return items.some((item) => {
    const thumbnailUrl =
      item.primaryImage?.thumbnailUrl ?? item.primaryImage?.fullUrl ?? null;
    return Boolean(thumbnailUrl);
  });
}

function ProductPreviewRow({
  item,
  showImageColumn,
}: {
  item: SearchResultItem;
  showImageColumn: boolean;
}) {
  const thumbnailUrl =
    item.primaryImage?.thumbnailUrl ?? item.primaryImage?.fullUrl ?? null;
  const cells =
    item.previewColumns.length > 0
      ? item.previewColumns
      : [
          { displayName: "Código", value: item.primaryCode?.trim() || "—" },
          {
            displayName: "Descripción",
            value: item.description?.trim() || "—",
          },
        ];

  return (
    <tr>
      {showImageColumn ? (
        <td className={styles.searchPreviewThumbCell}>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className={styles.searchPreviewThumb}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className={styles.searchPreviewThumbEmpty}>—</span>
          )}
        </td>
      ) : null}
      {cells.map((cell, index) => (
        <td key={`${item.productId}-${cell.displayName}-${index}`}>{cell.value}</td>
      ))}
    </tr>
  );
}

export function GlobalSearchProductFolderPreviewModal({
  group,
  onClose,
  onNavigate,
}: GlobalSearchProductFolderPreviewModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const showImageColumn = useMemo(
    () => groupHasProductImages(group.items),
    [group.items],
  );
  const previewHeaders = useMemo(() => {
    const withColumns = group.items.find((item) => item.previewColumns.length > 0);
    if (withColumns) {
      return withColumns.previewColumns.map((cell) => cell.displayName);
    }

    return ["Código", "Descripción"];
  }, [group.items]);

  if (typeof document === "undefined") {
    return null;
  }

  const destinationLabel = `${group.folderName} | Catálogo: ${group.catalogName}`;

  return createPortal(
    <div
      className={`${styles.confirmOverlay} ${styles.confirmOverlayElevated}`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={styles.searchPreviewCard}
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-preview-title"
      >
        <button
          type="button"
          className={styles.searchPreviewClose}
          onClick={onClose}
          aria-label="Cerrar"
          title="Cerrar"
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
        </button>

        <h3 id="search-preview-title" className={styles.searchPreviewTitle}>
          Coincidencias en {destinationLabel}
        </h3>

        <div className={styles.searchPreviewTableWrap}>
          <table className={styles.searchPreviewTable}>
            <thead>
              <tr>
                {showImageColumn ? <th scope="col">Imagen</th> : null}
                {previewHeaders.map((header, index) => (
                  <th key={`${header}-${index}`} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => (
                <ProductPreviewRow
                  key={item.productId}
                  item={item}
                  showImageColumn={showImageColumn}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.searchPreviewActions}>
          <button
            type="button"
            className={styles.confirmPrimaryButton}
            onClick={onNavigate}
          >
            Ir a {destinationLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
