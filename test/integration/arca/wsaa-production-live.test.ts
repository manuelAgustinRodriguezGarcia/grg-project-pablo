import { describe, expect, it } from "vitest";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import { getValidArcaAccessTicket } from "@/server/arca/tickets/access-ticket";
import { ARCA_TICKET_ENCRYPTION_KEY_ENV } from "@/server/arca/tickets/ticket-encryption";
import { loadNextLocalEnv } from "./load-next-env";
import {
  formatProductionWsaaLiveFailure,
  formatProductionWsaaLiveSuccess,
} from "./wsaa-production-live-report";

const LIVE_ENABLED = process.env.ARCA_PROD_WSAA_LIVE_TEST === "1";

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

describe.skipIf(!LIVE_ENABLED)("WSAA producción live", () => {
  it("pide un Ticket de Acceso de producción para wsfe", async () => {
    loadNextLocalEnv();

    const missing = missingCredentialNames();
    if (missing.length > 0) {
      throw new Error(
        `Faltan variables para la prueba live de WSAA producción: ${missing.join(", ")}. No se realizó ninguna llamada de red.`,
      );
    }

    const endpoints = resolveArcaEndpoints("PRODUCCION");
    const homologacion = resolveArcaEndpoints("HOMOLOGACION");
    expect(endpoints.service).toBe("wsfe");
    expect(endpoints.wsaaUrl).not.toBe(homologacion.wsaaUrl);
    expect(endpoints.wsaaUrl.toLowerCase().includes("homo")).toBe(false);

    try {
      const ticket = await getValidArcaAccessTicket("PRODUCCION");

      expect(ticket.environment).toBe("PRODUCCION");
      expect(ticket.service).toBe("wsfe");
      expect(ticket.token.trim().length).toBeGreaterThan(0);
      expect(ticket.sign.trim().length).toBeGreaterThan(0);
      expect(Number.isNaN(ticket.expirationTime.getTime())).toBe(false);
      expect(ticket.expirationTime.getTime()).toBeGreaterThan(Date.now());

      console.log(
        formatProductionWsaaLiveSuccess({
          environment: ticket.environment,
          service: ticket.service,
          expirationTime: ticket.expirationTime,
        }),
      );
    } catch (error) {
      if (isAssertionError(error)) {
        throw error;
      }

      const safe = formatProductionWsaaLiveFailure(error);
      console.log(safe);
      throw new Error(safe);
    }
  });
});
