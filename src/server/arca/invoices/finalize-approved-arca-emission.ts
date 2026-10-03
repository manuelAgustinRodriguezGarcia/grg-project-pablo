import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceFiscalStatus,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingPaymentMethod,
  BillingPaymentStatus,
} from "@/generated/prisma/client";
import type { ArcaCaeFiscalRequest } from "@/server/arca/adapters/billing-invoice-to-cae";
import { formatArcaVoucherDate } from "@/server/arca/adapters/billing-invoice-to-cae";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import type { ArcaBillingPersistenceSnapshot } from "@/server/arca/invoices/billing-payload-snapshot";
import type { ArcaEmissionRecord } from "@/server/arca/invoices/emission-store";
import { toFiscalCents } from "@/server/arca/wsfe/wsfe-cae-request";
import {
  ARCA_CURRENCY_ID,
  ARCA_CURRENCY_RATE,
  resolveArcaFiscalProfile,
  voucherTypeForClass,
} from "@/shared/fiscal/arca-fiscal-mapping";
import {
  buildFiscalInvoiceNumber,
  FISCAL_INVOICE_POINT_OF_SALE_DIGITS,
} from "@/shared/utils/billing-invoice-rules";
import type { CreateBillingInvoiceData } from "@/server/repositories/billing-invoice.repository";

/**
 * La transacción del advisory lock es la misma que inserta BillingInvoice,
 * sus ítems y marca COMPLETED. Si algo falla, no queda factura ni invoiceId.
 * No hay red dentro de este lock.
 *
 * BillingInvoice no tiene createdByUserId. El audit log queda fuera de
 * esta transacción para la fase de integración.
 */

const FINALIZE_LOCK_MAX_WAIT_MS = 20_000;
const FINALIZE_LOCK_TIMEOUT_MS = 15_000;

export { FINALIZE_LOCK_MAX_WAIT_MS, FINALIZE_LOCK_TIMEOUT_MS };

export type ArcaInvoiceWrite = {
  environment: BillingFiscalEnvironment;
  fiscalStatus: BillingInvoiceFiscalStatus;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  sequenceNumber: number;
  invoiceNumber: string;
  issuedAt: Date;
  clientId: string;
  clientCode: string;
  clientName: string;
  clientAddress: string | null;
  clientCity: string | null;
  clientProvince: string | null;
  clientEmail: string | null;
  clientWhatsapp: string | null;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  subtotalCents: number;
  discountPercent: string;
  discountAmountCents: number;
  ivaPercent: string;
  ivaAmountCents: number;
  totalCents: number;
  totalVisualRoundedCents: number;
  paymentMethod: BillingPaymentMethod;
  paymentStatus: BillingPaymentStatus;
  notes: string | null;
  cae: string;
  caeExpiresAt: Date;
  items: Array<{
    rubroId: string | null;
    rubroCode: string;
    rubroName: string;
    description: string;
    quantity: string;
    unitPriceCents: number;
    lineTotalCents: number;
    sortOrder: number;
  }>;
};

export type FinalizedArcaInvoice = {
  id: string;
  environment: BillingFiscalEnvironment;
  fiscalStatus: BillingInvoiceFiscalStatus;
  invoiceType: BillingInvoiceType;
  pointOfSale: string;
  sequenceNumber: number;
  invoiceNumber: string;
  issuedAt: string;
  clientId: string;
  clientCode: string;
  clientName: string;
  clientAddress: string | null;
  clientCity: string | null;
  clientProvince: string | null;
  clientEmail: string | null;
  clientWhatsapp: string | null;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
  clientIvaCondition: BillingIvaCondition;
  subtotalCents: number;
  discountPercent: string;
  discountAmountCents: number;
  ivaPercent: string;
  ivaAmountCents: number;
  totalCents: number;
  totalVisualRoundedCents: number;
  paymentMethod: BillingPaymentMethod;
  paymentStatus: BillingPaymentStatus;
  notes: string | null;
  cae: string;
  caeExpiresAt: string;
  qrUrl: null;
  items: ArcaInvoiceWrite["items"];
};

export type FinalizeApprovedResult = {
  status: "completed";
  emissionId: string;
  invoice: FinalizedArcaInvoice;
};

export type ArcaFinalizeGateway = {
  readEmission(id: string): Promise<ArcaEmissionRecord | null>;
  readInvoice(id: string): Promise<FinalizedArcaInvoice | null>;
  commit(emissionId: string, write: ArcaInvoiceWrite): Promise<FinalizedArcaInvoice>;
};

