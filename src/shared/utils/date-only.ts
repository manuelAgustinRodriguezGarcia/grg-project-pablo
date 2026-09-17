const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateOnly(value: string): boolean {
  return ISO_DATE_ONLY_PATTERN.test(value);
}

export function getTodayIsoDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isoDateOnlyToDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function dateToIsoDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatIsoDateOnlyForDisplay(
  iso: string,
  locale = "es-AR",
): string {
  if (!isIsoDateOnly(iso)) {
    return iso;
  }

  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatIsoDateOnlyNumeric(iso: string): string {
  if (!isIsoDateOnly(iso)) {
    return iso;
  }

  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function parseIsoDateOnly(iso: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

export function buildIsoDateOnly(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getWeekdayIndex(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

const ISO_YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isIsoYearMonth(value: string): boolean {
  return ISO_YEAR_MONTH_PATTERN.test(value);
}

export function buildIsoYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getTodayIsoYearMonth(): string {
  const now = new Date();
  return buildIsoYearMonth(now.getFullYear(), now.getMonth() + 1);
}

export function parseIsoYearMonth(iso: string): { year: number; month: number } {
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}

export function formatIsoYearMonthForDisplay(
  iso: string,
  locale = "es-AR",
): string {
  if (!isIsoYearMonth(iso)) {
    return iso;
  }

  const { year, month } = parseIsoYearMonth(iso);
  return new Date(year, month - 1, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}
