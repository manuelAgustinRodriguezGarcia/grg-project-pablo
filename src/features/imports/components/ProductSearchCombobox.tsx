"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, ICON_STROKE } from "@/shared/icons";
import styles from "./ImportWizard.module.scss";

export type ProductSearchOption = {
  id: string;
  label: string;
};

type ProductSearchComboboxProps = {
  options: ProductSearchOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ProductSearchCombobox({
  options,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = "Buscar producto…",
}: ProductSearchComboboxProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === selectedId) ?? null,
    [options, selectedId],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedOption.label);
    }
  }, [selectedOption]);

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

  function handleSelect(optionId: string, label: string) {
    onSelect(optionId);
    setQuery(label);
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} className={styles.productCombobox}>
      <div
        className={`${styles.productComboboxControl} ${isOpen ? styles.productComboboxControlOpen : ""}`}
      >
        <Search
          className={styles.productComboboxIcon}
          strokeWidth={ICON_STROKE}
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          className={styles.productComboboxInput}
          value={query}
          placeholder={placeholder}
          disabled={disabled || options.length === 0}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setIsOpen(true);
            if (selectedId && nextQuery !== selectedOption?.label) {
              onSelect("");
            }
          }}
        />
      </div>

      {isOpen && !disabled ? (
        <ul
          id={listboxId}
          className={styles.productComboboxMenu}
          role="listbox"
          aria-label="Productos"
        >
          {filteredOptions.length === 0 ? (
            <li className={styles.productComboboxEmpty}>Sin coincidencias</li>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = option.id === selectedId;

              return (
                <li
                  key={option.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.productComboboxOption} ${isSelected ? styles.productComboboxOptionSelected : ""}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(option.id, option.label);
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
