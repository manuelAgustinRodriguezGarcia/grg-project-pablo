/**
 * Helpers de la verificación read-only de la ND A de homologación.
 * No abre la base, no llama a ARCA y no escribe comprobantes.
 */
import {
  buildLibroIvaRows,
  sumLibroIvaRows,
  type LibroIvaInvoiceSource,
  type LibroIvaNoteSource,
  type LibroIvaRow,
  type LibroIvaTotals,
} from "@/features/billing/utils/libro-iva";
import { invoiceOutstandingCents } from "@/features/billing/utils/invoice-settlement";
import {
  ArtifactAbort,
  formatCaeExpirationUtc,
  installFetchGuard,
  pdfText,
  productionFlagLabel,
} from "./arca-homo-verify-note-artifacts-plan";

export {
  ArtifactAbort,
  formatCaeExpirationUtc,
  installFetchGuard,
  pdfText,
  productionFlagLabel,
};

export const HOMO_DEBIT_ARTIFACT_NOTE_ID = "cmuv9agjm00013cf0g0ohdvny";
export const HOMO_DEBIT_ARTIFACT_INVOICE_ID = "cmuv8gxqo0001c0f0h2ln2fku";
export const HOMO_DEBIT_ARTIFACT_INVOICE_NUMBER = "0007-00000002";
export const HOMO_DEBIT_ARTIFACT_NOTE_NUMBER = "0007-00000001";
export const HOMO_DEBIT_ARTIFACT_CASH_INVOICE_NUMBER = "0007-00000001";
export const HOMO_DEBIT_ARTIFACT_REASON = "PRUEBA HOMOLOGACION ND";
export const HOMO_DEBIT_ARTIFACT_INVOICE_TOTAL_CENTS = 121_000;
export const HOMO_DEBIT_ARTIFACT_NOTE_AMOUNT_CENTS = 6_050;
export const HOMO_DEBIT_ARTIFACT_NOTE_NET_CENTS = 5_000;
export const HOMO_DEBIT_ARTIFACT_NOTE_IVA_CENTS = 1_050;
export const HOMO_DEBIT_ARTIFACT_OUTSTANDING_CENTS = 127_050;
export const HOMO_DEBIT_ARTIFACT_YEAR = 2026;
export const HOMO_DEBIT_ARTIFACT_MONTH = 10;

export function assertDebitArtifactArgs(argv: string[]): void {
  for (const arg of argv) {
    if (
      arg.toUpperCase().includes("PRODUCCION") ||
      arg.includes("ARCA_PROD_") ||
      arg.includes("ARCA_RUN_LIVE") ||
      arg.includes("ARCA_RUN_PROD") ||
      arg.includes("--execute") ||
      arg.includes("--verify")
    ) {
      throw new ArtifactAbort("Este script no acepta PRODUCCION ni corridas live.");
    }

    throw new ArtifactAbort("Este script identifica los comprobantes sin argumentos.");
  }
}

function pesosClose(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}

export type DebitQrCheckInput = {
  ver: number;
  fecha: string;
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  moneda: string;
  ctz: number;
  tipoCodAut: string;
  codAut: number;
  tipoDocRec?: number;
  nroDocRec?: number;
  expectedFecha: string;
  expectedCaeDigits: string;
  expectedIssuerCuitDigits: string;
  expectedReceptorDigits: string | null;
  expectedReceptorDocType: number | null;
};

