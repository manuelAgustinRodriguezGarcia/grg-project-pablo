"use client";

import Link from "next/link";
import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import { InvoiceDocumentActions } from "@/features/billing/components/invoices/InvoiceDocumentActions";
import { DocumentActivityBadges } from "@/features/billing/components/invoices/DocumentActivityBadges";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import {
  FISCAL_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/features/billing/types/billing-invoice.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import {
  formatInvoiceIdentification,
  invoiceCanIssueReceipt,
  paymentStatusTone,
} from "@/features/billing/utils/invoice-list";
import type { BillingPaymentStatus } from "@/generated/prisma/client";
import { ICON_STROKE, Plus, Receipt, ReceiptText } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type ComprobantesTableProps = {
  invoices: BillingInvoiceListItem[];
  isLoading: boolean;
  error: string | null;
  onDetails: (invoice: BillingInvoiceListItem) => void;
  onIssueReceipt: (invoice: BillingInvoiceListItem) => void;
};

function paymentStatusBadgeClass(status: BillingPaymentStatus): string {
  const tone = paymentStatusTone(status);
  switch (tone) {
    case "ok":
      return styles.statusBadgeOk;
    case "partial":
      return styles.statusBadgePartial;
    case "inactive":
      return styles.statusBadgeInactive;
    case "void":
      return styles.statusBadgeAnulada;
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

const INVOICE_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function ComprobantesTable({
  invoices,
  isLoading,
  error,
  onDetails,
  onIssueReceipt,
}: ComprobantesTableProps) {
  if (isLoading) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de facturas">
        <AdminTableSkeleton
          variant="users"
          label="Cargando facturas…"
          rowCount={6}
          fillHeight
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de facturas">
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (invoices.length === 0) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de facturas">
        <div className={styles.tableWrapEmpty}>
          <div className={styles.tableEmpty} role="status">
            <ReceiptText
              className={styles.tableEmptyIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <p className={styles.tableEmptyText}>
              No hay facturas que coincidan con los filtros.
            </p>
            <Link
              href="/admin/facturacion/nueva-factura"
              className={styles.primaryButton}
            >
              <Plus strokeWidth={ICON_STROKE} aria-hidden />
              Crear factura
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.tablePanel} aria-label="Listado de facturas">
      <div className={styles.tableWrap}>
        <div className={styles.desktopTable}>
          <table className={styles.clientsTable}>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Cliente</th>
                <th scope="col">Tipo</th>
                <th scope="col">Número</th>
                <th scope="col">Total</th>
                <th scope="col">Pago</th>
                <th scope="col">Estado</th>
                <th scope="col" className={styles.actionsCell}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const identification = formatInvoiceIdentification(
                  invoice.clientIdentificationType,
                  invoice.clientIdentificationNumber,
                );

                return (
                  <tr key={invoice.id}>
                    <td>
                      {INVOICE_DATE_FORMATTER.format(new Date(invoice.issuedAt))}
                    </td>
                    <td className={styles.clientIdentityCell}>
                      {invoice.clientName}
                      {identification ? (
                        <p className={styles.invoiceMeta}>{identification}</p>
                      ) : null}
                    </td>
                    <td>
                      <span
                        className={`${styles.invoiceTypeBadge} ${
                          invoice.invoiceType === "A"
                            ? styles.invoiceTypeBadgeA
                            : styles.invoiceTypeBadgeB
                        }`}
                      >
                        {invoice.invoiceType}
                      </span>
                    </td>
                    <td className={styles.invoiceNumberCell}>
                      {invoice.invoiceNumber}
                      <DocumentActivityBadges activity={invoice} />
                    </td>
                    <td className={styles.amountCell}>
                      {formatArsExact(invoice.totalVisualRounded)}
                    </td>
                    <td>
                      <div className={styles.paymentCell}>
                        <div className={styles.paymentCellCopy}>
                          <span
                            className={`${styles.statusBadge} ${paymentStatusBadgeClass(invoice.paymentStatus)}`}
                          >
                            {PAYMENT_STATUS_LABELS[invoice.paymentStatus]}
                          </span>
                          <p className={styles.invoiceMeta}>
                            {PAYMENT_METHOD_LABELS[invoice.paymentMethod]}
                          </p>
                        </div>
                        {invoiceCanIssueReceipt(invoice) ? (
                          <span className={styles.paymentCellAction}>
                            <span className={styles.rowActionWrap}>
                              <button
                                type="button"
                                className={`${styles.editActionButton} ${styles.iconActionButton} ${styles.issueReceiptButton}`}
                                onClick={() => onIssueReceipt(invoice)}
                                aria-label={`Emitir recibo para ${invoice.invoiceNumber}`}
                              >
                                <Receipt strokeWidth={ICON_STROKE} aria-hidden />
                              </button>
                              <span
                                className={styles.rowActionTooltip}
                                role="tooltip"
                              >
                                Emitir recibo
                              </span>
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <span className={styles.ivaBadge}>
                        {FISCAL_STATUS_LABELS[invoice.fiscalStatus]}
                      </span>
                    </td>
                    <td className={styles.actionsCell}>
                      <InvoiceDocumentActions
                        invoice={invoice}
                        onDetails={onDetails}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.mobileList}>
          {invoices.map((invoice) => {
            const identification = formatInvoiceIdentification(
              invoice.clientIdentificationType,
              invoice.clientIdentificationNumber,
            );

            return (
              <article key={invoice.id} className={styles.clientCard}>
                <div className={styles.clientCardHeader}>
                  <div>
                    <p className={styles.clientCardCode}>
                      {invoice.invoiceNumber}
                    </p>
                    <DocumentActivityBadges activity={invoice} />
                    <h2 className={styles.clientCardName}>
                      {invoice.clientName}
                    </h2>
                    {identification ? (
                      <p className={styles.invoiceMeta}>{identification}</p>
                    ) : null}
                    <p className={styles.invoiceMeta}>
                      {INVOICE_DATE_FORMATTER.format(new Date(invoice.issuedAt))}
                    </p>
                  </div>
                  <div className={styles.clientCardBadges}>
                    <span
                      className={`${styles.invoiceTypeBadge} ${
                        invoice.invoiceType === "A"
                          ? styles.invoiceTypeBadgeA
                          : styles.invoiceTypeBadgeB
                      }`}
                    >
                      {invoice.invoiceType}
                    </span>
                    <span
                      className={`${styles.statusBadge} ${paymentStatusBadgeClass(invoice.paymentStatus)}`}
                    >
                      {PAYMENT_STATUS_LABELS[invoice.paymentStatus]}
                    </span>
                  </div>
                </div>
                <p className={styles.amountCell}>
                  {formatArsExact(invoice.totalVisualRounded)}
                </p>
                <InvoiceDocumentActions
                  invoice={invoice}
                  onDetails={onDetails}
                  onIssueReceipt={onIssueReceipt}
                  variant="card"
                />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
