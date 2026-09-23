"use client";

import { useState } from "react";
import { AdminTableSkeleton } from "@/features/admin/components/AdminTableSkeleton";
import {
  RECEIPT_ALLOCATION_STATUS_LABELS,
  RECEIPT_PAYMENT_METHOD_LABELS,
} from "@/features/billing/types/billing-receipt.types";
import { formatArsExact } from "@/features/billing/utils/format-ars";
import { DocumentActivityBadges } from "@/features/billing/components/invoices/DocumentActivityBadges";
import { useBillingDocumentActivity } from "@/features/billing/hooks/useBillingDocumentActivity";
import {
  downloadNotePdf,
  downloadReceiptPdf,
  notePdfFilename,
  printNotePdf,
  printReceiptPdf,
  receiptPdfFilename,
} from "@/features/billing/utils/invoice-pdf-client";
import {
  movementKindEmptyCopy,
  movementKindLabel,
  type BillingMovementKind,
  type BillingMovementListItem,
} from "@/features/billing/utils/movement-list";
import { ArrowLeftRight, Download, Eye, ICON_STROKE, Printer, Receipt } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type MovementKindFilter = "all" | BillingMovementKind;

type MovimientosTableProps = {
  movements: BillingMovementListItem[];
  kindFilter: MovementKindFilter;
  isLoading: boolean;
  error: string | null;
  onOpenInvoice: (invoiceId: string) => void;
  onOpenReceipt: (receiptId: string) => void;
  onAllocate?: (receiptId: string) => void;
};

