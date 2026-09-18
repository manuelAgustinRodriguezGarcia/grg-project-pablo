"use client";

import { useState } from "react";
import { InvoiceShareMenu } from "@/features/billing/components/invoices/InvoiceShareMenu";
import { useBillingDocumentActivity } from "@/features/billing/hooks/useBillingDocumentActivity";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import { invoiceCanIssueReceipt } from "@/features/billing/utils/invoice-list";
import {
  downloadInvoicePdf,
  invoicePdfFilename,
  printInvoicePdf,
} from "@/features/billing/utils/invoice-pdf-client";
import { Download, Eye, ICON_STROKE, Printer, Receipt } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type InvoiceDocumentActionsProps = {
  invoice: BillingInvoiceListItem;
  onDetails?: (invoice: BillingInvoiceListItem) => void;
  onIssueReceipt?: (invoice: BillingInvoiceListItem) => void;
  onPrinted?: () => void;
  variant?: "icon" | "card" | "footer";
  shareOpen?: boolean;
  onShareOpenChange?: (open: boolean) => void;
  showPrintShortcut?: boolean;
  cardActionOrder?: "default" | "success";
};

export function InvoiceDocumentActions({
  invoice,
  onDetails,
  onIssueReceipt,
  onPrinted,
  variant = "icon",
  shareOpen,
  onShareOpenChange,
  showPrintShortcut = false,
  cardActionOrder = "default",
}: InvoiceDocumentActionsProps) {
  const [busyAction, setBusyAction] = useState<"download" | "print" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const markActivity = useBillingDocumentActivity();
  const isBusy = busyAction !== null;
  const showIssueReceipt =
    Boolean(onIssueReceipt) && invoiceCanIssueReceipt(invoice);

  function handleShared() {
    void markActivity("INVOICE", invoice.id, "shared");
  }

  async function run(
    action: "download" | "print",
    task: () => Promise<void>,
  ): Promise<void> {
    setBusyAction(action);
    setError(null);
    try {
      await task();
      await markActivity(
        "INVOICE",
        invoice.id,
        action === "print" ? "printed" : "downloaded",
      );
      if (action === "print") {
        onPrinted?.();
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la acción.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  switch (variant) {
    case "card": {
      const successButtonClass =
        cardActionOrder === "success" ? styles.cardActionButtonSuccess : "";
      const downloadButton = (
        <button
          type="button"
          className={`${styles.cardActionButton} ${successButtonClass}`.trim()}
          onClick={() =>
            run("download", () =>
              downloadInvoicePdf(
                invoice.id,
                invoicePdfFilename(invoice.invoiceNumber),
              ),
            )
          }
          disabled={isBusy}
        >
          <Download strokeWidth={ICON_STROKE} aria-hidden />
          {busyAction === "download" ? "Descargando…" : "Descargar"}
        </button>
      );
      const printButton = (
        <button
          type="button"
          className={`${styles.cardActionButton} ${successButtonClass}`.trim()}
          onClick={() => run("print", () => printInvoicePdf(invoice.id))}
          disabled={isBusy}
          aria-keyshortcuts={showPrintShortcut ? "I" : undefined}
        >
          <Printer strokeWidth={ICON_STROKE} aria-hidden />
          {busyAction === "print" ? "Abriendo…" : "Imprimir"}
          {showPrintShortcut && busyAction !== "print" ? (
            <kbd className={styles.shortcutKbd}>I</kbd>
          ) : null}
        </button>
      );
      const shareMenu = (
        <InvoiceShareMenu
          invoice={invoice}
          variant="button"
          disabled={isBusy}
          onShared={handleShared}
          open={shareOpen}
          onOpenChange={onShareOpenChange}
          triggerClassName={successButtonClass || undefined}
        />
      );

      let orderedActions;
      switch (cardActionOrder) {
        case "success":
          orderedActions = (
            <>
              {downloadButton}
              {shareMenu}
            </>
          );
          break;
        case "default":
          orderedActions = (
            <>
              {downloadButton}
              {printButton}
              {shareMenu}
              {showIssueReceipt ? (
                <button
                  type="button"
                  className={styles.cardActionButton}
                  onClick={() => onIssueReceipt?.(invoice)}
                  disabled={isBusy}
                >
                  <Receipt strokeWidth={ICON_STROKE} aria-hidden />
                  Emitir recibo
                </button>
              ) : null}
              {onDetails ? (
                <button
                  type="button"
                  className={styles.cardActionButton}
                  onClick={() => onDetails(invoice)}
                  disabled={isBusy}
                >
                  <Eye strokeWidth={ICON_STROKE} aria-hidden />
                  Detalle
                </button>
              ) : null}
            </>
          );
          break;
        default: {
          const exhaustive: never = cardActionOrder;
          return exhaustive;
        }
      }

      return (
        <div
          className={`${styles.invoiceActionsStack}${
            cardActionOrder === "success"
              ? ` ${styles.invoiceActionsStackNowrap}`
              : ""
          }`}
        >
          <div className={styles.clientCardActions}>{orderedActions}</div>
          {error ? (
            <p className={styles.inlineError} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      );
    }
    case "footer":
      return (
        <div className={styles.invoiceFooterActions}>
          <button
            type="button"
            className={styles.invoiceFooterAction}
            onClick={() =>
              run("download", () =>
                downloadInvoicePdf(
                  invoice.id,
                  invoicePdfFilename(invoice.invoiceNumber),
                ),
              )
            }
            aria-label={`Descargar factura ${invoice.invoiceNumber}`}
            disabled={isBusy}
          >
            <Download strokeWidth={ICON_STROKE} aria-hidden />
            <span className={styles.invoiceActionLabel}>
              {busyAction === "download" ? "Descargando…" : "Descargar"}
            </span>
          </button>
          <button
            type="button"
            className={styles.invoiceFooterAction}
            onClick={() => run("print", () => printInvoicePdf(invoice.id))}
            aria-label={`Imprimir factura ${invoice.invoiceNumber}`}
            disabled={isBusy}
          >
            <Printer strokeWidth={ICON_STROKE} aria-hidden />
            <span className={styles.invoiceActionLabel}>
              {busyAction === "print" ? "Abriendo…" : "Imprimir"}
            </span>
          </button>
          <InvoiceShareMenu
            invoice={invoice}
            variant="footer"
            menuPlacement="up"
            disabled={isBusy}
            onShared={handleShared}
          />
          {error ? (
            <p className={styles.inlineError} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      );
    case "icon":
      return (
        <div className={styles.invoiceActionsStack}>
          <div className={styles.actionsGroup}>
            <span className={styles.rowActionWrap}>
              <button
                type="button"
                className={`${styles.editActionButton} ${styles.iconActionButton}`}
                onClick={() =>
                  run("download", () =>
                    downloadInvoicePdf(
                      invoice.id,
                      invoicePdfFilename(invoice.invoiceNumber),
                    ),
                  )
                }
                aria-label={`Descargar factura ${invoice.invoiceNumber}`}
                disabled={isBusy}
              >
                <Download strokeWidth={ICON_STROKE} aria-hidden />
              </button>
              <span className={styles.rowActionTooltip} role="tooltip">
                Descargar
              </span>
            </span>
            <span className={styles.rowActionWrap}>
              <button
                type="button"
                className={`${styles.editActionButton} ${styles.iconActionButton}`}
                onClick={() => run("print", () => printInvoicePdf(invoice.id))}
                aria-label={`Imprimir factura ${invoice.invoiceNumber}`}
                disabled={isBusy}
              >
                <Printer strokeWidth={ICON_STROKE} aria-hidden />
              </button>
              <span className={styles.rowActionTooltip} role="tooltip">
                Imprimir
              </span>
            </span>
            <InvoiceShareMenu
              invoice={invoice}
              disabled={isBusy}
              onShared={handleShared}
            />
            {onDetails ? (
              <span className={styles.rowActionWrap}>
                <button
                  type="button"
                  className={`${styles.editActionButton} ${styles.iconActionButton}`}
                  onClick={() => onDetails(invoice)}
                  aria-label={`Ver detalle de ${invoice.invoiceNumber}`}
                  disabled={isBusy}
                >
                  <Eye strokeWidth={ICON_STROKE} aria-hidden />
                </button>
                <span className={styles.rowActionTooltip} role="tooltip">
                  Detalle
                </span>
              </span>
            ) : null}
          </div>
          {error ? (
            <p className={styles.inlineError} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      );
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
}
