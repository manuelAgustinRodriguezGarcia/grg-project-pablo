"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { InvoiceDetailModal } from "@/features/billing/components/invoices/InvoiceDetailModal";
import { InvoiceDocumentActions } from "@/features/billing/components/invoices/InvoiceDocumentActions";
import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import {
  IDENTIFICATION_TYPE_LABELS,
  IVA_CONDITION_LABELS,
} from "@/features/billing/types/billing-client.types";
import type { BillingInvoiceListItem } from "@/features/billing/types/billing-invoice.types";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/features/billing/types/billing-invoice.types";
import { formatArs, formatArsExact } from "@/features/billing/utils/format-ars";
import { invoiceMatchesDateRange, listTopRubrosByClient, paymentStatusTone } from "@/features/billing/utils/invoice-list";
import { resolveLiveClientContact } from "@/features/billing/utils/invoice-share";
import type { BillingNoteKind, BillingPaymentStatus } from "@/generated/prisma/client";
import { CustomDatePicker } from "@/shared/components/CustomDatePicker";
import { CustomSelect } from "@/shared/components/CustomSelect";
import { formatCuit, formatDni } from "@/shared/utils/identification";
import { Award, ICON_STROKE, Mail, MoveDown, MoveUp, ReceiptText, X } from "@/shared/icons";
import { WhatsAppIcon } from "@/shared/components/WhatsAppIcon";
import modalStyles from "@/features/prices/styles/PriceColumnEditModal.module.scss";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type ClientDetailsModalProps = {
  client: BillingClientListItem;
  invoices: BillingInvoiceListItem[];
  creditAmount?: number;
  focusHistory?: boolean;
  onClose: () => void;
  onIssueReceipt?: (invoice: BillingInvoiceListItem) => void;
  onIssueNote?: (
    invoice: BillingInvoiceListItem,
    kind: BillingNoteKind,
  ) => void;
};

const INVOICE_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const CLOSE_ANIMATION_MS = 220;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatIdentification(client: BillingClientListItem): string | null {
  if (!client.identificationNumber) {
    return null;
  }

  if (client.identificationType === "CUIT") {
    return formatCuit(client.identificationNumber);
  }

  return formatDni(client.identificationNumber);
}

function paymentStatusBadgeClass(status: BillingPaymentStatus): string {
  const tone = paymentStatusTone(status);
  switch (tone) {
    case "ok":
      return styles.statusBadgeOk;
    case "partial":
      return styles.statusBadgePartial;
    case "inactive":
      return styles.statusBadgeInactive;
    case "void":
      return styles.statusBadgeAnulada;
    default: {
      const _exhaustive: never = tone;
      return _exhaustive;
    }
  }
}

