import {
  parseIsoDateValue,
  parseYearMonthValue,
  toIsoDateValue,
  toYearMonthValue,
} from "@/features/billing/utils/libro-iva";

export type DeudoresPeriodKind = "monthly" | "custom" | "annual";

export type DeudoresPeriodSelection = {
  kind: DeudoresPeriodKind;
  fromDate: string;
  toDate: string;
  label: string;
};

const MONTH_LABEL = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
});

const DAY_LABEL = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export function deudoresYearOptions(now = new Date()): number[] {
  const current = now.getFullYear();
  const years: number[] = [];
  for (let year = current; year >= current - 15; year -= 1) {
    years.push(year);
  }
  return years;
}

export function monthRangeIso(
  year: number,
  month: number,
): { fromDate: string; toDate: string } {
  const lastDay = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    fromDate: `${year}-${mm}-01`,
    toDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function annualRangeIso(year: number): {
  fromDate: string;
  toDate: string;
} {
  return {
    fromDate: `${year}-01-01`,
    toDate: `${year}-12-31`,
  };
}

export function isDeudoresCustomRangeValid(
  fromValue: string,
  toValue: string,
): boolean {
  const from = parseIsoDateValue(fromValue);
  const to = parseIsoDateValue(toValue);
  if (!from || !to) {
    return false;
  }

  const fromTime = new Date(from.year, from.month - 1, from.day).getTime();
  const toTime = new Date(to.year, to.month - 1, to.day).getTime();
  return fromTime <= toTime;
}

export function resolveDeudoresPeriod(input: {
  kind: DeudoresPeriodKind;
  monthValue: string;
  fromValue: string;
  toValue: string;
  year: number;
}): DeudoresPeriodSelection | { error: string } {
  if (input.kind === "monthly") {
    const monthly = parseYearMonthValue(input.monthValue);
    if (!monthly) {
      return { error: "Indicá un mes válido." };
    }
    const range = monthRangeIso(monthly.year, monthly.month);
    return {
      kind: "monthly",
      ...range,
      label: MONTH_LABEL.format(new Date(monthly.year, monthly.month - 1, 1)),
    };
  }

  if (input.kind === "annual") {
    if (!Number.isInteger(input.year) || input.year < 2000) {
      return { error: "Indicá un año válido." };
    }
    const range = annualRangeIso(input.year);
    return {
      kind: "annual",
      ...range,
      label: String(input.year),
    };
  }

  const from = parseIsoDateValue(input.fromValue);
  const to = parseIsoDateValue(input.toValue);
  if (!from || !to) {
    return { error: "Indicá un rango de fechas válido." };
  }
  if (!isDeudoresCustomRangeValid(input.fromValue, input.toValue)) {
    return { error: "La fecha desde no puede ser posterior a la fecha hasta." };
  }

  return {
    kind: "custom",
    fromDate: input.fromValue,
    toDate: input.toValue,
    label: `${DAY_LABEL.format(
      new Date(from.year, from.month - 1, from.day),
    )} – ${DAY_LABEL.format(new Date(to.year, to.month - 1, to.day))}`,
  };
}

export function defaultDeudoresPeriodDraft(now = new Date()): {
  kind: DeudoresPeriodKind;
  monthValue: string;
  fromValue: string;
  toValue: string;
  year: number;
} {
  const today = toIsoDateValue(now);
  return {
    kind: "monthly",
    monthValue: toYearMonthValue(now),
    fromValue: today,
    toValue: today,
    year: now.getFullYear(),
  };
}

export { toYearMonthValue, toIsoDateValue, parseYearMonthValue, parseIsoDateValue };
