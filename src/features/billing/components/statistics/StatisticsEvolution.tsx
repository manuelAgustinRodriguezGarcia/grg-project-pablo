"use client";

import { StatisticsChartSlot } from "@/features/billing/components/statistics/StatisticsChartSlot";
import type { StatisticsMonthAmount } from "@/features/billing/types/billing-statistics.types";
import {
  buildEvolutionPoints,
  formatStatisticsAmount,
} from "@/features/billing/utils/billing-statistics-display";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsEvolutionProps = {
  monthly: readonly StatisticsMonthAmount[];
  selectedMonths: readonly number[];
  caption: string;
  onToggleMonth: (month: number) => void;
};

export function StatisticsEvolution({
  monthly,
  selectedMonths,
  caption,
  onToggleMonth,
}: StatisticsEvolutionProps) {
  const evolution = buildEvolutionPoints({
    monthly,
    comparisonMonthly: null,
    activeMonth: null,
    selectedMonths,
  });

  return (
    <section
      id="statistics-analysis-evolucion"
      className={styles.section}
      aria-label="Evolución de facturación"
    >
      <h2 className={styles.sectionTitle}>Evolución de facturación</h2>
      <p className={styles.note}>{caption}</p>
      <StatisticsChartSlot
        kind="evolution"
        points={evolution.points}
        height={280}
        onToggleMonth={onToggleMonth}
      />
      <table className={styles.srOnly}>
        <caption>Evolución de facturación</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Facturación</th>
          </tr>
        </thead>
        <tbody>
          {evolution.points.map((point) => (
            <tr key={point.key} aria-current={point.active ? "true" : undefined}>
              <th scope="row">{point.label}</th>
              <td>{formatStatisticsAmount(point.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
