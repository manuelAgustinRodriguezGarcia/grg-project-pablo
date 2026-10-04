import "server-only";
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingNoteKind,
  BillingPaymentStatus,
} from "@/generated/prisma/client";
import type { ArcaCaeFiscalRequest } from "@/server/arca/adapters/billing-invoice-to-cae";
import { formatArcaVoucherDate } from "@/server/arca/adapters/billing-invoice-to-cae";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import type { ArcaEmissionRecord } from "@/server/arca/invoices/emission-store";
import {
  isArcaNoteBillingSnapshot,
  type ArcaNotePersistenceSnapshot,
} from "@/server/arca/notes/note-payload-snapshot";
import { toFiscalCents } from "@/server/arca/wsfe/wsfe-cae-request";
import {
  ARCA_CURRENCY_ID,
  ARCA_CURRENCY_RATE,
  resolveArcaFiscalProfile,
  voucherTypeForBillingNote,
  voucherTypeForClass,
} from "@/shared/fiscal/arca-fiscal-mapping";
import {
  buildFiscalInvoiceNumber,
  FISCAL_INVOICE_POINT_OF_SALE_DIGITS,
} from "@/shared/utils/billing-invoice-rules";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";

export type ArcaNoteWrite = {
  kind: BillingNoteKind;
  environment: Exclude<BillingFiscalEnvironment, "MODO_PRUEBA">;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  sequenceNumber: number;
  noteNumber: string;
  voucherType: number;
  issuedAt: Date;
  invoiceId: string;
  clientId: string | null;
  clientCode: string;
  clientName: string;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  amountCents: number;
  netAmountCents: number;
  ivaAmountCents: number;
  ivaPercent: string;
  reason: string;
  cae: string;
  caeExpiresAt: Date;
  createdByUserId: string;
};

export type FinalizedArcaNote = {
  id: string;
  kind: BillingNoteKind;
  environment: Exclude<BillingFiscalEnvironment, "MODO_PRUEBA">;
  fiscalStatus: "AUTORIZADA";
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  sequenceNumber: number;
  noteNumber: string;
  voucherType: number;
  invoiceId: string;
  amountCents: number;
  netAmountCents: number;
  ivaAmountCents: number;
  cae: string;
  caeExpiresAt: string;
  qrUrl: null;
  settlement: {
    paymentStatus: BillingPaymentStatus;
    fiscalStatus: "AUTORIZADA";
    outstandingCents: number;
  } | null;
};

export type FinalizeApprovedNoteResult = {
  status: "completed";
  emissionId: string;
  note: FinalizedArcaNote;
};

export type ArcaNoteFinalizeGateway = {
  readEmission(id: string): Promise<ArcaEmissionRecord | null>;
  readNote(id: string): Promise<FinalizedArcaNote | null>;
  commit(emissionId: string, write: ArcaNoteWrite): Promise<FinalizedArcaNote>;
};

export type FinalizeApprovedNoteDependencies = {
  run?: (
    emissionId: string,
    work: (gateway: ArcaNoteFinalizeGateway) => Promise<FinalizeApprovedNoteResult>,
  ) => Promise<FinalizeApprovedNoteResult>;
};

function notReady(message: string): ArcaEmissionError {
  return new ArcaEmissionError(message, "ARCA_EMISSION_NOT_READY_FOR_PERSISTENCE");
}

function incomplete(message: string): ArcaEmissionError {
  return new ArcaEmissionError(message, "ARCA_APPROVED_EMISSION_INCOMPLETE");
}

function mismatch(message: string): ArcaEmissionError {
  return new ArcaEmissionError(message, "ARCA_EMISSION_SNAPSHOT_MISMATCH");
}

function centsFromFiscal(value: number, message: string): number {
  try {
    return toFiscalCents(value);
  } catch {
    throw incomplete(message);
  }
}

function requireNoteSnapshot(
  emission: ArcaEmissionRecord,
): ArcaNotePersistenceSnapshot {
  const snapshot = emission.billingPayloadSnapshot;

  if (!snapshot || !isArcaNoteBillingSnapshot(snapshot)) {
    throw incomplete("Falta el snapshot comercial de la nota.");
  }

  return snapshot;
}

