import "server-only";
import https from "node:https";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import {
  ArcaWsfeError,
  type ArcaWsfeNetworkFailure,
} from "@/server/arca/errors/arca-wsfe.error";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import { normalizeIssuerCuit } from "@/server/arca/utils/cuit";
import { parseArcaPointOfSale } from "@/server/arca/utils/point-of-sale";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import { serializeCaeRequest } from "@/server/arca/wsfe/wsfe-cae-request";
import { parseCaeAuthorization } from "@/server/arca/wsfe/wsfe-cae-response";
import {
  parseConsultedVoucher,
  throwIfVoucherErrors,
} from "@/server/arca/wsfe/wsfe-voucher-response";
import {
  interpretWsfeResponse,
  requireWsfeInteger,
  type ParsedWsfeResult,
} from "@/server/arca/wsfe/wsfe-response";
import {
  FE_CAE_SOLICITAR,
  FE_CAE_SOLICITAR_ACTION,
  FE_COMP_CONSULTAR,
  FE_COMP_CONSULTAR_ACTION,
  FE_COMP_TOT_X_REQUEST,
  FE_COMP_TOT_X_REQUEST_ACTION,
  FE_COMP_ULTIMO_AUTORIZADO,
  FE_COMP_ULTIMO_AUTORIZADO_ACTION,
  FE_DUMMY_ACTION,
  buildFeCaeSolicitarXml,
  buildFeCompConsultarXml,
  buildFeCompTotXRequestXml,
  buildFeCompUltimoAutorizadoXml,
  buildFeDummyXml,
  buildWsfeAuthXml,
  buildWsfeEnvelope,
} from "@/server/arca/wsfe/wsfe-soap";
import type {
  ArcaCaeAuthorization,
  ArcaCaeRequest,
  ArcaVoucher,
  ArcaVoucherQuery,
  LastAuthorizedVoucher,
  MaxRecordsPerRequest,
} from "@/server/arca/wsfe/wsfe.types";

const WSFE_TIMEOUT_MS = 15_000;
const WSFE_SERVICE = "wsfe";
const PRODUCTION_WSFE_HOST = "servicios1.afip.gov.ar";

const productionWsfeAgent = new https.Agent({
  keepAlive: false,
  rejectUnauthorized: true,
  ciphers: "DEFAULT@SECLEVEL=1",
});

type WsfeEnvironment = ArcaEnvironment | "MODO_PRUEBA";

type WsfeCallInput = {
  environment: WsfeEnvironment;
  operation: string;
  soapAction: string;
  accessTicket: ArcaAccessTicket;
  issuerCuit: string;
  now?: Date;
  errors?: "throw" | "return";
  extraBody?: (authXml: string) => string;
};

function invalidTicket(message: string): ArcaWsfeError {
  return new ArcaWsfeError(message, "INVALID_TICKET");
}

function assertUsableTicket(
  environment: ArcaEnvironment,
  accessTicket: ArcaAccessTicket,
  now: Date,
): void {
  if (accessTicket.environment !== environment) {
    throw invalidTicket("El ticket no corresponde a este ambiente.");
  }

  if (accessTicket.service !== WSFE_SERVICE) {
    throw invalidTicket("El ticket no corresponde al servicio wsfe.");
  }

  if (!accessTicket.token.trim() || !accessTicket.sign.trim()) {
    throw invalidTicket("El ticket de acceso no es válido.");
  }

  if (
    Number.isNaN(accessTicket.generationTime.getTime()) ||
    Number.isNaN(accessTicket.expirationTime.getTime())
  ) {
    throw invalidTicket("El ticket de acceso no es válido.");
  }

  if (accessTicket.expirationTime.getTime() <= now.getTime()) {
    throw new ArcaWsfeError(
      "El ticket de acceso está vencido.",
      "TICKET_EXPIRED",
    );
  }
}

