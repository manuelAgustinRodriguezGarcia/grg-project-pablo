/**
 * Dry-run de la Factura A de homologación que servirá de base a una Nota de Débito.
 * El escenario es fijo: CUENTA_CORRIENTE, Factura A, HOMOLOGACION.
 * --execute queda bloqueado. No abre WSAA ni WSFE.
 * El número fiscal no se asume: en vivo lo asigna issueArcaInvoice con last + 1.
 */
import type { BillingClient, BillingPaymentStatus } from "@/generated/prisma/client";
import { buildArcaCaeRequest } from "@/server/arca/adapters/billing-invoice-to-cae";
import { buildArcaNoteCaeRequest } from "@/server/arca/adapters/billing-note-to-cae";
import { canonicalizeBillingPayload } from "@/server/arca/invoices/billing-payload-snapshot";
import { assertCommercialLimits } from "@/server/arca/notes/issue-arca-note";
import type { ArcaNoteEmissionSource } from "@/server/arca/notes/note-emission-source";
import { buildArcaBillingPersistenceSnapshot } from "@/server/services/billing-invoice-arca-snapshot";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import { BillingInvoiceError } from "@/server/services/billing-invoice.errors";
import {
  ARCA_CURRENCY_ID,
  ARCA_CURRENCY_RATE,
  ARCA_DOCUMENT_TYPE,
  ARCA_VOUCHER_TYPE,
  UnsupportedArcaVatConditionError,
  resolveArcaFiscalProfile,
} from "@/shared/fiscal/arca-fiscal-mapping";
import {
  computeInvoiceTotals,
  pesosToCents,
} from "@/shared/utils/billing-invoice-totals";
import {
  canInvoiceUseOnAccountPayment,
  determineInvoiceType,
  isGenericBillingClient,
  paymentStatusForMethod,
} from "@/shared/utils/billing-invoice-rules";
import { invoiceOutstandingCents, splitGrossIvaCents } from "@/features/billing/utils/invoice-settlement";
import {
  isValidCuit,
  isValidDni,
  normalizeIdentificationDigits,
} from "@/shared/utils/identification";

export const DEBIT_BASE_CLIENT_ID = "cmurf5jgy00038cf0f4r2m3ov";
export const DEBIT_BASE_ENVIRONMENT = "HOMOLOGACION" as const;
export const DEBIT_BASE_POINT_OF_SALE = 7;
export const DEBIT_BASE_DESCRIPTION = "PRUEBA HOMOLOGACION NOTA DE DEBITO";
export const DEBIT_BASE_REASON = "PRUEBA HOMOLOGACION ND";
export const DEBIT_BASE_EXECUTE_BLOCKED =
  "FASE 6G deja --execute bloqueado. El dry-run prepara la factura base de la ND, pero esta fase no emite.";

const PREVIOUS_CASH_SEQUENCE: number = 1;
const SIMULATED_INVOICE_SEQUENCE: number = 900_001;
const SIMULATED_NOTE_SEQUENCE: number = 900_002;
const SIMULATED_CAE = "SIMULADO-NO-ENVIAR";
const IVA_PERCENT = 21;
const GROSS_PESOS = 1210;
const INVOICE_TOTAL_CENTS = 121_000;
const DEBIT_TOTAL_CENTS = 6_050;
const DEBIT_NET_CENTS = 5_000;
const DEBIT_VAT_CENTS = 1_050;
const EXPECTED_COLLECTABLE_CENTS = 127_050;
const RESPONSABLE_INSCRIPTO_VAT_ID = 1;

export class DebitBaseAbort extends Error {
  readonly exitCode: 1 | 2;

  constructor(message: string, exitCode: 1 | 2 = 1) {
    super(message);
    this.name = "DebitBaseAbort";
    this.exitCode = exitCode;
  }
}

export type DebitBaseClient = Pick<
  BillingClient,
  | "id"
  | "code"
  | "name"
  | "address"
  | "city"
  | "province"
  | "email"
  | "whatsapp"
  | "identificationType"
  | "identificationNumber"
  | "ivaCondition"
>;

export type DebitBaseSettings = {
  pointOfSale: string;
  issuerCuit: string | null;
  genericClientLimit: { toNumber(): number };
};

export type DebitBaseArgs = {
  execute: boolean;
  confirmHomologacion: boolean;
  clientId: string | null;
  idempotencyKey: string | null;
};

