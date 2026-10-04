import "server-only";
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceFiscalStatus,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingNoteKind,
} from "@/generated/prisma/client";
import type { ArcaCaeFiscalRequest } from "@/server/arca/adapters/billing-invoice-to-cae";
import { formatArcaVoucherDate } from "@/server/arca/adapters/billing-invoice-to-cae";
import { ArcaInvoiceAdapterError } from "@/server/arca/errors/arca-invoice-adapter.error";
import { ArcaNoteAdapterError } from "@/server/arca/errors/arca-note-adapter.error";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import {
  ARCA_CONCEPT_PRODUCTS,
  ARCA_CURRENCY_ID,
  ARCA_CURRENCY_RATE,
  arcaVatRateId,
  resolveArcaFiscalProfile,
  voucherTypeForBillingNote,
  voucherTypeForClass,
} from "@/shared/fiscal/arca-fiscal-mapping";
import { centsToPesos } from "@/shared/utils/billing-invoice-totals";
import {
  isValidCuit,
  isValidDni,
  normalizeIdentificationDigits,
} from "@/shared/utils/identification";

export type ArcaBillingNoteIntent = {
  kind: BillingNoteKind;
  invoiceType: BillingInvoiceType;
  /** Centavos enteros. ImpTotal. */
  amountCents: number;
  /** Centavos enteros. ImpNeto. */
  netAmountCents: number;
  /** Centavos enteros. ImpIVA. */
  ivaAmountCents: number;
  ivaPercent: number;
  issuedAt: Date | string;
  receptor: {
    identificationType: BillingIdentificationType;
    identificationNumber?: string | null;
    ivaCondition: BillingIvaCondition;
  };
  associatedInvoice: {
    invoiceType: BillingInvoiceType;
    pointOfSale: string;
    sequenceNumber: number;
    issuedAt: Date | string;
    environment: BillingFiscalEnvironment;
    fiscalStatus: BillingInvoiceFiscalStatus;
    cae: string | null;
  };
  environment: BillingFiscalEnvironment;
  issuerCuit: string;
  voucherNumber: number;
};

function noteError(
  message: string,
  code: ArcaNoteAdapterError["code"],
): ArcaNoteAdapterError {
  return new ArcaNoteAdapterError(message, code);
}

function documentRequired(message: string): ArcaInvoiceAdapterError {
  return new ArcaInvoiceAdapterError(message, "ARCA_DOCUMENT_REQUIRED");
}

function receptorDocumentNumber(input: ArcaBillingNoteIntent): number {
  switch (input.receptor.identificationType) {
    case "NINGUNO":
      return 0;
    case "CUIT":
      return requiredDocumentNumber(
        input.receptor.identificationNumber,
        "El CUIT del cliente es obligatorio.",
        "El CUIT del cliente no es válido.",
        isValidCuit,
      );
    case "DNI":
      return requiredDocumentNumber(
        input.receptor.identificationNumber,
        "El DNI del cliente es obligatorio.",
        "El DNI del cliente no es válido.",
        isValidDni,
      );
    default: {
      const unexpected: never = input.receptor.identificationType;
      return unexpected;
    }
  }
}

function requiredDocumentNumber(
  value: string | null | undefined,
  missingMessage: string,
  invalidMessage: string,
  isValid: (digits: string) => boolean,
): number {
  const digits = normalizeIdentificationDigits(value ?? "");

  if (!digits) {
    throw documentRequired(missingMessage);
  }

  if (!isValid(digits)) {
    throw documentRequired(invalidMessage);
  }

  const documentNumber = Number(digits);

  if (!Number.isSafeInteger(documentNumber)) {
    throw documentRequired(invalidMessage);
  }

  return documentNumber;
}

function pesosFromCents(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("Los importes fiscales deben estar en centavos enteros.");
  }

  return centsToPesos(cents);
}

function assertWholeCents(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw noteError(
      "El importe de la nota no es válido.",
      "ARCA_NOTE_AMOUNT_INVALID",
    );
  }
}

function fiscalEnvironment(
  environment: BillingFiscalEnvironment,
): ArcaEnvironment {
  switch (environment) {
    case "HOMOLOGACION":
    case "PRODUCCION":
      return environment;
    case "MODO_PRUEBA":
      throw noteError(
        "La factura asociada no pertenece a homologación ni a producción.",
        "ARCA_ASSOCIATED_INVOICE_ENVIRONMENT",
      );
    default: {
      const unexpected: never = environment;
      throw unexpected;
    }
  }
}

function associatedPointOfSale(pointOfSale: string): number {
  const trimmed = pointOfSale.trim();

  if (!trimmed) {
    throw noteError(
      "La factura asociada no tiene punto de venta fiscal.",
      "ARCA_ASSOCIATED_POINT_OF_SALE_REQUIRED",
    );
  }

  try {
    return parseArcaPointOfSale(trimmed);
  } catch {
    throw noteError(
      "La factura asociada no tiene punto de venta fiscal.",
      "ARCA_ASSOCIATED_POINT_OF_SALE_REQUIRED",
    );
  }
}

