"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { createBillingNoteAction } from "@/features/billing/actions/billing-note.actions";
import { issueBillingNoteAction } from "@/features/billing/actions/issue-billing-note.action";
import { BillingIssueSuccessModal } from "@/features/billing/components/BillingIssueSuccessModal";
import { InvoiceSearchPicker } from "@/features/billing/components/invoices/InvoiceSearchPicker";
import {
  fiscalEnvironmentListLabel,
  type BillingInvoiceListItem,
} from "@/features/billing/types/billing-invoice.types";
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
import {
  LEGACY_NOTES_DISABLED_MESSAGE,
  legacyInternalNotesAllowed,
} from "@/features/billing/utils/legacy-notes";
import { createSubmitLock } from "@/features/billing/utils/invoice-idempotency";
import {
  discardNoteIdempotency,
  noteIntentionFingerprint,
  syncNoteIdempotency,
  type NoteIdempotencySession,
} from "@/features/billing/utils/note-idempotency";
import { NOTE_PRODUCTION_EMISSION_DISABLED_MESSAGE } from "@/shared/fiscal/production-emission";
import type {
  BillingFiscalEnvironment,
  BillingNoteKind,
} from "@/generated/prisma/client";
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
  fiscalEnvironment: BillingFiscalEnvironment;
  noteProductionEmissionEnabled?: boolean;
  onClose: () => void;
};

const HOMOLOGATION_WARNING =
  "Este comprobante se emitirá en el entorno de homologación de ARCA y no tendrá validez fiscal de producción.";

const PRODUCTION_CONFIRM_WARNING =
  "Se emitirá una Nota de Crédito/Débito real ante ARCA. Una vez autorizada no puede eliminarse ni renumerarse.";

const CLOSE_ANIMATION_MS = 180;

