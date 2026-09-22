"use client";

import { CustomDatePicker } from "@/shared/components/CustomDatePicker";
import { CustomSelect } from "@/shared/components/CustomSelect";
import { ArrowLeftRight, ICON_STROKE, Plus, Search } from "@/shared/icons";
import type { BillingMovementKind } from "@/features/billing/utils/movement-list";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

type MovementKindFilter = "all" | BillingMovementKind;

type MovimientosPageIntroProps = {
  query: string;
  kind: MovementKindFilter;
  fromDate: string;
  toDate: string;
  onQueryChange: (value: string) => void;
  onKindChange: (value: MovementKindFilter) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onCreateReceipt?: () => void;
  onCreateCreditNote?: () => void;
  onCreateDebitNote?: () => void;
};

const KIND_FILTER_OPTIONS = [
  { value: "all", label: "Todos los movimientos" },
          { value: "RECEIPT", label: "Recibos" },
  { value: "CREDIT_NOTE", label: "Notas de crédito" },
  { value: "DEBIT_NOTE", label: "Notas de débito" },
];

export function MovimientosPageIntro({
  query,
  kind,
  fromDate,
  toDate,
  onQueryChange,
  onKindChange,
  onFromDateChange,
  onToDateChange,
  onCreateReceipt,
  onCreateCreditNote,
  onCreateDebitNote,
}: MovimientosPageIntroProps) {
  return (
    <section className={styles.sectionIntro} aria-label="Movimientos">
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderText}>
          <h2 className={styles.sectionTitle}>
            <ArrowLeftRight
              className={styles.sectionTitleIcon}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
            Movimientos
          </h2>
          <p className={styles.sectionHint}>
            Recibos, notas de crédito, notas de débito e imputaciones. Las
            facturas se consultan en Facturas.
          </p>
        </div>
      </div>
      <div className={styles.filtersRow}>
        {onCreateReceipt || onCreateCreditNote || onCreateDebitNote ? (
          <div className={styles.movementCreateGroup}>
            {onCreateReceipt ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={onCreateReceipt}
              >
                <Plus strokeWidth={ICON_STROKE} aria-hidden />
                Recibo
              </button>
            ) : null}
            {onCreateCreditNote ? (
              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.movementCreateCredit}`}
                aria-label="Nueva nota de crédito"
                onClick={onCreateCreditNote}
              >
                <Plus strokeWidth={ICON_STROKE} aria-hidden />
                N. Crédito
              </button>
            ) : null}
            {onCreateDebitNote ? (
              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.movementCreateDebit}`}
                aria-label="Nueva nota de débito"
                onClick={onCreateDebitNote}
              >
                <Plus strokeWidth={ICON_STROKE} aria-hidden />
                N. Débito
              </button>
            ) : null}
          </div>
        ) : null}
        <div className={`${styles.filterSelect} ${styles.filterSelectWide}`}>
          <CustomSelect
            value={kind}
            onChange={(next) => onKindChange(next as MovementKindFilter)}
            ariaLabel="Filtrar por tipo de movimiento"
            options={KIND_FILTER_OPTIONS}
          />
        </div>
        <div className={styles.filterDateField}>
          <CustomDatePicker
            value={fromDate}
            onChange={onFromDateChange}
            allowEmpty
            ariaLabel="Filtrar movimientos desde"
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
            ariaLabel="Filtrar movimientos hasta"
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
            placeholder="Buscar por número, cliente o factura…"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            aria-label="Buscar movimientos"
          />
        </div>
      </div>
    </section>
  );
}
