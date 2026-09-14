"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type {
  BillingInvoiceType,
  BillingPaymentMethod,
  BillingPaymentStatus,
} from "@/generated/prisma/client";
import type { InvoiceTotals } from "@/shared/utils/billing-invoice-totals";
import {
  INVOICE_CREATE_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/features/billing/types/billing-invoice.types";
import { paymentStatusForMethod } from "@/shared/utils/billing-invoice-rules";
import { isTypingTarget } from "@/features/billing/hooks/useBillingModalKeyboard";
import {
  INVOICE_DISCOUNT_ID,
  INVOICE_NOTES_ID,
  INVOICE_PAYMENT_METHOD_ID,
  INVOICE_SUBMIT_ID,
  focusInvoiceField,
  invoicePaymentMethodButtonId,
  isInvoiceFlowEnter,
  isInvoiceSubmitShortcut,
  resolveDiscountEnter,
  resolvePaymentMethodMove,
  buildPaymentMethodCells,
  type PickerArrowKey,
} from "@/features/billing/utils/invoice-keyboard-flow";
import { ArrowBigUp, Banknote, Percent, ReceiptText, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/billing/styles/NewInvoice.module.scss";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function PaymentStatusPill({ status }: { status: BillingPaymentStatus }) {
  switch (status) {
    case "PAGA":
      return (
        <span
          className={`${styles.paymentStatusPill} ${styles.paymentStatusPillPaid}`}
          role="status"
        >
          Estado: Paga
        </span>
      );
    case "IMPAGA":
      return (
        <span
          className={`${styles.paymentStatusPill} ${styles.paymentStatusPillUnpaid}`}
          role="status"
        >
          Estado: Impaga
        </span>
      );
    case "PARCIALMENTE_PAGA":
      return (
        <span
          className={`${styles.paymentStatusPill} ${styles.paymentStatusPillUnpaid}`}
          role="status"
        >
          Estado: Parcialmente pagada
        </span>
      );
    case "ANULADA":
      return (
        <span
          className={`${styles.paymentStatusPill} ${styles.paymentStatusPillUnpaid}`}
          role="status"
        >
          Estado: Anulada
        </span>
      );
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

type InvoiceSummarySectionProps = {
  totals: InvoiceTotals | null;
  invoiceType: BillingInvoiceType | null;
  ivaPercent: number;
  discountInput: string;
  appliedDiscount: number;
  paymentMethod: BillingPaymentMethod;
  allowOnAccount: boolean;
  notes: string;
  canSubmit: boolean;
  isSubmitting: boolean;
  blockingError: string | null;
  submitError: string | null;
  validationHints: string[];
  onDiscountInputChange: (value: string) => void;
  onApplyDiscount: () => void;
  onClearDiscount: () => void;
  onPaymentMethodChange: (method: BillingPaymentMethod) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
};

export function InvoiceSummarySection({
  totals,
  invoiceType,
  ivaPercent,
  discountInput,
  appliedDiscount,
  paymentMethod,
  allowOnAccount,
  notes,
  canSubmit,
  isSubmitting,
  blockingError,
  submitError,
  validationHints,
  onDiscountInputChange,
  onApplyDiscount,
  onClearDiscount,
  onPaymentMethodChange,
  onNotesChange,
  onSubmit,
}: InvoiceSummarySectionProps) {
  const parsedDiscount = Number(discountInput.trim().replace(",", "."));
  const isDiscountInputValid =
    Number.isFinite(parsedDiscount) &&
    parsedDiscount > 0 &&
    parsedDiscount <= 99.99;
  const canApplyDiscount =
    isDiscountInputValid && parsedDiscount !== appliedDiscount;

  const showVisualRounding =
    totals !== null && totals.totalVisualRoundedCents !== totals.totalCents;
  const paymentStatus = paymentStatusForMethod(paymentMethod);
  const netSubtotalCents = totals
    ? totals.subtotalCents - totals.discountCents
    : 0;
  const preferredPaymentColumnRef = useRef(0);

  function isPaymentArrowKey(key: string): key is PickerArrowKey {
    return (
      key === "ArrowDown" ||
      key === "ArrowUp" ||
      key === "ArrowLeft" ||
      key === "ArrowRight"
    );
  }

  function handlePaymentMethodKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    method: BillingPaymentMethod,
    isOnAccountLocked: boolean,
  ) {
    if (isPaymentArrowKey(event.key)) {
      event.preventDefault();
      const next = resolvePaymentMethodMove(
        INVOICE_CREATE_PAYMENT_METHODS,
        method,
        event.key,
        allowOnAccount,
        preferredPaymentColumnRef.current,
      );
      preferredPaymentColumnRef.current = next.preferredColumn;
      onPaymentMethodChange(next.method);
      focusInvoiceField(invoicePaymentMethodButtonId(next.method));
      return;
    }

    if (!isInvoiceFlowEnter(event)) {
      return;
    }

    event.preventDefault();
    if (!isOnAccountLocked) {
      onPaymentMethodChange(method);
    }
    focusInvoiceField(INVOICE_NOTES_ID);
  }

  function handleNotesKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!isInvoiceFlowEnter(event)) {
      return;
    }

    event.preventDefault();
    focusInvoiceField(INVOICE_DISCOUNT_ID);
  }

  function focusSubmitButton() {
    focusInvoiceField(INVOICE_SUBMIT_ID);
  }

  function handleDiscountKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isInvoiceFlowEnter(event)) {
      return;
    }

    event.preventDefault();
    const result = resolveDiscountEnter(discountInput, canApplyDiscount);
    switch (result) {
      case "stay":
        return;
      case "apply":
        onApplyDiscount();
        focusSubmitButton();
        return;
      case "skip":
        focusSubmitButton();
        return;
      default: {
        const exhaustive: never = result;
        return exhaustive;
      }
    }
  }

  function handleDiscountClearKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    if (!isInvoiceFlowEnter(event)) {
      return;
    }

    event.preventDefault();
    focusSubmitButton();
  }

  useEffect(() => {
    function handleSubmitShortcut(event: globalThis.KeyboardEvent) {
      if (!isInvoiceSubmitShortcut(event) || isTypingTarget(event.target)) {
        return;
      }

      if (!canSubmit || isSubmitting) {
        return;
      }

      event.preventDefault();
      onSubmit();
    }

    document.addEventListener("keydown", handleSubmitShortcut);
    return () => {
      document.removeEventListener("keydown", handleSubmitShortcut);
    };
  }, [canSubmit, isSubmitting, onSubmit]);

  return (
    <div className={styles.summaryColumn} aria-label="Resumen de la factura">
      <section className={styles.sectionCard}>
        <div className={styles.paymentCardHeader}>
          <h2 className={styles.sectionCardTitle}>
            <Banknote className={styles.sectionCardIcon} strokeWidth={ICON_STROKE} aria-hidden />
            Método de pago
          </h2>
          <PaymentStatusPill status={paymentStatus} />
        </div>

        <div
          className={styles.paymentMethodsGroup}
          role="radiogroup"
          id={INVOICE_PAYMENT_METHOD_ID}
          aria-label="Método de pago"
        >
          {INVOICE_CREATE_PAYMENT_METHODS.map((method) => {
            const isActive = paymentMethod === method;
            const isFullWidth = method === "CUENTA_CORRIENTE";
            const isOnAccountLocked =
              method === "CUENTA_CORRIENTE" && !allowOnAccount;
            return (
              <button
                key={method}
                id={invoicePaymentMethodButtonId(method)}
                type="button"
                role="radio"
                aria-checked={isActive}
                tabIndex={isActive ? 0 : -1}
                className={`${styles.paymentMethodButton} ${
                  isFullWidth ? styles.paymentMethodButtonWide : ""
                } ${isActive ? styles.paymentMethodButtonActive : ""}`}
                onClick={() => {
                  if (isOnAccountLocked) {
                    return;
                  }
                  const cell = buildPaymentMethodCells(
                    INVOICE_CREATE_PAYMENT_METHODS,
                    allowOnAccount,
                  ).find((candidate) => candidate.method === method);
                  if (cell && cell.span === 1) {
                    preferredPaymentColumnRef.current = cell.col;
                  }
                  onPaymentMethodChange(method);
                }}
                onKeyDown={(event) =>
                  handlePaymentMethodKeyDown(event, method, isOnAccountLocked)
                }
                disabled={isSubmitting || isOnAccountLocked}
                title={
                  isOnAccountLocked
                    ? "No disponible para clientes sin identificación"
                    : undefined
                }
              >
                {PAYMENT_METHOD_LABELS[method]}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.formField}>
          <label className={styles.formLabel} htmlFor={INVOICE_NOTES_ID}>
            Observaciones internas (opcional)
          </label>
          <textarea
            id={INVOICE_NOTES_ID}
            className={styles.formTextarea}
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            onKeyDown={handleNotesKeyDown}
            placeholder="Notas internas de la factura…"
            maxLength={1000}
            rows={2}
            spellCheck={false}
            disabled={isSubmitting}
          />
        </div>
      </section>

      <section className={styles.sectionCard}>
        <h2 className={styles.sectionCardTitle}>
          <Percent className={styles.sectionCardIcon} strokeWidth={ICON_STROKE} aria-hidden />
          Descuento
        </h2>

        {appliedDiscount > 0 ? (
          <div className={styles.discountApplied}>
            <span>
              Descuento del {appliedDiscount.toLocaleString("es-AR")}% aplicado
              sobre el subtotal.
            </span>
            <button
              type="button"
              id={INVOICE_DISCOUNT_ID}
              className={styles.discountClearButton}
              onClick={onClearDiscount}
              onKeyDown={handleDiscountClearKeyDown}
              disabled={isSubmitting}
            >
              Quitar
            </button>
          </div>
        ) : (
          <div className={styles.discountRow}>
            <div className={styles.discountInputWrap}>
              <input
                id={INVOICE_DISCOUNT_ID}
                type="text"
                inputMode="decimal"
                className={styles.formInput}
                value={discountInput}
                onChange={(event) => onDiscountInputChange(event.target.value)}
                onKeyDown={handleDiscountKeyDown}
                placeholder="0"
                aria-label="Porcentaje de descuento"
                spellCheck={false}
                disabled={isSubmitting}
              />
              <span className={styles.discountSymbol}>%</span>
            </div>
            <button
              type="button"
              className={styles.discountApplyButton}
              onClick={onApplyDiscount}
              disabled={!canApplyDiscount || isSubmitting}
            >
              Aplicar
            </button>
          </div>
        )}
      </section>

      <section className={styles.sectionCard}>
        <h2 className={styles.sectionCardTitle}>
          <ReceiptText className={styles.sectionCardIcon} strokeWidth={ICON_STROKE} aria-hidden />
          Resumen
        </h2>

        {totals ? (
          <dl className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <dt>
                {invoiceType === "A" ? "Subtotal neto s/IVA" : "Subtotal"}
              </dt>
              <dd>{formatCents(totals.subtotalCents)}</dd>
            </div>

            {totals.discountCents > 0 ? (
              <>
                <div className={styles.summaryRow}>
                  <dt>Descuento {appliedDiscount.toLocaleString("es-AR")}%</dt>
                  <dd>-{formatCents(totals.discountCents)}</dd>
                </div>
                <div className={styles.summaryRow}>
                  <dt>Subtotal neto</dt>
                  <dd>{formatCents(netSubtotalCents)}</dd>
                </div>
              </>
            ) : null}

            {invoiceType === "A" ? (
              <div className={styles.summaryRow}>
                <dt>IVA {ivaPercent.toLocaleString("es-AR")}%</dt>
                <dd>{formatCents(totals.ivaCents)}</dd>
              </div>
            ) : null}

            <div className={`${styles.summaryRow} ${styles.summaryRowTotal}`}>
              <dt>Total</dt>
              <dd>{formatCents(totals.totalVisualRoundedCents)}</dd>
            </div>

            {showVisualRounding ? (
              <p className={styles.summaryRoundingHint}>
                Valor fiscal exacto: {formatCents(totals.totalCents)}. El total
                se muestra con redondeo visual.
              </p>
            ) : null}
          </dl>
        ) : (
          <p className={styles.summaryEmpty}>
            Seleccione un cliente y cargue al menos un rubro para ver el
            resumen.
          </p>
        )}
      </section>

      {blockingError ? (
        <p className={styles.blockingError} role="alert">
          {blockingError}
        </p>
      ) : null}

      {submitError ? (
        <p className={styles.blockingError} role="alert">
          {submitError}
        </p>
      ) : null}

      {validationHints.length > 0 ? (
        <div className={styles.submitHintPills}>
          {validationHints.map((hint) => (
            <p key={hint} className={styles.submitHintPill} role="status">
              {hint}
            </p>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        id={INVOICE_SUBMIT_ID}
        className={styles.submitButton}
        onClick={onSubmit}
        disabled={!canSubmit || isSubmitting}
        aria-keyshortcuts="Shift+F"
      >
        {isSubmitting ? "Creando factura…" : "Crear factura en modo prueba"}
        {isSubmitting ? null : (
          <span className={styles.submitShortcut} aria-hidden>
            <kbd className={styles.shortcutKbd}>
              <ArrowBigUp
                className={styles.submitShortcutIcon}
                strokeWidth={ICON_STROKE}
              />
            </kbd>
            <span className={styles.submitShortcutPlus}>+</span>
            <kbd className={styles.shortcutKbd}>F</kbd>
          </span>
        )}
      </button>
    </div>
  );
}
