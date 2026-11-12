import type {
  StatisticsCountsView,
  StatisticsMoneyView,
  StatisticsMonthAmount,
  StatisticsReconciliationView,
  StatisticsShareReason,
  StatisticsYearClientSlice,
  StatisticsYearMonth,
  StatisticsYearNote,
  StatisticsYearResponse,
  StatisticsYearRubroSlice,
} from "@/features/billing/types/billing-statistics.types";
import {
  centsToAmountString,
  formatSharePercent,
  formatStatisticsAmount,
  statisticsAmountCents,
  statisticsGrowthLabel,
} from "@/features/billing/utils/billing-statistics-display";
import { STATISTICS_MONTHS } from "@/features/billing/utils/billing-statistics-period";
import {
  isNewerDocumentLabel,
  isNewerRubroSnapshot,
} from "@/server/services/billing-statistics/labels";
import { shareOf } from "@/server/services/billing-statistics/money";

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

const ZERO_MONEY: StatisticsMoneyView = {
  net: "0.00",
  vat: "0.00",
  total: "0.00",
  roundingGap: "0.00",
};

const ZERO_COUNTS: StatisticsCountsView = {
  invoiceCount: 0,
  creditNoteCount: 0,
  debitNoteCount: 0,
  documentCount: 0,
};

export type StatisticsMonthState = "future" | "partial" | "empty" | "recorded";

export type StatisticsMonthVariation = {
  referenceMonth: number;
  referenceName: string;
  delta: string;
  percent: string | null;
  skipped: boolean;
};

export type StatisticsSelectedMonth = {
  year: number;
  month: number;
  name: string;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  state: StatisticsMonthState;
  variation: StatisticsMonthVariation | null;
};

export type StatisticsRankedClient = {
  key: string;
  rank: number;
  name: string;
  code: string;
  historical: boolean;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  sharePercent: string | null;
  shareUnavailableReason: StatisticsShareReason;
  monthly: StatisticsMonthAmount[];
};

export type StatisticsRankedRubro = {
  key: string;
  rank: number;
  name: string;
  code: string;
  historical: boolean;
  totals: StatisticsMoneyView;
  lineCount: number;
  quantity: string;
  invoiceCount: number;
  sharePercent: string | null;
  shareUnavailableReason: StatisticsShareReason;
  monthly: StatisticsMonthAmount[];
};

export type StatisticsMonthLeader = {
  month: number;
  name: string;
  state: StatisticsMonthState;
  names: string[];
  total: string | null;
};

export type StatisticsMover = {
  key: string;
  name: string;
  delta: string;
  percent: string | null;
  earlierMonth: number;
  laterMonth: number;
  earlierName: string;
  laterName: string;
  skipped: boolean;
};

export type StatisticsExtremes = {
  months: number[];
  names: string[];
  total: string;
};

export type StatisticsSelectionView = {
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  averageTotal: string;
  reconciliation: StatisticsReconciliationView;
  chartMonths: StatisticsMonthAmount[];
  selectedMonths: StatisticsSelectedMonth[];
  best: StatisticsExtremes | null;
  worst: StatisticsExtremes | null;
  spreadAmount: string | null;
  spreadPercent: string | null;
  busiest: { months: number[]; names: string[]; invoiceCount: number } | null;
  clients: StatisticsRankedClient[];
  rubros: StatisticsRankedRubro[];
  clientLeaders: StatisticsMonthLeader[];
  rubroLeaders: StatisticsMonthLeader[];
  clientIncreases: StatisticsMover[];
  clientDecreases: StatisticsMover[];
  rubroIncreases: StatisticsMover[];
  rubroDecreases: StatisticsMover[];
  conclusions: string[];
  notes: StatisticsYearNote[];
  creditNotes: StatisticsMoneyView;
  debitNotes: StatisticsMoneyView;
};

type CalendarToday = {
  year: number;
  month: number;
};

type ClientFold = {
  key: string;
  clientId: string | null;
  identity: StatisticsYearClientSlice["identity"];
  clientCode: string;
  clientName: string;
  labelIssuedAt: number;
  labelNumber: string;
  totals: StatisticsMoneyView;
  counts: StatisticsCountsView;
  monthly: Map<number, StatisticsMoneyView>;
};

