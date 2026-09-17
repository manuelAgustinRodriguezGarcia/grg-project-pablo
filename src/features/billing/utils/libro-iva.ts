import type {
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingNoteKind,
} from "@/generated/prisma/client";
import { IVA_CONDITION_SHORT_LABELS } from "@/features/billing/types/billing-client.types";
import { formatInvoiceIdentification } from "@/features/billing/utils/invoice-list";

export type LibroIvaDocKind = "FACTURA" | "NC" | "ND";

export type LibroIvaRow = {
  issuedAt: Date;
  docKind: LibroIvaDocKind;
  letter: BillingInvoiceType;
  pointOfSale: string;
  number: string;
  clientName: string;
  identification: string;
  ivaCondition: string;
  ivaPercent: number;
  netAmount: number;
  ivaAmount: number;
  total: number;
  associatedNumber: string;
};

export type LibroIvaInvoiceSource = {
  issuedAt: Date;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  invoiceNumber: string;
  clientName: string;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  subtotal: number;
  discountAmount: number;
  ivaPercent: number;
  ivaAmount: number;
  total: number;
  totalVisualRounded: number;
};

export type LibroIvaNoteSource = {
  kind: BillingNoteKind;
  issuedAt: Date;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  noteNumber: string;
  invoiceNumber: string;
  clientName: string;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  netAmount: number;
  ivaPercent: number;
  ivaAmount: number;
  amount: number;
};

export type LibroIvaTotals = {
  netAmount: number;
  ivaAmount: number;
  total: number;
};

export function libroIvaMonthRange(
  year: number,
  month: number,
): { from: Date; to: Date } {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new Error("Indicá un mes válido.");
  }

  return {
    from: new Date(year, month - 1, 1),
    to: new Date(year, month, 1),
  };
}

