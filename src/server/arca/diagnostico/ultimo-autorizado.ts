import "server-only";
import { prisma } from "@/server/database/prisma";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import { getValidArcaAccessTicket } from "@/server/arca/tickets/access-ticket";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import { getLastAuthorizedVoucher } from "@/server/arca/wsfe/wsfe-client";
import type { ArcaWsfeEvent } from "@/server/arca/wsfe/wsfe.types";
import { BILLING_FISCAL_SETTINGS_ID } from "@/server/repositories/billing-fiscal-settings.repository";

const PRODUCTION = "PRODUCCION";
const FACTURA_A_VOUCHER_TYPE = 1;
const EXPECTED_POINT_OF_SALE = 7;

type DiagnosticRuntime = {
  nodeVersion: string;
  opensslVersion: string;
  vercelRegion?: string;
};

export type ProductionLastAuthorizedProbe =
  | ({
      ok: true;
      environment: typeof PRODUCTION;
      pointOfSale: typeof EXPECTED_POINT_OF_SALE;
      voucherType: typeof FACTURA_A_VOUCHER_TYPE;
      lastAuthorizedNumber: number;
      events?: Array<{ code: string; message: string }>;
    } & DiagnosticRuntime)
  | {
      ok: false;
      code: string;
      error: string;
    };

function diagnosticRuntime(): DiagnosticRuntime {
  const region = process.env.VERCEL_REGION;
  return {
    nodeVersion: process.version,
    opensslVersion: process.versions.openssl ?? "",
    ...(typeof region === "string" && /^[a-z]{3}\d$/.test(region)
      ? { vercelRegion: region }
      : {}),
  };
}

function configurationMismatch(): ProductionLastAuthorizedProbe {
  return {
    ok: false,
    code: "FISCAL_CONFIGURATION_MISMATCH",
    error: "La configuración fiscal no corresponde a producción, punto de venta 0007.",
  };
}

function redact(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim().slice(0, 200);
  if (
    !cleaned ||
    /token|sign|certificate|private key|BEGIN |\d{11}/i.test(cleaned)
  ) {
    return "No se pudo consultar el último comprobante autorizado.";
  }

  return cleaned;
}

function failure(error: unknown): ProductionLastAuthorizedProbe {
  if (
    error instanceof ArcaWsfeError ||
    error instanceof ArcaWsaaError ||
    error instanceof ArcaConfigurationError ||
    error instanceof ArcaTicketCacheError
  ) {
    return {
      ok: false,
      code: error.code,
      error: redact(error.message),
    };
  }

  return {
    ok: false,
    code: "UNEXPECTED",
    error: "No se pudo consultar el último comprobante autorizado.",
  };
}

function safeEvents(
  events: readonly ArcaWsfeEvent[],
): Array<{ code: string; message: string }> | undefined {
  const safe = events.flatMap((event) => {
    const code = event.code.trim();
    const message = event.message.trim();
    if (
      !/^[A-Za-z0-9 ._-]{1,32}$/.test(code) ||
      !/^[A-Za-z0-9 ._-]{1,120}$/.test(message) ||
      /token|sign|certificate|private key|BEGIN |\d{11}/i.test(`${code} ${message}`)
    ) {
      return [];
    }

    return [{ code, message }];
  });

  return safe.length > 0 ? safe : undefined;
}

export async function probeProductionLastAuthorizedFacturaA(): Promise<ProductionLastAuthorizedProbe> {
  const settings = await prisma.billingFiscalSettings.findUnique({
    where: { id: BILLING_FISCAL_SETTINGS_ID },
    select: {
      environment: true,
      pointOfSale: true,
      issuerCuit: true,
    },
  });

  if (!settings || settings.environment !== PRODUCTION) {
    return configurationMismatch();
  }

  let pointOfSale: number;
  try {
    pointOfSale = parseArcaPointOfSale(settings.pointOfSale);
  } catch (error) {
    return failure(error);
  }

  if (pointOfSale !== EXPECTED_POINT_OF_SALE) {
    return configurationMismatch();
  }

  try {
    const issuerCuit = normalizeIssuerCuit(settings.issuerCuit);
    const accessTicket = await getValidArcaAccessTicket(PRODUCTION);
    const last = await getLastAuthorizedVoucher({
      environment: PRODUCTION,
      accessTicket,
      issuerCuit,
      pointOfSale,
      voucherType: FACTURA_A_VOUCHER_TYPE,
    });
    const events = safeEvents(last.events);

    return {
      ok: true,
      environment: PRODUCTION,
      pointOfSale: EXPECTED_POINT_OF_SALE,
      voucherType: FACTURA_A_VOUCHER_TYPE,
      lastAuthorizedNumber: last.lastNumber,
      ...diagnosticRuntime(),
      ...(events ? { events } : {}),
    };
  } catch (error) {
    return failure(error);
  }
}
