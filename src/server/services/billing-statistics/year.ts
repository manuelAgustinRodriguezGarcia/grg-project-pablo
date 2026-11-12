import type { BillingFiscalEnvironment } from "@/generated/prisma/client";
import type {
  StatisticsYearMonth,
  StatisticsYearNote,
  StatisticsYearResponse,
} from "@/features/billing/types/billing-statistics.types";
import {
  emptyCounts,
  type ClientBucket,
  type RubroBucket,
  type StatisticsAggregate,
} from "@/server/services/billing-statistics/aggregate";
import { clientGroupKey, rubroGroupKey } from "@/server/services/billing-statistics/identity";
import {
  isNewerDocumentLabel,
  isNewerRubroSnapshot,
} from "@/server/services/billing-statistics/labels";
import {
  addMoney,
  createMoney,
  formatMinorUnits,
  moneyFromNote,
  presentMoney,
  subtractMoney,
  type MoneyParts,
} from "@/server/services/billing-statistics/money";
import { monthKey, monthOf } from "@/server/services/billing-statistics/periods";
import type {
  StatisticsNoteRecord,
  StatisticsSource,
} from "@/server/services/billing-statistics/source";

type ClientLabel = {
  clientCode: string;
  clientName: string;
  labelIssuedAt: number;
  labelNumber: string;
};

type RubroLabel = {
  rubroCode: string;
  rubroName: string;
  labelIssuedAt: number;
  labelSortOrder: number;
  labelNumber: string;
};

type NoteSplit = {
  credit: MoneyParts;
  debit: MoneyParts;
};

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Parte el agregado anual en doce meses.
 * No recalcula impuestos: reutiliza los centavos que ya sumó el motor
 * y los importes firmados de cada nota.
 */
export function presentStatisticsYear(input: {
  environment: BillingFiscalEnvironment;
  year: number;
  aggregate: StatisticsAggregate;
  source: StatisticsSource;
}): StatisticsYearResponse {
  const labels = collectLabels(input.source);
  const noteSplit = splitNotes(input.source);
  const notes = presentNotes(input.source);

  return {
    environment: input.environment,
    year: input.year,
    months: MONTHS.map((month) =>
      presentMonth({
        year: input.year,
        month,
        aggregate: input.aggregate,
        labels,
        noteSplit: noteSplit.get(month) ?? emptySplit(),
      }),
    ),
    notes,
  };
}

function presentMonth(input: {
  year: number;
  month: number;
  aggregate: StatisticsAggregate;
  labels: ReturnType<typeof collectLabels>;
  noteSplit: NoteSplit;
}): StatisticsYearMonth {
  const key = monthKey(input.year, input.month);
  const bucket = input.aggregate.months.get(key);
  const totals = bucket?.totals ?? createMoney();
  const counts = bucket?.counts ?? emptyCounts();
  const noteTotals = addSplit(input.noteSplit);
  const invoiceTotals = subtractMoney(totals, noteTotals);
  const unassigned = input.aggregate.unassigned.months.get(key);
  const adjustments = input.aggregate.adjustments.months.get(key);

  return {
    year: input.year,
    month: input.month,
    totals: presentMoney(totals),
    counts,
    invoices: presentMoney(invoiceTotals),
    notes: presentMoney(noteTotals),
    creditNotes: presentMoney(input.noteSplit.credit),
    debitNotes: presentMoney(input.noteSplit.debit),
    clients: clientSlices(input.aggregate, key, input.month, input.labels.clients),
    rubros: rubroSlices(input.aggregate, key, input.month, input.labels.rubros),
    unassigned: {
      totals: presentMoney(unassigned?.totals ?? createMoney()),
      invoiceCount: unassigned?.invoiceCount ?? 0,
      lineCount: unassigned?.lineCount ?? 0,
    },
    adjustments: {
      totals: presentMoney(adjustments?.totals ?? createMoney()),
      counts: adjustments?.counts ?? emptyCounts(),
    },
  };
}

