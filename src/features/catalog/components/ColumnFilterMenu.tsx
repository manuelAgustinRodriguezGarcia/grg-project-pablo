"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff, EllipsisVertical, ICON_STROKE, Pencil } from "@/shared/icons";
import { ColumnEditModal } from "@/features/catalog/components/ColumnEditModal";
import { setColumnVisibilityAction } from "@/features/catalog/actions/column.actions";
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
  isAdmin?: boolean;
  onColumnsChanged?: () => void;
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

function buildFilterFromDraft(
  columnInternalKey: string,
  draftOperator: ColumnFilterOperator,
  draftValue: string,
): ColumnFilterInput | null {
  const trimmedValue = draftValue.trim();

  if (!trimmedValue) {
    return null;
  }

  return {
    columnInternalKey,
    operator: draftOperator,
    value: trimmedValue,
  };
}

export function ColumnFilterMenu({
  column,
  activeFilter,
  onFilterChange,
  isAdmin = false,
  onColumnsChanged,
}: ColumnFilterMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const wasOpenRef = useRef(false);
  const externalClearRef = useRef(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);

  const isOpen = internalOpen;
  const [draftValue, setDraftValue] = useState(activeFilter?.value ?? "");
  const [draftOperator, setDraftOperator] = useState<ColumnFilterOperator>(
    activeFilter?.operator ?? defaultOperator(column),
  );

  const activeFilterKey = activeFilter
    ? `${activeFilter.operator}:${activeFilter.value}`
    : "";
  const [syncedFilterKey, setSyncedFilterKey] = useState(activeFilterKey);

  if (activeFilterKey !== syncedFilterKey && !isOpen) {
    setSyncedFilterKey(activeFilterKey);
    setDraftValue(activeFilter?.value ?? "");
    setDraftOperator(activeFilter?.operator ?? defaultOperator(column));
    externalClearRef.current = !activeFilter;
  }

  const hasActiveFilter = Boolean(activeFilter?.value);

  const commitFilter = useCallback(() => {
    if (externalClearRef.current) {
      externalClearRef.current = false;
      setDraftValue("");
      setDraftOperator(defaultOperator(column));
      return;
    }

    const nextFilter = buildFilterFromDraft(column.internalKey, draftOperator, draftValue);

    if (filtersAreEqual(activeFilter, nextFilter)) {
      return;
    }

    onFilterChange(nextFilter);
  }, [
    activeFilter,
    column,
    draftOperator,
    draftValue,
    onFilterChange,
  ]);

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
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setInternalOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setInternalOpen(false);
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
    const nextFilter = buildFilterFromDraft(column.internalKey, draftOperator, draftValue);

    if (!isOpen && filtersAreEqual(activeFilter, nextFilter)) {
      clearDebounce();
      return;
    }

    scheduleDebouncedCommit();

    return () => {
      clearDebounce();
    };
  }, [
    activeFilter,
    clearDebounce,
    column.internalKey,
    draftOperator,
    draftValue,
    isOpen,
    scheduleDebouncedCommit,
  ]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      clearDebounce();
      commitFilter();
    }

    wasOpenRef.current = isOpen;
  }, [clearDebounce, commitFilter, isOpen]);

  useEffect(
    () => () => {
      clearDebounce();
    },
    [clearDebounce],
  );

  const handleOpenEdit = useCallback(() => {
    setInternalOpen(false);
    setIsEditModalOpen(true);
  }, []);

  const handleToggleVisibility = useCallback(async () => {
    if (isTogglingVisibility) {
      return;
    }

    setIsTogglingVisibility(true);
    try {
      const result = await setColumnVisibilityAction({
        id: column.id,
        visible: !column.visibleToNormalUser,
      });

      if (result.success) {
        setInternalOpen(false);
        onColumnsChanged?.();
      }
    } finally {
      setIsTogglingVisibility(false);
    }
  }, [column.id, column.visibleToNormalUser, isTogglingVisibility, onColumnsChanged]);

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
        onClick={() => setInternalOpen((open) => !open)}
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

          {isAdmin ? (
            <div className={styles.columnMenuActions}>
              <button
                type="button"
                className={styles.columnMenuAction}
                onClick={handleOpenEdit}
              >
                <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                <span>Editar columna</span>
              </button>
              <button
                type="button"
                className={styles.columnMenuAction}
                onClick={() => void handleToggleVisibility()}
                disabled={isTogglingVisibility}
              >
                {column.visibleToNormalUser ? (
                  <EyeOff strokeWidth={ICON_STROKE} aria-hidden />
                ) : (
                  <Eye strokeWidth={ICON_STROKE} aria-hidden />
                )}
                <span>
                  {column.visibleToNormalUser ? "Ocultar columna" : "Mostrar columna"}
                </span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {isEditModalOpen ? (
        <ColumnEditModal
          column={column}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={() => {
            setIsEditModalOpen(false);
            onColumnsChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}
