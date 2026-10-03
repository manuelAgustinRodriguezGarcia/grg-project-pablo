import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import { serializeCaeRequest } from "@/server/arca/wsfe/wsfe-cae-request";
import { buildFeCaeSolicitarXml } from "@/server/arca/wsfe/wsfe-soap";
import type { ArcaCaeAuthorization, ArcaCaeRequest } from "@/server/arca/wsfe/wsfe.types";
import {
  formatArgentinaVoucherDate,
  formatCaeLiveReport,
  resolveLiveFiscalContext,
  runHomologationCaeLive,
  type CaeLiveDependencies,
} from "../../../integration/arca/cae-live-flow";

const CUIT = "30712345678";
const NOW = new Date("2026-10-01T02:30:00.000Z");

function ticket(): ArcaAccessTicket {
  return {
    token: "token-prueba",
    sign: "sign-prueba",
    generationTime: new Date("2026-09-30T12:00:00.000Z"),
    expirationTime: new Date("2026-09-30T16:00:00.000Z"),
    service: "wsfe",
    environment: "HOMOLOGACION",
  };
}

function approved(): ArcaCaeAuthorization {
  return {
    status: "approved",
    result: "A",
    cae: "12345678901234",
    caeExpirationDate: "20261010",
    observations: [{ code: "1", message: "aviso" }],
    errors: [],
    events: [],
    header: {
      cuit: CUIT,
      pointOfSale: 7,
      voucherType: 6,
      processDate: "20260930120000",
      recordCount: 1,
      result: "A",
      reprocess: "N",
    },
    detail: {
      concept: 1,
      documentType: 99,
      documentNumber: 0,
      voucherFrom: 2,
      voucherTo: 2,
      voucherDate: "20260930",
      result: "A",
      observations: [{ code: "1", message: "aviso" }],
    },
  };
}

function rejected(): ArcaCaeAuthorization {
  return {
    status: "rejected",
    result: "R",
    cae: null,
    caeExpirationDate: null,
    observations: [{ code: "10048", message: "Número no aceptado" }],
    errors: [{ code: "10016", message: "Solicitud rechazada" }],
    events: [{ code: "2", message: "Evento de homologación" }],
    header: {
      cuit: CUIT,
      pointOfSale: 7,
      voucherType: 6,
      processDate: "20260930120000",
      recordCount: 1,
      result: "R",
      reprocess: "N",
    },
    detail: {
      concept: 1,
      documentType: 99,
      documentNumber: 0,
      voucherFrom: 2,
      voucherTo: 2,
      voucherDate: "20260930",
      result: "R",
      observations: [{ code: "10048", message: "Número no aceptado" }],
    },
  };
}

function dependencies(input: {
  lastNumbers: number[];
  requestCae?: CaeLiveDependencies["requestCae"];
}): CaeLiveDependencies & {
  getLastAuthorizedVoucher: ReturnType<typeof vi.fn>;
  requestCae: ReturnType<typeof vi.fn>;
} {
  return {
    getLastAuthorizedVoucher: vi.fn(async () => ({
      lastNumber: input.lastNumbers.shift() ?? -1,
    })),
    requestCae: vi.fn(input.requestCae ?? (async () => approved())),
  };
}

async function run(deps: CaeLiveDependencies) {
  return runHomologationCaeLive({
    issuerCuit: CUIT,
    accessTicket: ticket(),
    now: NOW,
    dependencies: deps,
  });
}