export type FinalizeApprovedDependencies = {
  run?: (
    emissionId: string,
    work: (gateway: ArcaFinalizeGateway) => Promise<FinalizeApprovedResult>,
  ) => Promise<FinalizeApprovedResult>;
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

function requireBilling(
  emission: ArcaEmissionRecord,
): ArcaBillingPersistenceSnapshot {
  if (!emission.billingPayloadSnapshot) {
    throw incomplete("Falta el snapshot comercial de la emisión.");
  }

  return emission.billingPayloadSnapshot;
}

function requireFiscal(emission: ArcaEmissionRecord): ArcaCaeFiscalRequest {
  if (!emission.fiscalRequestSnapshot) {
    throw incomplete("Falta el snapshot fiscal de la emisión.");
  }

  return emission.fiscalRequestSnapshot;
}

function assertSnapshotsMatch(
  emission: ArcaEmissionRecord,
  billing: ArcaBillingPersistenceSnapshot,
  fiscal: ArcaCaeFiscalRequest,
  voucherNumber: number,
): void {
  if (fiscal.environment !== emission.environment) {
    throw mismatch("El ambiente fiscal no coincide con la emisión.");
  }

  if (
    billing.pointOfSale !== emission.pointOfSale ||
    fiscal.pointOfSale !== emission.pointOfSale
  ) {
    throw mismatch("El punto de venta no coincide.");
  }

  if (billing.invoiceType !== emission.invoiceType) {
    throw mismatch("El tipo de factura no coincide.");
  }

  if (
    fiscal.voucherType !== emission.voucherType ||
    fiscal.voucherType !== voucherTypeForClass(emission.invoiceType)
  ) {
    throw mismatch("El tipo de comprobante no coincide.");
  }

  if (fiscal.voucherFrom !== voucherNumber || fiscal.voucherTo !== voucherNumber) {
    throw mismatch("El número de comprobante no coincide.");
  }

  if (fiscal.voucherDate !== formatArcaVoucherDate(new Date(billing.issuedAt))) {
    throw mismatch("La fecha fiscal no coincide con la emisión original.");
  }

  if (fiscal.currencyId !== ARCA_CURRENCY_ID || fiscal.currencyRate !== ARCA_CURRENCY_RATE) {
    throw mismatch("La moneda fiscal no coincide.");
  }

  const financial = billing.financial;

  if (
    centsFromFiscal(fiscal.totalAmount, "El total fiscal no es válido.") !==
      financial.totalCents ||
    centsFromFiscal(fiscal.vatAmount, "El IVA fiscal no es válido.") !==
      financial.ivaAmountCents ||
    centsFromFiscal(fiscal.netAmount, "El neto fiscal no es válido.") !==
      financial.netCents ||
    centsFromFiscal(fiscal.nonTaxedAmount, "El no gravado fiscal no es válido.") !==
      financial.nonTaxedCents ||
    centsFromFiscal(fiscal.exemptAmount, "El exento fiscal no es válido.") !==
      financial.exemptCents ||
    centsFromFiscal(fiscal.taxAmount, "Los tributos fiscales no son válidos.") !==
      financial.taxCents
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

  if (profile.voucherClass !== emission.invoiceType) {
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

export function buildApprovedInvoiceWrite(
  emission: ArcaEmissionRecord,
): ArcaInvoiceWrite {
  if (
    emission.voucherNumber === null ||
    !emission.authorizationCode ||
    !emission.authorizationExpiresAt
  ) {
    throw incomplete("La autorización no tiene número o CAE.");
  }

  const billing = requireBilling(emission);
  const fiscal = requireFiscal(emission);
  assertSnapshotsMatch(emission, billing, fiscal, emission.voucherNumber);
  const invoiceNumber = buildFiscalInvoiceNumber(
    emission.pointOfSale,
    emission.voucherNumber,
  );

  return {
    environment: emission.environment,
    fiscalStatus: "AUTORIZADA",
    invoiceType: emission.invoiceType,
    pointOfSale: invoiceNumber.slice(0, FISCAL_INVOICE_POINT_OF_SALE_DIGITS),
    sequenceNumber: emission.voucherNumber,
    invoiceNumber,
    issuedAt: new Date(billing.issuedAt),
    clientId: billing.client.id,
    clientCode: billing.client.code,
    clientName: billing.client.name,
    clientAddress: billing.client.address,
    clientCity: billing.client.city,
    clientProvince: billing.client.province,
    clientEmail: billing.client.email,
    clientWhatsapp: billing.client.whatsapp,
    clientIdentificationType: billing.client.identificationType,
    clientIdentificationNumber: billing.client.identificationNumber,
    clientIvaCondition: billing.client.ivaCondition,
    subtotalCents: billing.financial.subtotalCents,
    discountPercent: billing.financial.discountPercent,
    discountAmountCents: billing.financial.discountAmountCents,
    ivaPercent: billing.financial.ivaPercent,
    ivaAmountCents: billing.financial.ivaAmountCents,
    totalCents: billing.financial.totalCents,
    totalVisualRoundedCents: billing.financial.totalVisualRoundedCents,
    paymentMethod: billing.paymentMethod,
    paymentStatus: billing.paymentStatus,
    notes: billing.notes,
    cae: emission.authorizationCode,
    caeExpiresAt: emission.authorizationExpiresAt,
    items: billing.items.map((item) => ({ ...item })),
  };
}

function centsToDecimal(cents: number): Prisma.Decimal {
  return new Prisma.Decimal(cents).div(100);
}

export function toCreateBillingInvoiceData(
  write: ArcaInvoiceWrite,
): CreateBillingInvoiceData {
  return {
    environment: write.environment,
    fiscalStatus: write.fiscalStatus,
    invoiceType: write.invoiceType,
    pointOfSale: write.pointOfSale,
    sequenceNumber: write.sequenceNumber,
    invoiceNumber: write.invoiceNumber,
    issuedAt: write.issuedAt,
    clientId: write.clientId,
    clientCode: write.clientCode,
    clientName: write.clientName,
    clientAddress: write.clientAddress,
    clientCity: write.clientCity,
    clientProvince: write.clientProvince,
    clientEmail: write.clientEmail,
    clientWhatsapp: write.clientWhatsapp,
    clientIdentificationType: write.clientIdentificationType,
    clientIdentificationNumber: write.clientIdentificationNumber,
    clientIvaCondition: write.clientIvaCondition,
    subtotal: centsToDecimal(write.subtotalCents),
    discountPercent: new Prisma.Decimal(write.discountPercent),
    discountAmount: centsToDecimal(write.discountAmountCents),
    ivaPercent: new Prisma.Decimal(write.ivaPercent),
    ivaAmount: centsToDecimal(write.ivaAmountCents),
    total: centsToDecimal(write.totalCents),
    totalVisualRounded: centsToDecimal(write.totalVisualRoundedCents),
    paymentMethod: write.paymentMethod,
    paymentStatus: write.paymentStatus,
    notes: write.notes,
    cae: write.cae,
    caeExpiresAt: write.caeExpiresAt,
    items: write.items.map((item) => ({
      rubroId: item.rubroId,
      rubroCode: item.rubroCode,
      rubroName: item.rubroName,
      description: item.description,
      quantity: new Prisma.Decimal(item.quantity),
      unitPrice: centsToDecimal(item.unitPriceCents),
      lineTotal: centsToDecimal(item.lineTotalCents),
      sortOrder: item.sortOrder,
    })),
  };
}

export function finalizedInvoiceFromWrite(
  id: string,
  write: ArcaInvoiceWrite,
): FinalizedArcaInvoice {
  return {
    id,
    environment: write.environment,
    fiscalStatus: write.fiscalStatus,
    invoiceType: write.invoiceType,
    pointOfSale: write.pointOfSale,
    sequenceNumber: write.sequenceNumber,
    invoiceNumber: write.invoiceNumber,
    issuedAt: write.issuedAt.toISOString(),
    clientId: write.clientId,
    clientCode: write.clientCode,
    clientName: write.clientName,
    clientAddress: write.clientAddress,
    clientCity: write.clientCity,
    clientProvince: write.clientProvince,
    clientEmail: write.clientEmail,
    clientWhatsapp: write.clientWhatsapp,
    clientIdentificationType: write.clientIdentificationType,
    clientIdentificationNumber: write.clientIdentificationNumber,
    clientIvaCondition: write.clientIvaCondition,
    subtotalCents: write.subtotalCents,
    discountPercent: write.discountPercent,
    discountAmountCents: write.discountAmountCents,
    ivaPercent: write.ivaPercent,
    ivaAmountCents: write.ivaAmountCents,
    totalCents: write.totalCents,
    totalVisualRoundedCents: write.totalVisualRoundedCents,
    paymentMethod: write.paymentMethod,
    paymentStatus: write.paymentStatus,
    notes: write.notes,
    cae: write.cae,
    caeExpiresAt: write.caeExpiresAt.toISOString(),
    qrUrl: null,
    items: write.items.map((item) => ({ ...item })),
  };
}

async function finalizeWithinLock(
  emissionId: string,
  gateway: ArcaFinalizeGateway,
): Promise<FinalizeApprovedResult> {
  const emission = await gateway.readEmission(emissionId);

  if (!emission) {
    throw notReady("La emisión no existe.");
  }

  if (emission.status === "COMPLETED") {
    if (!emission.invoiceId) {
      throw incomplete("La emisión completada no tiene factura.");
    }

    const invoice = await gateway.readInvoice(emission.invoiceId);

    if (!invoice) {
      throw incomplete("La factura vinculada no existe.");
    }

    return { status: "completed", emissionId: emission.id, invoice };
  }

  switch (emission.status) {
    case "APPROVED_PENDING_PERSISTENCE":
      break;
    case "PREPARED":
    case "SENDING":
    case "REJECTED":
    case "AMBIGUOUS":
    case "FAILED_PRE_SEND":
      throw notReady("La emisión no está autorizada para persistir la factura.");
    default: {
      const unexpected: never = emission.status;
      return unexpected;
    }
  }

  const write = buildApprovedInvoiceWrite(emission);
  const invoice = await gateway.commit(emission.id, write);
  return { status: "completed", emissionId: emission.id, invoice };
}

export async function finalizeApprovedArcaEmission(
  emissionId: string,
  dependencies: FinalizeApprovedDependencies = {},
): Promise<FinalizeApprovedResult> {
  const run =
    dependencies.run ??
    (await import("@/server/arca/invoices/finalize-approved-arca-emission.db"))
      .runArcaFinalizeTransaction;

  return run(emissionId, (gateway) => finalizeWithinLock(emissionId, gateway));
}
