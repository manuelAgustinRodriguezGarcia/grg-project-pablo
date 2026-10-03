import "server-only";
import type {
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingPaymentMethod,
  BillingPaymentStatus,
} from "@/generated/prisma/client";
import { ArcaEmissionError } from "@/server/arca/errors/arca-emission.error";
import { formatArcaVoucherDate } from "@/server/arca/adapters/billing-invoice-to-cae";
import { normalizeIdentificationDigits } from "@/shared/utils/identification";

export type ArcaBillingPayloadInput = {
  issuedAt: string;
  pointOfSale: number;
  invoiceType: BillingInvoiceType;
  client: {
    id: string;
    code: string;
    name: string;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    email?: string | null;
    whatsapp?: string | null;
    identificationType: BillingIdentificationType;
    identificationNumber?: string | null;
    ivaCondition: BillingIvaCondition;
  };
  items: Array<{
    rubroId?: string | null;
    rubroCode: string;
    rubroName: string;
    description: string;
    quantity: number | string;
    unitPriceCents: number;
    lineTotalCents: number;
    sortOrder: number;
  }>;
  financial: {
    subtotalCents: number;
    discountPercent: number | string;
    discountAmountCents: number;
    ivaPercent: number | string;
    ivaAmountCents: number;
    totalCents: number;
    totalVisualRoundedCents: number;
    netCents: number;
    nonTaxedCents: number;
    exemptCents: number;
    taxCents: number;
  };
  paymentMethod: BillingPaymentMethod;
  paymentStatus: BillingPaymentStatus;
  notes?: string | null;
};

export type ArcaBillingPersistenceSnapshot = {
  issuedAt: string;
  pointOfSale: number;
  invoiceType: BillingInvoiceType;
  client: {
    id: string;
    code: string;
    name: string;
    address: string | null;
    city: string | null;
    province: string | null;
    email: string | null;
    whatsapp: string | null;
    identificationType: BillingIdentificationType;
    identificationNumber: string | null;
    ivaCondition: BillingIvaCondition;
  };
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
  financial: {
    subtotalCents: number;
    discountPercent: string;
    discountAmountCents: number;
    ivaPercent: string;
    ivaAmountCents: number;
    totalCents: number;
    totalVisualRoundedCents: number;
    netCents: number;
    nonTaxedCents: number;
    exemptCents: number;
    taxCents: number;
  };
  paymentMethod: BillingPaymentMethod;
  paymentStatus: BillingPaymentStatus;
  notes: string | null;
};

function invalid(message: string): Error {
  return new Error(message);
}

function requiredText(value: string, message: string): string {
  const text = value.trim();

  if (!text) {
    throw invalid(message);
  }

  return text;
}

function optionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const text = value.trim();
  return text.length > 0 ? text : null;
}

export function canonicalScaled(
  value: number | string,
  scale: number,
  message: string,
): string {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric) || numeric < 0) {
    throw invalid(message);
  }

  const factor = 10 ** scale;
  const scaled = Math.round(numeric * factor);

  if (Math.abs(numeric * factor - scaled) > 1e-6) {
    throw invalid(message);
  }

  const whole = Math.trunc(scaled / factor);
  const fraction = String(scaled % factor).padStart(scale, "0");
  return `${whole}.${fraction}`;
}

export function assertCents(value: number, message: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw invalid(message);
  }

  return value;
}

function identificationType(
  value: string,
): BillingIdentificationType {
  switch (value) {
    case "CUIT":
    case "DNI":
    case "NINGUNO":
      return value;
    default:
      throw invalid("El tipo de identificación del snapshot no es válido.");
  }
}

function ivaCondition(value: string): BillingIvaCondition {
  switch (value) {
    case "RESPONSABLE_INSCRIPTO":
    case "RESPONSABLE_NO_INSCRIPTO":
    case "MONOTRIBUTISTA":
    case "CONSUMIDOR_FINAL":
    case "EXENTO":
      return value;
    default:
      throw invalid("La condición de IVA del snapshot no es válida.");
  }
}

function invoiceType(value: string): BillingInvoiceType {
  switch (value) {
    case "A":
    case "B":
      return value;
    default:
      throw invalid("El tipo de factura del snapshot no es válido.");
  }
}

function paymentMethod(value: string): BillingPaymentMethod {
  switch (value) {
    case "CONTADO_EFECTIVO":
    case "CONTADO":
    case "TARJETA":
    case "TRANSFERENCIA":
    case "OTROS":
    case "CUENTA_CORRIENTE":
      return value;
    default:
      throw invalid("El método de pago del snapshot no es válido.");
  }
}

function paymentStatus(value: string): BillingPaymentStatus {
  switch (value) {
    case "IMPAGA":
    case "PARCIALMENTE_PAGA":
    case "PAGA":
    case "ANULADA":
      return value;
    default:
      throw invalid("El estado de pago del snapshot no es válido.");
  }
}

function canonicalDocument(
  type: BillingIdentificationType,
  value: string | null | undefined,
): string | null {
  if (type === "NINGUNO") {
    return null;
  }

  const digits = normalizeIdentificationDigits(value ?? "");
  return digits.length > 0 ? digits : null;
}

