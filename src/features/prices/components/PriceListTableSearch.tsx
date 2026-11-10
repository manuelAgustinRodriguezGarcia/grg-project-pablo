"use client";

import { ICON_STROKE, Search, X } from "@/shared/icons";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

type PriceListTableSearchProps = {
  listName: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  disabled?: boolean;
};

export function PriceListTableSearch({
  listName,
  value,
  onChange,
  onClear,
  disabled = false,
}: PriceListTableSearchProps) {
  return (
    <div className={styles.listSearchWrap}>
      <Search className={styles.listSearchIcon} strokeWidth={ICON_STROKE} aria-hidden />
      <input
        type="search"
        className={`${styles.listSearch} ${value ? styles.listSearchWithClear : ""}`}
        placeholder="Buscar por código, equivalencias u otros datos..."
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onClear();
          }
        }}
        disabled={disabled}
        aria-label={`Buscar por código, equivalencias u otros datos en ${listName}`}
      />
      {value ? (
        <button
          type="button"
          className={styles.listSearchClear}
          onClick={onClear}
          aria-label="Limpiar búsqueda"
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
