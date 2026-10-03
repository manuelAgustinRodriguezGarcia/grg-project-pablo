import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArcaWsfeError } from "@/server/arca/errors/arca-wsfe.error";
import { consultVoucher } from "@/server/arca/wsfe/wsfe-client";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";

const NOW = new Date("2026-09-30T18:00:00.000Z");
const CUIT = "30712345678";
const TOKEN = "token-prueba-secreto";
const SIGN = "sign-prueba-secreto";
const AUTHORIZATION = "12345678901234";

function ticket(): ArcaAccessTicket {
  return {
    token: TOKEN,
    sign: SIGN,
    generationTime: new Date("2026-09-30T17:00:00.000Z"),
    expirationTime: new Date("2026-09-30T21:00:00.000Z"),
    service: "wsfe",
    environment: "HOMOLOGACION",
  };
}

function query() {
  return {
    environment: "HOMOLOGACION" as const,
    accessTicket: ticket(),
    issuerCuit: CUIT,
    pointOfSale: 7,
    voucherType: 6,
    voucherNumber: 2,
    now: NOW,
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

function resultGet(extra = ""): string {
  return [
    "<ResultGet>",
    "<Concepto>1</Concepto><DocTipo>99</DocTipo><DocNro>0</DocNro>",
    "<CbteDesde>2</CbteDesde><CbteHasta>2</CbteHasta><CbteFch>20260930</CbteFch>",
    "<ImpTotal>1210.00</ImpTotal><ImpTotConc>0.00</ImpTotConc><ImpNeto>1000.00</ImpNeto>",
    "<ImpOpEx>0.00</ImpOpEx><ImpTrib>0.00</ImpTrib><ImpIVA>210.00</ImpIVA>",
    "<MonId>PES</MonId><MonCotiz>1</MonCotiz>",
    "<Iva><AlicIva><Id>5</Id><BaseImp>1000.00</BaseImp><Importe>210.00</Importe></AlicIva></Iva>",
    "<Resultado>A</Resultado>",
    `<CodAutorizacion>${AUTHORIZATION}</CodAutorizacion>`,
    "<EmisionTipo>CAE</EmisionTipo><FchVto>20261010</FchVto><FchProceso>20260930170000</FchProceso>",
    "<PtoVta>7</PtoVta><CbteTipo>6</CbteTipo><CondicionIVAReceptorId>5</CondicionIVAReceptorId>",
    extra,
    "</ResultGet>",
  ].join("");
}

function consultXml(input?: { resultGet?: string; errors?: string; events?: string }): string {
  return envelope(
    [
      "<FECompConsultarResponse><FECompConsultarResult>",
      input?.resultGet ?? resultGet(),
      input?.errors ?? "",
      input?.events ?? "",
      "</FECompConsultarResult></FECompConsultarResponse>",
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("consultVoucher", () => {
  it("recupera la Factura B 0007-00000002 autorizada", async () => {
    const fetchMock = mockFetch(consultXml());
    const voucher = await consultVoucher(query());
    const body = String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body);

    expect(voucher.result).toBe("A");
    expect(voucher.pointOfSale).toBe(7);
    expect(voucher.voucherType).toBe(6);
    expect(voucher.voucherNumber).toBe(2);
    expect(voucher.documentType).toBe(99);
    expect(voucher.documentNumber).toBe(0);
    expect(voucher.netAmount).toBe(1000);
    expect(voucher.vatAmount).toBe(210);
    expect(voucher.totalAmount).toBe(1210);
    expect(voucher.receiverVatConditionId).toBe(5);
    expect(voucher.emissionType).toBe("CAE");
    expect(voucher.authorizationCode).toBe(AUTHORIZATION);
    expect(voucher.authorizationExpirationDate).toBe("20261010");
    expect(voucher.vatBreakdown).toEqual([{ id: 5, baseAmount: 1000, amount: 210 }]);
    expect(new Headers((fetchMock.mock.calls[0] as [string, RequestInit])[1].headers).get("SOAPAction")).toBe(
      '"http://ar.gov.afip.dif.FEV1/FECompConsultar"',
    );
    expect(body).toContain("<CbteTipo>6</CbteTipo>");
    expect(body).toContain("<CbteNro>2</CbteNro>");
    expect(body).toContain("<PtoVta>7</PtoVta>");
    expect(body).not.toContain("FECAESolicitar");
  });

  it("conserva observaciones sin tratarlas como error", async () => {
    mockFetch(
      consultXml({
        resultGet: resultGet(
          "<Observaciones><Obs><Code>10217</Code><Msg>Observación de homologación</Msg></Obs></Observaciones>",
        ),
      }),
    );

    const voucher = await consultVoucher(query());

    expect(voucher.result).toBe("A");
    expect(voucher.observations).toEqual([
      { code: "10217", message: "Observación de homologación" },
    ]);
  });

  it("conserva events", async () => {
    mockFetch(
      consultXml({
        events: "<Events><Evt><Code>1</Code><Msg>Aviso de homologación</Msg></Evt></Events>",
      }),
    );

    const voucher = await consultVoucher(query());

    expect(voucher.events).toEqual([{ code: "1", message: "Aviso de homologación" }]);
  });

  it("distingue un comprobante inexistente de un error de red", async () => {
    mockFetch(
      consultXml({
        resultGet: "",
        errors: "<Errors><Err><Code>602</Code><Msg>Sin resultados</Msg></Err></Errors>",
      }),
    );

    await expect(consultVoucher(query())).rejects.toMatchObject({
      code: "VOUCHER_NOT_FOUND",
      remoteErrors: [{ code: "602", message: "Sin resultados" }],
    });
  });

  it("informa Errors de ARCA y redacta secretos", async () => {
    mockFetch(
      consultXml({
        resultGet: "",
        errors: `<Errors><Err><Code>600</Code><Msg>fallo ${TOKEN}</Msg></Err></Errors>`,
      }),
    );

    const error = await consultVoucher(query()).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: "ARCA_ERROR",
      remoteErrors: [{ code: "600", message: "fallo [redacted]" }],
    });
    expect(JSON.stringify(error)).not.toContain(TOKEN);
  });

  it("informa HTTP 500", async () => {
    mockFetch("error interno", 500);

    await expect(consultVoucher(query())).rejects.toMatchObject({
      code: "HTTP_ERROR",
      httpStatus: 500,
    });
  });

  it("informa un error de red", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("socket"))));

    await expect(consultVoucher(query())).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("detecta un SOAP Fault sin incluir secretos", async () => {
    mockFetch(
      envelope(
        `<soapenv:Fault><faultcode>soap:Server</faultcode><faultstring>corte ${TOKEN}</faultstring></soapenv:Fault>`,
      ),
      500,
    );

    const error = await consultVoucher(query()).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ArcaWsfeError);
    expect(error).toMatchObject({ code: "SOAP_FAULT", faultCode: "soap:Server" });
    expect(JSON.stringify(error)).not.toContain(TOKEN);
  });

  it("falla si el XML del comprobante está incompleto", async () => {
    mockFetch(
      consultXml({
        resultGet: resultGet().replace(`<CodAutorizacion>${AUTHORIZATION}</CodAutorizacion>`, ""),
      }),
    );

    await expect(consultVoucher(query())).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rechaza el número 0 antes del fetch", async () => {
    const fetchMock = forbidFetch();

    await expect(consultVoucher({ ...query(), voucherNumber: 0 })).rejects.toMatchObject({
      code: "INVALID_VOUCHER_QUERY",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("aislamiento de la consulta", () => {
  it("no emite ni persiste facturas", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/server/arca/wsfe/reconcile-voucher.ts"),
      "utf8",
    );

    expect(source).not.toContain("requestCae");
    expect(source).not.toContain("FECAESolicitar");
    expect(source).not.toContain("BillingInvoice");
  });
});
