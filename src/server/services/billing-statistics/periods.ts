import {
  libroIvaCustomRange,
  libroIvaMonthRange,
} from "@/features/billing/utils/libro-iva";
import type { StatisticsPeriodMode } from "@/features/billing/schemas/billing-statistics.schemas";

export type StatisticsRange = {
  from: Date;
  to: Date;
};

/**
 * Los límites salen de las mismas funciones del Libro de IVA.
 * Son instantes de la zona horaria del proceso, con fin exclusivo.
 * ARCA usa America/Argentina/Buenos_Aires. Esta diferencia ya estaba
 * en el generador y este módulo no la corrige.
 */
export function statisticsMonthRange(year: number, month: number): StatisticsRange {
  return libroIvaMonthRange(year, month);
}

export function statisticsYearRange(year: number): StatisticsRange {
  if (!Number.isInteger(year)) {
    throw new Error("Indicá un año válido.");
  }

  const from = libroIvaMonthRange(year, 1).from;
  const to = libroIvaMonthRange(year, 12).to;
  if (from.getFullYear() !== year) {
    throw new Error("Indicá un año válido.");
  }

  return { from, to };
}

export function statisticsCustomRange(from: string, to: string): StatisticsRange {
  return libroIvaCustomRange(from, to);
}

export function isIssuedInRange(issuedAt: Date, range: StatisticsRange): boolean {
  const time = issuedAt.getTime();
  return time >= range.from.getTime() && time < range.to.getTime();
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthOf(date: Date): { year: number; month: number; key: string } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return { year, month, key: monthKey(year, month) };
}

export function listMonths(
  range: StatisticsRange,
): Array<{ year: number; month: number; key: string }> {
  if (range.to.getTime() <= range.from.getTime()) {
    throw new Error("El período no tiene duración.");
  }

  const last = new Date(range.to.getTime() - 1);
  const months: Array<{ year: number; month: number; key: string }> = [];
  let year = range.from.getFullYear();
  let month = range.from.getMonth() + 1;
  const lastYear = last.getFullYear();
  const lastMonth = last.getMonth() + 1;

  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push({ year, month, key: monthKey(year, month) });
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

export function formatLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function describePeriod(mode: StatisticsPeriodMode, range: StatisticsRange): {
  mode: StatisticsPeriodMode;
  from: string;
  to: string;
  startInclusive: string;
  endExclusive: string;
  timeBasis: "process-local";
} {
  return {
    mode,
    from: formatLocalIsoDate(range.from),
    to: formatLocalIsoDate(new Date(range.to.getTime() - 1)),
    startInclusive: range.from.toISOString(),
    endExclusive: range.to.toISOString(),
    timeBasis: "process-local",
  };
}
