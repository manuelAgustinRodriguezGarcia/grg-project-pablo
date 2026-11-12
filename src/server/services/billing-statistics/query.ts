import {
  statisticsSearchParamsSchema,
  statisticsYearSearchParamsSchema,
  type StatisticsPeriodMode,
} from "@/features/billing/schemas/billing-statistics.schemas";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import {
  statisticsCustomRange,
  statisticsMonthRange,
  statisticsYearRange,
  type StatisticsRange,
} from "@/server/services/billing-statistics/periods";

const FORBIDDEN_PARAMS = new Set([
  "environment",
  "fiscalEnvironment",
  "fiscalStatus",
]);

const CLIENT_KEY = /^(?:client:[A-Za-z0-9_-]{1,64}|historical:[A-Za-z0-9_-]{1,1500})$/;
const RUBRO_KEY =
  /^(?:adjustments|unassigned|rubro:[A-Za-z0-9_-]{1,64}|historical:[A-Za-z0-9_-]{1,1500})$/;

export type StatisticsQueryScope = "summary" | "clients" | "rubros";

export type ResolvedStatisticsPeriod = {
  mode: StatisticsPeriodMode;
  range: StatisticsRange;
};

export type ResolvedStatisticsQuery = {
  scope: StatisticsQueryScope;
  period: ResolvedStatisticsPeriod;
  comparison: ResolvedStatisticsPeriod | null;
  limit: number | null;
  clientKey: string | null;
  rubroKey: string | null;
};

export function parseStatisticsYearQuery(searchParams: URLSearchParams): number {
  const raw = readSearchParams(searchParams);
  const parsed = statisticsYearSearchParamsSchema.safeParse(raw);
  if (!parsed.success) {
    const unrecognized = parsed.error.issues.some(
      (issue) => issue.code === "unrecognized_keys",
    );
    throw new BillingInvoiceError(
      unrecognized
        ? "La consulta incluye un parámetro que no está permitido."
        : "Indicá un año válido.",
      "VALIDATION_ERROR",
    );
  }

  const year = Number(parsed.data.year);
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new BillingInvoiceError("Indicá un año válido.", "VALIDATION_ERROR");
  }

  return year;
}

export function parseStatisticsQuery(
  searchParams: URLSearchParams,
  scope: StatisticsQueryScope,
): ResolvedStatisticsQuery {
  const raw = readSearchParams(searchParams);
  const parsed = statisticsSearchParamsSchema.safeParse(raw);
  if (!parsed.success) {
    const unrecognized = parsed.error.issues.some(
      (issue) => issue.code === "unrecognized_keys",
    );
    throw new BillingInvoiceError(
      unrecognized
        ? "La consulta incluye un parámetro que no está permitido."
        : "Los parámetros de la consulta no son válidos.",
      "VALIDATION_ERROR",
    );
  }

  const input = parsed.data;
  assertScopeParams(scope, input);

  return {
    scope,
    period: resolvePeriod({
      mode: input.period,
      year: input.year,
      month: input.month,
      from: input.from,
      to: input.to,
    }),
    comparison: input.comparePeriod
      ? resolvePeriod({
          mode: input.comparePeriod,
          year: input.compareYear,
          month: input.compareMonth,
          from: input.compareFrom,
          to: input.compareTo,
        })
      : null,
    limit: input.limit ? Number(input.limit) : null,
    clientKey: input.clientKey ?? null,
    rubroKey: input.rubroKey ?? null,
  };
}

function readSearchParams(searchParams: URLSearchParams): Record<string, string> {
  const raw: Record<string, string> = {};

  for (const [key, value] of searchParams.entries()) {
    if (FORBIDDEN_PARAMS.has(key)) {
      throw new BillingInvoiceError(
        "El ambiente fiscal activo no se puede cambiar desde la consulta.",
        "VALIDATION_ERROR",
      );
    }

    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      throw new BillingInvoiceError(
        "La consulta repite un parámetro.",
        "VALIDATION_ERROR",
      );
    }

    raw[key] = value;
  }

  return raw;
}

