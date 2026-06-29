"use client";

import { Search, X, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PricePageChromeProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  searchDisabled?: boolean;
};

export function PricePageChrome({
  searchQuery,
  onSearchChange,
  onSearchClear,
  searchDisabled = false,
}: PricePageChromeProps) {
  return (
    <section className={styles.sectionIntro} aria-label="Precios">
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>Precios</h1>
        <div className={styles.headerSearchWrap}>
          <Search
            className={styles.headerSearchIcon}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
          <input
            type="search"
            className={styles.headerSearch}
            placeholder="Buscar por código, descripción o columna indexada…"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onSearchClear();
              }
            }}
            disabled={searchDisabled}
            aria-label="Búsqueda en lista activa"
          />
          {searchQuery ? (
            <button
              type="button"
              className={styles.headerSearchClear}
              onClick={onSearchClear}
              aria-label="Limpiar búsqueda"
            >
              <X strokeWidth={ICON_STROKE} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
