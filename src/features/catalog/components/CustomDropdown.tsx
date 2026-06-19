"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

export type DropdownOption = {
  id: string;
  label: string;
  description?: string;
  meta?: string;
};

type CustomDropdownProps = {
  label: string;
  options: DropdownOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
  emptyMessage?: string;
};

export function CustomDropdown({
  label,
  options,
  selectedId,
  onSelect,
  disabled = false,
  emptyMessage = "Sin opciones disponibles",
}: CustomDropdownProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption =
    options.find((option) => option.id === selectedId) ?? options[0] ?? null;

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

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function handleSelect(optionId: string) {
    onSelect(optionId);
    setIsOpen(false);
  }

  const isTriggerDisabled = disabled || options.length === 0;

  return (
    <div ref={rootRef} className={styles.dropdown}>
      <label className={styles.dropdownLabel} htmlFor={`${listboxId}-trigger`}>
        {label}
      </label>

      <button
        id={`${listboxId}-trigger`}
        type="button"
        className={`${styles.dropdownTrigger} ${isOpen ? styles.dropdownTriggerOpen : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={isTriggerDisabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={styles.dropdownTriggerContent}>
          <span className={styles.dropdownTriggerLabel}>
            {selectedOption?.label ?? emptyMessage}
          </span>
          {selectedOption?.meta ? (
            <span className={styles.dropdownTriggerMeta}>{selectedOption.meta}</span>
          ) : null}
        </span>
        <span className={styles.dropdownChevron} aria-hidden="true" />
      </button>

      {isOpen && options.length > 0 ? (
        <ul
          id={listboxId}
          className={styles.dropdownMenu}
          role="listbox"
          aria-label={label}
        >
          {options.map((option) => {
            const isSelected = option.id === selectedOption?.id;

            return (
              <li key={option.id} role="presentation">
                <button
                  type="button"
                  className={`${styles.dropdownOption} ${isSelected ? styles.dropdownOptionSelected : ""}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.id)}
                >
                  <span className={styles.dropdownOptionLabel}>{option.label}</span>
                  {option.description ? (
                    <span className={styles.dropdownOptionDescription}>
                      {option.description}
                    </span>
                  ) : null}
                  {option.meta ? (
                    <span className={styles.dropdownOptionMeta}>{option.meta}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
