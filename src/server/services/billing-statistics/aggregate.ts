import {
  clientGroupKey,
  rubroGroupKey,
} from "@/server/services/billing-statistics/identity";
import {
  isNewerDocumentLabel,
  isNewerRubroSnapshot,
} from "@/server/services/billing-statistics/labels";
import {
  addMoney,
  createMoney,
  distributeByWeights,
  moneyFromInvoice,
  moneyFromNote,
  parseMinorUnits,
  type MoneyParts,
} from "@/server/services/billing-statistics/money";
import { monthOf } from "@/server/services/billing-statistics/periods";
import type {
  StatisticsInvoiceItemRecord,
  StatisticsInvoiceRecord,
  StatisticsNoteRecord,
  StatisticsSource,
} from "@/server/services/billing-statistics/source";

export type DocumentCounts = {
  invoiceCount: number;
  creditNoteCount: number;
  debitNoteCount: number;
  documentCount: number;
};

export type MonthTotals = {
  year: number;
  month: number;
  totals: MoneyParts;
  counts: DocumentCounts;
};

export type ClientBucket = {
  key: string;
  clientId: string | null;
  identity: "client-id" | "historical-snapshot";
  clientCode: string;
  clientName: string;
  snapshotNames: Set<string>;
  labelIssuedAt: number;
  labelNumber: string;
  totals: MoneyParts;
  counts: DocumentCounts;
  months: Map<string, MonthTotals>;
};

export type RubroMonth = {
  year: number;
  month: number;
  totals: MoneyParts;
  lineCount: number;
  quantityHundredths: bigint;
  invoiceIds: Set<string>;
};

export type RubroBucket = {
  key: string;
  rubroId: string | null;
  identity: "rubro-id" | "historical-snapshot";
  rubroCode: string;
  rubroName: string;
  snapshotNames: Set<string>;
  labelIssuedAt: number;
  labelSortOrder: number;
  labelNumber: string;
  totals: MoneyParts;
  lineCount: number;
  quantityHundredths: bigint;
  invoiceIds: Set<string>;
  months: Map<string, RubroMonth>;
};

export type UnassignedMonth = {
  year: number;
  month: number;
  totals: MoneyParts;
  invoiceCount: number;
  lineCount: number;
};

export type UnassignedBucket = {
  totals: MoneyParts;
  invoiceCount: number;
  lineCount: number;
  months: Map<string, UnassignedMonth>;
};

export type AdjustmentMonth = {
  year: number;
  month: number;
  totals: MoneyParts;
  counts: DocumentCounts;
};

export type AdjustmentBucket = {
  totals: MoneyParts;
  counts: DocumentCounts;
  months: Map<string, AdjustmentMonth>;
};

export type StatisticsAggregate = {
  totals: MoneyParts;
  counts: DocumentCounts;
  invoiceTotals: MoneyParts;
  noteTotals: MoneyParts;
  months: Map<string, MonthTotals>;
  clients: Map<string, ClientBucket>;
  rubros: Map<string, RubroBucket>;
  unassigned: UnassignedBucket;
  adjustments: AdjustmentBucket;
};

type DocumentKind = "INVOICE" | "CREDIT" | "DEBIT";

/**
 * Agrega comprobantes ya acotados al período y al ambiente.
 * Las facturas suman el total visual redondeado, el IVA guardado y el
 * neto `total - ivaAmount`, que es el neto del Libro de IVA.
 * La diferencia entre ese neto más el IVA y el total visual queda en
 * roundingGap. No se corrige.
 * Las notas usan su propio neto, IVA e importe, con signo negativo en
 * las de crédito. No tienen líneas de rubro: van a ajustes, no a rubros.
 * Los recibos no entran en esta fuente.
 */
export function aggregateStatistics(source: StatisticsSource): StatisticsAggregate {
  const aggregate = emptyAggregate();
  const seen = new Set<string>();

  for (const invoice of source.invoices) {
    if (!consumeDocument(seen, "invoice", invoice.id)) {
      continue;
    }
    addInvoice(aggregate, invoice);
  }

  for (const note of source.notes) {
    if (!consumeDocument(seen, "note", note.id)) {
      continue;
    }
    addNote(aggregate, note);
  }

  return aggregate;
}

function emptyAggregate(): StatisticsAggregate {
  return {
    totals: createMoney(),
    counts: emptyCounts(),
    invoiceTotals: createMoney(),
    noteTotals: createMoney(),
    months: new Map(),
    clients: new Map(),
    rubros: new Map(),
    unassigned: {
      totals: createMoney(),
      invoiceCount: 0,
      lineCount: 0,
      months: new Map(),
    },
    adjustments: {
      totals: createMoney(),
      counts: emptyCounts(),
      months: new Map(),
    },
  };
}

export function emptyCounts(): DocumentCounts {
  return {
    invoiceCount: 0,
    creditNoteCount: 0,
    debitNoteCount: 0,
    documentCount: 0,
  };
}