type RubroFold = {
  key: string;
  rubroId: string | null;
  identity: StatisticsYearRubroSlice["identity"];
  rubroCode: string;
  rubroName: string;
  labelIssuedAt: number;
  labelSortOrder: number;
  labelNumber: string;
  totals: StatisticsMoneyView;
  lineCount: number;
  quantityCents: bigint;
  invoiceCount: number;
  monthly: Map<number, StatisticsMoneyView>;
};

export function combineStatisticsYear(
  year: StatisticsYearResponse,
  selectedMonths: readonly number[],
  today: CalendarToday,
): StatisticsSelectionView | null {
  const selected = normalizeMonths(selectedMonths);
  if (selected.length === 0) {
    return null;
  }

  const byMonth = new Map(year.months.map((month) => [month.month, month]));
  const slices = selected.map((month) => {
    const source = byMonth.get(month);
    if (!source || source.year !== year.year) {
      throw new Error("El paquete anual no tiene ese mes.");
    }
    return source;
  });

  const totals = sumMoney(slices.map((slice) => slice.totals));
  const counts = sumCounts(slices.map((slice) => slice.counts));
  const selectedRows = buildSelectedRows(slices, today);
  const clients = rankClients(slices, statisticsAmountCents(totals.total));
  const rubros = rankRubros(slices, statisticsAmountCents(totals.total));
  const comparable = selectedRows.filter((row) => row.state !== "future");
  const best = extremes(comparable, "best");
  const worst = extremes(comparable, "worst");
  const spread = spreadBetween(best, worst);
  const notes = year.notes.filter((note) => selected.includes(note.month));
  const view: StatisticsSelectionView = {
    totals,
    counts,
    averageTotal: divideMoney(totals.total, selected.length),
    reconciliation: buildReconciliation(slices, clients, rubros, totals),
    chartMonths: year.months.map((month) => ({
      year: month.year,
      month: month.month,
      total: month.totals.total,
      documentCount: month.counts.documentCount,
    })),
    selectedMonths: selectedRows,
    best,
    worst,
    spreadAmount: spread?.amount ?? null,
    spreadPercent: spread?.percent ?? null,
    busiest: busiestMonths(comparable),
    clients,
    rubros,
    clientLeaders: leaders(slices, today, "clients"),
    rubroLeaders: leaders(slices, today, "rubros"),
    clientIncreases: [],
    clientDecreases: [],
    rubroIncreases: [],
    rubroDecreases: [],
    conclusions: [],
    notes,
    creditNotes: sumMoney(slices.map((slice) => slice.creditNotes)),
    debitNotes: sumMoney(slices.map((slice) => slice.debitNotes)),
  };

  const clientMovement = movers(slices, today, "clients");
  const rubroMovement = movers(slices, today, "rubros");
  view.clientIncreases = clientMovement.increases;
  view.clientDecreases = clientMovement.decreases;
  view.rubroIncreases = rubroMovement.increases;
  view.rubroDecreases = rubroMovement.decreases;
  view.conclusions = buildConclusions(view);
  return view;
}

function normalizeMonths(months: readonly number[]): number[] {
  return [...new Set(months)]
    .filter((month) => month >= 1 && month <= 12)
    .sort((left, right) => left - right);
}

function buildSelectedRows(
  slices: readonly StatisticsYearMonth[],
  today: CalendarToday,
): StatisticsSelectedMonth[] {
  return slices.map((slice, index) => {
    const state = monthState(slice, today);
    const previous = index > 0 ? slices[index - 1] : null;
    const variation = previous && state !== "future" && monthState(previous, today) !== "future"
      ? variationAgainst(slice, previous)
      : null;

    return {
      year: slice.year,
      month: slice.month,
      name: monthName(slice.month),
      totals: slice.totals,
      counts: slice.counts,
      state,
      variation,
    };
  });
}

