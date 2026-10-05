/**
 * Intención compartida del dry-run y de --execute.
 * Escenario fijo: CUENTA_CORRIENTE, Factura A, HOMOLOGACION.
 * El número fiscal no forma parte de esta intención: lo asigna issueArcaInvoice
 * con FECompUltimoAutorizado del tipo 1, last + 1.
 * Esta fase no cablea issueArcaNote.
 */
import type { BillingClient, BillingPaymentStatus } from "@/generated/prisma/client";
import { buildArcaCaeRequest } from "@/server/arca/adapters/billing-invoice-to-cae";
import { buildArcaNoteCaeRequest } from "@/server/arca/adapters/billing-note-to-cae";
import type { ArcaCodedItem } from "@/server/arca/invoices/emission-store";
import { canonicalizeBillingPayload } from "@/server/arca/invoices/billing-payload-snapshot";
import type { FinalizeApprovedResult } from "@/server/arca/invoices/finalize-approved-arca-emission";
import type {
  IssueArcaInvoiceInput,
  IssueArcaInvoiceResult,
} from "@/server/arca/invoices/issue-arca-invoice";
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
export const SAME_KEY_RETRY_MESSAGE =
  "NO GENERAR OTRA KEY. Reejecutar exactamente el mismo comando.";

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
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOMO_CREDENTIAL_ENV = [
  "ARCA_HOMO_CERT_B64",
  "ARCA_HOMO_PRIVATE_KEY_B64",
  "ARCA_TICKET_ENCRYPTION_KEY_B64",
] as const;

export type DebitBaseMode = "dry-run" | "execute" | "verify";

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
  mode: DebitBaseMode;
  execute: boolean;
  verify: boolean;
  confirmHomologacion: boolean;
  clientId: string | null;
  idempotencyKey: string | null;
};

export type DebitBaseExecuteReport = {
  kind: "completed" | "ambiguous" | "rejected" | "failed_pre_send" | "pending";
  exitCode: 0 | 1 | 2;
  text: string;
};

type IssueDependency = (
  input: IssueArcaInvoiceInput,
) => Promise<IssueArcaInvoiceResult>;

type FinalizeDependency = (emissionId: string) => Promise<FinalizeApprovedResult>;

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

export function redactDebitBaseText(value: string): string {
  return value
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, "[redactado]")
    .replace(/\b\d{10,}\b/g, "[redactado]");
}

