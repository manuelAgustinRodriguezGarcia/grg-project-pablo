"use client";

import type { StatisticsMonthVariation, StatisticsSelectionView } from "@/features/billing/utils/billing-statistics-combine";
import {
  formatStatisticsAmount,
  statisticsAmountCents,
} from "@/features/billing/utils/billing-statistics-display";
import { CircleArrowDown, CircleArrowUp, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsMonthComparisonProps = {
  view: StatisticsSelectionView;
};

const ZERO = BigInt(0);

function VariationPill({ variation }: { variation: StatisticsMonthVariation }) {
  const cents = statisticsAmountCents(variation.delta);
  if (cents === ZERO) {
    return <>Igual que en {variation.referenceName}</>;
  }

  const increased = cents > ZERO;
  const Icon = increased ? CircleArrowUp : CircleArrowDown;
  const unsigned = variation.delta.startsWith("-") ? variation.delta.slice(1) : variation.delta;

  return (
    <span
      className={`${styles.variationPill} ${increased ? styles.variationPillUp : styles.variationPillDown}`}
    >
      <Icon className={styles.variationIcon} strokeWidth={ICON_STROKE} aria-hidden />
      {formatStatisticsAmount(unsigned)} {increased ? "más" : "menos"} que en {variation.referenceName}
    </span>
  );
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
        <table className={`${styles.compareTable} ${styles.monthCompareTable}`}>
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
            {view.selectedMonths.map((month) => (
                <tr key={month.month}>
                  <th scope="row">{month.name}</th>
                  <td className={month.totals.total.startsWith("-") ? styles.amountNegative : undefined}>
                    {formatStatisticsAmount(month.totals.total)}
                  </td>
                  <td>{month.counts.invoiceCount}</td>
                  <td>{month.counts.creditNoteCount}</td>
                  <td>{month.counts.debitNoteCount}</td>
                  <td>{month.variation ? <VariationPill variation={month.variation} /> : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
