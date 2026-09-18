"use client";

import { useMemo, useState } from "react";
import {
  useAdminSectionTransition,
  useReportAdminSectionReady,
} from "@/features/admin/components/AdminSectionTransition";
import { InvoiceDetailModal } from "@/features/billing/components/invoices/InvoiceDetailModal";
import {
  NoteFormModal,
  type NoteFormMode,
} from "@/features/billing/components/invoices/NoteFormModal";
import { MovimientosPageIntro } from "@/features/billing/components/movimientos/MovimientosPageIntro";
import { MovimientosTable } from "@/features/billing/components/movimientos/MovimientosTable";
import { ReceiptDetailModal } from "@/features/billing/components/recibos/ReceiptDetailModal";
import { ReceiptFormModal } from "@/features/billing/components/recibos/ReceiptFormModal";
import type { ReceiptFormMode } from "@/features/billing/components/recibos/ReceiptFormModal";
import { useBillingInvoicesQuery } from "@/features/billing/hooks/useBillingInvoicesQuery";
import { useBillingNotesQuery } from "@/features/billing/hooks/useBillingNotesQuery";
import { useBillingReceiptsQuery } from "@/features/billing/hooks/useBillingReceiptsQuery";
import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import type { BillingNoteListItem } from "@/features/billing/types/billing-note.types";
import type { BillingReceiptListItem } from "@/features/billing/types/billing-receipt.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import { invoiceCanIssueReceipt } from "@/features/billing/utils/invoice-list";
import { resolveActivityCardPeriod } from "@/features/billing/utils/billing-metrics";
import {
  buildBillingMovements,
  filterMovementList,
  type BillingMovementKind,
} from "@/features/billing/utils/movement-list";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type MovementKindFilter = "all" | BillingMovementKind;

type MovimientosManagerProps = {
  initialInvoices: BillingInvoiceListItem[];
  initialReceipts: BillingReceiptListItem[];
  initialNotes: BillingNoteListItem[];
  clients: BillingClientListItem[];
};