function monthState(
  slice: StatisticsYearMonth,
  today: CalendarToday,
): StatisticsMonthState {
  if (slice.year > today.year || (slice.year === today.year && slice.month > today.month)) {
    return "future";
  }

  if (slice.year === today.year && slice.month === today.month) {
    return "partial";
  }

  if (
    slice.counts.documentCount === 0 &&
    statisticsAmountCents(slice.totals.total) === ZERO
  ) {
    return "empty";
  }

  return "recorded";
}

function variationAgainst(
  current: StatisticsYearMonth,
  reference: StatisticsYearMonth,
): StatisticsMonthVariation {
  const delta = centsToAmountString(
    statisticsAmountCents(current.totals.total) - statisticsAmountCents(reference.totals.total),
  );

  return {
    referenceMonth: reference.month,
    referenceName: monthName(reference.month),
    delta,
    percent: statisticsGrowthLabel(current.totals.total, reference.totals.total),
    skipped: current.month - reference.month > 1,
  };
}

function extremes(
  rows: readonly StatisticsSelectedMonth[],
  which: "best" | "worst",
): StatisticsExtremes | null {
  if (rows.length < 2) {
    return null;
  }

  const target = rows.reduce((chosen, row) => {
    const rowCents = statisticsAmountCents(row.totals.total);
    const chosenCents = statisticsAmountCents(chosen.totals.total);
    if (rowCents === chosenCents) {
      return chosen;
    }
    const rowWins = which === "best" ? rowCents > chosenCents : rowCents < chosenCents;
    return rowWins ? row : chosen;
  });
  const total = target.totals.total;
  const tied = rows.filter((row) => row.totals.total === total);

  return {
    months: tied.map((row) => row.month),
    names: tied.map((row) => row.name),
    total,
  };
}

function spreadBetween(
  best: StatisticsExtremes | null,
  worst: StatisticsExtremes | null,
): { amount: string; percent: string | null } | null {
  if (!best || !worst || best.total === worst.total) {
    return null;
  }

  const amount = centsToAmountString(
    absCents(statisticsAmountCents(best.total) - statisticsAmountCents(worst.total)),
  );
  const percent = statisticsAmountCents(worst.total) > ZERO
    ? statisticsGrowthLabel(best.total, worst.total)
    : null;

  return { amount, percent };
}

function busiestMonths(rows: readonly StatisticsSelectedMonth[]) {
  if (rows.length === 0 || rows.every((row) => row.counts.invoiceCount === 0)) {
    return null;
  }

  const max = Math.max(...rows.map((row) => row.counts.invoiceCount));
  const tied = rows.filter((row) => row.counts.invoiceCount === max);
  return {
    months: tied.map((row) => row.month),
    names: tied.map((row) => row.name),
    invoiceCount: max,
  };
}

function rankClients(
  slices: readonly StatisticsYearMonth[],
  whole: bigint,
): StatisticsRankedClient[] {
  const folded = new Map<string, ClientFold>();

  for (const slice of slices) {
    for (const client of slice.clients) {
      const current = folded.get(client.key);
      if (!current) {
        folded.set(client.key, {
          key: client.key,
          clientId: client.clientId,
          identity: client.identity,
          clientCode: client.clientCode,
          clientName: client.clientName,
          labelIssuedAt: client.labelIssuedAt,
          labelNumber: client.labelNumber,
          totals: client.totals,
          counts: client.counts,
          monthly: new Map([[slice.month, client.totals]]),
        });
        continue;
      }

      if (
        isNewerDocumentLabel(
          current.labelIssuedAt,
          current.labelNumber,
          client.labelIssuedAt,
          client.labelNumber,
        )
      ) {
        current.clientCode = client.clientCode;
        current.clientName = client.clientName;
        current.labelIssuedAt = client.labelIssuedAt;
        current.labelNumber = client.labelNumber;
      }

      current.totals = sumMoney([current.totals, client.totals]);
      current.counts = sumCounts([current.counts, client.counts]);
      current.monthly.set(slice.month, client.totals);
    }
  }

  return rank(folded.values(), (client) => client.clientName, (client) => client.totals).map(
    (client) => {
      const share = shareOf(statisticsAmountCents(client.totals.total), whole);
      return {
        key: client.key,
        rank: client.rank,
        name: client.clientName,
        code: client.clientCode,
        historical: client.identity === "historical-snapshot",
        totals: client.totals,
        counts: client.counts,
        sharePercent: share.percent,
        shareUnavailableReason: share.unavailableReason,
        monthly: monthSeries(slices, client.monthly),
      };
    },
  );
}

