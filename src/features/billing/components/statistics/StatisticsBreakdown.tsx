"use client";

import type { ReactNode } from "react";
import { StatisticsChartSlot } from "@/features/billing/components/statistics/StatisticsChartSlot";
import type { StatisticsShareReason } from "@/features/billing/types/billing-statistics.types";
import {
  buildParticipationChart,
  formatSharePercent,
  formatStatisticsAmount,
  shareUnavailableText,
  STATISTICS_RANK_LIMIT,
  statisticsAmountCents,
  statisticsAmountNumber,
  type StatisticsChartPoint,
} from "@/features/billing/utils/billing-statistics-display";
import { getBlueScaleColorsByAmount } from "@/features/billing/utils/dashboard-chart-colors";
import styles from "@/features/billing/styles/Statistics.module.scss";

export type StatisticsRankItem = {
  key: string;
  rank: number;
  name: string;
  code: string;
  historical: boolean;
  total: string;
  sharePercent: string | null;
  shareUnavailableReason: StatisticsShareReason;
  secondary: string;
};

type StatisticsBreakdownProps = {
  noun: "clientes" | "rubros";
  items: StatisticsRankItem[];
  totalGroups: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  entity: ReactNode;
  context: ReactNode;
};

const ZERO = BigInt(0);

function chartPoints(items: readonly { key: string; name: string; total: string }[]): StatisticsChartPoint[] {
  return items.map((item) => ({
    key: item.key,
    label: item.name,
    total: item.total,
    amount: statisticsAmountNumber(item.total),
    comparisonTotal: null,
    comparisonAmount: null,
    active: false,
  }));
}

function barWidth(total: string, maxAbs: bigint): string {
  if (maxAbs <= ZERO) {
    return "0%";
  }

  const cents = statisticsAmountCents(total);
  const absolute = cents < ZERO ? -cents : cents;
  const ratio = Number((absolute * BigInt(10000)) / maxAbs) / 100;
  return `${Math.min(100, ratio)}%`;
}

export function StatisticsBreakdown({
  noun,
  items,
  totalGroups,
  selectedKey,
  onSelect,
  expanded,
  onToggleExpanded,
  entity,
  context,
}: StatisticsBreakdownProps) {
  const visible = expanded ? items : items.slice(0, STATISTICS_RANK_LIMIT);
  const participation = buildParticipationChart({
    rows: items.map((item) => ({ key: item.key, label: item.name, total: item.total })),
    totalGroups,
    othersLabel: noun === "clientes" ? "Otros clientes" : "Otros rubros",
  });
  const piePoints =
    participation.status === "ready"
      ? chartPoints(
          participation.slices.map((slice) => ({
            key: slice.key,
            name: slice.label,
            total: slice.total,
          })),
        )
      : [];
  const pieColors = getBlueScaleColorsByAmount(piePoints);
  const title = noun === "clientes" ? "Clientes" : "Rubros";
  const maxAbs = visible.reduce((max, item) => {
    const cents = statisticsAmountCents(item.total);
    const absolute = cents < ZERO ? -cents : cents;
    return absolute > max ? absolute : max;
  }, ZERO);

  return (
    <div className={styles.breakdown}>
      <div className={styles.chartSplit}>
        <section
          id="statistics-analysis-ranking"
          className={styles.panel}
          aria-label={`Ranking de ${title.toLowerCase()}`}
        >
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>
              {noun === "clientes" ? "Top clientes del período" : "Top rubros del período"}
            </h3>
            {items.length > STATISTICS_RANK_LIMIT ? (
              <button type="button" className={styles.textButton} onClick={onToggleExpanded}>
                {expanded ? `Mostrar los ${STATISTICS_RANK_LIMIT} principales` : `Ver los ${items.length} ${noun}`}
              </button>
            ) : null}
          </div>
          {visible.length === 0 ? (
            <p className={styles.empty}>No hay {noun} con facturación en este período.</p>
          ) : (
            <ol className={styles.rankList}>
              {visible.map((item) => {
                const negative = item.total.startsWith("-");
                const shareText = shareUnavailableText(item.shareUnavailableReason);
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={`${styles.rankButton} ${selectedKey === item.key ? styles.rankButtonActive : ""}`}
                      aria-pressed={selectedKey === item.key}
                      onClick={() => onSelect(item.key)}
                    >
                      <span className={styles.rankTitle}>
                        <span className={styles.rankName}>{item.name}</span>
                        {item.code ? <span className={styles.rankCode}>{item.code}</span> : null}
                      </span>
                      <span className={styles.rankMeta}>
                        {item.historical ? "Identidad histórica · " : null}
                        <span className={negative ? styles.amountNegative : undefined}>
                          {formatStatisticsAmount(item.total)}
                        </span>
                        {item.secondary ? ` · ${item.secondary}` : null}
                      </span>
                      <span className={styles.rankShare} title={shareText ?? undefined}>
                        {formatSharePercent(item.sharePercent)}
                      </span>
                      <span className={styles.rankTrack} aria-hidden="true">
                        <span
                          className={`${styles.rankFill} ${negative ? styles.rankFillNegative : ""}`}
                          style={{ width: barWidth(item.total, maxAbs) }}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          {entity}
        </section>
        <section
          id="statistics-analysis-participacion"
          className={styles.panel}
          aria-label={`Participación de ${noun}`}
        >
          <h3 className={styles.panelTitle}>Participación</h3>
          {participation.status === "ready" ? (
            <div className={styles.pieLayout}>
              <StatisticsChartSlot kind="pie" points={piePoints} height={240} />
              <ul className={styles.legend} data-testid="participation-legend">
                {participation.slices.map((slice, index) => (
                  <li key={slice.key}>
                    <span
                      className={styles.legendSwatch}
                      style={{ backgroundColor: pieColors[index] }}
                      data-testid="participation-swatch"
                      aria-hidden
                    />
                    <span className={styles.legendName}>{slice.label}</span>
                    <strong className={slice.total.startsWith("-") ? styles.amountNegative : undefined}>
                      {formatStatisticsAmount(slice.total)}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {participation.status === "unavailable" ? (
            <p className={styles.note}>{participation.reason}</p>
          ) : null}
          {participation.status === "hidden" && items.length > 0 ? (
            <p className={styles.note}>No hay participación monetaria para graficar.</p>
          ) : null}
        </section>
      </div>
      {context}
    </div>
  );
}
