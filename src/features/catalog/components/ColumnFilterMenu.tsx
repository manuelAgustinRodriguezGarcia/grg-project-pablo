"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { EllipsisVertical, ICON_STROKE } from "@/shared/icons";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import type {
  ColumnFilterInput,
  ColumnFilterOperator,
} from "@/server/filters/column-filter.types";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const FILTER_DEBOUNCE_MS = 2500;

type ColumnFilterMenuProps = {
  column: ColumnListItem;
  activeFilter?: ColumnFilterInput;
  onFilterChange: (filter: ColumnFilterInput | null) => void;
};

function defaultOperator(column: ColumnListItem): ColumnFilterOperator {
  return column.dataType === "NUMBER" ? "equals" : "contains";
}

function formatColumnFilterPlaceholder(displayName: string): string {
  const label = displayName
    .replace(/\r\n/g, "\n")
    .replace(/[[\]]/g, " ")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es-AR");

  return `Filtrar ${label}…`;
}

function filtersAreEqual(
  left: ColumnFilterInput | null | undefined,
  right: ColumnFilterInput | null,
): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.columnInternalKey === right.columnInternalKey &&
    left.operator === right.operator &&
    left.value === right.value
  );
}

export function ColumnFilterMenu({
  column,
  activeFilter,
  onFilterChange,
}: ColumnFilterMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(activeFilter?.value ?? "");
  const [draftOperator, setDraftOperator] = useState<ColumnFilterOperator>(
    activeFilter?.operator ?? defaultOperator(column),
  );

  const hasActiveFilter = Boolean(activeFilter?.value);

  const buildFilterFromDraft = useCallback((): ColumnFilterInput | null => {
    const trimmedValue = draftValue.trim();

    if (!trimmedValue) {
      return null;
    }

    return {
      columnInternalKey: column.internalKey,
      operator: draftOperator,
      value: trimmedValue,
    };
  }, [column.internalKey, draftOperator, draftValue]);

  const commitFilter = useCallback(() => {
    const nextFilter = buildFilterFromDraft();

    if (filtersAreEqual(activeFilter, nextFilter)) {
      return;
    }

    onFilterChange(nextFilter);
  }, [activeFilter, buildFilterFromDraft, onFilterChange]);

  const clearDebounce = useCallback(() => {
    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  const scheduleDebouncedCommit = useCallback(() => {
    clearDebounce();
    debounceTimeoutRef.current = window.setTimeout(() => {
      debounceTimeoutRef.current = null;
      commitFilter();
    }, FILTER_DEBOUNCE_MS);
  }, [clearDebounce, commitFilter]);

  useEffect(() => {
    if (!isOpen) {
      setDraftValue(activeFilter?.value ?? "");
      setDraftOperator(activeFilter?.operator ?? defaultOperator(column));
    }
  }, [activeFilter, column, isOpen]);

  useEffect(() => {
    if (!activeFilter?.value) {
      setDraftValue("");
      setDraftOperator(defaultOperator(column));
    }
  }, [activeFilter?.value, column]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    scheduleDebouncedCommit();

    return () => {
      clearDebounce();
    };
  }, [clearDebounce, draftOperator, draftValue, scheduleDebouncedCommit]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    clearDebounce();
    commitFilter();
  }, [clearDebounce, commitFilter, isOpen]);

  useEffect(
    () => () => {
      clearDebounce();
    },
    [clearDebounce],
  );

  return (
    <div
      ref={rootRef}
      className={`${styles.columnFilterRoot} ${hasActiveFilter ? styles.columnFilterRootActive : ""} ${isOpen ? styles.columnFilterRootOpen : ""}`}
    >
      <button
        type="button"
        className={styles.columnFilterButton}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={`Filtrar columna ${column.displayName}`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <EllipsisVertical strokeWidth={ICON_STROKE} aria-hidden />
      </button>

      {isOpen ? (
        <div
          id={menuId}
          className={styles.columnFilterPopover}
          role="dialog"
          aria-label={`Filtro de ${column.displayName}`}
        >
          {column.dataType === "NUMBER" ? (
            <div className={styles.columnFilterOperatorRow}>
              <button
                type="button"
                className={`${styles.columnFilterOperatorButton} ${
                  draftOperator === "contains" ? styles.columnFilterOperatorButtonActive : ""
                }`}
                onClick={() => setDraftOperator("contains")}
              >
                Contiene
              </button>
              <button
                type="button"
                className={`${styles.columnFilterOperatorButton} ${
                  draftOperator === "equals" ? styles.columnFilterOperatorButtonActive : ""
                }`}
                onClick={() => setDraftOperator("equals")}
              >
                Igual a
              </button>
            </div>
          ) : null}

          <input
            type="text"
            className={styles.columnFilterInput}
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                clearDebounce();
                commitFilter();
              }
            }}
            placeholder={formatColumnFilterPlaceholder(column.displayName)}
            autoFocus
            aria-label={`Valor de filtro para ${column.displayName}`}
          />
        </div>
      ) : null}
    </div>
  );
}