export function ClientDetailsModal({
  client,
  invoices,
  creditAmount = 0,
  focusHistory = false,
  onClose,
  onIssueReceipt,
  onIssueNote,
}: ClientDetailsModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [historyOldestFirst, setHistoryOldestFirst] = useState(true);
  const [historyPaymentStatus, setHistoryPaymentStatus] = useState<
    "all" | BillingPaymentStatus
  >("all");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const copyTimerRef = useRef<number | null>(null);
  const historyRef = useRef<HTMLElement>(null);
  const historyTableWrapRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const handleCopy = useCallback(async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }

    setCopiedKey(key);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => {
      copyTimerRef.current = null;
      setCopiedKey(null);
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function requestClose() {
    if (isClosing) {
      return;
    }

    if (prefersReducedMotion()) {
      onClose();
      return;
    }

    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, CLOSE_ANIMATION_MS);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (selectedInvoiceId) {
        setSelectedInvoiceId(null);
        return;
      }

      requestClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isClosing, onClose, selectedInvoiceId]);

  useEffect(() => {
    setHistoryFromDate("");
    setHistoryToDate("");
  }, [client.id]);

  useEffect(() => {
    if (!focusHistory) {
      return;
    }

    historyRef.current?.scrollIntoView({ block: "start" });
  }, [focusHistory, client.id]);

  const clientInvoices = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.clientId === client.id)
        .map((invoice) => {
          const live = resolveLiveClientContact(invoice, [client]);
          if (
            live.whatsapp === invoice.clientWhatsapp &&
            live.email === invoice.clientEmail
          ) {
            return invoice;
          }

          return {
            ...invoice,
            clientWhatsapp: live.whatsapp,
            clientEmail: live.email,
          };
        }),
    [client, invoices],
  );

  const filteredInvoices = useMemo(() => {
    const next = clientInvoices.filter((invoice) => {
      if (!invoiceMatchesDateRange(invoice, historyFromDate, historyToDate)) {
        return false;
      }

      if (
        historyPaymentStatus !== "all" &&
        invoice.paymentStatus !== historyPaymentStatus
      ) {
        return false;
      }

      return true;
    });

    return [...next].sort((left, right) => {
      const byDate =
        new Date(left.issuedAt).getTime() - new Date(right.issuedAt).getTime();
      return historyOldestFirst ? byDate : -byDate;
    });
  }, [
    clientInvoices,
    historyFromDate,
    historyToDate,
    historyOldestFirst,
    historyPaymentStatus,
  ]);

  useLayoutEffect(() => {
    const wrap = historyTableWrapRef.current;
    if (!wrap) {
      return;
    }

    wrap.scrollTop = historyOldestFirst ? wrap.scrollHeight : 0;
  }, [filteredInvoices, historyOldestFirst]);

  const selectedInvoice =
    clientInvoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null;

  const topRubros = useMemo(
    () => listTopRubrosByClient(clientInvoices),
    [clientInvoices],
  );

  if (typeof document === "undefined") {
    return null;
  }

  function renderCopyable(key: string, value: string, icon?: ReactNode) {
    const isCopied = copiedKey === key;

    return (
      <button
        type="button"
        className={`${styles.copyValue} ${styles.detailsValue} ${
          isCopied ? styles.copyValueCopied : ""
        }`}
        onClick={() => void handleCopy(key, value)}
        title={isCopied ? "Copiado" : "Copiar"}
      >
        {icon}
        <span className={styles.copyValueText}>{value}</span>
      </button>
    );
  }

  const identification = formatIdentification(client);
  const location = [client.city, client.province].filter(Boolean).join(", ");
  const locationLines = [client.address, location].filter(Boolean);
  const locationValue = locationLines.join("\n");

  const modal = createPortal(
    <div
      className={`${modalStyles.modalOverlay}${
        isClosing ? ` ${styles.detailsModalOverlayClosing}` : ""
      }`}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        className={`${modalStyles.modalCard} ${styles.detailsModalCard}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-details-title"
      >
        <div className={styles.detailsModalChrome}>
          <div
            className={`${modalStyles.modalHeaderText} ${styles.detailsModalProfileHeader}`}
          >
            <h2 id="client-details-title" className={modalStyles.modalTitle}>
              {client.name}
            </h2>
            <p className={modalStyles.modalSubtitle}>
              Código{" "}
              <button
                type="button"
                className={`${styles.copyValue} ${styles.detailsCodeValue} ${
                  copiedKey === "code" ? styles.copyValueCopied : ""
                }`}
                onClick={() => void handleCopy("code", client.code)}
                title={copiedKey === "code" ? "Copiado" : "Copiar código"}
              >
                {client.code}
              </button>
              {" · Alta el "}
              {INVOICE_DATE_FORMATTER.format(new Date(client.createdAt))}
            </p>
          </div>
          <button
            type="button"
            className={modalStyles.modalCloseButton}
            onClick={requestClose}
            aria-label="Cerrar"
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>
        <div className={styles.detailsModalLayout}>
          <div className={styles.detailsModalProfile}>
            <div className={`${styles.detailsGrid} ${styles.detailsGridStack}`}>
              <div className={styles.detailsItem}>
                <span className={styles.detailsLabel}>
                  Identificación:{" "}
                  {IDENTIFICATION_TYPE_LABELS[client.identificationType]}
                </span>
                {identification ? (
                  renderCopyable("identification", identification)
                ) : (
                  <span className={styles.detailsValueEmpty}>Sin datos</span>
                )}
              </div>

              <div className={styles.detailsItem}>
                <span className={styles.detailsLabel}>Condición de IVA</span>
                <span className={styles.detailsValue}>
                  {IVA_CONDITION_LABELS[client.ivaCondition]}
                </span>
              </div>

              <div className={styles.detailsItem}>
                <span className={styles.detailsLabel}>Ubicación</span>
                {locationLines.length > 0 ? (
                  <button
                    type="button"
                    className={`${styles.copyValue} ${styles.detailsValue} ${styles.detailsLocationCopy} ${
                      copiedKey === "location" ? styles.copyValueCopied : ""
                    }`}
                    onClick={() => void handleCopy("location", locationValue)}
                    title={copiedKey === "location" ? "Copiado" : "Copiar"}
                  >
                    {locationLines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </button>
                ) : (
                  <span className={styles.detailsValueEmpty}>Sin datos</span>
                )}
              </div>

              <div className={styles.detailsItem}>
                <span className={styles.detailsLabel}>Contacto</span>
                {client.email || client.whatsapp ? (
                  <>
                    {client.email
                      ? renderCopyable(
                          "email",
                          client.email,
                          <Mail
                            className={`${styles.detailsContactIcon} ${styles.detailsContactIconMail}`}
                            strokeWidth={ICON_STROKE}
                            aria-hidden
                          />,
                        )
                      : null}
                    {client.whatsapp
                      ? renderCopyable(
                          "whatsapp",
                          client.whatsapp,
                          <WhatsAppIcon
                            className={`${styles.detailsContactIcon} ${styles.detailsContactIconWhatsapp}`}
                          />,
                        )
                      : null}
                  </>
                ) : (
                  <span className={styles.detailsValueEmpty}>Sin datos</span>
                )}
              </div>
            </div>

            {topRubros.length > 0 || client.notes ? (
              <div className={styles.detailsProfileFooter}>
                {topRubros.length > 0 ? (
                  <div className={styles.detailsItem}>
                    <span className={styles.detailsLabel}>Rubros más comprados</span>
                    <ol className={styles.detailsTopRubros}>
                      {topRubros.map((rubro, index) => {
                        const medalClass =
                          index === 0
                            ? styles.detailsTopRubroMedalGold
                            : index === 1
                              ? styles.detailsTopRubroMedalSilver
                              : styles.detailsTopRubroMedalBronze;

                        return (
                          <li key={rubro.name} className={styles.detailsTopRubroItem}>
                            <span className={`${styles.detailsTopRubroMedal} ${medalClass}`}>
                              <Award strokeWidth={ICON_STROKE} aria-hidden />
                            </span>
                            <span className={styles.detailsTopRubroCopy}>
                              <span className={styles.detailsTopRubroName}>{rubro.name}</span>
                              <span className={styles.detailsTopRubroMeta}>
                                {formatArs(rubro.amount)}
                                {" · "}
                                {rubro.invoiceCount === 1
                                  ? "1 factura"
                                  : `${rubro.invoiceCount} facturas`}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ) : null}

                {client.notes ? (
                  <div className={styles.detailsItem}>
                    <span className={styles.detailsLabel}>Observaciones</span>
                    <span className={styles.detailsValue}>{client.notes}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <section
            ref={historyRef}
            className={styles.historySection}
            aria-label="Historial de facturación"
          >
            <div className={styles.historySectionHeader}>
              <div className={styles.historySectionHeading}>
                <h3 className={styles.historySectionTitle}>
                  Historial de facturación
                </h3>
                <p
                  className={`${styles.clientCreditPill} ${
                    creditAmount > 0 ? "" : styles.clientCreditPillEmpty
                  }`}
                  role="status"
                >
                  Saldo a favor {formatArsExact(creditAmount)}
                </p>
              </div>
              <div className={styles.historyDateFilters}>
                <div className={`${styles.historyDateField} ${styles.historySortField}`}>
                  <span className={styles.historyDateLabel}>Orden</span>
                  <button
                    type="button"
                    className={styles.historySortButton}
                    onClick={() =>
                      setHistoryOldestFirst((current) => !current)
                    }
                    aria-label={
                      historyOldestFirst
                        ? "Orden por fecha: ASC. Cambiar a DESC"
                        : "Orden por fecha: DESC. Cambiar a ASC"
                    }
                  >
                    Fecha
                    {historyOldestFirst ? (
                      <MoveUp strokeWidth={ICON_STROKE} aria-hidden />
                    ) : (
                      <MoveDown strokeWidth={ICON_STROKE} aria-hidden />
                    )}
                  </button>
                </div>
                <div className={`${styles.historyDateField} ${styles.historyPaymentStatusField}`}>
                  <span className={styles.historyDateLabel}>Estado</span>
                  <CustomSelect
                    value={historyPaymentStatus}
                    onChange={(value) =>
                      setHistoryPaymentStatus(
                        value as "all" | BillingPaymentStatus,
                      )
                    }
                    ariaLabel="Filtrar historial por estado de pago"
                    options={[
                      { value: "all", label: "Todos" },
                      { value: "PAGA", label: "Pagas" },
                      { value: "IMPAGA", label: "Impagas" },
                      {
                        value: "PARCIALMENTE_PAGA",
                        label: "Parcialmente pagas",
                        triggerLabel: "Parc. pagas",
                      },
                      { value: "ANULADA", label: "Anuladas" },
                    ]}
                  />
                </div>
                <div className={styles.historyDateField}>
                  <span className={styles.historyDateLabel}>Desde</span>
                  <CustomDatePicker
                    value={historyFromDate}
                    onChange={setHistoryFromDate}
                    allowEmpty
                    ariaLabel="Filtrar historial desde"
                    placeholder="DD/MM/AAAA"
                    triggerClassName={`${modalStyles.formDateControl} ${styles.historyDateControl}`}
                    max={historyToDate || undefined}
                  />
                </div>
                <div className={styles.historyDateField}>
                  <span className={styles.historyDateLabel}>Hasta</span>
                  <CustomDatePicker
                    value={historyToDate}
                    onChange={setHistoryToDate}
                    allowEmpty
                    ariaLabel="Filtrar historial hasta"
                    placeholder="DD/MM/AAAA"
                    triggerClassName={`${modalStyles.formDateControl} ${styles.historyDateControl}`}
                    min={historyFromDate || undefined}
                  />
                </div>
              </div>
            </div>
            {clientInvoices.length === 0 ? (
              <div className={styles.historyEmpty}>
                <ReceiptText
                  className={styles.historyEmptyIcon}
                  strokeWidth={ICON_STROKE}
                  aria-hidden
                />
                <p className={styles.historyEmptyText}>
                  Todavía no hay comprobantes para este cliente.
                </p>
                <p className={styles.historyEmptyHint}>
                  Cuando se emitan facturas, verá aquí el historial con sus
                  comprobantes y pagos.
                </p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className={styles.historyEmpty}>
                <ReceiptText
                  className={styles.historyEmptyIcon}
                  strokeWidth={ICON_STROKE}
                  aria-hidden
                />
                <p className={styles.historyEmptyText}>
                  No hay comprobantes en el rango seleccionado.
                </p>
              </div>
            ) : (
              <div ref={historyTableWrapRef} className={styles.historyTableWrap}>
                <table className={styles.historyTable}>
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Número</th>
                      <th scope="col">Total</th>
                      <th scope="col">Pago</th>
                      <th scope="col">Método</th>
                      <th scope="col" className={styles.actionsCell}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>
                          {INVOICE_DATE_FORMATTER.format(
                            new Date(invoice.issuedAt),
                          )}
                        </td>
                        <td>
                          <span
                            className={`${styles.invoiceTypeBadge} ${
                              invoice.invoiceType === "A"
                                ? styles.invoiceTypeBadgeA
                                : styles.invoiceTypeBadgeB
                            }`}
                          >
                            {invoice.invoiceType}
                          </span>
                        </td>
                        <td className={styles.invoiceNumberCell}>
                          {invoice.invoiceNumber}
                        </td>
                        <td className={styles.amountCell}>
                          {formatArsExact(invoice.totalVisualRounded)}
                        </td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${paymentStatusBadgeClass(invoice.paymentStatus)}`}
                          >
                            {PAYMENT_STATUS_LABELS[invoice.paymentStatus]}
                          </span>
                        </td>
                        <td>
                          {PAYMENT_METHOD_LABELS[invoice.paymentMethod]}
                        </td>
                        <td className={styles.actionsCell}>
                          <InvoiceDocumentActions
                            invoice={invoice}
                            onDetails={(next) => setSelectedInvoiceId(next.id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {modal}
      {selectedInvoice ? (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoiceId(null)}
          onIssueReceipt={onIssueReceipt}
          onIssueNote={onIssueNote}
          onOpenClientHistory={() => {
            setSelectedInvoiceId(null);
            window.requestAnimationFrame(() => {
              historyRef.current?.scrollIntoView({ block: "start" });
            });
          }}
        />
      ) : null}
    </>
  );
}
