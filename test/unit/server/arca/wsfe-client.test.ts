import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import {
  getLastAuthorizedVoucher,
  getMaxRecordsPerRequest,
} from "@/server/arca/wsfe/wsfe-client";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";

const NOW = new Date("2026-09-29T13:00:00.000Z");
const CUIT = "30712345678";
const TOKEN = "token-prueba-secreto";
const SIGN = "sign-prueba-secreto";
const HOMO_WSFE_URL = resolveArcaEndpoints("HOMOLOGACION").wsfeUrl;

function ticket(overrides?: Partial<ArcaAccessTicket>): ArcaAccessTicket {
  return {
    token: TOKEN,
    sign: SIGN,
    generationTime: new Date("2026-09-29T12:00:00.000Z"),
    expirationTime: new Date("2026-09-29T16:00:00.000Z"),
    service: "wsfe",
    environment: "HOMOLOGACION",
    ...overrides,
  };
}

function envelope(body: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">',
    "  <soapenv:Body>",
    body,
    "  </soapenv:Body>",
    "</soapenv:Envelope>",
  ].join("");
}

function totXml(input?: {
  regXReq?: string;
  errors?: string;
  events?: string;
}): string {
  return envelope(
    [
      "<FECompTotXRequestResponse>",
      "  <FECompTotXRequestResult>",
      input?.regXReq === undefined ? "" : `<RegXReq>${input.regXReq}</RegXReq>`,
      input?.errors ?? "",
      input?.events ?? "",
      "  </FECompTotXRequestResult>",
      "</FECompTotXRequestResponse>",
    ].join(""),
  );
}

function lastXml(input?: {
  pointOfSale?: string;
  voucherType?: string;
  lastNumber?: string;
  errors?: string;
}): string {
  return envelope(
    [
      "<FECompUltimoAutorizadoResponse>",
      "  <FECompUltimoAutorizadoResult>",
      input?.pointOfSale === undefined ? "" : `<PtoVta>${input.pointOfSale}</PtoVta>`,
      input?.voucherType === undefined ? "" : `<CbteTipo>${input.voucherType}</CbteTipo>`,
      input?.lastNumber === undefined ? "" : `<CbteNro>${input.lastNumber}</CbteNro>`,
      input?.errors ?? "",
      "  </FECompUltimoAutorizadoResult>",
      "</FECompUltimoAutorizadoResponse>",
    ].join(""),
  );
}

function errorXml(code: string, message: string): string {
  return `<Errors><Err><Code>${code}</Code><Msg>${message}</Msg></Err></Errors>`;
}