export function MovimientosManager({
  initialInvoices,
  initialReceipts,
  initialNotes,
  clients,
}: MovimientosManagerProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<MovementKindFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(
    null,
  );
  const [receiptForm, setReceiptForm] = useState<ReceiptFormMode | null>(null);
  const [noteForm, setNoteForm] = useState<NoteFormMode | null>(null);

  const invoicesQuery = useBillingInvoicesQuery(initialInvoices);
  const receiptsQuery = useBillingReceiptsQuery(initialReceipts);
  const notesQuery = useBillingNotesQuery(initialNotes);
  const invoices = useMemo(
    () => invoicesQuery.data ?? [],
    [invoicesQuery.data],
  );
  const receipts = useMemo(
    () => receiptsQuery.data ?? [],
    [receiptsQuery.data],
  );
  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);

  const movements = useMemo(
    () => buildBillingMovements(receipts, notes),
    [notes, receipts],
  );

  const filteredMovements = useMemo(
    () =>
      filterMovementList(movements, {
        query,
        kind,
        fromDate,
        toDate,
      }),
    [movements, query, kind, fromDate, toDate],
  );

  const activityPeriod = resolveActivityCardPeriod(fromDate, toDate);

  const totals = useMemo(() => {
    const scopedMovements = filterMovementList(movements, {
      query,
      kind,
      fromDate: activityPeriod.fromDate,
      toDate: activityPeriod.toDate,
    });

    let receiptCount = 0;
    let receiptAmount = 0;
    let creditCount = 0;
    let creditAmount = 0;
    let debitCount = 0;
    let debitAmount = 0;

    for (const movement of scopedMovements) {
      switch (movement.kind) {
        case "RECEIPT":
          receiptCount += 1;
          receiptAmount += movement.amount;
          break;
        case "CREDIT_NOTE":
          creditCount += 1;
          creditAmount += movement.amount;
          break;
        case "DEBIT_NOTE":
          debitCount += 1;
          debitAmount += movement.amount;
          break;
        default: {
          const _exhaustive: never = movement.kind;
          return _exhaustive;
        }
      }
    }

    return {
      receipts: receiptCount,
      receiptAmount,
      credits: creditCount,
      creditAmount,
      debits: debitCount,
      debitAmount,
    };
  }, [
    movements,
    query,
    kind,
    activityPeriod.fromDate,
    activityPeriod.toDate,
  ]);

  const listError =
    (invoicesQuery.error instanceof Error
      ? invoicesQuery.error.message
      : null) ??
    (receiptsQuery.error instanceof Error
      ? receiptsQuery.error.message
      : null) ??
    (notesQuery.error instanceof Error ? notesQuery.error.message : null);
  const isLoading =
    (invoicesQuery.isFetching && !invoicesQuery.data) ||
    (receiptsQuery.isFetching && !receiptsQuery.data) ||
    (notesQuery.isFetching && !notesQuery.data);
  const selectedInvoice =
    invoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;
  const selectedReceipt =
    receipts.find((receipt) => receipt.id === selectedReceiptId) ?? null;
  const receiptsById = useMemo(
    () => new Map(receipts.map((receipt) => [receipt.id, receipt])),
    [receipts],
  );

  const sectionTransition = useAdminSectionTransition();
  const hideInternalLoaders = sectionTransition?.isCoveringContent ?? false;
  const isSectionContentReady = !isLoading || Boolean(listError);
  useReportAdminSectionReady(isSectionContentReady);

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        <MovimientosPageIntro
          query={query}
          kind={kind}
          fromDate={fromDate}
          toDate={toDate}
          onQueryChange={setQuery}
          onKindChange={setKind}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onCreateReceipt={() => setReceiptForm({ kind: "create" })}
          onCreateCreditNote={() => setNoteForm({ kind: "CREDIT" })}
          onCreateDebitNote={() => setNoteForm({ kind: "DEBIT" })}
        />

        <div className={styles.comprobantesLayout}>
          <div className={styles.totalsStrip} aria-label="Totales del período">
            <div className={styles.totalsItem}>
              <span className={styles.totalsLabel}>
                Recibos{" "}
                <span className={styles.totalsPeriod}>
                  ({activityPeriod.label})
                </span>
              </span>
              <span className={styles.totalsValue}>{totals.receipts}</span>
            </div>
            <div className={styles.totalsItem}>
              <span className={styles.totalsLabel}>
                Cobrados{" "}
                <span className={styles.totalsPeriod}>
                  ({activityPeriod.label})
                </span>
              </span>
              <span className={styles.totalsValue}>
                {formatArsExact(totals.receiptAmount)}
              </span>
            </div>
            <div className={styles.totalsItem}>
              <span className={styles.totalsLabel}>
                N.C{" "}
                <span className={styles.totalsPeriod}>
                  ({activityPeriod.label})
                </span>
              </span>
              <span className={styles.totalsValue}>
                {totals.credits} · {formatArsExact(totals.creditAmount)}
              </span>
            </div>
            <div className={styles.totalsItem}>
              <span className={styles.totalsLabel}>
                N.D{" "}
                <span className={styles.totalsPeriod}>
                  ({activityPeriod.label})
                </span>
              </span>
              <span className={styles.totalsValue}>
                {totals.debits} · {formatArsExact(totals.debitAmount)}
              </span>
            </div>
          </div>

          <MovimientosTable
            movements={filteredMovements}
            kindFilter={kind}
            isLoading={hideInternalLoaders ? false : isLoading}
            error={listError}
            onOpenInvoice={setSelectedInvoiceId}
            onOpenReceipt={setSelectedReceiptId}
            onAllocate={(receiptId) => {
              const receipt = receiptsById.get(receiptId);
              if (receipt && receipt.remainingAmount > 0) {
                setReceiptForm({ kind: "allocate", receipt });
              }
            }}
          />
        </div>
      </div>

      {selectedInvoice ? (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoiceId(null)}
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
          onIssueNote={(invoice, noteKind) => {
            setNoteForm({ kind: noteKind, invoiceId: invoice.id });
          }}
        />
      ) : null}

      {selectedReceipt ? (
        <ReceiptDetailModal
          receipt={selectedReceipt}
          invoices={invoices}
          onClose={() => setSelectedReceiptId(null)}
          onOpenInvoice={(invoiceId) => {
            setSelectedReceiptId(null);
            setSelectedInvoiceId(invoiceId);
          }}
        />
      ) : null}

      {receiptForm ? (
        <ReceiptFormModal
          mode={receiptForm}
          clients={clients}
          invoices={invoices}
          receipts={receipts}
          onClose={() => setReceiptForm(null)}
        />
      ) : null}

      {noteForm ? (
        <NoteFormModal
          mode={noteForm}
          invoices={invoices}
          onClose={() => setNoteForm(null)}
        />
      ) : null}
    </div>
  );
}
