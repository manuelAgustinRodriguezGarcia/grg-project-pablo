import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import type {
  AdjustmentBucket,
  AdjustmentMonth,
  ClientBucket,
  DocumentCounts,
  MonthTotals,
  RubroBucket,
  RubroMonth,
  StatisticsAggregate,
  UnassignedBucket,
  UnassignedMonth,
} from "@/server/services/billing-statistics/aggregate";
import { emptyCounts } from "@/server/services/billing-statistics/aggregate";
import {
  formatMinorUnits,
  presentMoney,
  shareOf,
  subtractMoney,
  sumMoney,
  ZERO_MONEY,
  type MoneyParts,
  type ShareView,
} from "@/server/services/billing-statistics/money";
import {
  describePeriod,
  listMonths,
  type StatisticsRange,
} from "@/server/services/billing-statistics/periods";
import type { ResolvedStatisticsPeriod } from "@/server/services/billing-statistics/query";

export const STATISTICS_BASIS = {
  version: 1,
  comparableTo: "libro-iva",
  invoiceTotal: "totalVisualRounded",
  invoiceNet: "total - ivaAmount",
  invoiceVat: "ivaAmount",
  noteTotal: "signed amount",
  noteNet: "signed netAmount",
  noteVat: "signed ivaAmount",
  roundingGap: "total - (net + vat)",
  receipts: "excluded",
  noteRubros: "adjustments",
  cancelledInvoices: "included",
  periodBounds: "process-local-half-open",
  sharePercent: "null-when-total-not-positive",
  timeZoneNote:
    "Los límites usan la zona horaria del proceso, igual que el Libro de IVA. ARCA usa America/Argentina/Buenos_Aires y esta diferencia no se corrige acá.",
} as const;

type MoneyView = ReturnType<typeof presentMoney>;
type PeriodView = ReturnType<typeof describePeriod>;

export type StatisticsMonthlyPoint = {
  year: number;
  month: number;
  totals: MoneyView;
  counts: DocumentCounts;
};

export type StatisticsComparison = {
  period: PeriodView;
  totals: MoneyView;
  counts: DocumentCounts;
  delta: {
    totals: MoneyView;
    counts: DocumentCounts;
  };
  monthly: StatisticsMonthlyPoint[];
};

type RowComparison = {
  totals: MoneyView;
  counts: DocumentCounts;
  deltaTotals: MoneyView;
  deltaCounts: DocumentCounts;
};

export type StatisticsClientRow = {
  rank: number;
  key: string;
  clientId: string | null;
  identity: ClientBucket["identity"];
  clientCode: string;
  clientName: string;
  snapshotNames: string[];
  totals: MoneyView;
  counts: DocumentCounts;
  sharePercent: string | null;
  shareUnavailableReason: ShareView["unavailableReason"];
  comparison: RowComparison | null;
};

export type StatisticsSummary = {
  basis: typeof STATISTICS_BASIS;
  environment: BillingFiscalEnvironment;
  period: PeriodView;
  totals: MoneyView;
  counts: DocumentCounts;
  monthly: StatisticsMonthlyPoint[];
  reconciliation: ReturnType<typeof presentReconciliation>;
  comparison: StatisticsComparison | null;
};

type ClientDraft = {
  key: string;
  clientId: string | null;
  identity: ClientBucket["identity"];
  clientCode: string;
  clientName: string;
  snapshotNames: string[];
  totals: MoneyParts;
  counts: DocumentCounts;
  months: Map<string, MonthTotals>;
  label: string;
};

type RubroDraft = {
  key: string;
  rubroId: string | null;
  identity: RubroBucket["identity"];
  rubroCode: string;
  rubroName: string;
  snapshotNames: string[];
  totals: MoneyParts;
  lineCount: number;
  quantityHundredths: bigint;
  invoiceCount: number;
  months: Map<string, RubroMonth>;
  label: string;
};