function clientSlices(
  aggregate: StatisticsAggregate,
  key: string,
  month: number,
  labels: Map<string, Map<number, ClientLabel>>,
): StatisticsYearMonth["clients"] {
  const slices: StatisticsYearMonth["clients"] = [];

  for (const client of aggregate.clients.values()) {
    const bucket = client.months.get(key);
    if (!bucket) {
      continue;
    }

    const label = labels.get(client.key)?.get(month) ?? fallbackClientLabel(client);
    slices.push({
      key: client.key,
      clientId: client.clientId,
      identity: client.identity,
      clientCode: label.clientCode,
      clientName: label.clientName,
      labelIssuedAt: label.labelIssuedAt,
      labelNumber: label.labelNumber,
      totals: presentMoney(bucket.totals),
      counts: bucket.counts,
    });
  }

  slices.sort((left, right) => left.key.localeCompare(right.key, "es-AR"));
  return slices;
}

function rubroSlices(
  aggregate: StatisticsAggregate,
  key: string,
  month: number,
  labels: Map<string, Map<number, RubroLabel>>,
): StatisticsYearMonth["rubros"] {
  const slices: StatisticsYearMonth["rubros"] = [];

  for (const rubro of aggregate.rubros.values()) {
    const bucket = rubro.months.get(key);
    if (!bucket) {
      continue;
    }

    const label = labels.get(rubro.key)?.get(month) ?? fallbackRubroLabel(rubro);
    slices.push({
      key: rubro.key,
      rubroId: rubro.rubroId,
      identity: rubro.identity,
      rubroCode: label.rubroCode,
      rubroName: label.rubroName,
      labelIssuedAt: label.labelIssuedAt,
      labelSortOrder: label.labelSortOrder,
      labelNumber: label.labelNumber,
      totals: presentMoney(bucket.totals),
      lineCount: bucket.lineCount,
      quantity: formatMinorUnits(bucket.quantityHundredths),
      invoiceCount: bucket.invoiceIds.size,
    });
  }

  slices.sort((left, right) => left.key.localeCompare(right.key, "es-AR"));
  return slices;
}

function fallbackClientLabel(client: ClientBucket): ClientLabel {
  return {
    clientCode: client.clientCode,
    clientName: client.clientName,
    labelIssuedAt: client.labelIssuedAt,
    labelNumber: client.labelNumber,
  };
}

function fallbackRubroLabel(rubro: RubroBucket): RubroLabel {
  return {
    rubroCode: rubro.rubroCode,
    rubroName: rubro.rubroName,
    labelIssuedAt: rubro.labelIssuedAt,
    labelSortOrder: rubro.labelSortOrder,
    labelNumber: rubro.labelNumber,
  };
}

function collectLabels(source: StatisticsSource): {
  clients: Map<string, Map<number, ClientLabel>>;
  rubros: Map<string, Map<number, RubroLabel>>;
} {
  const clients = new Map<string, Map<number, ClientLabel>>();
  const rubros = new Map<string, Map<number, RubroLabel>>();
  const seen = new Set<string>();

  for (const invoice of source.invoices) {
    if (!consume(seen, "invoice", invoice.id)) {
      continue;
    }

    const point = monthOf(invoice.issuedAt);
    rememberClient(clients, clientGroupKey(invoice), point.month, {
      clientCode: invoice.clientCode,
      clientName: invoice.clientName,
      labelIssuedAt: invoice.issuedAt.getTime(),
      labelNumber: invoice.invoiceNumber,
    });

    for (const item of invoice.items) {
      const current = rubros.get(rubroGroupKey(item))?.get(point.month);
      const next: RubroLabel = {
        rubroCode: item.rubroCode,
        rubroName: item.rubroName,
        labelIssuedAt: invoice.issuedAt.getTime(),
        labelSortOrder: item.sortOrder,
        labelNumber: invoice.invoiceNumber,
      };
      if (
        current &&
        !isNewerRubroSnapshot(
          {
            labelIssuedAt: current.labelIssuedAt,
            labelSortOrder: current.labelSortOrder,
            labelNumber: current.labelNumber,
            rubroName: current.rubroName,
          },
          {
            issuedAt: next.labelIssuedAt,
            sortOrder: next.labelSortOrder,
            number: next.labelNumber,
            rubroName: next.rubroName,
          },
        )
      ) {
        continue;
      }
      rememberRubro(rubros, rubroGroupKey(item), point.month, next);
    }
  }

  for (const note of source.notes) {
    if (!consume(seen, "note", note.id)) {
      continue;
    }

    const point = monthOf(note.issuedAt);
    rememberClient(clients, clientGroupKey(note), point.month, {
      clientCode: note.clientCode,
      clientName: note.clientName,
      labelIssuedAt: note.issuedAt.getTime(),
      labelNumber: note.noteNumber,
    });
  }

  return { clients, rubros };
}