export function toYearMonthValue(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export function parseYearMonthValue(
  value: string,
): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

export function libroIvaDocKindLabel(kind: LibroIvaDocKind): string {
  switch (kind) {
    case "FACTURA":
      return "Factura";
    case "NC":
      return "NC";
    case "ND":
      return "ND";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function identificationLabel(
  identificationType: BillingIdentificationType,
  identificationNumber: string | null,
): string {
  return (
    formatInvoiceIdentification(identificationType, identificationNumber) ?? "—"
  );
}

function invoiceToRow(invoice: LibroIvaInvoiceSource): LibroIvaRow {
  const netAmount = invoice.total - invoice.ivaAmount;

  return {
    issuedAt: invoice.issuedAt,
    docKind: "FACTURA",
    letter: invoice.invoiceType,
    pointOfSale: invoice.pointOfSale,
    number: invoice.invoiceNumber,
    clientName: invoice.clientName,
    identification: identificationLabel(
      invoice.clientIdentificationType,
      invoice.clientIdentificationNumber,
    ),
    ivaCondition: IVA_CONDITION_SHORT_LABELS[invoice.clientIvaCondition],
    ivaPercent: invoice.ivaPercent,
    netAmount,
    ivaAmount: invoice.ivaAmount,
    total: invoice.totalVisualRounded,
    associatedNumber: "",
  };
}

function noteToRow(note: LibroIvaNoteSource): LibroIvaRow {
  const sign = note.kind === "CREDIT" ? -1 : 1;

  return {
    issuedAt: note.issuedAt,
    docKind: note.kind === "CREDIT" ? "NC" : "ND",
    letter: note.invoiceType,
    pointOfSale: note.pointOfSale,
    number: note.noteNumber,
    clientName: note.clientName,
    identification: identificationLabel(
      note.clientIdentificationType,
      note.clientIdentificationNumber,
    ),
    ivaCondition: IVA_CONDITION_SHORT_LABELS[note.clientIvaCondition],
    ivaPercent: note.ivaPercent,
    netAmount: sign * note.netAmount,
    ivaAmount: sign * note.ivaAmount,
    total: sign * note.amount,
    associatedNumber: note.invoiceNumber,
  };
}

export function buildLibroIvaRows(
  invoices: LibroIvaInvoiceSource[],
  notes: LibroIvaNoteSource[],
): LibroIvaRow[] {
  return [...invoices.map(invoiceToRow), ...notes.map(noteToRow)].sort(
    (left, right) => {
      const byDate =
        new Date(left.issuedAt).getTime() - new Date(right.issuedAt).getTime();
      if (byDate !== 0) {
        return byDate;
      }
      return left.number.localeCompare(right.number, "es-AR");
    },
  );
}

export function libroIvaRowsForLetter(
  rows: LibroIvaRow[],
  letter: BillingInvoiceType,
): LibroIvaRow[] {
  return rows.filter((row) => row.letter === letter);
}

export function sumLibroIvaRows(rows: LibroIvaRow[]): LibroIvaTotals {
  return rows.reduce<LibroIvaTotals>(
    (totals, row) => ({
      netAmount: totals.netAmount + row.netAmount,
      ivaAmount: totals.ivaAmount + row.ivaAmount,
      total: totals.total + row.total,
    }),
    { netAmount: 0, ivaAmount: 0, total: 0 },
  );
}

export type LibroIvaAbSummaryRow = {
  pointOfSale: string;
  letter: BillingInvoiceType;
  total: number;
  ivaPercent: number;
  netAmount: number;
  ivaAmount: number;
};

export type LibroIvaAbSummary = {
  pointOfSale: string;
  ivaPercent: number;
  rows: LibroIvaAbSummaryRow[];
  totals: LibroIvaTotals;
};

export function buildLibroIvaAbSummary(
  rows: LibroIvaRow[],
  options: { pointOfSale: string; ivaPercent: number },
): LibroIvaAbSummary {
  const letters = ["A", "B"] as const;
  const summaryRows = letters.map((letter) => {
    const totals = sumLibroIvaRows(libroIvaRowsForLetter(rows, letter));
    return {
      pointOfSale: options.pointOfSale,
      letter,
      total: totals.total,
      ivaPercent: options.ivaPercent,
      netAmount: totals.netAmount,
      ivaAmount: totals.ivaAmount,
    };
  });

  return {
    pointOfSale: options.pointOfSale,
    ivaPercent: options.ivaPercent,
    rows: summaryRows,
    totals: sumLibroIvaRows(rows),
  };
}

export function libroIvaDayRange(
  year: number,
  month: number,
  day: number,
): { from: Date; to: Date } {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error("Indicá un día válido.");
  }

  const from = new Date(year, month - 1, day);
  if (from.getFullYear() !== year || from.getMonth() !== month - 1) {
    throw new Error("Indicá un día válido.");
  }

  return {
    from,
    to: new Date(year, month - 1, day + 1),
  };
}

export function libroIvaCustomRange(
  fromValue: string,
  toValue: string,
): { from: Date; to: Date } {
  const fromParsed = parseIsoDateValue(fromValue);
  const toParsed = parseIsoDateValue(toValue);
  if (!fromParsed || !toParsed) {
    throw new Error("Indicá un rango de fechas válido.");
  }

  const from = new Date(fromParsed.year, fromParsed.month - 1, fromParsed.day);
  const toInclusive = new Date(toParsed.year, toParsed.month - 1, toParsed.day);
  if (from.getTime() > toInclusive.getTime()) {
    throw new Error("La fecha desde no puede ser posterior a la fecha hasta.");
  }

  return {
    from,
    to: new Date(toParsed.year, toParsed.month - 1, toParsed.day + 1),
  };
}

export function libroIvaCustomPeriodLabel(
  fromValue: string,
  toValue: string,
): string {
  const fromParsed = parseIsoDateValue(fromValue);
  const toParsed = parseIsoDateValue(toValue);
  if (!fromParsed || !toParsed) {
    throw new Error("Indicá un rango de fechas válido.");
  }

  const formatter = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return `${formatter.format(
    new Date(fromParsed.year, fromParsed.month - 1, fromParsed.day),
  )} – ${formatter.format(
    new Date(toParsed.year, toParsed.month - 1, toParsed.day),
  )}`;
}

export function toIsoDateValue(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseIsoDateValue(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export const LIBRO_IVA_DAILY_BLOCKS = [
  { docKind: "FACTURA" as const, letter: "A" as const, title: "Facturas A" },
  { docKind: "FACTURA" as const, letter: "B" as const, title: "Facturas B" },
  { docKind: "NC" as const, letter: null, title: "Notas de crédito" },
  { docKind: "ND" as const, letter: null, title: "Notas de débito" },
];

export type LibroIvaDailyBlock = {
  docKind: LibroIvaDocKind;
  letter: BillingInvoiceType | null;
  title: string;
  showLetterColumn: boolean;
  first: LibroIvaRow | null;
  last: LibroIvaRow | null;
  displayRows: LibroIvaRow[];
  totals: LibroIvaTotals;
};

function displayRowsForDailyGroup(group: LibroIvaRow[]): LibroIvaRow[] {
  const letters = ["A", "B"] as const;
  const displayRows: LibroIvaRow[] = [];

  for (const letter of letters) {
    const subset = group.filter((row) => row.letter === letter);
    if (subset.length === 0) {
      continue;
    }

    const first = subset[0]!;
    const last = subset[subset.length - 1]!;
    displayRows.push(first);
    if (first.number !== last.number) {
      displayRows.push(last);
    }
  }

  return displayRows;
}

export function buildLibroIvaDailyBlocks(
  rows: LibroIvaRow[],
): LibroIvaDailyBlock[] {
  return LIBRO_IVA_DAILY_BLOCKS.map((block) => {
    const group = rows.filter((row) => {
      if (row.docKind !== block.docKind) {
        return false;
      }
      if (block.letter === null) {
        return true;
      }
      return row.letter === block.letter;
    });
    const displayRows = displayRowsForDailyGroup(group);
    const first = displayRows[0] ?? null;
    const last =
      displayRows.length > 0
        ? (displayRows[displayRows.length - 1] ?? null)
        : null;

    return {
      docKind: block.docKind,
      letter: block.letter,
      title: block.title,
      showLetterColumn: block.letter === null,
      first,
      last,
      displayRows,
      totals: sumLibroIvaRows(group),
    };
  });
}

export type LibroIvaDailyReportVariant = "simple" | "detailed";

export type LibroIvaZSimpleRow = {
  tipo: string;
  numberFrom: string;
  numberTo: string;
  ivaPercent: number;
  netAmount: number;
  ivaAmount: number;
  total: number;
};

export type LibroIvaZSimpleSection = {
  title: string;
  rows: LibroIvaZSimpleRow[];
  totals: LibroIvaTotals;
};

function zSimpleTipoLabel(row: LibroIvaRow): string {
  switch (row.docKind) {
    case "FACTURA":
      return `Factura ${row.letter}`;
    case "NC":
      return `NC ${row.letter}`;
    case "ND":
      return `ND ${row.letter}`;
    default: {
      const exhaustive: never = row.docKind;
      return exhaustive;
    }
  }
}

function zSimpleGroupKey(row: LibroIvaRow): string {
  return `${row.docKind}|${row.letter}|${row.ivaPercent}`;
}

function buildZSimpleRows(group: LibroIvaRow[]): LibroIvaZSimpleRow[] {
  const buckets = new Map<string, LibroIvaRow[]>();

  for (const row of group) {
    const key = zSimpleGroupKey(row);
    const current = buckets.get(key);
    if (current) {
      current.push(row);
    } else {
      buckets.set(key, [row]);
    }
  }

  const order = ["FACTURA", "NC", "ND"] as const;
  const letters = ["A", "B"] as const;
  const rows: LibroIvaZSimpleRow[] = [];

  for (const docKind of order) {
    for (const letter of letters) {
      const matchingKeys = [...buckets.keys()]
        .filter((key) => key.startsWith(`${docKind}|${letter}|`))
        .sort((left, right) => {
          const leftPct = Number(left.split("|")[2]);
          const rightPct = Number(right.split("|")[2]);
          return leftPct - rightPct;
        });

      for (const key of matchingKeys) {
        const bucket = buckets.get(key);
        if (!bucket || bucket.length === 0) {
          continue;
        }
        const first = bucket[0]!;
        const last = bucket[bucket.length - 1]!;
        const totals = sumLibroIvaRows(bucket);
        rows.push({
          tipo: zSimpleTipoLabel(first),
          numberFrom: first.number,
          numberTo: last.number,
          ivaPercent: first.ivaPercent,
          netAmount: totals.netAmount,
          ivaAmount: totals.ivaAmount,
          total: totals.total,
        });
      }
    }
  }

  return rows;
}

export function buildLibroIvaZSimpleSections(
  rows: LibroIvaRow[],
): LibroIvaZSimpleSection[] {
  const ventas = rows.filter((row) => row.docKind === "FACTURA");
  const notas = rows.filter(
    (row) => row.docKind === "NC" || row.docKind === "ND",
  );

  return [
    {
      title: "TOTAL DE VENTAS DIARIO",
      rows: buildZSimpleRows(ventas),
      totals: sumLibroIvaRows(ventas),
    },
    {
      title: "TOTAL DE NOTAS DE CREDITO Y NOTAS DE DEBITO",
      rows: buildZSimpleRows(notas),
      totals: sumLibroIvaRows(notas),
    },
  ];
}
