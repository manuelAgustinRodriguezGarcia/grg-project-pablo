"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { adminQueryKeys } from "@/features/admin/query-keys";
import { PriceCellValue } from "@/features/prices/components/PriceCellValue";
import type {
  PriceGlobalSearchResponse,
  PriceItemTableColumn,
  PriceItemTableRow,
} from "@/features/prices/types/price-item-table.types";
import { sortPriceColumnsByConfiguredOrder } from "@/features/prices/utils/price-table-columns";
import { MIN_GLOBAL_QUERY_CHARS } from "@/server/search/search-query-plan";
import { ICON_STROKE, Search, X } from "@/shared/icons";
import catalogStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";
import styles from "@/features/prices/styles/PriceNavigator.module.scss";

const SEARCH_DEBOUNCE_MS = 300;

export type PriceGlobalSearchHit = {
  priceListId: string;
  item: PriceItemTableRow;
  query: string;
};

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

function formatMatchCount(total: number): string {
  return total === 1 ? "1 coincidencia" : `${total.toLocaleString("es-AR")} coincidencias`;
}

type PriceGlobalSearchProps = {
  onSelectHit: (hit: PriceGlobalSearchHit) => void;
  disabled?: boolean;
};

export function PriceGlobalSearch({ onSelectHit, disabled = false }: PriceGlobalSearchProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const canQuery = debouncedQuery.length >= MIN_GLOBAL_QUERY_CHARS;

  const searchQuery = useQuery({
    queryKey: adminQueryKeys.priceGlobalSearch(debouncedQuery),
    queryFn: async ({ signal }): Promise<PriceGlobalSearchResponse> => {
      const params = new URLSearchParams({ q: debouncedQuery });
      const response = await fetch(`/api/admin/price-lists/search?${params.toString()}`, {
        signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "No se pudo completar la búsqueda.");
      }

      return (await response.json()) as PriceGlobalSearchResponse;
    },
    enabled: canQuery,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

  const trimmedInput = searchInput.trim();
  const isPending =
    trimmedInput.length >= MIN_GLOBAL_QUERY_CHARS &&
    (trimmedInput !== debouncedQuery ||
      searchQuery.isFetching ||
      searchQuery.data?.query !== debouncedQuery);
  const error =
    canQuery && !isPending && searchQuery.error instanceof Error
      ? searchQuery.error.message
      : null;

  const groups = useMemo(() => {
    if (!canQuery || isPending || !searchQuery.data) {
      return [];
    }

    return searchQuery.data.groups.map((group) => {
      const orderById = new Map(group.columns.map((column) => [column.id, column.order]));
      return {
        ...group,
        columns: sortPriceColumnsByConfiguredOrder(group.columns, orderById),
      };
    });
  }, [canQuery, isPending, searchQuery.data]);

  const options = useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({ priceListId: group.priceList.id, item })),
      ),
    [groups],
  );

  const showDropdown = isFocused && trimmedInput.length > 0 && !disabled;

  useEffect(() => {
    setActiveIndex(-1);
  }, [debouncedQuery, isPending, searchQuery.data]);

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
    setDebouncedQuery("");
    setActiveIndex(-1);
  }

  function selectOption(priceListId: string, item: PriceItemTableRow) {
    onSelectHit({ priceListId, item, query: debouncedQuery });
    clearSearch();
    setIsFocused(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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

    if (!showDropdown || options.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current < options.length - 1 ? current + 1 : 0));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? options.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) {
        selectOption(option.priceListId, option.item);
      }
    }
  }

  const activeOptionId =
    showDropdown && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const renderBody = () => {
    if (trimmedInput.length < MIN_GLOBAL_QUERY_CHARS) {
      return (
        <p className={catalogStyles.globalSearchDropdownHint}>
          Escriba al menos {MIN_GLOBAL_QUERY_CHARS} caracteres para buscar.
        </p>
      );
    }

    if (isPending) {
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

    if (error) {
      return (
        <p className={catalogStyles.globalSearchDropdownHint} role="alert">
          {error}
        </p>
      );
    }

    if (groups.length === 0) {
      return (
        <p className={catalogStyles.globalSearchDropdownHint} role="status">
          Sin coincidencias en las listas de precios.
        </p>
      );
    }

    let optionIndex = -1;

    return groups.map((group) => (
      <section
        key={group.priceList.id}
        className={styles.searchResultsGroup}
        aria-label={group.priceList.name}
      >
        <p className={styles.searchResultsGroupHeading}>
          <span className={styles.searchResultsGroupName}>{group.priceList.name}</span>
          <span className={styles.searchResultsGroupCount}>{formatMatchCount(group.total)}</span>
        </p>
        <div className={styles.searchResultsTableWrap}>
          <table className={styles.searchResultsTable}>
            <thead>
              <tr>
                {group.columns.map((column) => (
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
            <tbody>
              {group.items.map((item) => {
                optionIndex += 1;
                const index = optionIndex;
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
                    onClick={() => selectOption(group.priceList.id, item)}
                  >
                    {group.columns.map((column) => (
                      <td key={`${item.id}-${column.id}`} className={styles.searchResultsCell}>
                        <PriceCellValue column={column} value={getCellValue(item, column)} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {group.total > group.items.length ? (
          <p className={styles.searchResultsGroupMore}>
            Mostrando {group.items.length} de {group.total.toLocaleString("es-AR")}. Afine la
            búsqueda para ver el resto.
          </p>
        ) : null}
      </section>
    ));
  };

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
        placeholder="Búsqueda global entre todas las listas de precios…"
        value={searchInput}
        onChange={(event) => {
          setSearchInput(event.target.value);
          setIsFocused(true);
        }}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-label="Búsqueda global en listas de precios"
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
          {renderBody()}
        </div>
      ) : null}
    </div>
  );
}