const MOVEMENT_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function movementKindBadgeClass(kind: BillingMovementKind): string {
  switch (kind) {
    case "RECEIPT":
      return styles.movementKindBadgeReceipt;
    case "CREDIT_NOTE":
      return styles.movementKindBadgeCredit;
    case "DEBIT_NOTE":
      return styles.movementKindBadgeDebit;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function movementRowClass(kind: BillingMovementKind): string | undefined {
  switch (kind) {
    case "RECEIPT":
      return undefined;
    case "CREDIT_NOTE":
      return styles.movementRowCredit;
    case "DEBIT_NOTE":
      return styles.movementRowDebit;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function MovementInvoices({
  invoices,
  fallback,
  onOpenInvoice,
}: {
  invoices: BillingMovementListItem["invoices"];
  fallback: string;
  onOpenInvoice: (invoiceId: string) => void;
}) {
  if (invoices.length === 0) {
    return fallback;
  }

  return (
    <ul className={styles.movementInvoiceList}>
      {invoices.map((invoice) => (
        <li key={invoice.id}>
          <button
            type="button"
            className={styles.movementInvoiceLink}
            onClick={() => onOpenInvoice(invoice.id)}
            aria-label={`Ver factura ${invoice.label}`}
          >
            {invoice.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

function emptyCopy(kindFilter: MovementKindFilter): string {
  if (kindFilter === "all") {
    return "Todavía no hay movimientos. Emití un Recibo o una nota acá, o desde una factura.";
  }

  return movementKindEmptyCopy(kindFilter);
}

function MovementActions({
  movement,
  variant,
  onOpenReceipt,
  onAllocate,
  onDownloadError,
}: {
  movement: BillingMovementListItem;
  variant: "icon" | "card";
  onOpenReceipt: (receiptId: string) => void;
  onAllocate?: (receiptId: string) => void;
  onDownloadError: (message: string) => void;
}) {
  const markActivity = useBillingDocumentActivity();
  const documentKind =
    movement.kind === "RECEIPT" ? "RECEIPT" : "NOTE";

  function noteKind() {
    return movement.kind === "CREDIT_NOTE" ? "CREDIT" : "DEBIT";
  }

  function download() {
    const task =
      movement.kind === "RECEIPT"
        ? downloadReceiptPdf(movement.id, receiptPdfFilename(movement.number))
        : downloadNotePdf(
            movement.id,
            notePdfFilename(noteKind(), movement.number),
          );

    void task
      .then(() => markActivity(documentKind, movement.id, "downloaded"))
      .catch((caught: unknown) => {
        onDownloadError(
          caught instanceof Error
            ? caught.message
            : "No se pudo descargar el comprobante.",
        );
      });
  }

  function print() {
    const task =
      movement.kind === "RECEIPT"
        ? printReceiptPdf(movement.id)
        : printNotePdf(movement.id);

    void task
      .then(() => markActivity(documentKind, movement.id, "printed"))
      .catch((caught: unknown) => {
        onDownloadError(
          caught instanceof Error
            ? caught.message
            : "No se pudo imprimir el comprobante.",
        );
      });
  }

  const downloadButton =
    variant === "card" ? (
      <button type="button" className={styles.cardActionButton} onClick={download}>
        <Download strokeWidth={ICON_STROKE} aria-hidden />
        PDF
      </button>
    ) : (
      <span className={styles.rowActionWrap}>
        <button
          type="button"
          className={`${styles.editActionButton} ${styles.iconActionButton}`}
          aria-label={`Descargar ${movement.number}`}
          onClick={download}
        >
          <Download strokeWidth={ICON_STROKE} aria-hidden />
        </button>
        <span className={styles.rowActionTooltip} role="tooltip">
          Descargar PDF
        </span>
      </span>
    );

  const printButton =
    variant === "card" ? (
      <button type="button" className={styles.cardActionButton} onClick={print}>
        <Printer strokeWidth={ICON_STROKE} aria-hidden />
        Imprimir
      </button>
    ) : (
      <span className={styles.rowActionWrap}>
        <button
          type="button"
          className={`${styles.editActionButton} ${styles.iconActionButton}`}
          aria-label={`Imprimir ${movement.number}`}
          onClick={print}
        >
          <Printer strokeWidth={ICON_STROKE} aria-hidden />
        </button>
        <span className={styles.rowActionTooltip} role="tooltip">
          Imprimir
        </span>
      </span>
    );

  const documentButtons = (
    <>
      {printButton}
      {downloadButton}
    </>
  );

  switch (movement.kind) {
    case "CREDIT_NOTE":
    case "DEBIT_NOTE":
      return documentButtons;
    case "RECEIPT":
      break;
    default: {
      const _exhaustive: never = movement.kind;
      return _exhaustive;
    }
  }

  switch (variant) {
    case "card":
      return (
        <>
          {documentButtons}
          {onAllocate && movement.remainingAmount > 0 ? (
            <button
              type="button"
              className={styles.cardActionButton}
              onClick={() => onAllocate(movement.id)}
            >
              <Receipt strokeWidth={ICON_STROKE} aria-hidden />
              Imputar
            </button>
          ) : null}
          <button
            type="button"
            className={styles.cardActionButton}
            onClick={() => onOpenReceipt(movement.id)}
          >
            <Eye strokeWidth={ICON_STROKE} aria-hidden />
            Detalle
          </button>
        </>
      );
    case "icon":
      return (
        <>
          {documentButtons}
          {onAllocate && movement.remainingAmount > 0 ? (
            <span className={styles.rowActionWrap}>
              <button
                type="button"
                className={`${styles.editActionButton} ${styles.iconActionButton}`}
                aria-label={`Imputar ${movement.number}`}
                onClick={() => onAllocate(movement.id)}
              >
                <Receipt strokeWidth={ICON_STROKE} aria-hidden />
              </button>
              <span className={styles.rowActionTooltip} role="tooltip">
                Imputar
              </span>
            </span>
          ) : null}
          <span className={styles.rowActionWrap}>
            <button
              type="button"
              className={`${styles.editActionButton} ${styles.iconActionButton}`}
              onClick={() => onOpenReceipt(movement.id)}
              aria-label={`Ver detalle de ${movement.number}`}
            >
              <Eye strokeWidth={ICON_STROKE} aria-hidden />
            </button>
            <span className={styles.rowActionTooltip} role="tooltip">
              Detalle
            </span>
          </span>
        </>
      );
    default: {
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

export function MovimientosTable({
  movements,
  kindFilter,
  isLoading,
  error,
  onOpenInvoice,
  onOpenReceipt,
  onAllocate,
}: MovimientosTableProps) {
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de movimientos">
        <AdminTableSkeleton
          variant="users"
          label="Cargando movimientos…"
          rowCount={6}
          fillHeight
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de movimientos">
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (movements.length === 0) {
    return (
      <section className={styles.tablePanel} aria-label="Listado de movimientos">
        <div className={styles.tableWrapEmpty}>
          <div className={styles.tableEmpty} role="status">
            <ArrowLeftRight
              className={styles.tableEmptyIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            <p className={styles.tableEmptyText}>{emptyCopy(kindFilter)}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.tablePanel} aria-label="Listado de movimientos">
      {downloadError ? (
        <p className={styles.inlineError} role="alert">
          {downloadError}
        </p>
      ) : null}
      <div className={styles.tableWrap}>
        <div className={styles.desktopTable}>
          <table className={styles.clientsTable}>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Tipo</th>
                <th scope="col">Número</th>
                <th scope="col">Cliente</th>
                <th scope="col">Facturas</th>
                <th scope="col">Importe</th>
                <th scope="col">Imputación</th>
                <th scope="col">Forma de pago</th>
                <th scope="col" className={styles.actionsCell}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr
                  key={`${movement.kind}-${movement.id}`}
                  className={movementRowClass(movement.kind)}
                >
                  <td>
                    {MOVEMENT_DATE_FORMATTER.format(new Date(movement.issuedAt))}
                  </td>
                  <td>
                    <span
                      className={`${styles.movementKindBadge} ${movementKindBadgeClass(movement.kind)}`}
                    >
                      {movementKindLabel(movement.kind)}
                    </span>
                  </td>
                  <td className={styles.invoiceNumberCell}>
                    {movement.number}
                    <DocumentActivityBadges activity={movement} />
                  </td>
                  <td className={styles.clientIdentityCell}>
                    {movement.clientName}
                  </td>
                  <td className={styles.movementInvoicesCell}>
                    <MovementInvoices
                      invoices={movement.invoices}
                      fallback={movement.invoiceNumbers}
                      onOpenInvoice={onOpenInvoice}
                    />
                  </td>
                  <td className={styles.amountCell}>
                    {formatArsExact(movement.amount)}
                  </td>
                  <td>
                    {movement.allocationStatus
                      ? RECEIPT_ALLOCATION_STATUS_LABELS[movement.allocationStatus]
                      : "—"}
                  </td>
                  <td>
                    {movement.paymentMethod
                      ? RECEIPT_PAYMENT_METHOD_LABELS[movement.paymentMethod]
                      : "—"}
                  </td>
                  <td className={styles.actionsCell}>
                    <span className={styles.actionsGroup}>
                      <MovementActions
                        movement={movement}
                        variant="icon"
                        onOpenReceipt={onOpenReceipt}
                        onAllocate={onAllocate}
                        onDownloadError={(message) => {
                          setDownloadError(message);
                        }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.mobileList}>
          {movements.map((movement) => (
            <article
              key={`${movement.kind}-${movement.id}`}
              className={[
                styles.clientCard,
                movementRowClass(movement.kind),
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className={styles.clientCardHeader}>
                <div>
                  <p className={styles.clientCardCode}>{movement.number}</p>
                  <DocumentActivityBadges activity={movement} />
                  <h2 className={styles.clientCardName}>{movement.clientName}</h2>
                  <p className={styles.invoiceMeta}>
                    {MOVEMENT_DATE_FORMATTER.format(new Date(movement.issuedAt))}
                  </p>
                  <div className={styles.movementInvoicesCell}>
                    <MovementInvoices
                      invoices={movement.invoices}
                      fallback={movement.invoiceNumbers}
                      onOpenInvoice={onOpenInvoice}
                    />
                  </div>
                </div>
                <span
                  className={`${styles.movementKindBadge} ${movementKindBadgeClass(movement.kind)}`}
                >
                  {movementKindLabel(movement.kind)}
                </span>
              </div>
              <p className={styles.amountCell}>
                {formatArsExact(movement.amount)}
              </p>
              <p className={styles.invoiceMeta}>
                {movement.paymentMethod
                  ? RECEIPT_PAYMENT_METHOD_LABELS[movement.paymentMethod]
                  : "Sin forma de pago"}
              </p>
              <div className={styles.clientCardActions}>
                <MovementActions
                  movement={movement}
                  variant="card"
                  onOpenReceipt={onOpenReceipt}
                  onAllocate={onAllocate}
                  onDownloadError={(message) => {
                    setDownloadError(message);
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
