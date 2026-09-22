"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  buildPickerHighlightItems,
  initialPickerHighlightIndex,
  resolvePickerHighlightMove,
  scrollInvoiceFocusIntoView,
  scrollOverflowItemIntoView,
  shouldLeaveEmptyPicker,
  type PickerArrowKey,
  type PickerLeadingHighlight,
} from "@/features/billing/utils/invoice-keyboard-flow";
import { Plus, Search, ICON_STROKE } from "@/shared/icons";
import styles from "@/features/billing/styles/NewInvoice.module.scss";

export type InvoicePickerOption = {
  id: string;
  title: string;
  subtitle?: string;
  amount?: string;
  badge?: string;
};

export type InvoicePickerLeadingAction = {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
};

type InvoiceSearchPickerProps = {
  inputId: string;
  placeholder: string;
  query: string;
  options: InvoicePickerOption[];
  emptyText: string;
  disabled?: boolean;
  autoFocus?: boolean;
  leadingAction?: InvoicePickerLeadingAction;
  secondaryLeadingAction?: InvoicePickerLeadingAction;
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
  onLeaveEmpty?: () => void;
  onDeleteKey?: () => void;
};

function LeadingActionButton({
  action,
  className,
  highlighted,
  onPicked,
}: {
  action: InvoicePickerLeadingAction;
  className: string;
  highlighted: boolean;
  onPicked: () => void;
}) {
  return (
    <button
      type="button"
      className={className}
      data-picker-highlighted={highlighted ? "true" : undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        action.onSelect();
        onPicked();
      }}
    >
      <span className={styles.pickerOptionMain}>
        <span className={styles.pickerCreateLabel}>
          {action.icon ?? <Plus strokeWidth={ICON_STROKE} aria-hidden />}
          {action.label}
        </span>
      </span>
    </button>
  );
}

