"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  isFullYearSelection,
  type StatisticsMonthSelection,
} from "@/features/billing/utils/billing-statistics-selection";
import { STATISTICS_MONTHS } from "@/features/billing/utils/billing-statistics-period";
import styles from "@/features/billing/styles/Statistics.module.scss";

type StatisticsPeriodBarProps = {
  selection: StatisticsMonthSelection;
  yearOptions: readonly number[];
  onToggleMonth: (month: number) => void;
  onToggleFullYear: () => void;
  onChangeYear: (year: number) => void;
};

function StatisticsYearPicker({
  year,
  years,
  onChange,
}: {
  year: number;
  years: readonly number[];
  onChange: (year: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.yearPicker} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.yearButton}${open ? ` ${styles.yearButtonOpen}` : ""}`}
        aria-label="Elegir año"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        {year}
      </button>
      {open ? (
        <div
          id={panelId}
          className={styles.yearPanel}
          role="dialog"
          aria-label="Años con facturación"
        >
          {years.length === 0 ? (
            <p className={styles.yearEmpty}>No hay años con facturación.</p>
          ) : (
            years.map((option) => {
              const selected = option === year;
              return (
                <button
                  key={option}
                  type="button"
                  className={`${styles.yearOption}${selected ? ` ${styles.yearOptionActive}` : ""}`}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  {option}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

export function StatisticsPeriodBar({
  selection,
  yearOptions,
  onToggleMonth,
  onToggleFullYear,
  onChangeYear,
}: StatisticsPeriodBarProps) {
  const fullYear = isFullYearSelection(selection.months);

  return (
    <fieldset className={styles.period}>
      <legend className={styles.srOnly}>Meses a consultar</legend>
      <div className={styles.periodToolbar}>
        <div className={styles.yearSelect}>
          <span className={styles.yearLabel}>AÑO</span>
          <StatisticsYearPicker
            year={selection.year}
            years={yearOptions}
            onChange={onChangeYear}
          />
        </div>
        <button
          type="button"
          className={`${styles.monthButton} ${styles.fullYearButton} ${fullYear ? styles.monthButtonActive : ""}`}
          aria-pressed={fullYear}
          onClick={onToggleFullYear}
        >
          Ver año completo
        </button>
      </div>
      <div className={styles.monthGrid} role="group" aria-label="Meses">
        {STATISTICS_MONTHS.map((item) => {
          const selected = selection.months.includes(item.month);
          return (
            <button
              key={item.month}
              type="button"
              className={`${styles.monthButton} ${selected ? styles.monthButtonActive : ""}`}
              aria-pressed={selected}
              aria-label={item.name}
              onClick={() => onToggleMonth(item.month)}
            >
              {item.shortLabel}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
