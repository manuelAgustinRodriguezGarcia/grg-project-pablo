/**
 * Dry-run de UNA Nota de Crédito A contra una BillingInvoice ya autorizada.
 * No llama a issueArcaNote, WSAA ni WSFE.
 *
 * El número de la nota es simulado. Una ejecución futura debe usar una UUID
 * nueva, distinta de la de la factura, y repetir esa misma UUID en cada retry.
 *
 * Estrategia pendiente de cablear, sin cambio de motor en esta fase:
 * issueArcaNote ya acepta dependencies.loadSource. La UI no lo pasa y sigue
 * leyendo BillingFiscalSettings. El harness, cuando se habilite, puede pasar
 * un loader de solo lectura que fije settingsEnvironment en HOMOLOGACION
 * únicamente si la factura persistida es HOMOLOGACION. No usa getOrCreate.
 */
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceFiscalStatus,
  BillingInvoiceType,
  BillingIvaCondition,
} from "@/generated/prisma/client";
import { buildArcaNoteCaeRequest } from "@/server/arca/adapters/billing-note-to-cae";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import {
  ARCA_CURRENCY_ID,
  ARCA_CURRENCY_RATE,
  ARCA_VOUCHER_TYPE,
} from "@/shared/fiscal/arca-fiscal-mapping";

export const HOMO_CREDIT_NOTE_ENVIRONMENT = "HOMOLOGACION" as const;
export const HOMO_CREDIT_NOTE_POINT_OF_SALE = 7;
export const HOMO_CREDIT_NOTE_SEQUENCE = 1;
export const SIMULATED_NOTE_VOUCHER_NUMBER = 1;
export const HOMO_CREDIT_NOTE_REASON = "PRUEBA HOMOLOGACION NC";
const NOTE_TOTAL_CENTS = 12_100;
const NOTE_NET_CENTS = 10_000;
const NOTE_VAT_CENTS = 2_100;
const IVA_PERCENT = 21;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CREDIT_NOTE_EXECUTE_BLOCKED =
  "FASE 6D deja --execute bloqueado. El dry-run valida la NC A, pero esta fase no emite.";

export class HomoCreditNoteAbort extends Error {
  readonly exitCode: 1 | 2;

  constructor(message: string, exitCode: 1 | 2 = 1) {
    super(message);
    this.name = "HomoCreditNoteAbort";
    this.exitCode = exitCode;
  }
}

export type HomoCreditNoteInvoice = {
  id: string;
  invoiceNumber: string;
  environment: BillingFiscalEnvironment;
  fiscalStatus: BillingInvoiceFiscalStatus;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  sequenceNumber: number;
  issuedAt: Date;
  cae: string | null;
  ivaPercent: number;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
};

export type HomoCreditNoteArgs = {
  execute: boolean;
  confirmHomologacion: boolean;
  invoiceId: string | null;
  idempotencyKey: string | null;
};

function pesos(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function redactCreditNoteText(value: string): string {
  return value
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, "[redactado]")
    .replace(/\b\d{10,}\b/g, "[redactado]");
}

export function parseHomoCreditNoteArgs(argv: string[]): HomoCreditNoteArgs {
  let execute = false;
  let confirmHomologacion = false;
  let invoiceId: string | null = null;
  let idempotencyKey: string | null = null;

  for (const arg of argv) {
    if (arg === "--execute") {
      execute = true;
      continue;
    }

    if (arg === "--confirm-homologacion") {
      confirmHomologacion = true;
      continue;
    }

    if (arg.startsWith("--invoice-id=")) {
      invoiceId = arg.slice("--invoice-id=".length).trim();
      continue;
    }

    if (arg.startsWith("--idempotency-key=")) {
      idempotencyKey = arg.slice("--idempotency-key=".length).trim();
      continue;
    }

    if (
      arg.includes("ARCA_PROD_CERT_B64") ||
      arg.includes("ARCA_PROD_PRIVATE_KEY_B64") ||
      arg.includes("PRODUCCION")
    ) {
      throw new HomoCreditNoteAbort("El harness solo puede apuntar a HOMOLOGACION.");
    }

    throw new HomoCreditNoteAbort(`Argumento no reconocido: ${arg}`);
  }

  return { execute, confirmHomologacion, invoiceId, idempotencyKey };
}

export function assertHomoCreditNoteArgs(args: HomoCreditNoteArgs): void {
  if (!args.invoiceId) {
    throw new HomoCreditNoteAbort("Falta --invoice-id.");
  }

  if (!args.execute) {
    return;
  }

  if (!args.confirmHomologacion) {
    throw new HomoCreditNoteAbort("Falta --confirm-homologacion.");
  }

  if (!args.idempotencyKey) {
    throw new HomoCreditNoteAbort("Falta --idempotency-key.");
  }

  if (!UUID_PATTERN.test(args.idempotencyKey)) {
    throw new HomoCreditNoteAbort("La idempotencyKey tiene que ser un UUID.");
  }

  throw new HomoCreditNoteAbort(CREDIT_NOTE_EXECUTE_BLOCKED, 2);
}