function readNetworkCode(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !("code" in value)) {
    return undefined;
  }

  const code = (value as { code?: unknown }).code;
  if (typeof code !== "string" && typeof code !== "number") {
    return undefined;
  }

  const text = String(code).slice(0, 64);
  if (/token|sign|certificate|private key|BEGIN /i.test(text)) {
    return undefined;
  }

  return text;
}

function sanitizeNetworkFailure(error: unknown): ArcaWsfeNetworkFailure {
  const name = error instanceof Error ? error.name.slice(0, 64) : "Error";
  const code = readNetworkCode(error);
  const causeCode =
    error instanceof Error ? readNetworkCode(error.cause) : undefined;

  return {
    name,
    ...(code ? { code } : {}),
    ...(causeCode ? { causeCode } : {}),
  };
}

function wsfeNetworkError(error: unknown): ArcaWsfeError {
  const networkFailure = sanitizeNetworkFailure(error);
  console.error("[wsfe] network", networkFailure);
  return new ArcaWsfeError("No se pudo conectar con WSFEv1.", "NETWORK_ERROR", {
    networkFailure,
  });
}

function isProductionWsfeUrl(url: string): boolean {
  try {
    return new URL(url).hostname === PRODUCTION_WSFE_HOST;
  } catch {
    return false;
  }
}

function postProductionWsfe(
  url: string,
  soapAction: string,
  soap: string,
): Promise<Response> {
  const target = new URL(url);
  const body = Buffer.from(soap, "utf8");

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function finish(error: unknown, response?: Response): void {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      if (error) {
        reject(error);
        return;
      }
      resolve(response ?? new Response("", { status: 0 }));
    }

    const request = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: `"${soapAction}"`,
          "Content-Length": body.length,
        },
        agent: productionWsfeAgent,
        rejectUnauthorized: true,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) => {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        });
        response.on("end", () => {
          finish(
            undefined,
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 0,
            }),
          );
        });
        response.on("error", (error) => {
          finish(error);
        });
      },
    );

    timer = setTimeout(() => {
      const error = new Error("The operation was aborted due to timeout");
      error.name = "TimeoutError";
      request.destroy(error);
    }, WSFE_TIMEOUT_MS);

    request.on("error", (error) => {
      finish(error);
    });
    request.write(body);
    request.end();
  });
}

type DummyStatusTag = "AppServer" | "DbServer" | "AuthServer";

type ProductionWsfeDummyRuntime = {
  nodeVersion: string;
  opensslVersion: string;
  vercelRegion?: string;
};

export type ProductionWsfeDummyProbe = (
  | {
      ok: true;
      httpStatus: number;
      appServer: string;
      dbServer: string;
      authServer: string;
    }
  | {
      ok: false;
      code: "NETWORK_ERROR" | "HTTP_ERROR" | "INVALID_RESPONSE";
      httpStatus?: number;
      network?: ArcaWsfeNetworkFailure;
      appServer?: string;
      dbServer?: string;
      authServer?: string;
    }
) &
  ProductionWsfeDummyRuntime;

function productionWsfeDummyRuntime(): ProductionWsfeDummyRuntime {
  const region = process.env.VERCEL_REGION;
  return {
    nodeVersion: process.version,
    opensslVersion: process.versions.openssl ?? "",
    ...(typeof region === "string" && /^[a-z]{3}\d$/.test(region)
      ? { vercelRegion: region }
      : {}),
  };
}

function readDummyStatus(xml: string, tag: DummyStatusTag): string | undefined {
  const match = new RegExp(`<${tag}>([^<]{1,32})</${tag}>`).exec(xml);
  const value = match?.[1]?.trim();
  if (!value || !/^[A-Za-z0-9 ._-]+$/.test(value)) {
    return undefined;
  }
  return value;
}