function rankRubros(
  slices: readonly StatisticsYearMonth[],
  whole: bigint,
): StatisticsRankedRubro[] {
  const folded = new Map<string, RubroFold>();

  for (const slice of slices) {
    for (const rubro of slice.rubros) {
      const current = folded.get(rubro.key);
      if (!current) {
        folded.set(rubro.key, {
          key: rubro.key,
          rubroId: rubro.rubroId,
          identity: rubro.identity,
          rubroCode: rubro.rubroCode,
          rubroName: rubro.rubroName,
          labelIssuedAt: rubro.labelIssuedAt,
          labelSortOrder: rubro.labelSortOrder,
          labelNumber: rubro.labelNumber,
          totals: rubro.totals,
          lineCount: rubro.lineCount,
          quantityCents: statisticsAmountCents(rubro.quantity),
          invoiceCount: rubro.invoiceCount,
          monthly: new Map([[slice.month, rubro.totals]]),
        });
        continue;
      }

      if (
        isNewerRubroSnapshot(current, {
          issuedAt: rubro.labelIssuedAt,
          sortOrder: rubro.labelSortOrder,
          number: rubro.labelNumber,
          rubroName: rubro.rubroName,
        })
      ) {
        current.rubroCode = rubro.rubroCode;
        current.rubroName = rubro.rubroName;
        current.labelIssuedAt = rubro.labelIssuedAt;
        current.labelSortOrder = rubro.labelSortOrder;
        current.labelNumber = rubro.labelNumber;
      }

      current.totals = sumMoney([current.totals, rubro.totals]);
      current.lineCount += rubro.lineCount;
      current.quantityCents += statisticsAmountCents(rubro.quantity);
      current.invoiceCount += rubro.invoiceCount;
      current.monthly.set(slice.month, rubro.totals);
    }
  }

  return rank(folded.values(), (rubro) => rubro.rubroName, (rubro) => rubro.totals).map(
    (rubro) => {
      const share = shareOf(statisticsAmountCents(rubro.totals.total), whole);
      return {
        key: rubro.key,
        rank: rubro.rank,
        name: rubro.rubroName,
        code: rubro.rubroCode,
        historical: rubro.identity === "historical-snapshot",
        totals: rubro.totals,
        lineCount: rubro.lineCount,
        quantity: centsToAmountString(rubro.quantityCents),
        invoiceCount: rubro.invoiceCount,
        sharePercent: share.percent,
        shareUnavailableReason: share.unavailableReason,
        monthly: monthSeries(slices, rubro.monthly),
      };
    },
  );
}

function monthSeries(
  slices: readonly StatisticsYearMonth[],
  monthly: ReadonlyMap<number, StatisticsMoneyView>,
): StatisticsMonthAmount[] {
  return slices.map((slice) => ({
    year: slice.year,
    month: slice.month,
    total: monthly.get(slice.month)?.total ?? "0.00",
    documentCount: 0,
  }));
}

function rank<T extends { key: string; totals: StatisticsMoneyView }>(
  rows: Iterable<T>,
  labelOf: (row: T) => string,
  totalsOf: (row: T) => StatisticsMoneyView,
): Array<T & { rank: number }> {
  const sorted = [...rows].sort((left, right) => {
    const byTotal = statisticsAmountCents(totalsOf(right).total) - statisticsAmountCents(totalsOf(left).total);
    if (byTotal !== ZERO) {
      return byTotal > ZERO ? 1 : -1;
    }

    const byLabel = labelOf(left).localeCompare(labelOf(right), "es-AR");
    if (byLabel !== 0) {
      return byLabel;
    }

    return left.key.localeCompare(right.key, "es-AR");
  });

  let lastTotal: string | null = null;
  let rankNumber = 0;
  return sorted.map((row, index) => {
    const total = totalsOf(row).total;
    if (lastTotal === null || total !== lastTotal) {
      rankNumber = index + 1;
      lastTotal = total;
    }
    return { ...row, rank: rankNumber };
  });
}

