/**
 * Helpers de la verificación read-only de la NC A de homologación.
 * No abre la base, no llama a ARCA y no escribe comprobantes.
 */
import { inflateSync } from "node:zlib";
import {
  buildLibroIvaRows,
  sumLibroIvaRows,
  type LibroIvaInvoiceSource,
  type LibroIvaNoteSource,
  type LibroIvaRow,
  type LibroIvaTotals,
} from "@/features/billing/utils/libro-iva";
import { invoiceOutstandingCents } from "@/features/billing/utils/invoice-settlement";

export const HOMO_ARTIFACT_ENVIRONMENT = "HOMOLOGACION" as const;
export const HOMO_ARTIFACT_POINT_OF_SALE = "0007";
export const HOMO_ARTIFACT_SEQUENCE = 1;
export const HOMO_ARTIFACT_INVOICE_NUMBER = "0007-00000001";
export const HOMO_ARTIFACT_NOTE_NUMBER = "0007-00000001";
export const HOMO_ARTIFACT_INVOICE_TOTAL_CENTS = 121_000;
export const HOMO_ARTIFACT_NOTE_AMOUNT_CENTS = 12_100;
export const HOMO_ARTIFACT_NOTE_NET_CENTS = 10_000;
export const HOMO_ARTIFACT_NOTE_IVA_CENTS = 2_100;
export const HOMO_ARTIFACT_OUTSTANDING_CENTS = 108_900;
export const HOMO_ARTIFACT_REASON = "PRUEBA HOMOLOGACION NC";
export const HOMO_ARTIFACT_YEAR = 2026;
export const HOMO_ARTIFACT_MONTH = 10;

export class ArtifactAbort extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactAbort";
  }
}

export function assertVerifyArtifactsArgs(argv: string[]): void {
  for (const arg of argv) {
    if (
      arg.toUpperCase().includes("PRODUCCION") ||
      arg.includes("ARCA_PROD_") ||
      arg.includes("ARCA_RUN_LIVE") ||
      arg.includes("ARCA_RUN_PROD")
    ) {
      throw new ArtifactAbort("Este script no acepta PRODUCCION ni corridas live.");
    }

    throw new ArtifactAbort("Este script identifica los comprobantes sin argumentos.");
  }
}

export function installFetchGuard(): void {
  globalThis.fetch = async () => {
    throw new ArtifactAbort("Una llamada de red intentó salir. Se aborta.");
  };
}

export function assertSingleMatch<T>(rows: readonly T[], label: string): T {
  if (rows.length === 0) {
    throw new ArtifactAbort(`No hay una coincidencia para ${label}.`);
  }

  if (rows.length > 1) {
    throw new ArtifactAbort(`Hay más de una coincidencia para ${label}.`);
  }

  const [row] = rows;

  if (row === undefined) {
    throw new ArtifactAbort(`No hay una coincidencia para ${label}.`);
  }

  return row;
}

export function pdfText(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  const parts: string[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const streamAt = buffer.indexOf("stream", cursor);
    if (streamAt < 0) {
      break;
    }

    let dataStart = streamAt + "stream".length;
    if (buffer[dataStart] === 0x0d) {
      dataStart += 1;
    }
    if (buffer[dataStart] === 0x0a) {
      dataStart += 1;
    }

    const end = buffer.indexOf("endstream", dataStart);
    if (end < 0) {
      break;
    }

    let dataEnd = end;
    if (buffer[dataEnd - 1] === 0x0a) {
      dataEnd -= 1;
    }
    if (buffer[dataEnd - 1] === 0x0d) {
      dataEnd -= 1;
    }

    const slice = buffer.subarray(dataStart, dataEnd);

    try {
      parts.push(inflateSync(slice).toString("latin1"));
    } catch {
      parts.push(slice.toString("latin1"));
    }

    cursor = end + "endstream".length;
  }

  return parts
    .join("\n")
    .replace(/<([0-9A-Fa-f\s]+)>/g, (token, hex: string) => {
      const clean = hex.replace(/\s/g, "");

      if (clean.length === 0 || clean.length % 2 !== 0) {
        return token;
      }

      return Buffer.from(clean, "hex").toString("latin1");
    });
}