export function buildArcaNoteCaeRequest(
  input: ArcaBillingNoteIntent,
): ArcaCaeFiscalRequest {
  if (!Number.isSafeInteger(input.voucherNumber) || input.voucherNumber <= 0) {
    throw noteError(
      "El número de comprobante de la nota no es válido.",
      "ARCA_NOTE_VOUCHER_NUMBER_INVALID",
    );
  }

  assertWholeCents(input.amountCents);
  assertWholeCents(input.netAmountCents);
  assertWholeCents(input.ivaAmountCents);

  if (
    input.amountCents <= 0 ||
    input.netAmountCents < 0 ||
    input.ivaAmountCents < 0
  ) {
    throw noteError(
      "El importe de la nota no es válido.",
      "ARCA_NOTE_AMOUNT_INVALID",
    );
  }

  if (input.netAmountCents + input.ivaAmountCents !== input.amountCents) {
    throw noteError(
      "Los importes fiscales de la nota no cierran.",
      "ARCA_NOTE_AMOUNTS_MISMATCH",
    );
  }

  const invoice = input.associatedInvoice;

  if (invoice.fiscalStatus !== "AUTORIZADA") {
    throw noteError(
      "La factura asociada no está autorizada.",
      "ARCA_ASSOCIATED_INVOICE_NOT_AUTHORIZED",
    );
  }

  if (!invoice.cae?.trim()) {
    throw noteError(
      "La factura asociada no tiene CAE.",
      "ARCA_ASSOCIATED_INVOICE_WITHOUT_CAE",
    );
  }

  if (input.environment !== invoice.environment) {
    throw noteError(
      "El ambiente de la nota no coincide con el de la factura.",
      "ARCA_NOTE_ENVIRONMENT_MISMATCH",
    );
  }

  const environment = fiscalEnvironment(invoice.environment);

  if (input.invoiceType !== invoice.invoiceType) {
    throw noteError(
      "La letra de la nota no coincide con la de la factura.",
      "ARCA_NOTE_INVOICE_TYPE_MISMATCH",
    );
  }

  const pointOfSale = associatedPointOfSale(invoice.pointOfSale);

  if (!Number.isSafeInteger(invoice.sequenceNumber) || invoice.sequenceNumber <= 0) {
    throw noteError(
      "La factura asociada no tiene número fiscal.",
      "ARCA_ASSOCIATED_SEQUENCE_REQUIRED",
    );
  }

  const profile = resolveArcaFiscalProfile(
    input.receptor.identificationType,
    input.receptor.ivaCondition,
  );

  if (input.invoiceType !== profile.voucherClass) {
    throw new ArcaInvoiceAdapterError(
      "La letra del comprobante no coincide con la condición de IVA del cliente.",
      "ARCA_INVOICE_TYPE_MISMATCH",
    );
  }

  const vatRateId = arcaVatRateId(input.ivaPercent);

  if (vatRateId === null) {
    throw new ArcaInvoiceAdapterError(
      "La alícuota de IVA no tiene un mapeo vigente.",
      "ARCA_UNSUPPORTED_VAT_RATE",
    );
  }

  const issuerCuit = normalizeIssuerCuit(input.issuerCuit);
  const netAmount = pesosFromCents(input.netAmountCents);
  const vatAmount = pesosFromCents(input.ivaAmountCents);
  const totalAmount = pesosFromCents(input.amountCents);

  return {
    environment,
    issuerCuit,
    pointOfSale,
    voucherType: voucherTypeForBillingNote(input.kind, input.invoiceType),
    concept: ARCA_CONCEPT_PRODUCTS,
    documentType: profile.documentType,
    documentNumber: receptorDocumentNumber(input),
    voucherFrom: input.voucherNumber,
    voucherTo: input.voucherNumber,
    voucherDate: formatArcaVoucherDate(input.issuedAt),
    totalAmount,
    nonTaxedAmount: 0,
    netAmount,
    exemptAmount: 0,
    taxAmount: 0,
    vatAmount,
    currencyId: ARCA_CURRENCY_ID,
    currencyRate: ARCA_CURRENCY_RATE,
    receiverVatConditionId: profile.receptorVatConditionId,
    vatBreakdown: [
      {
        id: vatRateId,
        baseAmount: netAmount,
        amount: vatAmount,
      },
    ],
    associatedVouchers: [
      {
        type: voucherTypeForClass(invoice.invoiceType),
        pointOfSale,
        number: invoice.sequenceNumber,
        issuerCuit,
        issuedAt: formatArcaVoucherDate(invoice.issuedAt),
      },
    ],
  };
}
