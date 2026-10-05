/**
 * Intención compartida del dry-run y de --execute.
 * No abre la base, no llama WSAA y no llama WSFE.
 * El número de comprobante no forma parte de esta intención: lo asigna
 * issueArcaInvoice con FECompUltimoAutorizado last + 1.
 */
import type { BillingClient } from "@/generated/prisma/client";
import { buildArcaCaeRequest } from "@/server/arca/adapters/billing-invoice-to-cae";
import { buildArcaNoteCaeRequest } from "@/server/arca/adapters/billing-note-to-cae";
import type {
  IssueArcaInvoiceInput,
  IssueArcaInvoiceResult,
} from "@/server/arca/invoices/issue-arca-invoice";
import { canonicalizeBillingPayload } from "@/server/arca/invoices/billing-payload-snapshot";
import type { FinalizeApprovedResult } from "@/server/arca/invoices/finalize-approved-arca-emission";
import { buildArcaBillingPersistenceSnapshot } from "@/server/services/billing-invoice-arca-snapshot";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import type { ArcaCodedItem } from "@/server/arca/invoices/emission-store";
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
  determineInvoiceType,
  isGenericBillingClient,
  paymentStatusForMethod,
} from "@/shared/utils/billing-invoice-rules";
import {
  isValidCuit,
  isValidDni,
  normalizeIdentificationDigits,
} from "@/shared/utils/identification";

export const HOMO_HARNESS_ENVIRONMENT = "HOMOLOGACION" as const;
export const HOMO_HARNESS_POINT_OF_SALE = 7;
export const HOMO_HARNESS_VOUCHER_TYPE = ARCA_VOUCHER_TYPE.FACTURA_A;
const SIMULATED_VOUCHER_NUMBER = 1;
const SIMULATED_NOTE_VOUCHER_NUMBER = 1;
const SIMULATED_ASSOCIATED_CAE = "SIMULADO-NO-ENVIAR";
const ITEM_DESCRIPTION = "PRUEBA HOMOLOGACION NC ND";
const NOTE_REASON = "PRUEBA HOMOLOGACION NC";
const IVA_PERCENT = 21;
const GROSS_PESOS = 1210;
const EXPECTED_NET_PESOS = 1000;
const EXPECTED_VAT_PESOS = 210;
const EXPECTED_TOTAL_PESOS = 1210;
const NOTE_TOTAL_CENTS = 12_100;
const NOTE_NET_CENTS = 10_000;
const NOTE_VAT_CENTS = 2_100;
const RESPONSABLE_INSCRIPTO_VAT_ID = 1;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HOMO_CREDENTIAL_ENV = [
  "ARCA_HOMO_CERT_B64",
  "ARCA_HOMO_PRIVATE_KEY_B64",
  "ARCA_TICKET_ENCRYPTION_KEY_B64",
] as const;

export const SAME_KEY_RETRY_MESSAGE =
  "NO GENERAR OTRA KEY. Reejecutar exactamente el mismo comando.";

export class HomoHarnessAbort extends Error {
  readonly exitCode: 1 | 2;

  constructor(message: string, exitCode: 1 | 2 = 1) {
    super(message);
    this.name = "HomoHarnessAbort";
    this.exitCode = exitCode;
  }
}

export type HomoHarnessMode = "dry-run" | "execute" | "verify";

export type HomoHarnessArgs = {
  mode: HomoHarnessMode;
  execute: boolean;
  verify: boolean;
  confirmHomologacion: boolean;
  clientId: string | null;
  idempotencyKey: string | null;
};

export type HomoHarnessClient = Pick<
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

export type HomoHarnessSettings = {
  environment: string;
  pointOfSale: string;
  issuerCuit: string | null;
  genericClientLimit: { toNumber(): number };
  updatedAt: Date;
};

