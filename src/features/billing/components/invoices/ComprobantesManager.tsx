"use client";

import { useMemo, useState } from "react";
import {
  useAdminSectionTransition,
  useReportAdminSectionReady,
} from "@/features/admin/components/AdminSectionTransition";
import { ComprobantesPageIntro } from "@/features/billing/components/invoices/ComprobantesPageIntro";
import { ComprobantesTable } from "@/features/billing/components/invoices/ComprobantesTable";
import { InvoiceDetailModal } from "@/features/billing/components/invoices/InvoiceDetailModal";
import { LibroIvaDialog } from "@/features/billing/components/invoices/LibroIvaDialog";
import {
  NoteFormModal,
  type NoteFormMode,
} from "@/features/billing/components/invoices/NoteFormModal";
import {
  ReceiptFormModal,
  type ReceiptFormMode,
} from "@/features/billing/components/recibos/ReceiptFormModal";
import {
  BILLING_INVOICE_ID_QUERY,
} from "@/features/billing/data/billingNav";
import { useBillingClientsQuery } from "@/features/billing/hooks/useBillingClientsQuery";
import { useBillingInvoicesQuery } from "@/features/billing/hooks/useBillingInvoicesQuery";
import { useBillingReceiptsQuery } from "@/features/billing/hooks/useBillingReceiptsQuery";
import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import { filterInvoiceList, invoiceCanIssueReceipt, parsePaymentStatusFilter } from "@/features/billing/utils/invoice-list";
import type { BillingPaymentStatus } from "@/generated/prisma/client";
import { replaceSearchParams } from "@/shared/lib/replace-search-params";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type InvoiceTypeFilter = "all" | "A" | "B";
type PaymentStatusFilter = "all" | BillingPaymentStatus;

function resolveOpenInvoiceId(
  invoices: readonly BillingInvoiceListItem[],
  openInvoiceId: string | undefined,
): string | null {
  if (!openInvoiceId) {
    return null;
  }

  const match =
    invoices.find((invoice) => invoice.id === openInvoiceId) ??
    invoices.find((invoice) => invoice.invoiceNumber === openInvoiceId);

  return match?.id ?? null;
}

type ComprobantesManagerProps = {
  initialInvoices: BillingInvoiceListItem[];
  clients: BillingClientListItem[];
  openInvoiceId?: string;
  initialPaymentStatus?: string;
};

