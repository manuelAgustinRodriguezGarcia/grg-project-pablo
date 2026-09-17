"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  InvoiceReceiptsPanel,
  receiptToPanelItem,
} from "@/features/billing/components/invoices/InvoiceReceiptsPanel";
import { IVA_CONDITION_LABELS } from "@/features/billing/types/billing-client.types";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import {
  RECEIPT_ALLOCATION_STATUS_LABELS,
  RECEIPT_PAYMENT_METHOD_LABELS,
  type BillingReceiptListItem,
} from "@/features/billing/types/billing-receipt.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import { useBillingDocumentActivity } from "@/features/billing/hooks/useBillingDocumentActivity";
import { useEscapeToClose } from "@/features/billing/hooks/useBillingModalKeyboard";
import { formatInvoiceIdentification } from "@/features/billing/utils/invoice-list";
import type { ReceiptAllocationStatus } from "@/features/billing/utils/receipt-allocation";
import {
  downloadReceiptPdf,
  printReceiptPdf,
  receiptPdfFilename,
} from "@/features/billing/utils/invoice-pdf-client";
import { Check, Download, ICON_STROKE, Printer, X } from "@/shared/icons";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type ReceiptDetailModalProps = {
  receipt: BillingReceiptListItem;
  invoices: BillingInvoiceListItem[];
  onClose: () => void;
  onOpenInvoice?: (invoiceId: string) => void;
};

type AllocatedInvoiceView = {
  invoice: BillingInvoiceListItem;
  allocatedAmount: number;
};

function allocatedInvoiceViews(
  receipt: BillingReceiptListItem,
  invoices: BillingInvoiceListItem[],
): AllocatedInvoiceView[] {
  const invoicesById = new Map(
    invoices.map((invoice) => [invoice.id, invoice]),
  );

  return receipt.allocations.flatMap((allocation) => {
    const invoice = invoicesById.get(allocation.invoiceId);
    if (!invoice) {
      return [];
    }

    return [{ invoice, allocatedAmount: allocation.amount }];
  });
}

