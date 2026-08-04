"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, ICON_STROKE, Pencil, Search, X } from "@/shared/icons";
import { ColumnEditModal } from "@/features/catalog/components/ColumnEditModal";
import { ProductImagePreviewModal } from "@/features/catalog/components/ProductImagePreviewModal";
import { setColumnVisibilityAction } from "@/features/catalog/actions/column.actions";
import type { ColumnListItem } from "@/features/catalog/types/column.types";
import {
  buildBetweenFilterValue,
  isPureNumericFilterValue,
  splitBetweenFilterValue,
} from "@/server/filters/column-filter-range";
import type {
  ColumnFilterInput,
  ColumnFilterOperator,
} from "@/server/filters/column-filter.types";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const FILTER_DEBOUNCE_MS = 2500;
const RANGE_INTENT_WAIT_MS = 2000;
const POPOVER_WIDTH_PX = 224;
const POPOVER_TOP_OFFSET_PX = 6;
const POPOVER_START_OFFSET_PX = 8;
const VIEWPORT_PADDING_PX = 8;
const POPOVER_Z_INDEX = 1100;

type ColumnFilterMenuProps = {
  column: ColumnListItem;
  activeFilter?: ColumnFilterInput;
  onFilterChange?: (filter: ColumnFilterInput | null) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: RefObject<HTMLTableCellElement | null>;
  alignPopover?: "center" | "start";
  mode?: "filter" | "visibility-only";
  isAdmin?: boolean;
  onColumnsChanged?: () => void | Promise<void>;
  onBlockHeaderInteractionChange?: (blocked: boolean) => void;
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

  const operator = draftOperator === "between" ? "equals" : draftOperator;

  return {
    columnInternalKey,
    operator,
    value: trimmedValue,
  };
}

function draftsFromActiveFilter(
  column: ColumnListItem,
  activeFilter?: ColumnFilterInput,
): {
  value: string;
  rangeEnd: string;
  operator: ColumnFilterOperator;
} {
  if (!activeFilter) {
    return {
      value: "",
      rangeEnd: "",
      operator: defaultOperator(column),
    };
  }

  if (activeFilter.operator === "between") {
    const split = splitBetweenFilterValue(activeFilter.value);

    return {
      value: split?.from ?? "",
      rangeEnd: split?.to ?? "",
      operator: "equals",
    };
  }

  return {
    value: activeFilter.value,
    rangeEnd: "",
    operator: activeFilter.operator,
  };
}

function getPopoverPosition(
  anchor: HTMLTableCellElement,
  alignPopover: "center" | "start",
): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const popoverWidth = Math.min(POPOVER_WIDTH_PX, window.innerWidth * 0.7);
  const top = rect.bottom + POPOVER_TOP_OFFSET_PX;
  const maxHeight = Math.max(
    160,
    window.innerHeight - top - VIEWPORT_PADDING_PX,
  );

  let left =
    alignPopover === "start"
      ? rect.left + POPOVER_START_OFFSET_PX
      : rect.left + rect.width / 2 - popoverWidth / 2;

  left = Math.max(
    VIEWPORT_PADDING_PX,
    Math.min(left, window.innerWidth - popoverWidth - VIEWPORT_PADDING_PX),
  );

  return {
    position: "fixed",
    top,
    left,
    width: popoverWidth,
    maxHeight,
    zIndex: POPOVER_Z_INDEX,
  };
}