export function presentSummary(input: {
  environment: BillingFiscalEnvironment;
  period: ResolvedStatisticsPeriod;
  current: StatisticsAggregate;
  comparison: {
    period: ResolvedStatisticsPeriod;
    aggregate: StatisticsAggregate;
  } | null;
}): StatisticsSummary {
  return {
    basis: STATISTICS_BASIS,
    environment: input.environment,
    period: describePeriod(input.period.mode, input.period.range),
    totals: presentMoney(input.current.totals),
    counts: input.current.counts,
    monthly: presentDocumentMonths(input.period.range, input.current.months),
    reconciliation: presentReconciliation(input.current),
    comparison: input.comparison
      ? presentComparison(input.current, input.comparison)
      : null,
  };
}

export function presentClients(input: {
  environment: BillingFiscalEnvironment;
  period: ResolvedStatisticsPeriod;
  current: StatisticsAggregate;
  comparison: {
    period: ResolvedStatisticsPeriod;
    aggregate: StatisticsAggregate;
  } | null;
  limit: number | null;
  clientKey: string | null;
}) {
  const ranked = rankDrafts(clientDrafts(input.current));
  const baseline = input.comparison
    ? new Map(clientDrafts(input.comparison.aggregate).map((row) => [row.key, row]))
    : null;
  const visible = input.limit === null ? ranked : ranked.slice(0, input.limit);
  const rows = visible.map((row) =>
    presentClientRow(row, input.current.totals.totalCents, baseline),
  );

  return {
    basis: STATISTICS_BASIS,
    environment: input.environment,
    period: describePeriod(input.period.mode, input.period.range),
    totals: presentMoney(input.current.totals),
    counts: input.current.counts,
    monthly: presentDocumentMonths(input.period.range, input.current.months),
    reconciliation: presentReconciliation(input.current),
    comparison: input.comparison
      ? presentComparison(input.current, input.comparison)
      : null,
    ranking: {
      order: "total-desc" as const,
      tieBreak: "name-asc" as const,
      rank: "competition" as const,
      limit: input.limit,
      totalGroups: ranked.length,
      returned: rows.length,
      rows,
    },
    entity: input.clientKey
      ? presentClientEntity({
          key: input.clientKey,
          ranked,
          currentRange: input.period.range,
          whole: input.current.totals.totalCents,
          comparison: input.comparison,
          baseline,
        })
      : null,
  };
}

export function presentRubros(input: {
  environment: BillingFiscalEnvironment;
  period: ResolvedStatisticsPeriod;
  current: StatisticsAggregate;
  comparison: {
    period: ResolvedStatisticsPeriod;
    aggregate: StatisticsAggregate;
  } | null;
  limit: number | null;
  rubroKey: string | null;
}) {
  const ranked = rankDrafts(rubroDrafts(input.current));
  const baselineRubros = input.comparison
    ? new Map(rubroDrafts(input.comparison.aggregate).map((row) => [row.key, row]))
    : null;
  const visible = input.limit === null ? ranked : ranked.slice(0, input.limit);
  const whole = input.current.totals.totalCents;

  return {
    basis: STATISTICS_BASIS,
    environment: input.environment,
    period: describePeriod(input.period.mode, input.period.range),
    totals: presentMoney(input.current.totals),
    counts: input.current.counts,
    monthly: presentDocumentMonths(input.period.range, input.current.months),
    reconciliation: presentReconciliation(input.current),
    comparison: input.comparison
      ? presentComparison(input.current, input.comparison)
      : null,
    ranking: {
      order: "total-desc" as const,
      tieBreak: "name-asc" as const,
      rank: "competition" as const,
      limit: input.limit,
      totalGroups: ranked.length,
      returned: visible.length,
      rows: visible.map((row) => presentRubroRow(row, whole, baselineRubros)),
    },
    unassigned: presentUnassigned(
      input.current.unassigned,
      whole,
      input.comparison?.aggregate.unassigned ?? null,
    ),
    adjustments: presentAdjustments(
      input.current.adjustments,
      whole,
      input.comparison?.aggregate.adjustments ?? null,
    ),
    entity: input.rubroKey
      ? presentRubroEntity({
          key: input.rubroKey,
          ranked,
          current: input.current,
          currentRange: input.period.range,
          whole,
          comparison: input.comparison,
          baselineRubros,
        })
      : null,
  };
}

