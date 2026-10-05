/**
 * Dry-run de UNA Nota de Débito A de homologación.
 * La factura asociada es la segunda Factura A de cuenta corriente.
 * El número de la nota no se asume: en vivo lo asigna issueArcaNote con last + 1.
 * El futuro --execute usará loadHomologationNoteEmissionSource.
 * issueBillingNoteAction sigue con el loader de BillingFiscalSettings.
 * --execute queda bloqueado en esta fase.
 */
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceFiscalStatus,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingPaymentMethod,
  BillingPaymentStatus,
} from "@/generated/prisma/client";
import { formatArcaVoucherDate } from "@/server/arca/adapters/billing-invoice-to-cae";
import { buildArcaNoteCaeRequest } from "@/server/arca/adapters/billing-note-to-cae";
import { assertCommercialLimits } from "@/server/arca/notes/issue-arca-note";
import type { ArcaNoteEmissionSource } from "@/server/arca/notes/note-emission-source";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import {
  invoiceFiscalStatusFromNotes,
  invoiceOutstandingCents,
  invoicePaymentStatusFromSettlement,
  persistedFiscalStatusAfterSettlement,
  splitGrossIvaCents,
} from "@/features/billing/utils/invoice-settlement";
import {
  ARCA_CURRENCY_ID,
  ARCA_CURRENCY_RATE,
  ARCA_VOUCHER_TYPE,
} from "@/shared/fiscal/arca-fiscal-mapping";

export const HOMO_DEBIT_NOTE_ENVIRONMENT = "HOMOLOGACION" as const;
export const HOMO_DEBIT_NOTE_POINT_OF_SALE = 7;
export const HOMO_DEBIT_NOTE_INVOICE_ID = "cmuv8gxqo0001c0f0h2ln2fku";
export const HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER = "0007-00000001";
export const HOMO_DEBIT_NOTE_CASH_INVOICE_ID = "cmuuoyff20002jsf0a7baej66";
export const HOMO_DEBIT_NOTE_REASON = "PRUEBA HOMOLOGACION ND";
export const HOMO_DEBIT_NOTE_AMOUNT_CENTS = 6_050;
export const HOMO_DEBIT_NOTE_EXECUTE_BLOCKED =
  "FASE 6H deja --execute bloqueado. El dry-run prepara la Nota de Débito A, pero esta fase no emite.";

const NOTE_NET_CENTS = 5_000;
const NOTE_VAT_CENTS = 1_050;
const INVOICE_TOTAL_CENTS = 121_000;
const EXPECTED_OUTSTANDING_CENTS = 127_050;
const IVA_PERCENT = 21;
const SIMULATED_NOTE_VOUCHER_NUMBER = 900_002;

export const HOMO_DEBIT_NOTE_INPUT = {
  kind: "DEBIT",
  amountCents: HOMO_DEBIT_NOTE_AMOUNT_CENTS,
  reason: HOMO_DEBIT_NOTE_REASON,
} as const;

export class HomoDebitNoteAbort extends Error {
  readonly exitCode: 1 | 2;

  constructor(message: string, exitCode: 1 | 2 = 1) {
    super(message);
    this.name = "HomoDebitNoteAbort";
    this.exitCode = exitCode;
  }
}

export type HomoDebitNoteMode = "dry-run" | "execute";

export type HomoDebitNoteArgs = {
  mode: HomoDebitNoteMode;
  execute: boolean;
  confirmHomologacion: boolean;
  invoiceId: string | null;
  idempotencyKey: string | null;
  createdByUserId: string | null;
};

export type DebitBaseCandidate = {
  id: string;
  invoiceNumber: string;
  environment: string;
  fiscalStatus: string;
  invoiceType: string;
  pointOfSale: string;
  paymentMethod: string;
  totalCents: number;
  caePresent: boolean;
};

export type HomoDebitNoteInvoice = {
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
  paymentMethod: BillingPaymentMethod;
  paymentStatus: BillingPaymentStatus;
  totalCents: number;
  outstandingCents: number;
  client: {
    id: string | null;
    code: string;
    name: string;
    identificationType: BillingIdentificationType;
    identificationNumber: string | null;
    ivaCondition: BillingIvaCondition;
  };
};