function requireFiscal(emission: ArcaEmissionRecord): ArcaCaeFiscalRequest {
  if (!emission.fiscalRequestSnapshot) {
    throw incomplete("Falta el snapshot fiscal de la emisión.");
  }

  return emission.fiscalRequestSnapshot;
}

function assertSnapshotsMatch(
  emission: ArcaEmissionRecord,
  billing: ArcaNotePersistenceSnapshot,
  fiscal: ArcaCaeFiscalRequest,
  voucherNumber: number,
): void {
  const associated = billing.associatedInvoice;
  const linked = fiscal.associatedVouchers?.[0];

  if (fiscal.environment !== emission.environment || fiscal.environment !== associated.environment) {
    throw mismatch("El ambiente fiscal no coincide con la emisión.");
  }

  if (parseArcaPointOfSale(associated.pointOfSale) !== emission.pointOfSale) {
    throw mismatch("El punto de venta no coincide.");
  }

  if (fiscal.pointOfSale !== emission.pointOfSale || associated.invoiceType !== emission.invoiceType) {
    throw mismatch("El punto de venta o la letra no coinciden.");
  }

  if (
    fiscal.voucherType !== emission.voucherType ||
    fiscal.voucherType !== voucherTypeForBillingNote(billing.kind, associated.invoiceType)
  ) {
    throw mismatch("El tipo de comprobante no coincide.");
  }

  if (fiscal.voucherFrom !== voucherNumber || fiscal.voucherTo !== voucherNumber) {
    throw mismatch("El número de comprobante no coincide.");
  }

  if (!linked) {
    throw mismatch("Falta el comprobante asociado.");
  }

  if (
    linked.type !== voucherTypeForClass(associated.invoiceType) ||
    linked.pointOfSale !== emission.pointOfSale ||
    linked.number !== associated.sequenceNumber ||
    linked.issuerCuit !== emission.issuerCuit ||
    linked.issuedAt !== formatArcaVoucherDate(associated.issuedAt)
  ) {
    throw mismatch("El comprobante asociado no coincide con la factura original.");
  }

  if (fiscal.voucherDate !== formatArcaVoucherDate(billing.issuedAt)) {
    throw mismatch("La fecha fiscal no coincide con la nota.");
  }

  if (fiscal.currencyId !== ARCA_CURRENCY_ID || fiscal.currencyRate !== ARCA_CURRENCY_RATE) {
    throw mismatch("La moneda fiscal no coincide.");
  }

  if (
    centsFromFiscal(fiscal.totalAmount, "El total fiscal no es válido.") !== billing.amountCents ||
    centsFromFiscal(fiscal.netAmount, "El neto fiscal no es válido.") !== billing.netAmountCents ||
    centsFromFiscal(fiscal.vatAmount, "El IVA fiscal no es válido.") !== billing.ivaAmountCents ||
    fiscal.nonTaxedAmount !== 0 ||
    fiscal.exemptAmount !== 0 ||
    fiscal.taxAmount !== 0
  ) {
    throw mismatch("Los importes fiscales no coinciden con el snapshot comercial.");
  }

  let profile: ReturnType<typeof resolveArcaFiscalProfile>;

  try {
    profile = resolveArcaFiscalProfile(
      billing.client.identificationType,
      billing.client.ivaCondition,
    );
  } catch {
    throw mismatch("La condición de IVA del snapshot no se puede autorizar.");
  }

  if (profile.voucherClass !== associated.invoiceType) {
    throw mismatch("La letra del snapshot no coincide con la emisión.");
  }

  if (fiscal.receiverVatConditionId !== profile.receptorVatConditionId) {
    throw mismatch("La condición de IVA fiscal no coincide.");
  }

  if (fiscal.documentType !== profile.documentType) {
    throw mismatch("El documento fiscal no coincide.");
  }

  const expectedDocumentNumber =
    profile.documentNumber === null
      ? Number(billing.client.identificationNumber)
      : profile.documentNumber;

  if (fiscal.documentNumber !== expectedDocumentNumber) {
    throw mismatch("El número de documento fiscal no coincide.");
  }
}

