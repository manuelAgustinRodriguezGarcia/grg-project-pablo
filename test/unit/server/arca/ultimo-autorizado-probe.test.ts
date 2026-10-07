import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";

const findUnique = vi.hoisted(() => vi.fn());
const getValidArcaAccessTicket = vi.hoisted(() => vi.fn());
const getLastAuthorizedVoucher = vi.hoisted(() => vi.fn());

vi.mock("@/server/database/prisma", () => ({
  prisma: {
    billingFiscalSettings: { findUnique },
  },
}));

vi.mock("@/server/arca/tickets/access-ticket", () => ({
  getValidArcaAccessTicket,
}));

vi.mock("@/server/arca/wsfe/wsfe-client", () => ({
  getLastAuthorizedVoucher,
}));

import { probeProductionLastAuthorizedFacturaA } from "@/server/arca/diagnostico/ultimo-autorizado";

const TICKET = {
  token: "token-secreto-no-devolver",
  sign: "sign-secreto-no-devolver",
  generationTime: new Date("2026-10-07T12:00:00.000Z"),
  expirationTime: new Date("2026-10-07T16:00:00.000Z"),
  service: "wsfe",
  environment: "PRODUCCION",
};

const ISSUER_CUIT = "30712345678";

function productionSettings(pointOfSale = "0007") {
  return {
    environment: "PRODUCCION",
    pointOfSale,
    issuerCuit: ISSUER_CUIT,
  };
}

describe("probeProductionLastAuthorizedFacturaA", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VERCEL_REGION", "iad1");
    findUnique.mockResolvedValue(productionSettings());
    getValidArcaAccessTicket.mockResolvedValue(TICKET);
    getLastAuthorizedVoucher.mockResolvedValue({
      pointOfSale: 7,
      voucherType: 1,
      lastNumber: 1,
      events: [{ code: "1", message: "Aviso de prueba" }],
    });
  });

  it("no emite ni arma FECAESolicitar", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/server/arca/diagnostico/ultimo-autorizado.ts",
      ),
      "utf8",
    );

    expect(source).not.toContain("requestCae");
    expect(source).not.toContain("FECAESolicitar");
    expect(source).not.toContain("billingInvoice");
    expect(source).not.toContain("billingArcaEmission");
    expect(source).not.toContain("billingNote");
    expect(source).not.toContain("upsert");
    expect(source).not.toContain("getOrCreate");
  });

  it("consulta el último autorizado de Factura A en producción", async () => {
    const result = await probeProductionLastAuthorizedFacturaA();

    expect(getValidArcaAccessTicket).toHaveBeenCalledTimes(1);
    expect(getValidArcaAccessTicket).toHaveBeenCalledWith("PRODUCCION");
    expect(getLastAuthorizedVoucher).toHaveBeenCalledWith({
      environment: "PRODUCCION",
      accessTicket: TICKET,
      issuerCuit: ISSUER_CUIT,
      pointOfSale: 7,
      voucherType: 1,
    });
    expect(result).toEqual({
      ok: true,
      environment: "PRODUCCION",
      pointOfSale: 7,
      voucherType: 1,
      lastAuthorizedNumber: 1,
      nodeVersion: process.version,
      opensslVersion: process.versions.openssl ?? "",
      vercelRegion: "iad1",
      events: [{ code: "1", message: "Aviso de prueba" }],
    });
    expect(JSON.stringify(result)).not.toContain(ISSUER_CUIT);
    expect(JSON.stringify(result)).not.toContain("token-secreto");
    expect(JSON.stringify(result)).not.toContain("sign-secreto");
  });

  it("aborta sin WSAA ni WSFE si el ambiente no es producción", async () => {
    findUnique.mockResolvedValue({
      ...productionSettings(),
      environment: "HOMOLOGACION",
    });

    const result = await probeProductionLastAuthorizedFacturaA();

    expect(result).toMatchObject({
      ok: false,
      code: "FISCAL_CONFIGURATION_MISMATCH",
    });
    expect(getValidArcaAccessTicket).not.toHaveBeenCalled();
    expect(getLastAuthorizedVoucher).not.toHaveBeenCalled();
  });

  it("aborta sin WSAA ni WSFE si el punto de venta no es 0007", async () => {
    findUnique.mockResolvedValue(productionSettings("0012"));

    const result = await probeProductionLastAuthorizedFacturaA();

    expect(result).toMatchObject({
      ok: false,
      code: "FISCAL_CONFIGURATION_MISMATCH",
    });
    expect(getValidArcaAccessTicket).not.toHaveBeenCalled();
    expect(getLastAuthorizedVoucher).not.toHaveBeenCalled();
  });

  it("devuelve el error sanitizado de WSFE sin el ticket", async () => {
    getLastAuthorizedVoucher.mockRejectedValue(
      new ArcaWsfeError("No se pudo conectar con WSFEv1.", "NETWORK_ERROR"),
    );

    const result = await probeProductionLastAuthorizedFacturaA();

    expect(result).toEqual({
      ok: false,
      code: "NETWORK_ERROR",
      error: "No se pudo conectar con WSFEv1.",
    });
    expect(JSON.stringify(result)).not.toContain("token-secreto");
    expect(JSON.stringify(result)).not.toContain(ISSUER_CUIT);
  });
});