export function InvoiceSearchPicker({
  inputId,
  placeholder,
  query,
  options,
  emptyText,
  disabled,
  autoFocus,
  leadingAction,
  secondaryLeadingAction,
  onQueryChange,
  onSelect,
  onLeaveEmpty,
  onDeleteKey,
}: InvoiceSearchPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const ignoreNextFocusOpenRef = useRef(Boolean(autoFocus));
  const listId = `${inputId}-listbox`;
  const hasLeading = Boolean(leadingAction);
  const hasSecondary = Boolean(secondaryLeadingAction);
  const hasLeadingRow = hasLeading || hasSecondary;
  const isSplitLeadingRow = hasLeading && hasSecondary;
  const optionIdsKey = options.map((option) => option.id).join("|");
  const highlightItems = buildPickerHighlightItems(
    hasLeading,
    hasSecondary,
    options.map((option) => option.id),
  );
  const highlightResetKey = `${isOpen}|${query}|${optionIdsKey}|${hasLeading}|${hasSecondary}`;
  const [trackedHighlightResetKey, setTrackedHighlightResetKey] =
    useState(highlightResetKey);
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    initialPickerHighlightIndex(highlightItems),
  );
  const [preferredLeading, setPreferredLeading] =
    useState<PickerLeadingHighlight>("leading");

  const resetHighlightIndex = initialPickerHighlightIndex(highlightItems);
  if (trackedHighlightResetKey !== highlightResetKey) {
    setTrackedHighlightResetKey(highlightResetKey);
    setHighlightedIndex(resetHighlightIndex);
  }

  const activeHighlightIndex =
    trackedHighlightResetKey === highlightResetKey
      ? highlightedIndex
      : resetHighlightIndex;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const list = listRef.current;
    const highlighted = list?.querySelector<HTMLElement>(
      "[data-picker-highlighted='true']",
    );
    if (!list || !highlighted) {
      return;
    }

    scrollOverflowItemIntoView(list, highlighted);
  }, [isOpen, activeHighlightIndex]);

  useEffect(() => {
    if (!isOpen || disabled) {
      return;
    }

    const input = document.getElementById(inputId);
    if (!(input instanceof HTMLElement)) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      scrollInvoiceFocusIntoView(input);
    });
    return () => cancelAnimationFrame(frame);
  }, [disabled, inputId, isOpen]);

  function moveHighlight(key: PickerArrowKey) {
    if (highlightItems.length === 0) {
      return;
    }

    const nextIndex = resolvePickerHighlightMove(
      highlightItems,
      activeHighlightIndex,
      key,
      preferredLeading,
    );
    const nextItem = highlightItems[nextIndex];
    if (nextItem?.type === "leading" || nextItem?.type === "secondary") {
      setPreferredLeading(nextItem.type);
    }
    setHighlightedIndex(nextIndex);
  }

  function leaveEmptyPicker(): boolean {
    if (!onLeaveEmpty || !shouldLeaveEmptyPicker(query)) {
      return false;
    }

    setIsOpen(false);
    onLeaveEmpty();
    return true;
  }

  function activateHighlight() {
    const item = highlightItems[activeHighlightIndex];
    if (!item) {
      return;
    }

    switch (item.type) {
      case "leading":
        leadingAction?.onSelect();
        setIsOpen(false);
        return;
      case "secondary":
        secondaryLeadingAction?.onSelect();
        setIsOpen(false);
        return;
      case "option":
        onSelect(item.id);
        setIsOpen(false);
        return;
      default: {
        const exhaustive: never = item;
        return exhaustive;
      }
    }
  }

  const highlightedItem = highlightItems[activeHighlightIndex] ?? null;

  return (
    <div ref={containerRef} className={styles.pickerWrap}>
      <Search
        className={styles.pickerIcon}
        strokeWidth={ICON_STROKE}
        aria-hidden
      />
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        className={styles.pickerInput}
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (ignoreNextFocusOpenRef.current) {
            ignoreNextFocusOpenRef.current = false;
            return;
          }
          setIsOpen(true);
        }}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (
            onDeleteKey &&
            event.key === "Delete" &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            !event.shiftKey &&
            !event.repeat &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            onDeleteKey();
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            if (leaveEmptyPicker()) {
              return;
            }
            setIsOpen(false);
            return;
          }

          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
              return;
            }
            moveHighlight(event.key);
            return;
          }

          if (
            (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
            isOpen &&
            isSplitLeadingRow &&
            (highlightedItem?.type === "leading" ||
              highlightedItem?.type === "secondary")
          ) {
            event.preventDefault();
            moveHighlight(event.key);
            return;
          }

          if (event.key === "Enter" && isOpen) {
            event.preventDefault();
            activateHighlight();
          }
        }}
      />
      {isOpen && !disabled ? (
        <ul
          ref={listRef}
          id={listId}
          className={styles.pickerList}
          role="listbox"
        >
          {hasLeadingRow ? (
            <li
              className={
                isSplitLeadingRow ? styles.pickerLeadingRow : undefined
              }
            >
              {leadingAction ? (
                <LeadingActionButton
                  action={leadingAction}
                  highlighted={highlightedItem?.type === "leading"}
                  className={`${styles.pickerOption} ${styles.pickerCreateOption}${
                    highlightedItem?.type === "leading"
                      ? ` ${styles.pickerOptionActive}`
                      : ""
                  }`}
                  onPicked={() => setIsOpen(false)}
                />
              ) : null}
              {secondaryLeadingAction ? (
                <LeadingActionButton
                  action={secondaryLeadingAction}
                  highlighted={highlightedItem?.type === "secondary"}
                  className={`${styles.pickerOption} ${styles.pickerCreateOption}${
                    highlightedItem?.type === "secondary"
                      ? ` ${styles.pickerOptionActive}`
                      : ""
                  }`}
                  onPicked={() => setIsOpen(false)}
                />
              ) : null}
            </li>
          ) : null}
          {options.length === 0 ? (
            <li className={styles.pickerEmpty}>{emptyText}</li>
          ) : (
            options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  className={`${styles.pickerOption}${
                    highlightedItem?.type === "option" &&
                    highlightedItem.id === option.id
                      ? ` ${styles.pickerOptionActive}`
                      : ""
                  }`}
                  data-picker-highlighted={
                    highlightedItem?.type === "option" &&
                    highlightedItem.id === option.id
                      ? "true"
                      : undefined
                  }
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(option.id);
                    setIsOpen(false);
                  }}
                >
                  <span className={styles.pickerOptionMain}>
                    <span className={styles.pickerOptionTitleRow}>
                      <span className={styles.pickerOptionTitle}>
                        {option.title}
                      </span>
                      {option.amount ? (
                        <>
                          <span
                            className={styles.pickerOptionSeparator}
                            aria-hidden
                          >
                            |
                          </span>
                          <span className={styles.pickerOptionAmount}>
                            Monto: {option.amount}
                          </span>
                        </>
                      ) : null}
                    </span>
                    {option.subtitle ? (
                      <span className={styles.pickerOptionSubtitle}>
                        {option.subtitle}
                      </span>
                    ) : null}
                  </span>
                  {option.badge ? (
                    <span
                      className={
                        option.badge === "A"
                          ? `${styles.pickerOptionBadge} ${styles.pickerOptionBadgeA}`
                          : styles.pickerOptionBadge
                      }
                    >
                      {option.badge}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