function leaders(
  slices: readonly StatisticsYearMonth[],
  today: CalendarToday,
  kind: "clients" | "rubros",
): StatisticsMonthLeader[] {
  return slices.map((slice) => {
    const state = monthState(slice, today);
    if (state === "future") {
      return { month: slice.month, name: monthName(slice.month), state, names: [], total: null };
    }

    const rows = kind === "clients"
      ? slice.clients.map((client) => ({ name: client.clientName, total: client.totals.total }))
      : slice.rubros.map((rubro) => ({ name: rubro.rubroName, total: rubro.totals.total }));

    if (rows.length === 0) {
      return { month: slice.month, name: monthName(slice.month), state, names: [], total: null };
    }

    const winner = rows.reduce((best, row) =>
      statisticsAmountCents(row.total) > statisticsAmountCents(best.total) ? row : best,
    );
    const names = rows
      .filter((row) => row.total === winner.total)
      .map((row) => row.name)
      .sort((left, right) => left.localeCompare(right, "es-AR"));

    return {
      month: slice.month,
      name: monthName(slice.month),
      state,
      names,
      total: winner.total,
    };
  });
}

function movers(
  slices: readonly StatisticsYearMonth[],
  today: CalendarToday,
  kind: "clients" | "rubros",
): { increases: StatisticsMover[]; decreases: StatisticsMover[] } {
  const comparable = slices.filter((slice) => monthState(slice, today) !== "future");
  if (comparable.length < 2) {
    return { increases: [], decreases: [] };
  }

  const earlier = comparable[0];
  const later = comparable[comparable.length - 1];
  if (!earlier || !later || earlier.month === later.month) {
    return { increases: [], decreases: [] };
  }

  const earlierRows = partyMap(earlier, kind);
  const laterRows = partyMap(later, kind);
  const keys = new Set([...earlierRows.keys(), ...laterRows.keys()]);
  const movement: StatisticsMover[] = [];

  for (const key of keys) {
    const before = earlierRows.get(key);
    const after = laterRows.get(key);
    const beforeTotal = before?.total ?? "0.00";
    const afterTotal = after?.total ?? "0.00";
    const deltaCents = statisticsAmountCents(afterTotal) - statisticsAmountCents(beforeTotal);
    if (deltaCents === ZERO) {
      continue;
    }
    if (statisticsAmountCents(beforeTotal) <= ZERO && statisticsAmountCents(afterTotal) <= ZERO) {
      continue;
    }

    movement.push({
      key,
      name: after?.name ?? before?.name ?? "Sin nombre",
      delta: centsToAmountString(deltaCents),
      percent: statisticsGrowthLabel(afterTotal, beforeTotal),
      earlierMonth: earlier.month,
      laterMonth: later.month,
      earlierName: monthName(earlier.month),
      laterName: monthName(later.month),
      skipped: later.month - earlier.month > 1,
    });
  }

  const increases = movement
    .filter((item) => statisticsAmountCents(item.delta) > ZERO)
    .sort((left, right) => statisticsAmountCents(right.delta) > statisticsAmountCents(left.delta) ? 1 : -1);
  const decreases = movement
    .filter((item) => statisticsAmountCents(item.delta) < ZERO)
    .sort((left, right) => statisticsAmountCents(left.delta) < statisticsAmountCents(right.delta) ? -1 : 1);

  return {
    increases: increases.slice(0, 3),
    decreases: decreases.slice(0, 3),
  };
}

function partyMap(
  slice: StatisticsYearMonth,
  kind: "clients" | "rubros",
): Map<string, { name: string; total: string }> {
  const entries = kind === "clients"
    ? slice.clients.map((client) => [client.key, { name: client.clientName, total: client.totals.total }] as const)
    : slice.rubros.map((rubro) => [rubro.key, { name: rubro.rubroName, total: rubro.totals.total }] as const);
  return new Map(entries);
}

