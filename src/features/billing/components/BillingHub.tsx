"use client";

import { useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { useAdminSectionTransition, useReportAdminSectionReady } from "@/features/admin/components/AdminSectionTransition";
import { ConfirmDialog } from "@/features/catalog/components/ConfirmDialog";
import { InvoiceTypeChart } from "@/features/billing/components/dashboard/InvoiceTypeChart";
import { TopRankCard } from "@/features/billing/components/dashboard/TopRankCard";
import { useUnsavedInvoiceDraft } from "@/features/billing/components/invoices/UnsavedInvoiceDraftContext";
import { billingClientHistoryHref, BILLING_DEBTORS_PATH } from "@/features/billing/data/billingNav";
import { useBillingInvoicesQuery } from "@/features/billing/hooks/useBillingInvoicesQuery";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import { buildBillingDashboardMetrics } from "@/features/billing/utils/billing-metrics";
import { formatArs } from "@/features/billing/utils/format-ars";
import {
  BookUser,
  CircleDollarSign,
  FileText,
  ICON_STROKE,
  Info,
  ReceiptText,
  Sticker,
  Tags,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "@/shared/icons";
import styles from "@/features/billing/styles/BillingHub.module.scss";

type BillingHubProps = {
  initialInvoices?: BillingInvoiceListItem[];
};

type HubKpiCardProps = {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean | null;
  icon: LucideIcon;
  href?: string;
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

function HubKpiCard({
  label,
  value,
  trend,
  trendUp,
  icon: Icon,
  href,
  onNavigate,
}: HubKpiCardProps) {
  const TrendIcon = trendUp === false ? TrendingDown : TrendingUp;
  const content = (
    <>
      <span className={styles.kpiIconWrap} aria-hidden>
        <Icon className={styles.kpiIcon} strokeWidth={ICON_STROKE} />
      </span>
      <span className={styles.kpiBody}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue}>{value}</span>
        <span
          className={`${styles.kpiTrend} ${
            trendUp === false ? styles.kpiTrendDown : ""
          }`}
        >
          <TrendIcon
            className={styles.kpiTrendIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          {trend}
        </span>
      </span>
    </>
  );

  if (!href) {
    return <article className={styles.kpiCard}>{content}</article>;
  }

  return (
    <Link
      href={href}
      className={`${styles.kpiCard} ${styles.kpiCardLink}`}
      aria-label={`${label}. Ver todos los deudores`}
      onClick={onNavigate}
    >
      {content}
    </Link>
  );
}

export function BillingHub({ initialInvoices = [] }: BillingHubProps) {
  const invoicesQuery = useBillingInvoicesQuery(initialInvoices);
  const sectionTransition = useAdminSectionTransition();
  const unsavedDraft = useUnsavedInvoiceDraft();
  const metrics = useMemo(
    () => buildBillingDashboardMetrics(invoicesQuery.data ?? []),
    [invoicesQuery.data],
  );
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useReportAdminSectionReady(true);

  function goToBillingHref(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (unsavedDraft?.interceptLeave(event, href, { exact: true })) {
      return;
    }

    sectionTransition?.beginNavigation(href, { exact: true });
  }

  function goToDebtors(event: MouseEvent<HTMLAnchorElement>) {
    goToBillingHref(event, BILLING_DEBTORS_PATH);
  }

  return (
    <div className={styles.page}>
      <section className={styles.kpiRow} aria-label="Indicadores del mes">
        <button
          type="button"
          className={styles.guideCard}
          onClick={() => setIsGuideOpen(true)}
        >
          <span className={styles.kpiIconWrap} aria-hidden>
            <Info className={styles.kpiIcon} strokeWidth={ICON_STROKE} />
          </span>
          <span className={styles.guideLabel}>Guía por facturación</span>
        </button>

        <HubKpiCard
          {...metrics.hubKpis.invoiced}
          icon={CircleDollarSign}
        />
        <HubKpiCard
          {...metrics.hubKpis.receipts}
          icon={ReceiptText}
        />
        <HubKpiCard
          {...metrics.hubKpis.outstanding}
          icon={Wallet}
          href={BILLING_DEBTORS_PATH}
          onNavigate={goToDebtors}
        />
      </section>

      <div className={styles.chartsRow}>
        <InvoiceTypeChart
          className={styles.rankPanel}
          slices={metrics.invoiceTypeSlices}
          total={metrics.invoiceTypeTotal}
          monthLabel={metrics.monthLabel}
        />

        <TopRankCard
          className={styles.rankPanel}
          title="Top 5 clientes del mes"
          items={metrics.topClients}
          icon={BookUser}
          showRankIndex={false}
          footerHref="/admin/facturacion/clientes"
          footerLabel="Ver todos los clientes"
          emptyLabel="Todavía no hay clientes facturados este mes."
        />

        <TopRankCard
          className={styles.rankPanel}
          title="Top 5 rubros del mes"
          items={metrics.topRubros}
          icon={Tags}
          barTone="green"
          rankBy="amount"
          showRankIndex={false}
          footerHref="/admin/facturacion/rubros"
          footerLabel="Ver todos los rubros"
          emptyLabel="Todavía no hay rubros facturados este mes."
        />
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelHeading}>
            <span className={styles.debtHeaderIconWrap} aria-hidden>
              <FileText
                className={styles.debtHeaderIcon}
                strokeWidth={ICON_STROKE}
              />
            </span>
            <h2 className={styles.panelTitle}>Clientes con saldo pendiente</h2>
            {metrics.debtorClients.length > 0 ? (
              <p className={styles.panelMeta}>
                {metrics.debtorClients.length}{" "}
                {metrics.debtorClients.length === 1 ? "cliente" : "clientes"}
              </p>
            ) : null}
          </div>
          <Link
            href={BILLING_DEBTORS_PATH}
            className={styles.panelAllLink}
            onClick={goToDebtors}
          >
            Ver todos
          </Link>
        </div>
        {metrics.debtorClients.length === 0 ? (
          <div className={styles.debtEmpty} role="status">
            <Sticker
              className={styles.debtEmptyIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <p className={styles.debtEmptyText}>
              No hay ningún cliente con deuda
            </p>
          </div>
        ) : (
          <ul className={styles.debtGrid}>
            {metrics.debtorClients.map((client) => {
              const href = billingClientHistoryHref(client.clientId);
              return (
              <li key={client.clientId}>
                <Link
                  href={href}
                  className={styles.debtItem}
                  onClick={(event) => goToBillingHref(event, href)}
                >
                  <div className={styles.debtBody}>
                    <p className={styles.debtName}>{client.name}</p>
                    <p className={styles.debtMeta}>
                      {client.invoicesCount}{" "}
                      {client.invoicesCount === 1 ? "factura" : "facturas"}
                    </p>
                  </div>
                  <strong className={styles.debtAmount}>
                    {formatArs(client.outstanding)}
                  </strong>
                </Link>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      {isGuideOpen ? (
        <ConfirmDialog
          title="Guía de facturación"
          message="Acá va a estar el tutorial de cómo usar el sitio: crear clientes, emitir facturas, cobrar con Recibos X y consultar el Libro IVA. Por ahora esta sección es un placeholder."
          confirmLabel="Entendido"
          cancelPlacement="corner"
          onConfirm={() => setIsGuideOpen(false)}
          onCancel={() => setIsGuideOpen(false)}
        />
      ) : null}
    </div>
  );
}
