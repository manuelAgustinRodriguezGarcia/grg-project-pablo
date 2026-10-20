"use client";

import { useEffect, useRef, useState } from "react";
import { MIN_GLOBAL_QUERY_CHARS } from "@/server/search/search-query-plan";
import { ICON_STROKE, Search, X } from "@/shared/icons";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

const SEARCH_DEBOUNCE_MS = 300;

function toSearchQuery(value: string): string {
  const trimmed = value.trim();
  return trimmed.length >= MIN_GLOBAL_QUERY_CHARS ? trimmed : "";
}

type PriceListTableSearchProps = {
  listName: string;
  committedQuery: string;
  onSearchSubmit: (value: string) => void;
  onPendingChange?: (isPending: boolean) => void;
  resetKey?: string;
  disabled?: boolean;
};

export function PriceListTableSearch({
  listName,
  committedQuery,
  onSearchSubmit,
  onPendingChange,
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
      onSearchSubmit(toSearchQuery(searchInput));
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [onSearchSubmit, searchInput]);

  useEffect(() => {
    onPendingChange?.(toSearchQuery(searchInput) !== committedQuery);
  }, [committedQuery, onPendingChange, searchInput]);

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
        placeholder="Buscar por código, equivalencias u otros datos..."
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            clearSearch();
          }
        }}
        disabled={disabled}
        aria-label={`Buscar por código, equivalencias u otros datos en ${listName}`}
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