function rememberClient(
  labels: Map<string, Map<number, ClientLabel>>,
  key: string,
  month: number,
  next: ClientLabel,
): void {
  const months = labels.get(key) ?? new Map<number, ClientLabel>();
  const current = months.get(month);
  if (
    !current ||
    isNewerDocumentLabel(
      current.labelIssuedAt,
      current.labelNumber,
      next.labelIssuedAt,
      next.labelNumber,
    )
  ) {
    months.set(month, next);
    labels.set(key, months);
  }
}

function rememberRubro(
  labels: Map<string, Map<number, RubroLabel>>,
  key: string,
  month: number,
  next: RubroLabel,
): void {
  const months = labels.get(key) ?? new Map<number, RubroLabel>();
  months.set(month, next);
  labels.set(key, months);
}

function presentNotes(source: StatisticsSource): StatisticsYearNote[] {
  const seen = new Set<string>();
  const notes: StatisticsYearNote[] = [];

  for (const note of source.notes) {
    if (!consume(seen, "note", note.id)) {
      continue;
    }
    notes.push(presentNote(note));
  }

  notes.sort((left, right) => {
    if (left.issuedOn !== right.issuedOn) {
      return right.issuedOn.localeCompare(left.issuedOn);
    }
    return right.noteNumber.localeCompare(left.noteNumber, "es-AR");
  });

  return notes;
}

function presentNote(note: StatisticsNoteRecord): StatisticsYearNote {
  const point = monthOf(note.issuedAt);
  const issuedOn = `${point.year}-${String(point.month).padStart(2, "0")}-${String(note.issuedAt.getDate()).padStart(2, "0")}`;

  return {
    id: note.id,
    kind: note.kind,
    issuedOn,
    month: point.month,
    noteNumber: note.noteNumber,
    clientKey: clientGroupKey(note),
    clientName: note.clientName,
    totals: presentMoney(moneyFromNote(note)),
    invoiceId: note.invoiceId,
    invoiceNumber: note.invoiceNumber,
  };
}

function splitNotes(source: StatisticsSource): Map<number, NoteSplit> {
  const splits = new Map<number, NoteSplit>();
  const seen = new Set<string>();

  for (const note of source.notes) {
    if (!consume(seen, "note", note.id)) {
      continue;
    }

    const month = monthOf(note.issuedAt).month;
    const current = splits.get(month) ?? emptySplit();
    const money = moneyFromNote(note);
    switch (note.kind) {
      case "CREDIT":
        addMoney(current.credit, money);
        break;
      case "DEBIT":
        addMoney(current.debit, money);
        break;
      default: {
        const unexpected: never = note.kind;
        throw new Error(unexpected);
      }
    }
    splits.set(month, current);
  }

  return splits;
}

function emptySplit(): NoteSplit {
  return { credit: createMoney(), debit: createMoney() };
}

function addSplit(split: NoteSplit): MoneyParts {
  const total = createMoney();
  addMoney(total, split.credit);
  addMoney(total, split.debit);
  return total;
}

function consume(seen: Set<string>, kind: "invoice" | "note", id: string): boolean {
  if (!id) {
    throw new Error("El comprobante no tiene identificador.");
  }

  const key = `${kind}:${id}`;
  if (seen.has(key)) {
    return false;
  }

  seen.add(key);
  return true;
}
