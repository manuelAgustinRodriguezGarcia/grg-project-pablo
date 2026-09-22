"use client";

import { useMemo, useState } from "react";
import type { BillingClientListItem } from "@/features/billing/types/billing-client.types";
import { IVA_CONDITION_LABELS } from "@/features/billing/types/billing-client.types";
import {
  INVOICE_TYPE_LABELS,
  type BillingFiscalContext,
} from "@/features/billing/types/billing-invoice.types";
import { formatArs } from "@/features/billing/utils/format-ars";
import {
  determineInvoiceType,
  isCanonicalGenericBillingClient,
  isGenericBillingClient,
} from "@/shared/utils/billing-invoice-rules";
import { BookUser, UserLock, UserRoundArrowLeft, ICON_STROKE } from "@/shared/icons";
import {
  formatBillingClientPickerIdentification,
  toBillingClientPickerOptions,
} from "@/features/billing/utils/billing-client-picker";
import { INVOICE_CLIENT_PICKER_ID } from "@/features/billing/utils/invoice-keyboard-flow";
import { InvoiceSearchPicker } from "./InvoiceSearchPicker";
import styles from "@/features/billing/styles/NewInvoice.module.scss";

type InvoiceClientSectionProps = {
  clients: BillingClientListItem[];
  selectedClient: BillingClientListItem | null;
  fiscalContext: BillingFiscalContext;
  disabled: boolean;
  actionError?: string | null;
  onSelect: (client: BillingClientListItem) => void;
  onClear: () => void;
  onCreateClient: () => void;
  onSelectUnidentifiedClient: () => void;
};

export function InvoiceClientSection({
  clients,
  selectedClient,
  fiscalContext,
  disabled,
  actionError,
  onSelect,
  onClear,
  onCreateClient,
  onSelectUnidentifiedClient,
}: InvoiceClientSectionProps) {
  const [query, setQuery] = useState("");

  const options = useMemo(
    () =>
      toBillingClientPickerOptions(
        clients.filter((client) => !isCanonicalGenericBillingClient(client)),
        query,
      ),
    [clients, query],
  );

  const invoiceType = selectedClient
    ? determineInvoiceType(
        selectedClient.identificationType,
        selectedClient.ivaCondition,
      )
    : null;
  const isGeneric = selectedClient
    ? isGenericBillingClient(selectedClient)
    : false;

  return (
    <section
      className={`${styles.sectionCard}${
        selectedClient ? ` ${styles.selectedClientSticky}` : ""
      }`}
      {...(selectedClient ? { "data-invoice-client-sticky": true } : {})}
      aria-label="Cliente"
    >
      <h2 className={styles.sectionCardTitle}>
        <BookUser className={styles.sectionCardIcon} strokeWidth={ICON_STROKE} aria-hidden />
        Cliente
      </h2>

      {selectedClient ? (
        <>
          <div className={styles.selectedClientCard}>
            <div className={styles.selectedClientBody}>
              <p className={styles.selectedClientName}>
                {selectedClient.name}
              </p>
              <div className={styles.selectedClientMetaRow}>
                <p className={styles.selectedClientMeta}>
                  {selectedClient.code} ·{" "}
                  {formatBillingClientPickerIdentification(selectedClient)}{" "}
                  · {IVA_CONDITION_LABELS[selectedClient.ivaCondition]}
                </p>
                {invoiceType ? (
                  <span
                    className={`${styles.selectedClientTypePill} ${
                      invoiceType === "A"
                        ? styles.selectedClientTypePillA
                        : styles.selectedClientTypePillB
                    }`}
                  >
                    {INVOICE_TYPE_LABELS[invoiceType]}
                  </span>
                ) : null}
              </div>
              {selectedClient.address || selectedClient.city ? (
                <p className={styles.selectedClientMeta}>
                  {[
                    selectedClient.address,
                    selectedClient.city,
                    selectedClient.province,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.selectedClientClear}
              onClick={onClear}
              disabled={disabled}
              aria-label="Cambiar cliente"
            >
              <UserRoundArrowLeft strokeWidth={ICON_STROKE} aria-hidden />
              Cambiar
            </button>
          </div>

          {isGeneric ? (
            <div
              className={`${styles.invoiceTypeNotice} ${styles.invoiceTypeNoticeB}`}
              role="status"
            >
              Se generará una Factura tipo B para consumidor final sin
              identificación.
              <br />
              Límite vigente: {formatArs(fiscalContext.genericClientLimit)}.
            </div>
          ) : null}
        </>
      ) : (
        <>
          <InvoiceSearchPicker
            inputId={INVOICE_CLIENT_PICKER_ID}
            placeholder="Buscar por nombre, código, CUIT o DNI…"
            query={query}
            options={options}
            emptyText="No se encontraron clientes con esa búsqueda."
            disabled={disabled}
            autoFocus
            leadingAction={{
              label: "Agregar nuevo cliente",
              onSelect: onCreateClient,
            }}
            secondaryLeadingAction={{
              label: "Cliente sin identificación",
              icon: <UserLock strokeWidth={ICON_STROKE} aria-hidden />,
              onSelect: onSelectUnidentifiedClient,
            }}
            onQueryChange={setQuery}
            onSelect={(id) => {
              const client = clients.find((candidate) => candidate.id === id);
              if (client) {
                onSelect(client);
                setQuery("");
              }
            }}
          />
          {actionError ? (
            <p className={styles.sectionError} role="alert">
              {actionError}
            </p>
          ) : null}
          <p className={styles.sectionHint}>
            La letra de la factura (A o B) se determina automáticamente según
            la identificación y la condición de IVA del cliente.
          </p>
        </>
      )}
    </section>
  );
}
