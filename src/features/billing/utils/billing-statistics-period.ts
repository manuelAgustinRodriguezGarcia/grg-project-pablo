import {
  buildIsoDateOnly,
  formatIsoDateOnlyForDisplay,
  getDaysInMonth,
  isIsoDateOnly,
  parseIsoDateOnly,
} from "@/shared/utils/date-only";

export const BILLING_STATISTICS_PATH = "/admin/facturacion/estadisticas";

export const STATISTICS_MONTHS = [
  { month: 1, shortLabel: "ENE", name: "Enero" },
  { month: 2, shortLabel: "FEB", name: "Febrero" },
  { month: 3, shortLabel: "MAR", name: "Marzo" },
  { month: 4, shortLabel: "ABR", name: "Abril" },
  { month: 5, shortLabel: "MAY", name: "Mayo" },
  { month: 6, shortLabel: "JUN", name: "Junio" },
  { month: 7, shortLabel: "JUL", name: "Julio" },
  { month: 8, shortLabel: "AGO", name: "Agosto" },
  { month: 9, shortLabel: "SEP", name: "Septiembre" },
  { month: 10, shortLabel: "OCT", name: "Octubre" },
  { month: 11, shortLabel: "NOV", name: "Noviembre" },
  { month: 12, shortLabel: "DIC", name: "Diciembre" },
] as const;

export type StatisticsPeriodSelection =
  | { mode: "month"; year: number; month: number }
  | { mode: "year"; year: number }
  | { mode: "custom"; from: string; to: string };

/** Primer año del sistema de facturación. Los anteriores no se consultan. */
export const BILLING_STATISTICS_FIRST_YEAR = 2026;

export function statisticsInvoicedYearOptions(invoicedYears: readonly number[]): number[] {
  const years = new Set<number>();

  for (const year of invoicedYears) {
    if (
      Number.isInteger(year)
      && year >= BILLING_STATISTICS_FIRST_YEAR
      && year <= 9999
    ) {
      years.add(year);
    }
  }

  return [...years].sort((left, right) => right - left);
}

export function statisticsSelectableYear(
  initialYear: number,
  invoicedYears: readonly number[],
): number {
  const years = statisticsInvoicedYearOptions(invoicedYears);
  if (years.length === 0 || years.includes(initialYear)) {
    return initialYear;
  }

  return years[0];
}

export function statisticsPeriodYear(
  period: StatisticsPeriodSelection,
  fallbackYear: number,
): number {
  switch (period.mode) {
    case "month":
    case "year":
      return period.year;
    case "custom": {
      const year = Number(period.from.slice(0, 4));
      return Number.isInteger(year) && year >= 1000 ? year : fallbackYear;
    }
    default: {
      const unexpected: never = period;
      return unexpected;
    }
  }
}

export function selectMonth(
  period: StatisticsPeriodSelection,
  month: number,
  fallbackYear: number,
): StatisticsPeriodSelection {
  return {
    mode: "month",
    year: statisticsPeriodYear(period, fallbackYear),
    month,
  };
}

export function selectFullYear(
  period: StatisticsPeriodSelection,
  fallbackYear: number,
): StatisticsPeriodSelection {
  return {
    mode: "year",
    year: statisticsPeriodYear(period, fallbackYear),
  };
}

export function selectYear(
  period: StatisticsPeriodSelection,
  year: number,
): StatisticsPeriodSelection {
  switch (period.mode) {
    case "month":
      return { mode: "month", year, month: period.month };
    case "year":
      return { mode: "year", year };
    case "custom": {
      const month = Number(period.from.slice(5, 7));
      return {
        mode: "month",
        year,
        month: month >= 1 && month <= 12 ? month : 1,
      };
    }
    default: {
      const unexpected: never = period;
      return unexpected;
    }
  }
}

export function selectCustom(
  period: StatisticsPeriodSelection,
): StatisticsPeriodSelection {
  if (period.mode === "custom") {
    return period;
  }

  const year = period.year;
  const startMonth = period.mode === "month" ? period.month : 1;
  const endMonth = period.mode === "month" ? period.month : 12;

  return {
    mode: "custom",
    from: buildIsoDateOnly(year, startMonth, 1),
    to: buildIsoDateOnly(year, endMonth, getDaysInMonth(year, endMonth)),
  };
}

