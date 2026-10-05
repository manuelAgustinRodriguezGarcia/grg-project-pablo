/**
 * Dry-run y ejecución de UNA Nota de Crédito A de homologación.
 * El número fiscal lo asigna issueArcaNote con FECompUltimoAutorizado last + 1.
 * La UUID de la nota es nueva y se reutiliza en cada retry.
 * El loader del harness fija HOMOLOGACION sin escribir BillingFiscalSettings.
 */
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceFiscalStatus,
  BillingInvoiceType,
  BillingIvaCondition,
} from "@/generated/prisma/client";
import { buildArcaNoteCaeRequest } from "@/server/arca/adapters/billing-note-to-cae";
import type {
  IssueArcaNoteDependencies,
  IssueArcaNoteResult,
} from "@/server/arca/notes/issue-arca-note";
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
export const HOMO_CREDIT_NOTE_INVOICE_ID = "cmuuoyff20002jsf0a7baej66";
export const HOMO_CREDIT_NOTE_AMOUNT_CENTS = 12_100;
const NOTE_TOTAL_CENTS = HOMO_CREDIT_NOTE_AMOUNT_CENTS;
const NOTE_NET_CENTS = 10_000;
const NOTE_VAT_CENTS = 2_100;
const IVA_PERCENT = 21;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SAME_KEY_RETRY_MESSAGE =
  "NO GENERAR OTRA KEY. Reejecutar exactamente el mismo comando.";

const HOMO_CREDENTIAL_ENV = [
  "ARCA_HOMO_CERT_B64",
  "ARCA_HOMO_PRIVATE_KEY_B64",
  "ARCA_TICKET_ENCRYPTION_KEY_B64",
] as const;

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

export type HomoCreditNoteMode = "dry-run" | "execute" | "verify";

export type HomoCreditNoteArgs = {
  mode: HomoCreditNoteMode;
  execute: boolean;
  verify: boolean;
  confirmHomologacion: boolean;
  invoiceId: string | null;
  idempotencyKey: string | null;
  createdByUserId: string | null;
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
      arg.includes("ARCA_PROD_CERT_B64") ||
      arg.includes("ARCA_PROD_PRIVATE_KEY_B64") ||
      arg.includes("PRODUCCION")
    ) {
      throw new HomoCreditNoteAbort("El harness solo puede apuntar a HOMOLOGACION.");
    }

    throw new HomoCreditNoteAbort(`Argumento no reconocido: ${arg}`);
  }

  let mode: HomoCreditNoteMode = "dry-run";
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
    throw new HomoCreditNoteAbort(missing);
  }

  if (!UUID_PATTERN.test(value)) {
    throw new HomoCreditNoteAbort("La idempotencyKey tiene que ser un UUID.");
  }

  return value;
}

export function assertHomoCreditNoteArgs(args: HomoCreditNoteArgs): void {
  if (args.execute && args.verify) {
    throw new HomoCreditNoteAbort("Elegí un solo modo.");
  }

  if (args.mode === "verify") {
    assertUuid(args.idempotencyKey, "Falta --idempotency-key.");
    return;
  }

  if (!args.invoiceId) {
    throw new HomoCreditNoteAbort("Falta --invoice-id.");
  }

  if (args.mode !== "execute") {
    return;
  }

  if (!args.confirmHomologacion) {
    throw new HomoCreditNoteAbort("Falta --confirm-homologacion.");
  }

  assertUuid(args.idempotencyKey, "Falta --idempotency-key.");

  if (!args.createdByUserId) {
    throw new HomoCreditNoteAbort("Falta --created-by-user-id.");
  }

  if (!UUID_PATTERN.test(args.createdByUserId)) {
    throw new HomoCreditNoteAbort("El usuario indicado no es un UUID.");
  }
}

export function assertHomoCredentialNamesPresent(
  env: Record<string, string | undefined>,
): void {
  for (const name of HOMO_CREDENTIAL_ENV) {
    if (!env[name]?.trim()) {
      throw new HomoCreditNoteAbort(`Falta ${name}.`);
    }
  }
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
    executeRequiereConfirmacion: true,
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

export const HOMO_CREDIT_NOTE_INPUT = {
  kind: "CREDIT",
  amountCents: NOTE_TOTAL_CENTS,
  reason: HOMO_CREDIT_NOTE_REASON,
} as const;

export type HomoCreditNoteExecuteReport = {
  kind: "completed" | "ambiguous" | "rejected" | "failed_pre_send" | "pending";
  exitCode: 0 | 1 | 2;
  text: string;
};

function formatCompleted(input: {
  note: Extract<IssueArcaNoteResult, { status: "completed" }>;
  idempotencyKey: string;
  associatedInvoiceNumber: string;
}): string {
  if (input.note.voucherType !== ARCA_VOUCHER_TYPE.NOTA_CREDITO_A) {
    throw new HomoCreditNoteAbort("La nota persistida no es tipo 3.");
  }

  const text = [
    "STATUS: COMPLETED",
    `IDEMPOTENCY KEY: ${input.idempotencyKey}`,
    `environment: ${HOMO_CREDIT_NOTE_ENVIRONMENT}`,
    `noteId: ${input.note.noteId}`,
    `noteNumber: ${input.note.noteNumber}`,
    `kind: ${HOMO_CREDIT_NOTE_INPUT.kind}`,
    "invoiceType: A",
    `voucherType: ${input.note.voucherType}`,
    "pointOfSale: 0007",
    `sequenceNumber: ${input.note.voucherNumber}`,
    `fiscalStatus: ${input.note.fiscalStatus}`,
    `associatedInvoiceNumber: ${input.associatedInvoiceNumber}`,
    `CAE PRESENTE: ${input.note.authorizationCode.trim() ? "true" : "false"}`,
    `CAE EXPIRES AT: ${input.note.authorizationExpiresAt ?? ""}`,
    `amount: ${pesos(NOTE_TOTAL_CENTS)}`,
  ].join("\n");
  const cae = input.note.authorizationCode.trim();

  if (cae.length >= 10 && text.includes(cae)) {
    throw new HomoCreditNoteAbort("El resumen iba a incluir el CAE. No se imprime.");
  }

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
    lines.push(`${redactCreditNoteText(item.code)}: ${redactCreditNoteText(item.message)}`);
  }

  return lines.join("\n");
}

