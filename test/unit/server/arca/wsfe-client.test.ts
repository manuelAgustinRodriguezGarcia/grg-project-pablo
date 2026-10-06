import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import https from "node:https";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import {
  getLastAuthorizedVoucher,
  getMaxRecordsPerRequest,
  probeProductionWsfeDummy,
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

function mockProductionHttps(body: string, status = 200): {
  fetchMock: ReturnType<typeof vi.fn>;
  requestMock: ReturnType<typeof vi.spyOn>;
  soap: () => string;
} {
  const chunks: Buffer[] = [];
  const fetchMock = forbidFetch();
  const requestMock = vi.spyOn(https, "request").mockImplementation(((
    options: https.RequestOptions,
    callback?: (response: IncomingMessage) => void,
  ) => {
    const req = new EventEmitter() as https.ClientRequest;
    req.write = ((chunk: string | Uint8Array) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    }) as https.ClientRequest["write"];
    req.end = (() => {
      queueMicrotask(() => {
        const response = new EventEmitter() as IncomingMessage;
        response.statusCode = status;
        callback?.(response);
        response.emit("data", Buffer.from(body));
        response.emit("end");
      });
      return req;
    }) as https.ClientRequest["end"];
    req.destroy = ((error?: Error) => {
      if (error) {
        queueMicrotask(() => {
          req.emit("error", error);
        });
      }
      return req;
    }) as https.ClientRequest["destroy"];
    void options;
    return req;
  }) as typeof https.request);
  return {
    fetchMock,
    requestMock,
    soap: () => Buffer.concat(chunks).toString("utf8"),
  };
}

