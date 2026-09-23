"use client";

import { CustomSelect } from "@/shared/components/CustomSelect";
import { ICON_STROKE, Plus, Search } from "@/shared/icons";
import {
  IDENTIFICATION_TYPE_LABELS,
  IVA_CONDITION_LABELS,
  IVA_CONDITION_ORDER,
  IVA_CONDITION_SHORT_LABELS,
} from "@/features/billing/types/billing-client.types";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

export type ClientSortOrder = "az" | "za";

type ClientsPageIntroProps = {
  query: string;
  identificationFilter: string;
  ivaFilter: string;
  paymentFilter: string;
  sortOrder: ClientSortOrder;
  onQueryChange: (value: string) => void;
  onIdentificationFilterChange: (value: string) => void;
  onIvaFilterChange: (value: string) => void;
  onPaymentFilterChange: (value: string) => void;
  onSortOrderChange: (value: ClientSortOrder) => void;
  onCreateClick?: () => void;
};

const IDENTIFICATION_FILTER_OPTIONS = [
  { value: "all", label: "Todas las identificaciones" },
  { value: "CUIT", label: IDENTIFICATION_TYPE_LABELS.CUIT },
  { value: "DNI", label: IDENTIFICATION_TYPE_LABELS.DNI },
  { value: "NINGUNO", label: IDENTIFICATION_TYPE_LABELS.NINGUNO },
];

const IVA_FILTER_OPTIONS = [
  { value: "all", label: "Todas las condiciones" },
  ...IVA_CONDITION_ORDER.map((condition) => ({
    value: condition,
    label: (
      <>
        <span className={styles.filterOptionShort}>
          {IVA_CONDITION_SHORT_LABELS[condition]}
        </span>{" "}
        {IVA_CONDITION_LABELS[condition]}
      </>
    ),
  })),
];

const PAYMENT_FILTER_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "al-dia", label: "Al día" },
  { value: "adeuda", label: "Adeuda" },
];

const SORT_OPTIONS = [
  { value: "az", label: "Orden A-Z" },
  { value: "za", label: "Orden Z-A" },
];

export function ClientsPageIntro({
  query,
  identificationFilter,
  ivaFilter,
  paymentFilter,
  sortOrder,
  onQueryChange,
  onIdentificationFilterChange,
  onIvaFilterChange,
  onPaymentFilterChange,
  onSortOrderChange,
  onCreateClick,
}: ClientsPageIntroProps) {
  return (
    <section className={styles.sectionIntro} aria-label="Gestión de clientes">
      <div className={styles.filtersRow}>
          {onCreateClick ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={onCreateClick}
            >
              <Plus strokeWidth={ICON_STROKE} aria-hidden />
              Nuevo cliente
            </button>
          ) : null}
          <div className={styles.filterSelect}>
            <CustomSelect
              value={sortOrder}
              onChange={(next) => onSortOrderChange(next as ClientSortOrder)}
              ariaLabel="Ordenar clientes"
              options={SORT_OPTIONS}
            />
          </div>
          <div className={styles.filterSelect}>
            <CustomSelect
              value={identificationFilter}
              onChange={onIdentificationFilterChange}
              ariaLabel="Filtrar por tipo de identificación"
              options={IDENTIFICATION_FILTER_OPTIONS}
            />
          </div>
          <div className={styles.filterSelect}>
            <CustomSelect
              value={ivaFilter}
              onChange={onIvaFilterChange}
              ariaLabel="Filtrar por condición de IVA"
              options={IVA_FILTER_OPTIONS}
            />
          </div>
          <div className={styles.filterSelect}>
            <CustomSelect
              value={paymentFilter}
              onChange={onPaymentFilterChange}
              ariaLabel="Filtrar por estado de pago"
              options={PAYMENT_FILTER_OPTIONS}
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
              placeholder="Buscar por nombre, código, CUIT o DNI…"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              aria-label="Buscar clientes"
            />
          </div>
      </div>
    </section>
  );
}
