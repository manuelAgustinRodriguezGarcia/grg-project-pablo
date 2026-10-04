import "server-only";
import type {
  BillingFiscalEnvironment,
  BillingIdentificationType,
  BillingInvoiceFiscalStatus,
  BillingInvoiceType,
  BillingNoteFiscalStatus,
  BillingNoteKind,
} from "@/generated/prisma/client";
import { formatArcaVoucherDate } from "@/server/arca/adapters/billing-invoice-to-cae";
import { ArcaQrError } from "@/server/arca/qr/arca-qr.error";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import {
  ARCA_DOCUMENT_TYPE,
  voucherTypeForBillingNote,
  voucherTypeForClass,
} from "@/shared/fiscal/arca-fiscal-mapping";
import {
  isValidCuit,
  isValidDni,
  normalizeIdentificationDigits,
} from "@/shared/utils/identification";

/**
 * Especificación QR de comprobantes ARCA, versión 1.
 * https://www.arca.gob.ar/fe/qr/?p={Base64 del JSON UTF-8}
 *
 * tipoDocRec y nroDocRec son "de corresponder".
 * Con identificationType NINGUNO no se envían. El comprobante WSFE
 * usa DocTipo 99 y DocNro 0, pero el QR no exige repetir ese par.
 */
export const ARCA_QR_URL_PREFIX = "https://www.arca.gob.ar/fe/qr/?p=";

export type ArcaQrPayload = {
  ver: 1;
  fecha: string;
  cuit: number;
  ptoVta: number;
  tipoCmp: number;
  nroCmp: number;
  importe: number;
  moneda: "PES";
  ctz: 1;
  tipoDocRec?: number;
  nroDocRec?: number;
  tipoCodAut: "E";
  codAut: number;
};

export type ArcaQrSource = {
  environment: BillingFiscalEnvironment;
  fiscalStatus: BillingInvoiceFiscalStatus;
  cae: string | null;
  pointOfSale: string;
  sequenceNumber: number | null;
  invoiceType: BillingInvoiceType;
  /**
   * Tipo WSFE ya conocido. Factura A/B lo omite y sigue resolviendo 1 o 6
   * desde la letra. Una nota autorizada lo informa con su voucherType.
   */
  voucherType?: number;
  total: number;
  issuedAt: Date;
  issuerCuit: string | null;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
};

function incomplete(message: string): ArcaQrError {
  return new ArcaQrError(message);
}

function requireAuthorizedEnvironment(
  environment: BillingFiscalEnvironment,
): "HOMOLOGACION" | "PRODUCCION" {
  switch (environment) {
    case "HOMOLOGACION":
    case "PRODUCCION":
      return environment;
    case "MODO_PRUEBA":
      throw incomplete(
        "El QR fiscal no corresponde a un comprobante de modo prueba.",
      );
    default: {
      const unexpected: never = environment;
      return unexpected;
    }
  }
}

function requireFiscalStatus(status: BillingInvoiceFiscalStatus): void {
  switch (status) {
    case "AUTORIZADA":
      return;
    case "MODO_PRUEBA":
    case "BORRADOR":
    case "PENDIENTE_EMISION":
    case "ENVIANDO_ARCA":
    case "RECHAZADA":
    case "ERROR_TECNICO":
    case "CANCELADA":
    case "AJUSTADA_NC":
    case "AJUSTADA_ND":
    case "ANULADA_NC":
      throw incomplete("El comprobante no está autorizado por ARCA.");
    default: {
      const unexpected: never = status;
      throw unexpected;
    }
  }
}

function requireCae(value: string | null): number {
  const digits = value?.replace(/\D/g, "") ?? "";

  if (!/^\d{14}$/.test(digits)) {
    throw incomplete("El CAE del comprobante no está disponible.");
  }

  const code = Number(digits);

  if (!Number.isSafeInteger(code)) {
    throw incomplete("El CAE del comprobante no está disponible.");
  }

  return code;
}