export function formatDebitQrVerification(input: DebitQrCheckInput): string {
  const caeMatches = input.codAut === Number(input.expectedCaeDigits);
  const issuerMatches = input.cuit === Number(input.expectedIssuerCuitDigits);
  const receptorPresent =
    input.expectedReceptorDigits !== null &&
    input.tipoDocRec === input.expectedReceptorDocType &&
    input.nroDocRec === Number(input.expectedReceptorDigits);
  const valid =
    input.ver === 1 &&
    input.fecha === input.expectedFecha &&
    issuerMatches &&
    input.ptoVta === 7 &&
    input.tipoCmp === 2 &&
    input.nroCmp === 1 &&
    input.importe === 60.5 &&
    input.moneda === "PES" &&
    input.ctz === 1 &&
    input.tipoCodAut === "E" &&
    caeMatches &&
    receptorPresent;
  const text = [
    `QR válido: ${valid ? "sí" : "no"}`,
    `tipoCmp: ${input.tipoCmp}`,
    `ptoVta: ${input.ptoVta}`,
    `nroCmp: ${input.nroCmp}`,
    `importe: ${input.importe.toFixed(2)}`,
    `tipoCodAut: ${input.tipoCodAut}`,
    `documento receptor: ${receptorPresent ? "sí" : "no"}`,
    `CAE coincide: ${caeMatches ? "sí" : "no"}`,
  ].join("\n");
  const secrets = [
    input.expectedCaeDigits,
    input.expectedIssuerCuitDigits,
    input.expectedReceptorDigits ?? "",
    String(input.codAut),
    String(input.cuit),
    String(input.nroDocRec ?? ""),
  ].filter((value) => value.length >= 8);

  for (const secret of secrets) {
    if (text.includes(secret)) {
      throw new ArtifactAbort("El reporte del QR iba a incluir un dato fiscal. No se imprime.");
    }
  }

  if (!valid) {
    throw new ArtifactAbort("El QR de la nota de débito no coincide con el comprobante persistido.");
  }

  return text;
}

export function assertDebitNoteBalance(input: {
  totalCents: number;
  creditCents: number;
  debitCents: number;
  allocatedCents: number;
  fiscalStatus: string;
  paymentMethod: string;
  paymentStatus: string;
}): number {
  const outstanding = invoiceOutstandingCents(
    input.totalCents,
    input.creditCents,
    input.debitCents,
    input.allocatedCents,
  );
  const arithmetic =
    HOMO_DEBIT_ARTIFACT_INVOICE_TOTAL_CENTS + HOMO_DEBIT_ARTIFACT_NOTE_AMOUNT_CENTS;

  if (
    input.fiscalStatus !== "AUTORIZADA" ||
    input.paymentMethod !== "CUENTA_CORRIENTE" ||
    input.paymentStatus !== "IMPAGA" ||
    input.totalCents !== HOMO_DEBIT_ARTIFACT_INVOICE_TOTAL_CENTS ||
    input.creditCents !== 0 ||
    input.debitCents !== HOMO_DEBIT_ARTIFACT_NOTE_AMOUNT_CENTS ||
    input.allocatedCents !== 0 ||
    outstanding !== HOMO_DEBIT_ARTIFACT_OUTSTANDING_CENTS ||
    arithmetic !== HOMO_DEBIT_ARTIFACT_OUTSTANDING_CENTS
  ) {
    throw new ArtifactAbort("El saldo de la factura base no cierra en 1270.50.");
  }

  return outstanding;
}

type KnownKind = "cash-invoice" | "base-invoice" | "credit-note" | "debit-note";

function knownKind(row: LibroIvaRow): KnownKind | null {
  if (
    row.docKind === "FACTURA" &&
    row.letter === "A" &&
    row.number === HOMO_DEBIT_ARTIFACT_CASH_INVOICE_NUMBER &&
    pesosClose(row.netAmount, 1000) &&
    pesosClose(row.ivaAmount, 210) &&
    pesosClose(row.total, 1210)
  ) {
    return "cash-invoice";
  }

  if (
    row.docKind === "FACTURA" &&
    row.letter === "A" &&
    row.number === HOMO_DEBIT_ARTIFACT_INVOICE_NUMBER &&
    pesosClose(row.netAmount, 1000) &&
    pesosClose(row.ivaAmount, 210) &&
    pesosClose(row.total, 1210)
  ) {
    return "base-invoice";
  }

  if (
    row.docKind === "NC" &&
    row.letter === "A" &&
    row.number === HOMO_DEBIT_ARTIFACT_NOTE_NUMBER &&
    pesosClose(row.netAmount, -100) &&
    pesosClose(row.ivaAmount, -21) &&
    pesosClose(row.total, -121)
  ) {
    return "credit-note";
  }

  if (
    row.docKind === "ND" &&
    row.letter === "A" &&
    row.number === HOMO_DEBIT_ARTIFACT_NOTE_NUMBER &&
    pesosClose(row.netAmount, 50) &&
    pesosClose(row.ivaAmount, 10.5) &&
    pesosClose(row.total, 60.5)
  ) {
    return "debit-note";
  }

  return null;
}

