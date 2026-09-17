"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, ICON_STROKE } from "@/shared/icons";
import {
  buildIsoYearMonth,
  formatIsoYearMonthForDisplay,
  getTodayIsoYearMonth,
  isIsoYearMonth,
  parseIsoYearMonth,
} from "@/shared/utils/date-only";
import styles from "@/shared/components/CustomDatePicker.module.scss";

const MONTH_INDEXES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

type CustomMonthPickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
  placeholder?: string;
};

function monthShortLabel(month: number): string {
  return new Date(2020, month - 1, 1).toLocaleDateString("es-AR", {
    month: "short",
  });
}

export function CustomMonthPicker({
  id,
  value,
  onChange,
  disabled = false,
  ariaLabel = "Seleccionar mes",
  triggerClassName,
  placeholder = "Seleccione un mes",
}: CustomMonthPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const hasValue = isIsoYearMonth(value);
  const parsedValue = parseIsoYearMonth(
    hasValue ? value : getTodayIsoYearMonth(),
  );
  const todayIso = getTodayIsoYearMonth();
  const todayParts = parseIsoYearMonth(todayIso);

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsedValue.year);
  const [gridKey, setGridKey] = useState(0);

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

  const monthLabels = useMemo(
    () => MONTH_INDEXES.map((month) => monthShortLabel(month)),
    [],
  );

  function shiftYear(delta: number) {
    setViewYear((current) => current + delta);
    setGridKey((current) => current + 1);
  }

  function selectMonth(month: number) {
    onChange(buildIsoYearMonth(viewYear, month));
    setIsOpen(false);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""} ${triggerClassName ?? ""}`}
        onClick={() => {
          if (disabled) {
            return;
          }

          if (isOpen) {
            setIsOpen(false);
            return;
          }

          setViewYear(parsedValue.year);
          setIsOpen(true);
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={listboxId}
      >
        <Calendar className={styles.triggerIcon} strokeWidth={ICON_STROKE} aria-hidden />
        <span
          className={`${styles.triggerLabel} ${hasValue ? "" : styles.triggerPlaceholder}`}
        >
          {hasValue ? formatIsoYearMonthForDisplay(value) : placeholder}
        </span>
      </button>

      <div
        id={listboxId}
        className={`${styles.popover} ${styles.popoverStart} ${isOpen ? styles.popoverOpen : ""}`}
        role="dialog"
        aria-label="Calendario de meses"
      >
        <div className={styles.popoverHeader}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => shiftYear(-1)}
            aria-label="Año anterior"
          >
            <ChevronLeft strokeWidth={ICON_STROKE} aria-hidden />
          </button>
          <span className={styles.monthLabel}>{viewYear}</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => shiftYear(1)}
            aria-label="Año siguiente"
          >
            <ChevronRight strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>

        <div key={gridKey} className={`${styles.monthsGrid} ${styles.daysGridAnimated}`}>
          {MONTH_INDEXES.map((month, index) => {
            const monthIso = buildIsoYearMonth(viewYear, month);
            const isSelected = hasValue && monthIso === value;
            const isCurrent =
              month === todayParts.month && viewYear === todayParts.year;

            return (
              <button
                key={monthIso}
                type="button"
                className={`${styles.monthButton} ${isSelected ? styles.monthButtonSelected : ""} ${isCurrent ? styles.monthButtonCurrent : ""}`}
                onClick={() => selectMonth(month)}
              >
                {monthLabels[index]}
              </button>
            );
          })}
        </div>

        <div className={styles.popoverFooter}>
          <span />
          <button
            type="button"
            className={styles.todayButton}
            onClick={() => {
              onChange(todayIso);
              setViewYear(todayParts.year);
              setIsOpen(false);
            }}
          >
            Este mes
          </button>
        </div>
      </div>
    </div>
  );
}
