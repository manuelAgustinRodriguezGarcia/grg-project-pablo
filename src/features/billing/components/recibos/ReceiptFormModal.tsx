"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { adminQueryKeys } from "@/features/admin/query-keys";
import {
  allocateBillingReceiptAction,
  createBillingReceiptAction,
  releaseClientOverpaymentsAction,
} from "@/features/billing/actions/billing-receipt.actions";
import type { BillingReceiptPaymentMethod } from "@/generated/prisma/client";
import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import type { BillingReceiptListItem } from "@/features/billing/types/billing-receipt.types";
import {
  RECEIPT_PAYMENT_METHOD_LABELS,
  RECEIPT_PAYMENT_METHOD_ORDER,
} from "@/features/billing/types/billing-receipt.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import { useEscapeToClose } from "@/features/billing/hooks/useBillingModalKeyboard";
import {
  clientAvailableCreditCents,
  formatPesosInput,
  maskPesosInput,
  parsePesosInput,
  redistributeFifo,
  selectedAllocationCents,
  splitApplyWithCredit,
  type ReceiptAllocationRow,
} from "@/features/billing/utils/receipt-allocation";
import { preselectInvoiceRows } from "@/features/billing/utils/receipt-prefill";
import { centsToPesos, pesosToCents } from "@/shared/utils/billing-invoice-totals";
import {
  formatBillingClientPickerIdentification,
  toBillingClientPickerOptions,
} from "@/features/billing/utils/billing-client-picker";
import { BillingIssueSuccessModal } from "@/features/billing/components/BillingIssueSuccessModal";
import { InvoiceSearchPicker } from "@/features/billing/components/invoices/InvoiceSearchPicker";
import { CustomSelect } from "@/shared/components/CustomSelect";
import { ICON_STROKE, UserRoundArrowLeft, X } from "@/shared/icons";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

export type ReceiptFormMode =
  | { kind: "create" }
  | { kind: "create-from-invoice"; invoiceId: string; clientId: string }
  | { kind: "allocate"; receipt: BillingReceiptListItem };

type ReceiptFormModalProps = {
  mode: ReceiptFormMode;
  clients: BillingClientListItem[];
  invoices: BillingInvoiceListItem[];
  receipts?: BillingReceiptListItem[];
  onClose: () => void;
};

const CLOSE_ANIMATION_MS = 180;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function outstandingRowsForClient(
  invoices: BillingInvoiceListItem[],
  clientId: string,
): ReceiptAllocationRow[] {
  return invoices
    .filter(
      (invoice) =>
        invoice.clientId === clientId &&
        invoice.paymentMethod === "CUENTA_CORRIENTE" &&
        invoice.paymentStatus !== "PAGA" &&
        invoice.paymentStatus !== "ANULADA" &&
        invoice.outstandingAmount > 0,
    )
    .sort(
      (left, right) =>
        new Date(left.issuedAt).getTime() - new Date(right.issuedAt).getTime(),
    )
    .map((invoice) => ({
      invoiceId: invoice.id,
      issuedAt: invoice.issuedAt,
      outstandingCents: pesosToCents(invoice.outstandingAmount),
      selected: false,
      applyCents: 0,
      applyLocked: false,
    }));
}

type AllocationEdit = {
  selected: boolean;
  applyCents: number;
  applyLocked: boolean;
};

