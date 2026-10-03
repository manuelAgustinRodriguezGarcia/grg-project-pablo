import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import {
  FISCAL_ISSUER_CUIT_NOT_CONFIGURED,
  resolveLiveIssuerCuit,
} from "./wsfe-live-issuer";

export const PRODUCTION_WSFE_ENVIRONMENT = "PRODUCCION" as const;
export const FACTURA_A_VOUCHER_TYPE = 1;
export const FACTURA_B_VOUCHER_TYPE = 6;

export const FISCAL_POINT_OF_SALE_NOT_CONFIGURED =
  "BillingFiscalSettings.pointOfSale no está configurado correctamente.";

const ENDPOINT_ERROR = [
  "ARCA WSFE PRODUCCION ERROR",
  "code: ENDPOINT",
  "message: El endpoint WSFE no es el de producción.",
].join("\n");

export type ProductionFiscalSettings = {
  issuerCuit: string | null | undefined;
  pointOfSale: string | null | undefined;
} | null | undefined;

export type ProductionWsfeReadOnlyResult = {
  pointOfSale: number;
  maxRecordsPerRequest: number;
  lastFacturaA: number;
  lastFacturaB: number;
};

type ProductionTicketReader = (
  environment: typeof PRODUCTION_WSFE_ENVIRONMENT,
) => Promise<ArcaAccessTicket>;

type ProductionMaxRecordsReader = (input: {
  environment: typeof PRODUCTION_WSFE_ENVIRONMENT;
  accessTicket: ArcaAccessTicket;
  issuerCuit: string;
}) => Promise<{ maxRecords: number }>;

type ProductionLastAuthorizedReader = (input: {
  environment: typeof PRODUCTION_WSFE_ENVIRONMENT;
  accessTicket: ArcaAccessTicket;
  issuerCuit: string;
  pointOfSale: number;
  voucherType: number;
}) => Promise<{
  pointOfSale: number;
  voucherType: number;
  lastNumber: number;
}>;

export type ProductionWsfeReadOnlyDependencies = {
  getAccessTicket: ProductionTicketReader;
  getMaxRecordsPerRequest: ProductionMaxRecordsReader;
  getLastAuthorizedVoucher: ProductionLastAuthorizedReader;
};

/** Compara el endpoint configurado. No abre red. */
export function assertProductionWsfeEndpoint(): void {
  const production = resolveArcaEndpoints(PRODUCTION_WSFE_ENVIRONMENT);
  const homologacion = resolveArcaEndpoints("HOMOLOGACION");

  if (
    production.service !== "wsfe" ||
    production.wsfeUrl === homologacion.wsfeUrl ||
    production.wsfeUrl.toLowerCase().includes("homo")
  ) {
    throw new Error(ENDPOINT_ERROR);
  }
}

function requireDiscoveredLastNumber(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      [
        "ARCA WSFE PRODUCCION ERROR",
        "code: LAST_NUMBER",
        "message: El último comprobante autorizado no es válido.",
      ].join("\n"),
    );
  }

  return value;
}

function readPointOfSale(pointOfSale: string | null | undefined): number {
  if (!pointOfSale?.trim()) {
    throw new Error(FISCAL_POINT_OF_SALE_NOT_CONFIGURED);
  }

  try {
    return parseArcaPointOfSale(pointOfSale);
  } catch {
    throw new Error(FISCAL_POINT_OF_SALE_NOT_CONFIGURED);
  }
}

function assertProductionTicket(accessTicket: ArcaAccessTicket): void {
  if (
    accessTicket.environment !== PRODUCTION_WSFE_ENVIRONMENT ||
    accessTicket.service !== "wsfe" ||
    !accessTicket.token.trim() ||
    !accessTicket.sign.trim()
  ) {
    throw new Error(
      [
        "ARCA WSFE PRODUCCION ERROR",
        "code: INVALID_TICKET",
        "message: El ticket no corresponde a producción wsfe.",
      ].join("\n"),
    );
  }
}

/**
 * Consulta FECompTotXRequest y FECompUltimoAutorizado en producción.
 * No emite, no persiste facturas y no fija el último número esperado.
 */
export async function runProductionWsfeReadOnly(
  settings: ProductionFiscalSettings,
  dependencies: ProductionWsfeReadOnlyDependencies,
): Promise<ProductionWsfeReadOnlyResult> {
  assertProductionWsfeEndpoint();

  let issuerCuit: string;

  try {
    issuerCuit = resolveLiveIssuerCuit(settings);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === FISCAL_ISSUER_CUIT_NOT_CONFIGURED
    ) {
      throw error;
    }

    throw new Error(FISCAL_ISSUER_CUIT_NOT_CONFIGURED);
  }

  const pointOfSale = readPointOfSale(settings?.pointOfSale);
  const accessTicket = await dependencies.getAccessTicket(
    PRODUCTION_WSFE_ENVIRONMENT,
  );
  assertProductionTicket(accessTicket);

  const maxRecords = await dependencies.getMaxRecordsPerRequest({
    environment: PRODUCTION_WSFE_ENVIRONMENT,
    accessTicket,
    issuerCuit,
  });

  if (!Number.isSafeInteger(maxRecords.maxRecords) || maxRecords.maxRecords < 1) {
    throw new Error(
      [
        "ARCA WSFE PRODUCCION ERROR",
        "code: MAX_RECORDS",
        "message: FECompTotXRequest no devolvió un máximo válido.",
      ].join("\n"),
    );
  }

  const lastFacturaA = await dependencies.getLastAuthorizedVoucher({
    environment: PRODUCTION_WSFE_ENVIRONMENT,
    accessTicket,
    issuerCuit,
    pointOfSale,
    voucherType: FACTURA_A_VOUCHER_TYPE,
  });
  const lastFacturaB = await dependencies.getLastAuthorizedVoucher({
    environment: PRODUCTION_WSFE_ENVIRONMENT,
    accessTicket,
    issuerCuit,
    pointOfSale,
    voucherType: FACTURA_B_VOUCHER_TYPE,
  });

  if (
    lastFacturaA.pointOfSale !== pointOfSale ||
    lastFacturaA.voucherType !== FACTURA_A_VOUCHER_TYPE ||
    lastFacturaB.pointOfSale !== pointOfSale ||
    lastFacturaB.voucherType !== FACTURA_B_VOUCHER_TYPE
  ) {
    throw new Error(
      [
        "ARCA WSFE PRODUCCION ERROR",
        "code: INVALID_RESPONSE",
        "message: La respuesta no coincide con la consulta.",
      ].join("\n"),
    );
  }

  return {
    pointOfSale,
    maxRecordsPerRequest: maxRecords.maxRecords,
    lastFacturaA: requireDiscoveredLastNumber(lastFacturaA.lastNumber),
    lastFacturaB: requireDiscoveredLastNumber(lastFacturaB.lastNumber),
  };
}
