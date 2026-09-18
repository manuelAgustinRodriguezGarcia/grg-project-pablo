"use client";

import { useEffect, useRef, useState } from "react";
import { ICON_STROKE, Search, X } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const SEARCH_DEBOUNCE_MS = 300;

type FolderTableSearchProps = {
  folderName: string;
  onDebouncedSearchChange: (value: string) => void;
  resetKey?: number;
  seedValue?: string;
  disabled?: boolean;
};

export function FolderTableSearch({
  folderName,
  onDebouncedSearchChange,
  resetKey = 0,
  seedValue = "",
  disabled = false,
}: FolderTableSearchProps) {
  const [searchInput, setSearchInput] = useState(seedValue);
  const skipDebounceRef = useRef(false);

  useEffect(() => {
    skipDebounceRef.current = true;
    setSearchInput(seedValue);
    onDebouncedSearchChange(seedValue.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seedValue is paired with resetKey
  }, [resetKey]);

  useEffect(() => {
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      return;
    }

    if (!searchInput.trim()) {
      onDebouncedSearchChange("");
      return;
    }

    const timeout = window.setTimeout(() => {
      onDebouncedSearchChange(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [onDebouncedSearchChange, searchInput]);

  const clearSearch = () => {
    skipDebounceRef.current = true;
    setSearchInput("");
    onDebouncedSearchChange("");
  };

  return (
    <div className={styles.folderSearchWrap}>
      <Search
        className={styles.folderSearchIcon}
        strokeWidth={ICON_STROKE}
        aria-hidden
      />
      <input
        type="search"
        className={`${styles.folderSearch} ${searchInput ? styles.folderSearchWithClear : ""}`}
        placeholder={`Búsqueda interna en ${folderName}`}
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            clearSearch();
          }
        }}
        disabled={disabled}
        aria-label={`Búsqueda interna en ${folderName}`}
      />
      {searchInput ? (
        <button
          type="button"
          className={styles.folderSearchClear}
          onClick={clearSearch}
          aria-label="Limpiar búsqueda interna"
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
