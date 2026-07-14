"use client";

import { useEffect, useRef, useState } from "react";
import { ICON_STROKE, Search, X } from "@/shared/icons";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

const SEARCH_DEBOUNCE_MS = 300;

type PriceListTableSearchProps = {
  listName: string;
  onSearchSubmit: (value: string) => void;
  resetKey?: string;
  disabled?: boolean;
};

export function PriceListTableSearch({
  listName,
  onSearchSubmit,
  resetKey = "",
  disabled = false,
}: PriceListTableSearchProps) {
  const [searchInput, setSearchInput] = useState("");
  const skipDebounceRef = useRef(false);

  useEffect(() => {
    skipDebounceRef.current = true;
    setSearchInput("");
    onSearchSubmit("");
    // Re-seed only when the parent bumps resetKey (list change).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- paired with resetKey
  }, [resetKey]);

  useEffect(() => {
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      onSearchSubmit(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [onSearchSubmit, searchInput]);

  function clearSearch() {
    setSearchInput("");
  }

  return (
    <div className={styles.listSearchWrap}>
      <Search
        className={styles.listSearchIcon}
        strokeWidth={ICON_STROKE}
        aria-hidden
      />
      <input
        type="search"
        className={`${styles.listSearch} ${searchInput ? styles.listSearchWithClear : ""}`}
        placeholder={`Búsqueda en ${listName}`}
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            clearSearch();
          }
        }}
        disabled={disabled}
        aria-label={`Búsqueda en ${listName}`}
      />
      {searchInput ? (
        <button
          type="button"
          className={styles.listSearchClear}
          onClick={clearSearch}
          aria-label="Limpiar búsqueda"
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
