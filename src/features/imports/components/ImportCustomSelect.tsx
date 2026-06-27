"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, ICON_STROKE } from "@/shared/icons";
import styles from "./ImportWizard.module.scss";

export type CustomSelectOption = {
  value: string;
  label: string;
};

type ImportCustomSelectProps = {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  listboxLabel?: string;
};

export function ImportCustomSelect({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Seleccionar…",
  listboxLabel = "Opciones",
}: ImportCustomSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const triggerLabel = selectedOption?.label ?? placeholder;
  const isMuted = selectedOption === null;

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

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
  }

  const isControlDisabled = disabled || options.length === 0;

  return (
    <div ref={rootRef} className={styles.customSelect}>
      <button
        type="button"
        className={`${styles.customSelectTrigger} ${isOpen ? styles.customSelectTriggerOpen : ""} ${isMuted ? styles.customSelectTriggerMuted : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={isControlDisabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={styles.customSelectLabel}>{triggerLabel}</span>
        <ChevronDown
          className={`${styles.customSelectChevron} ${isOpen ? styles.customSelectChevronOpen : ""}`}
          strokeWidth={ICON_STROKE}
          aria-hidden
        />
      </button>

      {isOpen && !disabled ? (
        <ul
          id={listboxId}
          className={styles.customSelectMenu}
          role="listbox"
          aria-label={listboxLabel}
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                className={`${styles.customSelectOption} ${isSelected ? styles.customSelectOptionSelected : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(option.value);
                }}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
