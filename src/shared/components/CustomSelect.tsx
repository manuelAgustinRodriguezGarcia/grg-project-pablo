"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, ICON_STROKE } from "@/shared/icons";
import styles from "@/shared/components/CustomSelect.module.scss";

export type CustomSelectOption = {
  value: string;
  label: ReactNode;
  triggerLabel?: string;
  searchText?: string;
};

type CustomSelectProps = {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  placeholder?: string;
  searchable?: boolean;
  invalid?: boolean;
  emptyText?: string;
};

function optionSearchText(option: CustomSelectOption): string {
  if (option.searchText) {
    return option.searchText;
  }

  return typeof option.label === "string" ? option.label : option.value;
}

export function CustomSelect({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  id,
  placeholder = "Seleccionar…",
  searchable = false,
  invalid = false,
  emptyText = "No hay opciones con esa búsqueda.",
}: CustomSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const selectedOption = options.find((option) => option.value === value) ?? null;
  const selectedTriggerLabel = selectedOption
    ? selectedOption.triggerLabel ??
      (typeof selectedOption.label === "string"
        ? selectedOption.label
        : optionSearchText(selectedOption))
    : "";

  const filteredOptions = useMemo(() => {
    if (!searchable || !isOpen) {
      return options;
    }

    const normalized = query.trim().toLocaleLowerCase("es-AR");
    if (!normalized) {
      return options;
    }

    return options.filter((option) =>
      optionSearchText(option).toLocaleLowerCase("es-AR").includes(normalized),
    );
  }, [isOpen, options, query, searchable]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function openList() {
    if (disabled) {
      return;
    }

    setQuery("");
    setIsOpen(true);
    setHighlightedIndex(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    if (searchable) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    setQuery("");
    setIsOpen(false);
  }

  function confirmHighlighted() {
    const option = filteredOptions[highlightedIndex] ?? filteredOptions[0];
    if (option) {
      handleSelect(option.value);
    }
  }

  function moveHighlight(delta: number) {
    if (filteredOptions.length === 0) {
      return;
    }
    setHighlightedIndex((current) => {
      const next = current + delta;
      if (next < 0) {
        return filteredOptions.length - 1;
      }
      if (next >= filteredOptions.length) {
        return 0;
      }
      return next;
    });
  }

  function handleListKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        openList();
        return;
      }
      moveHighlight(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        openList();
        return;
      }
      moveHighlight(-1);
      return;
    }

    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      confirmHighlighted();
    }
  }

  const triggerClassName = `${styles.trigger} ${isOpen ? styles.triggerOpen : ""} ${
    invalid ? styles.triggerInvalid : ""
  }`;

  return (
    <div className={styles.root} ref={rootRef}>
      {searchable ? (
        <div className={triggerClassName}>
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            className={styles.searchInput}
            value={isOpen ? query : selectedTriggerLabel}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            aria-label={ariaLabel}
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-invalid={invalid}
            onFocus={openList}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleListKeyDown}
          />
          <button
            type="button"
            className={styles.searchToggle}
            tabIndex={-1}
            disabled={disabled}
            aria-label={isOpen ? "Cerrar listado" : "Abrir listado"}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                setQuery("");
                return;
              }
              openList();
            }}
          >
            <ChevronDown
              className={`${styles.triggerIcon} ${isOpen ? styles.triggerIconOpen : ""}`}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
          </button>
        </div>
      ) : (
        <button
          id={id}
          type="button"
          className={triggerClassName}
          onClick={() => {
            if (!disabled) {
              setIsOpen((current) => !current);
            }
          }}
          onKeyDown={handleListKeyDown}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-invalid={invalid}
        >
          <span
            className={`${styles.triggerLabel} ${selectedOption ? "" : styles.triggerPlaceholder}`}
          >
            {selectedTriggerLabel || placeholder}
          </span>
          <ChevronDown
            className={`${styles.triggerIcon} ${isOpen ? styles.triggerIconOpen : ""}`}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
        </button>
      )}

      <ul
        id={listboxId}
        className={`${styles.popover} ${isOpen ? styles.popoverOpen : ""}`}
        role="listbox"
        aria-label={ariaLabel}
      >
        {filteredOptions.length === 0 ? (
          <li className={styles.empty}>{emptyText}</li>
        ) : (
          filteredOptions.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlighted = index === highlightedIndex;

            return (
              <li key={option.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.option} ${isSelected ? styles.optionSelected : ""} ${
                    isHighlighted ? styles.optionHighlighted : ""
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option.value)}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  {isSelected ? (
                    <Check
                      className={styles.optionCheck}
                      strokeWidth={ICON_STROKE}
                      aria-hidden
                    />
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
