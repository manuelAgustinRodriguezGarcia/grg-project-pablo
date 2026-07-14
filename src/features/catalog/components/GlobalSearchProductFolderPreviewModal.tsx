"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { SearchResultItem } from "@/features/catalog/types/global-search.types";
import type { ProductFolderSearchGroup } from "@/features/catalog/utils/group-search-results-by-folder";
import {
  formatSearchMatchType,
  truncateMatchValue,
} from "@/features/catalog/utils/format-search-match-type";
import { ICON_STROKE, X } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type GlobalSearchProductFolderPreviewModalProps = {
  group: ProductFolderSearchGroup;
  onClose: () => void;
  onNavigate: () => void;
};

function formatCellValue(value: string | null): string {
  if (!value?.trim()) {
    return "—";
  }

  return value.trim();
}

function ProductPreviewRow({ item }: { item: SearchResultItem }) {
  const thumbnailUrl =
    item.primaryImage?.thumbnailUrl ?? item.primaryImage?.fullUrl ?? null;

  return (
    <tr>
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
      <td>{formatCellValue(item.primaryCode)}</td>
      <td>{truncateMatchValue(formatCellValue(item.description), 80)}</td>
      <td>
        <span className={styles.searchMatchBadge}>
          {formatSearchMatchType(item.matchType)}
        </span>
      </td>
      <td>{truncateMatchValue(item.matchValue, 64) || "—"}</td>
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
                <th scope="col">Imagen</th>
                <th scope="col">Código</th>
                <th scope="col">Descripción</th>
                <th scope="col">Coincidencia</th>
                <th scope="col">Valor</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => (
                <ProductPreviewRow key={item.productId} item={item} />
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