function buildReconciliation(
  slices: readonly StatisticsYearMonth[],
  clients: readonly StatisticsRankedClient[],
  rubros: readonly StatisticsRankedRubro[],
  general: StatisticsMoneyView,
): StatisticsReconciliationView {
  const invoices = sumMoney(slices.map((slice) => slice.invoices));
  const notes = sumMoney(slices.map((slice) => slice.notes));
  const clientTotals = sumMoney(clients.map((client) => client.totals));
  const rubroTotals = sumMoney(rubros.map((rubro) => rubro.totals));
  const unassigned = sumMoney(slices.map((slice) => slice.unassigned.totals));
  const adjustments = sumMoney(slices.map((slice) => slice.adjustments.totals));
  const distributed = sumMoney([rubroTotals, unassigned, adjustments]);
  const clientsMinusGeneral = subtractMoney(clientTotals, general);
  const distributionMinusGeneral = subtractMoney(distributed, general);

  return {
    general,
    invoices,
    notes,
    clients: clientTotals,
    rubros: rubroTotals,
    unassigned,
    adjustments,
    clientsMinusGeneral,
    distributionMinusGeneral,
    clientsMatchGeneral: isZero(clientsMinusGeneral),
    distributionMatchGeneral: isZero(distributionMinusGeneral),
  };
}

function buildConclusions(view: StatisticsSelectionView): string[] {
  const caveats: string[] = [];
  const facts: string[] = [];
  const future = view.selectedMonths.filter((month) => month.state === "future");
  const partial = view.selectedMonths.filter((month) => month.state === "partial");
  const empty = view.selectedMonths.filter((month) => month.state === "empty");

  if (future.length > 0) {
    const names = joinNames(future.map((month) => month.name));
    caveats.push(
      future.length === 1
        ? `${names} todavía no comenzó, así que no se interpreta como una baja.`
        : `${names} todavía no comenzaron, así que no se interpretan como una baja.`,
    );
  }

  if (partial.length > 0) {
    caveats.push(
      `${joinNames(partial.map((month) => month.name))} está en curso: la facturación de ese mes todavía es parcial.`,
    );
  }

  if (view.best && view.worst && view.best.total !== view.worst.total) {
    facts.push(extremeSentence(view.best.names, "mayor"));
    const worstIsEmptyTie = statisticsAmountCents(view.worst.total) === ZERO && view.worst.names.length > 2;
    if (!worstIsEmptyTie) {
      facts.push(extremeSentence(view.worst.names, "menor"));
    }
  } else if (
    view.selectedMonths.length >= 2 &&
    view.selectedMonths.every((month) => month.state !== "future") &&
    view.best &&
    view.best.total === view.worst?.total
  ) {
    facts.push("Los meses seleccionados tuvieron la misma facturación.");
  }

  const topRubro = view.rubros.find((rubro) => statisticsAmountCents(rubro.totals.total) > ZERO);
  if (topRubro) {
    facts.push(
      topRubro.sharePercent
        ? `${topRubro.name} fue el rubro con mayor facturación acumulada y concentró el ${formatSharePercent(topRubro.sharePercent)}.`
        : `${topRubro.name} fue el rubro con mayor facturación acumulada.`,
    );
  }

  const topClient = view.clients.find((client) => statisticsAmountCents(client.totals.total) > ZERO);
  if (topClient) {
    facts.push(
      topClient.sharePercent
        ? `${topClient.name} concentró el ${formatSharePercent(topClient.sharePercent)} de la facturación del período.`
        : `${topClient.name} fue el cliente con mayor facturación del período.`,
    );
  }

  const comparable = view.selectedMonths.filter((month) => month.state !== "future");
  const last = comparable.at(-1);
  const previous = comparable.length >= 2 ? comparable[comparable.length - 2] : null;
  if (last?.variation && previous) {
    const delta = statisticsAmountCents(last.variation.delta);
    if (delta < ZERO) {
      facts.push(
        last.variation.skipped
          ? `La facturación de ${last.name} fue inferior a la de ${previous.name}. Entre ambos hay meses que no están seleccionados.`
          : `La facturación de ${last.name} fue inferior a la de ${previous.name}.`,
      );
    } else if (delta > ZERO) {
      facts.push(
        last.variation.skipped
          ? `La facturación de ${last.name} fue superior a la de ${previous.name}. Entre ambos hay meses que no están seleccionados.`
          : `La facturación de ${last.name} fue superior a la de ${previous.name}.`,
      );
    }
  }

  if (empty.length > 0 && empty.length < view.selectedMonths.length) {
    facts.push(
      `${joinNames(empty.map((month) => month.name))} no registra operaciones.`,
    );
  }

  if (view.selectedMonths.every((month) => month.state === "empty")) {
    facts.unshift("No hay facturación en los meses seleccionados.");
  }

  const noteImpact = statisticsAmountCents(view.reconciliation.notes.total);
  if (noteImpact !== ZERO) {
    facts.push(
      `El impacto neto de las notas sobre la facturación es ${formatStatisticsAmount(view.reconciliation.notes.total)}.`,
    );
  }

  const chosen = [...caveats, ...facts];
  return [...new Set(chosen)].slice(0, 5);
}

