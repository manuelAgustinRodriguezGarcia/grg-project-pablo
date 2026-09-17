"use client";

import { useMemo } from "react";
import { useReportAdminSectionReady } from "@/features/admin/components/AdminSectionTransition";
import { CollectionStatusChart } from "@/features/billing/components/dashboard/CollectionStatusChart";
import { DashboardActionLink } from "@/features/billing/components/dashboard/DashboardActionLink";
import { DashboardKpiCard } from "@/features/billing/components/dashboard/DashboardKpiCard";
import { DashboardRecentCard } from "@/features/billing/components/dashboard/DashboardRecentCard";
import { InvoiceTypeChart } from "@/features/billing/components/dashboard/InvoiceTypeChart";
import { TopRankCard } from "@/features/billing/components/dashboard/TopRankCard";
import { UnpaidInvoicesCard } from "@/features/billing/components/dashboard/UnpaidInvoicesCard";
import { DASHBOARD_QUICK_LINKS } from "@/features/billing/data/dashboardConstants";
import type {
  DashboardCatalogSummary,
  DashboardPriceListSummary,
} from "@/features/billing/data/dashboardTypes";
import {
  BILLING_DEBTORS_PATH,
  BILLING_INVOICES_PATH,
} from "@/features/billing/data/billingNav";
import { useBillingInvoicesQuery } from "@/features/billing/hooks/useBillingInvoicesQuery";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import { buildBillingDashboardMetrics } from "@/features/billing/utils/billing-metrics";
import { BookUser, ReceiptText, Tags } from "@/shared/icons";
import styles from "@/features/billing/styles/Dashboard.module.scss";

type DashboardViewProps = {
  lastCatalog: DashboardCatalogSummary | null;
  lastPriceList: DashboardPriceListSummary | null;
  initialInvoices?: BillingInvoiceListItem[];
};

export function DashboardView({
  lastCatalog,
  lastPriceList,
  initialInvoices = [],
}: DashboardViewProps) {
  const invoicesQuery = useBillingInvoicesQuery(initialInvoices);
  const metrics = useMemo(
    () => buildBillingDashboardMetrics(invoicesQuery.data ?? []),
    [invoicesQuery.data],
  );

  useReportAdminSectionReady(true);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Inicio</h1>
        <p className={styles.pageSubtitle}>
          Resumen de todo lo que está pasando
        </p>
      </header>

      <section className={styles.kpiRow} aria-label="Indicadores del mes">
        {DASHBOARD_QUICK_LINKS.map((action) => (
          <DashboardActionLink key={action.href} action={action} />
        ))}
        <DashboardKpiCard
          kpi={metrics.revenueKpi}
          icon={ReceiptText}
          href={BILLING_INVOICES_PATH}
          footerLabel="Ir a facturas"
        />
        <DashboardKpiCard
          kpi={metrics.unpaidKpi}
          icon={ReceiptText}
          href={BILLING_DEBTORS_PATH}
        />
      </section>

      <section className={styles.mainGrid} aria-label="Resumen operativo">
        <DashboardRecentCard
          catalog={lastCatalog}
          priceList={lastPriceList}
        />
        <TopRankCard
          title="Top 5 rubros del mes"
          items={metrics.topRubros}
          icon={Tags}
          barTone="green"
          rankBy="amount"
          footerHref="/admin/facturacion/rubros"
          footerLabel="Ver todos los rubros"
          emptyLabel="Todavía no hay rubros facturados este mes."
        />
        <InvoiceTypeChart
          slices={metrics.invoiceTypeSlices}
          total={metrics.invoiceTypeTotal}
          monthLabel={metrics.monthLabel}
        />
        <UnpaidInvoicesCard invoices={metrics.unpaidInvoices} />
        <TopRankCard
          title="Top 5 clientes del mes"
          items={metrics.topClients}
          icon={BookUser}
          footerHref="/admin/facturacion/clientes"
          footerLabel="Ver todos los clientes"
          emptyLabel="Todavía no hay clientes facturados este mes."
        />
        <CollectionStatusChart
          slices={metrics.collectionSlices}
          total={metrics.collectionTotal}
        />
      </section>
    </div>
  );
}