export function buildApprovedNoteWrite(emission: ArcaEmissionRecord): ArcaNoteWrite {
  if (
    emission.voucherNumber === null ||
    !emission.authorizationCode ||
    !emission.authorizationExpiresAt ||
    emission.invoiceId
  ) {
    throw incomplete("La autorización no tiene número o CAE.");
  }

  const billing = requireNoteSnapshot(emission);
  const fiscal = requireFiscal(emission);
  assertSnapshotsMatch(emission, billing, fiscal, emission.voucherNumber);
  const noteNumber = buildFiscalInvoiceNumber(emission.pointOfSale, emission.voucherNumber);

  return {
    kind: billing.kind,
    environment: billing.associatedInvoice.environment,
    invoiceType: billing.associatedInvoice.invoiceType,
    pointOfSale: noteNumber.slice(0, FISCAL_INVOICE_POINT_OF_SALE_DIGITS),
    sequenceNumber: emission.voucherNumber,
    noteNumber,
    voucherType: emission.voucherType,
    issuedAt: new Date(billing.issuedAt),
    invoiceId: billing.invoiceId,
    clientId: billing.client.id,
    clientCode: billing.client.code,
    clientName: billing.client.name,
    clientIdentificationType: billing.client.identificationType,
    clientIdentificationNumber: billing.client.identificationNumber,
    clientIvaCondition: billing.client.ivaCondition,
    amountCents: billing.amountCents,
    netAmountCents: billing.netAmountCents,
    ivaAmountCents: billing.ivaAmountCents,
    ivaPercent: billing.ivaPercent,
    reason: billing.reason,
    cae: emission.authorizationCode,
    caeExpiresAt: emission.authorizationExpiresAt,
    createdByUserId: billing.createdByUserId,
  };
}

export function finalizedNoteFromWrite(
  id: string,
  write: ArcaNoteWrite,
  settlement: FinalizedArcaNote["settlement"],
): FinalizedArcaNote {
  return {
    id,
    kind: write.kind,
    environment: write.environment,
    fiscalStatus: "AUTORIZADA",
    invoiceType: write.invoiceType,
    pointOfSale: write.pointOfSale,
    sequenceNumber: write.sequenceNumber,
    noteNumber: write.noteNumber,
    voucherType: write.voucherType,
    invoiceId: write.invoiceId,
    amountCents: write.amountCents,
    netAmountCents: write.netAmountCents,
    ivaAmountCents: write.ivaAmountCents,
    cae: write.cae,
    caeExpiresAt: write.caeExpiresAt.toISOString(),
    qrUrl: null,
    settlement,
  };
}

async function finalizeWithinLock(
  emissionId: string,
  gateway: ArcaNoteFinalizeGateway,
): Promise<FinalizeApprovedNoteResult> {
  const emission = await gateway.readEmission(emissionId);

  if (!emission) {
    throw notReady("La emisión no existe.");
  }

  if (emission.status === "COMPLETED") {
    if (!emission.noteId || emission.invoiceId) {
      throw incomplete("La emisión completada no tiene nota.");
    }

    const note = await gateway.readNote(emission.noteId);

    if (!note) {
      throw incomplete("La nota vinculada no existe.");
    }

    return { status: "completed", emissionId: emission.id, note };
  }

  switch (emission.status) {
    case "APPROVED_PENDING_PERSISTENCE":
      break;
    case "PREPARED":
    case "SENDING":
    case "REJECTED":
    case "AMBIGUOUS":
    case "FAILED_PRE_SEND":
      throw notReady("La emisión no está autorizada para persistir la nota.");
    default: {
      const unexpected: never = emission.status;
      return unexpected;
    }
  }

  if (emission.noteId) {
    throw incomplete("La emisión ya tiene una nota.");
  }

  const write = buildApprovedNoteWrite(emission);
  const note = await gateway.commit(emission.id, write);
  return { status: "completed", emissionId: emission.id, note };
}

export async function finalizeApprovedArcaNoteEmission(
  emissionId: string,
  dependencies: FinalizeApprovedNoteDependencies = {},
): Promise<FinalizeApprovedNoteResult> {
  const run =
    dependencies.run ??
    (await import("@/server/arca/notes/finalize-approved-arca-note-emission.db"))
      .runArcaNoteFinalizeTransaction;

  return run(emissionId, (gateway) => finalizeWithinLock(emissionId, gateway));
}