function extremeSentence(names: readonly string[], which: "mayor" | "menor"): string {
  if (names.length === 1) {
    return `${names[0]} fue el mes con ${which} facturación entre los seleccionados.`;
  }

  return `${joinNames(names)} empataron con la ${which} facturación entre los seleccionados.`;
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }
  if (names.length === 2) {
    return `${names[0]} y ${names[1]}`;
  }
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function monthName(month: number): string {
  return STATISTICS_MONTHS[month - 1]?.name ?? "Mes";
}

function sumMoney(values: readonly StatisticsMoneyView[]): StatisticsMoneyView {
  let net = ZERO;
  let vat = ZERO;
  let total = ZERO;
  for (const value of values) {
    net += statisticsAmountCents(value.net);
    vat += statisticsAmountCents(value.vat);
    total += statisticsAmountCents(value.total);
  }
  return {
    net: centsToAmountString(net),
    vat: centsToAmountString(vat),
    total: centsToAmountString(total),
    roundingGap: centsToAmountString(total - net - vat),
  };
}

function subtractMoney(
  current: StatisticsMoneyView,
  baseline: StatisticsMoneyView,
): StatisticsMoneyView {
  const net = statisticsAmountCents(current.net) - statisticsAmountCents(baseline.net);
  const vat = statisticsAmountCents(current.vat) - statisticsAmountCents(baseline.vat);
  const total = statisticsAmountCents(current.total) - statisticsAmountCents(baseline.total);
  return {
    net: centsToAmountString(net),
    vat: centsToAmountString(vat),
    total: centsToAmountString(total),
    roundingGap: centsToAmountString(total - net - vat),
  };
}

function sumCounts(values: readonly StatisticsCountsView[]): StatisticsCountsView {
  return values.reduce(
    (total, value) => ({
      invoiceCount: total.invoiceCount + value.invoiceCount,
      creditNoteCount: total.creditNoteCount + value.creditNoteCount,
      debitNoteCount: total.debitNoteCount + value.debitNoteCount,
      documentCount: total.documentCount + value.documentCount,
    }),
    { ...ZERO_COUNTS },
  );
}

function divideMoney(total: string, count: number): string {
  if (count <= 0) {
    return "0.00";
  }

  const cents = statisticsAmountCents(total);
  const negative = cents < ZERO;
  const absolute = negative ? -cents : cents;
  const divisor = BigInt(count);
  const quotient = absolute / divisor;
  const remainder = absolute % divisor;
  const rounded = remainder * TWO >= divisor ? quotient + ONE : quotient;
  return centsToAmountString(negative ? -rounded : rounded);
}

function isZero(money: StatisticsMoneyView): boolean {
  return (
    statisticsAmountCents(money.net) === ZERO &&
    statisticsAmountCents(money.vat) === ZERO &&
    statisticsAmountCents(money.total) === ZERO
  );
}

function absCents(value: bigint): bigint {
  return value < ZERO ? -value : value;
}
