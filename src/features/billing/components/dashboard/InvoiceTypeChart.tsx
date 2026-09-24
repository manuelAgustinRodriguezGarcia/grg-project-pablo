"use client";

import { useMemo } from "react";
import type { DashboardDonutSlice } from "@/features/billing/data/dashboardTypes";
import { formatArs } from "@/features/billing/utils/format-ars";
import { CircleDollarSign, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/billing/styles/Dashboard.module.scss";

type InvoiceTypeChartProps = {
  slices: readonly DashboardDonutSlice[];
  total: number;
  monthLabel: string;
  className?: string;
};

export function InvoiceTypeChart({
  slices,
  total,
  monthLabel,
  className,
}: InvoiceTypeChartProps) {
  const monthName = monthLabel.replace(/\s+\d{4}$/, "");
  const invoiceCount = slices.reduce(
    (sum, slice) => sum + (slice.invoiceCount ?? 0),
    0,
  );
  const hasData = total > 0 && invoiceCount > 0;
  const maxAmount = useMemo(
    () => Math.max(...slices.map((slice) => slice.amount), 1),
    [slices],
  );

  return (
    <section
      className={`${styles.card} ${className ?? ""}`.trim()}
      aria-label={`Facturación ${monthName}`}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardHeading}>
          <span className={`${styles.cardIcon} ${styles.cardIconGreen}`} aria-hidden>
            <CircleDollarSign strokeWidth={ICON_STROKE} />
          </span>
          <h2 className={styles.cardTitle}>Facturación {monthName}</h2>
        </div>
        <p className={styles.cardMeta}>
          {invoiceCount} {invoiceCount === 1 ? "factura" : "facturas"}
        </p>
      </div>

      <div className={styles.invoiceTypeBody}>
        {hasData ? (
          <ul className={styles.invoiceTypeChart}>
            {slices.map((slice) => {
              const count = slice.invoiceCount ?? 0;
              const barHeight = `${Math.max(8, (slice.amount / maxAmount) * 100)}%`;

              return (
                <li key={slice.key} className={styles.invoiceTypeColumn}>
                  <div className={styles.invoiceTypeBarWell} aria-hidden>
                    <div
                      className={styles.invoiceTypeBar}
                      style={{
                        height: barHeight,
                        background: slice.color,
                      }}
                    />
                  </div>
                  <div className={styles.invoiceTypeCaption}>
                    <span className={styles.invoiceTypeColumnLabel}>
                      {slice.label}
                    </span>
                    <span className={styles.invoiceTypeColumnCount}>
                      {count} {count === 1 ? "factura" : "facturas"}
                    </span>
                    <strong className={styles.invoiceTypeColumnAmount}>
                      {formatArs(slice.amount)}
                    </strong>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.emptyHint} role="status">
            Todavía no hay facturas este mes.
          </p>
        )}
      </div>
    </section>
  );
}
