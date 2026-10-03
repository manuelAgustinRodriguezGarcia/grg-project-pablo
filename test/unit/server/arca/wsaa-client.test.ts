import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import { requestWsaaTicket } from "@/server/arca/wsaa/wsaa-client";
import { getTestCredentialPair, pemToBase64 } from "./wsaa-fixtures";

const HOMO_WSAA_URL = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function loginResponse(input: {
  generationTime: string;
  expirationTime: string;
  token?: string;
  sign?: string;
}): string {
  const token = input.token === undefined ? "" : `<token>${input.token}</token>`;
  const sign = input.sign === undefined ? "" : `<sign>${input.sign}</sign>`;
  const inner = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<loginTicketResponse version="1.0">',
    "  <header>",
    `    <generationTime>${input.generationTime}</generationTime>`,
    `    <expirationTime>${input.expirationTime}</expirationTime>`,
    "  </header>",
    "  <credentials>",
    `    ${token}`,
    `    ${sign}`,
    "  </credentials>",
    "</loginTicketResponse>",
  ].join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">',
    "  <soapenv:Body>",
    "    <loginCmsResponse>",
    `      <loginCmsReturn>${escapeXml(inner)}</loginCmsReturn>`,
    "    </loginCmsResponse>",
    "  </soapenv:Body>",
    "</soapenv:Envelope>",
  ].join("");
}

function soapFault(faultCode: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">',
    "  <soapenv:Body>",
    "    <soapenv:Fault>",
    `      <faultcode>${faultCode}</faultcode>`,
    "      <faultstring>Ya existe un TA válido</faultstring>",
    "    </soapenv:Fault>",
    "  </soapenv:Body>",
    "</soapenv:Envelope>",
  ].join("");
}

function mockFetch(body: string, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  const pair = getTestCredentialPair();
  vi.stubEnv("ARCA_HOMO_CERT_B64", pemToBase64(pair.certificatePem));
  vi.stubEnv("ARCA_HOMO_PRIVATE_KEY_B64", pemToBase64(pair.privateKeyPem));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  delete process.env.ARCA_HOMO_CERT_B64;
  delete process.env.ARCA_HOMO_PRIVATE_KEY_B64;
});

describe("requestWsaaTicket", () => {
  it("devuelve el ticket parseado desde loginCmsReturn", async () => {
    const fetchMock = mockFetch(
      loginResponse({
        generationTime: "2026-09-29T03:50:00.000Z",
        expirationTime: "2026-09-29T16:00:00.000Z",
        token: "token-prueba",
        sign: "sign-prueba",
      }),
    );

    const ticket = await requestWsaaTicket("HOMOLOGACION", {
      now: new Date("2026-09-29T04:00:00.000Z"),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      HOMO_WSAA_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "text/xml; charset=utf-8",
        }),
      }),
    );
    expect(ticket).toMatchObject({
      token: "token-prueba",
      sign: "sign-prueba",
      service: "wsfe",
      environment: "HOMOLOGACION",
    });
    expect(ticket.generationTime.toISOString()).toBe("2026-09-29T03:50:00.000Z");
    expect(ticket.expirationTime.toISOString()).toBe("2026-09-29T16:00:00.000Z");

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = String(request.body);
    expect(body).toContain("<wsaa:loginCms>");
    expect(body).toContain("<wsaa:in0>");
    expect(body).not.toContain("PRIVATE KEY");
    expect(body).not.toContain("token-prueba");
  });

  it("producción llama al WSAA de producción y no al de homologación", async () => {
    const pair = getTestCredentialPair();
    vi.stubEnv("ARCA_PROD_CERT_B64", pemToBase64(pair.certificatePem));
    vi.stubEnv("ARCA_PROD_PRIVATE_KEY_B64", pemToBase64(pair.privateKeyPem));
    const fetchMock = mockFetch(
      loginResponse({
        generationTime: "2026-09-29T03:50:00.000Z",
        expirationTime: "2026-09-29T16:00:00.000Z",
        token: "token-produccion",
        sign: "sign-produccion",
      }),
    );
    const production = resolveArcaEndpoints("PRODUCCION");
    const homologacion = resolveArcaEndpoints("HOMOLOGACION");

    const ticket = await requestWsaaTicket("PRODUCCION", {
      now: new Date("2026-09-29T04:00:00.000Z"),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      production.wsaaUrl,
      expect.any(Object),
    );
    expect(production.wsaaUrl).not.toBe(homologacion.wsaaUrl);
    expect(production.wsaaUrl.toLowerCase()).not.toContain("homo");
    expect(production.service).toBe("wsfe");
    expect(ticket.environment).toBe("PRODUCCION");
    expect(ticket.service).toBe("wsfe");
  });

  it("informa HTTP 500 cuando no hay SOAP Fault", async () => {
    mockFetch("upstream down", 500);

    await expect(requestWsaaTicket("HOMOLOGACION")).rejects.toMatchObject({
      code: "HTTP_ERROR",
      httpStatus: 500,
    });
  });

  it("informa un error de red sin reintentar", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestWsaaTicket("HOMOLOGACION")).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("detecta coe.alreadyAuthenticated y no reintenta", async () => {
    const fetchMock = mockFetch(
      soapFault("soapenv:Server.coe.alreadyAuthenticated"),
      500,
    );

    await expect(requestWsaaTicket("HOMOLOGACION")).rejects.toMatchObject({
      code: "SOAP_FAULT",
      faultCode: "soapenv:Server.coe.alreadyAuthenticated",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falla si falta loginCmsReturn", async () => {
    mockFetch(
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><loginCmsResponse/></soapenv:Body></soapenv:Envelope>',
    );

    await expect(requestWsaaTicket("HOMOLOGACION")).rejects.toBeInstanceOf(
      ArcaWsaaError,
    );
    await expect(requestWsaaTicket("HOMOLOGACION")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("falla si el XML no se puede interpretar", async () => {
    mockFetch("<not-xml");

    await expect(requestWsaaTicket("HOMOLOGACION")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("falla si falta el token", async () => {
    mockFetch(
      loginResponse({
        generationTime: "2026-09-29T03:50:00.000Z",
        expirationTime: "2026-09-29T16:00:00.000Z",
        sign: "sign-prueba",
      }),
    );

    await expect(requestWsaaTicket("HOMOLOGACION")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("falla si falta el sign", async () => {
    mockFetch(
      loginResponse({
        generationTime: "2026-09-29T03:50:00.000Z",
        expirationTime: "2026-09-29T16:00:00.000Z",
        token: "token-prueba",
      }),
    );

    await expect(requestWsaaTicket("HOMOLOGACION")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("rechaza un ticket ya vencido", async () => {
    mockFetch(
      loginResponse({
        generationTime: "2000-01-01T00:00:00.000Z",
        expirationTime: "2000-01-01T00:10:00.000Z",
        token: "token-prueba",
        sign: "sign-prueba",
      }),
    );

    await expect(
      requestWsaaTicket("HOMOLOGACION", {
        now: new Date("2026-09-29T04:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "TICKET_EXPIRED",
    });
  });
});