export async function probeProductionWsfeDummy(): Promise<ProductionWsfeDummyProbe> {
  const endpoints = resolveArcaEndpoints("PRODUCCION");

  try {
    const response = await postWsfe(
      endpoints.wsfeUrl,
      FE_DUMMY_ACTION,
      buildWsfeEnvelope(buildFeDummyXml()),
    );
    const runtime = productionWsfeDummyRuntime();
    const httpStatus = response.status;
    if (httpStatus < 200 || httpStatus >= 300) {
      return { ok: false, code: "HTTP_ERROR", httpStatus, ...runtime };
    }

    const xml = (await response.text()).slice(0, 8_192);
    const appServer = readDummyStatus(xml, "AppServer");
    const dbServer = readDummyStatus(xml, "DbServer");
    const authServer = readDummyStatus(xml, "AuthServer");
    if (!appServer || !dbServer || !authServer) {
      return { ok: false, code: "INVALID_RESPONSE", httpStatus, ...runtime };
    }

    if (appServer === "OK" && dbServer === "OK" && authServer === "OK") {
      return { ok: true, httpStatus, appServer, dbServer, authServer, ...runtime };
    }

    return {
      ok: false,
      code: "INVALID_RESPONSE",
      httpStatus,
      appServer,
      dbServer,
      authServer,
      ...runtime,
    };
  } catch (error) {
    const runtime = productionWsfeDummyRuntime();
    if (error instanceof ArcaWsfeError && error.code === "NETWORK_ERROR") {
      return {
        ok: false,
        code: "NETWORK_ERROR",
        ...(error.networkFailure ? { network: error.networkFailure } : {}),
        ...runtime,
      };
    }

    return { ok: false, code: "NETWORK_ERROR", ...runtime };
  }
}

async function postWsfe(url: string, soapAction: string, soap: string): Promise<Response> {
  try {
    if (isProductionWsfeUrl(url)) {
      return await postProductionWsfe(url, soapAction, soap);
    }

    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${soapAction}"`,
      },
      body: soap,
      signal: AbortSignal.timeout(WSFE_TIMEOUT_MS),
    });
  } catch (error) {
    throw wsfeNetworkError(error);
  }
}

async function executeWsfeOperation(input: WsfeCallInput): Promise<ParsedWsfeResult> {
  if (input.environment === "MODO_PRUEBA") {
    throw new ArcaWsfeError(
      "El modo prueba interno no se conecta con ARCA.",
      "INVALID_ENVIRONMENT",
    );
  }

  const now = input.now ?? new Date();
  assertUsableTicket(input.environment, input.accessTicket, now);
  const cuit = normalizeIssuerCuit(input.issuerCuit);
  const endpoints = resolveArcaEndpoints(input.environment);
  const authXml = buildWsfeAuthXml({
    token: input.accessTicket.token,
    sign: input.accessTicket.sign,
    cuit,
  });
  const operationXml = input.extraBody
    ? input.extraBody(authXml)
    : buildFeCompTotXRequestXml(authXml);
  const response = await postWsfe(
    endpoints.wsfeUrl,
    input.soapAction,
    buildWsfeEnvelope(operationXml),
  );

  let body: string;

  try {
    body = await response.text();
  } catch {
    throw new ArcaWsfeError(
      "No se pudo leer la respuesta de WSFEv1.",
      "NETWORK_ERROR",
    );
  }

  return interpretWsfeResponse({
    httpStatus: response.status,
    body,
    resultTag: `${input.operation}Result`,
    secrets: [input.accessTicket.token, input.accessTicket.sign],
    errors: input.errors,
  });
}

export async function getMaxRecordsPerRequest(input: {
  environment: WsfeEnvironment;
  accessTicket: ArcaAccessTicket;
  issuerCuit: string;
  now?: Date;
}): Promise<MaxRecordsPerRequest> {
  const parsed = await executeWsfeOperation({
    environment: input.environment,
    operation: FE_COMP_TOT_X_REQUEST,
    soapAction: FE_COMP_TOT_X_REQUEST_ACTION,
    accessTicket: input.accessTicket,
    issuerCuit: input.issuerCuit,
    now: input.now,
    extraBody: buildFeCompTotXRequestXml,
  });

  return {
    maxRecords: requireWsfeInteger(parsed.result.RegXReq, 1),
    events: parsed.events,
  };
}