function presentComparison(
  current: StatisticsAggregate,
  comparison: { period: ResolvedStatisticsPeriod; aggregate: StatisticsAggregate },
): StatisticsComparison {
  return {
    period: describePeriod(comparison.period.mode, comparison.period.range),
    totals: presentMoney(comparison.aggregate.totals),
    counts: comparison.aggregate.counts,
    delta: {
      totals: presentMoney(subtractMoney(current.totals, comparison.aggregate.totals)),
      counts: subtractCounts(current.counts, comparison.aggregate.counts),
    },
    monthly: presentDocumentMonths(comparison.period.range, comparison.aggregate.months),
  };
}

function presentReconciliation(aggregate: StatisticsAggregate) {
  const clients = sumMoney([...aggregate.clients.values()].map((client) => client.totals));
  const rubros = sumMoney([...aggregate.rubros.values()].map((rubro) => rubro.totals));
  const distributed = sumMoney([
    rubros,
    aggregate.unassigned.totals,
    aggregate.adjustments.totals,
  ]);
  const clientsMinusGeneral = subtractMoney(clients, aggregate.totals);
  const distributionMinusGeneral = subtractMoney(distributed, aggregate.totals);

  return {
    general: presentMoney(aggregate.totals),
    invoices: presentMoney(aggregate.invoiceTotals),
    notes: presentMoney(aggregate.noteTotals),
    clients: presentMoney(clients),
    rubros: presentMoney(rubros),
    unassigned: presentMoney(aggregate.unassigned.totals),
    adjustments: presentMoney(aggregate.adjustments.totals),
    clientsMinusGeneral: presentMoney(clientsMinusGeneral),
    distributionMinusGeneral: presentMoney(distributionMinusGeneral),
    clientsMatchGeneral: isZeroMoney(clientsMinusGeneral),
    distributionMatchGeneral: isZeroMoney(distributionMinusGeneral),
  };
}

function clientDrafts(aggregate: StatisticsAggregate): ClientDraft[] {
  return [...aggregate.clients.values()].map((client) => ({
    key: client.key,
    clientId: client.clientId,
    identity: client.identity,
    clientCode: client.clientCode,
    clientName: client.clientName,
    snapshotNames: [...client.snapshotNames].sort((left, right) =>
      left.localeCompare(right, "es-AR"),
    ),
    totals: client.totals,
    counts: client.counts,
    months: client.months,
    label: client.clientName,
  }));
}

function rubroDrafts(aggregate: StatisticsAggregate): RubroDraft[] {
  return [...aggregate.rubros.values()].map((rubro) => ({
    key: rubro.key,
    rubroId: rubro.rubroId,
    identity: rubro.identity,
    rubroCode: rubro.rubroCode,
    rubroName: rubro.rubroName,
    snapshotNames: [...rubro.snapshotNames].sort((left, right) =>
      left.localeCompare(right, "es-AR"),
    ),
    totals: rubro.totals,
    lineCount: rubro.lineCount,
    quantityHundredths: rubro.quantityHundredths,
    invoiceCount: rubro.invoiceIds.size,
    months: rubro.months,
    label: rubro.rubroName,
  }));
}

function rankDrafts<T extends { totals: MoneyParts; label: string; key: string }>(
  rows: T[],
): Array<T & { rank: number }> {
  const sorted = [...rows].sort((left, right) => {
    if (left.totals.totalCents !== right.totals.totalCents) {
      return left.totals.totalCents > right.totals.totalCents ? -1 : 1;
    }

    const byLabel = left.label.localeCompare(right.label, "es-AR");
    if (byLabel !== 0) {
      return byLabel;
    }

    return left.key.localeCompare(right.key, "es-AR");
  });

  let lastTotal: bigint | null = null;
  let rank = 0;
  return sorted.map((row, index) => {
    if (lastTotal === null || row.totals.totalCents !== lastTotal) {
      rank = index + 1;
      lastTotal = row.totals.totalCents;
    }

    return { ...row, rank };
  });
}

