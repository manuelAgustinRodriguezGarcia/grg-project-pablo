"use client";

import { memo } from "react";
import type { SearchResultItem } from "@/features/catalog/types/global-search.types";
import {
  formatSearchMatchType,
  truncateMatchValue,
} from "@/features/catalog/utils/format-search-match-type";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type CatalogGlobalSearchResultRowProps = {
  item: SearchResultItem;
  onSelect: (item: SearchResultItem) => void;
};

function formatCellValue(value: string | null): string {
  if (!value?.trim()) {
    return "—";
  }

  return value.trim();
}

export const CatalogGlobalSearchResultRow = memo(function CatalogGlobalSearchResultRow({
  item,
  onSelect,
}: CatalogGlobalSearchResultRowProps) {
  const thumbnailUrl = item.primaryImage?.thumbnailUrl ?? item.primaryImage?.fullUrl;
  const matchLabel = formatSearchMatchType(item.matchType);
  const matchValue = truncateMatchValue(item.matchValue);

  return (
    <tr>
      <td className={styles.tableThumbCell}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className={styles.tableThumb}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className={styles.tableThumbEmpty}>—</span>
        )}
      </td>
      <td className={styles.tableDataCell}>
        <button
          type="button"
          className={styles.searchResultLink}
          onClick={() => onSelect(item)}
        >
          {formatCellValue(item.primaryCode)}
        </button>
      </td>
      <td className={styles.tableDataCell}>
        <span className={styles.tableCellText}>{formatCellValue(item.description)}</span>
      </td>
      <td className={styles.tableDataCell}>
        <span className={styles.tableCellText}>{item.catalog.name}</span>
      </td>
      <td className={styles.tableDataCell}>
        <span className={styles.tableCellText}>{item.folder.name}</span>
      </td>
      <td className={styles.tableDataCell}>
        <span className={styles.searchMatchBadge}>{matchLabel}</span>
        {matchValue ? (
          <span className={styles.searchMatchValue}>{matchValue}</span>
        ) : null}
      </td>
    </tr>
  );
});
