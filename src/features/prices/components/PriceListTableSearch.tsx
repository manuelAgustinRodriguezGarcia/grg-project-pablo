"use client";

import { useEffect, useState } from "react";
import { ICON_STROKE, Search, X } from "@/shared/icons";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

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

  useEffect(() => {
    setSearchInput("");
    onSearchSubmit("");
  }, [onSearchSubmit, resetKey]);

  function submitSearch() {
    onSearchSubmit(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    onSearchSubmit("");
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
        onChange={(event) => {
          const nextValue = event.target.value;
          setSearchInput(nextValue);
          if (nextValue === "") {
            onSearchSubmit("");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submitSearch();
          }

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
