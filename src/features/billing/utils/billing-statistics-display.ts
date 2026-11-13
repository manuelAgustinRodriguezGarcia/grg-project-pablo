import { formatArsExact } from "@/features/billing/utils/format-ars";
import { STATISTICS_MONTHS } from "@/features/billing/utils/billing-statistics-period";
import type {
  StatisticsClientEntity,
  StatisticsMonthAmount,
  StatisticsRubroEntity,
  StatisticsShareReason,
} from "@/features/billing/types/billing-statistics.types";

const ZERO = BigInt(0);
const TWO = BigInt(2);
const HUNDRED = BigInt(100);
const TEN_THOUSAND = BigInt(10000);
const DECIMAL_2 = /^-?\d+\.\d{2}$/;

export const STATISTICS_RANK_LIMIT = 10;
export const STATISTICS_PIE_LIMIT = 6;

export type StatisticsChartPoint = {
  key: string;
  label: string;
  axisLabel?: string;
  total: string;
  amount: number;
  comparisonTotal: string | null;
  comparisonAmount: number | null;
  active: boolean;
  muted?: boolean;
  month?: number;
};

export type ParticipationChart =
  | { status: "hidden" }
  | { status: "unavailable"; reason: string }
  | {
      status: "ready";
      slices: Array<{ key: string; label: string; total: string }>;
    };

export type EntityPanelModel = {
  found: boolean;
  title: string;
  code: string | null;
  historical: boolean;
  total: string;
  net: string;
  vat: string;
  sharePercent: string | null;
  shareUnavailableReason: StatisticsShareReason;
  secondary: string;
  monthly: StatisticsMonthAmount[];
  comparisonTotal: string | null;
  comparisonDelta: string | null;
  comparisonMonthly: StatisticsMonthAmount[] | null;
  missing: string;
};

export function statisticsAmountCents(value: string): bigint {
  if (!DECIMAL_2.test(value)) {
    throw new Error("Importe inválido.");
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction] = unsigned.split(".");
  const cents = BigInt(whole) * HUNDRED + BigInt(fraction);
  return negative ? -cents : cents;
}