export function parseDebitBaseArgs(argv: string[]): DebitBaseArgs {
  let execute = false;
  let verify = false;
  let confirmHomologacion = false;
  let clientId: string | null = null;
  let idempotencyKey: string | null = null;

  for (const arg of argv) {
    if (arg === "--execute") {
      execute = true;
      continue;
    }

    if (arg === "--verify") {
      verify = true;
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

  let mode: DebitBaseMode = "dry-run";
  if (execute) {
    mode = "execute";
  } else if (verify) {
    mode = "verify";
  }

  return { mode, execute, verify, confirmHomologacion, clientId, idempotencyKey };
}

function assertUuid(idempotencyKey: string | null): void {
  if (!idempotencyKey) {
    throw new DebitBaseAbort("Falta --idempotency-key.");
  }

  if (!UUID_PATTERN.test(idempotencyKey)) {
    throw new DebitBaseAbort("La idempotencyKey tiene que ser un UUID.");
  }
}

export function assertDebitBaseArgs(args: DebitBaseArgs): void {
  if (args.execute && args.verify) {
    throw new DebitBaseAbort("Elegí un solo modo.");
  }

  if (args.mode === "execute") {
    if (!args.confirmHomologacion) {
      throw new DebitBaseAbort("Falta --confirm-homologacion.");
    }

    if (args.clientId !== DEBIT_BASE_CLIENT_ID) {
      throw new DebitBaseAbort("Esta prueba solo admite el cliente de Factura A ya validado.");
    }

    assertUuid(args.idempotencyKey);
    return;
  }

  if (args.mode === "verify") {
    assertUuid(args.idempotencyKey);
    return;
  }

  if (args.clientId !== DEBIT_BASE_CLIENT_ID) {
    throw new DebitBaseAbort("Esta prueba solo admite el cliente de Factura A ya validado.");
  }
}

export function assertDebitBaseCredentialNamesPresent(
  env: Record<string, string | undefined>,
): void {
  for (const name of HOMO_CREDENTIAL_ENV) {
    if (!env[name]?.trim()) {
      throw new DebitBaseAbort(`Falta ${name}.`);
    }
  }
}

export function assertDebitBaseExecuteGuards(intention: {
  environment: string;
  invoiceType: string;
  voucherType: number;
  pointOfSale: number;
  paymentMethod: string;
  clientId: string;
  totals: { totalCents: number };
}): void {
  if (intention.environment !== DEBIT_BASE_ENVIRONMENT) {
    throw new DebitBaseAbort("El environment no es HOMOLOGACION.");
  }

  if (intention.invoiceType !== "A") {
    throw new DebitBaseAbort("La factura no es A.");
  }

  if (intention.voucherType !== ARCA_VOUCHER_TYPE.FACTURA_A) {
    throw new DebitBaseAbort("El voucherType no es 1.");
  }

  if (intention.pointOfSale !== DEBIT_BASE_POINT_OF_SALE) {
    throw new DebitBaseAbort("El punto de venta no es 7.");
  }

  if (intention.paymentMethod !== "CUENTA_CORRIENTE") {
    throw new DebitBaseAbort("La factura no es de cuenta corriente.");
  }

  if (intention.clientId !== DEBIT_BASE_CLIENT_ID) {
    throw new DebitBaseAbort("Esta prueba solo admite el cliente de Factura A ya validado.");
  }

  if (intention.totals.totalCents !== INVOICE_TOTAL_CENTS) {
    throw new DebitBaseAbort("El total no es 1210.00.");
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

  const intention = {
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

  assertDebitBaseExecuteGuards(intention);
  return intention;
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
    executeRequiereConfirmacion: true,
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

export function toIssueArcaInvoiceInput(
  intention: DebitBaseIntention,
  idempotencyKey: string,
  issuerCuit: string,
): IssueArcaInvoiceInput {
  assertDebitBaseExecuteGuards(intention);
  assertUuid(idempotencyKey);

  return {
    idempotencyKey,
    environment: intention.environment,
    issuerCuit,
    pointOfSale: intention.pointOfSale,
    invoiceType: intention.invoiceType,
    voucherDate: intention.billing.issuedAt,
    client: intention.client,
    totals: {
      netCents: intention.totals.netCents,
      vatCents: intention.totals.ivaCents,
      totalCents: intention.totals.totalCents,
      nonTaxedCents: 0,
      exemptCents: 0,
      taxCents: 0,
    },
    ivaPercent: IVA_PERCENT,
    billing: intention.billing,
  };
}

function assertCaeHidden(text: string, cae: string): void {
  const compact = cae.trim();
  if (compact.length >= 10 && text.includes(compact)) {
    throw new DebitBaseAbort("El resumen iba a incluir el CAE. No se imprime.");
  }
}

function formatCompleted(
  invoice: FinalizeApprovedResult["invoice"],
  idempotencyKey: string,
): string {
  const outstandingCents = invoiceOutstandingCents(
    invoice.totalVisualRoundedCents,
    0,
    0,
    0,
  );
  const pointOfSale = parseArcaPointOfSale(invoice.pointOfSale);

  if (
    invoice.environment !== DEBIT_BASE_ENVIRONMENT ||
    invoice.invoiceType !== "A" ||
    pointOfSale !== DEBIT_BASE_POINT_OF_SALE ||
    invoice.paymentMethod !== "CUENTA_CORRIENTE" ||
    invoice.paymentStatus !== "IMPAGA" ||
    invoice.fiscalStatus !== "AUTORIZADA" ||
    invoice.clientId !== DEBIT_BASE_CLIENT_ID ||
    invoice.totalCents !== INVOICE_TOTAL_CENTS ||
    outstandingCents !== INVOICE_TOTAL_CENTS ||
    !invoice.cae.trim()
  ) {
    throw new DebitBaseAbort("La factura persistida no es la base de cuenta corriente esperada.");
  }

  const text = [
    "STATUS: COMPLETED",
    `IDEMPOTENCY KEY: ${idempotencyKey}`,
    `environment: ${invoice.environment}`,
    `invoiceId: ${invoice.id}`,
    `invoiceNumber: ${invoice.invoiceNumber}`,
    `invoiceType: ${invoice.invoiceType}`,
    `pointOfSale: ${invoice.pointOfSale}`,
    `sequenceNumber: ${invoice.sequenceNumber}`,
    `paymentMethod: ${invoice.paymentMethod}`,
    `paymentStatus: ${invoice.paymentStatus}`,
    `fiscalStatus: ${invoice.fiscalStatus}`,
    `CAE PRESENTE: true`,
    `CAE EXPIRES AT: ${invoice.caeExpiresAt}`,
    `total: ${pesos(invoice.totalCents)}`,
    `outstanding: ${pesos(outstandingCents)}`,
  ].join("\n");

  assertCaeHidden(text, invoice.cae);
  return text;
}

function formatAmbiguous(idempotencyKey: string): string {
  return [
    "STATUS: AMBIGUOUS",
    `IDEMPOTENCY KEY: ${idempotencyKey}`,
    SAME_KEY_RETRY_MESSAGE,
  ].join("\n");
}

function formatRejected(
  idempotencyKey: string,
  details: readonly ArcaCodedItem[],
): string {
  const lines = [
    "STATUS: REJECTED",
    `IDEMPOTENCY KEY: ${idempotencyKey}`,
  ];

  if (details.length === 0) {
    lines.push("sin detalle");
  }

  for (const item of details) {
    lines.push(`${redactDebitBaseText(item.code)}: ${redactDebitBaseText(item.message)}`);
  }

  return lines.join("\n");
}

function formatFailed(idempotencyKey: string, code: string, message: string): string {
  return [
    "STATUS: FAILED_PRE_SEND",
    `IDEMPOTENCY KEY: ${idempotencyKey}`,
    `${redactDebitBaseText(code)}: ${redactDebitBaseText(message)}`,
    SAME_KEY_RETRY_MESSAGE,
  ].join("\n");
}

function formatPending(idempotencyKey: string): string {
  return [
    "STATUS: APPROVED_PENDING_PERSISTENCE",
    `IDEMPOTENCY KEY: ${idempotencyKey}`,
    SAME_KEY_RETRY_MESSAGE,
  ].join("\n");
}

export async function executeDebitBaseInvoice(
  intention: DebitBaseIntention,
  idempotencyKey: string,
  issuerCuit: string,
  dependencies: {
    issueArcaInvoice: IssueDependency;
    finalizeApprovedArcaEmission: FinalizeDependency;
    readRejection?: (emissionId: string) => Promise<ArcaCodedItem[]>;
  },
): Promise<DebitBaseExecuteReport> {
  const input = toIssueArcaInvoiceInput(intention, idempotencyKey, issuerCuit);

  if ("voucherNumber" in input) {
    throw new DebitBaseAbort("El motor asigna el número. No se envía voucherNumber.");
  }

  const result = await dependencies.issueArcaInvoice(input);

  switch (result.status) {
    case "approved":
    case "completed":
      try {
        const finalized = await dependencies.finalizeApprovedArcaEmission(
          result.emissionId,
        );
        return {
          kind: "completed",
          exitCode: 0,
          text: formatCompleted(finalized.invoice, idempotencyKey),
        };
      } catch (error) {
        if (error instanceof DebitBaseAbort) {
          throw error;
        }

        return {
          kind: "pending",
          exitCode: 2,
          text: formatPending(idempotencyKey),
        };
      }
    case "ambiguous":
      return {
        kind: "ambiguous",
        exitCode: 2,
        text: formatAmbiguous(idempotencyKey),
      };
    case "rejected": {
      const details = dependencies.readRejection
        ? await dependencies.readRejection(result.emissionId)
        : [];
      return {
        kind: "rejected",
        exitCode: 1,
        text: formatRejected(idempotencyKey, details),
      };
    }
    case "failed_pre_send":
      return {
        kind: "failed_pre_send",
        exitCode: 1,
        text: formatFailed(idempotencyKey, result.code, result.message),
      };
    default: {
      const unexpected: never = result;
      return unexpected;
    }
  }
}

export type DebitBaseVerifyView = {
  emissionStatus: string;
  environment: string;
  voucherType: number;
  voucherNumber: number;
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: string;
  pointOfSale: string;
  sequenceNumber: number;
  paymentMethod: string;
  paymentStatus: string;
  fiscalStatus: string;
  caePresent: boolean;
  outstandingCents: number;
  lastAuthorizedType1: number;
  consultResult: "A" | "R";
  consultCaePresent: boolean;
  consultVoucherNumber: number;
  settingsEnvironment: string;
  isolationConfirmed: boolean;
};

export function assertDebitBaseVerifyView(view: DebitBaseVerifyView): void {
  if (view.settingsEnvironment !== "PRODUCCION") {
    throw new DebitBaseAbort("BillingFiscalSettings no está en PRODUCCION.");
  }

  if (view.emissionStatus !== "COMPLETED" || view.environment !== DEBIT_BASE_ENVIRONMENT) {
    throw new DebitBaseAbort("La emisión no es una Factura A de HOMOLOGACION completada.");
  }

  if (view.voucherType !== ARCA_VOUCHER_TYPE.FACTURA_A) {
    throw new DebitBaseAbort("El voucherType no es 1.");
  }

  if (!Number.isSafeInteger(view.voucherNumber) || view.voucherNumber <= 0) {
    throw new DebitBaseAbort("La emisión no tiene número de comprobante.");
  }

  if (!view.invoiceId) {
    throw new DebitBaseAbort("La emisión no tiene factura.");
  }

  if (
    view.fiscalStatus !== "AUTORIZADA" ||
    view.paymentMethod !== "CUENTA_CORRIENTE" ||
    view.paymentStatus !== "IMPAGA" ||
    view.invoiceType !== "A" ||
    parseArcaPointOfSale(view.pointOfSale) !== DEBIT_BASE_POINT_OF_SALE ||
    !view.caePresent ||
    view.outstandingCents !== INVOICE_TOTAL_CENTS
  ) {
    throw new DebitBaseAbort("La factura local no quedó autorizada, impaga y con saldo 1210.00.");
  }

  if (
    view.consultVoucherNumber !== view.voucherNumber ||
    !view.isolationConfirmed
  ) {
    throw new DebitBaseAbort("La consulta de homologación no cerró contra el comprobante persistido.");
  }
}

export function assertDebitBaseProductionIsolation(input: {
  activeEnvironment: string;
  invoiceId: string;
  invoiceNumber: string;
  activeInvoiceIds: readonly string[];
  dashboardInvoiceIds: readonly string[];
  debtorSourceInvoiceIds: readonly string[];
  movementInvoiceIds: readonly string[];
  libroNumbers: readonly string[];
}): void {
  if (input.activeEnvironment !== "PRODUCCION") {
    throw new DebitBaseAbort("BillingFiscalSettings no está en PRODUCCION.");
  }

  const present =
    input.activeInvoiceIds.includes(input.invoiceId) ||
    input.dashboardInvoiceIds.includes(input.invoiceId) ||
    input.debtorSourceInvoiceIds.includes(input.invoiceId) ||
    input.movementInvoiceIds.includes(input.invoiceId) ||
    input.libroNumbers.includes(input.invoiceNumber);

  if (present) {
    throw new DebitBaseAbort("La factura de homologación aparece en el alcance productivo.");
  }
}

export function formatDebitBaseVerify(view: DebitBaseVerifyView, cae = ""): string {
  assertDebitBaseVerifyView(view);

  const text = [
    "STATUS: VERIFY",
    `emissionStatus: ${view.emissionStatus}`,
    `environment: ${view.environment}`,
    `voucherType: ${view.voucherType}`,
    `voucherNumber: ${view.voucherNumber}`,
    `invoiceId: ${view.invoiceId}`,
    `invoiceNumber: ${view.invoiceNumber}`,
    `invoiceType: ${view.invoiceType}`,
    `pointOfSale: ${view.pointOfSale}`,
    `sequenceNumber: ${view.sequenceNumber}`,
    `paymentMethod: ${view.paymentMethod}`,
    `paymentStatus: ${view.paymentStatus}`,
    `fiscalStatus: ${view.fiscalStatus}`,
    `CAE PRESENTE: ${view.caePresent ? "true" : "false"}`,
    `outstandingCents: ${view.outstandingCents}`,
    `FECompUltimoAutorizado tipo 1: ${view.lastAuthorizedType1}`,
    `FECompConsultar resultado: ${view.consultResult}`,
    `FECompConsultar CAE PRESENTE: ${view.consultCaePresent ? "true" : "false"}`,
    `FECompConsultar numero: ${view.consultVoucherNumber}`,
    `settings: ${view.settingsEnvironment}`,
    "factura homo en facturas activas: no",
    "factura homo en dashboard: no",
    "factura homo en deudores: no",
    "factura homo en movimientos: no",
    "factura homo en libro IVA produccion: no",
  ].join("\n");

  assertCaeHidden(text, cae);
  if (text.includes("ARCA_PROD_")) {
    throw new DebitBaseAbort("El resumen iba a incluir una credencial de producción.");
  }

  return text;
}