function mockFetch(body: string, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function forbidFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => {
    throw new Error("No debía haber red.");
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function safeText(error: ArcaWsfeError): string {
  return JSON.stringify({
    message: error.message,
    faultCode: error.faultCode,
    faultString: error.faultString,
    remoteErrors: error.remoteErrors,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getMaxRecordsPerRequest", () => {
  it("parsea RegXReq y conserva los eventos", async () => {
    const fetchMock = mockFetch(
      totXml({
        regXReq: "250",
        events: "<Events><Evt><Code>1</Code><Msg>Aviso de homologación</Msg></Evt></Events>",
      }),
    );

    const result = await getMaxRecordsPerRequest({
      environment: "HOMOLOGACION",
      accessTicket: ticket(),
      issuerCuit: CUIT,
      now: NOW,
    });

    expect(result).toEqual({
      maxRecords: 250,
      events: [{ code: "1", message: "Aviso de homologación" }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(HOMO_WSFE_URL);
    expect(new Headers(init.headers).get("SOAPAction")).toBe(
      '"http://ar.gov.afip.dif.FEV1/FECompTotXRequest"',
    );
    expect(String(init.body)).toContain("<FECompTotXRequest");
    expect(String(init.body)).toContain(`<Cuit>${CUIT}</Cuit>`);
  });

  it("producción consulta en el endpoint WSFE de producción", async () => {
    const fetchMock = mockFetch(totXml({ regXReq: "250" }));
    const production = resolveArcaEndpoints("PRODUCCION");
    const homologacion = resolveArcaEndpoints("HOMOLOGACION");

    await getMaxRecordsPerRequest({
      environment: "PRODUCCION",
      accessTicket: ticket({ environment: "PRODUCCION" }),
      issuerCuit: CUIT,
      now: NOW,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(production.wsfeUrl);
    expect(url).not.toBe(homologacion.wsfeUrl);
    expect(url.toLowerCase()).not.toContain("homo");
    expect(String(init.body)).toContain("<FECompTotXRequest");
    expect(String(init.body)).not.toContain("FECAESolicitar");
  });

  it("rechaza una respuesta con Errors", async () => {
    mockFetch(
      totXml({
        regXReq: "250",
        errors: errorXml("600", `fallo ${TOKEN}`),
      }),
    );

    const error = await getMaxRecordsPerRequest({
      environment: "HOMOLOGACION",
      accessTicket: ticket(),
      issuerCuit: CUIT,
      now: NOW,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ArcaWsfeError);
    expect(error).toMatchObject({
      code: "ARCA_ERROR",
      remoteErrors: [{ code: "600", message: "fallo [redacted]" }],
    });
    expect(safeText(error as ArcaWsfeError)).not.toContain(TOKEN);
    expect(safeText(error as ArcaWsfeError)).not.toContain(SIGN);
  });

  it("falla si el XML no se puede interpretar", async () => {
    mockFetch("<no-es-xml");

    await expect(
      getMaxRecordsPerRequest({
        environment: "HOMOLOGACION",
        accessTicket: ticket(),
        issuerCuit: CUIT,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("informa HTTP 500 cuando no hay SOAP Fault", async () => {
    mockFetch("error interno", 500);

    await expect(
      getMaxRecordsPerRequest({
        environment: "HOMOLOGACION",
        accessTicket: ticket(),
        issuerCuit: CUIT,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "HTTP_ERROR", httpStatus: 500 });
  });

  it("informa un error de red", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("socket"))));

    await expect(
      getMaxRecordsPerRequest({
        environment: "HOMOLOGACION",
        accessTicket: ticket(),
        issuerCuit: CUIT,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("conserva el código de red y no el secreto del fallo original", async () => {
    const secret = "token-super-secreto-sign-clave-privada";
    const cause = Object.assign(new Error(`detalle ${secret}`), {
      code: "UND_ERR_CONNECT_TIMEOUT",
    });
    const failure = Object.assign(new Error(`fetch failed ${secret}`), {
      code: "ETIMEDOUT",
      cause,
    });
    failure.name = "TimeoutError";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(failure)));

    await expect(
      getMaxRecordsPerRequest({
        environment: "HOMOLOGACION",
        accessTicket: ticket(),
        issuerCuit: CUIT,
        now: NOW,
      }),
    ).rejects.toMatchObject({
      message: "No se pudo conectar con WSFEv1.",
      code: "NETWORK_ERROR",
      networkFailure: {
        name: "TimeoutError",
        code: "ETIMEDOUT",
        causeCode: "UND_ERR_CONNECT_TIMEOUT",
      },
    });

    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).not.toContain(secret);
    expect(logged).toContain("ETIMEDOUT");
    errorLog.mockRestore();
  });

  it("detecta un SOAP Fault y no incluye secretos", async () => {
    mockFetch(
      envelope(
        `<soapenv:Fault><faultcode>soap:Server</faultcode><faultstring>corte ${TOKEN}</faultstring></soapenv:Fault>`,
      ),
      500,
    );

    const error = await getMaxRecordsPerRequest({
      environment: "HOMOLOGACION",
      accessTicket: ticket(),
      issuerCuit: CUIT,
      now: NOW,
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: "SOAP_FAULT",
      faultCode: "soap:Server",
    });
    expect(safeText(error as ArcaWsfeError)).not.toContain(TOKEN);
    expect(safeText(error as ArcaWsfeError)).not.toContain(SIGN);
  });
});

describe("getLastAuthorizedVoucher", () => {
  it("producción consulta Factura A en el endpoint de producción y acepta 0", async () => {
    const fetchMock = mockFetch(
      lastXml({ pointOfSale: "7", voucherType: "1", lastNumber: "0" }),
    );
    const production = resolveArcaEndpoints("PRODUCCION");

    const result = await getLastAuthorizedVoucher({
      environment: "PRODUCCION",
      accessTicket: ticket({ environment: "PRODUCCION" }),
      issuerCuit: CUIT,
      pointOfSale: 7,
      voucherType: 1,
      now: NOW,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(production.wsfeUrl);
    expect(url.toLowerCase()).not.toContain("homo");
    expect(String(init.body)).toContain("<CbteTipo>1</CbteTipo>");
    expect(String(init.body)).not.toContain("FECAESolicitar");
    expect(result).toMatchObject({
      pointOfSale: 7,
      voucherType: 1,
      lastNumber: 0,
    });
  });

  it("acepta el último comprobante 0", async () => {
    mockFetch(lastXml({ pointOfSale: "7", voucherType: "6", lastNumber: "0" }));

    await expect(
      getLastAuthorizedVoucher({
        environment: "HOMOLOGACION",
        accessTicket: ticket(),
        issuerCuit: CUIT,
        pointOfSale: 7,
        voucherType: 6,
        now: NOW,
      }),
    ).resolves.toEqual({
      pointOfSale: 7,
      voucherType: 6,
      lastNumber: 0,
      events: [],
    });
  });

  it("acepta un último comprobante mayor a 0", async () => {
    const fetchMock = mockFetch(
      lastXml({ pointOfSale: "7", voucherType: "6", lastNumber: "15" }),
    );

    const result = await getLastAuthorizedVoucher({
      environment: "HOMOLOGACION",
      accessTicket: ticket(),
      issuerCuit: CUIT,
      pointOfSale: 7,
      voucherType: 6,
      now: NOW,
    });

    expect(result.lastNumber).toBe(15);
    expect(result.pointOfSale).toBe(7);
    expect(result.voucherType).toBe(6);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("SOAPAction")).toBe(
      '"http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado"',
    );
    expect(String(init.body)).toContain("<PtoVta>7</PtoVta>");
    expect(String(init.body)).toContain("<CbteTipo>6</CbteTipo>");
  });

  it("rechaza Errors del último autorizado", async () => {
    mockFetch(
      lastXml({
        pointOfSale: "7",
        voucherType: "6",
        lastNumber: "1",
        errors: errorXml("601", "punto de venta no habilitado"),
      }),
    );

    await expect(
      getLastAuthorizedVoucher({
        environment: "HOMOLOGACION",
        accessTicket: ticket(),
        issuerCuit: CUIT,
        pointOfSale: 7,
        voucherType: 6,
        now: NOW,
      }),
    ).rejects.toMatchObject({
      code: "ARCA_ERROR",
      remoteErrors: [{ code: "601", message: "punto de venta no habilitado" }],
    });
  });

  it("falla si la respuesta está incompleta", async () => {
    mockFetch(lastXml({ pointOfSale: "7", voucherType: "6" }));

    await expect(
      getLastAuthorizedVoucher({
        environment: "HOMOLOGACION",
        accessTicket: ticket(),
        issuerCuit: CUIT,
        pointOfSale: 7,
        voucherType: 6,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

describe("validaciones previas de WSFEv1", () => {
  it("rechaza MODO_PRUEBA sin fetch", async () => {
    const fetchMock = forbidFetch();

    await expect(
      getMaxRecordsPerRequest({
        environment: "MODO_PRUEBA",
        accessTicket: ticket(),
        issuerCuit: CUIT,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ENVIRONMENT" });
    await expect(
      getLastAuthorizedVoucher({
        environment: "MODO_PRUEBA",
        accessTicket: ticket(),
        issuerCuit: CUIT,
        pointOfSale: 7,
        voucherType: 6,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ENVIRONMENT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza un ticket vencido sin fetch", async () => {
    const fetchMock = forbidFetch();

    await expect(
      getMaxRecordsPerRequest({
        environment: "HOMOLOGACION",
        accessTicket: ticket({
          expirationTime: new Date("2026-09-29T12:00:00.000Z"),
        }),
        issuerCuit: CUIT,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "TICKET_EXPIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza un ticket de otro ambiente sin fetch", async () => {
    const fetchMock = forbidFetch();

    await expect(
      getMaxRecordsPerRequest({
        environment: "HOMOLOGACION",
        accessTicket: ticket({ environment: "PRODUCCION" }),
        issuerCuit: CUIT,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "INVALID_TICKET" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza un ticket que no es de wsfe sin fetch", async () => {
    const fetchMock = forbidFetch();

    await expect(
      getMaxRecordsPerRequest({
        environment: "HOMOLOGACION",
        accessTicket: ticket({ service: "wsmtxca" }),
        issuerCuit: CUIT,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "INVALID_TICKET" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza un CUIT inválido sin fetch", async () => {
    const fetchMock = forbidFetch();

    await expect(
      getMaxRecordsPerRequest({
        environment: "HOMOLOGACION",
        accessTicket: ticket(),
        issuerCuit: "20-1",
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(ArcaConfigurationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
