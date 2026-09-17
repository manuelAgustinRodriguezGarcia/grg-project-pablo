import type {
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingPaymentMethod,
  BillingPaymentStatus,
} from "@/generated/prisma/client";

export const MAX_INVOICE_ITEM_QUANTITY = 99;
export const MAX_INVOICE_ITEM_UNIT_PRICE = 99_999_999;

export const TEST_INVOICE_NUMBER_INFIX = "PRUEBA";
export const TEST_INVOICE_SEQUENCE_DIGITS = 9;

/**
 * Determina la letra de factura según la matriz del PRD Facturación §11.2.
 * Solo CUIT + Responsable Inscripto genera Factura A; todo el resto es B.
 */
export function determineInvoiceType(
  identificationType: BillingIdentificationType,
  ivaCondition: BillingIvaCondition,
): BillingInvoiceType {
  if (identificationType !== "CUIT") {
    return "B";
  }

  switch (ivaCondition) {
    case "RESPONSABLE_INSCRIPTO":
      return "A";
    case "RESPONSABLE_NO_INSCRIPTO":
    case "MONOTRIBUTISTA":
    case "CONSUMIDOR_FINAL":
    case "EXENTO":
      return "B";
    default: {
      const exhaustiveCheck: never = ivaCondition;
      return exhaustiveCheck;
    }
  }
}

export type GenericClientCheckInput = {
  identificationType: BillingIdentificationType;
  email: string | null;
  whatsapp: string | null;
};

/**
 * Nombre canónico del cliente sin identificación (alta rápida en nueva factura).
 * El servicio lo persiste en mayúsculas.
 */
export const GENERIC_BILLING_CLIENT_NAME = "CLIENTE SIN IDENTIFICACIÓN";

/**
 * Cliente genérico sin datos (PRD Facturación §12.1): sin CUIT, sin DNI,
 * sin email y sin teléfono. Sujeto al límite configurable de facturación.
 */
export function isGenericBillingClient(
  client: GenericClientCheckInput,
): boolean {
  return (
    client.identificationType === "NINGUNO" &&
    !client.email &&
    !client.whatsapp
  );
}

export function isCanonicalGenericBillingClient(
  client: GenericClientCheckInput & { name: string },
): boolean {
  return (
    isGenericBillingClient(client) &&
    client.name === GENERIC_BILLING_CLIENT_NAME
  );
}

/**
 * Numeración interna simulada para modo prueba (PRD Facturación §24.4).
 * Ejemplo: `0007-PRUEBA-000000001`.
 */
export function buildTestInvoiceNumber(
  pointOfSale: string,
  sequenceNumber: number,
): string {
  const sequence = String(sequenceNumber).padStart(
    TEST_INVOICE_SEQUENCE_DIGITS,
    "0",
  );
  return `${pointOfSale}-${TEST_INVOICE_NUMBER_INFIX}-${sequence}`;
}

export function paymentStatusForMethod(
  method: BillingPaymentMethod,
): BillingPaymentStatus {
  return method === "CUENTA_CORRIENTE" ? "IMPAGA" : "PAGA";
}

export function canInvoiceUseOnAccountPayment(
  identificationType: BillingIdentificationType,
): boolean {
  return identificationType !== "NINGUNO";
}
