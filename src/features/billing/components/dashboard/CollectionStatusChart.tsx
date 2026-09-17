"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DashboardDonutSlice } from "@/features/billing/data/dashboardTypes";
import { DonutTooltip } from "@/features/billing/components/dashboard/ChartTooltip";
import { getBlueScaleColorsByAmount } from "@/features/billing/utils/dashboard-chart-colors";
import { formatArs } from "@/features/billing/utils/format-ars";
import styles from "@/features/billing/styles/Dashboard.module.scss";

type CollectionStatusChartProps = {
  slices: readonly DashboardDonutSlice[];
  total: number;
};

export function CollectionStatusChart({
  slices,
  total,
}: CollectionStatusChartProps) {
  const sliceColors = getBlueScaleColorsByAmount(slices);
  const hasData = total > 0;

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Estado de cobranzas</h2>
      </div>
      {hasData ? (
        <div className={styles.donutLayout}>
          <div className={styles.donutChart}>
            <div className={styles.donutCenter}>
              <p className={styles.donutTotal}>{formatArs(total)}</p>
              <p className={styles.donutTotalLabel}>Total</p>
            </div>
            <ResponsiveContainer width="100%" height="100%" debounce={150}>
              <PieChart>
                <Pie
                  data={[...slices]}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="84%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {slices.map((slice, index) => (
                    <Cell key={slice.key} fill={sliceColors[index]} />
                  ))}
                </Pie>
                <Tooltip
                  content={<DonutTooltip />}
                  wrapperStyle={{ zIndex: 10 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className={styles.legend}>
            {slices.map((slice, index) => (
              <li key={slice.key} className={styles.legendItem}>
                <span
                  className={styles.legendSwatch}
                  style={{ background: sliceColors[index] }}
                  aria-hidden
                />
                <span className={styles.legendText}>
                  <span className={styles.legendLabel}>{slice.label}</span>
                  <span className={styles.legendValue}>
                    {formatArs(slice.amount)}{" "}
                    <span className={styles.legendPercent}>
                      ({slice.percent}%)
                    </span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.emptyHint} role="status">
          Todavía no hay cobranzas este mes.
        </p>
      )}
    </section>
  );
}