function pesos(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function parseHomoDebitNoteArgs(argv: string[]): HomoDebitNoteArgs {
  let execute = false;
  let confirmHomologacion = false;
  let invoiceId: string | null = null;
  let idempotencyKey: string | null = null;
  let createdByUserId: string | null = null;

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

    if (arg.startsWith("--created-by-user-id=")) {
      createdByUserId = arg.slice("--created-by-user-id=".length).trim();
      continue;
    }

    if (
      arg.toUpperCase().includes("PRODUCCION") ||
      arg.includes("ARCA_PROD_") ||
      arg.includes("ARCA_RUN_")
    ) {
      throw new HomoDebitNoteAbort("Este harness no acepta PRODUCCION ni credenciales productivas.");
    }

    throw new HomoDebitNoteAbort(`Argumento no reconocido: ${arg}`);
  }

  return {
    mode: execute ? "execute" : "dry-run",
    execute,
    confirmHomologacion,
    invoiceId,
    idempotencyKey,
    createdByUserId,
  };
}

export function assertHomoDebitNoteArgs(args: HomoDebitNoteArgs): void {
  if (args.execute) {
    throw new HomoDebitNoteAbort(HOMO_DEBIT_NOTE_EXECUTE_BLOCKED, 2);
  }

  if (
    args.invoiceId === HOMO_DEBIT_NOTE_CASH_INVOICE_ID ||
    args.invoiceId === HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER
  ) {
    throw new HomoDebitNoteAbort("La factura de contado 0007-00000001 no es base de esta nota de débito.");
  }

  if (args.invoiceId !== HOMO_DEBIT_NOTE_INVOICE_ID) {
    throw new HomoDebitNoteAbort("Esta prueba solo admite la segunda Factura A de cuenta corriente.");
  }
}

export function assertDebitNoteAdministrator(
  user: { role: string; status: string } | null,
): void {
  if (!user || user.role !== "ADMINISTRADOR" || user.status !== "ACTIVE") {
    throw new HomoDebitNoteAbort("El usuario no es un administrador activo.");
  }
}

export function selectDebitBaseInvoice<T extends DebitBaseCandidate>(rows: readonly T[]): T {
  const candidates = rows.filter(
    (row) =>
      row.invoiceNumber !== HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER &&
      row.id !== HOMO_DEBIT_NOTE_CASH_INVOICE_ID &&
      row.environment === HOMO_DEBIT_NOTE_ENVIRONMENT &&
      row.fiscalStatus === "AUTORIZADA" &&
      row.invoiceType === "A" &&
      row.pointOfSale === "0007" &&
      row.paymentMethod === "CUENTA_CORRIENTE" &&
      row.totalCents === INVOICE_TOTAL_CENTS &&
      row.caePresent,
  );

  if (candidates.length !== 1) {
    throw new HomoDebitNoteAbort(
      `Hay ${candidates.length} facturas candidatas para la nota de débito. Se esperaba una.`,
    );
  }

  const selected = candidates[0];

  if (!selected || selected.id !== HOMO_DEBIT_NOTE_INVOICE_ID) {
    throw new HomoDebitNoteAbort("La candidata no es la segunda Factura A de cuenta corriente.");
  }

  return selected;
}

function emissionSource(invoice: HomoDebitNoteInvoice): ArcaNoteEmissionSource {
  return {
    settingsEnvironment: HOMO_DEBIT_NOTE_ENVIRONMENT,
    issuerCuit: "",
    issuer: {
      issuerName: null,
      issuerCuit: null,
      issuerAddress: null,
      issuerCity: null,
      issuerProvince: null,
      issuerIvaCondition: null,
      issuerGrossIncome: null,
      issuerActivitiesStartedAt: null,
      pointOfSale: invoice.pointOfSale,
    },
    invoice: {
      id: invoice.id,
      environment: invoice.environment,
      fiscalStatus: invoice.fiscalStatus,
      invoiceType: invoice.invoiceType,
      pointOfSale: invoice.pointOfSale,
      sequenceNumber: invoice.sequenceNumber,
      issuedAt: invoice.issuedAt,
      cae: invoice.cae,
      ivaPercent: invoice.ivaPercent,
      totalVisualRoundedCents: invoice.totalCents,
      paymentMethod: invoice.paymentMethod,
      paymentStatus: invoice.paymentStatus,
      client: invoice.client,
    },
    authorizedCreditCents: 0,
    authorizedDebitCents: 0,
    allocatedCents: 0,
  };
}

export function assertCashInvoiceRejectsDebit(invoice: HomoDebitNoteInvoice): void {
  try {
    assertCommercialLimits(emissionSource(invoice), "DEBIT", HOMO_DEBIT_NOTE_AMOUNT_CENTS);
  } catch (error) {
    if (error instanceof BillingInvoiceError) {
      return;
    }

    throw error;
  }

  throw new HomoDebitNoteAbort("La factura de contado aceptaría una nota de débito.");
}