function presentClientRow(
  row: ClientDraft & { rank: number },
  whole: bigint,
  baseline: Map<string, ClientDraft> | null,
): StatisticsClientRow {
  const share = shareOf(row.totals.totalCents, whole);
  return {
    rank: row.rank,
    key: row.key,
    clientId: row.clientId,
    identity: row.identity,
    clientCode: row.clientCode,
    clientName: row.clientName,
    snapshotNames: row.snapshotNames,
    totals: presentMoney(row.totals),
    counts: row.counts,
    sharePercent: share.percent,
    shareUnavailableReason: share.unavailableReason,
    comparison: baseline ? presentRowComparison(row, baseline.get(row.key)) : null,
  };
}

function presentRowComparison(
  current: { totals: MoneyParts; counts: DocumentCounts },
  baseline: { totals: MoneyParts; counts: DocumentCounts } | undefined,
): RowComparison {
  const previousTotals = baseline?.totals ?? ZERO_MONEY;
  const previousCounts = baseline?.counts ?? emptyCounts();
  return {
    totals: presentMoney(previousTotals),
    counts: previousCounts,
    deltaTotals: presentMoney(subtractMoney(current.totals, previousTotals)),
    deltaCounts: subtractCounts(current.counts, previousCounts),
  };
}

function presentRubroRow(
  row: RubroDraft & { rank: number },
  whole: bigint,
  baseline: Map<string, RubroDraft> | null,
) {
  const share = shareOf(row.totals.totalCents, whole);
  const previous = baseline?.get(row.key);
  return {
    rank: row.rank,
    key: row.key,
    rubroId: row.rubroId,
    identity: row.identity,
    rubroCode: row.rubroCode,
    rubroName: row.rubroName,
    snapshotNames: row.snapshotNames,
    totals: presentMoney(row.totals),
    lineCount: row.lineCount,
    quantity: formatMinorUnits(row.quantityHundredths),
    invoiceCount: row.invoiceCount,
    sharePercent: share.percent,
    shareUnavailableReason: share.unavailableReason,
    comparison: baseline ? presentRubroComparison(row, previous) : null,
  };
}

function presentRubroComparison(
  current: RubroDraft,
  previous: RubroDraft | undefined,
) {
  const previousTotals = previous?.totals ?? ZERO_MONEY;
  const previousQuantity = previous?.quantityHundredths ?? BigInt(0);
  return {
    totals: presentMoney(previousTotals),
    lineCount: previous?.lineCount ?? 0,
    quantity: formatMinorUnits(previousQuantity),
    invoiceCount: previous?.invoiceCount ?? 0,
    deltaTotals: presentMoney(subtractMoney(current.totals, previousTotals)),
    deltaLineCount: current.lineCount - (previous?.lineCount ?? 0),
    deltaQuantity: formatMinorUnits(current.quantityHundredths - previousQuantity),
    deltaInvoiceCount: current.invoiceCount - (previous?.invoiceCount ?? 0),
  };
}

function presentUnassigned(
  current: UnassignedBucket,
  whole: bigint,
  baseline: UnassignedBucket | null,
) {
  const share = shareOf(current.totals.totalCents, whole);
  return {
    key: "unassigned" as const,
    label: "Sin rubro asignable",
    totals: presentMoney(current.totals),
    invoiceCount: current.invoiceCount,
    lineCount: current.lineCount,
    sharePercent: share.percent,
    shareUnavailableReason: share.unavailableReason,
    comparison: baseline
      ? {
          totals: presentMoney(baseline.totals),
          invoiceCount: baseline.invoiceCount,
          lineCount: baseline.lineCount,
          deltaTotals: presentMoney(subtractMoney(current.totals, baseline.totals)),
          deltaInvoiceCount: current.invoiceCount - baseline.invoiceCount,
          deltaLineCount: current.lineCount - baseline.lineCount,
        }
      : null,
  };
}

