"use client";

import { useState } from "react";
import type { BillingReceiptListItem } from "@/features/billing/types/billing-receipt.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import { useBillingDocumentActivity } from "@/features/billing/hooks/useBillingDocumentActivity";
import {
  downloadReceiptPdf,
  receiptPdfFilename,
} from "@/features/billing/utils/invoice-pdf-client";
import { Download, ICON_STROKE, Receipt } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

export type ReceiptPanelInvoice = {
  id: string;
  label: string;
  amount: number;
};

export type ReceiptPanelItem = {
  id: string;
  receiptNumber: string;
  issuedAt: Date;
  amount: number;
  allocatedToInvoice: number;
  createdByName: string;
  remainingAmount?: number;
  invoices?: ReceiptPanelInvoice[];
};

type InvoiceReceiptsPanelProps = {
  receipts: ReceiptPanelItem[];
  emptyHint: string;
  onIssueReceipt?: () => void;
  issueReceiptAriaLabel?: string;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function receiptToPanelItem(
  receipt: BillingReceiptListItem,
): ReceiptPanelItem {
  return {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    issuedAt: receipt.issuedAt,
    amount: receipt.amount,
    allocatedToInvoice: receipt.allocatedAmount,
    createdByName: receipt.createdByName,
    remainingAmount: receipt.remainingAmount,
    invoices: receipt.allocations.map((allocation) => ({
      id: allocation.invoiceId,
      label: `${allocation.invoiceType} ${allocation.invoiceNumber}`,
      amount: allocation.amount,
    })),
  };
}

export function InvoiceReceiptsPanel({
  receipts,
  emptyHint,
  onIssueReceipt,
  issueReceiptAriaLabel,
}: InvoiceReceiptsPanelProps) {
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const markActivity = useBillingDocumentActivity();
  const canIssueReceipt = Boolean(onIssueReceipt);

  return (
    <section className={styles.proofPanel} aria-label="Recibos de pago">
      <div className={styles.historySectionHeader}>
        <h3 className={styles.historySectionTitle}>Recibos</h3>
        {canIssueReceipt ? (
          <button
            type="button"
            className={`${styles.cardActionButton} ${styles.issueReceiptButton}`}
            onClick={() => onIssueReceipt?.()}
            aria-label={issueReceiptAriaLabel ?? "Emitir recibo"}
          >
            <Receipt strokeWidth={ICON_STROKE} aria-hidden />
            Emitir recibo
          </button>
        ) : null}
      </div>

      {receipts.length === 0 ? (
        <p className={styles.proofHint}>{emptyHint}</p>
      ) : (
        <ul className={styles.receiptList}>
          {receipts.map((receipt) => (
            <li key={receipt.id} className={styles.receiptListItem}>
              <div className={styles.receiptListItemBody}>
                <div className={styles.receiptListItemHeader}>
                  <p className={styles.proofFileName}>{receipt.receiptNumber}</p>
                  <p className={styles.receiptListItemDate}>
                    {DATE_FORMATTER.format(new Date(receipt.issuedAt))}
                  </p>
                </div>
                <p className={styles.invoiceMeta}>
                  imputado {formatArsExact(receipt.allocatedToInvoice)}
                  {receipt.allocatedToInvoice !== receipt.amount
                    ? ` de ${formatArsExact(receipt.amount)}`
                    : ""}{" "}
                  · {receipt.createdByName}
                </p>
                {receipt.invoices && receipt.invoices.length > 0 ? (
                  <p className={styles.invoiceMeta}>
                    {receipt.invoices.length} de facturas canceladas
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className={`${styles.cardActionButton} ${styles.receiptDownloadButton}`}
                aria-label={`Descargar recibo ${receipt.receiptNumber}`}
                onClick={() => {
                  setDownloadError(null);
                  void downloadReceiptPdf(
                    receipt.id,
                    receiptPdfFilename(receipt.receiptNumber),
                  )
                    .then(() => markActivity("RECEIPT", receipt.id, "downloaded"))
                    .catch((caught: unknown) => {
                    setDownloadError(
                      caught instanceof Error
                        ? caught.message
                        : "No se pudo descargar el recibo.",
                    );
                  });
                }}
              >
                <Download strokeWidth={ICON_STROKE} aria-hidden />
                Descargar Recibo
              </button>
            </li>
          ))}
        </ul>
      )}

      {downloadError ? (
        <p className={styles.inlineError} role="alert">
          {downloadError}
        </p>
      ) : null}
    </section>
  );
}