function InvoiceItemsTable({ invoice }: { invoice: BillingInvoiceListItem }) {
  return (
    <div className={styles.historyTableWrap}>
      <table className={styles.historyTable}>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Detalle</th>
            <th scope="col">Cant.</th>
            <th scope="col">P. unitario</th>
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id}>
              <td>{item.rubroCode}</td>
              <td>{item.description}</td>
              <td>{item.quantity}</td>
              <td className={styles.amountCell}>
                {formatArsExact(item.unitPrice)}
              </td>
              <td className={styles.amountCell}>
                {formatArsExact(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CLOSE_ANIMATION_MS = 220;

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function AllocationStatusPill({ status }: { status: ReceiptAllocationStatus }) {
  switch (status) {
    case "IMPUTADO":
      return (
        <span
          className={`${styles.invoicePaymentPill} ${styles.invoicePaymentPillPaid}`}
          aria-label={`Imputación: ${RECEIPT_ALLOCATION_STATUS_LABELS.IMPUTADO}`}
        >
          <Check strokeWidth={ICON_STROKE} aria-hidden />
          {RECEIPT_ALLOCATION_STATUS_LABELS.IMPUTADO}
        </span>
      );
    case "PARCIAL":
      return (
        <span
          className={`${styles.invoicePaymentPill} ${styles.invoicePaymentPillUnpaid}`}
          aria-label={`Imputación: ${RECEIPT_ALLOCATION_STATUS_LABELS.PARCIAL}`}
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
          {RECEIPT_ALLOCATION_STATUS_LABELS.PARCIAL}
        </span>
      );
    case "A_CUENTA":
      return (
        <span
          className={`${styles.invoicePaymentPill} ${styles.invoiceFiscalPill} ${styles.invoiceFiscalPillPlain}`}
          aria-label={`Imputación: ${RECEIPT_ALLOCATION_STATUS_LABELS.A_CUENTA}`}
        >
          {RECEIPT_ALLOCATION_STATUS_LABELS.A_CUENTA}
        </span>
      );
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function ReceiptDetailModal({
  receipt,
  invoices,
  onClose,
  onOpenInvoice,
}: ReceiptDetailModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [busyAction, setBusyAction] = useState<"download" | "print" | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const isBusy = busyAction !== null;
  const markActivity = useBillingDocumentActivity();
  const allocatedInvoices = allocatedInvoiceViews(receipt, invoices);
  const primaryInvoice = allocatedInvoices[0]?.invoice ?? null;

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEscapeToClose(onClose, !isBusy && !isClosing);

  if (typeof document === "undefined") {
    return null;
  }

  function requestClose(afterClose?: () => void) {
    if (isClosing) {
      return;
    }

    if (prefersReducedMotion()) {
      onClose();
      afterClose?.();
      return;
    }

    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
      afterClose?.();
    }, CLOSE_ANIMATION_MS);
  }

  async function run(
    action: "download" | "print",
    task: () => Promise<void>,
  ): Promise<void> {
    setBusyAction(action);
    setActionError(null);
    try {
      await task();
      await markActivity(
        "RECEIPT",
        receipt.id,
        action === "print" ? "printed" : "downloaded",
      );
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la acción.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  return createPortal(
    <div
      className={`${modalStyles.modalOverlay} ${styles.invoiceDetailOverlay}${
        isClosing ? ` ${styles.invoiceDetailOverlayClosing}` : ""
      }`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        className={`${modalStyles.modalCard} ${styles.invoiceDetailCard}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-detail-title"
      >
        <div className={styles.invoiceDetailHeader}>
          <div>
            <div className={styles.invoiceDetailTitleRow}>
              <h2 id="receipt-detail-title" className={styles.invoiceDetailTitle}>
                Recibo {receipt.receiptNumber}
              </h2>
              <AllocationStatusPill status={receipt.allocationStatus} />
            </div>
            <p className={styles.invoiceDetailSubtitle}>
              {DATE_FORMATTER.format(new Date(receipt.issuedAt))} ·{" "}
              {receipt.clientName}
            </p>
          </div>
          <button
            type="button"
            className={styles.invoiceDetailClose}
            onClick={() => requestClose()}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>

        <div className={styles.modalSheet}>
        <div className={styles.invoiceDetailBody}>
          <div className={styles.invoiceDetailLayout}>
            <div className={styles.invoiceDetailMain}>
              <dl className={styles.detailsGrid}>
                {primaryInvoice ? (
                  <>
                    <div className={styles.detailsItem}>
                      <dt className={styles.detailsLabel}>Identificación</dt>
                      <dd className={styles.detailsValue}>
                        {formatInvoiceIdentification(
                          primaryInvoice.clientIdentificationType,
                          primaryInvoice.clientIdentificationNumber,
                        ) ?? "Sin documento"}
                      </dd>
                    </div>
                    <div className={styles.detailsItem}>
                      <dt className={styles.detailsLabel}>Condición IVA</dt>
                      <dd className={styles.detailsValue}>
                        {IVA_CONDITION_LABELS[primaryInvoice.clientIvaCondition]}
                      </dd>
                    </div>
                  </>
                ) : (
                  <div className={styles.detailsItem}>
                    <dt className={styles.detailsLabel}>Cliente</dt>
                    <dd className={styles.detailsValue}>{receipt.clientName}</dd>
                  </div>
                )}
                <div className={styles.detailsItem}>
                  <dt className={styles.detailsLabel}>Forma de pago</dt>
                  <dd className={styles.detailsValue}>
                    {RECEIPT_PAYMENT_METHOD_LABELS[receipt.paymentMethod]}
                  </dd>
                  {receipt.remainingAmount > 0 ? (
                    <dd className={styles.detailsValueSecondary}>
                      A cuenta {formatArsExact(receipt.remainingAmount)}
                    </dd>
                  ) : null}
                </div>
                {receipt.notes ? (
                  <div className={styles.detailsItemWide}>
                    <dt className={styles.detailsLabel}>Observaciones</dt>
                    <dd className={styles.detailsValue}>{receipt.notes}</dd>
                  </div>
                ) : null}
              </dl>

              {allocatedInvoices.length === 0 ? (
                <p className={styles.proofHint}>
                  Este recibo quedó a cuenta. No hay facturas imputadas.
                </p>
              ) : (
                <section
                  className={styles.invoiceDetailItems}
                  aria-label="Facturas canceladas"
                >
                  <h3 className={styles.historySectionTitle}>
                    Facturas canceladas
                  </h3>
                  <div className={styles.receiptInvoiceBlocks}>
                  {allocatedInvoices.map(({ invoice, allocatedAmount }, index) => {
                    const invoiceLabel = `${index + 1}. Factura ${invoice.invoiceType} ${invoice.invoiceNumber}`;
                    const allocatedLabel =
                      allocatedAmount !== invoice.totalVisualRounded
                        ? `Imputado ${formatArsExact(allocatedAmount)} de ${formatArsExact(invoice.totalVisualRounded)}`
                        : `Imputado ${formatArsExact(allocatedAmount)}`;

                    return (
                      <section
                        key={invoice.id}
                        className={styles.receiptInvoiceBlock}
                        aria-label={invoiceLabel}
                      >
                        <div className={styles.receiptInvoiceBlockHeader}>
                          {onOpenInvoice ? (
                            <button
                              type="button"
                              className={styles.receiptInvoiceBlockTitleButton}
                              onClick={() =>
                                requestClose(() => onOpenInvoice(invoice.id))
                              }
                            >
                              {invoiceLabel}
                            </button>
                          ) : (
                            <h3 className={styles.receiptInvoiceBlockTitle}>
                              {invoiceLabel}
                            </h3>
                          )}
                          <p className={styles.receiptInvoiceBlockMeta}>
                            {allocatedLabel}
                          </p>
                        </div>
                        <InvoiceItemsTable invoice={invoice} />
                      </section>
                    );
                  })}
                </div>
                </section>
              )}
            </div>

            <div className={styles.invoiceDetailSide}>
              <InvoiceReceiptsPanel
                receipts={[receiptToPanelItem(receipt)]}
                emptyHint="Este recibo no tiene facturas imputadas."
              />
            </div>
          </div>
        </div>

        <div
          className={`${modalStyles.modalActions} ${styles.invoiceDetailFooter}`}
        >
          <h3 className={styles.historySectionTitle}>Acciones</h3>
          <div className={styles.invoiceFooterRow}>
            <div className={styles.invoiceFooterStart}>
              <div className={styles.invoiceFooterActions}>
                <button
                  type="button"
                  className={styles.invoiceFooterAction}
                  onClick={() =>
                    run("download", () =>
                      downloadReceiptPdf(
                        receipt.id,
                        receiptPdfFilename(receipt.receiptNumber),
                      ),
                    )
                  }
                  aria-label={`Descargar recibo ${receipt.receiptNumber}`}
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
                  onClick={() =>
                    run("print", () => printReceiptPdf(receipt.id))
                  }
                  aria-label={`Imprimir recibo ${receipt.receiptNumber}`}
                  disabled={isBusy}
                >
                  <Printer strokeWidth={ICON_STROKE} aria-hidden />
                  <span className={styles.invoiceActionLabel}>
                    {busyAction === "print" ? "Abriendo…" : "Imprimir"}
                  </span>
                </button>
              </div>
            </div>
          </div>
          {actionError ? (
            <p className={styles.inlineError} role="alert">
              {actionError}
            </p>
          ) : null}
        </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
