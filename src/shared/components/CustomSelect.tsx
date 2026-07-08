"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, ICON_STROKE } from "@/shared/icons";
import styles from "@/shared/components/CustomSelect.module.scss";

export type CustomSelectOption = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  placeholder?: string;
};

export function CustomSelect({
  value,
  options,
  onChange,
  disabled = false,
  ariaLabel,
  id,
  placeholder = "Seleccionar…",
}: CustomSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    setIsOpen(false);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        id={id}
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
          }
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
      >
        <span
          className={`${styles.triggerLabel} ${selectedOption ? "" : styles.triggerPlaceholder}`}
        >
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`${styles.triggerIcon} ${isOpen ? styles.triggerIconOpen : ""}`}
          strokeWidth={ICON_STROKE}
          aria-hidden
        />
      </button>

      <ul
        id={listboxId}
        className={`${styles.popover} ${isOpen ? styles.popoverOpen : ""}`}
        role="listbox"
        aria-label={ariaLabel}
      >
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <li key={option.value} role="none">
              <button
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
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
        })}
      </ul>
    </div>
  );
}
