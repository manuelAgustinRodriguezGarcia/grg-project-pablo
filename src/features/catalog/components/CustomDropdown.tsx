"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type TransitionEvent,
} from "react";
import { ICON_STROKE, Pencil, Trash2 } from "@/shared/icons";
import { CATALOG_COVER_FALLBACK_SRC } from "@/features/catalog/utils/catalog-cover";
import styles from "@/features/catalog/styles/CatalogNavigator.module.scss";

export type DropdownOptionBadge = {
  label: string;
  tone: "visible" | "hidden";
};

export type DropdownOption = {
  id: string;
  label: string;
  description?: string;
  meta?: string;
  badge?: DropdownOptionBadge;
  imageUrl?: string | null;
  showImage?: boolean;
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

function DropdownRevealText({
  text,
  className,
  active,
}: {
  text: string;
  className: string;
  active: boolean;
}) {
  const clipRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [shifted, setShifted] = useState(false);

  useEffect(() => {
    const clip = clipRef.current;
    const node = textRef.current;
    if (!clip || !node) {
      return;
    }

    function measure() {
      if (!clip || !node) {
        return;
      }

      let fullWidth: number;

      if (getComputedStyle(node).maxWidth === "none") {
        fullWidth = node.scrollWidth;
      } else {
        const previousMaxWidth = node.style.maxWidth;
        const previousOverflow = node.style.overflow;
        const previousTextOverflow = node.style.textOverflow;
        node.style.maxWidth = "none";
        node.style.overflow = "visible";
        node.style.textOverflow = "clip";
        fullWidth = node.scrollWidth;
        node.style.maxWidth = previousMaxWidth;
        node.style.overflow = previousOverflow;
        node.style.textOverflow = previousTextOverflow;
      }

      const nextDistance = Math.max(0, Math.ceil(fullWidth - clip.clientWidth));
      setDistance((current) => (current === nextDistance ? current : nextDistance));
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(clip);
    return () => observer.disconnect();
  }, [text]);

  useEffect(() => {
    if (active && distance > 0) {
      setExpanded(true);
      setShifted(true);
      return;
    }

    setShifted(false);

    if (distance <= 0) {
      setExpanded(false);
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setExpanded(false);
    }
  }, [active, distance]);

  function handleTransitionEnd(event: TransitionEvent<HTMLSpanElement>) {
    if (event.propertyName !== "transform" || active) {
      return;
    }

    setExpanded(false);
  }

  const duration =
    distance <= 0 ? 0 : Math.min(2.4, Math.max(0.45, distance / 85));
  const revealStyle = {
    "--reveal-distance": `${distance}px`,
    "--reveal-duration": `${duration}s`,
  } as CSSProperties;

  return (
    <span
      ref={clipRef}
      className={`${styles.dropdownOptionTextClip} ${className}`}
      title={distance > 0 ? text : undefined}
    >
      <span
        ref={textRef}
        className={[
          styles.dropdownOptionTextReveal,
          expanded ? styles.dropdownOptionTextExpanded : "",
          shifted ? styles.dropdownOptionTextShifted : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={revealStyle}
        onTransitionEnd={handleTransitionEnd}
      >
        {text}
      </span>
    </span>
  );
}

function DropdownIconAction({
  label,
  onClick,
  variant = "default",
  children,
}: {
  label: string;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  variant?: "default" | "danger";
  children: ReactNode;
}) {
  const buttonClassName =
    variant === "danger"
      ? `${styles.rowActionButton} ${styles.rowActionButtonDanger}`
      : styles.rowActionButton;
  const tooltipClassName =
    variant === "danger"
      ? `${styles.dropdownOptionActionTooltip} ${styles.dropdownOptionActionTooltipDanger}`
      : styles.dropdownOptionActionTooltip;

  return (
    <span className={styles.dropdownOptionActionWrap}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </button>
      <span className={tooltipClassName} role="tooltip">
        {label}
      </span>
    </span>
  );
}

function DropdownOptionRow({
  option,
  optionId,
  isSelected,
  isHighlighted,
  hasOptionActions,
  onSelect,
  onOptionEdit,
  onOptionDelete,
  onRequestClose,
  onHighlight,
}: {
  option: DropdownOption;
  optionId: string;
  isSelected: boolean;
  isHighlighted: boolean;
  hasOptionActions: boolean;
  onSelect: (id: string) => void;
  onOptionEdit?: (id: string) => void;
  onOptionDelete?: (id: string) => void;
  onRequestClose: () => void;
  onHighlight: () => void;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!isHighlighted) {
      return;
    }
    rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [isHighlighted]);

  const revealActive = isActive || isHighlighted;

  return (
    <li
      ref={rowRef}
      id={optionId}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={[
        styles.dropdownOption,
        isSelected ? styles.dropdownOptionSelected : "",
        isHighlighted ? styles.dropdownOptionHighlighted : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseEnter={() => {
        setIsActive(true);
        onHighlight();
      }}
      onMouseLeave={() => setIsActive(false)}
      onFocus={() => {
        setIsActive(true);
        onHighlight();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsActive(false);
        }
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) {
          return;
        }
        onSelect(option.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onSelect(option.id);
        }
      }}
    >
      {option.showImage ? (
        <span className={styles.dropdownOptionThumb} aria-hidden>
          <img
            src={option.imageUrl || CATALOG_COVER_FALLBACK_SRC}
            alt=""
            className={
              option.imageUrl
                ? styles.dropdownOptionThumbImage
                : styles.dropdownOptionThumbFallback
            }
          />
        </span>
      ) : null}
      <span className={styles.dropdownOptionContent}>
        <DropdownRevealText
          text={option.label}
          className={styles.dropdownOptionLabel}
          active={revealActive}
        />
        {option.description ? (
          <DropdownRevealText
            text={option.description}
            className={styles.dropdownOptionDescription}
            active={revealActive}
          />
        ) : null}
        {option.meta ? (
          <DropdownRevealText
            text={option.meta}
            className={styles.dropdownOptionMeta}
            active={revealActive}
          />
        ) : null}
      </span>
      {hasOptionActions ? (
        <span className={styles.dropdownOptionActions}>
          {onOptionEdit ? (
            <DropdownIconAction
              label="Editar"
              onClick={(event) => {
                event.stopPropagation();
                onRequestClose();
                onOptionEdit(option.id);
              }}
            >
              <Pencil strokeWidth={ICON_STROKE} aria-hidden />
            </DropdownIconAction>
          ) : null}
          {onOptionDelete ? (
            <DropdownIconAction
              label="Eliminar"
              variant="danger"
              onClick={(event) => {
                event.stopPropagation();
                onRequestClose();
                onOptionDelete(option.id);
              }}
            >
              <Trash2 strokeWidth={ICON_STROKE} aria-hidden />
            </DropdownIconAction>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

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
  const [isPointerInside, setIsPointerInside] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

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
      setActiveIndex(-1);
      return;
    }

    const selectedIndex = options.findIndex((option) => option.id === selectedId);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [isOpen, options, selectedId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: globalThis.MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      const focusInside = root.contains(document.activeElement);
      const menuActive = isPointerInside || focusInside;
      if (!menuActive) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (options.length === 0) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) =>
          current < options.length - 1 ? current + 1 : 0,
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) =>
          current <= 0 ? options.length - 1 : current - 1,
        );
        return;
      }

      if (event.key === "Enter") {
        if (activeIndex < 0 || activeIndex >= options.length) {
          return;
        }
        const target = event.target as HTMLElement | null;
        if (target?.closest('li[role="option"] button')) {
          return;
        }
        const option = options[activeIndex];
        if (!option) {
          return;
        }
        event.preventDefault();
        onSelect(option.id);
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isPointerInside, options, activeIndex, onSelect]);

  function handleSelect(optionId: string) {
    onSelect(optionId);
    setIsOpen(false);
  }

  const isTriggerDisabled = disabled || options.length === 0;
  const isAddDisabled = addDisabled ?? disabled;
  const hasOptionActions = Boolean(onOptionEdit ?? onOptionDelete);
  const activeOptionId =
    isOpen && activeIndex >= 0
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  return (
    <div
      ref={rootRef}
      className={styles.dropdown}
      onMouseEnter={() => setIsPointerInside(true)}
      onMouseLeave={() => setIsPointerInside(false)}
    >
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
          aria-activedescendant={activeOptionId}
          disabled={isTriggerDisabled}
          onClick={() => setIsOpen((open) => !open)}
        >
          <span
            className={`${styles.dropdownTriggerContent} ${selectedOption?.meta ? styles.dropdownTriggerContentWithMeta : ""}`}
          >
            <span className={styles.dropdownTriggerLabelRow}>
              <span className={styles.dropdownTriggerLabel}>{triggerLabel}</span>
              {selectedOption?.badge ? (
                <span
                  className={`${styles.dropdownTriggerBadge} ${
                    selectedOption.badge.tone === "visible"
                      ? styles.dropdownTriggerBadgeVisible
                      : styles.dropdownTriggerBadgeHidden
                  }`}
                >
                  {selectedOption.badge.label}
                </span>
              ) : null}
            </span>
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
          {options.map((option, index) => {
            const isSelected = selectedId !== "" && option.id === selectedId;
            const optionId = `${listboxId}-option-${index}`;

            return (
              <DropdownOptionRow
                key={option.id}
                option={option}
                optionId={optionId}
                isSelected={isSelected}
                isHighlighted={index === activeIndex}
                hasOptionActions={hasOptionActions}
                onSelect={handleSelect}
                onOptionEdit={onOptionEdit}
                onOptionDelete={onOptionDelete}
                onRequestClose={() => setIsOpen(false)}
                onHighlight={() => setActiveIndex(index)}
              />
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
