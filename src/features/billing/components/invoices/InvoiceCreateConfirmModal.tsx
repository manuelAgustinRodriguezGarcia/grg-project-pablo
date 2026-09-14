"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type {
  BillingInvoiceType,
  BillingPaymentMethod,
} from "@/generated/prisma/client";
import type { InvoiceTotals } from "@/shared/utils/billing-invoice-totals";
import {
  INVOICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/features/billing/types/billing-invoice.types";
import { paymentStatusForMethod } from "@/shared/utils/billing-invoice-rules";
import { isTypingTarget } from "@/features/billing/hooks/useBillingModalKeyboard";
import type { InvoiceItemRow } from "./InvoiceItemsSection";
import { isCompleteRow } from "./InvoiceItemsSection";
import confirmStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import styles from "@/features/billing/styles/NewInvoice.module.scss";

function formatCents(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

type InvoiceCreateConfirmModalProps = {
  clientName: string;
  invoiceType: BillingInvoiceType;
  rows: InvoiceItemRow[];
  totals: InvoiceTotals;
  ivaPercent: number;
  appliedDiscount: number;
  paymentMethod: BillingPaymentMethod;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function InvoiceCreateConfirmModal({
  clientName,
  invoiceType,
  rows,
  totals,
  ivaPercent,
  appliedDiscount,
  paymentMethod,
  isSubmitting,
  onConfirm,
  onCancel,
}: InvoiceCreateConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const completeRows = rows.filter(isCompleteRow);
  const netSubtotalCents = totals.subtotalCents - totals.discountCents;
  const paymentStatus = paymentStatusForMethod(paymentMethod);

  useEffect(() => {
    confirmButtonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isSubmitting) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        onConfirm();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isSubmitting, onCancel, onConfirm]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={confirmStyles.confirmOverlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onCancel();
        }
      }}
    >
      <div
        className={`${confirmStyles.confirmCard} ${styles.createConfirmCard}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-create-confirm-title"
      >
        <h2
          id="invoice-create-confirm-title"
          className={styles.createConfirmTitle}
        >
          Confirmar factura
        </h2>

        <dl className={styles.createConfirmMeta}>
          <div>
            <dt>Cliente</dt>
            <dd>{clientName}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{INVOICE_TYPE_LABELS[invoiceType]}</dd>
          </div>
          <div>
            <dt>Ítems</dt>
            <dd>{completeRows.length}</dd>
          </div>
          <div>
            <dt>Método de pago</dt>
            <dd>{PAYMENT_METHOD_LABELS[paymentMethod]}</dd>
          </div>
          <div>
            <dt>Estado de pago</dt>
            <dd>{PAYMENT_STATUS_LABELS[paymentStatus]}</dd>
          </div>
        </dl>

        <ul className={styles.createConfirmItems}>
          {completeRows.map((row) => (
            <li key={row.key}>
              <span className={styles.createConfirmItemName}>
                {row.rubroCode ? `${row.rubroCode} · ` : ""}
                {row.description || row.rubroName}
              </span>
              <span className={styles.createConfirmItemQty}>
                ×{row.quantity}
              </span>
            </li>
          ))}
        </ul>

        <dl className={styles.createConfirmTotals}>
          <div>
            <dt>
              {invoiceType === "A" ? "Subtotal neto s/IVA" : "Subtotal"}
            </dt>
            <dd>{formatCents(totals.subtotalCents)}</dd>
          </div>
          {totals.discountCents > 0 ? (
            <>
              <div>
                <dt>
                  Descuento {appliedDiscount.toLocaleString("es-AR")}%
                </dt>
                <dd>-{formatCents(totals.discountCents)}</dd>
              </div>
              <div>
                <dt>Subtotal neto</dt>
                <dd>{formatCents(netSubtotalCents)}</dd>
              </div>
            </>
          ) : null}
          {invoiceType === "A" ? (
            <div>
              <dt>IVA {ivaPercent.toLocaleString("es-AR")}%</dt>
              <dd>{formatCents(totals.ivaCents)}</dd>
            </div>
          ) : null}
          <div className={styles.createConfirmTotalRow}>
            <dt>Total</dt>
            <dd>{formatCents(totals.totalVisualRoundedCents)}</dd>
          </div>
        </dl>

        <div className={confirmStyles.confirmActions}>
          <button
            type="button"
            className={confirmStyles.confirmCancelButton}
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancelar
            <kbd className={styles.shortcutKbd}>Esc</kbd>
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={confirmStyles.confirmPrimaryButton}
            onClick={onConfirm}
            disabled={isSubmitting}
            aria-keyshortcuts="C"
          >
            {isSubmitting ? "Creando…" : "Confirmar creación"}
            {isSubmitting ? null : (
              <kbd className={styles.shortcutKbd}>C</kbd>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
