import { afterEach, describe, expect, it, vi } from "vitest";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import { requestCae } from "@/server/arca/wsfe/wsfe-client";
import type { ArcaCaeRequest } from "@/server/arca/wsfe/wsfe.types";

const NOW = new Date("2026-09-30T18:00:00.000Z");
const CUIT = "30712345678";
const TOKEN = "token-prueba-secreto";
const SIGN = "sign-prueba-secreto";
const CAE = "12345678901234";
const CAE_EXPIRATION = "20261010";

function ticket(overrides?: Partial<ArcaAccessTicket>): ArcaAccessTicket {
  return {
    token: TOKEN,
    sign: SIGN,
    generationTime: new Date("2026-09-30T17:00:00.000Z"),
    expirationTime: new Date("2026-09-30T21:00:00.000Z"),
    service: "wsfe",
    environment: "HOMOLOGACION",
    ...overrides,
  };
}

function caeRequest(overrides?: Partial<ArcaCaeRequest>): ArcaCaeRequest & { now?: Date } {
  return {
    environment: "HOMOLOGACION",
    accessTicket: ticket(),
    issuerCuit: CUIT,
    pointOfSale: 7,
    voucherType: 6,
    concept: 1,
    documentType: 99,
    documentNumber: 0,
    voucherFrom: 2,
    voucherTo: 2,
    voucherDate: "20260930",
    totalAmount: 1210,
    nonTaxedAmount: 0,
    netAmount: 1000,
    exemptAmount: 0,
    taxAmount: 0,
    vatAmount: 210,
    currencyId: "PES",
    currencyRate: 1,
    receiverVatConditionId: 5,
    vatBreakdown: [{ id: 5, baseAmount: 1000, amount: 210 }],
    now: NOW,
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

function observationXml(code: string, message: string): string {
  return `<Observaciones><Obs><Code>${code}</Code><Msg>${message}</Msg></Obs></Observaciones>`;
}

function errorXml(code: string, message: string): string {
  return `<Errors><Err><Code>${code}</Code><Msg>${message}</Msg></Err></Errors>`;
}

function caeXml(input?: {
  result?: "A" | "R";
  cae?: string;
  caeExpiration?: string;
  observations?: string;
  errors?: string;
  events?: string;
  reprocess?: "S" | "N";
  omitDetail?: boolean;
  omitCae?: boolean;
}): string {
  const result = input?.result ?? "A";
  const caeTags =
    input?.omitCae || result === "R"
      ? ""
      : `<CAE>${input?.cae ?? CAE}</CAE><CAEFchVto>${input?.caeExpiration ?? CAE_EXPIRATION}</CAEFchVto>`;
  const detail = input?.omitDetail
    ? ""
    : [
        "<FeDetResp><FECAEDetResponse>",
        "<Concepto>1</Concepto><DocTipo>99</DocTipo><DocNro>0</DocNro>",
        "<CbteDesde>2</CbteDesde><CbteHasta>2</CbteHasta><CbteFch>20260930</CbteFch>",
        `<Resultado>${result}</Resultado>`,
        caeTags,
        input?.observations ?? "",
        "</FECAEDetResponse></FeDetResp>",
      ].join("");

  return envelope(
    [
      "<FECAESolicitarResponse><FECAESolicitarResult>",
      "<FeCabResp>",
      `<Cuit>${CUIT}</Cuit><PtoVta>7</PtoVta><CbteTipo>6</CbteTipo>`,
      "<FchProceso>20260930153000</FchProceso><CantReg>1</CantReg>",
      `<Resultado>${result}</Resultado><Reproceso>${input?.reprocess ?? "N"}</Reproceso>`,
      "</FeCabResp>",
      detail,
      input?.errors ?? "",
      input?.events ?? "",
      "</FECAESolicitarResult></FECAESolicitarResponse>",
    ].join(""),
  );
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

describe("requestCae", () => {
  it("solicita CAE de una Factura B aprobada", async () => {
    const fetchMock = mockFetch(
      caeXml({
        events: "<Events><Evt><Code>1</Code><Msg>Aviso de homologación</Msg></Evt></Events>",
      }),
    );

    const result = await requestCae(caeRequest());

    expect(result.status).toBe("approved");
    expect(result.result).toBe("A");
    expect(result.cae).toBe(CAE);
    expect(result.caeExpirationDate).toBe(CAE_EXPIRATION);
    expect(result.header).toMatchObject({
      cuit: CUIT,
      pointOfSale: 7,
      voucherType: 6,
      processDate: "20260930153000",
      recordCount: 1,
      result: "A",
      reprocess: "N",
    });
    expect(result.detail).toMatchObject({
      concept: 1,
      documentType: 99,
      documentNumber: 0,
      voucherFrom: 2,
      voucherTo: 2,
      voucherDate: "20260930",
      result: "A",
    });
    expect(result.observations).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.events).toEqual([{ code: "1", message: "Aviso de homologación" }]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = String(init.body);
    expect(url).toContain("/wsfev1/service.asmx");
    expect(new Headers(init.headers).get("SOAPAction")).toBe(
      '"http://ar.gov.afip.dif.FEV1/FECAESolicitar"',
    );
    expect(body).toContain("<FECAESolicitar");
    expect(body).toContain("<CantReg>1</CantReg>");
    expect(body).toContain("<PtoVta>7</PtoVta>");
    expect(body).toContain("<CbteTipo>6</CbteTipo>");
    expect(body).toContain("<Concepto>1</Concepto>");
    expect(body).toContain("<DocTipo>99</DocTipo>");
    expect(body).toContain("<DocNro>0</DocNro>");
    expect(body).toContain("<CbteDesde>2</CbteDesde>");
    expect(body).toContain("<CbteHasta>2</CbteHasta>");
    expect(body).toContain("<CbteFch>20260930</CbteFch>");
    expect(body).toContain("<ImpTotal>1210.00</ImpTotal>");
    expect(body).toContain("<ImpTotConc>0.00</ImpTotConc>");
    expect(body).toContain("<ImpNeto>1000.00</ImpNeto>");
    expect(body).toContain("<ImpOpEx>0.00</ImpOpEx>");
    expect(body).toContain("<ImpTrib>0.00</ImpTrib>");
    expect(body).toContain("<ImpIVA>210.00</ImpIVA>");
    expect(body).toContain("<MonId>PES</MonId>");
    expect(body).toContain("<MonCotiz>1.00</MonCotiz>");
    expect(body).toContain("<CondicionIVAReceptorId>5</CondicionIVAReceptorId>");
    expect(body).toContain("<Id>5</Id>");
    expect(body).toContain("<BaseImp>1000.00</BaseImp>");
    expect(body).toContain("<Importe>210.00</Importe>");
    expect(body).not.toContain("FECAEARegInformativo");
    expect(body).not.toContain("FECompUltimoAutorizado");
  });

  it("envía la alícuota recibida sin asumir 21%", async () => {
    const fetchMock = mockFetch(caeXml());

    await requestCae(
      caeRequest({
        totalAmount: 121,
        netAmount: 100,
        vatAmount: 21,
        vatBreakdown: [{ id: 4, baseAmount: 100, amount: 21 }],
      }),
    );

    const body = String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body);
    expect(body).toContain("<Id>4</Id>");
    expect(body).toContain("<BaseImp>100.00</BaseImp>");
    expect(body).toContain("<Importe>21.00</Importe>");
    expect(body).not.toContain("<Id>5</Id>");
  });

  it("mantiene aprobado un CAE con observaciones", async () => {
    mockFetch(
      caeXml({
        observations: observationXml("10217", "Observación de homologación"),
        reprocess: "S",
      }),
    );

    const result = await requestCae(caeRequest());

    expect(result.status).toBe("approved");
    expect(result.result).toBe("A");
    expect(result.cae).toBe(CAE);
    expect(result.header.reprocess).toBe("S");
    expect(result.observations).toEqual([
      { code: "10217", message: "Observación de homologación" },
    ]);
  });

  it("devuelve rechazado cuando el resultado es R y el CAE viene vacío", async () => {
    mockFetch(
      caeXml({
        result: "R",
        observations: observationXml("10048", "Número de comprobante no aceptado"),
        errors: errorXml("10016", "Solicitud rechazada"),
      }),
    );

    const result = await requestCae(caeRequest());

    expect(result.status).toBe("rejected");
    expect(result.result).toBe("R");
    expect(result.cae).toBeNull();
    expect(result.caeExpirationDate).toBeNull();
    expect(result.detail.result).toBe("R");
    expect(result.observations).toEqual([
      { code: "10048", message: "Número de comprobante no aceptado" },
    ]);
    expect(result.errors).toEqual([{ code: "10016", message: "Solicitud rechazada" }]);
  });

  it("trata Errors sin comprobante como error de ARCA y redacta secretos", async () => {
    mockFetch(
      envelope(
        `<FECAESolicitarResponse><FECAESolicitarResult>${errorXml("600", `fallo ${TOKEN}`)}</FECAESolicitarResult></FECAESolicitarResponse>`,
      ),
    );

    const error = await requestCae(caeRequest()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ArcaWsfeError);
    expect(error).toMatchObject({
      code: "ARCA_ERROR",
      remoteErrors: [{ code: "600", message: "fallo [redacted]" }],
    });
    expect(safeText(error as ArcaWsfeError)).not.toContain(TOKEN);
    expect(safeText(error as ArcaWsfeError)).not.toContain(SIGN);
  });

  it("falla si la respuesta aprobada no trae CAE", async () => {
    mockFetch(caeXml({ omitCae: true }));

    await expect(requestCae(caeRequest())).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("falla si el XML no se puede interpretar", async () => {
    mockFetch("<no-es-xml");

    await expect(requestCae(caeRequest())).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("informa HTTP 500 cuando no hay SOAP Fault", async () => {
    mockFetch("error interno", 500);

    await expect(requestCae(caeRequest())).rejects.toMatchObject({
      code: "HTTP_ERROR",
      httpStatus: 500,
    });
  });

  it("informa un error de red", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("socket"))));

    await expect(requestCae(caeRequest())).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
  });

  it("detecta un SOAP Fault y no incluye secretos", async () => {
    mockFetch(
      envelope(
        `<soapenv:Fault><faultcode>soap:Server</faultcode><faultstring>corte ${TOKEN}</faultstring></soapenv:Fault>`,
      ),
      500,
    );

    const error = await requestCae(caeRequest()).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "SOAP_FAULT", faultCode: "soap:Server" });
    expect(safeText(error as ArcaWsfeError)).not.toContain(TOKEN);
    expect(safeText(error as ArcaWsfeError)).not.toContain(SIGN);
  });
});

