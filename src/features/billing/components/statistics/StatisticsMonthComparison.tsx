"use client";

import type { StatisticsSelectionView } from "@/features/billing/utils/billing-statistics-combine";
import {
  formatStatisticsAmount,
  formatStatisticsDelta,
} from "@/features/billing/utils/billing-statistics-display";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsMonthComparisonProps = {
  view: StatisticsSelectionView;
};

function stateLabel(state: StatisticsSelectionView["selectedMonths"][number]["state"]): string {
  switch (state) {
    case "future":
      return "Todavía no comenzó";
    case "partial":
      return "En curso";
    case "empty":
      return "Sin operaciones";
    case "recorded":
      return "";
    default: {
      const unexpected: never = state;
      return unexpected;
    }
  }
}

export function StatisticsMonthComparison({ view }: StatisticsMonthComparisonProps) {
  return (
    <section className={styles.panel} aria-label="Comparación de meses">
      <h2 className={styles.sectionTitle}>Comparación de meses</h2>
      <dl className={styles.reconcile}>
        <div>
          <dt>Mejor mes</dt>
          <dd>{view.best ? `${view.best.names.join(", ")} · ${formatStatisticsAmount(view.best.total)}` : "—"}</dd>
        </div>
        <div>
          <dt>Mes de menor facturación</dt>
          <dd>{view.worst && view.best && view.worst.total !== view.best.total ? `${view.worst.names.join(", ")} · ${formatStatisticsAmount(view.worst.total)}` : "—"}</dd>
        </div>
        <div>
          <dt>Promedio mensual</dt>
          <dd>{formatStatisticsAmount(view.averageTotal)}</dd>
        </div>
        <div>
          <dt>Diferencia entre mejor y peor</dt>
          <dd>
            {view.spreadAmount
              ? `${formatStatisticsAmount(view.spreadAmount)}${view.spreadPercent ? ` · ${view.spreadPercent}` : ""}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Mes con más facturas</dt>
          <dd>
            {view.busiest
              ? `${view.busiest.names.join(", ")} · ${view.busiest.invoiceCount}`
              : "—"}
          </dd>
        </div>
      </dl>
      <div className={styles.tableScroll}>
        <table className={styles.compareTable}>
          <caption className={styles.srOnly}>Facturación de los meses seleccionados</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">Facturación</th>
              <th scope="col">Facturas</th>
              <th scope="col">Notas de crédito</th>
              <th scope="col">Notas de débito</th>
              <th scope="col">Variación</th>
            </tr>
          </thead>
          <tbody>
            {view.selectedMonths.map((month) => {
              const status = stateLabel(month.state);
              const variation = month.variation
                ? `${formatStatisticsDelta(month.variation.delta)} respecto de ${month.variation.referenceName}${month.variation.skipped ? " (hay meses sin seleccionar entre ambos)" : ""}${month.variation.percent ? ` · ${month.variation.percent}` : ""}`
                : "—";
              return (
                <tr key={month.month}>
                  <th scope="row">
                    {month.name}
                    {status ? <span className={styles.rankMeta}> {status}</span> : null}
                  </th>
                  <td className={month.totals.total.startsWith("-") ? styles.amountNegative : undefined}>
                    {formatStatisticsAmount(month.totals.total)}
                  </td>
                  <td>{month.counts.invoiceCount}</td>
                  <td>{month.counts.creditNoteCount}</td>
                  <td>{month.counts.debitNoteCount}</td>
                  <td>{variation}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
