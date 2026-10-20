"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PriceCellValue } from "@/features/prices/components/PriceCellValue";
import type {
  PriceItemTableColumn,
  PriceItemTableRow,
} from "@/features/prices/types/price-item-table.types";
import { sortPriceColumnsByConfiguredOrder } from "@/features/prices/utils/price-table-columns";
import { MIN_GLOBAL_QUERY_CHARS } from "@/server/search/search-query-plan";
import { ICON_STROKE, Search, X } from "@/shared/icons";
import catalogStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

const SEARCH_DEBOUNCE_MS = 300;
const DROPDOWN_RESULT_LIMIT = 12;

function toSearchQuery(value: string): string {
  const trimmed = value.trim();
  return trimmed.length >= MIN_GLOBAL_QUERY_CHARS ? trimmed : "";
}

function formatHeaderLines(displayName: string): string[] {
  const normalized = displayName.replace(/\r\n/g, "\n").trim();
  if (!normalized.includes("\n")) {
    return [normalized];
  }

  return normalized
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
}

function getCellValue(item: PriceItemTableRow, column: PriceItemTableColumn): unknown {
  if (column.isPrimaryCode) {
    return item.primaryCode;
  }

  if (column.isDescription) {
    return item.description;
  }

  if (column.isPrice) {
    return item.amount;
  }

  return item.dynamicData[column.internalKey];
}

type PriceListTableSearchProps = {
  listName: string;
  committedQuery: string;
  columns: PriceItemTableColumn[];
  items: PriceItemTableRow[];
  total: number;
  isLoading: boolean;
  error: string | null;
  onSearchSubmit: (value: string) => void;
  onActivateItem: (itemId: string) => void;
  onPendingChange?: (isPending: boolean) => void;
  resetKey?: string;
  disabled?: boolean;
};

