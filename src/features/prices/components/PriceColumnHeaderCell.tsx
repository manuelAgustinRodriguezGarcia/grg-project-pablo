"use client";

import { Banknote, ICON_STROKE } from "@/shared/icons";
import type { PriceItemTableColumn } from "@/features/prices/types/price-item-table.types";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceColumnHeaderCellProps = {
  column: PriceItemTableColumn;
  isSticky?: boolean;
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

export function PriceColumnHeaderCell({
  column,
  isSticky = false,
}: PriceColumnHeaderCellProps) {
  const headerLines = formatHeaderLines(column.displayName);

  const thClassName = [
    column.isPrice ? styles.priceHeaderPrice : "",
    isSticky ? styles.stickyCodeColumn : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <th scope="col" className={thClassName || undefined}>
      <span className={styles.tableHeaderLabel}>
        {column.isPrice ? (
          <Banknote
            strokeWidth={ICON_STROKE}
            aria-hidden
            style={{ width: "0.85rem", height: "0.85rem", marginBottom: "0.15rem" }}
          />
        ) : null}
        {headerLines.map((line, index) => (
          <span key={`${column.id}-${index}`} className={styles.tableHeaderLine}>
            {line}
          </span>
        ))}
      </span>
    </th>
  );
}
