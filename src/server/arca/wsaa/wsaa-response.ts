import "server-only";
import { XMLParser } from "fast-xml-parser";
import { ArcaWsaaError } from "@/server/arca/errors/arca-wsaa.error";

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

export type ParsedWsaaCredentials = {
  token: string;
  sign: string;
  generationTime: Date;
  expirationTime: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function findRecord(node: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(node)) {
    return null;
  }

  const direct = node[key];
  if (isRecord(direct)) {
    return direct;
  }

  for (const value of Object.values(node)) {
    const found = findRecord(value, key);
    if (found) {
      return found;
    }
  }

  return null;
}

function findValue(node: unknown, key: string): unknown {
  if (!isRecord(node)) {
    return undefined;
  }

  if (key in node) {
    return node[key];
  }

  for (const value of Object.values(node)) {
    const found = findValue(value, key);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function invalidResponse(): ArcaWsaaError {
  return new ArcaWsaaError(
    "La respuesta de WSAA no tiene un ticket válido.",
    "INVALID_RESPONSE",
  );
}

function tryParseXml(body: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = parser.parse(body);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseInnerXml(body: string): Record<string, unknown> {
  const parsed = tryParseXml(body);

  if (!parsed) {
    throw invalidResponse();
  }

  return parsed;
}

function throwIfSoapFault(document: Record<string, unknown>): void {
  const fault = findRecord(document, "Fault");

  if (!fault) {
    return;
  }

  const faultCode = textOf(fault.faultcode) ?? textOf(findValue(fault, "faultcode"));
  const faultString =
    textOf(fault.faultstring) ?? textOf(findValue(fault, "faultstring")) ?? undefined;

  throw new ArcaWsaaError("WSAA rechazó el loginCms.", "SOAP_FAULT", {
    faultCode: faultCode ?? undefined,
    faultString,
  });
}

function loginTicketDocument(loginCmsReturn: unknown): Record<string, unknown> {
  const inline = textOf(loginCmsReturn);

  if (inline) {
    return parseInnerXml(inline);
  }

  if (isRecord(loginCmsReturn)) {
    return loginCmsReturn;
  }

  throw invalidResponse();
}

function requireDate(value: unknown): Date {
  const text = textOf(value);

  if (!text) {
    throw invalidResponse();
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw invalidResponse();
  }

  return date;
}

export function interpretWsaaResponse(input: {
  httpStatus: number;
  body: string;
  now: Date;
}): ParsedWsaaCredentials {
  const httpFailed = input.httpStatus < 200 || input.httpStatus >= 300;
  const document = tryParseXml(input.body);

  if (!document) {
    if (httpFailed) {
      throw new ArcaWsaaError("WSAA respondió con un error HTTP.", "HTTP_ERROR", {
        httpStatus: input.httpStatus,
      });
    }

    throw invalidResponse();
  }

  throwIfSoapFault(document);

  if (httpFailed) {
    throw new ArcaWsaaError("WSAA respondió con un error HTTP.", "HTTP_ERROR", {
      httpStatus: input.httpStatus,
    });
  }

  const loginCmsReturn = findValue(document, "loginCmsReturn");

  if (loginCmsReturn === undefined) {
    throw invalidResponse();
  }

  const ticketDocument = loginTicketDocument(loginCmsReturn);
  const header = findRecord(ticketDocument, "header");
  const credentials = findRecord(ticketDocument, "credentials");

  if (!header || !credentials) {
    throw invalidResponse();
  }

  const token = textOf(credentials.token);
  const sign = textOf(credentials.sign);

  if (!token || !sign) {
    throw invalidResponse();
  }

  const generationTime = requireDate(header.generationTime);
  const expirationTime = requireDate(header.expirationTime);

  if (expirationTime.getTime() <= generationTime.getTime()) {
    throw invalidResponse();
  }

  if (expirationTime.getTime() <= input.now.getTime()) {
    throw new ArcaWsaaError(
      "El ticket de acceso de WSAA está vencido.",
      "TICKET_EXPIRED",
    );
  }

  return {
    token,
    sign,
    generationTime,
    expirationTime,
  };
}
