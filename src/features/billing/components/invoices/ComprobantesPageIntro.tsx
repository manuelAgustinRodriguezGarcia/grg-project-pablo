"use client";

import type { BillingPaymentStatus } from "@/generated/prisma/client";
import { CustomDatePicker } from "@/shared/components/CustomDatePicker";
import { CustomSelect } from "@/shared/components/CustomSelect";
import { FileSpreadsheet, ICON_STROKE, Search } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type InvoiceTypeFilter = "all" | "A" | "B";
type PaymentStatusFilter = "all" | BillingPaymentStatus;

type ComprobantesPageIntroProps = {
  query: string;
  invoiceType: InvoiceTypeFilter;
  paymentStatus: PaymentStatusFilter;
  fromDate: string;
  toDate: string;
  onQueryChange: (value: string) => void;
  onInvoiceTypeChange: (value: InvoiceTypeFilter) => void;
  onPaymentStatusChange: (value: PaymentStatusFilter) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onLibroIvaClick: () => void;
};

const TYPE_FILTER_OPTIONS = [
  { value: "all", label: "Todos los tipos" },
  { value: "A", label: "Factura A" },
  { value: "B", label: "Factura B" },
];

const PAYMENT_FILTER_OPTIONS = [
  { value: "all", label: "Todos los pagos" },
  { value: "PAGA", label: "Pagas" },
  {
    value: "PARCIALMENTE_PAGA",
    label: "Parcialmente pagas",
    triggerLabel: "Parc. pagas",
  },
  { value: "IMPAGA", label: "Impagas" },
  { value: "ANULADA", label: "Anuladas" },
];

export function ComprobantesPageIntro({
  query,
  invoiceType,
  paymentStatus,
  fromDate,
  toDate,
  onQueryChange,
  onInvoiceTypeChange,
  onPaymentStatusChange,
  onFromDateChange,
  onToDateChange,
  onLibroIvaClick,
}: ComprobantesPageIntroProps) {
  return (
    <section className={styles.sectionIntro} aria-label="Gestión de facturas">
      <div className={styles.filtersRow}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onLibroIvaClick}
        >
          <FileSpreadsheet strokeWidth={ICON_STROKE} aria-hidden />
          Libro IVA
        </button>
        <div className={styles.filterSelect}>
          <CustomSelect
            value={invoiceType}
            onChange={(next) => onInvoiceTypeChange(next as InvoiceTypeFilter)}
            ariaLabel="Filtrar por tipo de factura"
            options={TYPE_FILTER_OPTIONS}
          />
        </div>
        <div className={`${styles.filterSelect} ${styles.filterSelectPayment}`}>
          <CustomSelect
            value={paymentStatus}
            onChange={(next) =>
              onPaymentStatusChange(next as PaymentStatusFilter)
            }
            ariaLabel="Filtrar por estado de pago"
            options={PAYMENT_FILTER_OPTIONS}
          />
        </div>
        <div className={styles.filterDateField}>
          <CustomDatePicker
            value={fromDate}
            onChange={onFromDateChange}
            allowEmpty
            ariaLabel="Filtrar facturas desde"
            placeholder="Desde"
            triggerClassName={styles.filterDateControl}
            max={toDate || undefined}
          />
        </div>
        <div className={styles.filterDateField}>
          <CustomDatePicker
            value={toDate}
            onChange={onToDateChange}
            allowEmpty
            ariaLabel="Filtrar facturas hasta"
            placeholder="Hasta"
            triggerClassName={styles.filterDateControl}
            min={fromDate || undefined}
          />
        </div>
        <div className={styles.headerSearchWrap}>
          <Search
            className={styles.headerSearchIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <input
            type="search"
            className={styles.headerSearch}
            placeholder="Buscar por cliente, número, CUIT o DNI…"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label="Buscar facturas"
          />
        </div>
      </div>
    </section>
  );
}