function fiscalDate(issuedAt: Date): string {
  if (Number.isNaN(issuedAt.getTime())) {
    throw incomplete("La fecha del comprobante no es válida.");
  }

  const compact = formatArcaVoucherDate(issuedAt);

  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function fiscalImporte(total: number): number {
  if (!Number.isFinite(total) || total < 0) {
    throw incomplete("El importe fiscal del comprobante no es válido.");
  }

  const cents = Math.round(total * 100);
  return cents / 100;
}

function issuerCuitNumber(value: string | null): number {
  let digits: string;

  try {
    digits = normalizeIssuerCuit(value);
  } catch {
    throw incomplete("El CUIT del emisor no está configurado.");
  }

  return Number(digits);
}

function pointOfSaleNumber(value: string): number {
  try {
    return parseArcaPointOfSale(value);
  } catch {
    throw incomplete("El punto de venta del comprobante no es válido.");
  }
}

function explicitVoucherType(value: number): number {
  switch (value) {
    case 1:
    case 2:
    case 3:
    case 6:
    case 7:
    case 8:
      return value;
    default:
      throw incomplete("El tipo de comprobante no es válido.");
  }
}

function tipoCmp(source: ArcaQrSource): number {
  if (source.voucherType == null) {
    return voucherTypeForClass(source.invoiceType);
  }

  return explicitVoucherType(source.voucherType);
}

function sequenceNumber(value: number | null): number {
  if (value == null || !Number.isSafeInteger(value) || value < 1) {
    throw incomplete("El número de comprobante no es válido.");
  }

  return value;
}

/**
 * Documento del receptor solo cuando hay CUIT o DNI válido.
 * NINGUNO se omite: no se manda 99 ni 0.
 */
function receptorDocument(
  type: BillingIdentificationType,
  number: string | null,
): { tipoDocRec: number; nroDocRec: number } | null {
  switch (type) {
    case "NINGUNO":
      return null;
    case "CUIT": {
      const digits = normalizeIdentificationDigits(number ?? "");

      if (!isValidCuit(digits)) {
        throw incomplete("El CUIT del receptor no es válido.");
      }

      return {
        tipoDocRec: ARCA_DOCUMENT_TYPE.CUIT,
        nroDocRec: Number(digits),
      };
    }
    case "DNI": {
      const digits = normalizeIdentificationDigits(number ?? "");

      if (!isValidDni(digits)) {
        throw incomplete("El DNI del receptor no es válido.");
      }

      return {
        tipoDocRec: ARCA_DOCUMENT_TYPE.DNI,
        nroDocRec: Number(digits),
      };
    }
    default: {
      const unexpected: never = type;
      return unexpected;
    }
  }
}

export function buildArcaQrPayload(source: ArcaQrSource): ArcaQrPayload {
  requireAuthorizedEnvironment(source.environment);
  requireFiscalStatus(source.fiscalStatus);

  const receptor = receptorDocument(
    source.clientIdentificationType,
    source.clientIdentificationNumber,
  );

  return {
    ver: 1,
    fecha: fiscalDate(source.issuedAt),
    cuit: issuerCuitNumber(source.issuerCuit),
    ptoVta: pointOfSaleNumber(source.pointOfSale),
    tipoCmp: tipoCmp(source),
    nroCmp: sequenceNumber(source.sequenceNumber),
    importe: fiscalImporte(source.total),
    moneda: "PES",
    ctz: 1,
    ...(receptor ?? {}),
    tipoCodAut: "E",
    codAut: requireCae(source.cae),
  };
}

export type ArcaNoteQrSource = {
  fiscalStatus: BillingNoteFiscalStatus;
  environment: BillingFiscalEnvironment;
  kind: BillingNoteKind;
  invoiceType: BillingInvoiceType;
  voucherType: number | null;
  cae: string | null;
  pointOfSale: string;
  sequenceNumber: number | null;
  amount: number;
  issuedAt: Date;
  issuerCuit: string | null;
  clientIdentificationType: BillingIdentificationType;
  clientIdentificationNumber: string | null;
};

export function buildArcaNoteQrPayload(source: ArcaNoteQrSource): ArcaQrPayload {
  if (source.fiscalStatus !== "AUTORIZADA") {
    throw incomplete("El QR fiscal no corresponde a una nota interna.");
  }

  const voucherType = voucherTypeForBillingNote(source.kind, source.invoiceType);

  if (source.voucherType !== voucherType) {
    throw incomplete("El tipo de comprobante de la nota no es válido.");
  }

  return buildArcaQrPayload({
    environment: source.environment,
    fiscalStatus: "AUTORIZADA",
    cae: source.cae,
    pointOfSale: source.pointOfSale,
    sequenceNumber: source.sequenceNumber,
    invoiceType: source.invoiceType,
    voucherType,
    total: source.amount,
    issuedAt: source.issuedAt,
    issuerCuit: source.issuerCuit,
    clientIdentificationType: source.clientIdentificationType,
    clientIdentificationNumber: source.clientIdentificationNumber,
  });
}

export function buildArcaNoteQrUrl(source: ArcaNoteQrSource): string {
  const json = JSON.stringify(buildArcaNoteQrPayload(source));
  const encoded = Buffer.from(json, "utf8").toString("base64");

  return `${ARCA_QR_URL_PREFIX}${encoded}`;
}

export function buildArcaQrUrl(source: ArcaQrSource): string {
  const json = JSON.stringify(buildArcaQrPayload(source));
  const encoded = Buffer.from(json, "utf8").toString("base64");

  return `${ARCA_QR_URL_PREFIX}${encoded}`;
}

export function decodeArcaQrUrl(url: string): ArcaQrPayload {
  if (!url.startsWith(ARCA_QR_URL_PREFIX)) {
    throw incomplete("La URL del QR fiscal no es válida.");
  }

  const encoded = url.slice(ARCA_QR_URL_PREFIX.length);
  const json = Buffer.from(encoded, "base64").toString("utf8");
  return JSON.parse(json) as ArcaQrPayload;
}