export function centsToAmountString(cents: bigint): string {
  const negative = cents < ZERO;
  const absolute = negative ? -cents : cents;
  const whole = absolute / HUNDRED;
  const fraction = (absolute % HUNDRED).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

export function statisticsAmountNumber(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatStatisticsAmount(value: string): string {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const numeric = Number(unsigned);

  if (Number.isFinite(numeric) && numeric.toFixed(2) === unsigned) {
    return formatArsExact(negative ? -numeric : numeric);
  }

  const cents = statisticsAmountCents(value);
  const centsNegative = cents < ZERO;
  const absolute = centsNegative ? -cents : cents;
  const whole = absolute / HUNDRED;
  const fraction = (absolute % HUNDRED).toString().padStart(2, "0");
  const grouped = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(Number(whole.toString()));
  return `${centsNegative ? "-" : ""}$ ${grouped},${fraction}`;
}

export function formatStatisticsDelta(value: string): string {
  const formatted = formatStatisticsAmount(value);
  if (value.startsWith("-") || statisticsAmountCents(value) === ZERO) {
    return formatted;
  }
  return `+${formatted}`;
}

export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${Math.abs(count) === 1 ? singular : plural}`;
}

export function formatStatisticsQuantity(value: string): string {
  if (!DECIMAL_2.test(value)) {
    return value;
  }

  const cents = statisticsAmountCents(value);
  const negative = cents < ZERO;
  const absolute = negative ? -cents : cents;
  const whole = (absolute + BigInt(50)) / HUNDRED;
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped}`;
}

export function formatSharePercent(percent: string | null): string {
  if (percent === null || !DECIMAL_2.test(percent)) {
    return "—";
  }

  const negative = percent.startsWith("-");
  const [whole, fraction] = (negative ? percent.slice(1) : percent).split(".");
  return `${negative ? "-" : ""}${whole},${fraction} %`;
}

export function shareUnavailableText(reason: StatisticsShareReason): string | null {
  switch (reason) {
    case null:
      return null;
    case "ZERO_TOTAL":
      return "Sin participación: el total del período es cero.";
    case "NEGATIVE_TOTAL":
      return "Sin participación: el total del período es negativo.";
    default: {
      const unexpected: never = reason;
      return unexpected;
    }
  }
}

export function statisticsGrowthLabel(
  currentTotal: string,
  baselineTotal: string,
): string | null {
  const baseline = statisticsAmountCents(baselineTotal);
  const current = statisticsAmountCents(currentTotal);
  if (baseline <= ZERO) {
    return null;
  }

  const delta = current - baseline;
  const negative = delta < ZERO;
  const absolute = negative ? -delta : delta;
  const rounded = (absolute * TEN_THOUSAND + baseline / TWO) / baseline;
  const whole = rounded / HUNDRED;
  const fraction = (rounded % HUNDRED).toString().padStart(2, "0");
  return `${negative ? "-" : "+"}${whole.toString()},${fraction} %`;
}

export function comparisonSecondary(
  currentTotal: string,
  comparedTotal: string,
  deltaTotal: string,
): string {
  const growth = statisticsGrowthLabel(currentTotal, comparedTotal);
  const text = `Comparado: ${formatStatisticsAmount(comparedTotal)} · Diferencia: ${formatStatisticsDelta(deltaTotal)}`;
  return growth ? `${text} · ${growth}` : text;
}

export function hasVisibleRoundingGap(gap: string): boolean {
  return gap !== "0.00" && gap !== "-0.00";
}

export function buildEvolutionPoints(input: {
  monthly: readonly StatisticsMonthAmount[];
  comparisonMonthly: readonly StatisticsMonthAmount[] | null;
  activeMonth: number | null;
  selectedMonths?: readonly number[] | null;
}): { points: StatisticsChartPoint[]; comparisonApplied: boolean } {
  const comparison = input.comparisonMonthly;
  const comparisonApplied =
    comparison !== null &&
    comparison.length === input.monthly.length &&
    comparison.length > 0 &&
    comparison.every((point, index) => point.month === input.monthly[index]?.month);
  const spansYears = new Set(input.monthly.map((point) => point.year)).size > 1;
  const selected = input.selectedMonths;

  return {
    comparisonApplied,
    points: input.monthly.map((point, index) => {
      const compared = comparisonApplied ? comparison[index] : null;
      const shortLabel = spansYears
        ? `${point.month.toString().padStart(2, "0")}/${point.year}`
        : monthShortLabel(point.month);
      const active = selected
        ? selected.includes(point.month)
        : input.activeMonth === point.month && !spansYears;

      return {
        key: `${point.year}-${point.month}`,
        label: spansYears ? shortLabel : STATISTICS_MONTHS[point.month - 1]?.name ?? shortLabel,
        axisLabel: shortLabel,
        total: point.total,
        amount: statisticsAmountNumber(point.total),
        comparisonTotal: compared ? compared.total : null,
        comparisonAmount: compared ? statisticsAmountNumber(compared.total) : null,
        active,
        muted: selected ? !selected.includes(point.month) : false,
        month: point.month,
      };
    }),
  };
}

export function monthShortLabel(month: number): string {
  const labels = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  return labels[month - 1] ?? String(month);
}

export function evolutionHasActivity(months: readonly StatisticsMonthAmount[]): boolean {
  return months.some(
    (month) => statisticsAmountCents(month.total) !== ZERO || month.documentCount > 0,
  );
}

export function buildParticipationChart(input: {
  rows: readonly { key: string; label: string; total: string }[];
  totalGroups: number;
  othersLabel: string;
}): ParticipationChart {
  if (input.rows.length !== input.totalGroups) {
    return {
      status: "unavailable",
      reason: "El listado está incompleto, así que no se calcula la categoría Otros.",
    };
  }

  if (input.rows.length === 0 || input.rows.every((row) => statisticsAmountCents(row.total) === ZERO)) {
    return { status: "hidden" };
  }

  if (input.rows.some((row) => statisticsAmountCents(row.total) < ZERO)) {
    return {
      status: "unavailable",
      reason:
        "Hay importes negativos. El gráfico de torta no los representa como participación positiva.",
    };
  }

  const positive = input.rows.filter((row) => statisticsAmountCents(row.total) > ZERO);
  if (positive.length === 0) {
    return { status: "hidden" };
  }

  if (positive.length <= STATISTICS_PIE_LIMIT) {
    return {
      status: "ready",
      slices: positive.map((row) => ({
        key: row.key,
        label: row.label,
        total: row.total,
      })),
    };
  }

  const named = positive.slice(0, STATISTICS_PIE_LIMIT);
  const restCents = positive
    .slice(STATISTICS_PIE_LIMIT)
    .reduce((sum, row) => sum + statisticsAmountCents(row.total), ZERO);

  return {
    status: "ready",
    slices: [
      ...named.map((row) => ({ key: row.key, label: row.label, total: row.total })),
      {
        key: "others",
        label: input.othersLabel,
        total: centsToAmountString(restCents),
      },
    ],
  };
}

export function clientEntityPanel(entity: StatisticsClientEntity): EntityPanelModel {
  return {
    found: entity.found,
    title: entity.clientName ?? "Cliente sin nombre",
    code: entity.clientCode,
    historical: entity.identity === "historical-snapshot",
    total: entity.totals.total,
    net: entity.totals.net,
    vat: entity.totals.vat,
    sharePercent: entity.sharePercent,
    shareUnavailableReason: entity.shareUnavailableReason,
    secondary: countLabel(entity.counts.documentCount, "factura", "facturas"),
    monthly: entity.monthly,
    comparisonTotal: entity.comparison?.totals.total ?? null,
    comparisonDelta: entity.comparison?.deltaTotals.total ?? null,
    comparisonMonthly: entity.comparison?.monthly ?? null,
    missing: "No hay movimientos de este cliente en el período.",
  };
}

export function rubroEntityPanel(
  entity: StatisticsRubroEntity,
  comparisonDelta: string | null = null,
): EntityPanelModel {
  switch (entity.kind) {
    case "rubro":
      return {
        found: entity.found,
        title: entity.rubroName ?? "Rubro sin nombre",
        code: entity.rubroCode,
        historical: entity.identity === "historical-snapshot",
        total: entity.totals.total,
        net: entity.totals.net,
        vat: entity.totals.vat,
        sharePercent: entity.sharePercent,
        shareUnavailableReason: entity.shareUnavailableReason,
        secondary: `${countLabel(entity.invoiceCount, "factura vinculada", "facturas vinculadas")} · ${formatStatisticsQuantity(entity.quantity)} unidades`,
        monthly: entity.monthly,
        comparisonTotal: entity.comparison?.totals.total ?? null,
        comparisonDelta,
        comparisonMonthly: entity.comparison?.monthly ?? null,
        missing: "No hay movimientos de este rubro en el período.",
      };
    case "adjustments":
      return reservedPanel(entity, "Ajustes sin rubro", countLabel(entity.counts.documentCount, "comprobante", "comprobantes"));
    case "unassigned":
      return reservedPanel(
        entity,
        "Sin rubro asignable",
        `${countLabel(entity.lineCount, "línea", "líneas")} · ${countLabel(entity.invoiceCount, "factura", "facturas")}`,
      );
    default: {
      const unexpected: never = entity;
      return unexpected;
    }
  }
}

function reservedPanel(
  entity: Extract<StatisticsRubroEntity, { kind: "adjustments" | "unassigned" }>,
  title: string,
  secondary: string,
): EntityPanelModel {
  return {
    found: true,
    title,
    code: null,
    historical: false,
    total: entity.totals.total,
    net: entity.totals.net,
    vat: entity.totals.vat,
    sharePercent: null,
    shareUnavailableReason: null,
    secondary,
    monthly: entity.monthly,
    comparisonTotal: entity.comparison?.totals.total ?? null,
    comparisonDelta: null,
    comparisonMonthly: entity.comparison?.monthly ?? null,
    missing: "No hay movimientos en el período.",
  };
}