function pesos(cents: number): string {
  return (cents / 100).toFixed(2);
}

function last4(value: string | null): string | null {
  const digits = normalizeIdentificationDigits(value ?? "");
  if (digits.length < 4) {
    return null;
  }

  return digits.slice(-4);
}

function documentIsValid(client: DebitBaseClient): boolean {
  switch (client.identificationType) {
    case "NINGUNO":
      return true;
    case "CUIT":
      return isValidCuit(client.identificationNumber ?? "");
    case "DNI":
      return isValidDni(client.identificationNumber ?? "");
    default: {
      const unexpected: never = client.identificationType;
      return unexpected;
    }
  }
}

export function parseDebitBaseArgs(argv: string[]): DebitBaseArgs {
  let execute = false;
  let confirmHomologacion = false;
  let clientId: string | null = null;
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

    if (arg.startsWith("--client-id=")) {
      clientId = arg.slice("--client-id=".length).trim();
      continue;
    }

    if (arg.startsWith("--idempotency-key=")) {
      idempotencyKey = arg.slice("--idempotency-key=".length).trim();
      continue;
    }

    if (
      arg.toUpperCase().includes("PRODUCCION") ||
      arg.includes("ARCA_PROD_") ||
      arg.includes("ARCA_RUN_")
    ) {
      throw new DebitBaseAbort("Este harness no acepta PRODUCCION ni corridas live.");
    }

    throw new DebitBaseAbort(`Argumento no reconocido: ${arg}`);
  }

  return { execute, confirmHomologacion, clientId, idempotencyKey };
}

export function assertDebitBaseArgs(args: DebitBaseArgs): void {
  if (args.execute) {
    throw new DebitBaseAbort(DEBIT_BASE_EXECUTE_BLOCKED, 2);
  }

  if (args.clientId !== DEBIT_BASE_CLIENT_ID) {
    throw new DebitBaseAbort("Esta prueba solo admite el cliente de Factura A ya validado.");
  }
}

function emissionSource(input: {
  paymentMethod: "CONTADO" | "CUENTA_CORRIENTE";
  paymentStatus: BillingPaymentStatus;
  sequenceNumber: number;
  creditCents: number;
  debitCents: number;
  allocatedCents: number;
  client: DebitBaseClient;
}): ArcaNoteEmissionSource {
  return {
    settingsEnvironment: DEBIT_BASE_ENVIRONMENT,
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
      pointOfSale: "0007",
    },
    invoice: {
      id: "factura-simulada",
      environment: DEBIT_BASE_ENVIRONMENT,
      fiscalStatus: "AUTORIZADA",
      invoiceType: "A",
      pointOfSale: "0007",
      sequenceNumber: input.sequenceNumber,
      issuedAt: new Date("2026-10-05T12:00:00.000Z"),
      cae: SIMULATED_CAE,
      ivaPercent: IVA_PERCENT,
      totalVisualRoundedCents: INVOICE_TOTAL_CENTS,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentStatus,
      client: {
        id: input.client.id,
        code: input.client.code,
        name: input.client.name,
        identificationType: input.client.identificationType,
        identificationNumber: input.client.identificationNumber,
        ivaCondition: input.client.ivaCondition,
      },
    },
    authorizedCreditCents: input.creditCents,
    authorizedDebitCents: input.debitCents,
    allocatedCents: input.allocatedCents,
  };
}

export function assertDebitBaseAcceptsNote(client: DebitBaseClient): void {
  assertCommercialLimits(
    emissionSource({
      paymentMethod: "CUENTA_CORRIENTE",
      paymentStatus: "IMPAGA",
      sequenceNumber: SIMULATED_INVOICE_SEQUENCE,
      creditCents: 0,
      debitCents: 0,
      allocatedCents: 0,
      client,
    }),
    "DEBIT",
    DEBIT_TOTAL_CENTS,
  );
}

export function assertCashInvoiceRejectsDebit(
  client: DebitBaseClient,
  paymentStatus: BillingPaymentStatus,
): void {
  try {
    assertCommercialLimits(
      emissionSource({
        paymentMethod: "CONTADO",
        paymentStatus,
        sequenceNumber: PREVIOUS_CASH_SEQUENCE,
        creditCents: 0,
        debitCents: 0,
        allocatedCents: 0,
        client,
      }),
      "DEBIT",
      DEBIT_TOTAL_CENTS,
    );
  } catch (error) {
    if (error instanceof BillingInvoiceError) {
      return;
    }

    throw error;
  }

  throw new DebitBaseAbort("La factura de contado aceptaría una nota de débito.");
}

