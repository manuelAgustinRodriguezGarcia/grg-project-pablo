"use client";

import { useMemo } from "react";
import { TopRankCard } from "@/features/billing/components/dashboard/TopRankCard";
import { RubrosSalesInsight } from "@/features/billing/components/rubros/RubrosSalesInsight";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import { buildBillingDashboardMetrics } from "@/features/billing/utils/billing-metrics";
import { Tags } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type RubrosInsightsPanelProps = {
  invoices: readonly BillingInvoiceListItem[];
};

export function RubrosInsightsPanel({ invoices }: RubrosInsightsPanelProps) {
  const metrics = useMemo(
    () => buildBillingDashboardMetrics(invoices),
    [invoices],
  );

  return (
    <aside className={styles.insightsColumn} aria-label="Indicadores de rubros">
      <RubrosSalesInsight
        slices={metrics.invoiceTypeSlices}
        total={metrics.invoiceTypeTotal}
        monthLabel={metrics.monthLabel}
        invoiceCount={metrics.invoiceCount}
      />
      <TopRankCard
        className={`${styles.insightRankCard} ${styles.insightRankCardFill}`}
        title="Rubros más vendidos"
        items={metrics.topRubros}
        icon={Tags}
        barTone="green"
        rankBy="amount"
        showRankIndex={false}
        scrollableList
        emptyLabel="Todavía no hay rubros facturados este mes."
      />
    </aside>
  );
}
