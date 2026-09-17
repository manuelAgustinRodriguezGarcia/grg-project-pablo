"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { createBillingNoteAction } from "@/features/billing/actions/billing-note.actions";
import { BillingIssueSuccessModal } from "@/features/billing/components/BillingIssueSuccessModal";
import { InvoiceSearchPicker } from "@/features/billing/components/invoices/InvoiceSearchPicker";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import {
  NOTE_KIND_LABELS,
  type BillingNoteListItem,
} from "@/features/billing/types/billing-note.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import { useEscapeToClose } from "@/features/billing/hooks/useBillingModalKeyboard";
import {
  invoiceCanIssueCreditNote,
  invoiceCanIssueDebitNote,
} from "@/features/billing/utils/invoice-list";
import {
  formatPesosInput,
  maskPesosInput,
  parsePesosInput,
} from "@/features/billing/utils/receipt-allocation";
import type { BillingNoteKind } from "@/generated/prisma/client";
import { centsToPesos, pesosToCents } from "@/shared/utils/billing-invoice-totals";
import { ICON_STROKE, UserRoundArrowLeft, X } from "@/shared/icons";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

export type NoteFormMode = {
  kind: BillingNoteKind;
  invoiceId?: string;
};

type NoteFormModalProps = {
  mode: NoteFormMode;
  invoices: BillingInvoiceListItem[];
  onClose: () => void;
};

const CLOSE_ANIMATION_MS = 180;

