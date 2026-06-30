"use client";

import type { ColumnListItem } from "@/features/catalog/types/column.types";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ColumnHeaderCellProps = {
  column: ColumnListItem;
  headerLines: string[];
};

export function ColumnHeaderCell({ column, headerLines }: ColumnHeaderCellProps) {
  return (
    <th scope="col" className={styles.tableDataCell}>
      <span className={styles.tableHeaderLabel}>
        {headerLines.map((line, lineIndex) => (
          <span key={`${column.id}-${lineIndex}`} className={styles.tableHeaderLine}>
            {line}
          </span>
        ))}
      </span>
    </th>
  );
}