function baseRowsForMode(
  mode: ReceiptFormMode,
  invoices: BillingInvoiceListItem[],
  clientId: string,
): ReceiptAllocationRow[] {
  const nextRows = outstandingRowsForClient(invoices, clientId);
  switch (mode.kind) {
    case "create-from-invoice":
      return preselectInvoiceRows(nextRows, mode.invoiceId);
    case "allocate":
      return nextRows.map((row) => ({ ...row, selected: true }));
    case "create":
      return nextRows;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function ReceiptFormModal({
  mode,
  clients,
  invoices,
  receipts = [],
  onClose,
}: ReceiptFormModalProps) {
  const queryClient = useQueryClient();
  const isAllocate = mode.kind === "allocate";
  const lockedClientId =
    mode.kind === "create-from-invoice"
      ? mode.clientId
      : mode.kind === "allocate"
        ? mode.receipt.clientId
        : null;
  const [clientId, setClientId] = useState(lockedClientId ?? "");
  const [amountPesos, setAmountPesos] = useState(
    isAllocate ? String(mode.receipt.remainingAmount) : "",
  );
  const [paymentMethod, setPaymentMethod] =
    useState<BillingReceiptPaymentMethod>("EFECTIVO");
  const [notes, setNotes] = useState("");
  const [useCredit, setUseCredit] = useState(false);
  const [edits, setEdits] = useState<Record<string, AllocationEdit>>({});
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [focusedApplyInvoiceId, setFocusedApplyInvoiceId] = useState<
    string | null
  >(null);
  const [focusedApplyDraft, setFocusedApplyDraft] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [createdReceipt, setCreatedReceipt] =
    useState<BillingReceiptListItem | null>(null);
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

  useEscapeToClose(requestClose, !isBusy && createdReceipt === null);

  function resetCreateForm() {
    setAmountPesos("");
    setPaymentMethod("EFECTIVO");
    setNotes("");
    setUseCredit(false);
    setEdits({});
    setError(null);
    setFocusedApplyInvoiceId(null);
    setFocusedApplyDraft("");
    if (!lockedClientId) {
      setClientId("");
      setClientQuery("");
    }
  }

  const amountCents = isAllocate
    ? pesosToCents(mode.receipt.remainingAmount)
    : (parsePesosInput(amountPesos) ?? 0);

  const excludeReceiptId = isAllocate ? mode.receipt.id : null;
  const creditCents = clientAvailableCreditCents(
    receipts,
    invoices,
    clientId,
    excludeReceiptId,
  );
  const usedCreditCents = !isAllocate && useCredit ? creditCents : 0;
  const applyPoolCents = amountCents + usedCreditCents;

  const rows = useMemo(() => {
    if (!clientId) {
      return [];
    }

    const merged = baseRowsForMode(mode, invoices, clientId).map((row) => {
      const edit = edits[row.invoiceId];
      const selected =
        applyPoolCents > 0 && (edit ? edit.selected : row.selected);
      if (!edit) {
        return { ...row, selected };
      }
      return {
        ...row,
        selected,
        applyCents: selected ? edit.applyCents : 0,
        applyLocked: selected ? edit.applyLocked : false,
      };
    });

    return redistributeFifo(merged, applyPoolCents);
  }, [applyPoolCents, clientId, edits, invoices, mode]);

  const allocatedCents = selectedAllocationCents(rows);
  const creditAppliedCents = Math.min(usedCreditCents, allocatedCents);
  const cashAppliedCents = Math.max(0, allocatedCents - creditAppliedCents);
  const remainingToAccount = Math.max(0, amountCents - cashAppliedCents);
  const outstandingTotalCents = rows.reduce(
    (sum, row) => sum + row.outstandingCents,
    0,
  );
  const cashNeededCents = Math.max(0, outstandingTotalCents - usedCreditCents);

  const canSelectInvoices = applyPoolCents > 0;
  const canUseCredit = !isAllocate && creditCents > 0;
  const hasClientCredit = Boolean(clientId && creditCents > 0);

  function toggleInvoiceSelected(invoiceId: string, selected: boolean) {
    if (selected && !canSelectInvoices) {
      return;
    }
    setEdits((current) => ({
      ...current,
      [invoiceId]: {
        selected,
        applyLocked: false,
        applyCents: 0,
      },
    }));
  }

  function fillAllOutstanding() {
    if (isAllocate || isBusy || outstandingTotalCents <= 0) {
      return;
    }

    setAmountPesos(
      cashNeededCents > 0 ? formatPesosInput(cashNeededCents) : "",
    );
    setEdits(
      Object.fromEntries(
        rows.map((row) => [
          row.invoiceId,
          {
            selected: true,
            applyLocked: false,
            applyCents: 0,
          },
        ]),
      ),
    );
  }

  const invoiceById = useMemo(() => {
    return new Map(invoices.map((invoice) => [invoice.id, invoice]));
  }, [invoices]);

  const selectedClient = clients.find((client) => client.id === clientId) ?? null;
  const clientPickerOptions = useMemo(
    () => toBillingClientPickerOptions(clients, clientQuery),
    [clientQuery, clients],
  );
  const lockedClientName =
    mode.kind === "allocate"
      ? mode.receipt.clientName
      : (selectedClient?.name ?? "");

  function selectReceiptClient(nextClientId: string) {
    setClientId(nextClientId);
    setClientQuery("");
    setEdits({});
    setUseCredit(false);
  }

  async function handleSubmit() {
    setError(null);

    if (!clientId) {
      setError("Elegí un cliente.");
      return;
    }
    if (isAllocate && amountCents <= 0) {
      setError("El importe tiene que ser mayor a cero.");
      return;
    }
    if (!isAllocate && amountCents <= 0 && usedCreditCents <= 0) {
      setError("El importe tiene que ser mayor a cero.");
      return;
    }
    if (!isAllocate && amountCents > 0 && !paymentMethod) {
      setError("Elegí cómo pagó.");
      return;
    }

    const selectedRows = rows.filter((row) => row.selected && row.applyCents > 0);

    if (isAllocate) {
      setIsBusy(true);
      const result = await allocateBillingReceiptAction({
        receiptId: mode.receipt.id,
        notes: notes.trim() || null,
        allocations: selectedRows.map((row) => ({
          invoiceId: row.invoiceId,
          amount: centsToPesos(row.applyCents),
        })),
      });
      setIsBusy(false);

      if (!result.success) {
        setError(result.error);
        if (result.code === "SALDO_CHANGED") {
          await queryClient.invalidateQueries({
            queryKey: adminQueryKeys.billingInvoices(),
          });
        }
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.billingInvoices(),
        }),
        queryClient.invalidateQueries({
          queryKey: adminQueryKeys.billingReceipts(),
        }),
      ]);
      requestClose();
      return;
    }

    setIsBusy(true);

    let issuedReceipt: BillingReceiptListItem | null = null;

    if (amountCents > 0) {
      const createResult = await createBillingReceiptAction({
        clientId,
        amount: centsToPesos(amountCents),
        paymentMethod,
        notes: notes.trim() || null,
        useClientCredit: usedCreditCents > 0,
        allocations: selectedRows.map((row) => ({
          invoiceId: row.invoiceId,
          amount: centsToPesos(row.applyCents),
        })),
      });
      if (!createResult.success) {
        setIsBusy(false);
        setError(createResult.error);
        if (createResult.code === "SALDO_CHANGED") {
          await queryClient.invalidateQueries({
            queryKey: adminQueryKeys.billingInvoices(),
          });
        }
        return;
      }
      issuedReceipt = createResult.data;
    } else {
      let receiptsForCredit = receipts;
      if (usedCreditCents > 0) {
        const repaired = await releaseClientOverpaymentsAction(clientId);
        if (!repaired.success) {
          setIsBusy(false);
          setError(repaired.error);
          return;
        }
        receiptsForCredit = repaired.data;
      }

      const creditReceipts = receiptsForCredit
        .filter(
          (receipt) =>
            receipt.clientId === clientId && receipt.remainingAmount > 0,
        )
        .sort(
          (left, right) =>
            new Date(left.issuedAt).getTime() - new Date(right.issuedAt).getTime(),
        )
        .map((receipt) => ({
          receiptId: receipt.id,
          remainingCents: pesosToCents(receipt.remainingAmount),
        }));

      const split = splitApplyWithCredit(
        selectedRows.map((row) => ({
          invoiceId: row.invoiceId,
          applyCents: row.applyCents,
        })),
        creditReceipts,
        usedCreditCents,
      );

      const creditByReceipt = new Map<
        string,
        Array<{ invoiceId: string; amount: number }>
      >();
      for (const item of split.creditAllocations) {
        const current = creditByReceipt.get(item.receiptId) ?? [];
        const existing = current.find((row) => row.invoiceId === item.invoiceId);
        if (existing) {
          existing.amount += centsToPesos(item.amountCents);
        } else {
          current.push({
            invoiceId: item.invoiceId,
            amount: centsToPesos(item.amountCents),
          });
        }
        creditByReceipt.set(item.receiptId, current);
      }

      if (creditByReceipt.size === 0) {
        setIsBusy(false);
        setError("El importe tiene que ser mayor a cero.");
        return;
      }

      for (const [receiptId, creditAllocations] of creditByReceipt) {
        const creditResult = await allocateBillingReceiptAction({
          receiptId,
          allocations: creditAllocations,
          notes: notes.trim() || null,
        });
        if (!creditResult.success) {
          setIsBusy(false);
          setError(creditResult.error);
          if (creditResult.code === "SALDO_CHANGED") {
            await queryClient.invalidateQueries({
              queryKey: adminQueryKeys.billingInvoices(),
            });
          }
          return;
        }
      }
    }

    setIsBusy(false);

    if (issuedReceipt) {
      setCreatedReceipt(issuedReceipt);
    }

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: adminQueryKeys.billingInvoices(),
      }),
      queryClient.invalidateQueries({
        queryKey: adminQueryKeys.billingReceipts(),
      }),
    ]);

    if (!issuedReceipt) {
      requestClose();
    }
  }

  if (typeof document === "undefined") {
    return null;
  }

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
      {createdReceipt ? (
        <BillingIssueSuccessModal
          kind="RECEIPT"
          embedded
          documentId={createdReceipt.id}
          documentNumber={createdReceipt.receiptNumber}
          meta={`${createdReceipt.clientName} · ${formatArsExact(createdReceipt.amount)} · ${RECEIPT_PAYMENT_METHOD_LABELS[createdReceipt.paymentMethod]}`}
          clientWhatsapp={createdReceipt.clientWhatsapp}
          clientEmail={createdReceipt.clientEmail}
          onCreateAnother={() => {
            resetCreateForm();
            setCreatedReceipt(null);
          }}
          onClose={() => finishAfterClose(onClose)}
        />
      ) : (
      <div
        className={`${modalStyles.modalCard} ${styles.receiptModalCard}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-form-title"
      >
        <header className={styles.invoiceDetailHeader}>
          <div>
            <h2 id="receipt-form-title" className={styles.invoiceDetailTitle}>
              {isAllocate ? "Imputar Recibo" : "Nuevo Recibo"}
            </h2>
            <p className={styles.invoiceDetailSubtitle}>
              {isAllocate
                ? "Impute el saldo restante a las facturas pendientes del cliente."
                : "Registre el cobro e impute las facturas pendientes del cliente."}
            </p>
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
          <div className={styles.receiptAmountRow}>
            <div className={`${styles.receiptField} ${styles.receiptClientField}`}>
              <label
                className={modalStyles.formLabel}
                htmlFor={
                  selectedClient || lockedClientId
                    ? undefined
                    : "receipt-client-picker"
                }
              >
                Cliente
              </label>
              {selectedClient || lockedClientId ? (
                <div className={styles.receiptSelectedClient}>
                  <div className={styles.receiptSelectedClientBody}>
                    <p className={styles.receiptSelectedClientName}>
                      {selectedClient?.name ?? lockedClientName}
                    </p>
                    {selectedClient ? (
                      <p className={styles.receiptSelectedClientMeta}>
                        {selectedClient.code} ·{" "}
                        {formatBillingClientPickerIdentification(selectedClient)}
                      </p>
                    ) : null}
                  </div>
                  {lockedClientId ? null : (
                    <button
                      type="button"
                      className={styles.receiptSelectedClientClear}
                      onClick={() => selectReceiptClient("")}
                      disabled={isBusy}
                      aria-label="Cambiar cliente"
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
                  inputId="receipt-client-picker"
                  placeholder="Buscar por nombre, código, CUIT o DNI…"
                  query={clientQuery}
                  options={clientPickerOptions}
                  emptyText="No se encontraron clientes con esa búsqueda."
                  disabled={isBusy}
                  onQueryChange={setClientQuery}
                  onSelect={selectReceiptClient}
                />
              )}
            </div>
            <div className={styles.receiptField}>
              <label className={modalStyles.formLabel} htmlFor="receipt-credit">
                Saldo a favor
              </label>
              <div className={styles.receiptAmountInputRow}>
                <div className={styles.receiptAmountInputGrow}>
                  <input
                    id="receipt-credit"
                    className={`${modalStyles.formInput}${
                      hasClientCredit ? "" : ` ${styles.receiptCreditInputEmpty}`
                    }`}
                    readOnly
                    tabIndex={-1}
                    placeholder="0,00"
                    value={
                      hasClientCredit
                        ? formatArsExact(centsToPesos(creditCents))
                        : ""
                    }
                  />
                </div>
                {isAllocate ? null : (
                  <label
                    className={[
                      styles.receiptUseCredit,
                      useCredit ? styles.receiptUseCreditOn : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <input
                      className={styles.allocationCheckbox}
                      type="checkbox"
                      checked={useCredit}
                      disabled={isBusy || !canUseCredit}
                      onChange={() => {
                        if (!canUseCredit) {
                          return;
                        }
                        setUseCredit((current) => !current);
                      }}
                    />
                    <span className={styles.allocationCheckBox} aria-hidden />
                    <span>Utilizar saldo</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          <div
            className={
              isAllocate ? styles.receiptField : styles.receiptAmountRow
            }
          >
            <div className={styles.receiptField}>
              <label className={modalStyles.formLabel} htmlFor="receipt-amount">
                Importe cobrado
              </label>
              <div className={styles.receiptAmountInputRow}>
                <div className={styles.receiptAmountInputGrow}>
                  <input
                    id="receipt-amount"
                    className={modalStyles.formInput}
                    inputMode="decimal"
                    placeholder="0,00"
                    autoComplete="off"
                    spellCheck={false}
                    value={
                      isAllocate
                        ? formatArsExact(mode.receipt.remainingAmount)
                        : amountPesos
                    }
                    onChange={(event) =>
                      setAmountPesos(maskPesosInput(event.target.value))
                    }
                    disabled={isAllocate || isBusy}
                  />
                </div>
                {isAllocate ? null : (
                  <button
                    type="button"
                    className={styles.receiptFillAllButton}
                    onClick={fillAllOutstanding}
                    disabled={isBusy || outstandingTotalCents <= 0}
                    aria-label="Cargar el 100% del saldo impago y seleccionar todas las facturas"
                  >
                    100%
                  </button>
                )}
              </div>
            </div>
            {isAllocate ? null : (
              <div className={styles.receiptField}>
                <label className={modalStyles.formLabel} htmlFor="receipt-method">
                  Forma de pago
                </label>
                <CustomSelect
                  id="receipt-method"
                  value={paymentMethod}
                  onChange={(next) =>
                    setPaymentMethod(next as BillingReceiptPaymentMethod)
                  }
                  ariaLabel="Forma de pago del recibo"
                  disabled={isBusy}
                  options={RECEIPT_PAYMENT_METHOD_ORDER.map((method) => ({
                    value: method,
                    label: RECEIPT_PAYMENT_METHOD_LABELS[method],
                  }))}
                />
              </div>
            )}
          </div>

          <div className={styles.receiptField}>
            <label className={modalStyles.formLabel} htmlFor="receipt-notes">
              Observaciones (opcional)
            </label>
            <textarea
              id="receipt-notes"
              className={modalStyles.formTextarea}
              rows={3}
              maxLength={1000}
              placeholder="Notas internas del recibo…"
              value={notes}
              disabled={isBusy}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <p className={modalStyles.formLabel}>Facturas impagas</p>
          {rows.length === 0 ? (
            <p className={styles.proofHint}>
              Este cliente no tiene facturas con saldo. El recibo queda a
              cuenta.
            </p>
          ) : (
            <div className={styles.historyTableWrap}>
              <table className={styles.allocationTable}>
                <thead>
                  <tr>
                    <th scope="col"> </th>
                    <th scope="col">Factura</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Saldo</th>
                    <th scope="col">Aplica</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const invoice = invoiceById.get(row.invoiceId);
                    if (!invoice) {
                      return null;
                    }
                    return (
                      <tr
                        key={row.invoiceId}
                        className={[
                          styles.allocationRow,
                          row.selected ? styles.allocationRowSelected : "",
                          isBusy || !canSelectInvoices
                            ? styles.allocationRowBusy
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => {
                          if (isBusy || !canSelectInvoices) {
                            return;
                          }
                          toggleInvoiceSelected(row.invoiceId, !row.selected);
                        }}
                      >
                        <td className={styles.allocationCheckCell}>
                          <label
                            className={styles.allocationCheck}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <input
                              className={styles.allocationCheckbox}
                              type="checkbox"
                              checked={row.selected}
                              disabled={isBusy || !canSelectInvoices}
                              aria-label={`Imputar ${invoice.invoiceNumber}`}
                              onChange={(event) => {
                                toggleInvoiceSelected(
                                  row.invoiceId,
                                  event.target.checked,
                                );
                              }}
                            />
                            <span className={styles.allocationCheckBox} aria-hidden />
                          </label>
                        </td>
                        <td>
                          {invoice.invoiceType} {invoice.invoiceNumber}
                        </td>
                        <td>
                          {DATE_FORMATTER.format(new Date(invoice.issuedAt))}
                        </td>
                        <td>{formatArsExact(invoice.outstandingAmount)}</td>
                        <td>
                          <input
                            className={styles.allocationAmountInput}
                            inputMode="decimal"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="0,00"
                            disabled={!row.selected || isBusy}
                            value={
                              !row.selected
                                ? ""
                                : focusedApplyInvoiceId === row.invoiceId
                                  ? focusedApplyDraft
                                  : row.applyCents === 0
                                    ? ""
                                    : formatPesosInput(row.applyCents)
                            }
                            onClick={(event) => event.stopPropagation()}
                            onFocus={() => {
                              setFocusedApplyInvoiceId(row.invoiceId);
                              setFocusedApplyDraft(
                                row.applyCents === 0
                                  ? ""
                                  : formatPesosInput(row.applyCents),
                              );
                            }}
                            onBlur={() => {
                              setFocusedApplyInvoiceId(null);
                              setFocusedApplyDraft("");
                            }}
                            onChange={(event) => {
                              const nextValue = maskPesosInput(
                                event.target.value,
                              );
                              setFocusedApplyDraft(nextValue);
                              const parsed = parsePesosInput(nextValue);
                              setEdits((current) => ({
                                ...current,
                                [row.invoiceId]: {
                                  selected: true,
                                  applyLocked: true,
                                  applyCents: Math.min(
                                    parsed ?? 0,
                                    row.outstandingCents,
                                  ),
                                },
                              }));
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className={styles.allocationTotalRow}>
                    <td />
                    <td colSpan={2}>Total</td>
                    <td>
                      {formatArsExact(centsToPesos(outstandingTotalCents))}
                    </td>
                    <td />
                  </tr>
                  {usedCreditCents > 0 ? (
                    <>
                      <tr className={styles.allocationCreditRow}>
                        <td />
                        <td colSpan={2}>Saldo a favor</td>
                        <td>
                          −{formatArsExact(centsToPesos(usedCreditCents))}
                        </td>
                        <td />
                      </tr>
                      <tr className={styles.allocationDueRow}>
                        <td />
                        <td colSpan={2}>A cobrar</td>
                        <td>
                          {formatArsExact(centsToPesos(cashNeededCents))}
                        </td>
                        <td />
                      </tr>
                    </>
                  ) : null}
                </tfoot>
              </table>
            </div>
          )}

          <p className={styles.receiptSummary}>
            <span>Imputado {formatArsExact(centsToPesos(allocatedCents))}</span>
            {usedCreditCents > 0 ? (
              <span>
                Saldo a favor {formatArsExact(centsToPesos(creditAppliedCents))}
              </span>
            ) : null}
            <span>A cuenta {formatArsExact(centsToPesos(remainingToAccount))}</span>
          </p>

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
            {isBusy
              ? isAllocate
                ? "Imputando…"
                : "Emitiendo…"
              : isAllocate
                ? "Imputar"
                : "Emitir recibo"}
          </button>
        </div>
        </div>
      </div>
      )}
    </div>,
    document.body,
  );
}
