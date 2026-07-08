"use client";

import type { PriceItemTableColumn } from "@/features/prices/types/price-item-table.types";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceColumnHeaderCellProps = {
  column: PriceItemTableColumn;
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

export function PriceColumnHeaderCell({ column }: PriceColumnHeaderCellProps) {
  const headerLines = formatHeaderLines(column.displayName);

  const thClassName = column.isPrice ? styles.priceHeaderPrice : undefined;

  return (
    <th scope="col" className={thClassName}>
      <span className={styles.tableHeaderLabel}>
        {headerLines.map((line, index) => (
          <span key={`${column.id}-${index}`} className={styles.tableHeaderLine}>
            {line}
          </span>
        ))}
      </span>
    </th>
  );
}
