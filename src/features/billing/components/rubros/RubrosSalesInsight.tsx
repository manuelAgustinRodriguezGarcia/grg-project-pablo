"use client";

import { useMemo } from "react";
import type { DashboardDonutSlice } from "@/features/billing/data/dashboardTypes";
import { getBlueScaleColorsByAmount } from "@/features/billing/utils/dashboard-chart-colors";
import { formatArs } from "@/features/billing/utils/format-ars";
import { CircleDollarSign, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type RubrosSalesInsightProps = {
  slices: readonly DashboardDonutSlice[];
  total: number;
  monthLabel: string;
  invoiceCount: number;
};

export function RubrosSalesInsight({
  slices,
  total,
  monthLabel,
  invoiceCount,
}: RubrosSalesInsightProps) {
  const monthName = monthLabel.replace(/\s+\d{4}$/, "");
  const rankedSlices = useMemo(
    () =>
      [...slices].sort(
        (left, right) => (right.invoiceCount ?? 0) - (left.invoiceCount ?? 0),
      ),
    [slices],
  );
  const invoiceTypeColors = getBlueScaleColorsByAmount(rankedSlices);
  const maxInvoiceCount = Math.max(
    ...rankedSlices.map((slice) => slice.invoiceCount ?? 0),
    1,
  );
  const hasData = total > 0 && invoiceCount > 0;

  return (
    <section
      className={styles.insightPanel}
      aria-label={`Facturación ${monthName}`}
    >
      <div className={styles.insightPanelHeader}>
        <div className={styles.insightPanelHeading}>
          <span className={styles.insightRubroHeaderIconWrap} aria-hidden>
            <CircleDollarSign
              className={styles.insightRubroHeaderIcon}
              strokeWidth={ICON_STROKE}
            />
          </span>
          <h2 className={styles.insightPanelTitle}>
            Facturación {monthName}
          </h2>
        </div>
        <p className={styles.insightPanelMeta}>
          {invoiceCount} {invoiceCount === 1 ? "factura" : "facturas"}
        </p>
      </div>

      {hasData ? (
        <div className={styles.insightSalesBody}>
          <div className={styles.insightSalesTotal}>
            <span className={styles.insightSalesTotalLabel}>Total</span>
            <strong className={styles.insightSalesTotalValue}>
              {formatArs(total)}
            </strong>
          </div>

          <ul className={styles.insightSalesBreakdown}>
            {rankedSlices.map((slice, index) => {
              const count = slice.invoiceCount ?? 0;
              const barWidth = `${Math.max(8, (count / maxInvoiceCount) * 100)}%`;

              return (
                <li key={slice.key} className={styles.insightSalesRow}>
                  <div className={styles.insightSalesRowHeader}>
                    <span className={styles.insightSalesRowLabel}>
                      {slice.label}
                    </span>
                    <span className={styles.insightSalesRowStats}>
                      <span className={styles.insightSalesRowCount}>
                        {count} {count === 1 ? "factura" : "facturas"}
                      </span>
                      <span className={styles.insightSalesRowAmount}>
                        {formatArs(slice.amount)}
                      </span>
                    </span>
                  </div>
                  <div className={styles.insightSalesBarTrack} aria-hidden>
                    <div
                      className={styles.insightSalesBarFill}
                      style={{
                        width: barWidth,
                        background: invoiceTypeColors[index],
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className={styles.insightDebtEmptyText} role="status">
          Todavía no hay facturas este mes.
        </p>
      )}
    </section>
  );
}