const INVOICE_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function availableAmount(
  invoice: BillingInvoiceListItem,
  kind: BillingNoteKind,
): number {
  switch (kind) {
    case "CREDIT":
      return invoice.creditNoteCap;
    case "DEBIT":
      return invoice.outstandingAmount;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function invoiceMatchesPickerQuery(
  invoice: BillingInvoiceListItem,
  query: string,
): boolean {
  const normalized = query.trim().toLocaleLowerCase("es-AR");
  if (!normalized) {
    return true;
  }

  return (
    invoice.invoiceNumber.toLocaleLowerCase("es-AR").includes(normalized) ||
    invoice.clientName.toLocaleLowerCase("es-AR").includes(normalized) ||
    invoice.clientCode.toLocaleLowerCase("es-AR").includes(normalized)
  );
}

export function NoteFormModal({ mode, invoices, onClose }: NoteFormModalProps) {
  const queryClient = useQueryClient();
  const lockedInvoiceId = mode.invoiceId ?? null;
  const [invoiceId, setInvoiceId] = useState(lockedInvoiceId ?? "");
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [amountPesos, setAmountPesos] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [createdNote, setCreatedNote] = useState<BillingNoteListItem | null>(
    null,
  );
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function finishAfterClose(next: () => void) {
    if (isClosing) {
      return;
    }

    if (prefersReducedMotion()) {
      next();
      return;
    }

    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(false);
      next();
    }, CLOSE_ANIMATION_MS);
  }

  function requestClose() {
    finishAfterClose(onClose);
  }

  useEscapeToClose(requestClose, !isBusy && createdNote === null);

  function resetCreateForm() {
    setAmountPesos("");
    setReason("");
    setError(null);
    if (!lockedInvoiceId) {
      setInvoiceId("");
      setInvoiceQuery("");
    }
  }

  const eligibleInvoices = useMemo(
    () =>
      invoices.filter((invoice) =>
        mode.kind === "CREDIT"
          ? invoiceCanIssueCreditNote(invoice)
          : invoiceCanIssueDebitNote(invoice),
      ),
    [invoices, mode.kind],
  );

  const selectedInvoice =
    invoices.find((invoice) => invoice.id === invoiceId) ?? null;
  const available = selectedInvoice
    ? availableAmount(selectedInvoice, mode.kind)
    : 0;
  const availableCents = pesosToCents(available);

  const pickerOptions = useMemo(
    () =>
      eligibleInvoices
        .filter((invoice) => invoiceMatchesPickerQuery(invoice, invoiceQuery))
        .slice(0, 20)
        .map((invoice) => ({
          id: invoice.id,
          title: invoice.clientName,
          amount: formatArsExact(availableAmount(invoice, mode.kind)),
          subtitle: `${invoice.invoiceNumber} | ${INVOICE_DATE_FORMATTER.format(new Date(invoice.issuedAt))}`,
          badge: invoice.invoiceType,
        })),
    [eligibleInvoices, invoiceQuery, mode.kind],
  );

  function selectInvoice(nextInvoiceId: string) {
    setInvoiceId(nextInvoiceId);
    setInvoiceQuery("");
    setAmountPesos("");
    setError(null);
  }

  function fillAvailable() {
    if (availableCents <= 0) {
      return;
    }
    setAmountPesos(formatPesosInput(availableCents));
  }

  async function handleSubmit() {
    setError(null);

    if (!invoiceId) {
      setError("Elegí una factura.");
      return;
    }

    const amountCents = parsePesosInput(amountPesos) ?? 0;
    if (amountCents <= 0) {
      setError("El importe tiene que ser mayor a cero.");
      return;
    }

    if (mode.kind === "CREDIT" && amountCents > availableCents) {
      setError(
        `El importe no puede superar ${formatArsExact(available)}.`,
      );
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError("Indicá el motivo.");
      return;
    }

    setIsBusy(true);
    const result = await createBillingNoteAction({
      kind: mode.kind,
      invoiceId,
      amount: centsToPesos(amountCents),
      reason: trimmedReason,
    });
    setIsBusy(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setCreatedNote(result.data);

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminQueryKeys.billingInvoices(),
      }),
      queryClient.invalidateQueries({
        queryKey: adminQueryKeys.billingNotes(),
      }),
      queryClient.invalidateQueries({
        queryKey: adminQueryKeys.billingReceipts(),
      }),
    ]);
  }

  if (typeof document === "undefined") {
    return null;
  }

  const title = `Nueva ${NOTE_KIND_LABELS[mode.kind].toLocaleLowerCase("es-AR")}`;
  const subtitle =
    mode.kind === "CREDIT"
      ? "Ajuste el importe de una factura ya emitida."
      : "Aumente el saldo de una factura de cuenta corriente.";

  return createPortal(
    <div
      className={`${modalStyles.modalOverlay} ${styles.receiptFormOverlay}${
        isClosing ? ` ${styles.receiptFormOverlayClosing}` : ""
      }`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          requestClose();
        }
      }}
    >
      {createdNote ? (
        <BillingIssueSuccessModal
          kind={mode.kind}
          embedded
          documentId={createdNote.id}
          documentNumber={createdNote.noteNumber}
          meta={`${createdNote.clientName} · ${createdNote.invoiceType} ${createdNote.invoiceNumber} · ${formatArsExact(createdNote.amount)}`}
          clientWhatsapp={selectedInvoice?.clientWhatsapp ?? null}
          clientEmail={selectedInvoice?.clientEmail ?? null}
          onCreateAnother={() => {
            resetCreateForm();
            setCreatedNote(null);
          }}
          onClose={() => finishAfterClose(onClose)}
        />
      ) : (
      <div
        className={`${modalStyles.modalCard} ${styles.receiptModalCard}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-form-title"
      >
        <header className={styles.invoiceDetailHeader}>
          <div>
            <h2 id="note-form-title" className={styles.invoiceDetailTitle}>
              {title}
            </h2>
            <p className={styles.invoiceDetailSubtitle}>{subtitle}</p>
          </div>
          <button
            type="button"
            className={styles.invoiceDetailClose}
            onClick={requestClose}
            disabled={isBusy}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </header>

        <div className={styles.modalSheet}>
        <div className={styles.receiptModalBody}>
          <div className={styles.receiptField}>
            <label
              className={modalStyles.formLabel}
              htmlFor={selectedInvoice ? undefined : "note-invoice-picker"}
            >
              Factura
            </label>
            {selectedInvoice ? (
              <div className={styles.receiptSelectedClient}>
                <div className={styles.receiptSelectedClientBody}>
                  <p className={styles.receiptSelectedClientName}>
                    {selectedInvoice.invoiceType} {selectedInvoice.invoiceNumber}
                  </p>
                  <p className={styles.receiptSelectedClientMeta}>
                    {selectedInvoice.clientName} · {selectedInvoice.clientCode}
                  </p>
                </div>
                {lockedInvoiceId ? null : (
                  <button
                    type="button"
                    className={styles.receiptSelectedClientClear}
                    onClick={() => selectInvoice("")}
                    disabled={isBusy}
                    aria-label="Cambiar factura"
                  >
                    <UserRoundArrowLeft
                      strokeWidth={ICON_STROKE}
                      aria-hidden
                    />
                    Cambiar
                  </button>
                )}
              </div>
            ) : (
              <InvoiceSearchPicker
                inputId="note-invoice-picker"
                placeholder="Buscar por número o cliente…"
                query={invoiceQuery}
                options={pickerOptions}
                emptyText={
                  mode.kind === "CREDIT"
                    ? "No hay facturas con importe disponible para nota de crédito."
                    : "No hay facturas de cuenta corriente con saldo para nota de débito."
                }
                disabled={isBusy}
                autoFocus
                onQueryChange={setInvoiceQuery}
                onSelect={selectInvoice}
              />
            )}
          </div>

          <div className={styles.receiptAmountRow}>
            <div className={styles.receiptField}>
              <label className={modalStyles.formLabel} htmlFor="note-available">
                Disponible
              </label>
              <input
                id="note-available"
                className={modalStyles.formInput}
                readOnly
                tabIndex={-1}
                value={selectedInvoice ? formatArsExact(available) : ""}
                placeholder="0,00"
              />
            </div>
            <div className={styles.receiptField}>
              <label className={modalStyles.formLabel} htmlFor="note-amount">
                Importe
              </label>
              <div className={styles.receiptAmountInputRow}>
                <div className={styles.receiptAmountInputGrow}>
                  <input
                    id="note-amount"
                    className={modalStyles.formInput}
                    inputMode="decimal"
                    placeholder="0,00"
                    autoComplete="off"
                    spellCheck={false}
                    value={amountPesos}
                    disabled={isBusy || !selectedInvoice}
                    onChange={(event) =>
                      setAmountPesos(maskPesosInput(event.target.value))
                    }
                  />
                </div>
                <button
                  type="button"
                  className={styles.receiptFillAllButton}
                  onClick={fillAvailable}
                  disabled={isBusy || availableCents <= 0}
                  aria-label="Cargar todo el importe disponible"
                >
                  100%
                </button>
              </div>
            </div>
          </div>

          <div className={styles.receiptField}>
            <label className={modalStyles.formLabel} htmlFor="note-reason">
              Motivo
            </label>
            <textarea
              id="note-reason"
              className={modalStyles.formTextarea}
              rows={3}
              maxLength={1000}
              placeholder="Motivo de la nota…"
              value={reason}
              disabled={isBusy}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          {error ? (
            <p className={styles.inlineError} role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className={`${modalStyles.modalActions} ${styles.receiptModalFooter}`}>
          <button
            type="button"
            className={modalStyles.modalSaveButton}
            onClick={() => {
              void handleSubmit();
            }}
            disabled={isBusy}
          >
            {isBusy ? "Emitiendo…" : "Emitir nota"}
          </button>
        </div>
        </div>
      </div>
      )}
    </div>,
    document.body,
  );
}