export function PriceListTableSearch({
  listName,
  committedQuery,
  columns,
  items,
  total,
  isLoading,
  error,
  onSearchSubmit,
  onActivateItem,
  onPendingChange,
  resetKey = "",
  disabled = false,
}: PriceListTableSearchProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const skipDebounceRef = useRef(false);

  const sortedColumns = useMemo(() => {
    const orderById = new Map(columns.map((column) => [column.id, column.order]));
    return sortPriceColumnsByConfiguredOrder(columns, orderById);
  }, [columns]);

  const visibleItems = useMemo(() => items.slice(0, DROPDOWN_RESULT_LIMIT), [items]);

  useEffect(() => {
    skipDebounceRef.current = true;
    setSearchInput("");
    setActiveIndex(-1);
    setIsFocused(false);
    onSearchSubmit("");
  }, [onSearchSubmit, resetKey]);

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

  const trimmedInput = searchInput.trim();
  const showDropdown = isFocused && trimmedInput.length > 0 && !disabled;
  const showResults = trimmedInput.length >= MIN_GLOBAL_QUERY_CHARS;

  useEffect(() => {
    setActiveIndex(-1);
  }, [committedQuery, isLoading, items]);

  useEffect(() => {
    if (!showDropdown) {
      return;
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showDropdown]);

  function clearSearch() {
    setSearchInput("");
    setActiveIndex(-1);
  }

  function activateItem(itemId: string) {
    onActivateItem(itemId);
    setIsFocused(false);
    setActiveIndex(-1);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (showDropdown) {
        event.preventDefault();
        setIsFocused(false);
        setActiveIndex(-1);
        return;
      }

      clearSearch();
      return;
    }

    if (!showDropdown || !showResults || visibleItems.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current < visibleItems.length - 1 ? current + 1 : 0));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? visibleItems.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const item = visibleItems[activeIndex];
      if (item) {
        activateItem(item.id);
      }
    }
  }

  const activeOptionId =
    showDropdown && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const resultBody = (() => {
    if (!showResults) {
      return (
        <p className={catalogStyles.globalSearchDropdownHint}>
          Escriba al menos {MIN_GLOBAL_QUERY_CHARS} caracteres para buscar.
        </p>
      );
    }

    if (sortedColumns.length === 0) {
      if (isLoading) {
        return (
          <div
            className={catalogStyles.globalSearchDropdownLoading}
            role="status"
            aria-label="Buscando coincidencias"
          >
            <span className={catalogStyles.globalSearchDropdownSpinner} aria-hidden />
            <p className={catalogStyles.globalSearchDropdownHint}>Buscando coincidencias…</p>
          </div>
        );
      }

      return (
        <p className={catalogStyles.globalSearchDropdownHint} role={error ? "alert" : "status"}>
          {error ?? "Sin coincidencias."}
        </p>
      );
    }

    return (
      <>
        <table className={styles.searchResultsTable}>
          <thead>
            <tr>
              {sortedColumns.map((column) => (
                <th key={column.id} scope="col" className={styles.searchResultsHead}>
                  {formatHeaderLines(column.displayName).map((line) => (
                    <span key={line} className={styles.searchResultsHeadLine}>
                      {line}
                    </span>
                  ))}
                </th>
              ))}
            </tr>
          </thead>
          {isLoading || error ? null : (
            <tbody>
              {visibleItems.length === 0 ? (
                <tr>
                  <td className={styles.searchResultsEmpty} colSpan={sortedColumns.length}>
                    Sin coincidencias.
                  </td>
                </tr>
              ) : (
                visibleItems.map((item, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <tr
                      key={item.id}
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={isActive}
                      className={`${styles.searchResultsRow} ${isActive ? styles.searchResultsRowActive : ""}`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => activateItem(item.id)}
                    >
                      {sortedColumns.map((column) => (
                        <td key={`${item.id}-${column.id}`} className={styles.searchResultsCell}>
                          <PriceCellValue column={column} value={getCellValue(item, column)} />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          )}
        </table>
        {isLoading ? (
          <div
            className={catalogStyles.globalSearchDropdownLoading}
            role="status"
            aria-label="Buscando coincidencias"
          >
            <span className={catalogStyles.globalSearchDropdownSpinner} aria-hidden />
            <p className={catalogStyles.globalSearchDropdownHint}>Buscando coincidencias…</p>
          </div>
        ) : null}
        {error ? (
          <p className={catalogStyles.globalSearchDropdownHint} role="alert">
            {error}
          </p>
        ) : null}
        {!isLoading && !error && visibleItems.length > 0 && total > visibleItems.length ? (
          <p className={catalogStyles.globalSearchDropdownHint}>
            {total.toLocaleString("es-AR")} coincidencias. La tabla de abajo muestra el resto.
          </p>
        ) : null}
      </>
    );
  })();

  return (
    <div ref={rootRef} className={catalogStyles.headerSearchWrap}>
      <Search
        className={catalogStyles.headerSearchIcon}
        strokeWidth={ICON_STROKE}
        aria-hidden
      />
      <input
        type="search"
        className={`${catalogStyles.headerSearch} ${searchInput ? catalogStyles.headerSearchWithClear : ""}`}
        placeholder="Buscar por código, equivalencias u otros datos..."
        value={searchInput}
        onChange={(event) => {
          setSearchInput(event.target.value);
          setIsFocused(true);
        }}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleSearchKeyDown}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-label={`Buscar por código, equivalencias u otros datos en ${listName}`}
      />
      {searchInput ? (
        <button
          type="button"
          className={catalogStyles.headerSearchClear}
          onClick={clearSearch}
          aria-label="Limpiar búsqueda"
        >
          <X strokeWidth={ICON_STROKE} aria-hidden />
        </button>
      ) : null}
      {showDropdown ? (
        <div id={listboxId} className={styles.searchResults} role="listbox">
          {resultBody}
        </div>
      ) : null}
    </div>
  );
}