export type HomoHarnessIntention = {
  environment: typeof HOMO_HARNESS_ENVIRONMENT;
  invoiceType: "A";
  voucherType: typeof HOMO_HARNESS_VOUCHER_TYPE;
  pointOfSale: number;
  clientId: string;
  clientName: string;
  identificationType: HomoHarnessClient["identificationType"];
  identificationLast4: string | null;
  ivaCondition: HomoHarnessClient["ivaCondition"];
  paymentMethod: "CONTADO";
  totals: ReturnType<typeof computeInvoiceTotals>;
  billing: ReturnType<typeof buildArcaBillingPersistenceSnapshot>;
  client: {
    identificationType: HomoHarnessClient["identificationType"];
    identificationNumber: string | null;
    ivaCondition: HomoHarnessClient["ivaCondition"];
  };
};

export type HomoHarnessExecuteReport = {
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

export function redactHarnessText(value: string): string {
  return value
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, "[redactado]")
    .replace(/\b\d{10,}\b/g, "[redactado]");
}

export function parseHomoHarnessArgs(argv: string[]): HomoHarnessArgs {
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

    if (arg.startsWith("--idempotency-key=")) {
      idempotencyKey = arg.slice("--idempotency-key=".length).trim();
      continue;
    }

    if (arg.startsWith("--client-id=")) {
      clientId = arg.slice("--client-id=".length).trim();
      continue;
    }

    if (
      /^(--)?(invoice-type|letra|voucher-type|factura)(=|$)/i.test(arg) ||
      arg === "A" ||
      arg === "B"
    ) {
      throw new HomoHarnessAbort("La letra sale del cliente. No se puede forzar A/B.");
    }

    if (
      arg.includes("ARCA_PROD_CERT_B64") ||
      arg.includes("ARCA_PROD_PRIVATE_KEY_B64") ||
      arg.includes("PRODUCCION")
    ) {
      throw new HomoHarnessAbort("El harness solo puede apuntar a HOMOLOGACION.");
    }

    throw new HomoHarnessAbort(`Argumento no reconocido: ${arg}`);
  }

  let mode: HomoHarnessMode = "dry-run";
  if (execute) {
    mode = "execute";
  } else if (verify) {
    mode = "verify";
  }

  return {
    mode,
    execute,
    verify,
    confirmHomologacion,
    clientId,
    idempotencyKey,
  };
}

export function assertHomoHarnessArgs(args: HomoHarnessArgs): void {
  if (args.execute && args.verify) {
    throw new HomoHarnessAbort("Elegí un solo modo.");
  }

  if (args.mode === "execute") {
    if (!args.confirmHomologacion) {
      throw new HomoHarnessAbort("Falta --confirm-homologacion.");
    }

    if (!args.clientId) {
      throw new HomoHarnessAbort("Falta --client-id.");
    }

    if (!args.idempotencyKey) {
      throw new HomoHarnessAbort("Falta --idempotency-key.");
    }

    if (!UUID_PATTERN.test(args.idempotencyKey)) {
      throw new HomoHarnessAbort("La idempotencyKey tiene que ser un UUID.");
    }

    return;
  }

  if (args.mode === "verify") {
    if (!args.idempotencyKey) {
      throw new HomoHarnessAbort("Falta --idempotency-key.");
    }

    if (!UUID_PATTERN.test(args.idempotencyKey)) {
      throw new HomoHarnessAbort("La idempotencyKey tiene que ser un UUID.");
    }

    return;
  }

  if (!args.clientId) {
    throw new HomoHarnessAbort("Falta --client-id.");
  }
}

export function assertHomoCredentialNamesPresent(
  env: Record<string, string | undefined>,
): void {
  for (const name of HOMO_CREDENTIAL_ENV) {
    if (!env[name]?.trim()) {
      throw new HomoHarnessAbort(`Falta ${name}.`);
    }
  }
}

export function assertExecuteGuards(intention: {
  environment: string;
  invoiceType: string;
  voucherType: number;
  pointOfSale: number;
}): void {
  if (intention.environment !== HOMO_HARNESS_ENVIRONMENT) {
    throw new HomoHarnessAbort("El environment no es HOMOLOGACION.");
  }

  if (intention.invoiceType !== "A") {
    throw new HomoHarnessAbort("La factura no es A.");
  }

  if (intention.voucherType !== HOMO_HARNESS_VOUCHER_TYPE) {
    throw new HomoHarnessAbort("El voucherType no es 1.");
  }

  if (intention.pointOfSale !== HOMO_HARNESS_POINT_OF_SALE) {
    throw new HomoHarnessAbort("El punto de venta no es 7.");
  }
}