function assertScopeParams(
  scope: StatisticsQueryScope,
  input: {
    limit?: string;
    clientKey?: string;
    rubroKey?: string;
    comparePeriod?: StatisticsPeriodMode;
    compareYear?: string;
    compareMonth?: string;
    compareFrom?: string;
    compareTo?: string;
  },
): void {
  switch (scope) {
    case "summary":
      rejectPresent(input.limit, "Este recurso no admite limit.");
      rejectPresent(input.clientKey, "Este recurso no admite clientKey.");
      rejectPresent(input.rubroKey, "Este recurso no admite rubroKey.");
      break;
    case "clients":
      rejectPresent(input.rubroKey, "Este recurso no admite rubroKey.");
      if (input.clientKey) {
        assertKey(CLIENT_KEY, input.clientKey, "La clave de cliente no es válida.");
      }
      break;
    case "rubros":
      rejectPresent(input.clientKey, "Este recurso no admite clientKey.");
      if (input.rubroKey) {
        assertKey(RUBRO_KEY, input.rubroKey, "La clave de rubro no es válida.");
      }
      break;
    default: {
      const unexpected: never = scope;
      throw new BillingInvoiceError(unexpected, "VALIDATION_ERROR");
    }
  }

  if (!input.comparePeriod) {
    rejectPresent(input.compareYear, "La comparación necesita comparePeriod.");
    rejectPresent(input.compareMonth, "La comparación necesita comparePeriod.");
    rejectPresent(input.compareFrom, "La comparación necesita comparePeriod.");
    rejectPresent(input.compareTo, "La comparación necesita comparePeriod.");
  }
}

function rejectPresent(value: string | undefined, message: string): void {
  if (value !== undefined) {
    throw new BillingInvoiceError(message, "VALIDATION_ERROR");
  }
}

function assertKey(pattern: RegExp, value: string, message: string): void {
  if (!pattern.test(value)) {
    throw new BillingInvoiceError(message, "VALIDATION_ERROR");
  }
}

function resolvePeriod(input: {
  mode: StatisticsPeriodMode;
  year?: string;
  month?: string;
  from?: string;
  to?: string;
}): ResolvedStatisticsPeriod {
  try {
    switch (input.mode) {
      case "month": {
        rejectPresent(input.from, "El período mensual no admite un rango.");
        rejectPresent(input.to, "El período mensual no admite un rango.");
        const year = requireInteger(input.year, "Indicá el año.");
        const month = requireInteger(input.month, "Indicá el mes.");
        return { mode: "month", range: statisticsMonthRange(year, month) };
      }
      case "year": {
        rejectPresent(input.month, "El año completo no admite un mes.");
        rejectPresent(input.from, "El año completo no admite un rango.");
        rejectPresent(input.to, "El año completo no admite un rango.");
        const year = requireInteger(input.year, "Indicá el año.");
        return { mode: "year", range: statisticsYearRange(year) };
      }
      case "custom": {
        rejectPresent(input.year, "El rango personalizado no admite year.");
        rejectPresent(input.month, "El rango personalizado no admite month.");
        if (!input.from || !input.to) {
          throw new BillingInvoiceError(
            "Indicá un rango de fechas válido.",
            "VALIDATION_ERROR",
          );
        }
        return { mode: "custom", range: statisticsCustomRange(input.from, input.to) };
      }
      default: {
        const unexpected: never = input.mode;
        throw new BillingInvoiceError(unexpected, "VALIDATION_ERROR");
      }
    }
  } catch (error) {
    if (error instanceof BillingInvoiceError) {
      throw error;
    }

    throw new BillingInvoiceError(
      error instanceof Error ? error.message : "Indicá un período válido.",
      "VALIDATION_ERROR",
    );
  }
}

function requireInteger(value: string | undefined, message: string): number {
  if (!value) {
    throw new BillingInvoiceError(message, "VALIDATION_ERROR");
  }

  return Number(value);
}
