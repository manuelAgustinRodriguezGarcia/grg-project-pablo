"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, ICON_STROKE, X } from "@/shared/icons";
import type { PriceColumnListItem } from "@/features/prices/types/price-column.types";
import type {
  ColumnFilterInput,
  ColumnFilterOperator,
} from "@/server/filters/column-filter.types";
import filterStyles from "@/features/catalog/styles/CatalogNavigator.module.scss";

const FILTER_DEBOUNCE_MS = 2500;
const POPOVER_WIDTH_PX = 224;
const POPOVER_TOP_OFFSET_PX = 6;
const POPOVER_START_OFFSET_PX = 8;
const VIEWPORT_PADDING_PX = 8;
const POPOVER_Z_INDEX = 1100;

type PriceColumnFilterMenuProps = {
  column: PriceColumnListItem;
  priceListId: string;
  activeFilter?: ColumnFilterInput;
  onFilterChange?: (filter: ColumnFilterInput | null) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: RefObject<HTMLTableCellElement | null>;
  alignPopover?: "center" | "start";
  isAdmin?: boolean;
  onColumnsChanged?: () => void;
};

function defaultOperator(column: PriceColumnListItem): ColumnFilterOperator {
  return column.dataType === "NUMBER" || column.isPrice ? "equals" : "contains";
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

function getPopoverPosition(
  anchor: HTMLTableCellElement,
  alignPopover: "center" | "start",
): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const popoverWidth = Math.min(POPOVER_WIDTH_PX, window.innerWidth * 0.7);

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
    top: rect.bottom + POPOVER_TOP_OFFSET_PX,
    left,
    width: popoverWidth,
    zIndex: POPOVER_Z_INDEX,
  };
}

export function PriceColumnFilterMenu({
  column,
  priceListId,
  activeFilter,
  onFilterChange,
  isOpen,
  onOpenChange,
  anchorRef,
  alignPopover = "center",
  isAdmin = false,
  onColumnsChanged,
}: PriceColumnFilterMenuProps) {
  const menuId = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const wasOpenRef = useRef(false);
  const externalClearRef = useRef(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({
    visibility: "hidden",
  });

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

  const closeMenu = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

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

    onFilterChange?.(nextFilter);
  }, [activeFilter, column, draftOperator, draftValue, onFilterChange]);

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
    if (!isOpen) {
      return;
    }

    updatePopoverPosition();
  }, [isOpen, updatePopoverPosition]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        popoverRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }

      closeMenu();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
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
  }, [anchorRef, closeMenu, isOpen, updatePopoverPosition]);

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

  const handleToggleVisibility = useCallback(async () => {
    if (isTogglingVisibility) {
      return;
    }

    setIsTogglingVisibility(true);
    try {
      const response = await fetch(`/api/admin/price-lists/${priceListId}/columns`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: column.id,
          visibleToNormalUser: !column.visibleToNormalUser,
        }),
      });

      if (response.ok) {
        closeMenu();
        onColumnsChanged?.();
      }
    } finally {
      setIsTogglingVisibility(false);
    }
  }, [
    closeMenu,
    column.id,
    column.visibleToNormalUser,
    isTogglingVisibility,
    onColumnsChanged,
    priceListId,
  ]);

  const showNumberOperators = column.dataType === "NUMBER" || column.isPrice;

  const popover =
    isOpen && typeof document !== "undefined" ? (
      <div
        ref={popoverRef}
        id={menuId}
        className={filterStyles.columnFilterPopover}
        style={popoverStyle}
        role="dialog"
        aria-label={`Filtro de ${column.displayName}`}
      >
        <div className={filterStyles.columnFilterPopoverHeader}>
          <span className={filterStyles.columnFilterPopoverTitle}>Filtrar columna</span>
          <button
            type="button"
            className={filterStyles.columnFilterPopoverClose}
            aria-label="Cerrar filtro"
            onClick={closeMenu}
          >
            <X strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>

        {showNumberOperators ? (
          <div className={filterStyles.columnFilterOperatorRow}>
            <button
              type="button"
              className={`${filterStyles.columnFilterOperatorButton} ${
                draftOperator === "contains"
                  ? filterStyles.columnFilterOperatorButtonActive
                  : ""
              }`}
              onClick={() => setDraftOperator("contains")}
            >
              Contiene
            </button>
            <button
              type="button"
              className={`${filterStyles.columnFilterOperatorButton} ${
                draftOperator === "equals"
                  ? filterStyles.columnFilterOperatorButtonActive
                  : ""
              }`}
              onClick={() => setDraftOperator("equals")}
            >
              Igual a
            </button>
          </div>
        ) : null}

        <input
          type="text"
          className={filterStyles.columnFilterInput}
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
          <div className={filterStyles.columnMenuActions}>
            <button
              type="button"
              className={filterStyles.columnMenuAction}
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
    ) : null;

  return popover ? createPortal(popover, document.body) : null;
}