describe("validación local de FECAESolicitar", () => {
  async function expectRejectedBeforeFetch(
    overrides: Partial<ArcaCaeRequest>,
  ): Promise<void> {
    const fetchMock = forbidFetch();

    await expect(requestCae(caeRequest(overrides))).rejects.toMatchObject({
      code: "INVALID_CAE_REQUEST",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  }

  it("rechaza un total distinto de la suma fiscal", async () => {
    await expectRejectedBeforeFetch({ totalAmount: 1211 });
  });

  it("rechaza una fecha que no es YYYYMMDD", async () => {
    await expectRejectedBeforeFetch({ voucherDate: "2026-09-30" });
    await expectRejectedBeforeFetch({ voucherDate: "20260231" });
  });

  it("rechaza punto de venta 0", async () => {
    await expectRejectedBeforeFetch({ pointOfSale: 0 });
  });

  it("rechaza tipo de comprobante 0", async () => {
    await expectRejectedBeforeFetch({ voucherType: 0 });
  });

  it("rechaza número de comprobante 0", async () => {
    await expectRejectedBeforeFetch({ voucherFrom: 0 });
  });

  it("rechaza cotización 0", async () => {
    await expectRejectedBeforeFetch({ currencyRate: 0 });
  });

  it("rechaza condición de IVA del receptor inválida", async () => {
    await expectRejectedBeforeFetch({ receiverVatConditionId: 0 });
  });

  it("rechaza IVA negativo", async () => {
    await expectRejectedBeforeFetch({ vatAmount: -1 });
  });
});

describe("infraestructura previa de FECAESolicitar", () => {
  it("rechaza MODO_PRUEBA sin fetch", async () => {
    const fetchMock = forbidFetch();

    await expect(
      requestCae(caeRequest({ environment: "MODO_PRUEBA" })),
    ).rejects.toMatchObject({ code: "INVALID_ENVIRONMENT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza un ticket vencido sin fetch", async () => {
    const fetchMock = forbidFetch();

    await expect(
      requestCae(
        caeRequest({
          accessTicket: ticket({
            expirationTime: new Date("2026-09-30T17:00:00.000Z"),
          }),
        }),
      ),
    ).rejects.toMatchObject({ code: "TICKET_EXPIRED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza un ticket de otro ambiente sin fetch", async () => {
    const fetchMock = forbidFetch();

    await expect(
      requestCae(
        caeRequest({
          accessTicket: ticket({ environment: "PRODUCCION" }),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_TICKET" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza un CUIT inválido sin fetch", async () => {
    const fetchMock = forbidFetch();

    await expect(requestCae(caeRequest({ issuerCuit: "20-1" }))).rejects.toBeInstanceOf(
      ArcaConfigurationError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