export function formatCaeExpirationUtc(value: Date): string {
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const year = value.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function pesosClose(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.001;
}

export type QrCheckInput = {
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

export function formatQrVerification(input: QrCheckInput): string {
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
    input.tipoCmp === 3 &&
    input.nroCmp === 1 &&
    input.importe === 121 &&
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
    `fecha coincide: ${input.fecha === input.expectedFecha ? "sí" : "no"}`,
  ].join("\n");

  const secrets = [
    input.expectedCaeDigits,
    input.expectedIssuerCuitDigits,
    input.expectedReceptorDigits ?? "",
  ].filter((value) => value.length >= 8);

  for (const secret of secrets) {
    if (text.includes(secret)) {
      throw new ArtifactAbort("El reporte del QR iba a incluir un dato fiscal. No se imprime.");
    }
  }

  if (!valid) {
    throw new ArtifactAbort("El QR de la nota no coincide con el comprobante persistido.");
  }

  return text;
}

export function commercialOutstanding(input: {
  totalCents: number;
  creditCents: number;
  debitCents: number;
  allocatedCents: number;
}): number {
  return invoiceOutstandingCents(
    input.totalCents,
    input.creditCents,
    input.debitCents,
    input.allocatedCents,
  );
}

export function assertExpectedBalance(input: {
  totalCents: number;
  creditCents: number;
  debitCents: number;
  allocatedCents: number;
  fiscalStatus: string;
}): number {
  const outstanding = commercialOutstanding(input);
  const arithmetic =
    HOMO_ARTIFACT_INVOICE_TOTAL_CENTS - HOMO_ARTIFACT_NOTE_AMOUNT_CENTS;

  if (
    input.fiscalStatus !== "AUTORIZADA" ||
    input.totalCents !== HOMO_ARTIFACT_INVOICE_TOTAL_CENTS ||
    input.creditCents !== HOMO_ARTIFACT_NOTE_AMOUNT_CENTS ||
    input.debitCents !== 0 ||
    input.allocatedCents !== 0 ||
    outstanding !== HOMO_ARTIFACT_OUTSTANDING_CENTS ||
    arithmetic !== HOMO_ARTIFACT_OUTSTANDING_CENTS
  ) {
    throw new ArtifactAbort(
      `El saldo comercial no cierra. outstanding=${outstanding} total=${input.totalCents} credito=${input.creditCents} debito=${input.debitCents} imputado=${input.allocatedCents} estado=${input.fiscalStatus}`,
    );
  }

  return outstanding;
}

export type LibroArtifactAssessment = {
  onlyKnownPair: boolean;
  totals: LibroIvaTotals;
  lines: string[];
};

function isKnownInvoice(row: LibroIvaRow): boolean {
  return (
    row.docKind === "FACTURA" &&
    row.letter === "A" &&
    row.number === HOMO_ARTIFACT_INVOICE_NUMBER &&
    pesosClose(row.netAmount, 1000) &&
    pesosClose(row.ivaAmount, 210) &&
    pesosClose(row.total, 1210)
  );
}

function isKnownCreditNote(row: LibroIvaRow): boolean {
  return (
    row.docKind === "NC" &&
    row.letter === "A" &&
    row.number === HOMO_ARTIFACT_NOTE_NUMBER &&
    pesosClose(row.netAmount, -100) &&
    pesosClose(row.ivaAmount, -21) &&
    pesosClose(row.total, -121)
  );
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

export function assessHomologationLibro(
  invoices: LibroIvaInvoiceSource[],
  notes: LibroIvaNoteSource[],
): LibroArtifactAssessment {
  const rows = buildLibroIvaRows(invoices, notes);
  const invoice = rows.filter(isKnownInvoice);
  const note = rows.filter(isKnownCreditNote);

  if (invoice.length !== 1 || note.length !== 1) {
    throw new ArtifactAbort("El Libro IVA de homologación no tiene la factura A y la NC A esperadas.");
  }

  const known = new Set([invoice[0], note[0]]);
  const extras = rows.filter((row) => !known.has(row));
  const totals = sumLibroIvaRows(rows);
  const onlyKnownPair = extras.length === 0 && rows.length === 2;

  if (
    onlyKnownPair &&
    (!pesosClose(totals.netAmount, 900) ||
      !pesosClose(totals.ivaAmount, 189) ||
      !pesosClose(totals.total, 1089))
  ) {
    throw new ArtifactAbort("Los totales del par de homologación no cierran en 900 / 189 / 1089.");
  }

  return {
    onlyKnownPair,
    totals,
    lines: rows.map(libroLine),
  };
}

export function assertNotePdfText(input: {
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
    ["NOTA DE CRÉDITO", "el título"],
    ["COD. 003", "el código 003"],
    [HOMO_ARTIFACT_NOTE_NUMBER, "el número de la nota"],
    ["HOMOLOGACIÓN - SIN VALIDEZ FISCAL DE PRODUCCIÓN", "el banner de homologación"],
    ["CAE:", "la leyenda de CAE"],
    [input.cae, "el CAE"],
    [`Vto. CAE: ${input.expiration}`, "el vencimiento del CAE"],
    ["Comprobante asociado", "el comprobante asociado"],
    [`Factura A ${HOMO_ARTIFACT_INVOICE_NUMBER}`, "la factura asociada"],
    [input.amountLabel, "el importe"],
    [input.netLabel, "el neto"],
    [input.ivaLabel, "el IVA"],
    [HOMO_ARTIFACT_REASON, "el motivo"],
    [input.issuerName, "el emisor del snapshot"],
    [input.clientName, "el cliente del snapshot"],
  ];

  for (const [needle, label] of checks) {
    if (!needle.trim() || !input.text.includes(needle)) {
      throw new ArtifactAbort(`El PDF no contiene ${label}.`);
    }
  }

  const report = [
    "título NOTA DE CRÉDITO: sí",
    "letra A: sí",
    "COD. 003: sí",
    `número ${HOMO_ARTIFACT_NOTE_NUMBER}: sí`,
    "HOMOLOGACIÓN: sí",
    "SIN VALIDEZ FISCAL DE PRODUCCIÓN: sí",
    "CAE presente: sí",
    `vencimiento: ${input.expiration}`,
    "comprobante asociado: sí",
    "Factura A asociada: sí",
    "importe: sí",
    "neto: sí",
    "IVA: sí",
    "motivo: sí",
    "emisor del snapshot: sí",
    "cliente del snapshot: sí",
  ].join("\n");

  if (input.cae.length >= 8 && report.includes(input.cae)) {
    throw new ArtifactAbort("El reporte del PDF iba a incluir el CAE. No se imprime.");
  }

  return report;
}

export function productionFlagLabel(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    return "ausente";
  }

  return value.trim();
}
