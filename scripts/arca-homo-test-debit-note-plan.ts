/**
 * Dry-run, ejecución y verificación de UNA Nota de Débito A de homologación.
 * La factura asociada es la segunda Factura A de cuenta corriente.
 * El número fiscal lo asigna issueArcaNote con FECompUltimoAutorizado last + 1.
 * El dry-run usa un número ficticio que no viaja en execute.
 * La UUID de la nota es nueva y se reutiliza en cada retry.
 * El loader del harness fija HOMOLOGACION sin escribir BillingFiscalSettings.
 * issueBillingNoteAction sigue con el loader de BillingFiscalSettings.
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
import {
  assertCommercialLimits,
  type IssueArcaNoteDependencies,
  type IssueArcaNoteResult,
} from "@/server/arca/notes/issue-arca-note";
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
export const HOMO_DEBIT_NOTE_INVOICE_NUMBER = "0007-00000002";
export const HOMO_DEBIT_NOTE_SEQUENCE = 2;
export const HOMO_DEBIT_NOTE_CASH_INVOICE_NUMBER = "0007-00000001";
export const HOMO_DEBIT_NOTE_CASH_INVOICE_ID = "cmuuoyff20002jsf0a7baej66";
export const HOMO_DEBIT_NOTE_REASON = "PRUEBA HOMOLOGACION ND";
export const HOMO_DEBIT_NOTE_AMOUNT_CENTS = 6_050;
export const SAME_KEY_RETRY_MESSAGE =
  "NO GENERAR OTRA KEY. Reejecutar exactamente el mismo comando.";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOMO_CREDENTIAL_ENV = [
  "ARCA_HOMO_CERT_B64",
  "ARCA_HOMO_PRIVATE_KEY_B64",
  "ARCA_TICKET_ENCRYPTION_KEY_B64",
] as const;

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

export type HomoDebitNoteMode = "dry-run" | "execute" | "verify";

export type HomoDebitNoteArgs = {
  mode: HomoDebitNoteMode;
  execute: boolean;
  verify: boolean;
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

export function redactDebitNoteText(value: string): string {
  return value
    .replace(/-----BEGIN[\s\S]*?-----END [^-]+-----/g, "[redactado]")
    .replace(/\b\d{10,}\b/g, "[redactado]");
}

export function parseHomoDebitNoteArgs(argv: string[]): HomoDebitNoteArgs {
  let execute = false;
  let verify = false;
  let confirmHomologacion = false;
  let invoiceId: string | null = null;
  let idempotencyKey: string | null = null;
  let createdByUserId: string | null = null;

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

  let mode: HomoDebitNoteMode = "dry-run";
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
    invoiceId,
    idempotencyKey,
    createdByUserId,
  };
}

function assertUuid(value: string | null, missing: string): string {
  if (!value) {
    throw new HomoDebitNoteAbort(missing);
  }

  if (!UUID_PATTERN.test(value)) {
    throw new HomoDebitNoteAbort("La idempotencyKey tiene que ser un UUID.");
  }

  return value;
}

export function assertHomoDebitNoteArgs(args: HomoDebitNoteArgs): void {
  if (args.execute && args.verify) {
    throw new HomoDebitNoteAbort("Elegí un solo modo.");
  }

  if (args.mode === "verify") {
    assertUuid(args.idempotencyKey, "Falta --idempotency-key.");
    return;
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

  if (args.mode !== "execute") {
    return;
  }

  if (!args.confirmHomologacion) {
    throw new HomoDebitNoteAbort("Falta --confirm-homologacion.");
  }

  assertUuid(args.idempotencyKey, "Falta --idempotency-key.");

  if (!args.createdByUserId) {
    throw new HomoDebitNoteAbort("Falta --created-by-user-id.");
  }

  if (!UUID_PATTERN.test(args.createdByUserId)) {
    throw new HomoDebitNoteAbort("El usuario indicado no es un UUID.");
  }
}

export function assertHomoDebitCredentialNamesPresent(
  env: Record<string, string | undefined>,
): void {
  for (const name of HOMO_CREDENTIAL_ENV) {
    if (!env[name]?.trim()) {
      throw new HomoDebitNoteAbort(`Falta ${name}.`);
    }
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

  if (invoice.invoiceNumber !== HOMO_DEBIT_NOTE_INVOICE_NUMBER) {
    throw new HomoDebitNoteAbort("La factura no es 0007-00000002.");
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

  if (invoice.sequenceNumber !== HOMO_DEBIT_NOTE_SEQUENCE) {
    throw new HomoDebitNoteAbort("Esta prueba exige el sequenceNumber 2 de la factura base.");
  }

  if (invoice.paymentMethod !== "CUENTA_CORRIENTE") {
    throw new HomoDebitNoteAbort("La factura no es de cuenta corriente.");
  }

  if (invoice.paymentStatus !== "IMPAGA") {
    throw new HomoDebitNoteAbort("El estado de pago no admite una nota de débito.");
  }

  if (invoice.outstandingCents <= 0 || invoice.outstandingCents !== INVOICE_TOTAL_CENTS) {
    throw new HomoDebitNoteAbort("La factura no tiene saldo pendiente de 1210.00.");
  }

  if (invoice.totalCents !== INVOICE_TOTAL_CENTS || invoice.ivaPercent !== IVA_PERCENT) {
    throw new HomoDebitNoteAbort("La factura no cierra en 1210.00 con IVA del 21%.");
  }

  return invoice;
}

export function assertDebitNoteAssociatedRequest(
  invoice: HomoDebitNoteInvoice,
  issuerCuit: string,
) {
  const checked = assertHomoDebitNoteInvoice(invoice);

  try {
    assertCommercialLimits(
      emissionSource(checked),
      HOMO_DEBIT_NOTE_INPUT.kind,
      HOMO_DEBIT_NOTE_INPUT.amountCents,
    );
  } catch (error) {
    if (error instanceof BillingInvoiceError) {
      throw new HomoDebitNoteAbort(error.message);
    }

    throw error;
  }

  const split = splitGrossIvaCents(HOMO_DEBIT_NOTE_AMOUNT_CENTS, IVA_PERCENT);

  if (split.netCents !== NOTE_NET_CENTS || split.ivaCents !== NOTE_VAT_CENTS) {
    throw new HomoDebitNoteAbort("El importe de la nota no cierra en 50.00 + 10.50.");
  }

  const request = buildArcaNoteCaeRequest({
    kind: HOMO_DEBIT_NOTE_INPUT.kind,
    invoiceType: checked.invoiceType,
    amountCents: HOMO_DEBIT_NOTE_AMOUNT_CENTS,
    netAmountCents: split.netCents,
    ivaAmountCents: split.ivaCents,
    ivaPercent: IVA_PERCENT,
    issuedAt: checked.issuedAt,
    receptor: {
      identificationType: checked.client.identificationType,
      identificationNumber: checked.client.identificationNumber,
      ivaCondition: checked.client.ivaCondition,
    },
    associatedInvoice: {
      invoiceType: checked.invoiceType,
      pointOfSale: checked.pointOfSale,
      sequenceNumber: checked.sequenceNumber,
      issuedAt: checked.issuedAt,
      environment: checked.environment,
      fiscalStatus: checked.fiscalStatus,
      cae: checked.cae,
    },
    environment: checked.environment,
    issuerCuit,
    voucherNumber: SIMULATED_NOTE_VOUCHER_NUMBER,
  });
  const associated = request.associatedVouchers?.[0];

  if (
    request.environment !== HOMO_DEBIT_NOTE_ENVIRONMENT ||
    request.voucherType !== ARCA_VOUCHER_TYPE.NOTA_DEBITO_A ||
    request.currencyId !== ARCA_CURRENCY_ID ||
    request.currencyRate !== ARCA_CURRENCY_RATE ||
    request.totalAmount !== 60.5 ||
    request.netAmount !== 50 ||
    request.vatAmount !== 10.5 ||
    request.voucherFrom !== SIMULATED_NOTE_VOUCHER_NUMBER ||
    request.voucherTo !== SIMULATED_NOTE_VOUCHER_NUMBER ||
    request.voucherFrom === checked.sequenceNumber ||
    !associated ||
    request.associatedVouchers?.length !== 1 ||
    associated.type !== ARCA_VOUCHER_TYPE.FACTURA_A ||
    associated.pointOfSale !== HOMO_DEBIT_NOTE_POINT_OF_SALE ||
    associated.number !== checked.sequenceNumber ||
    associated.number !== HOMO_DEBIT_NOTE_SEQUENCE
  ) {
    throw new HomoDebitNoteAbort("El request de la nota de débito A no cerró.");
  }

  return { request, associated, split };
}

export function describeHomoDebitNoteDryRun(input: {
  invoice: HomoDebitNoteInvoice | null;
  issuerCuit: string;
  settingsEnvironment: string;
  settingsUpdatedAt: string;
  cashRejected: boolean;
}): unknown {
  const invoice = assertHomoDebitNoteInvoice(input.invoice);
  const { request, associated, split } = assertDebitNoteAssociatedRequest(
    invoice,
    input.issuerCuit,
  );
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
    executeRequiereConfirmacion: true,
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

export type HomoDebitNoteExecuteReport = {
  kind: "completed" | "ambiguous" | "rejected" | "failed_pre_send";
  exitCode: 0 | 1 | 2;
  text: string;
};

function assertTextHidesSecrets(text: string, secrets: readonly string[]): void {
  for (const secret of secrets) {
    if (secret.length >= 10 && text.includes(secret)) {
      throw new HomoDebitNoteAbort("El resumen iba a incluir un documento o un CAE. No se imprime.");
    }
  }

  if (text.includes("BEGIN CERTIFICATE") || text.includes("ARCA_PROD_")) {
    throw new HomoDebitNoteAbort("El resumen iba a incluir una credencial. No se imprime.");
  }
}

function formatCompleted(input: {
  note: Extract<IssueArcaNoteResult, { status: "completed" }>;
  idempotencyKey: string;
  associatedInvoiceNumber: string;
}): string {
  const outstandingCents = input.note.outstandingCents;

  if (outstandingCents !== EXPECTED_OUTSTANDING_CENTS) {
    throw new HomoDebitNoteAbort(SAME_KEY_RETRY_MESSAGE);
  }

  const text = [
    "STATUS: COMPLETED",
    `IDEMPOTENCY KEY: ${input.idempotencyKey}`,
    `environment: ${HOMO_DEBIT_NOTE_ENVIRONMENT}`,
    `noteId: ${input.note.noteId}`,
    `noteNumber: ${input.note.noteNumber}`,
    `kind: ${HOMO_DEBIT_NOTE_INPUT.kind}`,
    "invoiceType: A",
    `voucherType: ${input.note.voucherType}`,
    "pointOfSale: 0007",
    `sequenceNumber: ${input.note.voucherNumber}`,
    `fiscalStatus: ${input.note.fiscalStatus}`,
    `associatedInvoiceNumber: ${input.associatedInvoiceNumber}`,
    `CAE PRESENTE: ${input.note.authorizationCode.trim() ? "true" : "false"}`,
    `CAE EXPIRES AT: ${input.note.authorizationExpiresAt ?? ""}`,
    `amount: ${pesos(HOMO_DEBIT_NOTE_AMOUNT_CENTS)}`,
    `invoice outstanding: ${pesos(outstandingCents)}`,
    `invoice outstanding cents: ${outstandingCents}`,
  ].join("\n");

  assertTextHidesSecrets(text, [input.note.authorizationCode.trim()]);
  return text;
}

function formatAmbiguous(
  idempotencyKey: string,
  voucherType: number,
  voucherNumber: number | null,
): string {
  return [
    "STATUS: AMBIGUOUS",
    `IDEMPOTENCY KEY: ${idempotencyKey}`,
    `voucherType: ${voucherType}`,
    `voucherNumber: ${voucherNumber ?? ""}`,
    SAME_KEY_RETRY_MESSAGE,
  ].join("\n");
}

function formatRejected(
  idempotencyKey: string,
  details: ReadonlyArray<{ code: string; message: string }>,
): string {
  const lines = ["STATUS: REJECTED", `IDEMPOTENCY KEY: ${idempotencyKey}`];

  if (details.length === 0) {
    lines.push("sin detalle");
  }

  for (const item of details) {
    lines.push(`${redactDebitNoteText(item.code)}: ${redactDebitNoteText(item.message)}`);
  }

  const text = lines.join("\n");
  assertTextHidesSecrets(text, []);
  return text;
}

function formatPending(idempotencyKey: string, status: string): string {
  return [
    `STATUS: ${status}`,
    `IDEMPOTENCY KEY: ${idempotencyKey}`,
    SAME_KEY_RETRY_MESSAGE,
  ].join("\n");
}

export async function executeHomoDebitNote(
  input: {
    invoice: HomoDebitNoteInvoice;
    issuerCuit: string;
    idempotencyKey: string;
    createdByUserId: string;
  },
  dependencies: {
    issueArcaNote: (
      request: {
        kind: "DEBIT";
        invoiceId: string;
        amountCents: number;
        reason: string;
        idempotencyKey: string;
        createdByUserId: string;
      },
      options: Pick<IssueArcaNoteDependencies, "loadSource">,
    ) => Promise<IssueArcaNoteResult>;
    loadSource: NonNullable<IssueArcaNoteDependencies["loadSource"]>;
    readRejection?: (
      emissionId: string,
    ) => Promise<Array<{ code: string; message: string }>>;
  },
): Promise<HomoDebitNoteExecuteReport> {
  assertDebitNoteAssociatedRequest(input.invoice, input.issuerCuit);

  const result = await dependencies.issueArcaNote(
    {
      kind: HOMO_DEBIT_NOTE_INPUT.kind,
      invoiceId: input.invoice.id,
      amountCents: HOMO_DEBIT_NOTE_INPUT.amountCents,
      reason: HOMO_DEBIT_NOTE_INPUT.reason,
      idempotencyKey: input.idempotencyKey,
      createdByUserId: input.createdByUserId,
    },
    { loadSource: dependencies.loadSource },
  );

  switch (result.status) {
    case "completed":
      if (
        result.voucherType !== ARCA_VOUCHER_TYPE.NOTA_DEBITO_A ||
        result.fiscalStatus !== "AUTORIZADA" ||
        result.outstandingCents !== EXPECTED_OUTSTANDING_CENTS
      ) {
        return {
          kind: "ambiguous",
          exitCode: 2,
          text: formatAmbiguous(
            input.idempotencyKey,
            result.voucherType,
            result.voucherNumber,
          ),
        };
      }

      return {
        kind: "completed",
        exitCode: 0,
        text: formatCompleted({
          note: result,
          idempotencyKey: input.idempotencyKey,
          associatedInvoiceNumber: input.invoice.invoiceNumber,
        }),
      };
    case "ambiguous":
      return {
        kind: "ambiguous",
        exitCode: 2,
        text: formatAmbiguous(
          input.idempotencyKey,
          result.voucherType,
          result.voucherNumber,
        ),
      };
    case "rejected": {
      const details = dependencies.readRejection
        ? await dependencies.readRejection(result.emissionId)
        : [];
      return {
        kind: "rejected",
        exitCode: 1,
        text: formatRejected(input.idempotencyKey, details),
      };
    }
    case "failed_pre_send":
      return {
        kind: "failed_pre_send",
        exitCode: 1,
        text:
          formatPending(input.idempotencyKey, "FAILED_PRE_SEND") +
          `\n${redactDebitNoteText(result.code)}: ${redactDebitNoteText(result.message)}`,
      };
    default: {
      const unexpected: never = result;
      return unexpected;
    }
  }
}

export type HomoDebitNoteVerifyView = {
  emissionStatus: string;
  emissionEnvironment: string;
  voucherType: number;
  voucherNumber: number | null;
  noteId: string | null;
  noteNumber: string | null;
  noteKind: string | null;
  noteFiscalStatus: string | null;
  noteEnvironment: string | null;
  noteInvoiceId: string | null;
  noteVoucherType: number | null;
  noteAmountCents: number | null;
  caePresent: boolean;
  invoiceNumber: string | null;
  invoiceFiscalStatus: string | null;
  invoicePaymentMethod: string | null;
  invoicePaymentStatus: string | null;
  invoiceNoteCount: number;
  outstandingCents: number | null;
  lastAuthorizedType2: number | null;
  consultResult: "A" | "R" | null;
  consultCaePresent: boolean;
  consultVoucherNumber: number | null;
  settingsEnvironment: string;
  isolationConfirmed: boolean;
};

export function assertHomoDebitNoteProductionIsolation(input: {
  activeEnvironment: string;
  invoiceId: string;
  invoiceNumber: string;
  noteId: string;
  noteNumber: string;
  activeInvoiceIds: readonly string[];
  productionNoteIds: readonly string[];
  dashboardInvoiceIds: readonly string[];
  debtorSourceInvoiceIds: readonly string[];
  movementIds: readonly string[];
  movementInvoiceIds: readonly string[];
  libroInvoiceIds: readonly string[];
  libroNoteIds: readonly string[];
}): void {
  if (input.activeEnvironment !== "PRODUCCION") {
    throw new HomoDebitNoteAbort("BillingFiscalSettings no está en PRODUCCION.");
  }

  const present =
    input.activeInvoiceIds.includes(input.invoiceId) ||
    input.productionNoteIds.includes(input.noteId) ||
    input.dashboardInvoiceIds.includes(input.invoiceId) ||
    input.debtorSourceInvoiceIds.includes(input.invoiceId) ||
    input.movementIds.includes(input.noteId) ||
    input.movementInvoiceIds.includes(input.invoiceId) ||
    input.libroInvoiceIds.includes(input.invoiceId) ||
    input.libroNoteIds.includes(input.noteId);

  if (present) {
    throw new HomoDebitNoteAbort(
      "La factura o la nota de homologación aparecen en el alcance productivo.",
    );
  }
}

export function formatHomoDebitNoteVerify(view: HomoDebitNoteVerifyView, cae = ""): string {
  const coherent =
    view.emissionStatus === "COMPLETED" &&
    view.emissionEnvironment === HOMO_DEBIT_NOTE_ENVIRONMENT &&
    view.voucherType === ARCA_VOUCHER_TYPE.NOTA_DEBITO_A &&
    view.noteId !== null &&
    view.noteKind === "DEBIT" &&
    view.noteFiscalStatus === "AUTORIZADA" &&
    view.noteEnvironment === HOMO_DEBIT_NOTE_ENVIRONMENT &&
    view.noteInvoiceId === HOMO_DEBIT_NOTE_INVOICE_ID &&
    view.noteVoucherType === ARCA_VOUCHER_TYPE.NOTA_DEBITO_A &&
    view.noteAmountCents === HOMO_DEBIT_NOTE_AMOUNT_CENTS &&
    view.caePresent &&
    view.invoiceNumber === HOMO_DEBIT_NOTE_INVOICE_NUMBER &&
    view.invoiceFiscalStatus === "AUTORIZADA" &&
    view.invoicePaymentMethod === "CUENTA_CORRIENTE" &&
    view.invoicePaymentStatus === "IMPAGA" &&
    view.invoiceNoteCount === 1 &&
    view.outstandingCents === EXPECTED_OUTSTANDING_CENTS &&
    view.voucherNumber !== null &&
    view.consultVoucherNumber === view.voucherNumber &&
    view.settingsEnvironment === "PRODUCCION" &&
    view.isolationConfirmed;

  if (!coherent) {
    throw new HomoDebitNoteAbort("La verificación local de la nota de débito no cerró.");
  }

  const text = [
    "STATUS: VERIFY",
    `emissionStatus: ${view.emissionStatus}`,
    `environment: ${view.emissionEnvironment}`,
    `voucherType: ${view.voucherType}`,
    `voucherNumber: ${view.voucherNumber ?? ""}`,
    `noteId: ${view.noteId ?? ""}`,
    `noteNumber: ${view.noteNumber ?? ""}`,
    `kind: ${view.noteKind ?? ""}`,
    `noteFiscalStatus: ${view.noteFiscalStatus ?? ""}`,
    `noteEnvironment: ${view.noteEnvironment ?? ""}`,
    `CAE PRESENTE: ${view.caePresent ? "true" : "false"}`,
    `invoiceId: ${view.noteInvoiceId ?? ""}`,
    `invoiceNumber: ${view.invoiceNumber ?? ""}`,
    `invoiceFiscalStatus: ${view.invoiceFiscalStatus ?? ""}`,
    `paymentMethod: ${view.invoicePaymentMethod ?? ""}`,
    `paymentStatus: ${view.invoicePaymentStatus ?? ""}`,
    `notasDeLaFactura: ${view.invoiceNoteCount}`,
    `noteAmountCents: ${view.noteAmountCents ?? ""}`,
    `outstandingCents: ${view.outstandingCents ?? ""}`,
    `FECompUltimoAutorizado tipo 2: ${view.lastAuthorizedType2 ?? ""}`,
    `FECompConsultar resultado: ${view.consultResult ?? ""}`,
    `FECompConsultar CAE PRESENTE: ${view.consultCaePresent ? "true" : "false"}`,
    `FECompConsultar numero: ${view.consultVoucherNumber ?? ""}`,
    `settings: ${view.settingsEnvironment}`,
    "coherente: si",
    "factura homo en facturas activas: no",
    "nota homo en comprobantes: no",
    "factura homo en dashboard: no",
    "factura homo en deudores: no",
    "factura homo en movimientos: no",
    "nota homo en movimientos: no",
    "factura homo en libro IVA produccion: no",
    "nota homo en libro IVA produccion: no",
  ].join("\n");

  assertTextHidesSecrets(text, [cae]);
  return text;
}