function last4(value: string | null): string | null {
  const digits = normalizeIdentificationDigits(value ?? "");
  if (digits.length < 4) {
    return null;
  }

  return digits.slice(-4);
}

function documentIsValid(client: HomoHarnessClient): boolean {
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

export function buildHomoInvoiceIntention(input: {
  client: HomoHarnessClient;
  settings: HomoHarnessSettings;
  issuedAt: Date;
}): HomoHarnessIntention {
  const { client } = input;

  if (!client.name.trim() || !client.code.trim() || !documentIsValid(client)) {
    throw new HomoHarnessAbort("El cliente no pasa las validaciones actuales de facturación.");
  }

  if (!input.settings.issuerCuit?.trim()) {
    throw new HomoHarnessAbort("La configuración fiscal no tiene CUIT de emisor.");
  }

  const withinGenericLimit =
    !isGenericBillingClient(client) ||
    pesosToCents(GROSS_PESOS) <= pesosToCents(input.settings.genericClientLimit.toNumber());

  if (!withinGenericLimit) {
    throw new HomoHarnessAbort("El cliente no pasa las validaciones actuales de facturación.");
  }

  let profile: ReturnType<typeof resolveArcaFiscalProfile>;

  try {
    profile = resolveArcaFiscalProfile(
      client.identificationType,
      client.ivaCondition,
    );
  } catch (error) {
    if (error instanceof UnsupportedArcaVatConditionError) {
      throw new HomoHarnessAbort("El resolver fiscal falla para este cliente.");
    }

    throw error;
  }

  const resolvedType = determineInvoiceType(
    client.identificationType,
    client.ivaCondition,
  );

  if (resolvedType !== profile.voucherClass) {
    throw new HomoHarnessAbort("El resolver fiscal no coincide con la letra interna.");
  }

  if (
    client.identificationType !== "CUIT" ||
    client.ivaCondition !== "RESPONSABLE_INSCRIPTO" ||
    profile.documentType !== ARCA_DOCUMENT_TYPE.CUIT ||
    profile.receptorVatConditionId !== RESPONSABLE_INSCRIPTO_VAT_ID
  ) {
    throw new HomoHarnessAbort("El receptor fiscal no quedó como CUIT responsable inscripto.");
  }

  const pointOfSale = parseArcaPointOfSale(input.settings.pointOfSale);
  const invoiceType = resolvedType;
  const unitPriceCents = pesosToCents(GROSS_PESOS);
  const totals = computeInvoiceTotals({
    invoiceType,
    items: [{ quantity: 1, unitPriceCents }],
    ivaPercent: IVA_PERCENT,
    discountPercent: 0,
  });

  if (
    pesos(totals.netCents) !== EXPECTED_NET_PESOS.toFixed(2) ||
    pesos(totals.ivaCents) !== EXPECTED_VAT_PESOS.toFixed(2) ||
    pesos(totals.totalCents) !== EXPECTED_TOTAL_PESOS.toFixed(2)
  ) {
    throw new HomoHarnessAbort("computeInvoiceTotals no cerró 1000.00 + 210.00 = 1210.00.");
  }

  const paymentMethod = "CONTADO" as const;
  const draft = buildArcaBillingPersistenceSnapshot({
    issuedAt: input.issuedAt,
    pointOfSale,
    invoiceType,
    client: client as BillingClient,
    items: [
      {
        rubroId: "no-persistido",
        description: ITEM_DESCRIPTION,
        quantity: 1,
        unitPriceCents,
      },
    ],
    rubrosById: new Map(),
    totals,
    ivaPercent: IVA_PERCENT,
    discountPercent: 0,
    paymentMethod,
    paymentStatus: paymentStatusForMethod(paymentMethod),
    notes: null,
  });
  const billing = {
    ...draft,
    items: [
      {
        rubroId: null,
        rubroCode: "HOMO",
        rubroName: "Homologación",
        description: ITEM_DESCRIPTION,
        quantity: 1,
        unitPriceCents,
        lineTotalCents: totals.lineTotalsCents[0] ?? 0,
        sortOrder: 0,
      },
    ],
  };
  const snapshot = canonicalizeBillingPayload(billing);

  if (
    snapshot.client.id !== client.id ||
    snapshot.invoiceType !== invoiceType ||
    snapshot.items[0]?.rubroId !== null
  ) {
    throw new HomoHarnessAbort("El snapshot comercial no quedó persistible con el cliente real.");
  }

  if (invoiceType !== "A" || profile.voucherType !== HOMO_HARNESS_VOUCHER_TYPE) {
    throw new HomoHarnessAbort("Este harness exige que el cliente resuelva a Factura A tipo 1.");
  }

  const intention: HomoHarnessIntention = {
    environment: HOMO_HARNESS_ENVIRONMENT,
    invoiceType,
    voucherType: HOMO_HARNESS_VOUCHER_TYPE,
    pointOfSale,
    clientId: client.id,
    clientName: client.name,
    identificationType: client.identificationType,
    identificationLast4: last4(client.identificationNumber),
    ivaCondition: client.ivaCondition,
    paymentMethod,
    totals,
    billing,
    client: {
      identificationType: client.identificationType,
      identificationNumber: client.identificationNumber,
      ivaCondition: client.ivaCondition,
    },
  };

  assertExecuteGuards(intention);
  return intention;
}

export function toIssueArcaInvoiceInput(
  intention: HomoHarnessIntention,
  idempotencyKey: string,
  issuerCuit: string,
): IssueArcaInvoiceInput {
  assertExecuteGuards(intention);

  if (!UUID_PATTERN.test(idempotencyKey)) {
    throw new HomoHarnessAbort("La idempotencyKey tiene que ser un UUID.");
  }

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

function assertSanitized(value: unknown): void {
  const text = JSON.stringify(value);

  if (/\d{7,}/.test(text) || text.includes(SIMULATED_ASSOCIATED_CAE)) {
    throw new HomoHarnessAbort("El resumen iba a incluir un documento o un CAE. No se imprime.");
  }
}

export function describeHomoDryRun(input: {
  intention: HomoHarnessIntention;
  issuerCuit: string;
  pointOfSaleText: string;
  settingsEnvironment: string;
  settingsUpdatedAt: string;
  networkCalls: number;
}): unknown {
  const { intention } = input;
  assertExecuteGuards(intention);
  const request = buildArcaCaeRequest({
    environment: intention.environment,
    issuerCuit: input.issuerCuit,
    pointOfSale: intention.pointOfSale,
    voucherNumber: SIMULATED_VOUCHER_NUMBER,
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

  if (
    request.environment !== HOMO_HARNESS_ENVIRONMENT ||
    request.voucherType !== HOMO_HARNESS_VOUCHER_TYPE ||
    request.pointOfSale !== intention.pointOfSale ||
    request.currencyId !== ARCA_CURRENCY_ID ||
    request.currencyRate !== ARCA_CURRENCY_RATE ||
    request.netAmount !== EXPECTED_NET_PESOS ||
    request.vatAmount !== EXPECTED_VAT_PESOS ||
    request.totalAmount !== EXPECTED_TOTAL_PESOS ||
    String(request.documentNumber).slice(-4) !== intention.identificationLast4
  ) {
    throw new HomoHarnessAbort("El request fiscal de prueba no cerró.");
  }

  const noteRequest = buildArcaNoteCaeRequest({
    kind: "CREDIT",
    invoiceType: intention.invoiceType,
    amountCents: NOTE_TOTAL_CENTS,
    netAmountCents: NOTE_NET_CENTS,
    ivaAmountCents: NOTE_VAT_CENTS,
    ivaPercent: IVA_PERCENT,
    issuedAt: intention.billing.issuedAt,
    receptor: intention.client,
    associatedInvoice: {
      invoiceType: intention.invoiceType,
      pointOfSale: input.pointOfSaleText,
      sequenceNumber: SIMULATED_VOUCHER_NUMBER,
      issuedAt: intention.billing.issuedAt,
      environment: HOMO_HARNESS_ENVIRONMENT,
      fiscalStatus: "AUTORIZADA",
      cae: SIMULATED_ASSOCIATED_CAE,
    },
    environment: HOMO_HARNESS_ENVIRONMENT,
    issuerCuit: input.issuerCuit,
    voucherNumber: SIMULATED_NOTE_VOUCHER_NUMBER,
  });
  const associated = noteRequest.associatedVouchers?.[0];

  if (
    noteRequest.voucherType !== ARCA_VOUCHER_TYPE.NOTA_CREDITO_A ||
    !associated ||
    associated.type !== ARCA_VOUCHER_TYPE.FACTURA_A ||
    associated.pointOfSale !== intention.pointOfSale ||
    associated.number !== SIMULATED_VOUCHER_NUMBER
  ) {
    throw new HomoHarnessAbort("La nota de crédito A en memoria no quedó asociada.");
  }

  const summary = {
    modo: "dry-run",
    factura: {
      environment: request.environment,
      clientId: intention.clientId,
      clientName: intention.clientName,
      identificationType: intention.identificationType,
      documentoUltimos4: intention.identificationLast4,
      ivaCondition: intention.ivaCondition,
      invoiceType: intention.invoiceType,
      voucherType: request.voucherType,
      pointOfSale: request.pointOfSale,
      neto: pesos(intention.totals.netCents),
      iva: pesos(intention.totals.ivaCents),
      total: pesos(intention.totals.totalCents),
      formaDePago: intention.paymentMethod,
      commercialSnapshotValido: true,
      requestFiscalValido: true,
      voucherNumberSimulado: SIMULATED_VOUCHER_NUMBER,
      voucherNumberEsFiscal: false,
    },
    notaFutura: {
      kind: "CREDIT",
      invoiceType: intention.invoiceType,
      voucherType: noteRequest.voucherType,
      motivo: NOTE_REASON,
      importe: pesos(NOTE_TOTAL_CENTS),
      neto: pesos(NOTE_NET_CENTS),
      iva: pesos(NOTE_VAT_CENTS),
      associatedVoucher: {
        type: associated.type,
        pointOfSale: associated.pointOfSale,
        number: associated.number,
      },
      requestFiscalValido: true,
      voucherNumberSimulado: SIMULATED_NOTE_VOUCHER_NUMBER,
      voucherNumberEsFiscal: false,
    },
    numeracionReal: {
      factura:
        "issueArcaInvoice consulta FECompUltimoAutorizado del tipo 1 y usa last + 1.",
      nota:
        "issueArcaNote consulta FECompUltimoAutorizado del tipo 3 y usa last + 1.",
      preflightTipo1NoEsDefinitivo: true,
    },
    billingFiscalSettings: {
      environmentPersistido: input.settingsEnvironment,
      updatedAt: input.settingsUpdatedAt,
      modificado: false,
    },
    wsaa: 0,
    wsfe: 0,
    escriturasDb: 0,
    red: input.networkCalls,
    executeRequiereConfirmacion: true,
  };

  assertSanitized(summary);
  return summary;
}

function formatCompleted(
  invoice: FinalizeApprovedResult["invoice"],
  idempotencyKey: string,
): string {
  if (invoice.environment !== HOMO_HARNESS_ENVIRONMENT) {
    throw new HomoHarnessAbort("La factura persistida no quedó en HOMOLOGACION.");
  }

  return [
    "STATUS: COMPLETED",
    `IDEMPOTENCY KEY: ${idempotencyKey}`,
    `environment: ${invoice.environment}`,
    `invoiceId: ${invoice.id}`,
    `invoiceNumber: ${invoice.invoiceNumber}`,
    `invoiceType: ${invoice.invoiceType}`,
    `pointOfSale: ${invoice.pointOfSale}`,
    `sequenceNumber: ${invoice.sequenceNumber}`,
    `fiscalStatus: ${invoice.fiscalStatus}`,
    `CAE PRESENTE: ${invoice.cae.trim() ? "true" : "false"}`,
    `CAE EXPIRES AT: ${invoice.caeExpiresAt}`,
    `total: ${pesos(invoice.totalCents)}`,
  ].join("\n");
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
    lines.push(`${redactHarnessText(item.code)}: ${redactHarnessText(item.message)}`);
  }

  return lines.join("\n");
}

function formatFailed(idempotencyKey: string, code: string, message: string): string {
  return [
    "STATUS: FAILED_PRE_SEND",
    `IDEMPOTENCY KEY: ${idempotencyKey}`,
    `${redactHarnessText(code)}: ${redactHarnessText(message)}`,
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

export async function executeHomoHarness(
  intention: HomoHarnessIntention,
  idempotencyKey: string,
  issuerCuit: string,
  dependencies: {
    issueArcaInvoice: IssueDependency;
    finalizeApprovedArcaEmission: FinalizeDependency;
    readRejection?: (emissionId: string) => Promise<ArcaCodedItem[]>;
  },
): Promise<HomoHarnessExecuteReport> {
  const input = toIssueArcaInvoiceInput(intention, idempotencyKey, issuerCuit);

  if (input.environment !== HOMO_HARNESS_ENVIRONMENT) {
    throw new HomoHarnessAbort("El environment no es HOMOLOGACION.");
  }

  const result = await dependencies.issueArcaInvoice(input);

  switch (result.status) {
    case "approved":
    case "completed":
      try {
        const finalized = await dependencies.finalizeApprovedArcaEmission(
          result.emissionId,
        );
        const text = formatCompleted(finalized.invoice, idempotencyKey);

        const cae = finalized.invoice.cae.trim();
        if (cae.length >= 10 && text.includes(cae)) {
          throw new HomoHarnessAbort("El resumen iba a incluir el CAE. No se imprime.");
        }

        return { kind: "completed", exitCode: 0, text };
      } catch (error) {
        if (error instanceof HomoHarnessAbort) {
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

export type HomoVerifyLocal = {
  emissionStatus: string;
  emissionEnvironment: string;
  voucherType: number;
  voucherNumber: number | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceEnvironment: string | null;
  fiscalStatus: string | null;
  caePresent: boolean;
};

export type HomoVerifyArca = {
  lastAuthorizedType1: number;
  consultResult: "A" | "R" | null;
  consultCaePresent: boolean;
  consultVoucherNumber: number | null;
};

export function formatHomoVerify(local: HomoVerifyLocal, arca: HomoVerifyArca): string {
  if (local.emissionEnvironment !== HOMO_HARNESS_ENVIRONMENT) {
    throw new HomoHarnessAbort("La emisión local no es de HOMOLOGACION.");
  }

  return [
    "STATUS: VERIFY",
    `emissionStatus: ${local.emissionStatus}`,
    `environment: ${local.emissionEnvironment}`,
    `voucherType: ${local.voucherType}`,
    `voucherNumber: ${local.voucherNumber ?? ""}`,
    `invoiceId: ${local.invoiceId ?? ""}`,
    `invoiceNumber: ${local.invoiceNumber ?? ""}`,
    `invoiceEnvironment: ${local.invoiceEnvironment ?? ""}`,
    `fiscalStatus: ${local.fiscalStatus ?? ""}`,
    `CAE PRESENTE: ${local.caePresent ? "true" : "false"}`,
    `FECompUltimoAutorizado tipo 1: ${arca.lastAuthorizedType1}`,
    `FECompConsultar resultado: ${arca.consultResult ?? ""}`,
    `FECompConsultar CAE PRESENTE: ${arca.consultCaePresent ? "true" : "false"}`,
    `FECompConsultar numero: ${arca.consultVoucherNumber ?? ""}`,
  ].join("\n");
}