export async function getLastAuthorizedVoucher(input: {
  environment: WsfeEnvironment;
  accessTicket: ArcaAccessTicket;
  issuerCuit: string;
  pointOfSale: number;
  voucherType: number;
  now?: Date;
}): Promise<LastAuthorizedVoucher> {
  if (input.environment === "MODO_PRUEBA") {
    throw new ArcaWsfeError(
      "El modo prueba interno no se conecta con ARCA.",
      "INVALID_ENVIRONMENT",
    );
  }

  const pointOfSale = parseArcaPointOfSale(String(input.pointOfSale));
  const voucherType = requireWsfeInteger(input.voucherType, 1);
  const parsed = await executeWsfeOperation({
    environment: input.environment,
    operation: FE_COMP_ULTIMO_AUTORIZADO,
    soapAction: FE_COMP_ULTIMO_AUTORIZADO_ACTION,
    accessTicket: input.accessTicket,
    issuerCuit: input.issuerCuit,
    now: input.now,
    extraBody: (authXml) =>
      buildFeCompUltimoAutorizadoXml({
        authXml,
        pointOfSale,
        voucherType,
      }),
  });
  const returnedPointOfSale = requireWsfeInteger(parsed.result.PtoVta, 1);
  const returnedVoucherType = requireWsfeInteger(parsed.result.CbteTipo, 1);
  const lastNumber = requireWsfeInteger(parsed.result.CbteNro, 0);

  if (returnedPointOfSale !== pointOfSale || returnedVoucherType !== voucherType) {
    throw new ArcaWsfeError(
      "La respuesta de WSFEv1 no se pudo interpretar.",
      "INVALID_RESPONSE",
    );
  }

  return {
    pointOfSale: returnedPointOfSale,
    voucherType: returnedVoucherType,
    lastNumber,
    events: parsed.events,
  };
}

export async function requestCae(
  input: ArcaCaeRequest & { now?: Date },
): Promise<ArcaCaeAuthorization> {
  const request = serializeCaeRequest(input);
  const parsed = await executeWsfeOperation({
    environment: input.environment,
    operation: FE_CAE_SOLICITAR,
    soapAction: FE_CAE_SOLICITAR_ACTION,
    accessTicket: input.accessTicket,
    issuerCuit: input.issuerCuit,
    now: input.now,
    errors: "return",
    extraBody: (authXml) => buildFeCaeSolicitarXml({ authXml, request }),
  });

  return parseCaeAuthorization({
    parsed,
    request,
    issuerCuit: normalizeIssuerCuit(input.issuerCuit),
    secrets: [input.accessTicket.token, input.accessTicket.sign],
  });
}

function assertVoucherNumber(value: number, maximum?: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || (maximum !== undefined && value > maximum)) {
    throw new ArcaWsfeError(
      "La consulta de comprobante no es válida.",
      "INVALID_VOUCHER_QUERY",
    );
  }

  return value;
}

export async function consultVoucher(
  input: ArcaVoucherQuery & { now?: Date },
): Promise<ArcaVoucher> {
  const pointOfSale = assertVoucherNumber(input.pointOfSale, 99999);
  const voucherType = assertVoucherNumber(input.voucherType);
  const voucherNumber = assertVoucherNumber(input.voucherNumber);
  const parsed = await executeWsfeOperation({
    environment: input.environment,
    operation: FE_COMP_CONSULTAR,
    soapAction: FE_COMP_CONSULTAR_ACTION,
    accessTicket: input.accessTicket,
    issuerCuit: input.issuerCuit,
    now: input.now,
    errors: "return",
    extraBody: (authXml) =>
      buildFeCompConsultarXml({
        authXml,
        pointOfSale,
        voucherType,
        voucherNumber,
      }),
  });

  throwIfVoucherErrors(parsed.errors);

  return parseConsultedVoucher({
    parsed,
    identity: { pointOfSale, voucherType, voucherNumber },
    secrets: [input.accessTicket.token, input.accessTicket.sign],
  });
}