const INVOICE_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function noteFormSubtitle(
  kind: BillingNoteKind,
  legacyNotesAllowed: boolean,
): string {
  if (!legacyNotesAllowed) {
    return LEGACY_NOTES_DISABLED_MESSAGE;
  }

  switch (kind) {
    case "CREDIT":
      return "Ajuste el importe de una factura ya emitida.";
    case "DEBIT":
      return "Aumente el saldo de una factura de cuenta corriente.";
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
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

function noteEffectCopy(kind: BillingNoteKind): string {
  switch (kind) {
    case "CREDIT":
      return "Reduce el saldo de la factura asociada.";
    case "DEBIT":
      return "Aumenta el saldo de la factura asociada.";
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

function fiscalConfirmLabel(
  environment: BillingFiscalEnvironment,
  kind: BillingNoteKind,
  isBusy: boolean,
): string {
  if (isBusy) {
    return "Emitiendo…";
  }

  switch (environment) {
    case "MODO_PRUEBA":
      return "Emitir nota";
    case "HOMOLOGACION":
      return "Emitir en homologación";
    case "PRODUCCION":
      return kind === "CREDIT" ? "Emitir Nota de Crédito" : "Emitir Nota de Débito";
    default: {
      const unexpected: never = environment;
      return unexpected;
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

export function NoteFormModal({
  mode,
  invoices,
  fiscalEnvironment,
  noteProductionEmissionEnabled = false,
  onClose,
}: NoteFormModalProps) {
  const queryClient = useQueryClient();
  const lockedInvoiceId = mode.invoiceId ?? null;
  const [invoiceId, setInvoiceId] = useState(lockedInvoiceId ?? "");
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [amountPesos, setAmountPesos] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [fiscalFailure, setFiscalFailure] = useState<
    "ambiguous" | "rejected" | "error" | null
  >(null);
  const [createdNote, setCreatedNote] = useState<BillingNoteListItem | null>(
    null,
  );
  const [issuedFiscal, setIssuedFiscal] = useState<{
    id: string;
    noteNumber: string;
  } | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const idempotencyRef = useRef<NoteIdempotencySession | null>(null);
  const submitLockRef = useRef(createSubmitLock());

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

  useEscapeToClose(
    requestClose,
    !isBusy && createdNote === null && issuedFiscal === null,
  );

  function resetCreateForm() {
    setAmountPesos("");
    setReason("");
    setError(null);
    setConfirming(false);
    setFiscalFailure(null);
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
    setFiscalFailure(null);
  }

  function fillAvailable() {
    if (availableCents <= 0) {
      return;
    }
    setAmountPesos(formatPesosInput(availableCents));
  }

  const legacyNotesAllowed = legacyInternalNotesAllowed(fiscalEnvironment);
  const productionBlocked =
    fiscalEnvironment === "PRODUCCION" && !noteProductionEmissionEnabled;
  const fiscalNotes = !legacyNotesAllowed;

  function readIntention():
    | { ok: false; error: string }
    | { ok: true; amountCents: number; trimmedReason: string } {
    if (!invoiceId) {
      return { ok: false, error: "Elegí una factura." };
    }

    const amountCents = parsePesosInput(amountPesos) ?? 0;
    if (amountCents <= 0) {
      return { ok: false, error: "El importe tiene que ser mayor a cero." };
    }

    if (mode.kind === "CREDIT" && amountCents > availableCents) {
      return {
        ok: false,
        error: `El importe no puede superar ${formatArsExact(available)}.`,
      };
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      return { ok: false, error: "Indicá el motivo." };
    }

    return { ok: true, amountCents, trimmedReason };
  }

  async function refreshBillingQueries() {
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
      queryClient.invalidateQueries({
        queryKey: adminQueryKeys.billingClients(),
      }),
    ]);
  }

  async function submitLegacy(amountCents: number, trimmedReason: string) {
    if (!submitLockRef.current.tryEnter()) {
      return;
    }

    setIsBusy(true);
    try {
      const result = await createBillingNoteAction({
        kind: mode.kind,
        invoiceId,
        amount: centsToPesos(amountCents),
        reason: trimmedReason,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setCreatedNote(result.data);
      await refreshBillingQueries();
    } finally {
      setIsBusy(false);
      submitLockRef.current.leave();
    }
  }

  async function submitFiscal(amountCents: number, trimmedReason: string) {
    if (!submitLockRef.current.tryEnter()) {
      return;
    }

    const fingerprint = noteIntentionFingerprint({
      kind: mode.kind,
      invoiceId,
      amountCents,
      reason: trimmedReason,
    });
    const session = syncNoteIdempotency(
      idempotencyRef.current,
      fingerprint,
      () => crypto.randomUUID(),
    );
    idempotencyRef.current = session;
    setIsBusy(true);
    setError(null);

    try {
      const result = await issueBillingNoteAction({
        kind: mode.kind,
        invoiceId,
        amount: centsToPesos(amountCents),
        reason: trimmedReason,
        idempotencyKey: session.key,
      });

      if (!result.ok) {
        setError(result.message);
        setFiscalFailure(
          result.emissionStatus === "ambiguous"
            ? "ambiguous"
            : result.emissionStatus === "rejected"
              ? "rejected"
              : "error",
        );
        return;
      }

      setFiscalFailure(null);

      idempotencyRef.current = discardNoteIdempotency();
      setIssuedFiscal({
        id: result.note.id,
        noteNumber: result.note.noteNumber,
      });
      setConfirming(false);
      await refreshBillingQueries();
    } finally {
      setIsBusy(false);
      submitLockRef.current.leave();
    }
  }

  async function handleSubmit() {
    setError(null);

    if (productionBlocked) {
      setError(NOTE_PRODUCTION_EMISSION_DISABLED_MESSAGE);
      return;
    }

    const intention = readIntention();
    if (!intention.ok) {
      setError(intention.error);
      return;
    }

    if (legacyNotesAllowed) {
      await submitLegacy(intention.amountCents, intention.trimmedReason);
      return;
    }

    setConfirming(true);
  }

  async function handleFiscalConfirm() {
    const intention = readIntention();
    if (!intention.ok) {
      setError(intention.error);
      return;
    }

    await submitFiscal(intention.amountCents, intention.trimmedReason);
  }

  if (typeof document === "undefined") {
    return null;
  }

  const title = `Nueva ${NOTE_KIND_LABELS[mode.kind].toLocaleLowerCase("es-AR")}`;
  const subtitle = legacyNotesAllowed
    ? noteFormSubtitle(mode.kind, true)
    : fiscalEnvironmentListLabel(fiscalEnvironment);
  const issuedDocument = createdNote
    ? {
        id: createdNote.id,
        number: createdNote.noteNumber,
        meta: `${createdNote.clientName} · ${createdNote.invoiceType} ${createdNote.invoiceNumber} · ${formatArsExact(createdNote.amount)}`,
      }
    : issuedFiscal
      ? {
          id: issuedFiscal.id,
          number: issuedFiscal.noteNumber,
          meta: selectedInvoice
            ? `${NOTE_KIND_LABELS[mode.kind]} · ${selectedInvoice.clientName} · ${selectedInvoice.invoiceType} ${selectedInvoice.invoiceNumber} · ${amountPesos}`
            : NOTE_KIND_LABELS[mode.kind],
        }
      : null;

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
      {issuedDocument ? (
        <BillingIssueSuccessModal
          kind={mode.kind}
          embedded
          documentId={issuedDocument.id}
          documentNumber={issuedDocument.number}
          meta={issuedDocument.meta}
          clientWhatsapp={selectedInvoice?.clientWhatsapp ?? null}
          clientEmail={selectedInvoice?.clientEmail ?? null}
          onCreateAnother={() => {
            resetCreateForm();
            setCreatedNote(null);
            setIssuedFiscal(null);
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
        {confirming ? (
          <>
            <div className={styles.receiptModalBody}>
              <p className={styles.invoiceDetailSubtitle}>
                {fiscalEnvironment === "HOMOLOGACION" ? "HOMOLOGACIÓN" : fiscalEnvironmentListLabel(fiscalEnvironment)}
              </p>
              <p className={styles.receiptSelectedClientName}>
                {NOTE_KIND_LABELS[mode.kind]}
              </p>
              <p className={styles.invoiceMeta}>
                Factura {selectedInvoice ? `${selectedInvoice.invoiceType} ${selectedInvoice.invoiceNumber}` : "—"}
              </p>
              <p className={styles.invoiceMeta}>
                Cliente {selectedInvoice?.clientName ?? "—"}
              </p>
              <p className={styles.invoiceMeta}>Importe {amountPesos || "0,00"}</p>
              <p className={styles.invoiceMeta}>Motivo {reason.trim()}</p>
              <p className={styles.invoiceMeta}>
                Ambiente {fiscalEnvironmentListLabel(fiscalEnvironment)}
              </p>
              <p className={styles.invoiceMeta}>{noteEffectCopy(mode.kind)}</p>
              {fiscalEnvironment === "HOMOLOGACION" ? (
                <p className={styles.invoiceDetailSubtitle}>{HOMOLOGATION_WARNING}</p>
              ) : null}
              {fiscalEnvironment === "PRODUCCION" && noteProductionEmissionEnabled ? (
                <p className={styles.invoiceDetailSubtitle}>{PRODUCTION_CONFIRM_WARNING}</p>
              ) : null}
              {error ? (
                <p className={styles.inlineError} role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <div className={`${modalStyles.modalActions} ${styles.receiptModalFooter}`}>
              <button
                type="button"
                className={styles.receiptFillAllButton}
                onClick={() => {
                  if (isBusy) {
                    return;
                  }
                  setConfirming(false);
                }}
                disabled={isBusy}
              >
                Volver
              </button>
              <button
                type="button"
                className={modalStyles.modalSaveButton}
                onClick={() => {
                  void handleFiscalConfirm();
                }}
                disabled={isBusy || productionBlocked || fiscalFailure === "rejected"}
              >
                {fiscalFailure === "ambiguous"
                  ? "Reintentar consulta"
                  : fiscalConfirmLabel(fiscalEnvironment, mode.kind, isBusy)}
              </button>
            </div>
          </>
        ) : (
        <>
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
                    onChange={(event) => {
                      setAmountPesos(maskPesosInput(event.target.value));
                      setFiscalFailure(null);
                    }}
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
              onChange={(event) => {
                setReason(event.target.value);
                setFiscalFailure(null);
              }}
            />
          </div>

          {fiscalEnvironment === "HOMOLOGACION" ? (
            <p className={styles.invoiceDetailSubtitle}>
              HOMOLOGACIÓN. {HOMOLOGATION_WARNING}
            </p>
          ) : null}

          {productionBlocked ? (
            <p className={styles.inlineError} role="alert">
              {NOTE_PRODUCTION_EMISSION_DISABLED_MESSAGE}
            </p>
          ) : null}

          {fiscalNotes ? (
            <p className={styles.invoiceMeta}>
              {NOTE_KIND_LABELS[mode.kind]} · {fiscalEnvironmentListLabel(fiscalEnvironment)} · {noteEffectCopy(mode.kind)}
            </p>
          ) : null}

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
            disabled={isBusy || productionBlocked}
          >
            {isBusy
              ? "Emitiendo…"
              : legacyNotesAllowed
                ? "Emitir nota"
                : "Revisar emisión"}
            </button>
          </div>
        </>
        )}
        </div>
      </div>
      )}
    </div>,
    document.body,
  );
}
