import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaTicketCacheError } from "@/server/arca/errors/arca-ticket-cache.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import {
  formatProductionWsaaLiveFailure,
  formatProductionWsaaLiveSuccess,
} from "../../../integration/arca/wsaa-production-live-report";

const LIVE_TEST_PATH = path.join(
  process.cwd(),
  "test/integration/arca/wsaa-production-live.test.ts",
);

const SECRET_TOKEN = "token-secreto-no-imprimir";
const SECRET_SIGN = "sign-secreto-no-imprimir";

describe("informe live de WSAA producción", () => {
  it("resume un certificado no autorizado sin SOAP ni secretos", () => {
    const report = formatProductionWsaaLiveFailure(
      new ArcaWsaaError("WSAA rechazó el loginCms.", "SOAP_FAULT", {
        faultCode: "ns1:coe.notAuthorized",
        faultString: `Certificado no autorizado a acceder al servicio ${SECRET_TOKEN}`,
      }),
    );

    expect(report).toContain("code: SOAP_FAULT");
    expect(report).toContain("message: Certificado no autorizado.");
    expect(report).not.toContain(SECRET_TOKEN);
    expect(report).not.toContain("<soap");
  });

  it("resume computador no autorizado, servicio no autorizado y certificado inválido", () => {
    const computador = formatProductionWsaaLiveFailure(
      new ArcaWsaaError("WSAA rechazó el loginCms.", "SOAP_FAULT", {
        faultString: "Computador no autorizado a acceder al servicio",
      }),
    );
    const servicio = formatProductionWsaaLiveFailure(
      new ArcaWsaaError("WSAA rechazó el loginCms.", "SOAP_FAULT", {
        faultString: "El CEE no se encuentra autorizado a acceder al servicio",
      }),
    );
    const invalido = formatProductionWsaaLiveFailure(
      new ArcaWsaaError("WSAA rechazó el loginCms.", "SOAP_FAULT", {
        faultString: "Certificado inválido",
      }),
    );

    expect(computador).toContain("message: Computador no autorizado.");
    expect(servicio).toContain("message: Servicio no autorizado.");
    expect(invalido).toContain("message: Certificado inválido.");
  });

  it("no repite un error inesperado que podría traer secretos", () => {
    const report = formatProductionWsaaLiveFailure(
      new Error(`falló postgres ${SECRET_TOKEN} ${SECRET_SIGN}`),
    );

    expect(report).toContain("code: UNEXPECTED");
    expect(report).not.toContain(SECRET_TOKEN);
    expect(report).not.toContain(SECRET_SIGN);
  });

  it("informa errores de configuración y cache solo con código y mensaje", () => {
    const configuration = formatProductionWsaaLiveFailure(
      new ArcaConfigurationError(
        "El modo prueba interno no se conecta con ARCA.",
        "AMBIENTE_NO_SOPORTADO",
      ),
    );
    const cache = formatProductionWsaaLiveFailure(
      new ArcaTicketCacheError(
        "ARCA informa un Ticket de Acceso vigente que esta instancia no tiene guardado.",
        "ARCA_TICKET_ALREADY_ACTIVE_NOT_CACHED",
      ),
    );

    expect(configuration).toContain("code: AMBIENTE_NO_SOPORTADO");
    expect(cache).toContain("code: ARCA_TICKET_ALREADY_ACTIVE_NOT_CACHED");
    expect(configuration).not.toContain(SECRET_TOKEN);
  });

  it("imprime el ok sin token ni sign", () => {
    const report = formatProductionWsaaLiveSuccess({
      environment: "PRODUCCION",
      service: "wsfe",
      expirationTime: new Date("2026-10-02T20:00:00.000Z"),
    });

    expect(report).toBe(
      [
        "ARCA WSAA PRODUCCION OK",
        "environment: PRODUCCION",
        "service: wsfe",
        "tokenPresent: true",
        "signPresent: true",
        "expiresAt: 2026-10-02T20:00:00.000Z",
      ].join("\n"),
    );
    expect(report).not.toContain(SECRET_TOKEN);
    expect(report).not.toContain(SECRET_SIGN);
  });
});

describe("aislamiento del live test de WSAA producción", () => {
  it("salta sin la flag y reutiliza el ticket cacheado de producción", () => {
    const source = readFileSync(LIVE_TEST_PATH, "utf8");

    expect(source).toContain('process.env.ARCA_PROD_WSAA_LIVE_TEST === "1"');
    expect(source).toContain("describe.skipIf(!LIVE_ENABLED)");
    expect(source.indexOf("describe.skipIf(!LIVE_ENABLED)")).toBeLessThan(
      source.indexOf("loadNextLocalEnv();"),
    );
    expect(source).toContain('getValidArcaAccessTicket("PRODUCCION")');
    expect(source).toContain('resolveArcaEndpoints("PRODUCCION")');
    expect(source).not.toContain("requestWsaaTicket");
    expect(source).not.toContain("wsfe-client");
    expect(source).not.toContain("FECAESolicitar");
    expect(source).not.toContain("requestCae");
    expect(source).not.toContain("getLastAuthorizedVoucher");
    expect(source).not.toContain("consultVoucher");
    expect(source).not.toContain("getMaxRecordsPerRequest");
    expect(source).not.toContain("wsaahomo");
    expect(source).not.toContain("https://");
    expect(source).not.toContain("deleteTicket");
    expect(source).not.toContain("BillingFiscalSettings");
  });
});
