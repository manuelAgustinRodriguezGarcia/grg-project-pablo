"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, ICON_STROKE } from "@/shared/icons";
import {
  buildIsoDateOnly,
  formatIsoDateOnlyForDisplay,
  getDaysInMonth,
  getTodayIsoDateOnly,
  getWeekdayIndex,
  parseIsoDateOnly,
} from "@/shared/utils/date-only";
import styles from "@/shared/components/CustomDatePicker.module.scss";

const WEEKDAY_LABELS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

type CustomDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
};

type CalendarCell = {
  day: number;
  month: number;
  year: number;
  inCurrentMonth: boolean;
};

function buildMonthCells(year: number, month: number): CalendarCell[] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = getWeekdayIndex(year, month, 1);
  const cells: CalendarCell[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ day: 0, month, year, inCurrentMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, month, year, inCurrentMonth: true });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ day: 0, month, year, inCurrentMonth: false });
  }

  return cells;
}

export function CustomDatePicker({
  value,
  onChange,
  disabled = false,
  ariaLabel = "Seleccionar fecha",
  triggerClassName,
}: CustomDatePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const parsedValue = parseIsoDateOnly(value);
  const todayIso = getTodayIsoDateOnly();
  const todayParts = parseIsoDateOnly(todayIso);

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsedValue.year);
  const [viewMonth, setViewMonth] = useState(parsedValue.month);
  const [gridKey, setGridKey] = useState(0);

  useEffect(() => {
    setViewYear(parsedValue.year);
    setViewMonth(parsedValue.month);
  }, [parsedValue.month, parsedValue.year, value]);

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

  const monthLabel = useMemo(() => {
    const date = new Date(viewYear, viewMonth - 1, 1);
    return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  }, [viewMonth, viewYear]);

  const cells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewMonth, viewYear],
  );

  function shiftMonth(delta: number) {
    const date = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth() + 1);
    setGridKey((current) => current + 1);
  }

  function selectDay(cell: CalendarCell) {
    if (!cell.inCurrentMonth || cell.day === 0) {
      return;
    }

    onChange(buildIsoDateOnly(cell.year, cell.month, cell.day));
    setIsOpen(false);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""} ${triggerClassName ?? ""}`}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
          }
        }}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={listboxId}
      >
        <Calendar className={styles.triggerIcon} strokeWidth={ICON_STROKE} aria-hidden />
        <span className={styles.triggerLabel}>{formatIsoDateOnlyForDisplay(value)}</span>
      </button>

      <div
        id={listboxId}
        className={`${styles.popover} ${isOpen ? styles.popoverOpen : ""}`}
        role="dialog"
        aria-label="Calendario"
      >
        <div className={styles.popoverHeader}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => shiftMonth(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft strokeWidth={ICON_STROKE} aria-hidden />
          </button>
          <span className={styles.monthLabel}>{monthLabel}</span>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => shiftMonth(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight strokeWidth={ICON_STROKE} aria-hidden />
          </button>
        </div>

        <div className={styles.weekdays}>
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} className={styles.weekday}>
              {label}
            </span>
          ))}
        </div>

        <div key={gridKey} className={`${styles.daysGrid} ${styles.daysGridAnimated}`}>
          {cells.map((cell, index) => {
            if (!cell.inCurrentMonth) {
              return (
                <span
                  key={`outside-${index}`}
                  className={`${styles.dayButton} ${styles.dayButtonOutside}`}
                  aria-hidden
                />
              );
            }

            const cellIso = buildIsoDateOnly(cell.year, cell.month, cell.day);
            const isSelected = cellIso === value;
            const isToday =
              cell.day === todayParts.day &&
              cell.month === todayParts.month &&
              cell.year === todayParts.year;

            return (
              <button
                key={cellIso}
                type="button"
                className={`${styles.dayButton} ${isSelected ? styles.dayButtonSelected : ""} ${isToday ? styles.dayButtonToday : ""}`}
                onClick={() => selectDay(cell)}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        <div className={styles.popoverFooter}>
          <button
            type="button"
            className={styles.todayButton}
            onClick={() => {
              onChange(todayIso);
              setViewYear(todayParts.year);
              setViewMonth(todayParts.month);
              setIsOpen(false);
            }}
          >
            Hoy
          </button>
        </div>
      </div>
    </div>
  );
}
