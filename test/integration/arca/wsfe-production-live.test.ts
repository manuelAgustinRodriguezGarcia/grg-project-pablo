import { describe, expect, it } from "vitest";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import { getValidArcaAccessTicket } from "@/server/arca/tickets/access-ticket";
import { ARCA_TICKET_ENCRYPTION_KEY_ENV } from "@/server/arca/tickets/ticket-encryption";
import {
  getLastAuthorizedVoucher,
  getMaxRecordsPerRequest,
} from "@/server/arca/wsfe/wsfe-client";
import { loadNextLocalEnv } from "./load-next-env";
import {
  assertProductionWsfeEndpoint,
  runProductionWsfeReadOnly,
} from "./wsfe-production-live-flow";
import {
  formatProductionWsfeReadOnlyFailure,
  formatProductionWsfeReadOnlySuccess,
} from "./wsfe-production-live-report";

const LIVE_ENABLED = process.env.ARCA_PROD_WSFE_LIVE_TEST === "1";

const REQUIRED_ENV = [
  "ARCA_PROD_CERT_B64",
  "ARCA_PROD_PRIVATE_KEY_B64",
  ARCA_TICKET_ENCRYPTION_KEY_ENV,
  "DATABASE_URL",
] as const;

function missingCredentialNames(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
}

function isAssertionError(error: unknown): error is Error {
  return error instanceof Error && error.name === "AssertionError";
}

/**
 * Import diferido: Prisma abre el pool al cargar el módulo.
 * Con la flag apagada el test se salta y esta función no corre.
 */
async function readFiscalIssuer(): Promise<{
  issuerCuit: string | null;
  pointOfSale: string;
} | null> {
  const { BILLING_FISCAL_SETTINGS_ID } = await import(
    "@/server/repositories/billing-fiscal-settings.repository"
  );
  const { prisma } = await import("@/server/database/prisma");

  try {
    return await prisma.billingFiscalSettings.findUnique({
      where: { id: BILLING_FISCAL_SETTINGS_ID },
      select: { issuerCuit: true, pointOfSale: true },
    });
  } catch {
    throw new Error(
      "No se pudo leer BillingFiscalSettings. No se realizó ninguna llamada de red.",
    );
  }
}

describe.skipIf(!LIVE_ENABLED)("WSFE producción read only", () => {
  it("consulta el máximo por request y el último autorizado de Factura A y B", async () => {
    loadNextLocalEnv();

    const missing = missingCredentialNames();
    if (missing.length > 0) {
      throw new Error(
        `Faltan variables para la prueba live de WSFE producción: ${missing.join(", ")}. No se realizó ninguna llamada de red.`,
      );
    }

    const endpoints = resolveArcaEndpoints("PRODUCCION");
    const homologacion = resolveArcaEndpoints("HOMOLOGACION");
    expect(endpoints.service).toBe("wsfe");
    expect(endpoints.wsfeUrl).not.toBe(homologacion.wsfeUrl);
    expect(endpoints.wsfeUrl.toLowerCase().includes("homo")).toBe(false);
    assertProductionWsfeEndpoint();

    const settings = await readFiscalIssuer();

    try {
      const result = await runProductionWsfeReadOnly(settings, {
        getAccessTicket: (environment) => getValidArcaAccessTicket(environment),
        getMaxRecordsPerRequest,
        getLastAuthorizedVoucher,
      });

      console.log(formatProductionWsfeReadOnlySuccess(result));
    } catch (error) {
      if (isAssertionError(error)) {
        throw error;
      }

      const safe = formatProductionWsfeReadOnlyFailure(error);
      console.log(safe);
      throw new Error(safe);
    }
  });
});