export function ComprobantesManager({
  initialInvoices,
  clients,
  openInvoiceId,
  initialPaymentStatus,
}: ComprobantesManagerProps) {
  const [query, setQuery] = useState("");
  const [invoiceType, setInvoiceType] = useState<InvoiceTypeFilter>("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>(
    parsePaymentStatusFilter(initialPaymentStatus),
  );
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    () => resolveOpenInvoiceId(initialInvoices, openInvoiceId),
  );
  const [isLibroIvaOpen, setIsLibroIvaOpen] = useState(false);
  const [receiptForm, setReceiptForm] = useState<ReceiptFormMode | null>(null);
  const [noteForm, setNoteForm] = useState<NoteFormMode | null>(null);

  const invoicesQuery = useBillingInvoicesQuery(initialInvoices);
  const receiptsQuery = useBillingReceiptsQuery();
  const clientsQuery = useBillingClientsQuery(clients);
  const liveClients = clientsQuery.data ?? clients;

  function closeInvoiceDetail() {
    setSelectedInvoiceId(null);
    replaceSearchParams({ [BILLING_INVOICE_ID_QUERY]: null });
  }

  const filteredInvoices = useMemo(
    () =>
      filterInvoiceList(invoicesQuery.data ?? [], {
        query,
        invoiceType,
        paymentStatus,
        fromDate,
        toDate,
      }),
    [invoicesQuery.data, query, invoiceType, paymentStatus, fromDate, toDate],
  );

  const totals = useMemo(() => {
    let billed = 0;
    let unpaid = 0;
    let countA = 0;
    let countB = 0;

    for (const invoice of filteredInvoices) {
      billed += invoice.totalVisualRounded;
      if (
        invoice.paymentMethod === "CUENTA_CORRIENTE" &&
        invoice.outstandingAmount > 0
      ) {
        unpaid += invoice.outstandingAmount;
      }
      if (invoice.invoiceType === "A") {
        countA += 1;
      } else {
        countB += 1;
      }
    }

    return { billed, unpaid, countA, countB };
  }, [filteredInvoices]);

  const listError =
    invoicesQuery.error instanceof Error ? invoicesQuery.error.message : null;
  const isLoading = invoicesQuery.isFetching && !invoicesQuery.data;
  const selectedInvoice =
    (invoicesQuery.data ?? []).find(
      (invoice) => invoice.id === selectedInvoiceId,
    ) ?? null;

  const sectionTransition = useAdminSectionTransition();
  const hideInternalLoaders = sectionTransition?.isCoveringContent ?? false;
  const isSectionContentReady = !isLoading || Boolean(listError);
  useReportAdminSectionReady(isSectionContentReady);

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        <ComprobantesPageIntro
          query={query}
          invoiceType={invoiceType}
          paymentStatus={paymentStatus}
          fromDate={fromDate}
          toDate={toDate}
          onQueryChange={setQuery}
          onInvoiceTypeChange={setInvoiceType}
          onPaymentStatusChange={setPaymentStatus}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onLibroIvaClick={() => setIsLibroIvaOpen(true)}
        />

        <div className={styles.comprobantesLayout}>
          <div className={styles.totalsStrip} aria-label="Totales filtrados">
            <div className={styles.totalsItem}>
              <span className={styles.totalsLabel}>Facturas</span>
              <span className={styles.totalsValue}>
                {filteredInvoices.length}
              </span>
            </div>
            <div className={styles.totalsItem}>
              <span className={styles.totalsLabel}>Facturado</span>
              <span className={styles.totalsValue}>
                {formatArsExact(totals.billed)}
              </span>
            </div>
            <div className={styles.totalsItem}>
              <span className={styles.totalsLabel}>Impagas</span>
              <span className={styles.totalsValue}>
                {formatArsExact(totals.unpaid)}
              </span>
            </div>
            <div className={styles.totalsItem}>
              <span className={styles.totalsLabel}>Tipo A / B</span>
              <span className={styles.totalsValue}>
                {totals.countA} / {totals.countB}
              </span>
            </div>
          </div>

          <ComprobantesTable
            invoices={filteredInvoices}
            isLoading={hideInternalLoaders ? false : isLoading}
            error={listError}
            onDetails={(invoice) => setSelectedInvoiceId(invoice.id)}
            onIssueReceipt={(invoice) => {
              if (!invoice.clientId || !invoiceCanIssueReceipt(invoice)) {
                return;
              }
              setReceiptForm({
                kind: "create-from-invoice",
                invoiceId: invoice.id,
                clientId: invoice.clientId,
              });
            }}
          />
        </div>
      </div>

      {selectedInvoice ? (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={closeInvoiceDetail}
          onIssueReceipt={(invoice) => {
            if (!invoice.clientId || !invoiceCanIssueReceipt(invoice)) {
              return;
            }
            setReceiptForm({
              kind: "create-from-invoice",
              invoiceId: invoice.id,
              clientId: invoice.clientId,
            });
          }}
          onIssueNote={(invoice, kind) => {
            setNoteForm({ kind, invoiceId: invoice.id });
          }}
        />
      ) : null}

      {isLibroIvaOpen ? (
        <LibroIvaDialog onClose={() => setIsLibroIvaOpen(false)} />
      ) : null}

      {receiptForm ? (
        <ReceiptFormModal
          mode={receiptForm}
          clients={liveClients}
          invoices={invoicesQuery.data ?? []}
          receipts={receiptsQuery.data ?? []}
          onClose={() => setReceiptForm(null)}
        />
      ) : null}

      {noteForm ? (
        <NoteFormModal
          mode={noteForm}
          invoices={invoicesQuery.data ?? []}
          onClose={() => setNoteForm(null)}
        />
      ) : null}
    </div>
  );
}
