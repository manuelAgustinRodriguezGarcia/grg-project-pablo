"use client";

import { useEffect, useState } from "react";
import { ICON_STROKE, Search, X } from "@/shared/icons";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const SEARCH_DEBOUNCE_MS = 300;

type FolderTableSearchProps = {
  folderName: string;
  onDebouncedSearchChange: (value: string) => void;
  resetKey?: number;
  disabled?: boolean;
};

export function FolderTableSearch({
  folderName,
  onDebouncedSearchChange,
  resetKey = 0,
  disabled = false,
}: FolderTableSearchProps) {
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    setSearchInput("");
  }, [resetKey]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      onDebouncedSearchChange(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [onDebouncedSearchChange, searchInput]);

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
            setSearchInput("");
          }
        }}
        disabled={disabled}
        aria-label={`Búsqueda interna en ${folderName}`}
      />
      {searchInput ? (
        <button
          type="button"
          className={styles.folderSearchClear}
          onClick={() => setSearchInput("")}
          aria-label="Limpiar búsqueda interna"
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
