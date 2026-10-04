import "server-only";
import type {
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
} from "@/generated/prisma/client";
import { ArcaInvoiceAdapterError } from "@/server/arca/errors/arca-invoice-adapter.error";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import type { ArcaCaeRequest } from "@/server/arca/wsfe/wsfe.types";
import {
  ARCA_CONCEPT_PRODUCTS,
  ARCA_CURRENCY_ID,
  ARCA_CURRENCY_RATE,
  arcaVatRateId,
  resolveArcaFiscalProfile,
} from "@/shared/fiscal/arca-fiscal-mapping";
import { centsToPesos } from "@/shared/utils/billing-invoice-totals";
import {
  isValidCuit,
  isValidDni,
  normalizeIdentificationDigits,
} from "@/shared/utils/identification";

const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * Cuerpo fiscal de ArcaCaeRequest. El ticket de acceso lo agrega el
 * orchestrator: este adapter no lo obtiene.
 */
export type ArcaCaeFiscalRequest = Omit<ArcaCaeRequest, "accessTicket">;

export type ArcaBillingInvoiceInput = {
  environment: ArcaEnvironment | "MODO_PRUEBA";
  issuerCuit: string;
  pointOfSale: number;
  voucherNumber: number;
  voucherDate: Date | string;
  client: {
    identificationType: BillingIdentificationType;
    identificationNumber?: string | null;
    ivaCondition: BillingIvaCondition;
  };
  invoiceType: BillingInvoiceType;
  totals: {
    netCents: number;
    vatCents: number;
    totalCents: number;
    nonTaxedCents: number;
    exemptCents: number;
    taxCents: number;
    /** No se envía a ARCA. Existe para que el llamador no lo confunda con el total fiscal. */
    totalVisualRoundedCents?: number;
  };
  ivaPercent: number;
};

function documentRequired(message: string): ArcaInvoiceAdapterError {
  return new ArcaInvoiceAdapterError(message, "ARCA_DOCUMENT_REQUIRED");
}

function receptorDocumentNumber(input: ArcaBillingInvoiceInput): number {
  switch (input.client.identificationType) {
    case "NINGUNO":
      return 0;
    case "CUIT":
      return requiredDocumentNumber(
        input.client.identificationNumber,
        "El CUIT del cliente es obligatorio.",
        "El CUIT del cliente no es válido.",
        isValidCuit,
      );
    case "DNI":
      return requiredDocumentNumber(
        input.client.identificationNumber,
        "El DNI del cliente es obligatorio.",
        "El DNI del cliente no es válido.",
        isValidDni,
      );
    default: {
      const unexpected: never = input.client.identificationType;
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

function calendarStamp(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  if (!valid) {
    throw new Error("La fecha del comprobante no es válida.");
  }

  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return `${year}${monthText}${dayText}`;
}

export function formatArcaVoucherDate(value: Date | string): string {
  if (typeof value === "string") {
    const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    if (compact) {
      return calendarStamp(Number(compact[1]), Number(compact[2]), Number(compact[3]));
    }

    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (iso) {
      return calendarStamp(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    }

    if (value.includes("T")) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return formatArcaVoucherDate(parsed);
      }
    }

    throw new Error("La fecha del comprobante no es válida.");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return calendarStamp(year, month, day);
}

function pesosFromCents(cents: number): number {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error("Los importes fiscales deben estar en centavos enteros.");
  }

  return centsToPesos(cents);
}

export function buildArcaCaeRequest(
  input: ArcaBillingInvoiceInput,
): ArcaCaeFiscalRequest {
  const profile = resolveArcaFiscalProfile(
    input.client.identificationType,
    input.client.ivaCondition,
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

  const netAmount = pesosFromCents(input.totals.netCents);
  const vatAmount = pesosFromCents(input.totals.vatCents);
  const totalAmount = pesosFromCents(input.totals.totalCents);
  const nonTaxedAmount = pesosFromCents(input.totals.nonTaxedCents);
  const exemptAmount = pesosFromCents(input.totals.exemptCents);
  const taxAmount = pesosFromCents(input.totals.taxCents);
  const summedCents =
    input.totals.netCents +
    input.totals.vatCents +
    input.totals.nonTaxedCents +
    input.totals.exemptCents +
    input.totals.taxCents;

  if (summedCents !== input.totals.totalCents) {
    throw new Error("Los importes fiscales no cierran.");
  }

  return {
    environment: input.environment,
    issuerCuit: normalizeIssuerCuit(input.issuerCuit),
    pointOfSale: input.pointOfSale,
    voucherType: profile.voucherType,
    concept: ARCA_CONCEPT_PRODUCTS,
    documentType: profile.documentType,
    documentNumber: receptorDocumentNumber(input),
    voucherFrom: input.voucherNumber,
    voucherTo: input.voucherNumber,
    voucherDate: formatArcaVoucherDate(input.voucherDate),
    totalAmount,
    nonTaxedAmount,
    netAmount,
    exemptAmount,
    taxAmount,
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
  };
}