function libroLine(row: LibroIvaRow): string {
  return [
    row.docKind,
    row.letter,
    row.number,
    `neto ${row.netAmount.toFixed(2)}`,
    `iva ${row.ivaAmount.toFixed(2)}`,
    `total ${row.total.toFixed(2)}`,
  ].join(" ");
}

export type DebitLibroAssessment = {
  onlyKnownFour: boolean;
  totals: LibroIvaTotals;
  lines: string[];
  rows: LibroIvaRow[];
};

export function assessDebitHomologationLibro(
  invoices: LibroIvaInvoiceSource[],
  notes: LibroIvaNoteSource[],
): DebitLibroAssessment {
  const rows = buildLibroIvaRows(invoices, notes);
  const counts = new Map<KnownKind, number>();

  for (const row of rows) {
    const kind = knownKind(row);
    if (!kind) {
      continue;
    }

    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }

  const required: KnownKind[] = ["cash-invoice", "base-invoice", "credit-note", "debit-note"];

  for (const kind of required) {
    if (counts.get(kind) !== 1) {
      throw new ArtifactAbort("El Libro IVA de homologación no tiene los cuatro comprobantes esperados.");
    }
  }

  const debit = rows.find((row) => knownKind(row) === "debit-note");

  if (!debit || debit.netAmount <= 0 || debit.ivaAmount <= 0 || debit.total <= 0) {
    throw new ArtifactAbort("La nota de débito aparece negativa en el Libro IVA.");
  }

  const knownRows = rows.filter((row) => knownKind(row) !== null);
  const onlyKnownFour = knownRows.length === rows.length && rows.length === 4;
  const totals = sumLibroIvaRows(rows);

  if (
    onlyKnownFour &&
    (!pesosClose(totals.netAmount, 1950) ||
      !pesosClose(totals.ivaAmount, 409.5) ||
      !pesosClose(totals.total, 2359.5))
  ) {
    throw new ArtifactAbort("Los totales de homologación no cierran en 1950.00 / 409.50 / 2359.50.");
  }

  return {
    onlyKnownFour,
    totals,
    lines: rows.map(libroLine),
    rows,
  };
}

