"use client";

import { StatisticsChartSlot } from "@/features/billing/components/statistics/StatisticsChartSlot";
import {
  buildEvolutionPoints,
  evolutionHasActivity,
  formatSharePercent,
  formatStatisticsAmount,
  formatStatisticsDelta,
  shareUnavailableText,
  statisticsAmountNumber,
  type EntityPanelModel,
} from "@/features/billing/utils/billing-statistics-display";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsEntityDetailProps = {
  panel: EntityPanelModel;
  onClose: () => void;
};

export function StatisticsEntityDetail({ panel, onClose }: StatisticsEntityDetailProps) {
  if (!panel.found) {
    return (
      <section className={styles.entity} aria-label="Detalle">
        <p className={styles.empty}>{panel.missing}</p>
        <button type="button" className={styles.textButton} onClick={onClose}>
          Cerrar detalle
        </button>
      </section>
    );
  }

  const evolution = buildEvolutionPoints({
    monthly: panel.monthly,
    comparisonMonthly: panel.comparisonMonthly,
    activeMonth: null,
  });
  const shareText = shareUnavailableText(panel.shareUnavailableReason);

  return (
    <section className={styles.entity} aria-label={`Detalle de ${panel.title}`}>
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>{panel.title}</h3>
          <p className={styles.rankMeta}>
            {panel.code ? `${panel.code} · ` : null}
            {panel.historical ? "Identidad histórica · " : null}
            {panel.secondary}
          </p>
        </div>
        <button type="button" className={styles.textButton} onClick={onClose}>
          Cerrar detalle
        </button>
      </div>
      <p className={panel.total.startsWith("-") ? styles.amountNegative : styles.entityTotal}>
        {formatStatisticsAmount(panel.total)}
      </p>
      <p className={styles.rankMeta}>
        Neto {formatStatisticsAmount(panel.net)} · IVA {formatStatisticsAmount(panel.vat)}
        {" · "}
        <span title={shareText ?? undefined}>{formatSharePercent(panel.sharePercent)}</span>
      </p>
      {panel.comparisonTotal ? (
        <p className={styles.note}>
          Período comparado: {formatStatisticsAmount(panel.comparisonTotal)}
          {panel.comparisonDelta
            ? ` · Diferencia: ${formatStatisticsDelta(panel.comparisonDelta)}`
            : null}
        </p>
      ) : null}
      {evolutionHasActivity(panel.monthly) ? (
        <>
          <p className={styles.note}>Evolución dentro del período elegido.</p>
          <StatisticsChartSlot
            kind="evolution"
            height={220}
            points={evolution.points.map((point) => ({
              ...point,
              amount: statisticsAmountNumber(point.total),
            }))}
          />
        </>
      ) : null}
    </section>
  );
}
