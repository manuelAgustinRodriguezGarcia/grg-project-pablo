"use client";

import { BarChart3, CircleDollarSign, Percent, Receipt } from "@/shared/icons";
import { DashboardKpiCard } from "@/features/billing/components/dashboard/DashboardKpiCard";
import type {
  StatisticsCountsView,
  StatisticsMoneyView,
} from "@/features/billing/types/billing-statistics.types";
import {
  formatStatisticsAmount,
  hasVisibleRoundingGap,
} from "@/features/billing/utils/billing-statistics-display";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsKpisProps = {
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  averageTotal: string | null;
  monthCount: number;
};

function moneyTone(total: string): "blue" | "red" {
  return total.startsWith("-") ? "red" : "blue";
}

export function StatisticsKpis({
  totals,
  counts,
  averageTotal,
  monthCount,
}: StatisticsKpisProps) {
  const accumulated = monthCount > 1;

  return (
    <section className={styles.section} aria-label="Indicadores generales">
      <div
        className={`${styles.kpiGrid} ${accumulated ? styles.kpiGridWide : ""}`}
        data-testid="statistics-kpis"
      >
        <DashboardKpiCard
          icon={CircleDollarSign}
          kpi={{
            id: "statistics-total",
            label: accumulated ? "Facturación acumulada" : "Facturación total",
            value: formatStatisticsAmount(totals.total),
            secondary: accumulated
              ? `Suma de ${monthCount} meses emitidos`
              : "Facturación emitida, con IVA",
            tone: moneyTone(totals.total),
          }}
        />
        <DashboardKpiCard
          icon={Receipt}
          kpi={{
            id: "statistics-net",
            label: accumulated ? "Neto acumulado" : "Neto sin IVA",
            value: formatStatisticsAmount(totals.net),
            secondary: "Importe neto registrado",
            tone: totals.net.startsWith("-") ? "red" : "green",
          }}
        />
        <DashboardKpiCard
          icon={Percent}
          kpi={{
            id: "statistics-vat",
            label: accumulated ? "IVA acumulado" : "IVA",
            value: formatStatisticsAmount(totals.vat),
            secondary: "IVA registrado",
            tone: totals.vat.startsWith("-") ? "red" : "amber",
          }}
        />
        {accumulated && averageTotal ? (
          <DashboardKpiCard
            icon={BarChart3}
            kpi={{
              id: "statistics-average",
              label: "Promedio mensual",
              value: formatStatisticsAmount(averageTotal),
              secondary: "Facturación acumulada dividida por los meses elegidos",
              tone: moneyTone(averageTotal),
            }}
          />
        ) : null}
      </div>
      {hasVisibleRoundingGap(totals.roundingGap) ? (
        <p className={styles.gapNote}>
          El total visual y el neto más el IVA difieren en {formatStatisticsAmount(totals.roundingGap)} por el redondeo ya registrado.
        </p>
      ) : null}
      <ul className={styles.counts}>
        <li><span>Facturas</span><strong>{counts.invoiceCount}</strong></li>
        <li><span>Notas de crédito</span><strong>{counts.creditNoteCount}</strong></li>
        <li><span>Notas de débito</span><strong>{counts.debitNoteCount}</strong></li>
        <li><span>Comprobantes</span><strong>{counts.documentCount}</strong></li>
      </ul>
    </section>
  );
}
