"use client";

import { CustomSelect } from "@/shared/components/CustomSelect";
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
  onRefresh: () => void;
  refreshing: boolean;
};

export function StatisticsPeriodBar({
  selection,
  yearOptions,
  onToggleMonth,
  onToggleFullYear,
  onChangeYear,
  onRefresh,
  refreshing,
}: StatisticsPeriodBarProps) {
  const fullYear = isFullYearSelection(selection.months);

  return (
    <fieldset className={styles.period}>
      <legend className={styles.srOnly}>Meses a consultar</legend>
      <div className={styles.periodToolbar}>
        <div className={styles.yearSelect}>
          <CustomSelect
            ariaLabel="Año"
            value={String(selection.year)}
            options={yearOptions.map((option) => ({
              value: String(option),
              label: String(option),
            }))}
            onChange={(next) => onChangeYear(Number(next))}
          />
        </div>
        <button
          type="button"
          className={`${styles.monthButton} ${fullYear ? styles.monthButtonActive : ""}`}
          aria-pressed={fullYear}
          onClick={onToggleFullYear}
        >
          Año completo
        </button>
        <button
          type="button"
          className={styles.textButton}
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Actualizando" : "Actualizar"}
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