function presentAdjustments(
  current: AdjustmentBucket,
  whole: bigint,
  baseline: AdjustmentBucket | null,
) {
  const share = shareOf(current.totals.totalCents, whole);
  return {
    key: "adjustments" as const,
    label: "Ajustes sin rubro",
    totals: presentMoney(current.totals),
    counts: current.counts,
    sharePercent: share.percent,
    shareUnavailableReason: share.unavailableReason,
    comparison: baseline
      ? {
          totals: presentMoney(baseline.totals),
          counts: baseline.counts,
          deltaTotals: presentMoney(subtractMoney(current.totals, baseline.totals)),
          deltaCounts: subtractCounts(current.counts, baseline.counts),
        }
      : null,
  };
}

function presentClientEntity(input: {
  key: string;
  ranked: Array<ClientDraft & { rank: number }>;
  currentRange: StatisticsRange;
  whole: bigint;
  comparison: { period: ResolvedStatisticsPeriod; aggregate: StatisticsAggregate } | null;
  baseline: Map<string, ClientDraft> | null;
}) {
  const current = input.ranked.find((row) => row.key === input.key) ?? null;
  const previous = input.baseline?.get(input.key) ?? null;
  const source = current ?? previous;
  const totals = current?.totals ?? ZERO_MONEY;
  const counts = current?.counts ?? emptyCounts();
  const share = shareOf(totals.totalCents, input.whole);

  return {
    found: source !== null,
    key: input.key,
    clientId: source?.clientId ?? null,
    identity: source?.identity ?? null,
    clientCode: source?.clientCode ?? null,
    clientName: source?.clientName ?? null,
    snapshotNames: source?.snapshotNames ?? [],
    rank: current?.rank ?? null,
    totals: presentMoney(totals),
    counts,
    sharePercent: share.percent,
    shareUnavailableReason: share.unavailableReason,
    monthly: presentDocumentMonths(input.currentRange, current?.months ?? new Map()),
    comparison: input.comparison
      ? {
          totals: presentMoney(previous?.totals ?? ZERO_MONEY),
          counts: previous?.counts ?? emptyCounts(),
          deltaTotals: presentMoney(subtractMoney(totals, previous?.totals ?? ZERO_MONEY)),
          deltaCounts: subtractCounts(counts, previous?.counts ?? emptyCounts()),
          monthly: presentDocumentMonths(
            input.comparison.period.range,
            previous?.months ?? new Map(),
          ),
        }
      : null,
  };
}

function presentRubroEntity(input: {
  key: string;
  ranked: Array<RubroDraft & { rank: number }>;
  current: StatisticsAggregate;
  currentRange: StatisticsRange;
  whole: bigint;
  comparison: { period: ResolvedStatisticsPeriod; aggregate: StatisticsAggregate } | null;
  baselineRubros: Map<string, RubroDraft> | null;
}) {
  if (input.key === "adjustments") {
    return {
      found: true,
      kind: "adjustments" as const,
      key: input.key,
      rank: null,
      totals: presentMoney(input.current.adjustments.totals),
      counts: input.current.adjustments.counts,
      monthly: presentAdjustmentMonths(input.currentRange, input.current.adjustments.months),
      comparison: input.comparison
        ? {
            totals: presentMoney(input.comparison.aggregate.adjustments.totals),
            counts: input.comparison.aggregate.adjustments.counts,
            monthly: presentAdjustmentMonths(
              input.comparison.period.range,
              input.comparison.aggregate.adjustments.months,
            ),
          }
        : null,
    };
  }

  if (input.key === "unassigned") {
    return {
      found: true,
      kind: "unassigned" as const,
      key: input.key,
      rank: null,
      totals: presentMoney(input.current.unassigned.totals),
      invoiceCount: input.current.unassigned.invoiceCount,
      lineCount: input.current.unassigned.lineCount,
      monthly: presentUnassignedMonths(input.currentRange, input.current.unassigned.months),
      comparison: input.comparison
        ? {
            totals: presentMoney(input.comparison.aggregate.unassigned.totals),
            invoiceCount: input.comparison.aggregate.unassigned.invoiceCount,
            lineCount: input.comparison.aggregate.unassigned.lineCount,
            monthly: presentUnassignedMonths(
              input.comparison.period.range,
              input.comparison.aggregate.unassigned.months,
            ),
          }
        : null,
    };
  }

  const current = input.ranked.find((row) => row.key === input.key) ?? null;
  const previous = input.baselineRubros?.get(input.key) ?? null;
  const source = current ?? previous;
  const totals = current?.totals ?? ZERO_MONEY;
  const share = shareOf(totals.totalCents, input.whole);

  return {
    found: source !== null,
    kind: "rubro" as const,
    key: input.key,
    rubroId: source?.rubroId ?? null,
    identity: source?.identity ?? null,
    rubroCode: source?.rubroCode ?? null,
    rubroName: source?.rubroName ?? null,
    snapshotNames: source?.snapshotNames ?? [],
    rank: current?.rank ?? null,
    totals: presentMoney(totals),
    lineCount: current?.lineCount ?? 0,
    quantity: formatMinorUnits(current?.quantityHundredths ?? BigInt(0)),
    invoiceCount: current?.invoiceCount ?? 0,
    sharePercent: share.percent,
    shareUnavailableReason: share.unavailableReason,
    monthly: presentRubroMonths(input.currentRange, current?.months ?? new Map()),
    comparison: input.comparison
      ? {
          totals: presentMoney(previous?.totals ?? ZERO_MONEY),
          lineCount: previous?.lineCount ?? 0,
          quantity: formatMinorUnits(previous?.quantityHundredths ?? BigInt(0)),
          invoiceCount: previous?.invoiceCount ?? 0,
          monthly: presentRubroMonths(
            input.comparison.period.range,
            previous?.months ?? new Map(),
          ),
        }
      : null,
  };
}

