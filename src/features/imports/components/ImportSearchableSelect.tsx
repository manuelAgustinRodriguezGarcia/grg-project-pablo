"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, ICON_STROKE } from "@/shared/icons";
import styles from "./ImportWizard.module.scss";

export type SearchableSelectOption = {
  value: string;
  label: string;
};

function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

type ImportSearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  listboxLabel?: string;
  emptyMessage?: string;
  clearOnQueryChange?: boolean;
};

export function ImportSearchableSelect({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Buscar…",
  listboxLabel = "Opciones",
  emptyMessage = "Sin coincidencias",
  clearOnQueryChange = false,
}: ImportSearchableSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const isShowingSelectedLabel =
      selectedOption !== null && query.trim() === selectedOption.label.trim();

    if (!query.trim() || isShowingSelectedLabel) {
      return options;
    }

    const normalizedQuery = normalizeForSearch(query.trim());
    return options.filter((option) =>
      normalizeForSearch(option.label).includes(normalizedQuery),
    );
  }, [options, query, selectedOption]);

  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedOption.label);
      return;
    }

    if (!value) {
      setQuery("");
    }
  }, [selectedOption, value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedOption) {
          setQuery(selectedOption.label);
        }
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        if (selectedOption) {
          setQuery(selectedOption.label);
        }
        inputRef.current?.blur();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, selectedOption]);

  function handleSelect(nextValue: string, label: string) {
    onChange(nextValue);
    setQuery(label);
    setIsOpen(false);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && isOpen && filteredOptions.length > 0) {
      event.preventDefault();
      const next = filteredOptions[0];
      handleSelect(next.value, next.label);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
    }
  }

  const isControlDisabled = disabled || options.length === 0;

  return (
    <div ref={rootRef} className={styles.searchableSelect}>
      <div
        className={`${styles.searchableSelectControl} ${isOpen ? styles.searchableSelectControlOpen : ""}`}
      >
        <Search
          className={styles.searchableSelectIcon}
          strokeWidth={ICON_STROKE}
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          className={styles.searchableSelectInput}
          value={query}
          placeholder={placeholder}
          disabled={isControlDisabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onFocus={() => {
            setIsOpen(true);
            if (selectedOption && query === selectedOption.label) {
              inputRef.current?.select();
            }
          }}
          onKeyDown={handleInputKeyDown}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setIsOpen(true);

            if (clearOnQueryChange && value && nextQuery !== selectedOption?.label) {
              onChange("");
            }
          }}
        />
        <button
          type="button"
          className={styles.searchableSelectToggle}
          aria-label={isOpen ? "Cerrar lista" : "Abrir lista"}
          disabled={isControlDisabled}
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
              if (selectedOption) {
                setQuery(selectedOption.label);
              }
              return;
            }

            setIsOpen(true);
            inputRef.current?.focus();
          }}
        >
          <ChevronDown
            className={`${styles.searchableSelectChevron} ${isOpen ? styles.searchableSelectChevronOpen : ""}`}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
        </button>
      </div>

      {isOpen && !disabled ? (
        <ul
          id={listboxId}
          className={styles.searchableSelectMenu}
          role="listbox"
          aria-label={listboxLabel}
        >
          {filteredOptions.length === 0 ? (
            <li className={styles.searchableSelectEmpty}>{emptyMessage}</li>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = option.value === value;

              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.searchableSelectOption} ${isSelected ? styles.searchableSelectOptionSelected : ""}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(option.value, option.label);
                  }}
                >
                  {option.label}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
