import "server-only";
import { createHash } from "node:crypto";
import type {
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
} from "@/generated/prisma/client";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import {
  ARCA_CONCEPT_PRODUCTS,
  ARCA_CURRENCY_ID,
  ARCA_CURRENCY_RATE,
} from "@/shared/fiscal/arca-fiscal-mapping";
import { formatArcaVoucherDate } from "@/server/arca/adapters/billing-invoice-to-cae";
import {
  canonicalizeBillingPayload,
  type ArcaBillingPayloadInput,
  type ArcaBillingPersistenceSnapshot,
} from "@/server/arca/invoices/billing-payload-snapshot";
import { normalizeIdentificationDigits } from "@/shared/utils/identification";

export type ArcaFiscalHashInput = {
  environment: ArcaEnvironment;
  issuerCuit: string;
  pointOfSale: number;
  invoiceType: BillingInvoiceType;
  voucherDate: Date | string;
  client: {
    identificationType: BillingIdentificationType;
    identificationNumber?: string | null;
    ivaCondition: BillingIvaCondition;
  };
  totals: {
    netCents: number;
    vatCents: number;
    totalCents: number;
    nonTaxedCents: number;
    exemptCents: number;
    taxCents: number;
  };
  ivaPercent: number;
  billing: ArcaBillingPayloadInput;
};

function canonicalDocument(
  identificationType: BillingIdentificationType,
  identificationNumber: string | null | undefined,
): string | null {
  if (identificationType === "NINGUNO") {
    return null;
  }

  const digits = normalizeIdentificationDigits(identificationNumber ?? "");
  return digits.length > 0 ? digits : null;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function hashArcaFiscalRequest(input: ArcaFiscalHashInput): string {
  const billing: ArcaBillingPersistenceSnapshot = canonicalizeBillingPayload(
    input.billing,
  );
  const payload = {
    environment: input.environment,
    issuerCuit: normalizeIssuerCuit(input.issuerCuit),
    pointOfSale: input.pointOfSale,
    invoiceType: input.invoiceType,
    voucherDate: formatArcaVoucherDate(input.voucherDate),
    concept: ARCA_CONCEPT_PRODUCTS,
    currencyId: ARCA_CURRENCY_ID,
    currencyRate: ARCA_CURRENCY_RATE,
    client: {
      identificationType: input.client.identificationType,
      identificationNumber: canonicalDocument(
        input.client.identificationType,
        input.client.identificationNumber,
      ),
      ivaCondition: input.client.ivaCondition,
    },
    totals: {
      netCents: input.totals.netCents,
      vatCents: input.totals.vatCents,
      totalCents: input.totals.totalCents,
      nonTaxedCents: input.totals.nonTaxedCents,
      exemptCents: input.totals.exemptCents,
      taxCents: input.totals.taxCents,
    },
    ivaPercent: input.ivaPercent,
    billing,
  };

  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