export function assertDebitNotePdfText(input: {
  text: string;
  cae: string;
  expiration: string;
  issuerName: string;
  clientName: string;
  amountLabel: string;
  netLabel: string;
  ivaLabel: string;
}): string {
  const checks: Array<[string, string]> = [
    ["NOTA DE DÉBITO", "el título"],
    ["COD. 002", "el código 002"],
    [HOMO_DEBIT_ARTIFACT_NOTE_NUMBER, "el número de la nota"],
    ["HOMOLOGACIÓN - SIN VALIDEZ FISCAL DE PRODUCCIÓN", "el banner de homologación"],
    ["CAE:", "la leyenda de CAE"],
    [input.cae, "el CAE"],
    [`Vto. CAE: ${input.expiration}`, "el vencimiento del CAE"],
    ["Comprobante asociado", "el comprobante asociado"],
    [`Factura A ${HOMO_DEBIT_ARTIFACT_INVOICE_NUMBER}`, "la factura asociada"],
    [input.amountLabel, "el importe"],
    [input.netLabel, "el neto"],
    [input.ivaLabel, "el IVA"],
    [HOMO_DEBIT_ARTIFACT_REASON, "el motivo"],
    [input.issuerName, "el emisor del snapshot"],
    [input.clientName, "el cliente del snapshot"],
  ];

  for (const [needle, label] of checks) {
    if (!needle.trim() || !input.text.includes(needle)) {
      throw new ArtifactAbort(`El PDF no contiene ${label}.`);
    }
  }

  const report = [
    "título NOTA DE DÉBITO: sí",
    "letra A: sí",
    "COD. 002: sí",
    `número ${HOMO_DEBIT_ARTIFACT_NOTE_NUMBER}: sí`,
    "HOMOLOGACIÓN: sí",
    "SIN VALIDEZ FISCAL DE PRODUCCIÓN: sí",
    "CAE presente: sí",
    `vencimiento: ${input.expiration}`,
    "comprobante asociado: sí",
    `Factura A ${HOMO_DEBIT_ARTIFACT_INVOICE_NUMBER}: sí`,
    "importe $60,50: sí",
    "neto $50,00: sí",
    "IVA $10,50: sí",
    "motivo: sí",
    "emisor del snapshot: sí",
    "cliente del snapshot: sí",
  ].join("\n");

  if (input.cae.length >= 8 && report.includes(input.cae)) {
    throw new ArtifactAbort("El reporte del PDF iba a incluir el CAE. No se imprime.");
  }

  return report;
}

export function assertProductionIsolationById(input: {
  invoiceId: string;
  noteId: string;
  activeInvoiceIds: readonly string[];
  activeNoteIds: readonly string[];
  dashboardInvoiceIds: readonly string[];
  debtorSourceInvoiceIds: readonly string[];
  movementIds: readonly string[];
  movementInvoiceIds: readonly string[];
  libroInvoiceIds: readonly string[];
  libroNoteIds: readonly string[];
}): void {
  const present =
    input.activeInvoiceIds.includes(input.invoiceId) ||
    input.activeNoteIds.includes(input.noteId) ||
    input.dashboardInvoiceIds.includes(input.invoiceId) ||
    input.debtorSourceInvoiceIds.includes(input.invoiceId) ||
    input.movementIds.includes(input.noteId) ||
    input.movementIds.includes(input.invoiceId) ||
    input.movementInvoiceIds.includes(input.invoiceId) ||
    input.libroInvoiceIds.includes(input.invoiceId) ||
    input.libroNoteIds.includes(input.noteId);

  if (present) {
    throw new ArtifactAbort("Un comprobante de homologación aparece en el alcance productivo.");
  }
}

export type CoexistingNote = {
  id: string;
  environment: string;
  kind: string;
  voucherType: number;
  sequenceNumber: number;
  noteNumber: string;
};

export function assertCreditAndDebitCoexist(notes: readonly CoexistingNote[]): void {
  const credit = notes.filter(
    (note) =>
      note.environment === "HOMOLOGACION" &&
      note.kind === "CREDIT" &&
      note.voucherType === 3 &&
      note.sequenceNumber === 1 &&
      note.noteNumber === HOMO_DEBIT_ARTIFACT_NOTE_NUMBER,
  );
  const debit = notes.filter(
    (note) =>
      note.id === HOMO_DEBIT_ARTIFACT_NOTE_ID &&
      note.environment === "HOMOLOGACION" &&
      note.kind === "DEBIT" &&
      note.voucherType === 2 &&
      note.sequenceNumber === 1 &&
      note.noteNumber === HOMO_DEBIT_ARTIFACT_NOTE_NUMBER,
  );

  if (credit.length !== 1 || debit.length !== 1 || credit[0]?.id === debit[0]?.id) {
    throw new ArtifactAbort("La NC A tipo 3 y la ND A tipo 2 no conviven como documentos distintos.");
  }
}
