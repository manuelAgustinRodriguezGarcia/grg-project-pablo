"use client";

import type { PriceItemTableColumn } from "@/features/prices/types/price-item-table.types";
import {
  formatCellText,
  formatPriceAmount,
} from "@/features/prices/utils/format-price-cell";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceCellValueProps = {
  column: PriceItemTableColumn;
  value: unknown;
};

export function PriceCellValue({ column, value }: PriceCellValueProps) {
  if (column.isPrice) {
    const formatted =
      typeof value === "string" || value === null || value === undefined
        ? formatPriceAmount(value as string | null)
        : formatPriceAmount(String(value));

    return <span className={styles.cellPrice}>{formatted}</span>;
  }

  if (column.isPrimaryCode) {
    return (
      <span className={styles.cellCode}>{formatCellText(value)}</span>
    );
  }

  return <span className={styles.cellText}>{formatCellText(value)}</span>;
}