function presentDocumentMonths(
  range: StatisticsRange,
  months: Map<string, MonthTotals>,
): StatisticsMonthlyPoint[] {
  return listMonths(range).map((point) => {
    const bucket = months.get(point.key);
    return {
      year: point.year,
      month: point.month,
      totals: presentMoney(bucket?.totals ?? ZERO_MONEY),
      counts: bucket?.counts ?? emptyCounts(),
    };
  });
}

function presentRubroMonths(range: StatisticsRange, months: Map<string, RubroMonth>) {
  return listMonths(range).map((point) => {
    const bucket = months.get(point.key);
    return {
      year: point.year,
      month: point.month,
      totals: presentMoney(bucket?.totals ?? ZERO_MONEY),
      lineCount: bucket?.lineCount ?? 0,
      quantity: formatMinorUnits(bucket?.quantityHundredths ?? BigInt(0)),
      invoiceCount: bucket?.invoiceIds.size ?? 0,
    };
  });
}

function presentUnassignedMonths(
  range: StatisticsRange,
  months: Map<string, UnassignedMonth>,
) {
  return listMonths(range).map((point) => {
    const bucket = months.get(point.key);
    return {
      year: point.year,
      month: point.month,
      totals: presentMoney(bucket?.totals ?? ZERO_MONEY),
      invoiceCount: bucket?.invoiceCount ?? 0,
      lineCount: bucket?.lineCount ?? 0,
    };
  });
}

function presentAdjustmentMonths(
  range: StatisticsRange,
  months: Map<string, AdjustmentMonth>,
) {
  return listMonths(range).map((point) => {
    const bucket = months.get(point.key);
    return {
      year: point.year,
      month: point.month,
      totals: presentMoney(bucket?.totals ?? ZERO_MONEY),
      counts: bucket?.counts ?? emptyCounts(),
    };
  });
}

function subtractCounts(current: DocumentCounts, baseline: DocumentCounts): DocumentCounts {
  return {
    invoiceCount: current.invoiceCount - baseline.invoiceCount,
    creditNoteCount: current.creditNoteCount - baseline.creditNoteCount,
    debitNoteCount: current.debitNoteCount - baseline.debitNoteCount,
    documentCount: current.documentCount - baseline.documentCount,
  };
}

function isZeroMoney(money: MoneyParts): boolean {
  return (
    money.netCents === BigInt(0) && money.vatCents === BigInt(0) && money.totalCents === BigInt(0)
  );
}
