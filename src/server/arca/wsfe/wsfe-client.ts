import "server-only";
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
  buildFeCaeSolicitarXml,
  buildFeCompConsultarXml,
  buildFeCompTotXRequestXml,
  buildFeCompUltimoAutorizadoXml,
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

async function postWsfe(url: string, soapAction: string, soap: string): Promise<Response> {
  try {
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
