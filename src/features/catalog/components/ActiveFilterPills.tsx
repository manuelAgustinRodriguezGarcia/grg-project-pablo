"use client";

import { ICON_STROKE, X } from "@/shared/icons";
import type { ActiveFilterPill } from "@/server/filters/column-filter.types";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

type ActiveFilterPillsProps = {
  filters: ActiveFilterPill[];
  onRemove: (columnInternalKey: string) => void;
  onClearAll?: () => void;
};

export function ActiveFilterPills({
  filters,
  onRemove,
  onClearAll,
}: ActiveFilterPillsProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className={styles.activeFiltersBar} aria-label="Filtros activos">
      <span className={styles.activeFiltersLabel}>Filtrando por:</span>
      <ul className={styles.activeFiltersList}>
        {filters.map((filter) => (
          <li key={filter.id}>
            <span className={styles.activeFilterPill}>
              <span className={styles.activeFilterPillText}>{filter.label}</span>
              <button
                type="button"
                className={styles.activeFilterPillRemove}
                aria-label={`Quitar filtro ${filter.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(filter.columnInternalKey);
                }}
              >
                <X strokeWidth={ICON_STROKE} aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {onClearAll ? (
        <button
          type="button"
          className={styles.activeFiltersClearAll}
          onClick={onClearAll}
        >
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}