describe("flujo live de CAE en homologación", () => {
  it("permite requestCae cuando el último autorizado es 1 y el XML queda en pesos", async () => {
    const deps = dependencies({ lastNumbers: [1, 2] });

    const outcome = await run(deps);
    const sent = deps.requestCae.mock.calls[0]?.[0] as ArcaCaeRequest;
    const xml = buildFeCaeSolicitarXml({
      authXml: "<Auth></Auth>",
      request: serializeCaeRequest(sent),
    });

    expect(deps.requestCae).toHaveBeenCalledTimes(1);
    expect(deps.getLastAuthorizedVoucher).toHaveBeenCalledTimes(2);
    expect(sent.voucherFrom).toBe(2);
    expect(sent.voucherTo).toBe(2);
    expect(sent.netAmount).toBe(1000);
    expect(sent.vatAmount).toBe(210);
    expect(sent.totalAmount).toBe(1210);
    expect(sent.voucherDate).toBe("20260930");
    expect(xml).toContain("<ImpNeto>1000.00</ImpNeto>");
    expect(xml).toContain("<ImpIVA>210.00</ImpIVA>");
    expect(xml).toContain("<ImpTotal>1210.00</ImpTotal>");
    expect(xml).toContain("<ImpTotConc>0.00</ImpTotConc>");
    expect(xml).toContain("<ImpOpEx>0.00</ImpOpEx>");
    expect(xml).toContain("<ImpTrib>0.00</ImpTrib>");
    expect(xml).toContain("<BaseImp>1000.00</BaseImp>");
    expect(xml).toContain("<Importe>210.00</Importe>");
    expect(xml).not.toContain("100000.00");
    expect(outcome).toEqual({
      kind: "approved",
      caePresent: true,
      caeExpirationDate: "20261010",
      observationCount: 1,
    });
  });

  it("no llama requestCae si el último autorizado ya es 2", async () => {
    const deps = dependencies({ lastNumbers: [2] });

    const outcome = await run(deps);

    expect(deps.requestCae).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: "precondition_failed", actualLastAuthorized: 2 });
    expect(formatCaeLiveReport(outcome)).toContain("No se emitió ningún comprobante.");
  });

  it("no llama requestCae si el último autorizado es 0", async () => {
    const deps = dependencies({ lastNumbers: [0] });

    const outcome = await run(deps);

    expect(deps.requestCae).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: "precondition_failed", actualLastAuthorized: 0 });
  });

  it("después de aprobar exige que la consulta posterior devuelva 2", async () => {
    const deps = dependencies({ lastNumbers: [1, 9] });

    const outcome = await run(deps);

    expect(deps.requestCae).toHaveBeenCalledTimes(1);
    expect(deps.getLastAuthorizedVoucher).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({ kind: "verification_failed", actualLastAuthorized: 9 });
    expect(formatCaeLiveReport(outcome)).toContain(
      "CAE fue aprobado pero falló la verificación posterior.",
    );
  });

  it("si ARCA rechaza no consulta de nuevo ni reintenta", async () => {
    const deps = dependencies({
      lastNumbers: [1],
      requestCae: async () => rejected(),
    });

    const outcome = await run(deps);

    expect(deps.requestCae).toHaveBeenCalledTimes(1);
    expect(deps.getLastAuthorizedVoucher).toHaveBeenCalledTimes(1);
    expect(outcome.kind).toBe("rejected");
    expect(formatCaeLiveReport(outcome)).toContain("ARCA CAE HOMOLOGACION REJECTED");
    expect(formatCaeLiveReport(outcome)).toContain("No se reintentó.");
  });

  it("ante un error de red llama requestCae una sola vez", async () => {
    const deps = dependencies({
      lastNumbers: [1],
      requestCae: async () => {
        throw new ArcaWsfeError("No se pudo conectar con WSFEv1.", "NETWORK_ERROR");
      },
    });

    const outcome = await run(deps);

    expect(deps.requestCae).toHaveBeenCalledTimes(1);
    expect(deps.getLastAuthorizedVoucher).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ kind: "ambiguous", code: "NETWORK_ERROR" });
    expect(formatCaeLiveReport(outcome)).toContain("No se reintentó FECAESolicitar.");
  });

  it("arma YYYYMMDD con el día calendario de Argentina", () => {
    expect(formatArgentinaVoucherDate(new Date("2026-10-01T02:30:00.000Z"))).toBe("20260930");
    expect(formatArgentinaVoucherDate(new Date("2026-10-01T03:30:00.000Z"))).toBe("20261001");
  });

  it("resuelve CUIT y punto de venta 7 antes de emitir", () => {
    expect(
      resolveLiveFiscalContext({
        issuerCuit: "30-71234567-8",
        pointOfSale: "0007",
      }),
    ).toEqual({ issuerCuit: CUIT, pointOfSale: 7 });

    expect(() =>
      resolveLiveFiscalContext({
        issuerCuit: CUIT,
        pointOfSale: "0008",
      }),
    ).toThrow(/actualPointOfSale: 8/);
  });

  it("el test live no pide un Ticket directo ni persiste facturas", () => {
    const source = readFileSync(
      path.join(process.cwd(), "test/integration/arca/cae-live.test.ts"),
      "utf8",
    );

    expect(source).toContain('process.env.ARCA_CAE_LIVE_TEST === "1"');
    expect(source).toContain("describe.skipIf(!LIVE_ENABLED)");
    expect(source).toContain('getValidArcaAccessTicket("HOMOLOGACION")');
    expect(source).not.toContain("requestWsaaTicket");
    expect(source).not.toContain("BillingInvoice");
    expect(source).not.toContain("FECompConsultar");
    expect(source).not.toContain("FECAEARegInformativo");
  });
});