function formatPending(idempotencyKey: string, status: string): string {
  return [
    `STATUS: ${status}`,
    `IDEMPOTENCY KEY: ${idempotencyKey}`,
    SAME_KEY_RETRY_MESSAGE,
  ].join("\n");
}

export async function executeHomoCreditNote(
  input: {
    invoiceId: string;
    idempotencyKey: string;
    createdByUserId: string;
    associatedInvoiceNumber: string;
  },
  dependencies: {
    issueArcaNote: (
      request: {
        kind: "CREDIT";
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
): Promise<HomoCreditNoteExecuteReport> {
  const result = await dependencies.issueArcaNote(
    {
      kind: HOMO_CREDIT_NOTE_INPUT.kind,
      invoiceId: input.invoiceId,
      amountCents: HOMO_CREDIT_NOTE_INPUT.amountCents,
      reason: HOMO_CREDIT_NOTE_INPUT.reason,
      idempotencyKey: input.idempotencyKey,
      createdByUserId: input.createdByUserId,
    },
    { loadSource: dependencies.loadSource },
  );

  switch (result.status) {
    case "completed":
      return {
        kind: "completed",
        exitCode: 0,
        text: formatCompleted({
          note: result,
          idempotencyKey: input.idempotencyKey,
          associatedInvoiceNumber: input.associatedInvoiceNumber,
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
        text: formatPending(input.idempotencyKey, "FAILED_PRE_SEND") +
          `\n${redactCreditNoteText(result.code)}: ${redactCreditNoteText(result.message)}`,
      };
    default: {
      const unexpected: never = result;
      return unexpected;
    }
  }
}

export type HomoCreditNoteVerifyView = {
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
  invoiceFiscalStatus: string | null;
  invoiceNoteCount: number;
  outstandingCents: number | null;
  saldoReflejaNc: boolean;
  lastAuthorizedType3: number | null;
  consultResult: "A" | "R" | null;
  consultCaePresent: boolean;
  consultVoucherNumber: number | null;
};

export function formatHomoCreditNoteVerify(view: HomoCreditNoteVerifyView): string {
  const coherent =
    view.emissionEnvironment === HOMO_CREDIT_NOTE_ENVIRONMENT &&
    view.voucherType === ARCA_VOUCHER_TYPE.NOTA_CREDITO_A &&
    view.invoiceFiscalStatus === "AUTORIZADA" &&
    view.invoiceNoteCount === 1 &&
    view.noteKind === "CREDIT" &&
    view.noteVoucherType === ARCA_VOUCHER_TYPE.NOTA_CREDITO_A &&
    view.noteInvoiceId === HOMO_CREDIT_NOTE_INVOICE_ID &&
    view.noteAmountCents === NOTE_TOTAL_CENTS &&
    view.saldoReflejaNc;

  return [
    "STATUS: VERIFY",
    `emissionStatus: ${view.emissionStatus}`,
    `environment: ${view.emissionEnvironment}`,
    `voucherType: ${view.voucherType}`,
    `voucherNumber: ${view.voucherNumber ?? ""}`,
    `noteId: ${view.noteId ?? ""}`,
    `noteNumber: ${view.noteNumber ?? ""}`,
    `noteKind: ${view.noteKind ?? ""}`,
    `noteFiscalStatus: ${view.noteFiscalStatus ?? ""}`,
    `noteEnvironment: ${view.noteEnvironment ?? ""}`,
    `CAE PRESENTE: ${view.caePresent ? "true" : "false"}`,
    `invoiceId: ${view.noteInvoiceId ?? ""}`,
    `invoiceFiscalStatus: ${view.invoiceFiscalStatus ?? ""}`,
    `notasDeLaFactura: ${view.invoiceNoteCount}`,
    `noteAmountCents: ${view.noteAmountCents ?? ""}`,
    `outstandingCents: ${view.outstandingCents ?? ""}`,
    `saldoReflejaNc: ${view.saldoReflejaNc ? "si" : "no"}`,
    `FECompUltimoAutorizado tipo 3: ${view.lastAuthorizedType3 ?? ""}`,
    `FECompConsultar resultado: ${view.consultResult ?? ""}`,
    `FECompConsultar CAE PRESENTE: ${view.consultCaePresent ? "true" : "false"}`,
    `FECompConsultar numero: ${view.consultVoucherNumber ?? ""}`,
    `coherente: ${coherent ? "si" : "no"}`,
  ].join("\n");
}