export function canonicalizeBillingPayload(
  input: ArcaBillingPayloadInput,
): ArcaBillingPersistenceSnapshot {
  const issuedAtDate = new Date(input.issuedAt);

  if (Number.isNaN(issuedAtDate.getTime())) {
    throw invalid("La fecha de emisión del snapshot no es válida.");
  }

  if (!Number.isSafeInteger(input.pointOfSale) || input.pointOfSale < 1) {
    throw invalid("El punto de venta del snapshot no es válido.");
  }

  if (input.items.length === 0) {
    throw invalid("La factura necesita al menos un ítem.");
  }

  const type = invoiceType(input.invoiceType);
  const clientType = identificationType(input.client.identificationType);

  return {
    issuedAt: issuedAtDate.toISOString(),
    pointOfSale: input.pointOfSale,
    invoiceType: type,
    client: {
      id: requiredText(input.client.id, "El cliente del snapshot no es válido."),
      code: requiredText(input.client.code, "El código de cliente del snapshot no es válido."),
      name: requiredText(input.client.name, "El nombre de cliente del snapshot no es válido."),
      address: optionalText(input.client.address),
      city: optionalText(input.client.city),
      province: optionalText(input.client.province),
      email: optionalText(input.client.email),
      whatsapp: optionalText(input.client.whatsapp),
      identificationType: clientType,
      identificationNumber: canonicalDocument(
        clientType,
        input.client.identificationNumber,
      ),
      ivaCondition: ivaCondition(input.client.ivaCondition),
    },
    items: input.items.map((item) => ({
      rubroId: optionalText(item.rubroId),
      rubroCode: requiredText(item.rubroCode, "El código de rubro del snapshot no es válido."),
      rubroName: requiredText(item.rubroName, "El nombre de rubro del snapshot no es válido."),
      description: requiredText(item.description, "La descripción del ítem no es válida."),
      quantity: canonicalScaled(item.quantity, 2, "La cantidad del ítem no es válida."),
      unitPriceCents: assertCents(item.unitPriceCents, "El precio del ítem no es válido."),
      lineTotalCents: assertCents(item.lineTotalCents, "El total del ítem no es válido."),
      sortOrder: assertCents(item.sortOrder, "El orden del ítem no es válido."),
    })),
    financial: {
      subtotalCents: assertCents(input.financial.subtotalCents, "El subtotal no es válido."),
      discountPercent: canonicalScaled(
        input.financial.discountPercent,
        2,
        "El porcentaje de descuento no es válido.",
      ),
      discountAmountCents: assertCents(
        input.financial.discountAmountCents,
        "El importe de descuento no es válido.",
      ),
      ivaPercent: canonicalScaled(
        input.financial.ivaPercent,
        2,
        "La alícuota de IVA no es válida.",
      ),
      ivaAmountCents: assertCents(input.financial.ivaAmountCents, "El IVA no es válido."),
      totalCents: assertCents(input.financial.totalCents, "El total no es válido."),
      totalVisualRoundedCents: assertCents(
        input.financial.totalVisualRoundedCents,
        "El total visual no es válido.",
      ),
      netCents: assertCents(input.financial.netCents, "El neto fiscal no es válido."),
      nonTaxedCents: assertCents(
        input.financial.nonTaxedCents,
        "El importe no gravado no es válido.",
      ),
      exemptCents: assertCents(input.financial.exemptCents, "El importe exento no es válido."),
      taxCents: assertCents(input.financial.taxCents, "Los tributos no son válidos."),
    },
    paymentMethod: paymentMethod(input.paymentMethod),
    paymentStatus: paymentStatus(input.paymentStatus),
    notes: optionalText(input.notes),
  };
}

export function parseBillingPayloadSnapshot(
  value: unknown,
): ArcaBillingPersistenceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  try {
    return canonicalizeBillingPayload(value as ArcaBillingPayloadInput);
  } catch {
    return null;
  }
}

function mismatch(message: string): ArcaEmissionError {
  return new ArcaEmissionError(message, "ARCA_EMISSION_SNAPSHOT_MISMATCH");
}

export function assertBillingMatchesIssue(input: {
  pointOfSale: number;
  invoiceType: BillingInvoiceType;
  voucherDate: Date | string;
  ivaPercent: number;
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
  billing: ArcaBillingPersistenceSnapshot;
}): void {
  const billing = input.billing;
  const fiscalDate = formatArcaVoucherDate(input.voucherDate);
  const issuedDate = formatArcaVoucherDate(new Date(billing.issuedAt));

  if (issuedDate !== fiscalDate) {
    throw mismatch("La fecha de emisión no coincide con la fecha fiscal.");
  }

  if (
    billing.pointOfSale !== input.pointOfSale ||
    billing.invoiceType !== input.invoiceType
  ) {
    throw mismatch("El punto de venta o el tipo de factura no coinciden.");
  }

  if (billing.financial.ivaPercent !== canonicalScaled(input.ivaPercent, 2, "La alícuota de IVA no es válida.")) {
    throw mismatch("La alícuota de IVA no coincide.");
  }

  const financial = billing.financial;
  const totals = input.totals;

  if (
    financial.netCents !== totals.netCents ||
    financial.ivaAmountCents !== totals.vatCents ||
    financial.totalCents !== totals.totalCents ||
    financial.nonTaxedCents !== totals.nonTaxedCents ||
    financial.exemptCents !== totals.exemptCents ||
    financial.taxCents !== totals.taxCents
  ) {
    throw mismatch("Los importes fiscales no coinciden con el snapshot comercial.");
  }

  const document = canonicalDocument(
    input.client.identificationType,
    input.client.identificationNumber,
  );

  if (
    billing.client.identificationType !== input.client.identificationType ||
    billing.client.identificationNumber !== document ||
    billing.client.ivaCondition !== input.client.ivaCondition
  ) {
    throw mismatch("El cliente fiscal no coincide con el snapshot comercial.");
  }
}