export function assertHomoDebitNoteInvoice(
  invoice: HomoDebitNoteInvoice | null,
): HomoDebitNoteInvoice {
  if (!invoice) {
    throw new HomoDebitNoteAbort("Factura no encontrada.");
  }

  if (
    invoice.id === HOMO_DEBIT_NOTE_CASH_INVOICE_ID ||
    invoice.invoiceNumber === HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER
  ) {
    throw new HomoDebitNoteAbort("La factura de contado 0007-00000001 no es base de esta nota de débito.");
  }

  if (invoice.id !== HOMO_DEBIT_NOTE_INVOICE_ID) {
    throw new HomoDebitNoteAbort("Esta prueba solo admite la segunda Factura A de cuenta corriente.");
  }

  if (invoice.environment !== HOMO_DEBIT_NOTE_ENVIRONMENT) {
    throw new HomoDebitNoteAbort("La factura no es de HOMOLOGACION.");
  }

  if (invoice.fiscalStatus !== "AUTORIZADA") {
    throw new HomoDebitNoteAbort("La factura no está autorizada.");
  }

  if (!invoice.cae?.trim()) {
    throw new HomoDebitNoteAbort("La factura no tiene CAE.");
  }

  if (invoice.invoiceType !== "A") {
    throw new HomoDebitNoteAbort("Esta prueba solo admite una Factura A.");
  }

  let pointOfSale: number;

  try {
    pointOfSale = parseArcaPointOfSale(invoice.pointOfSale);
  } catch {
    throw new HomoDebitNoteAbort("El punto de venta no es 7.");
  }

  if (pointOfSale !== HOMO_DEBIT_NOTE_POINT_OF_SALE) {
    throw new HomoDebitNoteAbort("El punto de venta no es 7.");
  }

  if (invoice.paymentMethod !== "CUENTA_CORRIENTE") {
    throw new HomoDebitNoteAbort("La factura no es de cuenta corriente.");
  }

  if (invoice.paymentStatus === "PAGA" || invoice.paymentStatus === "ANULADA") {
    throw new HomoDebitNoteAbort("El estado de pago no admite una nota de débito.");
  }

  if (invoice.outstandingCents <= 0 || invoice.outstandingCents !== INVOICE_TOTAL_CENTS) {
    throw new HomoDebitNoteAbort("La factura no tiene saldo pendiente de 1210.00.");
  }

  if (invoice.totalCents !== INVOICE_TOTAL_CENTS || invoice.ivaPercent !== IVA_PERCENT) {
    throw new HomoDebitNoteAbort("La factura no cierra en 1210.00 con IVA del 21%.");
  }

  if (!Number.isSafeInteger(invoice.sequenceNumber) || invoice.sequenceNumber <= 0) {
    throw new HomoDebitNoteAbort("La factura no tiene un número de comprobante persistido.");
  }

  return invoice;
}