export function assertHomoCreditNoteInvoice(
  invoice: HomoCreditNoteInvoice | null,
): HomoCreditNoteInvoice {
  if (!invoice) {
    throw new HomoCreditNoteAbort("Factura no encontrada.");
  }

  if (invoice.environment !== HOMO_CREDIT_NOTE_ENVIRONMENT) {
    throw new HomoCreditNoteAbort("La factura no es de HOMOLOGACION.");
  }

  if (invoice.fiscalStatus !== "AUTORIZADA") {
    throw new HomoCreditNoteAbort("La factura no está autorizada.");
  }

  if (!invoice.cae?.trim()) {
    throw new HomoCreditNoteAbort("La factura no tiene CAE.");
  }

  if (invoice.invoiceType !== "A") {
    throw new HomoCreditNoteAbort("Esta prueba solo admite una Factura A.");
  }

  let pointOfSale: number;

  try {
    pointOfSale = parseArcaPointOfSale(invoice.pointOfSale);
  } catch {
    throw new HomoCreditNoteAbort("El punto de venta no es 7.");
  }

  if (pointOfSale !== HOMO_CREDIT_NOTE_POINT_OF_SALE) {
    throw new HomoCreditNoteAbort("El punto de venta no es 7.");
  }

  if (invoice.sequenceNumber !== HOMO_CREDIT_NOTE_SEQUENCE) {
    throw new HomoCreditNoteAbort("Esta prueba exige la factura de sequenceNumber 1.");
  }

  if (invoice.ivaPercent !== IVA_PERCENT) {
    throw new HomoCreditNoteAbort("La factura no tiene IVA del 21%.");
  }

  return invoice;
}

export function describeHomoCreditNoteDryRun(input: {
  invoice: HomoCreditNoteInvoice | null;
  issuerCuit: string;
  settingsEnvironment: string;
  settingsUpdatedAt: string;
}): unknown {
  const invoice = assertHomoCreditNoteInvoice(input.invoice);
  const request = buildArcaNoteCaeRequest({
    kind: "CREDIT",
    invoiceType: invoice.invoiceType,
    amountCents: NOTE_TOTAL_CENTS,
    netAmountCents: NOTE_NET_CENTS,
    ivaAmountCents: NOTE_VAT_CENTS,
    ivaPercent: IVA_PERCENT,
    issuedAt: invoice.issuedAt,
    receptor: {
      identificationType: invoice.clientIdentificationType,
      identificationNumber: invoice.clientIdentificationNumber,
      ivaCondition: invoice.clientIvaCondition,
    },
    associatedInvoice: {
      invoiceType: invoice.invoiceType,
      pointOfSale: invoice.pointOfSale,
      sequenceNumber: invoice.sequenceNumber,
      issuedAt: invoice.issuedAt,
      environment: invoice.environment,
      fiscalStatus: invoice.fiscalStatus,
      cae: invoice.cae,
    },
    environment: invoice.environment,
    issuerCuit: input.issuerCuit,
    voucherNumber: SIMULATED_NOTE_VOUCHER_NUMBER,
  });
  const associated = request.associatedVouchers?.[0];

  if (
    request.voucherType !== ARCA_VOUCHER_TYPE.NOTA_CREDITO_A ||
    request.currencyId !== ARCA_CURRENCY_ID ||
    request.currencyRate !== ARCA_CURRENCY_RATE ||
    request.totalAmount !== 121 ||
    request.netAmount !== 100 ||
    request.vatAmount !== 21 ||
    request.associatedVouchers?.length !== 1 ||
    !associated ||
    associated.type !== ARCA_VOUCHER_TYPE.FACTURA_A ||
    associated.pointOfSale !== HOMO_CREDIT_NOTE_POINT_OF_SALE ||
    associated.number !== HOMO_CREDIT_NOTE_SEQUENCE
  ) {
    throw new HomoCreditNoteAbort("El request de la nota de crédito A no cerró.");
  }

  const summary = {
    modo: "dry-run",
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceEnvironment: invoice.environment,
    invoiceFiscalStatus: invoice.fiscalStatus,
    invoiceCaePresente: true,
    nota: {
      kind: "CREDIT",
      motivo: HOMO_CREDIT_NOTE_REASON,
      voucherType: request.voucherType,
      amount: pesos(NOTE_TOTAL_CENTS),
      net: pesos(NOTE_NET_CENTS),
      iva: pesos(NOTE_VAT_CENTS),
      voucherNumberSimulado: SIMULATED_NOTE_VOUCHER_NUMBER,
      voucherNumberEsFiscal: false,
    },
    associatedVoucher: {
      type: associated.type,
      pointOfSale: associated.pointOfSale,
      number: associated.number,
      issuedAt: associated.issuedAt ?? "",
    },
    moneda: request.currencyId,
    cotizacion: request.currencyRate,
    requestValido: true,
    idempotencyKeyFutura: "UUID nueva, distinta de la factura. Los retries usan esa misma UUID.",
    billingFiscalSettings: {
      environmentPersistido: input.settingsEnvironment,
      updatedAt: input.settingsUpdatedAt,
      modificado: false,
    },
    wsaa: 0,
    wsfe: 0,
    fecaesolicitar: 0,
    escriturasDb: 0,
    executeBloqueado: true,
  };
  const text = JSON.stringify(summary);

  if (
    (invoice.cae && text.includes(invoice.cae)) ||
    (invoice.clientIdentificationNumber &&
      text.includes(invoice.clientIdentificationNumber)) ||
    text.includes(input.issuerCuit) ||
    text.includes("BEGIN CERTIFICATE") ||
    text.includes("BEGIN PRIVATE KEY")
  ) {
    throw new HomoCreditNoteAbort("El resumen iba a incluir un documento o un CAE. No se imprime.");
  }

  return summary;
}