export function ColumnFilterMenu({
  column,
  activeFilter,
  onFilterChange,
  isOpen,
  onOpenChange,
  anchorRef,
  alignPopover = "center",
  mode = "filter",
  isAdmin = false,
  onColumnsChanged,
  onBlockHeaderInteractionChange,
}: ColumnFilterMenuProps) {
  const isVisibilityOnly = mode === "visibility-only";
  const supportsRange = !isVisibilityOnly;
  const menuId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const rangeIntentTimeoutRef = useRef<number | null>(null);
  const rangeEndTypedRef = useRef(false);
  const wasOpenRef = useRef(false);
  const externalClearRef = useRef(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [isHelpImagePreviewOpen, setIsHelpImagePreviewOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({
    visibility: "hidden",
  });
  const [rangeIntentActive, setRangeIntentActive] = useState(false);

  const helpImageUrl = column.helpImagePreviewUrl ?? column.helpImageFullUrl;
  const helpText = column.helpText?.trim() || null;
  const hasColumnDescription =
    column.hasContextualHelp || Boolean(helpText) || Boolean(helpImageUrl);
  const helpPreviewUrl = column.helpImageFullUrl ?? helpImageUrl;

  const initialDrafts = draftsFromActiveFilter(column, activeFilter);
  const [draftValue, setDraftValue] = useState(initialDrafts.value);
  const [draftRangeEnd, setDraftRangeEnd] = useState(initialDrafts.rangeEnd);
  const [draftOperator, setDraftOperator] = useState<ColumnFilterOperator>(
    initialDrafts.operator,
  );

  const activeFilterKey = activeFilter
    ? `${activeFilter.operator}:${activeFilter.value}`
    : "";
  const [syncedFilterKey, setSyncedFilterKey] = useState(activeFilterKey);

  if (activeFilterKey !== syncedFilterKey && !isOpen) {
    const nextDrafts = draftsFromActiveFilter(column, activeFilter);
    setSyncedFilterKey(activeFilterKey);
    setDraftValue(nextDrafts.value);
    setDraftRangeEnd(nextDrafts.rangeEnd);
    setDraftOperator(nextDrafts.operator);
    setRangeIntentActive(false);
    rangeEndTypedRef.current = false;
    externalClearRef.current = !activeFilter;
  }

  const canEditRangeEnd = supportsRange && isPureNumericFilterValue(draftValue);
  const canApplyRange =
    canEditRangeEnd && isPureNumericFilterValue(draftRangeEnd);

  const closeMenu = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const clearDebounce = useCallback(() => {
    if (debounceTimeoutRef.current !== null) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  const clearRangeIntentTimeout = useCallback(() => {
    if (rangeIntentTimeoutRef.current !== null) {
      window.clearTimeout(rangeIntentTimeoutRef.current);
      rangeIntentTimeoutRef.current = null;
    }
  }, []);

  const commitSingleFilter = useCallback(() => {
    if (externalClearRef.current) {
      externalClearRef.current = false;
      setDraftValue("");
      setDraftRangeEnd("");
      setDraftOperator(defaultOperator(column));
      setRangeIntentActive(false);
      rangeEndTypedRef.current = false;
      return;
    }

    // With a range end drafted, never auto-apply a single-value filter
    // (range is applied only via the search button).
    if (draftRangeEnd.trim()) {
      return;
    }

    const nextFilter = buildFilterFromDraft(
      column.internalKey,
      draftOperator,
      draftValue,
    );

    if (filtersAreEqual(activeFilter, nextFilter)) {
      return;
    }

    onFilterChange?.(nextFilter);
  }, [
    activeFilter,
    column,
    draftOperator,
    draftRangeEnd,
    draftValue,
    onFilterChange,
  ]);

  const commitRangeFilter = useCallback(() => {
    if (!canApplyRange) {
      return;
    }

    const rangeValue = buildBetweenFilterValue(draftValue, draftRangeEnd);
    if (!rangeValue) {
      return;
    }

    const nextFilter: ColumnFilterInput = {
      columnInternalKey: column.internalKey,
      operator: "between",
      value: rangeValue,
    };

    clearDebounce();
    clearRangeIntentTimeout();
    // Keep range intent so the single-value debounce cannot overwrite the range.
    setRangeIntentActive(true);
    rangeEndTypedRef.current = true;

    if (filtersAreEqual(activeFilter, nextFilter)) {
      return;
    }

    onFilterChange?.(nextFilter);
  }, [
    activeFilter,
    canApplyRange,
    clearDebounce,
    clearRangeIntentTimeout,
    column.internalKey,
    draftRangeEnd,
    draftValue,
    onFilterChange,
  ]);

  const scheduleDebouncedCommit = useCallback(() => {
    clearDebounce();
    debounceTimeoutRef.current = window.setTimeout(() => {
      debounceTimeoutRef.current = null;
      commitSingleFilter();
    }, FILTER_DEBOUNCE_MS);
  }, [clearDebounce, commitSingleFilter]);

  const scheduleRangeIntentFallback = useCallback(() => {
    clearRangeIntentTimeout();
    rangeIntentTimeoutRef.current = window.setTimeout(() => {
      rangeIntentTimeoutRef.current = null;

      if (rangeEndTypedRef.current) {
        return;
      }

      commitSingleFilter();
    }, RANGE_INTENT_WAIT_MS);
  }, [clearRangeIntentTimeout, commitSingleFilter]);

  const handleRangeInputFocus = useCallback(() => {
    if (!supportsRange) {
      return;
    }

    clearDebounce();
    setRangeIntentActive(true);
    rangeEndTypedRef.current = draftRangeEnd.trim().length > 0;

    if (!rangeEndTypedRef.current) {
      scheduleRangeIntentFallback();
    } else {
      clearRangeIntentTimeout();
    }
  }, [
    clearDebounce,
    clearRangeIntentTimeout,
    draftRangeEnd,
    scheduleRangeIntentFallback,
    supportsRange,
  ]);

  const handleRangeInputChange = useCallback(
    (value: string) => {
      setDraftRangeEnd(value);
      setRangeIntentActive(true);
      rangeEndTypedRef.current = value.trim().length > 0;
      clearDebounce();
      clearRangeIntentTimeout();
    },
    [clearDebounce, clearRangeIntentTimeout],
  );

  const updatePopoverPosition = useCallback(() => {
    const anchor = anchorRef.current;

    if (!anchor) {
      return;
    }

    setPopoverStyle({
      ...getPopoverPosition(anchor, alignPopover),
      visibility: "visible",
    });
  }, [alignPopover, anchorRef]);

  useLayoutEffect(() => {
    if (!isOpen || isEditModalOpen) {
      return;
    }

    updatePopoverPosition();
  }, [hasColumnDescription, isEditModalOpen, isOpen, updatePopoverPosition]);

  useEffect(() => {
    // Solo USUARIO (no admin): ahorrar el click extra en el input.
    if (!isOpen || isEditModalOpen || isVisibilityOnly || isAdmin) {
      return;
    }

    let cancelled = false;

    function focusFilterInput() {
      if (cancelled) {
        return;
      }

      const input = filterInputRef.current;
      if (!input) {
        return;
      }

      if (document.activeElement === input) {
        return;
      }

      input.focus({ preventScroll: true });
    }

    // El click del <th> termina después del layout; hay que enfocar luego,
    // si no el navegador devuelve el foco al header.
    const immediateId = window.setTimeout(focusFilterInput, 0);
    const retryId = window.setTimeout(focusFilterInput, 40);

    return () => {
      cancelled = true;
      window.clearTimeout(immediateId);
      window.clearTimeout(retryId);
    };
  }, [isAdmin, isEditModalOpen, isOpen, isVisibilityOnly]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    setIsHelpImagePreviewOpen(false);
  }, [isOpen]);

  useEffect(() => {
    // While the edit modal is open the popover is hidden, but `isOpen` may still
    // be true briefly — never steal clicks from the modal (e.g. Guardar).
    if (!isOpen || isEditModalOpen) {
      return;
    }

    function handlePointerDown(event: globalThis.MouseEvent) {
      if (isHelpImagePreviewOpen) {
        return;
      }

      const target = event.target as Node;

      if (
        popoverRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }

      closeMenu();
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (isHelpImagePreviewOpen) {
        return;
      }

      closeMenu();
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [
    anchorRef,
    closeMenu,
    isEditModalOpen,
    isHelpImagePreviewOpen,
    isOpen,
    updatePopoverPosition,
  ]);

  useEffect(() => {
    if (isVisibilityOnly) {
      return;
    }

    // While drafting or holding a range end value, suppress single-value debounce.
    if (rangeIntentActive || draftRangeEnd.trim()) {
      clearDebounce();
      return;
    }

    const nextFilter = buildFilterFromDraft(
      column.internalKey,
      draftOperator,
      draftValue,
    );

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
    draftRangeEnd,
    draftValue,
    isOpen,
    isVisibilityOnly,
    rangeIntentActive,
    scheduleDebouncedCommit,
  ]);

  useEffect(() => {
    if (isVisibilityOnly) {
      return;
    }

    if (wasOpenRef.current && !isOpen) {
      clearDebounce();
      clearRangeIntentTimeout();
      // Do not overwrite an applied/pending range with the first input alone.
      if (!draftRangeEnd.trim()) {
        commitSingleFilter();
      }
      setRangeIntentActive(false);
      rangeEndTypedRef.current = false;
    }

    wasOpenRef.current = isOpen;
  }, [
    clearDebounce,
    clearRangeIntentTimeout,
    commitSingleFilter,
    draftRangeEnd,
    isOpen,
    isVisibilityOnly,
  ]);

  useEffect(
    () => () => {
      clearDebounce();
      clearRangeIntentTimeout();
    },
    [clearDebounce, clearRangeIntentTimeout],
  );

  useEffect(() => {
    onBlockHeaderInteractionChange?.(isEditModalOpen);
    return () => {
      onBlockHeaderInteractionChange?.(false);
    };
  }, [isEditModalOpen, onBlockHeaderInteractionChange]);

  useEffect(() => {
    if (isEditModalOpen && isOpen) {
      closeMenu();
    }
  }, [closeMenu, isEditModalOpen, isOpen]);

  const handleOpenEdit = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      // Prevent the click from falling through to the header after the popover
      // unmounts — that was reopening the filter (with autoFocus) under the modal.
      event.preventDefault();
      event.stopPropagation();
      onBlockHeaderInteractionChange?.(true);
      setIsEditModalOpen(true);
      closeMenu();
    },
    [closeMenu, onBlockHeaderInteractionChange],
  );

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
        closeMenu();
        onColumnsChanged?.();
      }
    } finally {
      setIsTogglingVisibility(false);
    }
  }, [closeMenu, column.id, column.visibleToNormalUser, isTogglingVisibility, onColumnsChanged]);

  const popover =
    isOpen && !isEditModalOpen && typeof document !== "undefined" ? (
      <div
        ref={popoverRef}
        id={menuId}
        className={styles.columnFilterPopover}
        style={popoverStyle}
        role="dialog"
        aria-label={
          isVisibilityOnly
            ? `Opciones de ${column.displayName}`
            : `Filtro de ${column.displayName}`
        }
      >
        <div className={styles.columnFilterPopoverHeader}>
          <span className={styles.columnFilterPopoverTitle}>
            {isVisibilityOnly ? "Opciones de columna" : "Filtrar columna"}
          </span>
          <button
            type="button"
            className={styles.columnFilterPopoverClose}
            aria-label={isVisibilityOnly ? "Cerrar menú" : "Cerrar filtro"}
            onClick={closeMenu}
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>

        {!isVisibilityOnly && column.dataType === "NUMBER" ? (
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

        {!isVisibilityOnly ? (
          <input
            ref={filterInputRef}
            type="text"
            className={styles.columnFilterInput}
            value={draftValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              setDraftValue(nextValue);

              if (
                draftRangeEnd &&
                (!nextValue.trim() || !isPureNumericFilterValue(nextValue))
              ) {
                setDraftRangeEnd("");
                rangeEndTypedRef.current = false;
                clearRangeIntentTimeout();
                setRangeIntentActive(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                clearDebounce();
                clearRangeIntentTimeout();

                if (draftRangeEnd.trim()) {
                  if (canApplyRange) {
                    commitRangeFilter();
                  }
                  return;
                }

                commitSingleFilter();
              }
            }}
            placeholder={formatColumnFilterPlaceholder(column.displayName)}
            aria-label={`Valor de filtro para ${column.displayName}`}
          />
        ) : null}

        {supportsRange ? (
          <div className={styles.columnFilterRangeRow}>
            <div className={styles.columnFilterRangeInputWrap}>
              <input
                type="text"
                className={`${styles.columnFilterInput} ${styles.columnFilterRangeInput}`}
                value={draftRangeEnd}
                disabled={!canEditRangeEnd}
                onChange={(event) => handleRangeInputChange(event.target.value)}
                onFocus={handleRangeInputFocus}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canApplyRange) {
                    event.preventDefault();
                    commitRangeFilter();
                  }
                }}
                placeholder="Segundo valor del rango"
                aria-label={`Segundo valor del rango para ${column.displayName}`}
              />
              <button
                type="button"
                className={styles.columnFilterRangeSearchButton}
                aria-label={`Buscar rango en ${column.displayName}`}
                disabled={!canApplyRange}
                onClick={commitRangeFilter}
              >
                <Search strokeWidth={ICON_STROKE} aria-hidden />
              </button>
            </div>
          </div>
        ) : null}

        {isVisibilityOnly || isAdmin ? (
          <div className={styles.columnMenuActions}>
            {!isVisibilityOnly && isAdmin ? (
              <button
                type="button"
                className={styles.columnMenuAction}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={handleOpenEdit}
              >
                <Pencil strokeWidth={ICON_STROKE} aria-hidden />
                <span>Editar columna</span>
              </button>
            ) : null}
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

        {!isVisibilityOnly && hasColumnDescription ? (
          <div className={styles.columnHelpSection}>
            <div className={styles.columnHelpSectionHeader}>
              <span className={styles.columnFilterPopoverTitle}>
                {isAdmin ? "Descripción para usuarios" : "Descripción"}
              </span>
            </div>
            <div className={styles.columnHelpPanel}>
              {helpImageUrl ? (
                <button
                  type="button"
                  className={styles.columnHelpImageButton}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsHelpImagePreviewOpen(true);
                  }}
                  aria-label={
                    column.helpImageAltText?.trim() ||
                    `Ampliar descripción visual de ${column.displayName}`
                  }
                >
                  <img
                    src={helpImageUrl}
                    alt={column.helpImageAltText?.trim() || ""}
                    className={styles.columnHelpImage}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ) : null}
              {helpText ? (
                <p className={styles.columnHelpText}>{helpText}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <>
      {popover ? createPortal(popover, document.body) : null}
      {!isVisibilityOnly && isEditModalOpen ? (
        <ColumnEditModal
          column={column}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={async () => {
            await onColumnsChanged?.();
            setIsEditModalOpen(false);
          }}
          onNativeFilePickerOpen={() => {
            onBlockHeaderInteractionChange?.(true);
          }}
        />
      ) : null}
      {isHelpImagePreviewOpen && helpPreviewUrl ? (
        <ProductImagePreviewModal
          imageUrl={helpPreviewUrl}
          imageAlt={
            column.helpImageAltText?.trim() ||
            `Descripción visual de ${column.displayName}`
          }
          onClose={() => setIsHelpImagePreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
