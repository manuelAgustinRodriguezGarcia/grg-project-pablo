import "server-only";
import { ArcaConfigurationError } from "@/server/arca/errors/arca-configuration.error";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";
import { getArcaCredentials } from "@/server/arca/config/credentials";
import { resolveArcaEndpoints } from "@/server/arca/config/endpoints";
import type { ArcaEnvironment } from "@/server/arca/types/arca.types";
import { buildLoginTicketRequest } from "@/server/arca/wsaa/build-tra";
import { signLoginTicketRequest } from "@/server/arca/wsaa/sign-tra";
import type { ArcaAccessTicket } from "@/server/arca/wsaa/wsaa.types";
import { interpretWsaaResponse } from "@/server/arca/wsaa/wsaa-response";

const WSAA_TIMEOUT_MS = 15_000;

const WSAA_NAMESPACE = "http://wsaa.view.sua.dvadac.desein.afip.gov";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildLoginCmsEnvelope(cmsBase64: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="${WSAA_NAMESPACE}">`,
    "  <soapenv:Header/>",
    "  <soapenv:Body>",
    "    <wsaa:loginCms>",
    `      <wsaa:in0>${escapeXml(cmsBase64)}</wsaa:in0>`,
    "    </wsaa:loginCms>",
    "  </soapenv:Body>",
    "</soapenv:Envelope>",
  ].join("\n");
}

async function postLoginCms(url: string, soap: string): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: '""',
      },
      body: soap,
      signal: AbortSignal.timeout(WSAA_TIMEOUT_MS),
    });
  } catch {
    throw new ArcaWsaaError("No se pudo conectar con WSAA.", "NETWORK_ERROR");
  }
}

/**
 * Pide un Ticket de Acceso a WSAA. No lo cachea y no reintenta.
 * MODO_PRUEBA no sale a la red.
 */
export async function requestWsaaTicket(
  environment: ArcaEnvironment | "MODO_PRUEBA",
  options?: { now?: Date },
): Promise<ArcaAccessTicket> {
  if (environment === "MODO_PRUEBA") {
    throw new ArcaConfigurationError(
      "El modo prueba interno no se conecta con ARCA.",
      "AMBIENTE_NO_SOPORTADO",
    );
  }

  const now = options?.now ?? new Date();
  const endpoints = resolveArcaEndpoints(environment);
  const credentials = getArcaCredentials(environment);
  const tra = buildLoginTicketRequest({
    service: endpoints.service,
    now,
  });
  const cmsBase64 = signLoginTicketRequest({
    traXml: tra.xml,
    certificatePem: credentials.certificatePem,
    privateKeyPem: credentials.privateKeyPem,
  });
  const response = await postLoginCms(
    endpoints.wsaaUrl,
    buildLoginCmsEnvelope(cmsBase64),
  );

  let body: string;

  try {
    body = await response.text();
  } catch {
    throw new ArcaWsaaError(
      "No se pudo leer la respuesta de WSAA.",
      "NETWORK_ERROR",
    );
  }

  const ticket = interpretWsaaResponse({
    httpStatus: response.status,
    body,
    now,
  });

  return {
    ...ticket,
    service: endpoints.service,
    environment,
  };
}