function productionRequestOptions(
  requestMock: ReturnType<typeof vi.spyOn>,
): https.RequestOptions {
  const options = requestMock.mock.calls[0]?.[0] as https.RequestOptions | undefined;
  if (!options || typeof options === "string" || options instanceof URL) {
    throw new Error("El request de producción no recibió opciones.");
  }
  return options;
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
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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
    const { fetchMock, requestMock } = mockProductionHttps(totXml({ regXReq: "250" }));
    const production = resolveArcaEndpoints("PRODUCCION");
    const homologacion = resolveArcaEndpoints("HOMOLOGACION");

    const result = await getMaxRecordsPerRequest({
      environment: "PRODUCCION",
      accessTicket: ticket({ environment: "PRODUCCION" }),
      issuerCuit: CUIT,
      now: NOW,
    });

    expect(result.maxRecords).toBe(250);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledTimes(1);
    const options = productionRequestOptions(requestMock);
    const agent = options.agent;
    expect(options.hostname).toBe("servicios1.afip.gov.ar");
    expect(options.path).toBe("/wsfev1/service.asmx");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      SOAPAction: '"http://ar.gov.afip.dif.FEV1/FECompTotXRequest"',
    });
    expect(agent).toBeInstanceOf(https.Agent);
    expect(agent).toMatchObject({
      options: {
        rejectUnauthorized: true,
        ciphers: "DEFAULT@SECLEVEL=1",
      },
    });
    expect(production.wsfeUrl).toBe("https://servicios1.afip.gov.ar/wsfev1/service.asmx");
    expect(production.wsfeUrl).not.toBe(homologacion.wsfeUrl);
  });

  it("homologación no usa el agente TLS de producción", async () => {
    const fetchMock = mockFetch(totXml({ regXReq: "250" }));
    const requestMock = vi.spyOn(https, "request");

    await getMaxRecordsPerRequest({
      environment: "HOMOLOGACION",
      accessTicket: ticket(),
      issuerCuit: CUIT,
      now: NOW,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("registra ERR_SSL_DH_KEY_TOO_SMALL sin bajar la verificación del certificado", async () => {
    forbidFetch();
    vi.spyOn(https, "request").mockImplementation(((
      _options: https.RequestOptions,
      _callback?: (response: IncomingMessage) => void,
    ) => {
      const req = new EventEmitter() as https.ClientRequest;
      req.write = () => true;
      req.end = (() => {
        queueMicrotask(() => {
          const error = new Error("DH key too small") as NodeJS.ErrnoException;
          error.code = "ERR_SSL_DH_KEY_TOO_SMALL";
          req.emit("error", error);
        });
        return req;
      }) as https.ClientRequest["end"];
      req.destroy = (() => req) as https.ClientRequest["destroy"];
      return req;
    }) as typeof https.request);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      getMaxRecordsPerRequest({
        environment: "PRODUCCION",
        accessTicket: ticket({ environment: "PRODUCCION" }),
        issuerCuit: CUIT,
        now: NOW,
      }),
    ).rejects.toMatchObject({
      message: "No se pudo conectar con WSFEv1.",
      code: "NETWORK_ERROR",
      networkFailure: { code: "ERR_SSL_DH_KEY_TOO_SMALL" },
    });

    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).toContain("ERR_SSL_DH_KEY_TOO_SMALL");
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain(SIGN);
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
    const { fetchMock, requestMock } = mockProductionHttps(
      lastXml({ pointOfSale: "7", voucherType: "1", lastNumber: "0" }),
    );

    const result = await getLastAuthorizedVoucher({
      environment: "PRODUCCION",
      accessTicket: ticket({ environment: "PRODUCCION" }),
      issuerCuit: CUIT,
      pointOfSale: 7,
      voucherType: 1,
      now: NOW,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    const options = productionRequestOptions(requestMock);
    expect(options.hostname).toBe("servicios1.afip.gov.ar");
    expect(options.path).toBe("/wsfev1/service.asmx");
    expect(options.headers).toMatchObject({
      SOAPAction: '"http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado"',
    });
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

function dummyRuntime(region?: string): {
  nodeVersion: string;
  opensslVersion: string;
  vercelRegion?: string;
} {
  return {
    nodeVersion: process.version,
    opensslVersion: process.versions.openssl ?? "",
    ...(region ? { vercelRegion: region } : {}),
  };
}

describe("probeProductionWsfeDummy", () => {
  it("consulta FEDummy solo en el transporte de producción", async () => {
    vi.stubEnv("VERCEL_REGION", "iad1");
    const { fetchMock, requestMock, soap } = mockProductionHttps(
      envelope(
        [
          "<FEDummyResponse>",
          "  <FEDummyResult>",
          "    <AppServer>OK</AppServer>",
          "    <DbServer>OK</DbServer>",
          "    <AuthServer>OK</AuthServer>",
          "  </FEDummyResult>",
          "</FEDummyResponse>",
        ].join(""),
      ),
    );

    const result = await probeProductionWsfeDummy();

    expect(result).toEqual({
      ok: true,
      httpStatus: 200,
      appServer: "OK",
      dbServer: "OK",
      authServer: "OK",
      ...dummyRuntime("iad1"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledTimes(1);
    const options = productionRequestOptions(requestMock);
    expect(options.hostname).toBe("servicios1.afip.gov.ar");
    expect(options.path).toBe("/wsfev1/service.asmx");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      SOAPAction: '"http://ar.gov.afip.dif.FEV1/FEDummy"',
    });
    expect(options.agent).toMatchObject({
      options: {
        rejectUnauthorized: true,
        ciphers: "DEFAULT@SECLEVEL=1",
      },
    });
    const body = soap();
    expect(body).toContain('<FEDummy xmlns="http://ar.gov.afip.dif.FEV1/"/>');
    expect(body).not.toContain("<Auth");
    expect(body).not.toContain("<Token");
    expect(body).not.toContain("<Sign");
    expect(body).not.toContain("FECAESolicitar");
    expect(body).not.toContain("FECompUltimoAutorizado");
    expect(body).not.toContain("PtoVta");
  });

  it("devuelve el fallo TLS sanitizado y conserva el log de red", async () => {
    vi.stubEnv("VERCEL_REGION", "");
    forbidFetch();
    vi.spyOn(https, "request").mockImplementation(((
      _options: https.RequestOptions,
      _callback?: (response: IncomingMessage) => void,
    ) => {
      const req = new EventEmitter() as https.ClientRequest;
      req.write = () => true;
      req.end = (() => {
        queueMicrotask(() => {
          const error = new Error("DH key too small") as NodeJS.ErrnoException;
          error.code = "ERR_SSL_DH_KEY_TOO_SMALL";
          req.emit("error", error);
        });
        return req;
      }) as https.ClientRequest["end"];
      req.destroy = (() => req) as https.ClientRequest["destroy"];
      return req;
    }) as typeof https.request);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await probeProductionWsfeDummy();

    expect(result).toEqual({
      ok: false,
      code: "NETWORK_ERROR",
      network: {
        name: "Error",
        code: "ERR_SSL_DH_KEY_TOO_SMALL",
      },
      ...dummyRuntime(),
    });
    expect(errorLog).toHaveBeenCalledWith(
      "[wsfe] network",
      expect.objectContaining({ code: "ERR_SSL_DH_KEY_TOO_SMALL" }),
    );
    expect(JSON.stringify(result)).not.toMatch(/TOKEN|SIGN|BEGIN /i);
  });
});