export function buildDebitBaseIntention(input: {
  client: DebitBaseClient;
  settings: DebitBaseSettings;
  issuedAt: Date;
}) {
  const { client } = input;

  if (client.id !== DEBIT_BASE_CLIENT_ID) {
    throw new DebitBaseAbort("Esta prueba solo admite el cliente de Factura A ya validado.");
  }

  if (!client.name.trim() || !client.code.trim() || !documentIsValid(client)) {
    throw new DebitBaseAbort("El cliente no pasa las validaciones actuales de facturación.");
  }

  if (!canInvoiceUseOnAccountPayment(client.identificationType)) {
    throw new DebitBaseAbort("El cliente no puede facturar en cuenta corriente.");
  }

  if (!input.settings.issuerCuit?.trim()) {
    throw new DebitBaseAbort("La configuración fiscal no tiene CUIT de emisor.");
  }

  const withinGenericLimit =
    !isGenericBillingClient(client) ||
    pesosToCents(GROSS_PESOS) <= pesosToCents(input.settings.genericClientLimit.toNumber());

  if (!withinGenericLimit) {
    throw new DebitBaseAbort("El cliente no pasa las validaciones actuales de facturación.");
  }

  let profile: ReturnType<typeof resolveArcaFiscalProfile>;

  try {
    profile = resolveArcaFiscalProfile(client.identificationType, client.ivaCondition);
  } catch (error) {
    if (error instanceof UnsupportedArcaVatConditionError) {
      throw new DebitBaseAbort("El resolver fiscal falla para este cliente.");
    }

    throw error;
  }

  const invoiceType = determineInvoiceType(client.identificationType, client.ivaCondition);

  if (
    invoiceType !== "A" ||
    profile.voucherClass !== "A" ||
    profile.voucherType !== ARCA_VOUCHER_TYPE.FACTURA_A ||
    client.identificationType !== "CUIT" ||
    client.ivaCondition !== "RESPONSABLE_INSCRIPTO" ||
    profile.documentType !== ARCA_DOCUMENT_TYPE.CUIT ||
    profile.receptorVatConditionId !== RESPONSABLE_INSCRIPTO_VAT_ID
  ) {
    throw new DebitBaseAbort("Este harness exige que el cliente resuelva a Factura A tipo 1.");
  }

  const pointOfSale = parseArcaPointOfSale(input.settings.pointOfSale);

  if (pointOfSale !== DEBIT_BASE_POINT_OF_SALE) {
    throw new DebitBaseAbort("El punto de venta no es 7.");
  }

  const unitPriceCents = pesosToCents(GROSS_PESOS);
  const totals = computeInvoiceTotals({
    invoiceType,
    items: [{ quantity: 1, unitPriceCents }],
    ivaPercent: IVA_PERCENT,
    discountPercent: 0,
  });
  const paymentMethod = "CUENTA_CORRIENTE" as const;
  const paymentStatus = paymentStatusForMethod(paymentMethod);

  if (paymentStatus !== "IMPAGA") {
    throw new DebitBaseAbort("La cuenta corriente no quedó impaga.");
  }

  if (
    totals.netCents !== 100_000 ||
    totals.ivaCents !== 21_000 ||
    totals.totalCents !== INVOICE_TOTAL_CENTS
  ) {
    throw new DebitBaseAbort("computeInvoiceTotals no cerró 1000.00 + 210.00 = 1210.00.");
  }

  const draft = buildArcaBillingPersistenceSnapshot({
    issuedAt: input.issuedAt,
    pointOfSale,
    invoiceType,
    client: client as BillingClient,
    items: [
      {
        rubroId: "no-persistido",
        description: DEBIT_BASE_DESCRIPTION,
        quantity: 1,
        unitPriceCents,
      },
    ],
    rubrosById: new Map(),
    totals,
    ivaPercent: IVA_PERCENT,
    discountPercent: 0,
    paymentMethod,
    paymentStatus,
    notes: null,
  });
  const billing = {
    ...draft,
    items: [
      {
        rubroId: null,
        rubroCode: "HOMO",
        rubroName: "Homologación",
        description: DEBIT_BASE_DESCRIPTION,
        quantity: 1,
        unitPriceCents,
        lineTotalCents: totals.lineTotalsCents[0] ?? 0,
        sortOrder: 0,
      },
    ],
  };
  const snapshot = canonicalizeBillingPayload(billing);

  if (snapshot.client.id !== client.id || snapshot.items[0]?.rubroId !== null) {
    throw new DebitBaseAbort("El snapshot comercial no quedó persistible con el cliente real.");
  }

  const split = splitGrossIvaCents(DEBIT_TOTAL_CENTS, IVA_PERCENT);

  if (split.netCents !== DEBIT_NET_CENTS || split.ivaCents !== DEBIT_VAT_CENTS) {
    throw new DebitBaseAbort("El importe de la nota de débito no cierra en 50.00 + 10.50.");
  }

  assertDebitBaseAcceptsNote(client);

  const collectableCents = invoiceOutstandingCents(
    INVOICE_TOTAL_CENTS,
    0,
    DEBIT_TOTAL_CENTS,
    0,
  );

  if (collectableCents !== EXPECTED_COLLECTABLE_CENTS) {
    throw new DebitBaseAbort("El saldo cobrable no cierra en 1270.50.");
  }

  if (
    SIMULATED_INVOICE_SEQUENCE === PREVIOUS_CASH_SEQUENCE ||
    SIMULATED_NOTE_SEQUENCE === PREVIOUS_CASH_SEQUENCE ||
    SIMULATED_INVOICE_SEQUENCE === SIMULATED_NOTE_SEQUENCE
  ) {
    throw new DebitBaseAbort("El número simulado coincide con la factura anterior.");
  }

  return {
    environment: DEBIT_BASE_ENVIRONMENT,
    invoiceType,
    voucherType: profile.voucherType,
    pointOfSale,
    clientId: client.id,
    clientName: client.name,
    identificationLast4: last4(client.identificationNumber),
    paymentMethod,
    paymentStatus,
    totals,
    billing,
    client: {
      identificationType: client.identificationType,
      identificationNumber: client.identificationNumber,
      ivaCondition: client.ivaCondition,
    },
    debit: {
      kind: "DEBIT" as const,
      amountCents: DEBIT_TOTAL_CENTS,
      netCents: split.netCents,
      ivaCents: split.ivaCents,
    },
    collectableCents,
    issuedAt: input.issuedAt,
  };
}

