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
  onOptionEdit?: (id: string) => void;
  onOptionDelete?: (id: string) => void;
  onAdd?: () => void;
  disabled?: boolean;
  addDisabled?: boolean;
  emptyMessage?: string;
  placeholder?: string;
  preferPlaceholderWithoutOptions?: boolean;
};

export function CustomDropdown({
  label,
  options,
  selectedId,
  onSelect,
  onOptionEdit,
  onOptionDelete,
  onAdd,
  disabled = false,
  addDisabled,
  emptyMessage = "Sin opciones disponibles",
  placeholder,
  preferPlaceholderWithoutOptions = false,
}: CustomDropdownProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption =
    selectedId !== ""
      ? (options.find((option) => option.id === selectedId) ?? null)
      : null;

  const triggerLabel = (() => {
    if (selectedOption) {
      return selectedOption.label;
    }

    if (options.length === 0) {
      if (preferPlaceholderWithoutOptions && placeholder) {
        return placeholder;
      }

      return emptyMessage;
    }

    return placeholder ?? emptyMessage;
  })();
  const isMutedTrigger = selectedOption === null;

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

  function handleSelect(optionId: string) {
    onSelect(optionId);
    setIsOpen(false);
  }

  const isTriggerDisabled = disabled || options.length === 0;
  const isAddDisabled = addDisabled ?? disabled;
  const hasOptionActions = Boolean(onOptionEdit ?? onOptionDelete);

  return (
    <div ref={rootRef} className={styles.dropdown}>
      <div className={styles.dropdownLabelRow}>
        <label className={styles.dropdownLabel} htmlFor={`${listboxId}-trigger`}>
          {label}
        </label>
        {onAdd ? (
          <button
            type="button"
            className={styles.dropdownAddButton}
            onClick={onAdd}
            disabled={isAddDisabled}
            aria-label={
              label.toLowerCase() === "carpeta"
                ? "Agregar carpeta"
                : `Agregar ${label.toLowerCase()}`
            }
          >
            <span className={styles.dropdownAddButtonLabel}>agregar</span>
          </button>
        ) : null}
      </div>

      <div
        className={`${styles.dropdownTriggerRow} ${isOpen ? styles.dropdownTriggerOpen : ""}`}
      >
        <button
          id={`${listboxId}-trigger`}
          type="button"
          className={`${styles.dropdownTrigger} ${isMutedTrigger ? styles.dropdownTriggerMuted : ""}`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          disabled={isTriggerDisabled}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span
            className={`${styles.dropdownTriggerContent} ${selectedOption?.meta ? styles.dropdownTriggerContentWithMeta : ""}`}
          >
            <span className={styles.dropdownTriggerLabel}>{triggerLabel}</span>
            {selectedOption?.meta ? (
              <span className={styles.dropdownTriggerMeta}>{selectedOption.meta}</span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          className={styles.dropdownChevronButton}
          aria-label={`${isOpen ? "Cerrar" : "Abrir"} ${label.toLowerCase()}`}
          disabled={isTriggerDisabled}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span className={styles.dropdownChevron} aria-hidden="true" />
        </button>
      </div>

      {isOpen && options.length > 0 ? (
        <ul
          id={listboxId}
          className={styles.dropdownMenu}
          role="listbox"
          aria-label={label}
        >
          {options.map((option) => {
            const isSelected = selectedId !== "" && option.id === selectedId;

            return (
              <li
                key={option.id}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                className={`${styles.dropdownOption} ${isSelected ? styles.dropdownOptionSelected : ""}`}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("button")) {
                    return;
                  }
                  handleSelect(option.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelect(option.id);
                  }
                }}
              >
                <span className={styles.dropdownOptionContent}>
                  <span className={styles.dropdownOptionLabel}>{option.label}</span>
                  {option.description ? (
                    <span className={styles.dropdownOptionDescription}>
                      {option.description}
                    </span>
                  ) : null}
                  {option.meta ? (
                    <span className={styles.dropdownOptionMeta}>{option.meta}</span>
                  ) : null}
                </span>
                {hasOptionActions ? (
                  <span className={styles.dropdownOptionActions}>
                    {onOptionEdit ? (
                      <button
                        type="button"
                        className={styles.dropdownOptionAction}
                        aria-label={`Editar ${option.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setIsOpen(false);
                          onOptionEdit(option.id);
                        }}
                      >
                        Editar
                      </button>
                    ) : null}
                    {onOptionDelete ? (
                      <button
                        type="button"
                        className={`${styles.dropdownOptionAction} ${styles.dropdownOptionActionDanger}`}
                        aria-label={`Eliminar ${option.label}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setIsOpen(false);
                          onOptionDelete(option.id);
                        }}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