function consumeDocument(seen: Set<string>, kind: "invoice" | "note", id: string): boolean {
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

function noteDocumentKind(kind: StatisticsNoteRecord["kind"]): DocumentKind {
  switch (kind) {
    case "CREDIT":
      return "CREDIT";
    case "DEBIT":
      return "DEBIT";
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

function addCount(counts: DocumentCounts, kind: DocumentKind): void {
  counts.documentCount += 1;
  switch (kind) {
    case "INVOICE":
      counts.invoiceCount += 1;
      return;
    case "CREDIT":
      counts.creditNoteCount += 1;
      return;
    case "DEBIT":
      counts.debitNoteCount += 1;
      return;
    default: {
      const unexpected: never = kind;
      throw new Error(unexpected);
    }
  }
}

function monthTotals(map: Map<string, MonthTotals>, issuedAt: Date): MonthTotals {
  const point = monthOf(issuedAt);
  const current = map.get(point.key);
  if (current) {
    return current;
  }

  const created: MonthTotals = {
    year: point.year,
    month: point.month,
    totals: createMoney(),
    counts: emptyCounts(),
  };
  map.set(point.key, created);
  return created;
}

function addInvoice(aggregate: StatisticsAggregate, invoice: StatisticsInvoiceRecord): void {
  const money = moneyFromInvoice(invoice);
  addMoney(aggregate.totals, money);
  addMoney(aggregate.invoiceTotals, money);
  addCount(aggregate.counts, "INVOICE");

  const month = monthTotals(aggregate.months, invoice.issuedAt);
  addMoney(month.totals, money);
  addCount(month.counts, "INVOICE");

  const client = clientBucket(aggregate, invoice, invoice.issuedAt, invoice.invoiceNumber);
  addMoney(client.totals, money);
  addCount(client.counts, "INVOICE");
  const clientMonth = monthTotals(client.months, invoice.issuedAt);
  addMoney(clientMonth.totals, money);
  addCount(clientMonth.counts, "INVOICE");

  attributeInvoiceRubros(aggregate, invoice, money);
}

function addNote(aggregate: StatisticsAggregate, note: StatisticsNoteRecord): void {
  const money = moneyFromNote(note);
  const kind = noteDocumentKind(note.kind);
  addMoney(aggregate.totals, money);
  addMoney(aggregate.noteTotals, money);
  addCount(aggregate.counts, kind);

  const month = monthTotals(aggregate.months, note.issuedAt);
  addMoney(month.totals, money);
  addCount(month.counts, kind);

  const client = clientBucket(aggregate, note, note.issuedAt, note.noteNumber);
  addMoney(client.totals, money);
  addCount(client.counts, kind);
  const clientMonth = monthTotals(client.months, note.issuedAt);
  addMoney(clientMonth.totals, money);
  addCount(clientMonth.counts, kind);

  addMoney(aggregate.adjustments.totals, money);
  addCount(aggregate.adjustments.counts, kind);
  const adjustmentMonth = adjustmentMonthOf(aggregate.adjustments, note.issuedAt);
  addMoney(adjustmentMonth.totals, money);
  addCount(adjustmentMonth.counts, kind);
}

function clientBucket(
  aggregate: StatisticsAggregate,
  document: {
    clientId: string | null;
    clientCode: string;
    clientName: string;
    clientIdentificationType: string;
    clientIdentificationNumber: string | null;
  },
  issuedAt: Date,
  documentNumber: string,
): ClientBucket {
  const key = clientGroupKey(document);
  const current = aggregate.clients.get(key);
  if (!current) {
    const created: ClientBucket = {
      key,
      clientId: document.clientId,
      identity: document.clientId ? "client-id" : "historical-snapshot",
      clientCode: document.clientCode,
      clientName: document.clientName,
      snapshotNames: new Set([document.clientName]),
      labelIssuedAt: issuedAt.getTime(),
      labelNumber: documentNumber,
      totals: createMoney(),
      counts: emptyCounts(),
      months: new Map(),
    };
    aggregate.clients.set(key, created);
    return created;
  }

  current.snapshotNames.add(document.clientName);
  if (isNewerDocumentLabel(current.labelIssuedAt, current.labelNumber, issuedAt.getTime(), documentNumber)) {
    current.clientCode = document.clientCode;
    current.clientName = document.clientName;
    current.labelIssuedAt = issuedAt.getTime();
    current.labelNumber = documentNumber;
  }

  return current;
}

function attributeInvoiceRubros(
  aggregate: StatisticsAggregate,
  invoice: StatisticsInvoiceRecord,
  money: MoneyParts,
): void {
  const items = sortItems(invoice.items);
  const weights = items.map((item) => parseMinorUnits(item.lineTotal));
  if (items.length === 0 || weights.some((weight) => weight < BigInt(0))) {
    addUnassigned(aggregate, invoice, money, items.length);
    return;
  }

  const netShares = distributeByWeights(money.netCents, weights);
  const vatShares = distributeByWeights(money.vatCents, weights);
  const totalShares = distributeByWeights(money.totalCents, weights);

  items.forEach((item, index) => {
    const share: MoneyParts = {
      netCents: netShares[index] ?? BigInt(0),
      vatCents: vatShares[index] ?? BigInt(0),
      totalCents: totalShares[index] ?? BigInt(0),
    };
    const rubro = rubroBucket(aggregate, invoice, item);
    addMoney(rubro.totals, share);
    rubro.lineCount += 1;
    rubro.quantityHundredths += parseMinorUnits(item.quantity);
    rubro.invoiceIds.add(invoice.id);

    const point = monthOf(invoice.issuedAt);
    const rubroMonth = rubro.months.get(point.key) ?? createRubroMonth(point);
    addMoney(rubroMonth.totals, share);
    rubroMonth.lineCount += 1;
    rubroMonth.quantityHundredths += parseMinorUnits(item.quantity);
    rubroMonth.invoiceIds.add(invoice.id);
    rubro.months.set(point.key, rubroMonth);
  });
}

function addUnassigned(
  aggregate: StatisticsAggregate,
  invoice: StatisticsInvoiceRecord,
  money: MoneyParts,
  lineCount: number,
): void {
  aggregate.unassigned.invoiceCount += 1;
  aggregate.unassigned.lineCount += lineCount;
  addMoney(aggregate.unassigned.totals, money);

  const point = monthOf(invoice.issuedAt);
  const current = aggregate.unassigned.months.get(point.key) ?? {
    year: point.year,
    month: point.month,
    totals: createMoney(),
    invoiceCount: 0,
    lineCount: 0,
  };
  addMoney(current.totals, money);
  current.invoiceCount += 1;
  current.lineCount += lineCount;
  aggregate.unassigned.months.set(point.key, current);
}

function rubroBucket(
  aggregate: StatisticsAggregate,
  invoice: StatisticsInvoiceRecord,
  item: StatisticsInvoiceItemRecord,
): RubroBucket {
  const key = rubroGroupKey(item);
  const current = aggregate.rubros.get(key);
  if (!current) {
    const created: RubroBucket = {
      key,
      rubroId: item.rubroId,
      identity: item.rubroId ? "rubro-id" : "historical-snapshot",
      rubroCode: item.rubroCode,
      rubroName: item.rubroName,
      snapshotNames: new Set([item.rubroName]),
      labelIssuedAt: invoice.issuedAt.getTime(),
      labelSortOrder: item.sortOrder,
      labelNumber: invoice.invoiceNumber,
      totals: createMoney(),
      lineCount: 0,
      quantityHundredths: BigInt(0),
      invoiceIds: new Set(),
      months: new Map(),
    };
    aggregate.rubros.set(key, created);
    return created;
  }

  current.snapshotNames.add(item.rubroName);
  if (isNewerRubroLabel(current, invoice, item)) {
    current.rubroCode = item.rubroCode;
    current.rubroName = item.rubroName;
    current.labelIssuedAt = invoice.issuedAt.getTime();
    current.labelSortOrder = item.sortOrder;
    current.labelNumber = invoice.invoiceNumber;
  }

  return current;
}

function isNewerRubroLabel(
  current: RubroBucket,
  invoice: StatisticsInvoiceRecord,
  item: StatisticsInvoiceItemRecord,
): boolean {
  return isNewerRubroSnapshot(current, {
    issuedAt: invoice.issuedAt.getTime(),
    sortOrder: item.sortOrder,
    number: invoice.invoiceNumber,
    rubroName: item.rubroName,
  });
}

function createRubroMonth(point: { year: number; month: number }): RubroMonth {
  return {
    year: point.year,
    month: point.month,
    totals: createMoney(),
    lineCount: 0,
    quantityHundredths: BigInt(0),
    invoiceIds: new Set(),
  };
}

function adjustmentMonthOf(bucket: AdjustmentBucket, issuedAt: Date): AdjustmentMonth {
  const point = monthOf(issuedAt);
  const current = bucket.months.get(point.key);
  if (current) {
    return current;
  }

  const created: AdjustmentMonth = {
    year: point.year,
    month: point.month,
    totals: createMoney(),
    counts: emptyCounts(),
  };
  bucket.months.set(point.key, created);
  return created;
}

function sortItems(
  items: readonly StatisticsInvoiceItemRecord[],
): StatisticsInvoiceItemRecord[] {
  return [...items].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    const byCode = left.rubroCode.localeCompare(right.rubroCode, "es-AR");
    if (byCode !== 0) {
      return byCode;
    }

    return left.rubroName.localeCompare(right.rubroName, "es-AR");
  });
}
