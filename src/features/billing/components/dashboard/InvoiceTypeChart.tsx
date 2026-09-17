"use client";

import { useMemo } from "react";
import type { DashboardDonutSlice } from "@/features/billing/data/dashboardTypes";
import { getBlueScaleColorsByAmount } from "@/features/billing/utils/dashboard-chart-colors";
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
  const rankedSlices = useMemo(
    () =>
      [...slices].sort(
        (left, right) => (right.invoiceCount ?? 0) - (left.invoiceCount ?? 0),
      ),
    [slices],
  );
  const sliceColors = getBlueScaleColorsByAmount(rankedSlices);
  const invoiceCount = rankedSlices.reduce(
    (sum, slice) => sum + (slice.invoiceCount ?? 0),
    0,
  );
  const hasData = total > 0 && invoiceCount > 0;
  const maxInvoiceCount = Math.max(
    ...rankedSlices.map((slice) => slice.invoiceCount ?? 0),
    1,
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
          <>
            <div className={styles.invoiceTypeTotal}>
              <span className={styles.invoiceTypeTotalLabel}>Total</span>
              <strong className={styles.invoiceTypeTotalValue}>
                {formatArs(total)}
              </strong>
            </div>

            <ul className={styles.invoiceTypeBreakdown}>
              {rankedSlices.map((slice, index) => {
                const count = slice.invoiceCount ?? 0;
                const barWidth = `${Math.max(8, (count / maxInvoiceCount) * 100)}%`;

                return (
                  <li key={slice.key} className={styles.invoiceTypeRow}>
                    <div className={styles.invoiceTypeRowHeader}>
                      <span className={styles.invoiceTypeRowLabel}>
                        {slice.label}
                      </span>
                      <span className={styles.invoiceTypeRowStats}>
                        <span className={styles.invoiceTypeRowCount}>
                          {count} {count === 1 ? "factura" : "facturas"}
                        </span>
                        <span className={styles.invoiceTypeRowAmount}>
                          {formatArs(slice.amount)}
                        </span>
                      </span>
                    </div>
                    <div className={styles.invoiceTypeBarTrack} aria-hidden>
                      <div
                        className={styles.invoiceTypeBarFill}
                        style={{
                          width: barWidth,
                          background: sliceColors[index],
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className={styles.emptyHint} role="status">
            Todavía no hay facturas este mes.
          </p>
        )}
      </div>
    </section>
  );
}