export type DebitBaseIntention = ReturnType<typeof buildDebitBaseIntention>;

export function describeDebitBaseDryRun(input: {
  intention: DebitBaseIntention;
  issuerCuit: string;
  pointOfSaleText: string;
  settingsEnvironment: string;
  settingsUpdatedAt: string;
  previousCashRejected: boolean;
}): unknown {
  const { intention } = input;
  const request = buildArcaCaeRequest({
    environment: intention.environment,
    issuerCuit: input.issuerCuit,
    pointOfSale: intention.pointOfSale,
    voucherNumber: SIMULATED_INVOICE_SEQUENCE,
    voucherDate: intention.billing.issuedAt,
    client: intention.client,
    invoiceType: intention.invoiceType,
    totals: {
      netCents: intention.totals.netCents,
      vatCents: intention.totals.ivaCents,
      totalCents: intention.totals.totalCents,
      nonTaxedCents: 0,
      exemptCents: 0,
      taxCents: 0,
      totalVisualRoundedCents: intention.totals.totalVisualRoundedCents,
    },
    ivaPercent: IVA_PERCENT,
  });
  const noteRequest = buildArcaNoteCaeRequest({
    kind: "DEBIT",
    invoiceType: intention.invoiceType,
    amountCents: intention.debit.amountCents,
    netAmountCents: intention.debit.netCents,
    ivaAmountCents: intention.debit.ivaCents,
    ivaPercent: IVA_PERCENT,
    issuedAt: intention.issuedAt,
    receptor: intention.client,
    associatedInvoice: {
      invoiceType: "A",
      pointOfSale: input.pointOfSaleText,
      sequenceNumber: SIMULATED_INVOICE_SEQUENCE,
      issuedAt: intention.issuedAt,
      environment: DEBIT_BASE_ENVIRONMENT,
      fiscalStatus: "AUTORIZADA",
      cae: SIMULATED_CAE,
    },
    environment: DEBIT_BASE_ENVIRONMENT,
    issuerCuit: input.issuerCuit,
    voucherNumber: SIMULATED_NOTE_SEQUENCE,
  });
  const associated = noteRequest.associatedVouchers?.[0];

  if (
    request.environment !== DEBIT_BASE_ENVIRONMENT ||
    request.voucherType !== ARCA_VOUCHER_TYPE.FACTURA_A ||
    request.pointOfSale !== DEBIT_BASE_POINT_OF_SALE ||
    request.currencyId !== ARCA_CURRENCY_ID ||
    request.currencyRate !== ARCA_CURRENCY_RATE ||
    request.netAmount !== 1000 ||
    request.vatAmount !== 210 ||
    request.totalAmount !== 1210 ||
    request.voucherFrom !== SIMULATED_INVOICE_SEQUENCE ||
    request.voucherTo !== SIMULATED_INVOICE_SEQUENCE ||
    noteRequest.voucherFrom !== SIMULATED_NOTE_SEQUENCE ||
    noteRequest.voucherTo !== SIMULATED_NOTE_SEQUENCE ||
    noteRequest.voucherType !== ARCA_VOUCHER_TYPE.NOTA_DEBITO_A ||
    !associated ||
    associated.type !== ARCA_VOUCHER_TYPE.FACTURA_A ||
    associated.pointOfSale !== DEBIT_BASE_POINT_OF_SALE ||
    associated.number !== SIMULATED_INVOICE_SEQUENCE ||
    !input.previousCashRejected
  ) {
    throw new DebitBaseAbort("El request de la factura base para la ND no cerró.");
  }

  const summary = {
    escenario: "FACTURA BASE PARA ND",
    modo: "dry-run",
    factura: {
      environment: request.environment,
      clientId: intention.clientId,
      invoiceType: intention.invoiceType,
      voucherType: request.voucherType,
      pointOfSale: request.pointOfSale,
      paymentMethod: intention.paymentMethod,
      paymentStatus: intention.paymentStatus,
      detalle: DEBIT_BASE_DESCRIPTION,
      neto: pesos(intention.totals.netCents),
      iva: pesos(intention.totals.ivaCents),
      total: pesos(intention.totals.totalCents),
      rubroPersistido: null,
      rubroSnapshot: "HOMO / Homologación",
      commercialSnapshotValido: true,
      requestFiscalValido: true,
      clientIdSatisfaceFk: true,
      voucherNumberSimulado: SIMULATED_INVOICE_SEQUENCE,
      voucherNumberEsFiscal: false,
      numeroDistintoDeLaFacturaAnterior: true,
    },
    notaDebitoFutura: {
      kind: intention.debit.kind,
      motivo: DEBIT_BASE_REASON,
      voucherType: noteRequest.voucherType,
      importe: pesos(intention.debit.amountCents),
      neto: pesos(intention.debit.netCents),
      iva: pesos(intention.debit.ivaCents),
      reglaComercialAcepta: true,
      associatedVoucher: {
        type: associated.type,
        pointOfSale: associated.pointOfSale,
        number: associated.number,
        numberEsElSimuladoDeLaFactura: true,
      },
      requestFiscalValido: true,
      voucherNumberSimulado: SIMULATED_NOTE_SEQUENCE,
      voucherNumberEsFiscal: false,
    },
    saldoEsperado: {
      factura: pesos(INVOICE_TOTAL_CENTS),
      notaDebito: pesos(DEBIT_TOTAL_CENTS),
      cobrable: pesos(intention.collectableCents),
    },
    facturaContadoAnteriorRechazaDebito: true,
    numeracionReal:
      "issueArcaInvoice consulta FECompUltimoAutorizado del tipo 1 y usa last + 1. Este dry-run no asume el número.",
    idempotencyKeyFutura:
      "UUID nueva, distinta de la primera factura, de la NC y de la futura ND.",
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
    text.includes(input.issuerCuit) ||
    text.includes(SIMULATED_CAE) ||
    text.includes("BEGIN CERTIFICATE") ||
    text.includes("ARCA_PROD_")
  ) {
    throw new DebitBaseAbort("El resumen iba a incluir un documento o un secreto. No se imprime.");
  }

  return summary;
}
