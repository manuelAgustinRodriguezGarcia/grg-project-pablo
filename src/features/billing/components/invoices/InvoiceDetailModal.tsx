"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { InvoiceDocumentActions } from "@/features/billing/components/invoices/InvoiceDocumentActions";
import { InvoiceNotesPanel } from "@/features/billing/components/invoices/InvoiceNotesPanel";
import { InvoiceReceiptsPanel } from "@/features/billing/components/invoices/InvoiceReceiptsPanel";
import { IVA_CONDITION_LABELS } from "@/features/billing/types/billing-client.types";
import type {
  BillingInvoiceFiscalStatus,
  BillingInvoiceListItem,
  BillingPaymentStatus,
} from "@/features/billing/types/billing-invoice.types";
import {
  FISCAL_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/features/billing/types/billing-invoice.types";
import { billingClientHistoryHref } from "@/features/billing/data/billingNav";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import {
  invoiceDetailTotals,
  invoiceItemGrossTotal,
  invoiceItemUnitPriceNet,
} from "@/features/billing/utils/invoice-detail-totals";
import { useEscapeToClose } from "@/features/billing/hooks/useBillingModalKeyboard";
import {
  formatInvoiceIdentification,
  invoiceCanIssueCreditNote,
  invoiceCanIssueDebitNote,
  invoiceCanIssueReceipt,
} from "@/features/billing/utils/invoice-list";
import type { BillingNoteKind } from "@/generated/prisma/client";
import { Check, ICON_STROKE, ReceiptText, X } from "@/shared/icons";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type InvoiceDetailModalProps = {
  invoice: BillingInvoiceListItem;
  onClose: () => void;
  onIssueReceipt?: (invoice: BillingInvoiceListItem) => void;
  onIssueNote?: (
    invoice: BillingInvoiceListItem,
    kind: BillingNoteKind,
  ) => void;
  onOpenClientHistory?: () => void;
};

const CLOSE_ANIMATION_MS = 220;

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function PaymentStatusPill({ status }: { status: BillingPaymentStatus }) {
  switch (status) {
    case "PAGA":
      return (
        <span
          className={`${styles.invoicePaymentPill} ${styles.invoicePaymentPillPaid}`}
          aria-label="Estado de pago: paga"
        >
          <Check strokeWidth={ICON_STROKE} aria-hidden />
          {PAYMENT_STATUS_LABELS.PAGA}
        </span>
      );
    case "ANULADA":
      return (
        <span
          className={`${styles.invoicePaymentPill} ${styles.invoicePaymentPillAnulada}`}
          aria-label="Estado de pago: anulada"
        >
          {PAYMENT_STATUS_LABELS.ANULADA}
        </span>
      );
    case "IMPAGA":
    case "PARCIALMENTE_PAGA":
      return (
        <span
          className={`${styles.invoicePaymentPill} ${styles.invoicePaymentPillUnpaid}`}
          aria-label={`Estado de pago: ${PAYMENT_STATUS_LABELS[status].toLocaleLowerCase("es-AR")}`}
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
          {PAYMENT_STATUS_LABELS[status]}
        </span>
      );
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function FiscalStatusPill({ status }: { status: BillingInvoiceFiscalStatus }) {
  switch (status) {
    case "MODO_PRUEBA":
      return (
        <span
          className={`${styles.invoicePaymentPill} ${styles.invoiceFiscalPill} ${styles.invoiceFiscalPillPlain}`}
          aria-label="Estado fiscal: modo prueba"
        >
          Modo prueba
        </span>
      );
    case "AJUSTADA_NC":
    case "AJUSTADA_ND":
      return (
        <span
          className={`${styles.invoicePaymentPill} ${styles.invoiceFiscalPill} ${styles.invoiceFiscalPillAdjusted}`}
          aria-label={`Estado fiscal: ${FISCAL_STATUS_LABELS[status]}`}
        >
          {FISCAL_STATUS_LABELS[status]}
        </span>
      );
    case "ANULADA_NC":
      return (
        <span
          className={`${styles.invoicePaymentPill} ${styles.invoiceFiscalPill} ${styles.invoiceFiscalPillAnulada}`}
          aria-label="Estado fiscal: ANULADA N.C"
        >
          {FISCAL_STATUS_LABELS.ANULADA_NC}
        </span>
      );
    case "AUTORIZADA":
    case "BORRADOR":
    case "PENDIENTE_EMISION":
    case "ENVIANDO_ARCA":
    case "RECHAZADA":
    case "ERROR_TECNICO":
    case "CANCELADA":
      return (
        <span
          className={`${styles.invoicePaymentPill} ${styles.invoiceFiscalPill}`}
          aria-label={`ARCA: ${FISCAL_STATUS_LABELS[status].toLocaleLowerCase("es-AR")}`}
        >
          {status === "AUTORIZADA" ? (
            <Check strokeWidth={ICON_STROKE} aria-hidden />
          ) : (
            <X strokeWidth={ICON_STROKE} aria-hidden />
          )}
          ARCA
        </span>
      );
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function InvoiceDetailModal({
  invoice,
  onClose,
  onIssueReceipt,
  onIssueNote,
  onOpenClientHistory,
}: InvoiceDetailModalProps) {
  const router = useRouter();
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const requestClose = useCallback(
    (afterClose?: () => void) => {
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
    },
    [isClosing, onClose],
  );

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEscapeToClose(() => requestClose(), !isClosing);

  if (typeof document === "undefined") {
    return null;
  }

  const identification = formatInvoiceIdentification(
    invoice.clientIdentificationType,
    invoice.clientIdentificationNumber,
  );
  const totals = invoiceDetailTotals(invoice);
  const isOnAccount = invoice.paymentMethod === "CUENTA_CORRIENTE";

  function handleOpenClientHistory() {
    if (onOpenClientHistory) {
      requestClose(onOpenClientHistory);
      return;
    }

    if (!invoice.clientId) {
      return;
    }

    const clientId = invoice.clientId;
    requestClose(() => {
      router.push(billingClientHistoryHref(clientId));
    });
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
        aria-labelledby="invoice-detail-title"
      >
        <div className={styles.invoiceDetailHeader}>
          <div>
            <div className={styles.invoiceDetailTitleRow}>
              <h2 id="invoice-detail-title" className={styles.invoiceDetailTitle}>
                Factura {invoice.invoiceType} {invoice.invoiceNumber}
              </h2>
              <PaymentStatusPill status={invoice.paymentStatus} />
              <FiscalStatusPill status={invoice.fiscalStatus} />
            </div>
            <p className={styles.invoiceDetailSubtitle}>
              {DATE_FORMATTER.format(new Date(invoice.issuedAt))} ·{" "}
              {invoice.clientName} · {invoice.clientCode}
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
                <div className={styles.detailsItem}>
                  <dt className={styles.detailsLabel}>Identificación</dt>
                  <dd className={styles.detailsValue}>
                    {identification ?? "Sin documento"}
                  </dd>
                </div>
                <div className={styles.detailsItem}>
                  <dt className={styles.detailsLabel}>Condición IVA</dt>
                  <dd className={styles.detailsValue}>
                    {IVA_CONDITION_LABELS[invoice.clientIvaCondition]}
                  </dd>
                </div>
                <div className={styles.detailsItem}>
                  <dt className={styles.detailsLabel}>Forma de pago</dt>
                  <dd className={styles.detailsValue}>
                    {PAYMENT_METHOD_LABELS[invoice.paymentMethod]}
                  </dd>
                </div>
                {invoice.notes ? (
                  <div className={styles.detailsItemWide}>
                    <dt className={styles.detailsLabel}>Observaciones</dt>
                    <dd className={styles.detailsValue}>{invoice.notes}</dd>
                  </div>
                ) : null}
              </dl>

              <section
                className={styles.invoiceTotals}
                aria-label="Totales"
              >
                <div className={styles.invoiceTotalsLine}>
                  <div className={styles.invoiceTotalsItem}>
                    <span className={styles.detailsLabel}>
                      Subtotal neto s/IVA
                    </span>
                    <span className={styles.invoiceTotalsValue}>
                      {formatArsExact(totals.subtotalNet)}
                    </span>
                  </div>
                  {totals.hasDiscount ? (
                    <div className={styles.invoiceTotalsItem}>
                      <span className={styles.detailsLabel}>
                        Descuento {totals.discountPercent.toLocaleString("es-AR")}%
                      </span>
                      <span className={styles.invoiceTotalsValue}>
                        −{formatArsExact(totals.discountAmount)}
                      </span>
                    </div>
                  ) : null}
                  {totals.hasDiscount ? (
                    <div className={styles.invoiceTotalsItem}>
                      <span className={styles.detailsLabel}>Subtotal neto</span>
                      <span className={styles.invoiceTotalsValue}>
                        {formatArsExact(totals.subtotalNetAfterDiscount)}
                      </span>
                    </div>
                  ) : null}
                  <div className={styles.invoiceTotalsItem}>
                    <span className={styles.detailsLabel}>
                      IVA {totals.ivaPercent.toLocaleString("es-AR")}%
                    </span>
                    <span className={styles.invoiceTotalsValue}>
                      {formatArsExact(totals.ivaAmount)}
                    </span>
                  </div>
                </div>
                <div className={styles.invoiceTotalsDivider} role="presentation" />
                <div className={styles.invoiceTotalsTotal}>
                  <span className={styles.detailsLabel}>Total</span>
                  <span className={styles.invoiceTotalsTotalValue}>
                    {formatArsExact(totals.total)}
                  </span>
                </div>
              </section>

              <section
                className={styles.invoiceDetailItems}
                aria-label="Ítems"
              >
                <h3 className={styles.historySectionTitle}>Ítems</h3>
                <div className={styles.historyTableWrap}>
                  <table className={styles.historyTable}>
                    <thead>
                      <tr>
                        <th scope="col">Código</th>
                        <th scope="col">Detalle</th>
                        <th scope="col">Cant.</th>
                        <th scope="col">Precio uni. (s/IVA)</th>
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
                            {formatArsExact(
                              invoiceItemUnitPriceNet(
                                item.unitPrice,
                                invoice.ivaPercent,
                              ),
                            )}
                          </td>
                          <td className={styles.amountCell}>
                            {formatArsExact(
                              invoiceItemGrossTotal(
                                item.quantity,
                                item.unitPrice,
                              ),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className={styles.invoiceDetailSide}>
              <InvoiceReceiptsPanel
                receipts={invoice.receipts}
                emptyHint="No hay recibos imputados a esta factura."
                onIssueReceipt={
                  onIssueReceipt && invoiceCanIssueReceipt(invoice)
                    ? () => onIssueReceipt(invoice)
                    : undefined
                }
                issueReceiptAriaLabel={`Emitir recibo para ${invoice.invoiceNumber}`}
              />
              <InvoiceNotesPanel
                notes={invoice.billingNotes}
                emptyHint={
                  onIssueNote &&
                  (invoiceCanIssueCreditNote(invoice) ||
                    invoiceCanIssueDebitNote(invoice))
                    ? "Todavía no hay notas asociadas a esta factura."
                    : "No hay notas asociadas a esta factura."
                }
                onIssueCreditNote={
                  onIssueNote && invoiceCanIssueCreditNote(invoice)
                    ? () => onIssueNote(invoice, "CREDIT")
                    : undefined
                }
                onIssueDebitNote={
                  onIssueNote && invoiceCanIssueDebitNote(invoice)
                    ? () => onIssueNote(invoice, "DEBIT")
                    : undefined
                }
              />
            </div>
          </div>
          </div>

          <div
            className={`${modalStyles.modalActions} ${styles.invoiceDetailFooter}`}
          >
            <div className={styles.invoiceFooterRow}>
              <div className={styles.invoiceFooterEnd}>
                <h3 className={styles.historySectionTitle}>Acciones</h3>
                <div className={styles.invoiceFooterStart}>
                  <InvoiceDocumentActions invoice={invoice} variant="footer" />
                  {invoice.clientId ? (
                    <button
                      type="button"
                      className={styles.invoiceFooterAction}
                      onClick={handleOpenClientHistory}
                      aria-label="Historial de facturación"
                    >
                      <ReceiptText strokeWidth={ICON_STROKE} aria-hidden />
                      <span className={styles.invoiceActionLabel}>
                        Historial de facturación
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>
              {isOnAccount ? (
                <div className={styles.invoiceFooterBalanceCol}>
                  <div
                    className={`${styles.invoiceBalanceCard} ${
                      styles.invoiceFooterBalance
                    } ${
                      invoice.outstandingAmount > 0
                        ? styles.invoiceBalanceCardDue
                        : styles.invoiceBalanceCardPaid
                    }`}
                    role="status"
                  >
                    <span className={styles.invoiceBalanceKicker}>
                      {invoice.outstandingAmount > 0 &&
                      invoice.paymentStatus === "PARCIALMENTE_PAGA"
                        ? "Parcialmente pagada"
                        : "Cuenta corriente"}
                    </span>
                    <span className={styles.invoiceBalanceValue}>
                      {invoice.outstandingAmount > 0 ? (
                        <>
                          Saldo pendiente:{" "}
                          {formatArsExact(invoice.outstandingAmount)}
                        </>
                      ) : (
                        "Saldo al día"
                      )}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