export function previousPeriod(
  period: StatisticsPeriodSelection,
): StatisticsPeriodSelection | null {
  switch (period.mode) {
    case "month":
      if (period.month <= 1) {
        return { mode: "month", year: period.year - 1, month: 12 };
      }
      return { mode: "month", year: period.year, month: period.month - 1 };
    case "year":
      return { mode: "year", year: period.year - 1 };
    case "custom": {
      const year = Number(period.from.slice(0, 4));
      const month = Number(period.from.slice(5, 7));
      if (year < 1000 || month < 1 || month > 12) {
        return null;
      }
      return previousPeriod({ mode: "month", year, month });
    }
    default: {
      const unexpected: never = period;
      return unexpected;
    }
  }
}

function isRealIsoDate(value: string): boolean {
  if (!isIsoDateOnly(value)) {
    return false;
  }

  const parsed = parseIsoDateOnly(value);
  if (!Number.isInteger(parsed.year) || parsed.year < 1000 || parsed.year > 9999) {
    return false;
  }
  if (parsed.month < 1 || parsed.month > 12 || parsed.day < 1) {
    return false;
  }

  return parsed.day <= getDaysInMonth(parsed.year, parsed.month);
}

export function periodQueryError(period: StatisticsPeriodSelection): string | null {
  switch (period.mode) {
    case "month":
      if (!Number.isInteger(period.year) || period.year < 1000 || period.year > 9999) {
        return "El año no es válido.";
      }
      if (!Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
        return "El mes no es válido.";
      }
      return null;
    case "year":
      if (!Number.isInteger(period.year) || period.year < 1000 || period.year > 9999) {
        return "El año no es válido.";
      }
      return null;
    case "custom":
      if (!isRealIsoDate(period.from) || !isRealIsoDate(period.to)) {
        return "Elegí fechas válidas.";
      }
      if (period.from > period.to) {
        return "La fecha inicial no puede ser posterior a la final.";
      }
      return null;
    default: {
      const unexpected: never = period;
      return unexpected;
    }
  }
}

export function describeStatisticsPeriod(period: StatisticsPeriodSelection): string {
  switch (period.mode) {
    case "month":
      return `${STATISTICS_MONTHS[period.month - 1]?.name ?? "Mes"} ${period.year}`;
    case "year":
      return `Año ${period.year}`;
    case "custom":
      if (periodQueryError(period)) {
        return "Rango personalizado";
      }
      return `${formatIsoDateOnlyForDisplay(period.from)} – ${formatIsoDateOnlyForDisplay(period.to)}`;
    default: {
      const unexpected: never = period;
      return unexpected;
    }
  }
}

function appendPeriod(
  params: URLSearchParams,
  period: StatisticsPeriodSelection,
  compare: boolean,
): void {
  const modeKey = compare ? "comparePeriod" : "period";
  const yearKey = compare ? "compareYear" : "year";
  const monthKey = compare ? "compareMonth" : "month";
  const fromKey = compare ? "compareFrom" : "from";
  const toKey = compare ? "compareTo" : "to";

  params.set(modeKey, period.mode);

  switch (period.mode) {
    case "month":
      params.set(yearKey, String(period.year));
      params.set(monthKey, String(period.month).padStart(2, "0"));
      return;
    case "year":
      params.set(yearKey, String(period.year));
      return;
    case "custom":
      params.set(fromKey, period.from);
      params.set(toKey, period.to);
      return;
    default: {
      const unexpected: never = period;
      throw new Error(unexpected);
    }
  }
}

export function statisticsRequestSearch(input: {
  period: StatisticsPeriodSelection;
  comparison: StatisticsPeriodSelection | null;
  clientKey?: string | null;
  rubroKey?: string | null;
}): string {
  const params = new URLSearchParams();
  appendPeriod(params, input.period, false);

  if (input.comparison) {
    appendPeriod(params, input.comparison, true);
  }

  if (input.clientKey) {
    params.set("clientKey", input.clientKey);
  }

  if (input.rubroKey) {
    params.set("rubroKey", input.rubroKey);
  }

  return params.toString();
}

export function statisticsScopeKey(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("clientKey");
  params.delete("rubroKey");

  return [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}
