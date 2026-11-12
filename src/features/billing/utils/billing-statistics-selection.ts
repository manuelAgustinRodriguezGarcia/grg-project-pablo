import { STATISTICS_MONTHS } from "@/features/billing/utils/billing-statistics-period";

export type StatisticsMonthSelection = {
  year: number;
  months: number[];
};

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function createMonthSelection(
  year: number,
  month: number,
): StatisticsMonthSelection {
  return {
    year,
    months: month >= 1 && month <= 12 ? [month] : [],
  };
}

export function toggleSelectedMonth(
  selection: StatisticsMonthSelection,
  month: number,
): StatisticsMonthSelection {
  if (month < 1 || month > 12) {
    return selection;
  }

  const months = selection.months.includes(month)
    ? selection.months.filter((item) => item !== month)
    : [...selection.months, month].sort((left, right) => left - right);

  return { ...selection, months };
}

export function toggleFullYear(
  selection: StatisticsMonthSelection,
): StatisticsMonthSelection {
  if (isFullYearSelection(selection.months)) {
    return { ...selection, months: [] };
  }

  return { ...selection, months: [...ALL_MONTHS] };
}

export function changeSelectionYear(
  selection: StatisticsMonthSelection,
  year: number,
): StatisticsMonthSelection {
  return { ...selection, year };
}

export function isFullYearSelection(months: readonly number[]): boolean {
  return ALL_MONTHS.every((month) => months.includes(month));
}

export function describeSelectedMonths(
  selection: StatisticsMonthSelection,
): string {
  if (selection.months.length === 0) {
    return `Sin meses seleccionados en ${selection.year}`;
  }

  if (isFullYearSelection(selection.months)) {
    return `Año ${selection.year}`;
  }

  const names = selection.months.map(
    (month) => STATISTICS_MONTHS[month - 1]?.name ?? "Mes",
  );
  return `${joinMonthNames(names)} ${selection.year}`;
}

function joinMonthNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }

  if (names.length === 2) {
    return `${names[0]} y ${names[1]}`;
  }

  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}
