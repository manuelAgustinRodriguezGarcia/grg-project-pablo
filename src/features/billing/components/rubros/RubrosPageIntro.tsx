"use client";

import { CustomSelect } from "@/shared/components/CustomSelect";
import { ICON_STROKE, Plus, Search, Tags } from "@/shared/icons";
import styles from "@/features/billing/styles/ClientsManager.module.scss";

export type RubroSortOrder = "name-az" | "name-za" | "code-az" | "code-za";

type RubrosPageIntroProps = {
  query: string;
  statusFilter: string;
  sortOrder: RubroSortOrder;
  onQueryChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onSortOrderChange: (value: RubroSortOrder) => void;
  onCreateClick?: () => void;
};

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "ACTIVE", label: "Activos" },
  { value: "INACTIVE", label: "Inactivos" },
];

const SORT_OPTIONS = [
  { value: "name-az", label: "Nombre A-Z" },
  { value: "name-za", label: "Nombre Z-A" },
  { value: "code-az", label: "Código A-Z" },
  { value: "code-za", label: "Código Z-A" },
];

export function RubrosPageIntro({
  query,
  statusFilter,
  sortOrder,
  onQueryChange,
  onStatusFilterChange,
  onSortOrderChange,
  onCreateClick,
}: RubrosPageIntroProps) {
  return (
    <section className={styles.sectionIntro} aria-label="Gestión de rubros">
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <Tags
            className={styles.sectionTitleIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          Rubros
        </h2>
      </div>
      <div className={styles.filtersRow}>
          {onCreateClick ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={onCreateClick}
            >
              <Plus strokeWidth={ICON_STROKE} aria-hidden />
              Nuevo rubro
            </button>
          ) : null}
          <div className={styles.filterSelect}>
            <CustomSelect
              value={statusFilter}
              onChange={onStatusFilterChange}
              ariaLabel="Filtrar por estado"
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
          <div className={styles.filterSelect}>
            <CustomSelect
              value={sortOrder}
              onChange={(next) => onSortOrderChange(next as RubroSortOrder)}
              ariaLabel="Ordenar rubros"
              options={SORT_OPTIONS}
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
              placeholder="Buscar por nombre o código…"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              aria-label="Buscar rubros"
            />
          </div>
      </div>
    </section>
  );
}