export function describeHomoDebitNoteDryRun(input: {
  invoice: HomoDebitNoteInvoice | null;
  issuerCuit: string;
  settingsEnvironment: string;
  settingsUpdatedAt: string;
  cashRejected: boolean;
}): unknown {
  const invoice = assertHomoDebitNoteInvoice(input.invoice);

  assertCommercialLimits(
    emissionSource(invoice),
    HOMO_DEBIT_NOTE_INPUT.kind,
    HOMO_DEBIT_NOTE_INPUT.amountCents,
  );

  const split = splitGrossIvaCents(HOMO_DEBIT_NOTE_AMOUNT_CENTS, IVA_PERCENT);

  if (split.netCents !== NOTE_NET_CENTS || split.ivaCents !== NOTE_VAT_CENTS) {
    throw new HomoDebitNoteAbort("El importe de la nota no cierra en 50.00 + 10.50.");
  }

  const request = buildArcaNoteCaeRequest({
    kind: HOMO_DEBIT_NOTE_INPUT.kind,
    invoiceType: invoice.invoiceType,
    amountCents: HOMO_DEBIT_NOTE_AMOUNT_CENTS,
    netAmountCents: split.netCents,
    ivaAmountCents: split.ivaCents,
    ivaPercent: IVA_PERCENT,
    issuedAt: invoice.issuedAt,
    receptor: {
      identificationType: invoice.client.identificationType,
      identificationNumber: invoice.client.identificationNumber,
      ivaCondition: invoice.client.ivaCondition,
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
  const associatedDate = formatArcaVoucherDate(invoice.issuedAt);
  const outstandingCents = invoiceOutstandingCents(
    invoice.totalCents,
    0,
    HOMO_DEBIT_NOTE_AMOUNT_CENTS,
    0,
  );
  const commercialFiscalStatus = invoiceFiscalStatusFromNotes(
    0,
    HOMO_DEBIT_NOTE_AMOUNT_CENTS,
    invoice.totalCents,
  );
  const fiscalStatus = persistedFiscalStatusAfterSettlement(
    invoice.fiscalStatus,
    commercialFiscalStatus,
  );
  const paymentStatus = invoicePaymentStatusFromSettlement(
    commercialFiscalStatus,
    outstandingCents,
    invoice.totalCents,
    invoice.paymentMethod,
  );

  if (
    request.environment !== HOMO_DEBIT_NOTE_ENVIRONMENT ||
    request.voucherType !== ARCA_VOUCHER_TYPE.NOTA_DEBITO_A ||
    request.currencyId !== ARCA_CURRENCY_ID ||
    request.currencyRate !== ARCA_CURRENCY_RATE ||
    request.totalAmount !== 60.5 ||
    request.netAmount !== 50 ||
    request.vatAmount !== 10.5 ||
    request.voucherFrom !== SIMULATED_NOTE_VOUCHER_NUMBER ||
    request.voucherFrom === invoice.sequenceNumber ||
    !associated ||
    request.associatedVouchers?.length !== 1 ||
    associated.type !== ARCA_VOUCHER_TYPE.FACTURA_A ||
    associated.pointOfSale !== HOMO_DEBIT_NOTE_POINT_OF_SALE ||
    associated.number !== invoice.sequenceNumber ||
    associated.issuedAt !== associatedDate ||
    outstandingCents !== EXPECTED_OUTSTANDING_CENTS ||
    fiscalStatus !== "AUTORIZADA" ||
    commercialFiscalStatus !== "AJUSTADA_ND" ||
    paymentStatus !== "IMPAGA" ||
    !input.cashRejected
  ) {
    throw new HomoDebitNoteAbort("El request de la nota de débito A no cerró.");
  }

  const summary = {
    escenario: "NOTA DE DEBITO A",
    modo: "dry-run",
    factura: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      sequenceNumber: invoice.sequenceNumber,
      environment: invoice.environment,
      paymentMethod: invoice.paymentMethod,
      paymentStatus: invoice.paymentStatus,
      outstandingCents: invoice.outstandingCents,
      caePresente: true,
    },
    nota: {
      kind: HOMO_DEBIT_NOTE_INPUT.kind,
      motivo: HOMO_DEBIT_NOTE_REASON,
      invoiceType: invoice.invoiceType,
      voucherType: request.voucherType,
      amount: pesos(HOMO_DEBIT_NOTE_AMOUNT_CENTS),
      net: pesos(split.netCents),
      iva: pesos(split.ivaCents),
      moneda: request.currencyId,
      cotizacion: request.currencyRate,
      voucherNumberSimulado: SIMULATED_NOTE_VOUCHER_NUMBER,
      voucherNumberEsFiscal: false,
      reglaComercialAcepta: true,
    },
    associatedVoucher: {
      type: associated.type,
      pointOfSale: associated.pointOfSale,
      number: associated.number,
      numberEsElSequencePersistido: true,
      issuedAt: associated.issuedAt,
    },
    saldoEsperado: {
      facturaCents: invoice.totalCents,
      notaCents: HOMO_DEBIT_NOTE_AMOUNT_CENTS,
      outstandingCents,
      fiscalStatus,
      estadoComercial: commercialFiscalStatus,
      paymentStatus,
    },
    facturaContadoAnteriorRechazaDebito: true,
    idempotencyKeyFutura:
      "UUID nueva, distinta de la primera factura, de la NC y de la segunda factura.",
    billingFiscalSettings: {
      environmentPersistido: input.settingsEnvironment,
      updatedAt: input.settingsUpdatedAt,
      modificado: false,
    },
    wsaa: 0,
    wsfe: 0,
    fecaesolicitar: 0,
    fecompultimoautorizado: 0,
    fecompconsultar: 0,
    escriturasDb: 0,
    executeBloqueado: true,
  };
  const text = JSON.stringify(summary);

  if (
    (invoice.cae && text.includes(invoice.cae)) ||
    (invoice.client.identificationNumber &&
      text.includes(invoice.client.identificationNumber)) ||
    text.includes(input.issuerCuit) ||
    text.includes("BEGIN CERTIFICATE") ||
    text.includes("ARCA_PROD_")
  ) {
    throw new HomoDebitNoteAbort("El resumen iba a incluir un documento o un CAE. No se imprime.");
  }

  return summary;
}
