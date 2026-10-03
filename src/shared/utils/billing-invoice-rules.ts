import type {
  BillingIdentificationType,
  BillingInvoiceType,
  BillingIvaCondition,
  BillingPaymentMethod,
  BillingPaymentStatus,
} from "@/generated/prisma/client";
import { resolveArcaFiscalProfile } from "@/shared/fiscal/arca-fiscal-mapping";

export const MAX_INVOICE_ITEM_QUANTITY = 99;
export const MAX_INVOICE_ITEM_UNIT_PRICE = 99_999_999;

export const TEST_INVOICE_NUMBER_INFIX = "PRUEBA";
export const TEST_INVOICE_SEQUENCE_DIGITS = 9;

/**
 * Letra interna de la factura.
 * Con CUIT, la letra sale del mapeo ARCA vigente.
 * Sin CUIT sigue siendo B.
 * Responsable No Inscripto no tiene mapeo ARCA: la letra interna sigue en B
 * y la emisión ARCA debe rechazarse con resolveArcaFiscalProfile.
 */
export function determineInvoiceType(
  identificationType: BillingIdentificationType,
  ivaCondition: BillingIvaCondition,
): BillingInvoiceType {
  if (identificationType !== "CUIT" || ivaCondition === "RESPONSABLE_NO_INSCRIPTO") {
    return "B";
  }

  return resolveArcaFiscalProfile(identificationType, ivaCondition).voucherClass;
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

export const FISCAL_INVOICE_POINT_OF_SALE_DIGITS = 4;
export const FISCAL_INVOICE_SEQUENCE_DIGITS = 8;

/**
 * Número visible de un comprobante autorizado.
 * Ejemplo: punto 7 y comprobante 3 → `0007-00000003`.
 * La letra queda en invoiceType.
 */
export function buildFiscalInvoiceNumber(
  pointOfSale: number | string,
  voucherNumber: number,
): string {
  const digits = String(pointOfSale).replace(/\D/g, "");

  if (!digits || digits.length > FISCAL_INVOICE_POINT_OF_SALE_DIGITS) {
    throw new Error("El punto de venta fiscal no es válido.");
  }

  if (!Number.isSafeInteger(voucherNumber) || voucherNumber < 1) {
    throw new Error("El número de comprobante fiscal no es válido.");
  }

  const point = digits.padStart(FISCAL_INVOICE_POINT_OF_SALE_DIGITS, "0");
  const sequence = String(voucherNumber).padStart(
    FISCAL_INVOICE_SEQUENCE_DIGITS,
    "0",
  );
  return `${point}-${sequence}`;
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
